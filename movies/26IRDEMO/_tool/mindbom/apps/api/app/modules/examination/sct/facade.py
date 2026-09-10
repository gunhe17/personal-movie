"""SCT Facade — Service 조합 + DTO 변환"""
from app.core.unit_of_work import UnitOfWork
from app.infrastructure.ai.base import AIService
from app.modules.audit.repository import AuditLogRepository
from app.modules.audit.services import AuditLogger
from app.modules.auth.dependencies import InstitutionContext
from app.modules.examination.common.repository import ExaminationRepository
from app.modules.examination.common.schemas import ExaminationResponse
from app.modules.examination.sct.schemas import (
    SCTResponseSubmit,
    SCTResultsResponse,
)
from app.modules.examination.sct.services import (
    ConfirmSCTService,
    GetSCTResultsService,
    SaveSCTResponsesService,
    ScoreSCTService,
    UpdateSCTScoreService,
)


class SCTFacade:
    """SCT 검사 도메인 — Service 조합"""

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

    @property
    def _exam_repo(self) -> ExaminationRepository:
        return self._uow.repo(ExaminationRepository)

    async def save_responses(
        self,
        exam_id: str,
        institution_id: str,
        body: SCTResponseSubmit,
    ) -> ExaminationResponse:
        exam = await SaveSCTResponsesService(self._exam_repo).execute(
            exam_id, institution_id, body.responses
        )
        return ExaminationResponse.model_validate(exam)

    async def score(
        self, exam_id: str, institution_id: str
    ) -> ExaminationResponse:
        if self._ai_service is None:
            raise RuntimeError("AI service is required for SCT scoring")
        exam = await ScoreSCTService(self._exam_repo, self._ai_service).execute(
            exam_id, institution_id
        )
        await self._audit(
            action="ai_analyze",
            entity_id=exam_id,
            metadata={"module": "sct"},
        )
        return ExaminationResponse.model_validate(exam)

    async def update_score(
        self,
        exam_id: str,
        institution_id: str,
        stem_id: str,
        score: int,
    ) -> ExaminationResponse:
        exam = await UpdateSCTScoreService(self._exam_repo).execute(
            exam_id, institution_id, stem_id, score
        )
        await self._audit(
            action="update_results",
            entity_id=exam_id,
            metadata={"module": "sct", "stem_id": stem_id, "score": score},
        )
        return ExaminationResponse.model_validate(exam)

    async def confirm(
        self, exam_id: str, institution_id: str
    ) -> ExaminationResponse:
        exam = await ConfirmSCTService(self._exam_repo).execute(
            exam_id, institution_id
        )
        await self._audit(
            action="state_change",
            entity_id=exam_id,
            metadata={"to": "confirmed", "module": "sct"},
        )
        return ExaminationResponse.model_validate(exam)

    async def get_results(
        self, exam_id: str, institution_id: str
    ) -> SCTResultsResponse:
        exam, results = await GetSCTResultsService(self._exam_repo).execute(
            exam_id, institution_id
        )
        return SCTResultsResponse(
            examinationId=exam.id,
            status=exam.status,
            results=results,
        )

    async def generate_report_pdf(
        self, exam_id: str, institution_id: str
    ) -> bytes:
        """SCT 보고서 PDF 생성. confirmed 상태에서 최초 호출 시 report_generated로 전이."""
        from app.core.exceptions import EntityNotFoundException
        from app.modules.client.repository import ClientRepository
        from app.modules.examination.common.state_machine import validate_transition
        from app.modules.examination.report.service import SCTReportService
        from app.modules.member.repository import MemberRepository

        exam, results = await GetSCTResultsService(self._exam_repo).execute(
            exam_id, institution_id
        )
        if results is None:
            raise EntityNotFoundException("아직 채점 결과가 없습니다.")

        client_name = client_gender = None
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

        pdf_bytes = SCTReportService().generate_pdf(
            results=results,
            client_name=client_name,
            client_gender=client_gender,
            client_birth_date=client_birth_date,
            examiner_name=examiner_name,
            exam_started_at=exam.started_at,
        )

        # 상태 전이: confirmed → report_generated
        if exam.status == "confirmed":
            validate_transition(exam.status, "report_generated")
            exam.status = "report_generated"
            await self._exam_repo.flush()
            await self._audit(
                action="state_change",
                entity_id=exam_id,
                metadata={"from": "confirmed", "to": "report_generated", "module": "sct"},
            )

        await self._audit(
            action="generate_report",
            entity_id=exam_id,
            metadata={"module": "sct", "size_bytes": len(pdf_bytes)},
        )
        return pdf_bytes
