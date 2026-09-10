"""HTP Facade — Service 조합 + DTO 변환 + 상태전이 + 권한검증"""
import io
import logging

from PIL import Image

from app.core.exceptions import (
    EntityNotFoundException,
    InvalidOperationException,
    PermissionDeniedException,
)
from app.core.unit_of_work import UnitOfWork
from app.infrastructure.ai.base import (
    AIService,
    HTPBatchDetectionResult,
    HTPDetectionCategory,
    HTPDetectionItem,
)
from app.infrastructure.ai.remote import RemoteAIService, _KOREAN_TO_ENG
from app.infrastructure.storage import StorageBackend, get_storage
from app.modules.audit.repository import AuditLogRepository
from app.modules.audit.services import AuditLogger
from app.modules.auth.dependencies import InstitutionContext
from app.modules.client.repository import ClientRepository
from app.modules.examination.common.ai_job_service import AIAnalysisJobService
from app.modules.examination.common.models import Examination
from app.modules.examination.common.repository import ExaminationRepository
from app.modules.examination.common.state_machine import validate_transition
from app.modules.examination.htp.models import HTPDrawing, HTPObject, HTPInterpretation
from app.modules.examination.htp.repository import (
    HTPDrawingRepository,
    HTPInterpretationRepository,
    HTPObjectRepository,
)
from app.modules.examination.htp.schemas import (
    HTPDrawingResponse,
    HTPDrawingWithObjectsResponse,
    HTPFullResultsResponse,
    HTPImportantCarryOver,
    HTPInterpretationResponse,
    HTPObjectResponse,
    HTPResultsUpdate,
    HTPToggleImportantRequest,
    PDIItem,
)
from app.modules.examination.htp.services import (
    AssembleResultsService,
    InitializeDrawingsService,
    SaveDetectionsService,
    SaveDrawingImageService,
    ToggleImportantService,
    UpdateDrawingPDIService,
    ReinterpretService,
    UpdateInterpretationsService,
    UpdateObjectsService,
    interpretation_identity,
    split_interpretation_items,
)
from app.modules.notification.repository import NotificationRepository
from app.modules.notification.services import NotificationPublisher

logger = logging.getLogger(__name__)

# 결과 수정 가능 상태 — 임상가 검토 구간뿐이다.
#
# confirmed가 빠진 이유: 확정은 "이 내용으로 임상가가 책임진다"는 선언이고,
# 그 뒤 편집을 허용하면 같은 검사에서 서로 다른 보고서가 나온다(SaMD 무결성).
# 화면도 같은 경계를 쓴다 — core/status.ts의 isConfirmed가 confirmed 이후를
# 전부 읽기 전용으로 만든다. 예전에는 여기만 confirmed를 허용해서, 화면이
# 잠근 편집이 API로는 통과하는 상태였다.
_EDITABLE_STATUSES = {"ai_draft_ready", "under_review"}

# 재해석에서 DB 객체를 해석 API 입력으로 되돌릴 때 쓰는 역매핑.
# _KOREAN_TO_ENG(remote.py)의 반대 방향이라 거기서 뒤집어 만든다 — 두 벌을
# 손으로 적으면 한쪽만 고쳐도 아무도 모른 채 카테고리가 어긋난다.
_ENG_TO_KOREAN = {eng: kor for kor, eng in _KOREAN_TO_ENG.items()}
_CATEGORY_TO_IMG_NAME = {"house": "house", "tree": "tree", "man": "boy", "woman": "girl"}


