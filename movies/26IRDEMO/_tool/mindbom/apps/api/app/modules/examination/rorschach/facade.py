"""로르샤하 Facade — Service 조합 + DTO 변환"""
from app.core.unit_of_work import UnitOfWork
from app.infrastructure.ai.base import AIService
from app.modules.audit.repository import AuditLogRepository
from app.modules.audit.services import AuditLogger
from app.modules.auth.dependencies import InstitutionContext
from app.modules.examination.common.repository import ExaminationRepository
from app.modules.examination.rorschach.repository import (
    RorschachCardAdministrationRepository,
    RorschachInterventionRepository,
    RorschachRegionRepository,
    RorschachResponseRepository,
    RorschachSessionRepository,
)
from app.modules.examination.rorschach.schemas import (
    AudioUrlResponse,
    CodingUpdateRequest,
    RegionCreate,
    RegionResponse,
    RegionUpdate,
    ResponseDetail,
    CardAdministrationResponse,
    CardStatusUpdate,
    InterventionCreate,
    InterventionResponse,
    ResponseCreate,
    ResponseUpdate,
    SessionCompleteRequest,
    SessionDetailResponse,
    SessionResponse,
    SessionStartResponse,
    SessionWithRegionsResponse,
    StructuralSummaryResponse,
    TranscriptClipResponse,
    TranscriptResponse,
)
from app.modules.examination.rorschach.services import (
    CompleteSessionService,
    ConfirmSessionService,
    CreateInterventionService,
    DeleteInterventionService,
    CreateRegionService,
    CreateResponseService,
    DeleteRegionService,
    DeleteResponseService,
    EnsureTranscriptService,
    GetAudioUrlService,
    GetRorschachSessionService,
    GetSessionDetailService,
    GetStructuralSummaryService,
    ScoreResponseService,
    ScoreSessionService,
    SetCardStatusService,
    StartRorschachSessionService,
    TranscribeClipService,
    UpdateRegionService,
    UpdateResponseCodingService,
    UpdateResponseService,
    UploadAudioService,
)


