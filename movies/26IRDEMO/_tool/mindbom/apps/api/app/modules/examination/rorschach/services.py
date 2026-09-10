"""로르샤하 Services"""
import logging
from datetime import datetime

from app.core.exceptions import (
    EntityNotFoundException,
    ExternalServiceException,
    InvalidOperationException,
    PermissionDeniedException,
)

logger = logging.getLogger(__name__)
from app.infrastructure.ai.base import AIService
from app.modules.examination.common.models import Examination
from app.modules.examination.common.repository import ExaminationRepository
from app.modules.examination.common.state_machine import is_confirmed, validate_transition
from app.modules.examination.rorschach.coding_codes import (
    is_known_code,
    is_valid_location,
    unknown_codes,
)
from app.modules.examination.rorschach.completion import (
    describe_response,
    card_label,
    display_numbers,
    unfinished_cards,
    uncoded_responses,
)
from app.modules.examination.rorschach.models import (
    RorschachRegion,
    RorschachResponse,
    RorschachSession,
)
from app.modules.examination.rorschach.repository import (
    RorschachCardAdministrationRepository,
    RorschachInterventionRepository,
    RorschachRegionRepository,
    RorschachResponseRepository,
    RorschachSessionRepository,
)
from app.modules.examination.rorschach.schemas import (
    CardAdministrationResponse,
    CardStatusUpdate,
    InterventionCreate,
    InterventionResponse,
    RegionCreate,
    RegionResponse,
    RegionUpdate,
    ResponseCreate,
    ResponseDetail,
    ResponseUpdate,
    RorschachCoding,
    SessionDetailResponse,
    SessionResponse,
    SessionWithRegionsResponse,
    StructuralSummaryResponse,
    TranscriptClipResponse,
    TranscriptResponse,
    TranscriptSegment,
)
from app.modules.examination.rorschach.scoring import (
    calculate_lower_section,
    calculate_special_indices,
    calculate_structural_summary,
)


def _ensure_examination(
    examination: Examination | None,
    institution_id: str,
) -> Examination:
    """검사 존재 + 권한 + 로르샤하 타입 확인"""
    if not examination or examination.deleted_at is not None:
        raise EntityNotFoundException("검사를 찾을 수 없습니다.")
    if examination.institution_id != institution_id:
        raise PermissionDeniedException("해당 기관의 검사가 아닙니다.")
    if examination.exam_type != "rorschach":
        raise InvalidOperationException("로르샤하 검사가 아닙니다.")
    return examination


def _ensure_editable(examination: Examination) -> Examination:
    """확정 전인지 확인 — 검사 기록을 바꾸는 모든 경로가 통과해야 한다.

    확정 전에는 자유롭게 오간다(§3-1 "벽 없음"). 실제 검사는 순서대로 가지만
    기록은 순차적이지 않아서, 채점하다 빠진 반응을 발견하면 되돌아가야 한다.

    확정 이후에는 막는다. 확정본이 조용히 바뀌면 감사추적이 무의미해지고,
    이미 산출된 구조요약·보고서와 원자료가 어긋난다(SaMD 데이터 무결성).

    호출부마다 조건을 적으면 언젠가 한 곳이 빠진다 — 여기 한 곳으로 모은다.
    """
    if is_confirmed(examination.status):
        raise InvalidOperationException(
            f"확정된 검사({examination.status})의 기록은 수정할 수 없습니다."
        )
    return examination


def _to_region_response(region: RorschachRegion, card_no: int | None = None) -> RegionResponse:
    """ORM → Response (path_json을 path로 변환)

    card_no는 Region이 더 이상 갖지 않는다(§4-5). 소유 반응에서 읽어 넘긴다.
    반응에 아직 붙지 않은 조각은 None이다.
    """
    return RegionResponse(
        id=region.id,
        session_id=region.session_id,
        response_id=region.response_id,
        card_no=card_no,
        path=region.path_json,
        memo=region.memo,
        audio_timestamp_start_sec=region.audio_timestamp_start_sec,
        audio_timestamp_end_sec=region.audio_timestamp_end_sec,
        created_at=region.created_at,
        updated_at=region.updated_at,
    )


class StartRorschachSessionService:
    """세션 시작: 검사 상태를 in_progress로 전이하고 세션 생성 (이미 있으면 반환)"""
    def __init__(
        self,
        session_repo: RorschachSessionRepository,
        examination_repo: ExaminationRepository,
    ):
        self.session_repo = session_repo
        self.examination_repo = examination_repo

    async def execute(self, examination_id: str, institution_id: str) -> RorschachSession:
        examination = await self.examination_repo.get(examination_id)
        examination = _ensure_examination(examination, institution_id)

        existing = await self.session_repo.get_by_examination_id(examination_id)
        if existing:
            return existing

        # created → in_progress 전이 (이미 in_progress면 그대로 둠)
        if examination.status == "created":
            validate_transition(examination.status, "in_progress")
            examination.status = "in_progress"
            examination.started_at = datetime.utcnow()
            await self.examination_repo.flush()

        session = await self.session_repo.create({
            "examination_id": examination_id,
            "started_at": datetime.utcnow(),
        })
        return session


class GetRorschachSessionService:
    """세션 + 영역 일괄 조회"""
    def __init__(
        self,
        session_repo: RorschachSessionRepository,
        region_repo: RorschachRegionRepository,
        response_repo: RorschachResponseRepository,
        examination_repo: ExaminationRepository,
    ):
        self.session_repo = session_repo
        self.region_repo = region_repo
        self.response_repo = response_repo
        self.examination_repo = examination_repo

    async def execute(self, examination_id: str, institution_id: str) -> SessionWithRegionsResponse:
        examination = await self.examination_repo.get(examination_id)
        _ensure_examination(examination, institution_id)

        session = await self.session_repo.get_by_examination_id(examination_id)
        if not session:
            raise EntityNotFoundException("로르샤하 세션이 시작되지 않았습니다.")

        regions = await self.region_repo.list_by_session(session.id)
        responses = await self.response_repo.list_by_session(session.id)
        card_no_by_response = {r.id: r.card_no for r in responses}
        return SessionWithRegionsResponse(
            session=SessionResponse.model_validate(session),
            regions=[
                _to_region_response(g, card_no_by_response.get(g.response_id))
                for g in regions
            ],
        )


class CreateResponseService:
    """반응 추가 — 자유반응 단계의 산물(§4-1).

    이 도메인의 주인을 만드는 곳이다. 영역보다 먼저 존재하며,
    영역이 0개인 채로도 유효하다.
    """

    def __init__(
        self,
        session_repo: RorschachSessionRepository,
        response_repo: RorschachResponseRepository,
        region_repo: RorschachRegionRepository,
        card_repo: RorschachCardAdministrationRepository,
        examination_repo: ExaminationRepository,
    ):
        self.session_repo = session_repo
        self.response_repo = response_repo
        self.region_repo = region_repo
        self.card_repo = card_repo
        self.examination_repo = examination_repo

    async def execute(
        self, examination_id: str, institution_id: str, data: ResponseCreate
    ) -> ResponseDetail:
        examination = await self.examination_repo.get(examination_id)
        examination = _ensure_examination(examination, institution_id)

        # 확정 전에는 언제든 반응을 추가할 수 있다(§3-1 "벽 없음").
        # ai_draft_ready에서 막으면 "채점하다 빠진 반응을 발견해 자유반응으로
        # 돌아간다"가 불가능해진다 — 아날로그에선 그냥 종이를 고친다.
        # 확정 이후에는 막는다: 확정본이 조용히 바뀌면 감사추적이 무의미하다.
        if is_confirmed(examination.status):
            raise InvalidOperationException(
                f"확정된 검사({examination.status})에는 반응을 추가할 수 없습니다."
            )

        session = await self.session_repo.get_by_examination_id(examination_id)
        if not session:
            raise EntityNotFoundException("로르샤하 세션이 시작되지 않았습니다.")

        # 정렬 서열은 서버가 매긴다 — 화면이 계산해 보내면 동시 입력 시 충돌한다.
        #
        # **이건 표시 번호가 아니라 순서를 정하는 값이다**(models.py `sort_seq`).
        # 뒤에 붙이기만 하므로 삭제로 생긴 간을 메우지 않는다. 화면에 보이는
        # 번호는 살아 있는 반응을 세어 파생되므로 늘 1..n이다.
        existing = await self.response_repo.list_by_session(session.id)
        same_card = [r for r in existing if r.card_no == data.card_no]
        sort_seq = max((r.sort_seq or 0 for r in same_card), default=0) + 1

        response = await self.response_repo.create({
            "session_id": session.id,
            "card_no": data.card_no,
            "sort_seq": sort_seq,
            "phase": data.phase,
            "is_formal": data.is_formal,
            "free_association_text": data.free_association_text,
            # STT 초안이면 원문도 같이 굳힌다(§4-2). 이후 임상가가
            # free_association_text를 고쳐도 여기는 기계가 들은 그대로 남아,
            # "무엇을 바꿨나"가 대조된다 — 그게 없으면 검토가 아니라 승인이다.
            "free_association_stt_raw": data.free_association_stt_raw,
            "card_orientation": data.card_orientation,
        })

        # 반응이 하나라도 있으면 그 카드는 실시된 것이다(§5-2).
        # 화면이 따로 안 알려줘도 사실이 어긋나지 않게 여기서 맞춘다.
        admin = await self.card_repo.get_by_card(session.id, data.card_no)
        if admin is None:
            await self.card_repo.create({
                "session_id": session.id,
                "card_no": data.card_no,
                "status": "responded",
            })
        elif admin.status != "responded":
            admin.status = "responded"

        await self.response_repo.flush()
        await self.response_repo.refresh(response)
        # 방금 만든 반응도 화면 번호로 돌려준다 — 프론트가 이 값으로 칩을 그리므로
        # 저장 서열을 그대로 주면 목록을 다시 받기 전까지 번호가 어긋나 보인다.
        display_no = display_numbers([*same_card, response]).get(response.id)
        return _response_to_detail(response, [], display_no)