class HTPFacade:
    """HTP 검사 Facade — Handler에서 호출, UoW 내부에서 동작"""

    def __init__(
        self,
        uow: UnitOfWork,
        ai_service: AIService | None = None,
        storage: StorageBackend | None = None,
        ctx: InstitutionContext | None = None,
    ):
        self._uow = uow
        self._ai_service = ai_service
        self._storage = storage or get_storage()
        self._ctx = ctx

    # ── 리포지토리 접근 (lazy) ──

    @property
    def _exam_repo(self) -> ExaminationRepository:
        return self._uow.repo(ExaminationRepository)

    @property
    def _drawing_repo(self) -> HTPDrawingRepository:
        return self._uow.repo(HTPDrawingRepository)

    @property
    def _object_repo(self) -> HTPObjectRepository:
        return self._uow.repo(HTPObjectRepository)

    @property
    def _interp_repo(self) -> HTPInterpretationRepository:
        return self._uow.repo(HTPInterpretationRepository)

    # ── 공통: 검사 검증 ──

    async def _verify_exam(
        self, exam_id: str, institution_id: str
    ) -> Examination:
        exam = await self._exam_repo.get(exam_id)
        if not exam:
            raise EntityNotFoundException(f"검사를 찾을 수 없습니다: {exam_id}")
        if exam.institution_id != institution_id:
            raise PermissionDeniedException("해당 기관의 검사가 아닙니다.")
        if exam.exam_type != "htp":
            raise InvalidOperationException("HTP 검사가 아닙니다.")
        if (
            self._ctx is not None
            and self._ctx.role == "clinician"
            and exam.examiner_id != self._ctx.member_id
        ):
            raise PermissionDeniedException("본인이 담당하는 검사가 아닙니다.")
        return exam

    def _require_editable(self, exam: Examination) -> None:
        """결과 수정 가능 상태인지 검증"""
        if exam.status not in _EDITABLE_STATUSES:
            raise InvalidOperationException(
                f"현재 상태({exam.status})에서는 결과를 수정할 수 없습니다."
            )

    async def _audit(
        self,
        *,
        action: str,
        entity_id: str,
        old_value: dict | None = None,
        new_value: dict | None = None,
        metadata: dict | None = None,
    ) -> None:
        """HTP 도메인 audit 기록 (ctx 부재 시 생략 — 인증 우회 경로 안전판)"""
        if self._ctx is None:
            return
        repo = self._uow.repo(AuditLogRepository)
        await AuditLogger(repo).log(
            action=action,
            entity_type="examination",
            entity_id=entity_id,
            actor_id=self._ctx.account_id,
            actor_email=self._ctx.email,
            actor_role=self._ctx.role,
            institution_id=self._ctx.institution_id,
            old_value=old_value,
            new_value=new_value,
            metadata=metadata,
        )

    # ── DTO 변환 ──

    @staticmethod
    def _build_pdi(raw: list[dict] | None) -> list[PDIItem] | None:
        """JSONB pdi_data → PDIItem 리스트 변환 (공통 헬퍼)"""
        if not raw:
            return None
        return [PDIItem(**item) for item in raw]

    @staticmethod
    def _drawing_to_dto(drawing: HTPDrawing) -> HTPDrawingResponse:
        return HTPDrawingResponse(
            id=drawing.id,
            examination_id=drawing.examination_id,
            category=drawing.category,
            image_url=drawing.image_url,
            original_image_url=drawing.original_image_url,
            image_width=drawing.image_width,
            image_height=drawing.image_height,
            pdi_data=HTPFacade._build_pdi(drawing.pdi_data),
            sort_order=drawing.sort_order,
            created_at=drawing.created_at,
            updated_at=drawing.updated_at,
        )

    @staticmethod
    def _object_to_dto(obj: HTPObject) -> HTPObjectResponse:
        return HTPObjectResponse.model_validate(obj)

    @staticmethod
    def _interp_to_dto(interp: HTPInterpretation) -> HTPInterpretationResponse:
        return HTPInterpretationResponse.model_validate(interp)

    def _build_full_results(
        self,
        examination_id: str,
        status: str,
        drawings_with_objects: list[tuple[HTPDrawing, list[HTPObject]]],
        interpretations: list[HTPInterpretation],
    ) -> HTPFullResultsResponse:
        drawing_dtos = [
            HTPDrawingWithObjectsResponse(
                id=drawing.id,
                examination_id=drawing.examination_id,
                category=drawing.category,
                image_url=drawing.image_url,
                original_image_url=drawing.original_image_url,
                image_width=drawing.image_width,
                image_height=drawing.image_height,
                pdi_data=self._build_pdi(drawing.pdi_data),
                sort_order=drawing.sort_order,
                created_at=drawing.created_at,
                updated_at=drawing.updated_at,
                objects=[self._object_to_dto(obj) for obj in objects],
            )
            for drawing, objects in drawings_with_objects
        ]

        return HTPFullResultsResponse(
            examination_id=examination_id,
            status=status,
            drawings=drawing_dtos,
            interpretations=[self._interp_to_dto(i) for i in interpretations],
        )

    # ── 유스케이스 ──

    async def initialize_drawings(
        self, exam_id: str, institution_id: str
    ) -> list[HTPDrawingResponse]:
        exam = await self._verify_exam(exam_id, institution_id)

        # 상태 전이: created → in_progress
        if exam.status == "created":
            validate_transition(exam.status, "in_progress")
            exam.status = "in_progress"
            from app.core.datetime_utils import utc_now
            exam.started_at = utc_now()
            await self._exam_repo.flush()
            await self._audit(
                action="state_change",
                entity_id=exam_id,
                metadata={"from": "created", "to": "in_progress", "module": "htp"},
            )

        service = InitializeDrawingsService(self._drawing_repo)
        drawings = await service.execute(exam_id)
        return [self._drawing_to_dto(d) for d in drawings]

    async def list_drawings(
        self, exam_id: str, institution_id: str
    ) -> list[HTPDrawingResponse]:
        await self._verify_exam(exam_id, institution_id)
        drawings = await self._drawing_repo.list_by_examination(exam_id)
        return [self._drawing_to_dto(d) for d in drawings]

    async def update_drawing(
        self, exam_id: str, drawing_id: str, institution_id: str,
        pdi_data: list[PDIItem] | None = None,
    ) -> HTPDrawingResponse:
        await self._verify_exam(exam_id, institution_id)

        pdi_dicts = None
        if pdi_data is not None:
            pdi_dicts = [item.model_dump() for item in pdi_data]

        service = UpdateDrawingPDIService(self._drawing_repo)
        drawing = await service.execute(exam_id, drawing_id, pdi_dicts)
        return self._drawing_to_dto(drawing)

    async def upload_image(
        self, exam_id: str, drawing_id: str, institution_id: str,
        image_data: bytes, filename: str,
    ) -> HTPDrawingResponse:
        await self._verify_exam(exam_id, institution_id)

        drawing = await self._drawing_repo.get(drawing_id)
        if not drawing or drawing.examination_id != exam_id:
            raise EntityNotFoundException(f"그림을 찾을 수 없습니다: {drawing_id}")

        # EXIF 회전 적용 + A4 비율 리사이즈 (방향은 그림이 정한다)
        image_data, width, height = self._normalize_image(image_data)

        # 파일 저장 → S3/Local 스토리지 위임 (항상 PNG로 저장)
        storage_path = f"htp/{exam_id}/{drawing.category}.png"
        image_url = await self._storage.upload(storage_path, image_data, "image/png")

        service = SaveDrawingImageService(self._drawing_repo)
        drawing = await service.execute(exam_id, drawing_id, image_url, width, height)
        # 원본 이미지 URL 저장 (분석 후 image_url이 전처리 이미지로 교체됨)
        drawing.original_image_url = image_url
        await self._drawing_repo.flush()
        await self._drawing_repo.refresh(drawing)
        return self._drawing_to_dto(drawing)

    # AI 서버 처리 크기 (A4 비율) — 이미지를 이 크기로 리사이즈하면 AI 좌표계와 일치
    _TARGET_PORTRAIT = (1050, 1485)   # 세로 A4
    _TARGET_LANDSCAPE = (1485, 1050)  # 가로 A4

    @staticmethod
    def _normalize_image(image_data: bytes) -> tuple[bytes, int, int]:
        """EXIF 회전 적용 + A4 비율 리사이즈. **방향은 그림이 정한다.**

        예전에는 카테고리가 방향을 강제했다(house=가로, 나머지=세로). 어긋나면
        90° 돌렸는데, 실제 아동 그림 넉 장이 전부 가로로 스캔돼 들어오자
        나무·남자·여자가 통째로 옆으로 누웠다. 그리고 그 상태로 탐지를 돌리면
        **AI가 다른 것을 본다** — 같은 그림으로 실측한 결과다:

            누운 나무   → ['그네']                             (1개, 틀림)
            세운 나무   → ['나무전체','기둥','수관','가지']      (4개, 맞음)
            누운 사람   → 머리·눈·코를 못 찾음
            세운 사람   → ['사람전체','머리','얼굴','눈','코',…]

        AI 서버가 세로를 요구하지도 않는다. 가로로 보내도 똑같이 잘 탐지한다
        (위 '세운 나무'가 1485x1050 가로다). 필요 없는 규칙이 해만 끼치고 있었다.

        게다가 용지를 돌려 그린 것은 HTP에서 채점 대상 행동이다. 코드가
        "바로잡으면" 그 임상 정보가 사라진다. 돌릴지 말지는 임상가가 정할 일이라
        여기서는 판단하지 않는다.

        ⚠️ 리사이즈 목표도 **그림의 실제 방향**을 따라야 한다. 회전만 없애고
        목표를 카테고리로 고르면 가로 그림이 세로 A4로 찌그러져 더 나빠진다 —
        방향을 정하는 규칙이 두 곳에 있었기 때문이다.

        종횡비는 아직 보존하지 않는다(A4가 아닌 사진은 늘어난다). 별건이다.
        """
        from PIL import ImageOps

        img = Image.open(io.BytesIO(image_data))
        img = ImageOps.exif_transpose(img)

        w, h = img.size
        target = (
            HTPFacade._TARGET_LANDSCAPE if w > h else HTPFacade._TARGET_PORTRAIT
        )
        img = img.resize(target, Image.LANCZOS)
        w, h = img.size

        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True)
        return buf.getvalue(), w, h

    async def analyze(
        self, exam_id: str, institution_id: str,
        drawing_ids: list[str] | None = None,
        actor_member_id: str | None = None,
    ) -> HTPFullResultsResponse:
        exam = await self._verify_exam(exam_id, institution_id)

        # 분석 시작을 작업으로 기록한다. status는 건드리지 않는다 —
        # 분석 중이라는 사실은 상태가 아니라 진행 중인 job이 말해 준다.
        job = await AIAnalysisJobService(self._uow).start(exam_id, "htp")
        await self._audit(
            action="ai_analyze",
            entity_id=exam_id,
            metadata={"module": "htp", "job_id": job.id, "status_at_start": exam.status},
        )

        all_drawings = await self._drawing_repo.list_by_examination(exam_id)

        # ── 어떤 그림을 다시 탐지할지 정한다 ──
        #
        # drawing_ids가 오면 그 그림만 갈아엎는다. 예전에는 이 인자를 받기만
        # 하고 **한 번도 쓰지 않아서**, 이미지가 있는 카테고리를 매번 전부
        # 다시 탐지하고 객체를 통째로 재생성했다. 그래서 나무를 새로 올리면
        # 임상가가 집에서 옮겨 둔 BBox와 손으로 넣은 항목이 함께 사라졌다.
        #
        # 아직 탐지 결과가 없는 그림은 요청에 없어도 대상에 넣는다 — 해석
        # API가 네 카테고리의 label을 전부 요구하기 때문이다
        # (_objects_to_detection_result 주석).
        existing_objects = await self._object_repo.list_by_examination(exam_id)
        drawings_with_detections = {o.drawing_id for o in existing_objects}
        requested = set(drawing_ids or [])
        targets = {
            d.id for d in all_drawings
            if not requested or d.id in requested or d.id not in drawings_with_detections
        }

        # 대상 그림의 이미지만 내려받는다 (나머지는 placeholder로 채워진다)
        images: dict[str, bytes] = {}
        uploaded_categories: set[str] = set()
        for drawing in all_drawings:
            if drawing.id not in targets:
                continue
            # 원본 이미지(우리 스토리지)를 우선 사용, 없으면 image_url 폴백
            download_url = drawing.original_image_url or drawing.image_url
            if download_url and not download_url.startswith("http"):
                try:
                    img_data, _ = await self._storage.download(download_url)
                    images[drawing.category] = img_data
                    uploaded_categories.add(drawing.category)
                except Exception:
                    logger.warning("이미지 로드 실패 (drawing=%s, url=%s)", drawing.id, download_url)
            elif download_url:
                logger.warning("외부 URL은 다운로드 불가, 건너뜀 (drawing=%s, url=%s)", drawing.id, download_url)

        if not images:
            raise InvalidOperationException("분석할 이미지가 없습니다. 최소 1장을 업로드해주세요.")

        logger.info(
            "HTP 검사 %s: %d장 실제 이미지로 탐지 요청 (대상 그림 %d개, 미업로드는 placeholder)",
            exam_id, len(images), len(targets),
        )

        # 내담자 정보 조회 (해석 API에 전달) — 재해석과 같은 값을 써야
        # 같은 그림에서 다른 해석이 나오지 않는다.
        child_data = await self._build_child_data(exam)

        # 1) 객체 탐지 — 미업로드 카테고리는 RemoteAIService가 placeholder로 채움
        meta = {"gender": (child_data or {}).get("gender", "남자"), "age": 0}
        if child_data and child_data["birth"] != "20100101":
            from datetime import date
            try:
                birth = date(int(child_data["birth"][:4]), int(child_data["birth"][4:6]), int(child_data["birth"][6:8]))
                meta["age"] = (date.today() - birth).days // 365
            except (ValueError, IndexError):
                pass
        # AI 호출이 실패하면 job에 사유를 남긴다. 예전에는 status를
        # ai_analyzing으로 바꿔 둔 채 되돌리는 코드가 없어 그대로 갇혔다.
        try:
            batch_result = await self._ai_service.detect_htp_batch(images, meta=meta)
        except Exception as exc:
            await AIAnalysisJobService(self._uow).fail(job, f"{type(exc).__name__}: {exc}")
            raise

        # 2) AI 전처리 이미지 URL 저장 (BBox 좌표와 정확히 일치) — 좌표를
        #    스케일할 때 이 크기를 쓰므로 객체 저장보다 먼저 해야 한다.
        await self._save_preprocessed_images(exam_id, all_drawings, batch_result, uploaded_categories)

        # 3) 대상 그림의 객체만 교체한다 (좌표만 — 조건·해석은 아래에서 한 번에)
        analysis_map = RemoteAIService.batch_to_analysis_map(batch_result)
        target_drawings = [
            d for d in all_drawings if d.id in targets and analysis_map.get(d.category)
        ]
        detection_data = {
            d.id: {
                "img_size": analysis_map[d.category].img_size,
                "objects": [o.model_dump() for o in analysis_map[d.category].objects],
            }
            for d in target_drawings
        }
        await SaveDetectionsService(self._object_repo, self._interp_repo).execute(
            exam_id, target_drawings, detection_data
        )

        # 4) 해석은 **DB의 현재 객체 전체**로 만든다 — 재해석과 완전히 같은 경로다.
        #
        # 갓 탐지한 그림은 새 좌표를, 손대지 않은 그림은 임상가가 옮겨 둔
        # 좌표를 쓴다. 덕분에 나무를 새로 올려도 집에서 고친 내용이 해석에
        # 반영된다. 예전에는 AI 탐지 결과를 그대로 해석에 넘겨서, 임상가의
        # 수정이 매 업로드마다 없던 일이 됐다.
        important_keys = await self._collect_important_keys(exam_id)
        await self._interp_repo.soft_delete_by_examination(exam_id)

        assemble = AssembleResultsService(
            self._drawing_repo, self._object_repo, self._interp_repo
        )
        drawings_with_objects, _ = await assemble.execute(exam_id)
        detection = self._objects_to_detection_result(drawings_with_objects)

        try:
            interp_result = await self._ai_service.interpret_htp(detection, child=child_data)
        except Exception as exc:
            await AIAnalysisJobService(self._uow).fail(job, f"{type(exc).__name__}: {exc}")
            raise

        interp_by_obj, general_interps = split_interpretation_items(interp_result.data)
        logger.info(
            "해석 API 매핑 키: %s (총 %d개 객체해석 + %d개 일반해석)",
            {k: len(v) for k, v in interp_by_obj.items()}, len(interp_by_obj), len(general_interps),
        )

        carried, lost = await ReinterpretService(
            self._object_repo, self._interp_repo
        ).execute(
            exam_id, drawings_with_objects, interp_by_obj, general_interps,
            important_keys=important_keys,
        )

        # 분석 완료 기록
        await AIAnalysisJobService(self._uow).succeed(job)

        # 상태 전이: 초안이 만들어졌다 → 검토 대기.
        # 재분석이면 이미 ai_draft_ready이므로 그대로 둔다.
        prev = exam.status
        if exam.status != "ai_draft_ready":
            validate_transition(exam.status, "ai_draft_ready")
            exam.status = "ai_draft_ready"
            logger.info("HTP 검사 %s: 상태 전이 %s → ai_draft_ready", exam_id, prev)
        await self._exam_repo.flush()
        await self._audit(
            action="state_change",
            entity_id=exam_id,
            metadata={
                "from": prev,
                "to": exam.status,
                "module": "htp",
                "job_id": job.id,
                "object_count": sum(len(c.detections) for c in batch_result.data),
                "interpretation_count": len(general_interps),
                "important_carried": carried,
                "important_lost": lost,
            },
        )

        # 알림: AI 분석 완료 → 검사 담당자에게 발송 (비동기 작업이므로 본인에게도 발송)
        notifier = NotificationPublisher(self._uow.repo(NotificationRepository))
        await notifier.publish(
            institution_id=institution_id,
            recipient_member_id=exam.examiner_id,
            type="examination.ai_draft_ready",
            title="AI 분석이 완료되었습니다",
            body="결과를 검토해주세요.",
            entity_type="examination",
            entity_id=exam_id,
            link_path=f"/examinations/{exam_id}/htp/results",
            actor_member_id=actor_member_id,
        )

        return await self._get_full_results(
            exam_id, exam.status,
            carry_over=HTPImportantCarryOver(carried=carried, lost=lost),
        )

    async def reinterpret(
        self, exam_id: str, institution_id: str,
        actor_member_id: str | None = None,
    ) -> HTPFullResultsResponse:
        """임상가가 손본 탐지 결과로 해석을 다시 만든다.

        재탐지(detect)는 하지 않는다 — 해석 API는 이미지가 아니라 좌표를
        받으므로(remote.interpret_htp), DB에 저장된 현재 BBox를 그대로
        입력으로 쓰면 된다. 덕분에 임상가가 박스를 옮긴 결과가 그대로
        조건(main_cond/sub_cond)과 해석 문장에 반영된다.

        이게 없던 동안, 임상가가 "지붕 크기: 크다"를 "작다"로 고쳐도
        해석 문장은 '크다'에 근거한 그대로였다 — 한 줄에서 표현 열과 해석이
        서로 다른 판정을 가리켰고, 그대로 보고서에 실렸다.
        """
        exam = await self._verify_exam(exam_id, institution_id)
        self._require_editable(exam)

        assemble = AssembleResultsService(
            self._drawing_repo, self._object_repo, self._interp_repo
        )
        drawings_with_objects, _ = await assemble.execute(exam_id)

        detection = self._objects_to_detection_result(drawings_with_objects)
        if not detection.data:
            raise InvalidOperationException(
                "재해석할 탐지 결과가 없습니다. 먼저 AI 분석을 실행해주세요."
            )

        job = await AIAnalysisJobService(self._uow).start(exam_id, "htp")
        await self._audit(
            action="ai_reinterpret",
            entity_id=exam_id,
            metadata={"module": "htp", "job_id": job.id},
        )

        child_data = await self._build_child_data(exam)
        try:
            interp_result = await self._ai_service.interpret_htp(detection, child=child_data)
        except Exception as exc:
            await AIAnalysisJobService(self._uow).fail(job, f"{type(exc).__name__}: {exc}")
            raise

        interp_by_obj, general_interps = split_interpretation_items(interp_result.data)

        important_keys = await self._collect_important_keys(exam_id)
        await self._interp_repo.soft_delete_by_examination(exam_id)

        service = ReinterpretService(self._object_repo, self._interp_repo)
        carried, lost = await service.execute(
            exam_id, drawings_with_objects, interp_by_obj, general_interps,
            important_keys=important_keys,
        )

        await AIAnalysisJobService(self._uow).succeed(job)
        await self._audit(
            action="update_results",
            entity_id=exam_id,
            metadata={
                "module": "htp",
                "source": "reinterpret",
                "job_id": job.id,
                "interpretation_count": len(interp_result.data),
                "important_carried": carried,
                "important_lost": lost,
            },
        )

        return await self._get_full_results(
            exam_id, exam.status,
            carry_over=HTPImportantCarryOver(carried=carried, lost=lost),
        )

    @staticmethod
    def _objects_to_detection_result(
        drawings_with_objects: list[tuple[HTPDrawing, list[HTPObject]]],
    ) -> HTPBatchDetectionResult:
        """DB의 현재 객체를 해석 API 입력 형식으로 되돌린다.

        좌표는 DB에 저장된 실제 이미지 좌표를 그대로 쓰고 img_size도 실제
        이미지 크기를 준다 — 둘이 같은 좌표계라야 해석 API의 비율 판정
        (크다/작다, 위/아래)이 맞는다. 최초 분석 때 AI 좌표를 실제 좌표로
        스케일해 저장했으므로(SaveDetectionsService) 여기서 되돌릴 필요는 없다.

        ⚠️ **탐지 안 된 객체도 반드시 넣는다** (points=[]).
        해석 API는 카테고리마다 정해진 label을 전부 요구하고, 빠진 게 있으면
        400으로 거절한다:
            House.create() missing 14 required positional arguments: 'roof', ...
        빈 points는 "그 객체가 없다"는 정보이고, 실제로 '객체 유무 → 무'
        해석의 근거다. 그래서 필터 기준은 "좌표가 있나"가 아니라
        **"탐지에서 온 객체인가"**(bbox_data가 있나)다. 임상가가 손으로 추가한
        항목만 bbox_data가 NULL이라 여기서 빠진다.
        """
        categories = []
        for drawing, objects in drawings_with_objects:
            detections = [
                HTPDetectionItem(
                    label=obj.label,
                    points=(obj.bbox_data or {}).get("points") or [],
                    confidence=(obj.bbox_data or {}).get("confidence") or [],
                )
                for obj in objects
                if obj.bbox_data is not None
            ]
            # 탐지 결과가 통째로 없는 그림(미업로드)만 건너뛴다. 좌표가 하나도
            # 안 잡힌 그림은 건너뛰면 안 된다 — 그 카테고리 해석이 통째로
            # 사라지고, 실제로 '남자사람'이 payload에서 빠졌었다.
            if not detections:
                continue
            categories.append(HTPDetectionCategory(
                category=_ENG_TO_KOREAN[drawing.category],
                img_name=_CATEGORY_TO_IMG_NAME[drawing.category],
                original_img_url=drawing.original_image_url or "",
                img_url=drawing.image_url or "",
                img_size={
                    "width": drawing.image_width or 0,
                    "height": drawing.image_height or 0,
                },
                detections=detections,
            ))
        return HTPBatchDetectionResult(meta={}, data=categories)

    async def _build_child_data(self, exam: Examination) -> dict | None:
        """해석 API에 넘길 내담자 정보 (분석·재해석이 같은 값을 쓴다)"""
        if not exam.client_id:
            return None
        client = await self._uow.repo(ClientRepository).get(exam.client_id)
        if not client:
            return None
        gender_map = {"male": "남자", "female": "여자"}
        return {
            "name": client.name or "",
            "birth": client.birth_date.strftime("%Y%m%d") if client.birth_date else "20100101",
            "gender": gender_map.get(client.gender, "남자"),
        }

    async def get_results(
        self, exam_id: str, institution_id: str
    ) -> HTPFullResultsResponse:
        exam = await self._verify_exam(exam_id, institution_id)
        return await self._get_full_results(exam_id, exam.status)

    async def update_results(
        self, exam_id: str, institution_id: str, data: HTPResultsUpdate,
    ) -> HTPFullResultsResponse:
        exam = await self._verify_exam(exam_id, institution_id)
        self._require_editable(exam)

        deleted_interp_count = 0
        if data.delete_object_ids:
            # 이 검사에 속한 것만 지운다 — 검증을 통과한 id만 모아
            # 해석까지 한 번에 지운다(고아 해석 방지, repository 주석 참고).
            verified_ids: list[str] = []
            for obj_id in data.delete_object_ids:
                obj = await self._object_repo.get(obj_id)
                if obj and obj.examination_id == exam_id:
                    verified_ids.append(obj_id)
                    await self._object_repo.delete(obj_id)
            deleted_interp_count = await self._interp_repo.soft_delete_by_objects(verified_ids)

        if data.objects:
            obj_service = UpdateObjectsService(self._object_repo)
            cleared_ids = await obj_service.execute(
                exam_id,
                [obj.model_dump() for obj in data.objects],
            )
            # 탐지를 취소한 객체의 해석도 함께 지운다 (UpdateObjectsService 주석)
            deleted_interp_count += await self._interp_repo.soft_delete_by_objects(
                cleared_ids
            )

        if data.interpretations:
            interp_service = UpdateInterpretationsService(self._interp_repo)
            await interp_service.execute(
                exam_id,
                [interp.model_dump() for interp in data.interpretations],
            )

        await self._audit(
            action="update_results",
            entity_id=exam_id,
            metadata={
                "module": "htp",
                "deleted_objects": len(data.delete_object_ids or []),
                "deleted_interpretations": deleted_interp_count,
                "updated_objects": len(data.objects or []),
                "updated_interpretations": len(data.interpretations or []),
            },
        )

        return await self._get_full_results(exam_id, exam.status)

    async def toggle_important(
        self, exam_id: str, institution_id: str, data: HTPToggleImportantRequest,
    ) -> HTPInterpretationResponse:
        exam = await self._verify_exam(exam_id, institution_id)
        self._require_editable(exam)

        service = ToggleImportantService(self._interp_repo)
        interp = await service.execute(exam_id, data.interpretation_id, data.is_important)

        # 별표는 보고서 PDF의 ★ 열로 그대로 나간다 — 발행물을 바꾸는 변경이라
        # 이력이 남아야 한다(감사추적). 예전에는 이 경로만 기록이 없었다.
        await self._audit(
            action="toggle_important",
            entity_id=exam_id,
            new_value={"is_important": data.is_important},
            metadata={"module": "htp", "interpretation_id": data.interpretation_id},
        )
        return self._interp_to_dto(interp)

    async def generate_report_pdf(
        self,
        exam_id: str,
        institution_id: str,
        base_url: str = "http://localhost:4502",
        actor_member_id: str | None = None,
    ) -> bytes:
        """HTP 보고서 PDF 생성 + 발송 알림"""
        # 보고서/PDF 라이브러리는 무거우므로 lazy import 유지
        from app.modules.examination.common.state_machine import validate_transition
        from app.modules.examination.report.service import HTPReportService
        from app.modules.member.repository import MemberRepository

        exam = await self._verify_exam(exam_id, institution_id)

        # 결과 조회
        assemble = AssembleResultsService(
            self._drawing_repo, self._object_repo, self._interp_repo,
        )
        drawings_with_objects, interpretations = await assemble.execute(exam_id)

        # 내담자 / 검사자 정보 조회
        client_name = None
        client_gender = None
        client_birth_date = None
        if exam.client_id:
            client = await self._uow.repo(ClientRepository).get(exam.client_id)
            if client:
                client_name = client.name
                client_gender = client.gender
                client_birth_date = client.birth_date

        examiner_name = None
        if exam.examiner_id:
            member = await self._uow.repo(MemberRepository).get(exam.examiner_id)
            if member:
                examiner_name = member.name

        # PDF 생성
        report_service = HTPReportService()
        pdf_bytes = report_service.generate_pdf(
            drawings_with_objects=drawings_with_objects,
            interpretations=interpretations,
            client_name=client_name,
            client_gender=client_gender,
            client_birth_date=client_birth_date,
            examiner_name=examiner_name,
            exam_started_at=exam.started_at,
            base_url=base_url,
        )

        # 상태 전이: confirmed → report_generated (최초 PDF 생성 시점)
        if exam.status == "confirmed":
            validate_transition(exam.status, "report_generated")
            exam.status = "report_generated"
            await self._exam_repo.flush()
            await self._audit(
                action="state_change",
                entity_id=exam_id,
                metadata={"from": "confirmed", "to": "report_generated", "module": "htp"},
            )

        await self._audit(
            action="generate_report",
            entity_id=exam_id,
            metadata={"module": "htp", "size_bytes": len(pdf_bytes)},
        )

        # 알림: 보고서 준비 완료 → 검사 담당자에게 발송 (본인이 직접 생성한 경우 생략)
        notifier = NotificationPublisher(self._uow.repo(NotificationRepository))
        await notifier.publish(
            institution_id=institution_id,
            recipient_member_id=exam.examiner_id,
            type="examination.report_ready",
            title="검사 보고서가 생성되었습니다",
            entity_type="examination",
            entity_id=exam_id,
            link_path=f"/examinations/{exam_id}/htp/results",
            actor_member_id=actor_member_id,
            skip_self=True,
        )
        return pdf_bytes

    # ── 내부 헬퍼 ──

    async def _collect_important_keys(self, exam_id: str) -> set[tuple[str, str, str]]:
        """지금 별표가 붙어 있는 해석들의 identity 집합 (재생성 이월용)"""
        existing = await self._interp_repo.list_by_examination(exam_id)
        return {
            interpretation_identity(i.drawing_id, i.sub_category, i.sentence)
            for i in existing
            if i.is_important
        }

    @staticmethod
    def _needs_reinterpret(
        drawings_with_objects: list[tuple[HTPDrawing, list[HTPObject]]],
        interpretations: list[HTPInterpretation],
    ) -> bool:
        """탐지 결과가 해석보다 나중에 바뀌었는가.

        PostgreSQL의 now()는 **트랜잭션 시작 시각**이라 같은 트랜잭션의
        INSERT/UPDATE가 모두 같은 값을 갖는다. 그래서:
          - 재해석: 객체 updated_at == 해석 created_at  → False
          - 임상가 편집: 객체 updated_at  > 해석 created_at → True
        순서를 신경 쓰지 않아도 성립한다.

        해석이 아직 없으면 False다 — 그건 '재해석'이 아니라 최초 분석 대상이다.
        """
        last_interp = max((i.created_at for i in interpretations), default=None)
        if last_interp is None:
            return False
        last_object = max(
            (o.updated_at for _, objects in drawings_with_objects for o in objects),
            default=None,
        )
        return last_object is not None and last_object > last_interp

    async def _get_full_results(
        self, exam_id: str, status: str,
        carry_over: HTPImportantCarryOver | None = None,
    ) -> HTPFullResultsResponse:
        service = AssembleResultsService(
            self._drawing_repo, self._object_repo, self._interp_repo
        )
        drawings_with_objects, interpretations = await service.execute(exam_id)
        result = self._build_full_results(
            exam_id, status, drawings_with_objects, interpretations
        )
        result.important_carry_over = carry_over
        result.needs_reinterpret = self._needs_reinterpret(
            drawings_with_objects, interpretations
        )
        return result

    async def _save_preprocessed_images(
        self,
        exam_id: str,
        all_drawings: list[HTPDrawing],
        batch_result,
        uploaded_categories: set[str],
    ) -> None:
        """AI 서버 전처리 이미지 URL을 Drawing에 저장.

        AI 서버가 전처리된 이미지를 S3 URL로 반환하므로,
        그 URL을 직접 사용하면 BBox 좌표와 정확히 일치한다.
        """
        drawing_by_cat = {d.category: d for d in all_drawings}

        for cat_data in batch_result.data:
            eng_cat = _KOREAN_TO_ENG.get(cat_data.category)
            if not eng_cat or eng_cat not in uploaded_categories:
                continue
            if not cat_data.img_url:
                continue

            drawing = drawing_by_cat.get(eng_cat)
            if not drawing:
                continue

            img_size = cat_data.img_size
            drawing.image_url = cat_data.img_url
            drawing.image_width = img_size.get("width", drawing.image_width)
            drawing.image_height = img_size.get("height", drawing.image_height)

            logger.info(
                "전처리 이미지 URL 저장: %s → %s (%dx%d)",
                eng_cat, cat_data.img_url,
                drawing.image_width, drawing.image_height,
            )

        await self._drawing_repo.flush()