class RorschachFacade:
    """로르샤하 검사 도메인 — Service 조합"""

    def __init__(
        self,
        uow: UnitOfWork,
        ai_service: AIService | None = None,
        ctx: InstitutionContext | None = None,
    ):
        self._uow = uow
        self._ai_service = ai_service
        self._ctx = ctx

    async def _audit(
        self,
        *,
        action: str,
        entity_id: str,
        old_value: dict | None = None,
        new_value: dict | None = None,
        metadata: dict | None = None,
    ) -> None:
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

    # ── 리포지토리 접근 ──

    @property
    def _session_repo(self) -> RorschachSessionRepository:
        return self._uow.repo(RorschachSessionRepository)

    @property
    def _region_repo(self) -> RorschachRegionRepository:
        return self._uow.repo(RorschachRegionRepository)

    @property
    def _response_repo(self) -> RorschachResponseRepository:
        return self._uow.repo(RorschachResponseRepository)

    @property
    def _card_repo(self) -> RorschachCardAdministrationRepository:
        return self._uow.repo(RorschachCardAdministrationRepository)

    @property
    def _intervention_repo(self) -> RorschachInterventionRepository:
        return self._uow.repo(RorschachInterventionRepository)

    @property
    def _exam_repo(self) -> ExaminationRepository:
        return self._uow.repo(ExaminationRepository)

    # ── 반응 관리 (자유반응 단계 — §4-1) ──

    async def create_response(
        self, exam_id: str, institution_id: str, data: ResponseCreate
    ) -> ResponseDetail:
        service = CreateResponseService(
            self._session_repo, self._response_repo, self._region_repo,
            self._card_repo, self._exam_repo,
        )
        result = await service.execute(exam_id, institution_id, data)
        await self._audit(
            action="update_results",
            entity_id=exam_id,
            metadata={"module": "rorschach", "op": "create_response",
                      "card_no": data.card_no},
        )
        return result

    async def update_response(
        self, exam_id: str, institution_id: str, response_id: str, data: ResponseUpdate
    ) -> ResponseDetail:
        service = UpdateResponseService(
            self._session_repo, self._response_repo, self._region_repo, self._exam_repo,
        )
        result = await service.execute(exam_id, institution_id, response_id, data)
        await self._audit(
            action="update_results",
            entity_id=exam_id,
            metadata={"module": "rorschach", "op": "update_response",
                      "response_id": response_id},
        )
        return result

    async def delete_response(
        self, exam_id: str, institution_id: str, response_id: str
    ) -> None:
        service = DeleteResponseService(
            self._session_repo, self._response_repo, self._region_repo, self._exam_repo,
        )
        await service.execute(exam_id, institution_id, response_id)
        await self._audit(
            action="update_results",
            entity_id=exam_id,
            metadata={"module": "rorschach", "op": "delete_response",
                      "response_id": response_id},
        )

    async def set_card_status(
        self, exam_id: str, institution_id: str, card_no: int, data: CardStatusUpdate
    ) -> CardAdministrationResponse:
        service = SetCardStatusService(
            self._session_repo, self._card_repo, self._response_repo, self._exam_repo,
        )
        result = await service.execute(exam_id, institution_id, card_no, data)
        await self._audit(
            action="update_results",
            entity_id=exam_id,
            metadata={"module": "rorschach", "op": "set_card_status",
                      "card_no": card_no, "status": data.status},
        )
        return result

    async def create_intervention(
        self, exam_id: str, institution_id: str, data: InterventionCreate
    ) -> InterventionResponse:
        service = CreateInterventionService(
            self._session_repo, self._intervention_repo, self._exam_repo,
        )
        return await service.execute(exam_id, institution_id, data)

    async def delete_intervention(
        self, exam_id: str, institution_id: str, intervention_id: str
    ) -> None:
        service = DeleteInterventionService(
            self._session_repo, self._intervention_repo, self._exam_repo,
        )
        await service.execute(exam_id, institution_id, intervention_id)

    # ── Phase 1: 세션 / 영역 관리 ──

    async def start_session(
        self, exam_id: str, institution_id: str
    ) -> SessionStartResponse:
        service = StartRorschachSessionService(self._session_repo, self._exam_repo)
        session = await service.execute(exam_id, institution_id)
        examination = await self._exam_repo.get(exam_id)
        return SessionStartResponse(
            session=SessionResponse.model_validate(session),
            examination_status=examination.status if examination else "unknown",
        )

    async def get_session(
        self, exam_id: str, institution_id: str
    ) -> SessionWithRegionsResponse:
        service = GetRorschachSessionService(
            self._session_repo, self._region_repo, self._response_repo, self._exam_repo
        )
        return await service.execute(exam_id, institution_id)

    async def create_region(
        self, exam_id: str, institution_id: str, data: RegionCreate
    ) -> RegionResponse:
        service = CreateRegionService(
            self._session_repo, self._region_repo, self._response_repo, self._exam_repo
        )
        return await service.execute(exam_id, institution_id, data)

    async def update_region(
        self, exam_id: str, institution_id: str, region_id: str, data: RegionUpdate
    ) -> RegionResponse:
        service = UpdateRegionService(
            self._session_repo, self._region_repo, self._response_repo, self._exam_repo
        )
        return await service.execute(exam_id, institution_id, region_id, data)

    async def delete_region(
        self, exam_id: str, institution_id: str, region_id: str
    ) -> None:
        service = DeleteRegionService(
            self._session_repo, self._region_repo, self._exam_repo
        )
        await service.execute(exam_id, institution_id, region_id)

    async def complete_session(
        self,
        exam_id: str,
        institution_id: str,
        data: SessionCompleteRequest,
    ) -> SessionResponse:
        service = CompleteSessionService(
            self._session_repo,
            self._exam_repo,
            self._response_repo,
            self._card_repo,
            self._region_repo,
        )
        return await service.execute(
            exam_id, institution_id, data.audio_duration_sec
        )

    async def upload_audio(
        self,
        exam_id: str,
        institution_id: str,
        audio_bytes: bytes,
        filename: str,
        content_type: str,
    ) -> SessionResponse:
        from app.infrastructure.storage import get_storage
        service = UploadAudioService(
            self._session_repo, self._exam_repo, get_storage()
        )
        return await service.execute(
            exam_id, institution_id, audio_bytes, filename, content_type
        )

    async def ensure_transcript(
        self, exam_id: str, institution_id: str
    ) -> TranscriptResponse:
        from app.infrastructure.openai import get_transcription
        from app.infrastructure.storage import get_storage
        from app.modules.transcription.services import DiarizeService
        service = EnsureTranscriptService(
            self._session_repo, self._exam_repo,
            DiarizeService(get_transcription()), get_storage(),
        )
        return await service.execute(exam_id, institution_id)

    async def transcribe_clip(
        self,
        exam_id: str,
        institution_id: str,
        audio_bytes: bytes,
        filename: str,
        duration_sec: float | None = None,
    ) -> TranscriptClipResponse:
        """발화 한 조각 전사 — 결과는 초안이고 서버에 저장하지 않는다."""
        from app.infrastructure.openai import get_transcription
        service = TranscribeClipService(
            self._session_repo, self._exam_repo, get_transcription(),
        )
        return await service.execute(
            exam_id, institution_id, audio_bytes, filename, duration_sec,
        )

    async def get_audio_url(
        self, exam_id: str, institution_id: str, expires_in: int = 3600
    ) -> AudioUrlResponse:
        from app.infrastructure.storage import get_storage
        service = GetAudioUrlService(self._session_repo, self._exam_repo, get_storage())
        url = await service.execute(exam_id, institution_id, expires_in)
        return AudioUrlResponse(url=url, expires_in=expires_in)

    # ── Phase 3: 채점 / 검토 / 확정 ──

    async def get_session_detail(
        self, exam_id: str, institution_id: str
    ) -> SessionDetailResponse:
        service = GetSessionDetailService(
            self._session_repo, self._region_repo, self._response_repo, self._exam_repo,
            self._card_repo, self._intervention_repo,
        )
        return await service.execute(exam_id, institution_id)

    async def score_session(
        self, exam_id: str, institution_id: str
    ) -> SessionDetailResponse:
        if self._ai_service is None:
            raise RuntimeError("AI service is required for scoring")
        service = ScoreSessionService(
            self._session_repo, self._region_repo, self._response_repo,
            self._exam_repo, self._ai_service,
        )
        result = await service.execute(exam_id, institution_id)
        await self._audit(
            action="ai_analyze",
            entity_id=exam_id,
            metadata={"module": "rorschach", "scope": "session"},
        )
        return result

    async def score_response(
        self,
        exam_id: str,
        institution_id: str,
        response_id: str,
        transcript_text: str | None = None,
    ) -> ResponseDetail:
        """단일 반응 채점 — 채점 단위는 영역이 아니라 반응이다(§7)."""
        if self._ai_service is None:
            raise RuntimeError("AI service is required for scoring")
        service = ScoreResponseService(
            self._session_repo, self._region_repo, self._response_repo,
            self._exam_repo, self._ai_service,
        )
        return await service.execute(exam_id, institution_id, response_id, transcript_text)

    async def update_response_coding(
        self,
        exam_id: str,
        institution_id: str,
        response_id: str,
        data: CodingUpdateRequest,
    ) -> ResponseDetail:
        service = UpdateResponseCodingService(
            self._session_repo, self._region_repo, self._response_repo, self._exam_repo
        )
        result = await service.execute(
            exam_id, institution_id, response_id, data.coding, data.transcript_text
        )
        await self._audit(
            action="update_results",
            entity_id=exam_id,
            metadata={"module": "rorschach", "response_id": response_id},
        )
        return result

    async def confirm_session(
        self,
        exam_id: str,
        institution_id: str,
        confirmed_by: str | None,
    ) -> SessionDetailResponse:
        service = ConfirmSessionService(
            self._session_repo, self._region_repo, self._response_repo, self._exam_repo
        )
        result = await service.execute(exam_id, institution_id, confirmed_by)
        await self._audit(
            action="state_change",
            entity_id=exam_id,
            metadata={"to": "confirmed", "module": "rorschach", "confirmed_by": confirmed_by},
        )
        return result

    async def get_structural_summary(
        self, exam_id: str, institution_id: str
    ) -> StructuralSummaryResponse:
        service = GetStructuralSummaryService(
            self._session_repo, self._region_repo, self._response_repo, self._exam_repo
        )
        return await service.execute(exam_id, institution_id)

    async def generate_report_pdf(
        self, exam_id: str, institution_id: str
    ) -> bytes:
        """로르샤하 보고서 PDF 생성. confirmed 상태에서 최초 호출 시 report_generated로 전이."""
        from app.modules.client.repository import ClientRepository
        from app.modules.examination.common.state_machine import validate_transition
        from app.modules.examination.report.service import RorschachReportService
        from app.modules.member.repository import MemberRepository

        summary = await GetStructuralSummaryService(
            self._session_repo, self._region_repo, self._response_repo, self._exam_repo,
        ).execute(exam_id, institution_id)

        session_detail = await GetSessionDetailService(
            self._session_repo, self._region_repo, self._response_repo, self._exam_repo,
        ).execute(exam_id, institution_id)

        exam = await self._exam_repo.get(exam_id)
        client_name = client_gender = None
        client_birth_date = None
        if exam and exam.client_id:
            client = await self._uow.repo(ClientRepository).get(exam.client_id)
            if client:
                client_name = client.name
                client_gender = client.gender
                client_birth_date = client.birth_date

        examiner_name = None
        if exam and exam.examiner_id:
            member = await self._uow.repo(MemberRepository).get(exam.examiner_id)
            if member:
                examiner_name = member.name

        pdf_bytes = RorschachReportService().generate_pdf(
            summary=summary,
            responses=session_detail.responses,
            regions=session_detail.regions,
            client_name=client_name,
            client_gender=client_gender,
            client_birth_date=client_birth_date,
            examiner_name=examiner_name,
            exam_started_at=exam.started_at if exam else None,
        )

        # 상태 전이: confirmed → report_generated
        if exam and exam.status == "confirmed":
            validate_transition(exam.status, "report_generated")
            exam.status = "report_generated"
            await self._exam_repo.flush()
            await self._audit(
                action="state_change",
                entity_id=exam_id,
                metadata={"from": "confirmed", "to": "report_generated", "module": "rorschach"},
            )

        await self._audit(
            action="generate_report",
            entity_id=exam_id,
            metadata={"module": "rorschach", "size_bytes": len(pdf_bytes)},
        )
        return pdf_bytes