#: 채점의 **근거**가 되는 반응 필드. 이것들이 바뀌면 이미 저장된 채점은
#: 없어진 자료 위에 서 있게 된다(`RorschachResponse.coding_stale_at`).
#:
#: - free_association_text / inquiry_text: AI·임상가가 읽고 부호를 정한 원문
#: - area_code: 위치 부호 그 자체 (§14-7)
#: - card_orientation: 돌려 본 방향에서 형태질을 봐야 한다 (§5-1)
#:
#: 여기 없는 필드(예: STT 원문)는 채점 근거가 아니라 대조용 기록이다.
_CODING_GROUND_FIELDS = frozenset(
    {"free_association_text", "inquiry_text", "area_code", "card_orientation"}
)


def missing_score_inputs(
    response: RorschachResponse, transcript_override: str | None = None
) -> list[str]:
    """AI 채점 입력 중 **빈 것들의 이름**. 비어 있으면 채점 가능하다.

    셋 다 필요하다. 하나라도 비면 AI는 "모른다"가 아니라 **그럴듯한 값**을
    내놓고, 그 값이 초안 칸에 앉아 임상가의 검토 대상이 된다. 근거 없는 제안을
    검토하게 만드는 것이 검토를 안 받는 것보다 나쁘다.

    - 자유반응: 채점의 원자료. 없으면 볼 것이 없다.
    - 질문 답변: 결정인은 대부분 질문 단계에서 정해진다(Exner). 자유반응만
      보면 형태(F)로 몰린다.
    - 위치 부호: 없으면 `coding.location`이 null로 저장되고 그 반응은 위치
      집계에서 **조용히 빠진다**(§14-7).

    ⚠️ 화면(`constants.canAiScore`)과 **같은 규칙**이다. 서버만 열어두면
    화면이 잠가도 API로 그대로 통과하고, 서버만 잠그면 눌리는 버튼이 실패한다.
    """
    text = transcript_override if transcript_override is not None else response.free_association_text
    missing: list[str] = []
    if not (text or "").strip():
        missing.append("반응 내용")
    if not (response.inquiry_text or "").strip():
        missing.append("질문 답변")
    if not (response.area_code or "").strip():
        missing.append("위치")
    return missing


def _mark_coding_stale(response: RorschachResponse) -> None:
    """채점 근거가 바뀌었음을 표시한다 — **채점값은 지우지 않는다.**

    아직 아무도 채점하지 않은 반응에는 표시하지 않는다. 낡을 채점이 없는데
    표시하면, 화면에서 '미채점'과 '재검토 필요'가 같은 반응에 함께 뜬다.
    """
    if response.final_coding_json is None and response.ai_coding_json is None:
        return
    response.coding_stale_at = datetime.now()


class UpdateResponseService:
    """반응 수정 — 텍스트·회전 교정"""

    def __init__(
        self,
        session_repo: RorschachSessionRepository,
        response_repo: RorschachResponseRepository,
        region_repo: RorschachRegionRepository,
        examination_repo: ExaminationRepository,
    ):
        self.session_repo = session_repo
        self.response_repo = response_repo
        self.region_repo = region_repo
        self.examination_repo = examination_repo

    async def execute(
        self,
        examination_id: str,
        institution_id: str,
        response_id: str,
        data: ResponseUpdate,
    ) -> ResponseDetail:
        examination = await self.examination_repo.get(examination_id)
        _ensure_editable(_ensure_examination(examination, institution_id))

        session = await self.session_repo.get_by_examination_id(examination_id)
        if not session:
            raise EntityNotFoundException("로르샤하 세션이 없습니다.")

        response = await self.response_repo.get(response_id)
        if not response or response.deleted_at is not None:
            raise EntityNotFoundException("반응을 찾을 수 없습니다.")
        if response.session_id != session.id:
            raise PermissionDeniedException("해당 세션의 반응이 아닙니다.")

        # 부호는 저장 전에 검증한다 — `parse_location`이 못 읽는 값은 구조요약
        # 집계에서 조용히 사라진다. 채점이 못 읽을 값을 애초에 받지 않는다.
        if data.area_code and not is_valid_location(data.area_code):
            raise InvalidOperationException(
                f"위치 부호 형식이 올바르지 않습니다: {data.area_code} "
                f"(W / D6 / DS6 / Dd99 형태여야 합니다)"
            )

        changed_grounds = False
        for key, value in data.model_dump(exclude_unset=True).items():
            if value is None:
                continue
            # **값이 실제로 달라졌을 때만** 근거 변경으로 친다. 같은 값을 다시
            # 저장하는 경로(포커스 아웃 저장 등)가 있어서, 무조건 표시하면
            # 아무것도 안 고쳤는데 채점이 낡은 것으로 바뀐다.
            if key in _CODING_GROUND_FIELDS and getattr(response, key) != value:
                changed_grounds = True
            setattr(response, key, value)

        if changed_grounds:
            _mark_coding_stale(response)

        await self.response_repo.flush()
        await self.response_repo.refresh(response)
        regions = await self.region_repo.list_by_response(response.id)
        display_no = await _display_no_of(self.response_repo, response)
        return _response_to_detail(response, [g.id for g in regions], display_no)


class DeleteResponseService:
    """반응 삭제 (soft) — 딸린 조각도 함께 지운다.

    조각만 남기면 주인 없는 영역이 되고, 그게 정확히 관계 역전 전의
    고아 영역 문제다. 반응을 지우면 조각도 같이 지운다.
    """

    def __init__(
        self,
        session_repo: RorschachSessionRepository,
        response_repo: RorschachResponseRepository,
        region_repo: RorschachRegionRepository,
        examination_repo: ExaminationRepository,
    ):
        self.session_repo = session_repo
        self.response_repo = response_repo
        self.region_repo = region_repo
        self.examination_repo = examination_repo

    async def execute(
        self, examination_id: str, institution_id: str, response_id: str
    ) -> bool:
        examination = await self.examination_repo.get(examination_id)
        examination = _ensure_examination(examination, institution_id)

        if is_confirmed(examination.status):
            raise InvalidOperationException(
                "확정된 검사의 반응은 삭제할 수 없습니다."
            )

        session = await self.session_repo.get_by_examination_id(examination_id)
        if not session:
            raise EntityNotFoundException("로르샤하 세션이 없습니다.")

        response = await self.response_repo.get(response_id)
        if not response or response.deleted_at is not None:
            raise EntityNotFoundException("반응을 찾을 수 없습니다.")
        if response.session_id != session.id:
            raise PermissionDeniedException("해당 세션의 반응이 아닙니다.")

        for region in await self.region_repo.list_by_response(response.id):
            await self.region_repo.delete(region.id)

        return await self.response_repo.delete(response_id)


class SetCardStatusService:
    """카드 실시 기록(§5-2) — 거부와 미입력을 구분한다"""

    def __init__(
        self,
        session_repo: RorschachSessionRepository,
        card_repo: RorschachCardAdministrationRepository,
        response_repo: RorschachResponseRepository,
        examination_repo: ExaminationRepository,
    ):
        self.session_repo = session_repo
        self.card_repo = card_repo
        self.response_repo = response_repo
        self.examination_repo = examination_repo

    async def execute(
        self,
        examination_id: str,
        institution_id: str,
        card_no: int,
        data: CardStatusUpdate,
    ) -> CardAdministrationResponse:
        examination = await self.examination_repo.get(examination_id)
        _ensure_editable(_ensure_examination(examination, institution_id))

        session = await self.session_repo.get_by_examination_id(examination_id)
        if not session:
            raise EntityNotFoundException("로르샤하 세션이 없습니다.")

        # 반응이 있는 카드를 거부로 표시하면 사실이 어긋난다.
        if data.status == "rejected":
            responses = await self.response_repo.list_by_session(session.id)
            if any(r.card_no == card_no for r in responses):
                raise InvalidOperationException(
                    f"카드 {card_no}에 기록된 반응이 있어 거부로 표시할 수 없습니다."
                )

        admin = await self.card_repo.get_by_card(session.id, card_no)
        if admin is None:
            admin = await self.card_repo.create({
                "session_id": session.id,
                "card_no": card_no,
                "status": data.status,
                "presented_at": data.presented_at,
            })
        else:
            admin.status = data.status
            if data.presented_at is not None:
                admin.presented_at = data.presented_at

        await self.card_repo.flush()
        await self.card_repo.refresh(admin)
        return CardAdministrationResponse.model_validate(admin)


class CreateInterventionService:
    """검사자 개입 기록(§4-1) — 촉구·한계검증 등"""

    def __init__(
        self,
        session_repo: RorschachSessionRepository,
        intervention_repo: RorschachInterventionRepository,
        examination_repo: ExaminationRepository,
    ):
        self.session_repo = session_repo
        self.intervention_repo = intervention_repo
        self.examination_repo = examination_repo

    async def execute(
        self, examination_id: str, institution_id: str, data: InterventionCreate
    ) -> InterventionResponse:
        examination = await self.examination_repo.get(examination_id)
        _ensure_editable(_ensure_examination(examination, institution_id))

        session = await self.session_repo.get_by_examination_id(examination_id)
        if not session:
            raise EntityNotFoundException("로르샤하 세션이 없습니다.")

        iv = await self.intervention_repo.create({
            "session_id": session.id,
            "card_no": data.card_no,
            "response_id": data.response_id,
            "phase": data.phase,
            "kind": data.kind,
            "text": data.text,
        })
        await self.intervention_repo.flush()
        await self.intervention_repo.refresh(iv)
        return InterventionResponse.model_validate(iv)


class DeleteInterventionService:
    """개입 기록 취소 (soft) — 실시 중 오조작을 되돌린다.

    촉구 버튼은 거부와 마찬가지로 **토글**이다. 실시 중에는 피검자를 보며
    누르므로 오조작이 흔하고, 되돌릴 수 없으면 틀린 기록이 그대로 굳는다.

    soft delete인 이유는 감사추적이다 — 행은 남고 `deleted_at`이 찍힌다.
    "촉구를 기록했다가 취소했다"는 사실 자체가 이력에 남아야 한다.
    """

    def __init__(
        self,
        session_repo: RorschachSessionRepository,
        intervention_repo: RorschachInterventionRepository,
        examination_repo: ExaminationRepository,
    ):
        self.session_repo = session_repo
        self.intervention_repo = intervention_repo
        self.examination_repo = examination_repo

    async def execute(
        self, examination_id: str, institution_id: str, intervention_id: str
    ) -> bool:
        examination = await self.examination_repo.get(examination_id)
        _ensure_editable(_ensure_examination(examination, institution_id))

        session = await self.session_repo.get_by_examination_id(examination_id)
        if not session:
            raise EntityNotFoundException("로르샤하 세션이 없습니다.")

        iv = await self.intervention_repo.get(intervention_id)
        if not iv or iv.deleted_at is not None:
            raise EntityNotFoundException("개입 기록을 찾을 수 없습니다.")
        if iv.session_id != session.id:
            raise PermissionDeniedException("해당 세션의 개입 기록이 아닙니다.")

        return await self.intervention_repo.delete(intervention_id)


class CreateRegionService:
    """영역 추가 — 반드시 반응에 붙는다(§4-5)"""
    def __init__(
        self,
        session_repo: RorschachSessionRepository,
        region_repo: RorschachRegionRepository,
        response_repo: RorschachResponseRepository,
        examination_repo: ExaminationRepository,
    ):
        self.session_repo = session_repo
        self.region_repo = region_repo
        self.response_repo = response_repo
        self.examination_repo = examination_repo

    async def execute(
        self,
        examination_id: str,
        institution_id: str,
        data: RegionCreate,
    ) -> RegionResponse:
        examination = await self.examination_repo.get(examination_id)
        _ensure_editable(_ensure_examination(examination, institution_id))

        session = await self.session_repo.get_by_examination_id(examination_id)
        if not session:
            raise EntityNotFoundException("로르샤하 세션이 시작되지 않았습니다.")

        # 조각은 반드시 반응에 붙는다(§4-5). 카드번호는 반응에서 파생된다.
        response = await self.response_repo.get(data.response_id)
        if not response or response.deleted_at is not None:
            raise EntityNotFoundException("반응을 찾을 수 없습니다.")
        if response.session_id != session.id:
            raise PermissionDeniedException("해당 세션의 반응이 아닙니다.")

        # **위치는 반응당 하나다**(§14-7). 다시 그리면 기존 것을 대체한다 —
        # 거부하지 않는 이유는 "고쳐 그리기"가 정상 동작이기 때문이다.
        # 조각이 쌓이면 어느 것이 이 반응의 위치인지 알 수 없게 된다.
        for old in await self.region_repo.list_by_response(response.id):
            await self.region_repo.delete(old.id)

        region = await self.region_repo.create({
            "session_id": session.id,
            "response_id": response.id,
            "path_json": [p.model_dump() for p in data.path],
            "memo": data.memo,
            "audio_timestamp_start_sec": data.audio_timestamp_start_sec,
            "audio_timestamp_end_sec": data.audio_timestamp_end_sec,
        })
        return _to_region_response(region, response.card_no)


class UpdateRegionService:
    """영역 수정 (메모/path)"""
    def __init__(
        self,
        session_repo: RorschachSessionRepository,
        region_repo: RorschachRegionRepository,
        response_repo: RorschachResponseRepository,
        examination_repo: ExaminationRepository,
    ):
        self.session_repo = session_repo
        self.region_repo = region_repo
        self.response_repo = response_repo
        self.examination_repo = examination_repo

    async def execute(
        self,
        examination_id: str,
        institution_id: str,
        region_id: str,
        data: RegionUpdate,
    ) -> RegionResponse:
        examination = await self.examination_repo.get(examination_id)
        _ensure_editable(_ensure_examination(examination, institution_id))

        session = await self.session_repo.get_by_examination_id(examination_id)
        if not session:
            raise EntityNotFoundException("로르샤하 세션이 없습니다.")

        region = await self.region_repo.get(region_id)
        if not region or region.deleted_at is not None:
            raise EntityNotFoundException("영역을 찾을 수 없습니다.")
        if region.session_id != session.id:
            raise PermissionDeniedException("해당 세션의 영역이 아닙니다.")

        update_data = data.model_dump(exclude_unset=True)
        if "path" in update_data and update_data["path"] is not None:
            update_data["path_json"] = [p for p in update_data.pop("path")]
        elif "path" in update_data:
            update_data.pop("path")

        for key, value in update_data.items():
            setattr(region, key, value)

        await self.region_repo.flush()
        await self.region_repo.refresh(region)
        owner = await self.response_repo.get(region.response_id) if region.response_id else None
        return _to_region_response(region, owner.card_no if owner else None)


class DeleteRegionService:
    """영역 삭제 (soft)"""
    def __init__(
        self,
        session_repo: RorschachSessionRepository,
        region_repo: RorschachRegionRepository,
        examination_repo: ExaminationRepository,
    ):
        self.session_repo = session_repo
        self.region_repo = region_repo
        self.examination_repo = examination_repo

    async def execute(
        self,
        examination_id: str,
        institution_id: str,
        region_id: str,
    ) -> bool:
        examination = await self.examination_repo.get(examination_id)
        _ensure_editable(_ensure_examination(examination, institution_id))

        session = await self.session_repo.get_by_examination_id(examination_id)
        if not session:
            raise EntityNotFoundException("로르샤하 세션이 없습니다.")

        region = await self.region_repo.get(region_id)
        if not region or region.deleted_at is not None:
            raise EntityNotFoundException("영역을 찾을 수 없습니다.")
        if region.session_id != session.id:
            raise PermissionDeniedException("해당 세션의 영역이 아닙니다.")

        return await self.region_repo.delete(region_id)


class CompleteSessionService:
    """실시 완료 — 카드 10장과 반응이 다 채워졌는지 **검사한 뒤** ended_at을 찍는다.

    예전에는 아무것도 검사하지 않고 `ended_at`만 기록했다. 그때는 화면이
    게이트 역할을 했지만(자유반응 화면이 "10장 전부 실시"를 막았다), 자유반응과
    질문 화면이 합쳐지면서 그 중간 게이트가 사라졌다(§14-1). 규칙이 서버에
    있어야 프론트/API 어느 쪽으로 들어와도 같은 답이 나온다.

    판정은 `completion.administration_done` 한 곳이 한다 — progress.py와
    같은 함수를 써야 "완료 처리는 됐는데 진행 표시는 미완"이 안 생긴다.
    """
    def __init__(
        self,
        session_repo: RorschachSessionRepository,
        examination_repo: ExaminationRepository,
        response_repo: RorschachResponseRepository,
        card_repo: RorschachCardAdministrationRepository,
        region_repo: RorschachRegionRepository,
    ):
        self.session_repo = session_repo
        self.examination_repo = examination_repo
        self.response_repo = response_repo
        self.card_repo = card_repo
        self.region_repo = region_repo

    async def execute(
        self,
        examination_id: str,
        institution_id: str,
        audio_duration_sec: float | None,
    ) -> SessionResponse:
        examination = await self.examination_repo.get(examination_id)
        _ensure_examination(examination, institution_id)

        session = await self.session_repo.get_by_examination_id(examination_id)
        if not session:
            raise EntityNotFoundException("로르샤하 세션이 없습니다.")

        responses = await self.response_repo.list_by_session(session.id)
        cards = await self.card_repo.list_by_session(session.id)
        await _attach_region_ids(self.region_repo, responses)

        unfinished = unfinished_cards(cards, responses)
        if unfinished:
            # 미입력(pending)을 통과시키면 "안 물어본 카드"와 "물었지만 반응이
            # 없던 카드"가 같아진다. 그 둘은 R 판정에서 다르게 취급돼야 한다.
            raise InvalidOperationException(
                f"아직 실시가 끝나지 않은 카드가 있습니다: "
                f"{', '.join(card_label(no) for no in unfinished)}. "
                f"각 카드를 실시하거나 거부로 기록하고, 반응마다 영역과 "
                f"질문 답변을 채워주세요."
            )

        session.ended_at = datetime.utcnow()
        if audio_duration_sec is not None:
            session.audio_duration_sec = audio_duration_sec

        await self.session_repo.flush()
        await self.session_repo.refresh(session)
        return SessionResponse.model_validate(session)


class UploadAudioService:
    """검사 종료 후 오디오 업로드 — storage 저장만 담당.

    전사는 채점 화면 진입 시 EnsureTranscriptService 가 lazy 트리거.
    """

    def __init__(
        self,
        session_repo: RorschachSessionRepository,
        examination_repo: ExaminationRepository,
        storage,  # StorageBackend protocol
    ):
        self.session_repo = session_repo
        self.examination_repo = examination_repo
        self.storage = storage

    async def execute(
        self,
        examination_id: str,
        institution_id: str,
        audio_bytes: bytes,
        filename: str,
        content_type: str,
    ) -> SessionResponse:
        examination = await self.examination_repo.get(examination_id)
        _ensure_examination(examination, institution_id)

        session = await self.session_repo.get_by_examination_id(examination_id)
        if not session:
            raise EntityNotFoundException("로르샤하 세션이 없습니다.")

        ext = _ext_from_content_type(content_type, filename)
        storage_path = f"rorschach/{session.id}{ext}"
        await self.storage.upload(storage_path, audio_bytes, content_type)
        session.audio_url = storage_path

        await self.session_repo.flush()
        await self.session_repo.refresh(session)
        return SessionResponse.model_validate(session)


def _ext_from_content_type(content_type: str, filename: str) -> str:
    """content_type 또는 filename으로부터 확장자 추정."""
    ct = (content_type or "").lower()
    if "webm" in ct:
        return ".webm"
    if "mp4" in ct or "m4a" in ct:
        return ".m4a"
    if "wav" in ct:
        return ".wav"
    if "mpeg" in ct or "mp3" in ct:
        return ".mp3"
    # filename fallback
    if "." in filename:
        return "." + filename.rsplit(".", 1)[-1].lower()
    return ".webm"


# 한국어 whisper가 무음/잡음 구간에 넣는 것으로 알려진 정형구.
# 로르샤하는 반응잠재시간이 임상 지표라 침묵이 길어 정확히 그 발동 조건이다.
_HALLUCINATION_PATTERNS = (
    "시청해주셔서 감사합니다",
    "시청해 주셔서 감사합니다",
    "구독과 좋아요",
    "감사합니다 다음 영상에서",
    "이 영상은",
    "MBC 뉴스",
    "KBS 뉴스",
)

# 이보다 짧은 클립은 전사하지 않는다 — 잡음 한 번에 문장이 생겨난다.
_MIN_CLIP_SEC = 0.4


def _looks_hallucinated(text: str) -> bool:
    """환각으로 의심되는 전사인가.

    걸러낸 것은 빈 텍스트로 돌려보낸다 — 화면이 "음성 감지됨(인식 실패)"로
    표시하고 임상가가 직접 적는다. 틀린 문장을 넣는 것보다 빈 칸이 낫다.
    """
    stripped = text.strip()
    if not stripped:
        return True
    for pattern in _HALLUCINATION_PATTERNS:
        if pattern in stripped:
            return True
    return False


class TranscribeClipService:
    """발화 한 조각을 전사한다 — 반응 단위 즉시 배치(§3-3).

    세션 전체를 통짜로 돌리는 EnsureTranscriptService와 다르다. 화면이
    발화를 감지해 그 구간만 보내면 2~5초 뒤 텍스트를 돌려준다.

    **결과는 초안이다.** 임상가가 보고 고친 뒤 확정한다(CDSS). 서버는
    저장하지 않는다 — 무엇을 반응으로 삼을지는 화면이 정한다.

    스트리밍을 쓰지 않는 이유: whisper 인코더는 입력이 3초든 30초든 항상
    30초 mel을 처리하므로, 1초마다 갱신하면 같은 하드웨어에서 배치 대비
    15배 느리고 지연이 누적된다.
    """

    def __init__(
        self,
        session_repo: RorschachSessionRepository,
        examination_repo: ExaminationRepository,
        transcription,  # OpenAITranscription
    ):
        self.session_repo = session_repo
        self.examination_repo = examination_repo
        self.transcription = transcription

    async def execute(
        self,
        examination_id: str,
        institution_id: str,
        audio_bytes: bytes,
        filename: str,
        duration_sec: float | None = None,
    ) -> TranscriptClipResponse:
        examination = await self.examination_repo.get(examination_id)
        examination = _ensure_examination(examination, institution_id)
        _ensure_editable(examination)

        session = await self.session_repo.get_by_examination_id(examination_id)
        if not session:
            raise EntityNotFoundException("로르샤하 세션이 없습니다.")

        if not audio_bytes:
            raise InvalidOperationException("오디오가 비어 있습니다.")

        if duration_sec is not None and duration_sec < _MIN_CLIP_SEC:
            # 너무 짧은 소리는 전사하지 않는다 — 잡음에서 문장이 생겨난다.
            return TranscriptClipResponse(text="", detected=False)

        result = await self.transcription.whisper(
            audio=audio_bytes,
            filename=filename,
            language="ko",
        )

        if _looks_hallucinated(result.text):
            logger.info(
                "클립 전사 환각 의심 — 버림 (exam=%s, len=%d)",
                examination_id,
                len(result.text or ""),
            )
            return TranscriptClipResponse(text="", detected=True)

        return TranscriptClipResponse(text=result.text.strip(), detected=True)


class EnsureTranscriptService:
    """로샤 도메인 전용 transcript 보장 서비스.

    동작:
    - transcript_json 이미 있으면 그대로 반환 (캐시)
    - 없으면 storage에서 audio 다운로드 → transcription.DiarizeService 호출
      → speaker 정규화 (옵션 A: 첫 발화자=examiner) → transcript_json 저장 → 반환

    채점 화면이 메인 데이터(GetSessionDetail)와 별개로 lazy 호출.
    첫 회만 느리고(수십 초~분), 이후엔 즉시 반환.
    """

    def __init__(
        self,
        session_repo: RorschachSessionRepository,
        examination_repo: ExaminationRepository,
        diarize_service,  # transcription.services.DiarizeService
        storage,  # StorageBackend
    ):
        self.session_repo = session_repo
        self.examination_repo = examination_repo
        self.diarize_service = diarize_service
        self.storage = storage

    async def execute(
        self, examination_id: str, institution_id: str
    ) -> TranscriptResponse:
        examination = await self.examination_repo.get(examination_id)
        _ensure_examination(examination, institution_id)

        session = await self.session_repo.get_by_examination_id(examination_id)
        if not session:
            raise EntityNotFoundException("로르샤하 세션이 없습니다.")

        # 이미 있으면 캐시된 segments 반환
        if session.transcript_json and isinstance(session.transcript_json, dict):
            raw = session.transcript_json.get("segments", [])
            return TranscriptResponse(
                segments=[TranscriptSegment(**s) for s in raw]
            )

        # 오디오 없으면 빈 transcript
        if not session.audio_url:
            return TranscriptResponse(segments=[])

        # 전사 실행 — DiarizeService(OpenAI) 호출.
        # 키 미설정/전사 실패 시 500으로 흐름을 막지 않고 빈 transcript로 폴백.
        # (실패 결과는 캐시하지 않으므로, 키 설정 후 재진입 시 정상 전사됨)
        try:
            audio_bytes, _ = await self.storage.download(session.audio_url)
            filename = session.audio_url.rsplit("/", 1)[-1]
            diarization = await self.diarize_service.execute(
                audio_bytes, filename=filename, language="ko",
            )
        except Exception as e:  # noqa: BLE001 — 전사 실패는 결과 조회를 막지 않음
            logger.warning(
                "전사 실패 — 빈 transcript로 폴백 (exam=%s): %s",
                examination_id, e,
            )
            return TranscriptResponse(segments=[])

        raw_segments = [
            {"speaker": s.speaker, "start": s.start, "end": s.end, "text": s.text}
            for s in diarization.segments
        ]
        normalized = _normalize_speakers(raw_segments)
        session.transcript_json = {"segments": normalized}
        if diarization.duration_sec is not None:
            session.audio_duration_sec = diarization.duration_sec
        await self.session_repo.flush()
        await self.session_repo.refresh(session)

        return TranscriptResponse(
            segments=[TranscriptSegment(**s) for s in normalized]
        )


class GetAudioUrlService:
    """오디오 재생용 URL 발급 — S3 presigned URL.

    프론트 audio 태그가 직접 가져가 재생 (Range 요청 등은 S3가 알아서 처리).
    URL 만료 시간은 1시간 — 채점 세션 보통 그 안에 끝남.

    TODO(local backend): 현재 S3 전용. local 디스크 백엔드면 별도 정적 서빙 또는
    백엔드 프록시 스트리밍 엔드포인트 추가 필요.
    """

    def __init__(
        self,
        session_repo: RorschachSessionRepository,
        examination_repo: ExaminationRepository,
        storage,  # StorageBackend
    ):
        self.session_repo = session_repo
        self.examination_repo = examination_repo
        self.storage = storage

    async def execute(
        self, examination_id: str, institution_id: str, expires_in: int = 3600
    ) -> str:
        examination = await self.examination_repo.get(examination_id)
        _ensure_examination(examination, institution_id)

        session = await self.session_repo.get_by_examination_id(examination_id)
        if not session:
            raise EntityNotFoundException("로르샤하 세션이 없습니다.")
        if not session.audio_url:
            raise EntityNotFoundException("녹음된 오디오가 없습니다.")

        # S3Storage 의 내부 client (S3StorageClient) 에 get_presigned_url 있음
        client = getattr(self.storage, "_client", None)
        if client is None or not hasattr(client, "get_presigned_url"):
            raise InvalidOperationException(
                "현재 storage 백엔드는 URL 발급을 지원하지 않습니다 (S3 만 지원)."
            )
        return await client.get_presigned_url(session.audio_url, expires_in=expires_in)


# === Phase 3: 채점 ===


async def _display_no_of(response_repo, response: RorschachResponse) -> int | None:
    """이 반응 하나의 화면 번호 — 같은 세션의 형제를 읽어 센다.

    단건을 돌려주는 자리(수정·채점 저장)가 쓴다. 쿼리 하나가 더 들지만,
    저장 서열을 그대로 돌려주면 목록을 다시 받기 전까지 화면 번호가 어긋난다.
    """
    siblings = await response_repo.list_by_session(response.session_id)
    return display_numbers(siblings).get(response.id)


async def _session_display_numbers(response_repo, session_id: str) -> dict[str, int]:
    """세션 전체를 세어 만든 표시 번호 — **정식 반응만 순회하는 자리가 쓴다.**

    `display_numbers()`의 계약은 "한계검증도 함께 센다"이다. 화면
    (`_build_detail_response`)이 `list_by_session`으로 그렇게 센다.
    그런데 채점·확정 쪽은 `list_formal_by_session`으로 순회한다(§7 — R은 정식
    반응의 수다). **그 목록을 그대로 `display_numbers()`에 넘기면 모집단이 달라져
    화면에 없는 번호가 나온다.**

    한계검증이 늘 카드의 마지막이면 티가 안 나지만, `is_formal`은
    `ResponseUpdate`로 **나중에 뒤집을 수 있다** — 카드 중간의 반응을 한계검증으로
    돌리는 순간 그 뒤 번호가 두 모집단에서 갈린다. 그때 "확정할 수 없습니다
    (카드 III 반응 3)"가 화면에 없는 반응을 가리킨다.

    순회는 정식 반응으로 하되 **번호만 여기서 받는다.** 쿼리 하나가 더 든다.
    """
    return display_numbers(await response_repo.list_by_session(session_id))


def _response_to_detail(
    r: RorschachResponse,
    region_ids: list[str] | None = None,
    display_no: int | None = None,
) -> ResponseDetail:
    """반응 → 응답 DTO.

    region_ids는 호출부가 일괄 조회해서 넘긴다 — 여기서 조회하면 N+1이 된다.

    ⚠️ **`display_no`는 `display_numbers()`가 준 값이다.** DTO의 `response_no`는
    화면에 보이는 번호이지 저장된 `sort_seq`가 아니다 — 삭제로 간이 벌어져도
    화면은 늘 1..n이어야 한다. 안 넘기면 `sort_seq`로 떨어지는데, 그건 한 반응만
    따로 만들어 돌려주는 자리(생성 직후 응답)에서만 허용된다. 목록을 만들 때
    빠뜨리면 화면 번호가 저장값으로 되돌아가므로 반드시 넘길 것.
    """
    return ResponseDetail(
        id=r.id,
        session_id=r.session_id,
        card_no=r.card_no,
        region_ids=region_ids or [],
        phase=r.phase,
        is_formal=r.is_formal,
        response_no=display_no if display_no is not None else r.sort_seq,
        card_orientation=r.card_orientation,
        area_code=r.area_code,
        free_association_text=r.free_association_text,
        free_association_stt_raw=r.free_association_stt_raw,
        inquiry_stt_raw=r.inquiry_stt_raw,
        inquiry_text=r.inquiry_text,
        ai_coding=RorschachCoding(**r.ai_coding_json) if r.ai_coding_json else None,
        final_coding=RorschachCoding(**r.final_coding_json) if r.final_coding_json else None,
        # 시각 자체는 화면이 쓰지 않는다 — 낡았는가만 내보낸다
        coding_stale=r.coding_stale_at is not None,
        ai_confidence=r.ai_confidence,
        ai_reasoning=r.ai_reasoning,
        confirmed_at=r.confirmed_at,
        confirmed_by=r.confirmed_by,
    )


def _keep_known(group: str, codes, response_id: str | None = None) -> list[str]:
    """AI가 준 부호 중 **이 시스템이 아는 것만** 남긴다.

    임상가 저장 경로에는 검증이 있는데(`CodingUpdateRequest._known_codes_only`)
    AI 초안 경로에는 없었다. 그 구멍으로 옛 목업이 만든 `INC1`(INCOM1 오타)·
    `M`/`FM`/`ma`(능동·수동 접미사 누락)가 들어와 그대로 굳었다.

    **채점은 부호를 이름으로 읽으므로 철자가 다르면 조용히 0이 된다.** `INC1`은
    Sum6에서 빠지고, `M`은 SumM·EB·Ma:Mp·GHR/PHR에서 통째로 빠진다. 에러 없이
    지표만 틀린다 — 영역 부호 43건이 집계에서 사라졌던 것과 같은 종류다.

    거르되 **조용히 버리지 않는다.** 로그에 무엇을 버렸는지 남긴다. AI가 계약을
    어기고 있다는 사실 자체가 신호이고, 그게 안 보이면 다음에도 같은 일이 난다.

    ⚠️ 추측해서 고치지 않는다. `INC1 → INCOM1`은 맞혀볼 수 있지만 `M`은
    `Ma`/`Mp`/`Ma-p` 중 무엇인지 알 수 없다 — 능동·수동은 임상 판단이고,
    잘못 찍으면 틀린 값이 **맞는 것처럼** 저장된다. 모르는 건 버린다.
    """
    unknown = unknown_codes(group, list(codes) if codes else [])
    if unknown:
        logger.warning(
            "AI 채점 결과에 계약에 없는 부호가 있어 제외했습니다 "
            "(reponse=%s, group=%s, codes=%s). AI 서비스가 coding_codes.py의 "
            "어휘를 따르는지 확인이 필요합니다.",
            response_id or "-", group, unknown,
        )
    known = set(unknown)
    return [c for c in (codes or []) if c not in known]


def _keep_known_scalar(group: str, code: str | None, response_id: str | None = None) -> str | None:
    """칸 하나짜리 부호(dq·fq·zScore)의 `_keep_known`. 모르면 비운다.

    빈 칸은 임상가가 "AI가 이건 못 정했다"로 읽고 직접 고른다. 모르는 부호를
    그대로 두면 화면엔 값이 차 있는데 채점에선 빠진다 — **틀린 값보다
    나쁜, 맞아 보이는 값**이다.
    """
    if is_known_code(group, code):
        return code
    logger.warning(
        "AI 채점 결과에 계약에 없는 부호가 있어 비웠습니다 "
        "(response=%s, group=%s, code=%r). AI 서비스가 coding_codes.py의 "
        "어휘를 따르는지 확인이 필요합니다.",
        response_id or "-", group, code,
    )
    return None


def _scoring_to_coding_dict(
    scoring, area_code: str | None = None, response_id: str | None = None
) -> dict:
    """AI 인프라 RorschachScoringResult → 코딩 dict (jsonb 저장용).

    CDSS 원칙: location은 임상가가 직접 고른 값(`Response.area_code`)을 AI가
    바꾸지 않는다. 있으면 그걸 우선, 없으면 AI 추론값으로 채운다.
    나머지 필드(dq/determinants/fq/contents/...)만 AI가 추론.

    부호는 계약 어휘로 거른다 — 임상가 저장 경로(`CodingUpdateRequest`)와 같은
    기준이다. **목록(`_keep_known`)만이 아니라 dq·fq·zScore까지 본다**: 예전엔
    이 셋이 무검증으로 통과해, AI가 준 값이 화면엔 차 있는데 채점에선 빠졌다
    (2026-08-26). 주석은 "같은 기준"이라 말하면서 실제로는 셋만 걸렀다.
    """
    return {
        "location": area_code or scoring.location,
        "dq": _keep_known_scalar("dq", scoring.dev_quality, response_id),
        "determinants": _keep_known("determinants", scoring.determinants, response_id),
        "fq": _keep_known_scalar("fq", scoring.form_quality, response_id),
        # 예전에는 `False`로 굳혔다 — AI가 무엇을 봤든 초안의 (2)는 항상
        # "쌍 아님"이었고, 자아중심성 지표는 반사(Fr+rF)만으로 계산됐다.
        "pair": bool(scoring.pair),
        "contents": _keep_known("contents", scoring.content, response_id),
        "popular": bool(scoring.popular),
        # AI는 Z를 라벨(ZW/ZA/...)로 준다. 숫자를 문자열로 만든 값은
        # Z_TABLE 조회에서 빠지므로 계약 어휘가 아니면 비운다.
        "z_score": _keep_known_scalar(
            "zScore",
            str(scoring.z_score) if scoring.z_score is not None else None,
            response_id,
        ),
        "special_scores": _keep_known(
            "specialScores", scoring.special_scores, response_id
        ),
    }


def _normalize_speakers(segments: list[dict]) -> list[dict]:
    """AI가 준 익명 화자 라벨 → 'examiner' / 'examinee' 정규화.

    옵션 A: 첫 번째로 나타난 화자 = examiner, 나머지 = examinee.
    임상 흐름상 검사자가 카드를 제시하며 먼저 발화한다는 가정.

    AI 원본 라벨은 'raw_speaker' 필드에 보존 (감사추적 / 추후 swap UX 용).
    """
    if not segments:
        return []

    # start 시각 순으로 처리 (원래 정렬돼있겠지만 방어적으로)
    ordered = sorted(segments, key=lambda s: float(s.get("start", 0)))

    first_label: str | None = None
    out: list[dict] = []
    for s in ordered:
        raw = str(s.get("speaker", "")).strip()
        if first_label is None and raw:
            first_label = raw
        normalized = "examiner" if raw == first_label else "examinee"
        out.append({
            "start": float(s.get("start", 0)),
            "end": float(s.get("end", 0)),
            "speaker": normalized,
            "raw_speaker": raw,
            "text": str(s.get("text", "")),
            "card_no": None,  # 한 트랙 통짜 — 카드 정보 없음
        })
    return out


def _extract_examinee_text(
    transcript_json: dict | None,
    regions: list[RorschachRegion],
) -> str:
    """transcript_json에서 반응의 시간 구간과 겹치는 examinee 발화들을 합쳐 반환.

    관계 역전 후 채점 단위는 반응이므로 **반응에 딸린 조각 전체의 시간 범위**를
    쓴다. 조각 하나만 보면 같은 반응의 다른 조각 시간대 발화가 누락된다.
    조각이 없거나 시간이 없으면 빈 문자열 — 호출부가 교정 텍스트로 폴백한다.

    AI 채점 입력으로 사용. 임상가가 교정한 텍스트가 우선이며, 미제공 시 폴백.
    """
    if not transcript_json or not isinstance(transcript_json, dict):
        return ""
    segments = transcript_json.get("segments", [])
    starts = [g.audio_timestamp_start_sec for g in regions if g.audio_timestamp_start_sec is not None]
    ends = [g.audio_timestamp_end_sec for g in regions if g.audio_timestamp_end_sec is not None]
    if not starts or not ends:
        return ""
    start = min(starts)
    end = max(ends)
    parts: list[str] = []
    for s in segments:
        if s.get("speaker") != "examinee":
            continue
        s_start = float(s.get("start", 0))
        s_end = float(s.get("end", 0))
        # 시간 구간 겹침
        if start <= s_end and s_start <= end:
            text = s.get("text", "").strip()
            if text:
                parts.append(text)
    return " ".join(parts)


class ScoreResponseService:
    """단일 **반응**에 대해 AI 채점 (§7 관계 역전).

    예전엔 영역을 채점했다. 채점 단위는 반응이고, 영역은 반응에 딸린
    위치 표시일 뿐이다 — 조각이 여러 개여도 채점은 한 번이다(§4-4).

    동작:
    - 검사 상태가 in_progress/ai_draft_ready/under_review여야 함
    - 반응의 ai_coding 갱신 (반응은 자유반응 단계에서 이미 존재한다)
    - 첫 채점이면 in_progress → ai_draft_ready 전이
      (분석 중이라는 사실은 status가 아니라 ai_analysis_jobs가 남긴다)
    """

    def __init__(
        self,
        session_repo: RorschachSessionRepository,
        region_repo: RorschachRegionRepository,
        response_repo: RorschachResponseRepository,
        examination_repo: ExaminationRepository,
        ai_service: AIService,
    ):
        self.session_repo = session_repo
        self.region_repo = region_repo
        self.response_repo = response_repo
        self.examination_repo = examination_repo
        self.ai_service = ai_service

    async def execute(
        self,
        examination_id: str,
        institution_id: str,
        response_id: str,
        transcript_text: str | None = None,
    ) -> ResponseDetail:
        examination = await self.examination_repo.get(examination_id)
        examination = _ensure_examination(examination, institution_id)

        if examination.status not in ("in_progress", "ai_draft_ready", "under_review"):
            raise InvalidOperationException(
                f"현재 상태({examination.status})에서는 AI 채점을 실행할 수 없습니다."
            )

        session = await self.session_repo.get_by_examination_id(examination_id)
        if not session:
            raise EntityNotFoundException("로르샤하 세션이 없습니다.")

        response_obj = await self.response_repo.get(response_id)
        if not response_obj or response_obj.deleted_at is not None:
            raise EntityNotFoundException("반응을 찾을 수 없습니다.")
        if response_obj.session_id != session.id:
            raise PermissionDeniedException("해당 세션의 반응이 아닙니다.")

        # 분석 중이라는 사실은 status가 아니라 job이 남긴다(반응 단위).

        # 조각은 시간 구간의 출처다. 위치 부호는 반응이 갖는다(§14-7).
        regions = await self.region_repo.list_by_response(response_obj.id)
        area_code = response_obj.area_code

        # 채점 입력 텍스트:
        #   1순위: 클라이언트가 보낸 transcript_text (임상가가 교정한 값)
        #   2순위: 반응이 이미 보유한 확정 텍스트
        #   3순위: transcript_json에서 반응 시간대의 examinee 발화 추출
        ai_transcript = (
            transcript_text.strip() if transcript_text and transcript_text.strip()
            else (response_obj.free_association_text or "").strip()
            or _extract_examinee_text(session.transcript_json, regions)
        )

        # 입력이 덜 찼으면 채점하지 않는다 — **이름을 대고 거부한다**(§14-12).
        # 화면도 같은 규칙으로 버튼을 잠그지만(constants.canAiScore), 여기가
        # 마지막 관문이다. 화면만 잠그면 API 직접 호출로 그대로 통과한다.
        missing = missing_score_inputs(response_obj, ai_transcript)
        if missing:
            raise InvalidOperationException(
                f"{' · '.join(missing)}이(가) 없어 AI 채점을 할 수 없습니다."
            )

        scoring = await self.ai_service.score_rorschach(
            card_no=response_obj.card_no,
            # AI가 보는 것도 "카드 안 몇 번째 반응인가"이므로 화면 번호와 같아야 한다.
            response_no=await _display_no_of(self.response_repo, response_obj) or 1,
            transcript=ai_transcript,
            location_marking={"area_code": area_code} if area_code else None,
            inquiry_transcript=response_obj.inquiry_text,
        )
        coding_dict = _scoring_to_coding_dict(scoring, area_code, response_obj.id)

        response_obj.ai_coding_json = coding_dict
        response_obj.ai_confidence = scoring.confidence
        response_obj.ai_reasoning = scoring.reasoning
        # 채점 입력으로 쓴 텍스트를 보존 (감사추적 + 후속 검토용).
        # 임상가 확정본이 이미 있으면 덮지 않는다 — STT 원문은 별도 컬럼이다(§4-2).
        if ai_transcript and not response_obj.free_association_text:
            response_obj.free_association_text = ai_transcript

        await self.response_repo.flush()

        # 초안이 생겼으니 검토 대기로. 이미 그 이후면 그대로 둔다.
        if examination.status == "in_progress":
            validate_transition(examination.status, "ai_draft_ready")
            examination.status = "ai_draft_ready"
            await self.examination_repo.flush()

        await self.response_repo.refresh(response_obj)
        display_no = await _display_no_of(self.response_repo, response_obj)
        return _response_to_detail(response_obj, [g.id for g in regions], display_no)


class ScoreSessionService:
    """모든 **정식 반응**에 대해 AI 채점 실행 (§7 관계 역전).

    동작:
    - 상태가 in_progress/ai_draft_ready/under_review여야 함 (재채점 포함)
    - 반응마다 ai_coding 갱신. 영역이 0개인 반응도 채점 대상이다 —
      건너뛰면 R이 틀어진다.
    - 한계검증(is_formal=False)은 제외 — R 집계 대상이 아니다(§4-1)
    - 검사 상태: in_progress → ai_draft_ready
    """

    def __init__(
        self,
        session_repo: RorschachSessionRepository,
        region_repo: RorschachRegionRepository,
        response_repo: RorschachResponseRepository,
        examination_repo: ExaminationRepository,
        ai_service: AIService,
    ):
        self.session_repo = session_repo
        self.region_repo = region_repo
        self.response_repo = response_repo
        self.examination_repo = examination_repo
        self.ai_service = ai_service

    async def execute(self, examination_id: str, institution_id: str) -> SessionDetailResponse:
        examination = await self.examination_repo.get(examination_id)
        examination = _ensure_examination(examination, institution_id)

        session = await self.session_repo.get_by_examination_id(examination_id)
        if not session:
            raise EntityNotFoundException("로르샤하 세션이 없습니다.")

        responses = await self.response_repo.list_formal_by_session(session.id)
        if not responses:
            raise InvalidOperationException("채점할 반응이 없습니다. 반응을 먼저 기록해주세요.")

        # 분석 중이라는 사실은 job이 남긴다. 여기서는 채점 가능한 상태인지만 본다.
        if examination.status not in ("in_progress", "ai_draft_ready", "under_review"):
            raise InvalidOperationException(
                f"현재 상태({examination.status})에서는 채점을 시작할 수 없습니다."
            )

        # 조각을 반응별로 미리 묶는다 — 반응마다 조회하면 N+1이 된다.
        all_regions = await self.region_repo.list_by_response_ids([r.id for r in responses])
        regions_by_response: dict[str, list[RorschachRegion]] = {r.id: [] for r in responses}
        for g in all_regions:
            if g.response_id in regions_by_response:
                regions_by_response[g.response_id].append(g)

        # ⚠️ 표시 번호는 **세션 전체**를 세어 만든다. 이 루프가 가진 `responses`는
        # 정식 반응만이라(list_formal_by_session), 그걸로 세면 한계검증이 섞인
        # 세션에서 화면과 다른 번호가 나온다 — AI 근거가 엉뚱한 반응을 가리킨다.
        display_nos = await _session_display_numbers(self.response_repo, session.id)

        # 반응별 채점.
        #
        # AI 호출이 실패하면 그 반응만 건너뛴다 — 입력 부족 skip과 같은 이유다.
        # 하나 때문에 전체를 롤백하면 22건 중 21건의 채점까지 잃는다.
        # **다만 전부 실패했으면 올린다**: AI 서버가 죽은 것을 "0건 채점됨"으로
        # 조용히 돌려주면, 화면은 '완료'라 말하고 임상가는 왜 비었는지 모른다.
        ai_failures: list[str] = []
        scored_count = 0
        for response in responses:
            regions = regions_by_response.get(response.id, [])
            area_code = response.area_code
            transcript = (
                (response.free_association_text or "").strip()
                or _extract_examinee_text(session.transcript_json, regions)
            )

            # 입력이 덜 찬 반응은 **건너뛴다** — 하나 때문에 전체를 실패시키면
            # 22건 중 21건의 채점까지 잃는다. 단일 채점과 같은 규칙이다.
            #
            # 조용한 skip이 아니다: 건너뛴 반응은 초안 없이 남으므로 화면에
            # '미채점'으로 그대로 보인다. 부르는 쪽도 대상 건수를 미리 센다.
            if missing_score_inputs(response, transcript):
                continue

            try:
                scoring = await self.ai_service.score_rorschach(
                    card_no=response.card_no,
                    response_no=display_nos.get(response.id) or 1,
                    transcript=transcript,
                    location_marking={"area_code": area_code} if area_code else None,
                    inquiry_transcript=response.inquiry_text,
                )
            except ExternalServiceException as exc:
                # 초안을 만들지 않는다 — 실패한 반응은 '미채점'으로 남는다.
                # 예전에는 여기서 목업 부호가 대신 들어앉았다.
                ai_failures.append(str(display_nos.get(response.id) or response.card_no))
                logger.warning(
                    "[일괄채점] 카드 %d 반응 %s 채점 실패: %s",
                    response.card_no, display_nos.get(response.id), exc,
                )
                continue

            response.ai_coding_json = _scoring_to_coding_dict(scoring, area_code, response.id)
            response.ai_confidence = scoring.confidence
            response.ai_reasoning = scoring.reasoning
            scored_count += 1
            if transcript and not response.free_association_text:
                response.free_association_text = transcript

        # 한 건도 못 했으면 실패다. 부분 성공은 살린다(위 주석).
        if ai_failures and scored_count == 0:
            raise ExternalServiceException(
                f"AI 채점 서버가 {len(ai_failures)}개 반응 모두에 실패했습니다. "
                "잠시 후 다시 시도해 주세요."
            )
        if ai_failures:
            logger.warning(
                "[일괄채점] %d건 채점, %d건 실패(반응 %s) — 실패분은 미채점으로 남는다",
                scored_count, len(ai_failures), ", ".join(ai_failures),
            )

        await self.response_repo.flush()

        # 초안이 생겼으니 검토 대기로. 재채점이면 이미 그 이후라 그대로 둔다.
        if examination.status == "in_progress":
            validate_transition(examination.status, "ai_draft_ready")
            examination.status = "ai_draft_ready"
            await self.examination_repo.flush()

        # 결과 일괄 조회
        return await _build_detail_response(
            self.session_repo, self.region_repo, self.response_repo, session
        )


async def _attach_region_ids(
    region_repo: RorschachRegionRepository,
    responses: list[RorschachResponse],
) -> None:
    """반응들에 `region_ids`를 채운다 — completion 판정이 조각 수를 보기 때문이다.

    ORM 관계로 lazy 로딩하면 반응마다 쿼리가 나간다(N+1). 한 번에 읽어
    메모리에서 나눈다. `_build_detail_response`가 하는 것과 같은 방식이다.

    ⚠️ 모델에 없는 속성을 얹는다. completion 함수가 `regions`(ORM)와
    `region_ids`(DTO) 양쪽을 받도록 돼 있어 성립한다.
    """
    if not responses:
        return
    ids = [r.id for r in responses]
    regions = await region_repo.list_by_response_ids(ids)
    by_response: dict[str, list[str]] = {rid: [] for rid in ids}
    for g in regions:
        if g.response_id in by_response:
            by_response[g.response_id].append(g.id)
    for r in responses:
        r.region_ids = by_response.get(r.id, [])


async def _build_detail_response(
    session_repo: RorschachSessionRepository,
    region_repo: RorschachRegionRepository,
    response_repo: RorschachResponseRepository,
    session: RorschachSession,
    card_repo: RorschachCardAdministrationRepository | None = None,
    intervention_repo: RorschachInterventionRepository | None = None,
) -> SessionDetailResponse:
    """세션 + 반응 + 영역 + 트랜스크립트 빌드.

    **반응을 순회한다**(§7). region을 순회하면 영역 0개인 반응(거부·미완성)이
    조용히 빠지고 R이 틀어진다. 영역은 반응에 딸린 것으로만 나간다.
    """
    responses = await response_repo.list_by_session(session.id)
    regions = await region_repo.list_by_session(session.id)

    card_no_by_response = {r.id: r.card_no for r in responses}
    region_ids_by_response: dict[str, list[str]] = {r.id: [] for r in responses}
    for g in regions:
        if g.response_id in region_ids_by_response:
            region_ids_by_response[g.response_id].append(g.id)

    transcript_segments: list[TranscriptSegment] = []
    if session.transcript_json and isinstance(session.transcript_json, dict):
        raw = session.transcript_json.get("segments", [])
        transcript_segments = [TranscriptSegment(**s) for s in raw]

    cards = await card_repo.list_by_session(session.id) if card_repo else []
    interventions = (
        await intervention_repo.list_by_session(session.id) if intervention_repo else []
    )

    # 표시 번호는 여기서 한 번만 만든다 — 화면·오류 메시지가 같은 값을 봐야 한다.
    display_nos = display_numbers(responses)

    return SessionDetailResponse(
        session=SessionResponse.model_validate(session),
        regions=[
            _to_region_response(g, card_no_by_response.get(g.response_id))
            for g in regions
        ],
        responses=[
            _response_to_detail(
                r, region_ids_by_response.get(r.id, []), display_nos.get(r.id)
            )
            for r in responses
        ],
        transcript=transcript_segments,
        cards=[CardAdministrationResponse.model_validate(c) for c in cards],
        interventions=[InterventionResponse.model_validate(i) for i in interventions],
    )


class GetSessionDetailService:
    """채점 화면용: 세션 + 영역 + 응답 + 트랜스크립트 통합 조회 (순수 조회).

    transcript는 비어있을 수 있음. 채점 화면이 별도 엔드포인트(EnsureTranscriptService)를
    호출하여 lazy 생성한다.
    """

    def __init__(
        self,
        session_repo: RorschachSessionRepository,
        region_repo: RorschachRegionRepository,
        response_repo: RorschachResponseRepository,
        examination_repo: ExaminationRepository,
        card_repo: RorschachCardAdministrationRepository | None = None,
        intervention_repo: RorschachInterventionRepository | None = None,
    ):
        self.session_repo = session_repo
        self.region_repo = region_repo
        self.response_repo = response_repo
        self.examination_repo = examination_repo
        self.card_repo = card_repo
        self.intervention_repo = intervention_repo

    async def execute(self, examination_id: str, institution_id: str) -> SessionDetailResponse:
        examination = await self.examination_repo.get(examination_id)
        _ensure_examination(examination, institution_id)

        session = await self.session_repo.get_by_examination_id(examination_id)
        if not session:
            raise EntityNotFoundException("로르샤하 세션이 없습니다.")

        return await _build_detail_response(
            self.session_repo, self.region_repo, self.response_repo, session,
            self.card_repo, self.intervention_repo,
        )


class UpdateResponseCodingService:
    """임상가가 final_coding_json 수정.

    AI 코딩(ai_coding_json)은 절대 덮어쓰지 않음 (CDSS 감사추적).
    상태가 ai_draft_ready인 경우 under_review로 자동 전이.
    """

    def __init__(
        self,
        session_repo: RorschachSessionRepository,
        region_repo: RorschachRegionRepository,
        response_repo: RorschachResponseRepository,
        examination_repo: ExaminationRepository,
    ):
        self.session_repo = session_repo
        self.region_repo = region_repo
        self.response_repo = response_repo
        self.examination_repo = examination_repo

    async def execute(
        self,
        examination_id: str,
        institution_id: str,
        response_id: str,
        coding: RorschachCoding,
        transcript_text: str | None = None,
    ) -> ResponseDetail:
        examination = await self.examination_repo.get(examination_id)
        examination = _ensure_examination(examination, institution_id)

        if examination.status not in ("ai_draft_ready", "under_review"):
            raise InvalidOperationException(
                f"현재 상태({examination.status})에서는 코딩을 수정할 수 없습니다."
            )

        response = await self.response_repo.get(response_id)
        if not response or response.deleted_at is not None:
            raise EntityNotFoundException("응답을 찾을 수 없습니다.")

        # 권한 체크: 반응이 세션에 직접 달려 있다(§4-1).
        # 예전엔 region을 경유했는데, 영역 0개 반응이면 권한 오류로 튕겼다.
        session = await self.session_repo.get_by_examination_id(examination_id)
        if not session:
            raise EntityNotFoundException("로르샤하 세션이 없습니다.")
        if response.session_id != session.id:
            raise PermissionDeniedException("해당 세션의 응답이 아닙니다.")

        # 위치 부호는 **반응이 정본이다**(§14-7). 코딩 dict에도 같은 값이
        # 들어가는데, 채점(scoring.py)이 `coding["location"]`을 읽으므로 둘이
        # 어긋나면 그 반응이 위치 집계에서 **조용히 빠진다** — 영역 부호 43건이
        # 사라졌던 것과 같은 종류다.
        #
        # 실제로 어긋났다(2026-08-25): 화면에서 'AI 제안 전체 반영'을 누르면
        # location은 채우지 않는데(임상가가 고른 값이라 AI가 못 건드린다),
        # 그 상태로 저장되면 `area_code='Dd21'`인데 `coding.location=null`이 된다.
        #
        # 그래서 **클라이언트가 보낸 location을 믿지 않고 반응에서 파생시킨다.**
        # 두 곳에 있는 값은 한쪽에서만 만들어야 어긋날 수 없다.
        payload = coding.model_dump()
        if response.area_code:
            payload["location"] = response.area_code
        elif payload.get("location"):
            # 반대 방향 — 아직 area_code가 없는 옛 데이터는 코딩 쪽 값을 정본으로
            # 끌어올린다. 그래야 다음부터 위 분기 하나로 수렴한다.
            response.area_code = payload["location"]
        response.final_coding_json = payload

        # 임상가가 본/교정한 응답 텍스트도 같이 저장
        if transcript_text is not None:
            stripped = transcript_text.strip()
            if stripped:
                response.free_association_text = stripped

        # 낡음 해제 — **임상가가 이 반응을 다시 저장했다.**
        #
        # 원자료를 고쳐 채점이 낡은 것으로 표시됐더라도, 사람이 지금 값을 보고
        # 저장했다면 그 채점은 지금 자료를 근거로 선 것이다. 값을 안 바꾸고
        # 그대로 저장하는 것도 "이대로 둔다"는 판단이므로 해제 대상이다.
        # 해제 지점은 여기 하나뿐이다 — AI 재채점은 초안만 갱신한다.
        response.coding_stale_at = None

        # ai_draft_ready → under_review 자동 전이 (첫 수정 시)
        if examination.status == "ai_draft_ready":
            validate_transition(examination.status, "under_review")
            examination.status = "under_review"
            await self.examination_repo.flush()

        await self.response_repo.flush()
        await self.response_repo.refresh(response)
        regions = await self.region_repo.list_by_response(response.id)
        display_no = await _display_no_of(self.response_repo, response)
        return _response_to_detail(response, [g.id for g in regions], display_no)


class ConfirmSessionService:
    """전체 응답 확정 → under_review → confirmed 전이.

    조건: **모든 정식 반응에 `final_coding_json`이 있어야 한다** — 즉 임상가가
    각 반응의 채점을 검토하고 저장했어야 한다(§14-4). AI 초안(`ai_coding_json`)은
    확정으로 승격되지 않는다.
    """

    def __init__(
        self,
        session_repo: RorschachSessionRepository,
        region_repo: RorschachRegionRepository,
        response_repo: RorschachResponseRepository,
        examination_repo: ExaminationRepository,
    ):
        self.session_repo = session_repo
        self.region_repo = region_repo
        self.response_repo = response_repo
        self.examination_repo = examination_repo

    async def execute(
        self,
        examination_id: str,
        institution_id: str,
        confirmed_by: str | None = None,
    ) -> SessionDetailResponse:
        examination = await self.examination_repo.get(examination_id)
        examination = _ensure_examination(examination, institution_id)

        if examination.status not in ("ai_draft_ready", "under_review"):
            raise InvalidOperationException(
                f"현재 상태({examination.status})에서는 확정할 수 없습니다."
            )

        session = await self.session_repo.get_by_examination_id(examination_id)
        if not session:
            raise EntityNotFoundException("로르샤하 세션이 없습니다.")

        # **정식 반응을 순회한다**(§7). region을 순회하면 영역이 없는 반응은
        # 검사 자체를 받지 않고 확정을 통과했다. 한계검증(is_formal=False)은
        # 채점 대상이 아니므로 여기서 빠진다.
        responses = await self.response_repo.list_formal_by_session(session.id)
        if not responses:
            raise InvalidOperationException("확정할 반응이 없습니다.")

        # **AI 초안을 확정으로 승격하지 않는다** (§14-4).
        #
        # 예전에는 `final_coding_json is None`이면 `ai_coding_json`을 그대로
        # 복사했다. 그래서 임상가가 한 번도 열어보지 않은 AI 초안이 확정
        # 코딩이 됐다 — CDSS 원칙(AI 초안 → 임상가 확인)이 깨진 자리이고,
        # 확정 후에는 누가 채운 값인지 구분할 수도 없어 감사추적 구멍이었다.
        #
        # 이제 확정의 조건은 하나다: **임상가가 저장을 눌렀는가**
        # (`final_coding_json`은 사람이 저장해야만 채워지는 칸이다).
        pending = uncoded_responses(responses)
        if pending:
            # 이름을 댄다 — 반응 25개 중 하나가 빠졌을 때 "확정할 수 없습니다"
            # 만으로는 임상가가 어디를 고쳐야 할지 알 수 없다(§14-12).
            # 이름은 **화면과 같은 번호**여야 한다 — 저장 서열을 대면 임상가가
            # 그런 번호를 못 찾는다. `responses`(정식만)로 세지 않는 이유는
            # `_session_display_numbers` 참조.
            display_nos = await _session_display_numbers(self.response_repo, session.id)
            names = ", ".join(
                describe_response(r, display_nos.get(r.id)) for r in pending[:5]
            )
            more = f" 외 {len(pending) - 5}건" if len(pending) > 5 else ""
            raise InvalidOperationException(
                f"임상가 확인이 끝나지 않은 반응이 있습니다 ({names}{more}). "
                f"각 반응의 채점을 검토하고 저장해주세요."
            )

        now = datetime.utcnow()
        for response in responses:
            response.confirmed_at = now
            response.confirmed_by = confirmed_by

        await self.response_repo.flush()

        # 상태 전이: ai_draft_ready 또는 under_review → confirmed
        if examination.status == "ai_draft_ready":
            validate_transition(examination.status, "under_review")
            examination.status = "under_review"
        validate_transition(examination.status, "confirmed")
        examination.status = "confirmed"
        examination.completed_at = now
        await self.examination_repo.flush()

        return await _build_detail_response(
            self.session_repo, self.region_repo, self.response_repo, session
        )


class GetStructuralSummaryService:
    """확정된 응답들의 final_coding을 모아 Exner CS 구조요약 계산.

    조건: 검사 상태가 confirmed/report_generated/completed 중 하나여야 함.
    """

    def __init__(
        self,
        session_repo: RorschachSessionRepository,
        region_repo: RorschachRegionRepository,
        response_repo: RorschachResponseRepository,
        examination_repo: ExaminationRepository,
    ):
        self.session_repo = session_repo
        self.region_repo = region_repo
        self.response_repo = response_repo
        self.examination_repo = examination_repo

    async def execute(
        self,
        examination_id: str,
        institution_id: str,
    ) -> StructuralSummaryResponse:
        examination = await self.examination_repo.get(examination_id)
        examination = _ensure_examination(examination, institution_id)

        if not is_confirmed(examination.status):
            raise InvalidOperationException(
                f"확정되지 않은 검사입니다. 현재 상태: {examination.status}"
            )

        session = await self.session_repo.get_by_examination_id(examination_id)
        if not session:
            raise EntityNotFoundException("로르샤하 세션이 없습니다.")

        # **정식 반응 순회**(§7). R은 반응 개수다 — 영역 개수가 아니다.
        # 한 반응에 조각이 N개면 region 순회는 R을 N배로 부풀렸다.
        responses = await self.response_repo.list_formal_by_session(session.id)

        codings: list[dict] = []
        card_nos: list[int] = []
        missing: list[str] = []
        # 순회는 정식 반응, 번호는 세션 전체 — `_session_display_numbers` 참조.
        display_nos = await _session_display_numbers(self.response_repo, session.id)
        for response in responses:
            if not response.final_coding_json:
                # 확정 단계인데 final_coding이 없으면 비정상이다.
                # 조용히 건너뛰면 R이 줄어든 채로 구조요약이 계산된다 —
                # Exner CS는 R로 나누는 비율 지표가 대부분이라 전 지표가 틀어진다.
                missing.append(describe_response(response, display_nos.get(response.id)))
                continue
            codings.append(response.final_coding_json)
            card_nos.append(response.card_no)

        if missing:
            raise InvalidOperationException(
                "확정 코딩이 없는 반응이 있어 구조요약을 계산할 수 없습니다: "
                + ", ".join(missing)
            )

        summary = calculate_structural_summary(codings, card_nos)
        lower = calculate_lower_section(codings, card_nos, summary)
        special = calculate_special_indices(codings, card_nos, summary, lower)

        return StructuralSummaryResponse(
            **summary,
            lower_section=lower,
            special_indices=special,
        )
