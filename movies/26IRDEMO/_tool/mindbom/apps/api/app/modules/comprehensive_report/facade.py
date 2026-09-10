"""종합보고서 Facade — Service 조합 + DTO + 상태전이 + 권한검증

Handler에서 호출, UoW 내부에서 동작.
"""
import logging

from app.core.exceptions import (
    EntityNotFoundException,
    InvalidOperationException,
    PermissionDeniedException,
)
from app.core.unit_of_work import UnitOfWork
from app.modules.audit.repository import AuditLogRepository
from app.modules.audit.services import AuditLogger
from app.modules.auth.dependencies import InstitutionContext
from app.modules.client.repository import ClientRepository
from app.modules.comprehensive_report.assembly import CombinedAssemblyService
from app.modules.comprehensive_report.constants import (
    DEFAULT_TITLE,
    EXAM_TYPE_LABELS,
    SELECTABLE_STATUSES,
)
from app.modules.comprehensive_report.models import ComprehensiveReport
from app.modules.comprehensive_report.repository import (
    ComprehensiveReportExaminationRepository,
    ComprehensiveReportRepository,
)
from app.modules.comprehensive_report.schemas import (
    ComprehensiveReportCreate,
    ComprehensiveReportResponse,
    ComprehensiveReportSummary,
    ComprehensiveReportUpdate,
    LinkedExamination,
    ReportSection,
)
from app.modules.comprehensive_report.schemas import GenerateDraftRequest
from app.modules.comprehensive_report.services import SeedSectionsService, merge_ai_draft
from app.modules.comprehensive_report.state_machine import (
    STATUS_LABELS,
    is_confirmed,
    validate_transition,
)
from app.modules.examination.common.models import Examination
from app.modules.examination.common.repository import ExaminationRepository

logger = logging.getLogger(__name__)

# 생성/편집/확정 가능한 역할 (researcher는 읽기 전용)
_WRITE_ROLES = {"admin", "clinician"}


class ComprehensiveReportFacade:
    def __init__(
        self,
        uow: UnitOfWork,
        ctx: InstitutionContext | None = None,
        ai_service=None,
    ):
        self._uow = uow
        self._ctx = ctx
        self._ai_service = ai_service

    # ── 리포지토리 접근 (lazy) ──
    @property
    def _repo(self) -> ComprehensiveReportRepository:
        return self._uow.repo(ComprehensiveReportRepository)

    @property
    def _link_repo(self) -> ComprehensiveReportExaminationRepository:
        return self._uow.repo(ComprehensiveReportExaminationRepository)

    @property
    def _exam_repo(self) -> ExaminationRepository:
        return self._uow.repo(ExaminationRepository)

    # ── 권한 ──
    def _require_write(self) -> None:
        if self._ctx is not None and self._ctx.role not in _WRITE_ROLES:
            raise PermissionDeniedException(
                "연구자 역할은 종합보고서를 생성/편집할 수 없습니다."
            )

    async def _get_owned(self, report_id: str, institution_id: str) -> ComprehensiveReport:
        report = await self._repo.get(report_id)
        if not report:
            raise EntityNotFoundException(f"종합보고서를 찾을 수 없습니다: {report_id}")
        if report.institution_id != institution_id:
            raise PermissionDeniedException("해당 기관의 보고서가 아닙니다.")
        return report

    # ── 감사추적 ──
    async def _audit(
        self, *, action: str, entity_id: str,
        old_value: dict | None = None, new_value: dict | None = None,
        metadata: dict | None = None,
    ) -> None:
        if self._ctx is None:
            return
        repo = self._uow.repo(AuditLogRepository)
        await AuditLogger(repo).log(
            action=action,
            entity_type="comprehensive_report",
            entity_id=entity_id,
            actor_id=self._ctx.account_id,
            actor_email=self._ctx.email,
            actor_role=self._ctx.role,
            institution_id=self._ctx.institution_id,
            old_value=old_value,
            new_value=new_value,
            metadata=metadata,
        )

    # ── 유스케이스: 생성 ──
    async def create_report(
        self, institution_id: str, data: ComprehensiveReportCreate
    ) -> ComprehensiveReportResponse:
        self._require_write()

        # 링크 검사 검증 (존재/기관/내담자/상태/소유)
        exams = await self._validate_examinations(
            institution_id, data.client_id, data.examination_ids
        )

        # 내담자/검사자 메타
        client = await self._uow.repo(ClientRepository).get(data.client_id)
        if client is None:
            raise EntityNotFoundException(f"내담자를 찾을 수 없습니다: {data.client_id}")
        examiner_name = await self._member_name(
            self._ctx.member_id if self._ctx else None
        )

        # 보고서 생성
        report = await self._repo.create({
            "institution_id": institution_id,
            "client_id": data.client_id,
            "examiner_id": self._ctx.member_id if self._ctx else "",
            "title": data.title or DEFAULT_TITLE,
            "status": "draft",
        })

        # 링크 생성 (요청 순서 유지)
        await self._link_repo.bulk_create(
            report.id, [(e.id, e.exam_type) for e in exams]
        )

        # auto 섹션 seed
        assemblies = await CombinedAssemblyService(self._uow).execute(
            [e.id for e in exams]
        )
        sections = SeedSectionsService().execute(
            assemblies=assemblies,
            client_name=client.name,
            client_gender=client.gender,
            client_birth_date=client.birth_date,
            examiner_name=examiner_name,
        )
        report.sections = sections
        await self._repo.flush()

        await self._audit(
            action="create_comprehensive_report",
            entity_id=report.id,
            metadata={
                "client_id": data.client_id,
                "examination_ids": data.examination_ids,
                "count": len(exams),
            },
        )

        return await self._build_response(report)

    async def _validate_examinations(
        self, institution_id: str, client_id: str, exam_ids: list[str]
    ) -> list[Examination]:
        exams: list[Examination] = []
        not_found: list[str] = []
        wrong_client: list[str] = []
        not_ready: list[str] = []
        not_owned: list[str] = []

        for exam_id in exam_ids:
            exam = await self._exam_repo.get(exam_id)
            if exam is None or exam.institution_id != institution_id:
                not_found.append(exam_id)
                continue
            if exam.client_id != client_id:
                wrong_client.append(exam_id)
                continue
            if exam.status not in SELECTABLE_STATUSES:
                not_ready.append(exam_id)
                continue
            if (
                self._ctx is not None
                and self._ctx.role == "clinician"
                and exam.examiner_id != self._ctx.member_id
            ):
                not_owned.append(exam_id)
                continue
            exams.append(exam)

        problems = []
        if not_found:
            problems.append(f"찾을 수 없음: {not_found}")
        if wrong_client:
            problems.append(f"내담자 불일치: {wrong_client}")
        if not_ready:
            problems.append(f"확정되지 않은 검사(확인완료 이후만 가능): {not_ready}")
        if not_owned:
            problems.append(f"본인 담당 아님: {not_owned}")
        if problems:
            raise InvalidOperationException("검사 선택 오류 — " + " / ".join(problems))

        if len(exams) < 2:
            raise InvalidOperationException("종합보고서는 2개 이상의 검사를 선택해야 합니다.")
        return exams

    # ── 유스케이스: 조회/목록 ──
    async def get_report(
        self, report_id: str, institution_id: str
    ) -> ComprehensiveReportResponse:
        report = await self._get_owned(report_id, institution_id)
        return await self._build_response(report)

    async def list_reports(
        self, institution_id: str, client_id: str
    ) -> list[ComprehensiveReportSummary]:
        reports = await self._repo.list_by_client(institution_id, client_id)
        summaries: list[ComprehensiveReportSummary] = []
        for r in reports:
            count = await self._link_repo.count_by_report(r.id)
            summaries.append(ComprehensiveReportSummary(
                id=r.id,
                client_id=r.client_id,
                title=r.title,
                status=r.status,
                status_label=STATUS_LABELS.get(r.status, r.status),
                exam_count=count,
                created_at=r.created_at,
                updated_at=r.updated_at,
            ))
        return summaries

    # ── 유스케이스: 편집(저장) ──
    async def update_report(
        self, report_id: str, institution_id: str, data: ComprehensiveReportUpdate
    ) -> ComprehensiveReportResponse:
        self._require_write()
        report = await self._get_owned(report_id, institution_id)
        self._require_mutable(report)

        changed_keys: list[str] = []
        if data.title is not None:
            report.title = data.title
        if data.note is not None:
            report.note = data.note
        if data.sections is not None:
            report.sections = [s.model_dump() for s in data.sections]
            changed_keys = [s.key for s in data.sections]

        # 최초 임상가 편집 → under_review 전이
        if report.status in ("draft", "ai_generated"):
            validate_transition(report.status, "under_review")
            report.status = "under_review"

        await self._repo.flush()
        await self._audit(
            action="update_sections",
            entity_id=report.id,
            metadata={"changed_keys": changed_keys, "status": report.status},
        )
        return await self._build_response(report)

    # ── 유스케이스: 확정 ──
    async def confirm_report(
        self, report_id: str, institution_id: str
    ) -> ComprehensiveReportResponse:
        self._require_write()
        report = await self._get_owned(report_id, institution_id)

        validate_transition(report.status, "confirmed")
        from app.core.datetime_utils import utc_now
        report.status = "confirmed"
        report.confirmed_by = self._ctx.member_id if self._ctx else None
        report.confirmed_at = utc_now()
        await self._repo.flush()
        await self._audit(
            action="state_change",
            entity_id=report.id,
            metadata={"to": "confirmed", "confirmed_by": report.confirmed_by},
        )
        return await self._build_response(report)

    # ── 유스케이스: AI 초안 생성 ──
    async def generate_draft(
        self, report_id: str, institution_id: str, data: GenerateDraftRequest
    ) -> ComprehensiveReportResponse:
        self._require_write()
        report = await self._get_owned(report_id, institution_id)
        self._require_mutable(report)

        if self._ai_service is None:
            raise InvalidOperationException("AI 서비스가 초기화되지 않았습니다.")

        # 링크 검사 취합 → AI 입력 구성
        links = await self._link_repo.list_by_report(report.id)
        exam_ids = [l.examination_id for l in links]
        assemblies = await CombinedAssemblyService(self._uow).execute(exam_ids)

        client = await self._uow.repo(ClientRepository).get(report.client_id)
        from app.infrastructure.ai.base import ComprehensiveDraftInput
        payload = ComprehensiveDraftInput(
            client={
                "name": client.name if client else None,
                "gender": client.gender if client else None,
                "birth_date": (
                    client.birth_date.isoformat()
                    if client and client.birth_date else None
                ),
            },
            exams=[
                {
                    "exam_type": a.exam_type,
                    "exam_date": a.exam_date.isoformat() if a.exam_date else None,
                    "signals": a.signals,
                }
                for a in assemblies
            ],
        )

        draft = await self._ai_service.generate_comprehensive_draft(payload)
        ai_sections = [s.model_dump() for s in draft.sections]

        # 불변 AI 스냅샷 저장
        from app.core.datetime_utils import utc_now
        report.ai_draft = {"sections": ai_sections, "model_version": draft.model_version}
        report.ai_model_version = draft.model_version
        report.ai_generated_at = utc_now()

        # sections에 병합 (CDSS: clinician 섹션 미변경)
        # 각 dict를 새로 복사 — MutableList 내부 객체를 in-place 변경하면 dirty
        # 플래그가 서지 않으므로, 새 dict/새 리스트로 재할당하여 확실히 반영.
        sections = [dict(s) for s in (report.sections or [])]
        merged, changed = merge_ai_draft(sections, ai_sections, data.mode)
        report.sections = merged

        # 상태 전이: under_review는 유지, 그 외 → ai_generated
        if report.status != "under_review":
            validate_transition(report.status, "ai_generated")
            report.status = "ai_generated"

        await self._repo.flush()
        await self._audit(
            action="generate_draft",
            entity_id=report.id,
            metadata={
                "mode": data.mode,
                "ai_model_version": draft.model_version,
                "changed_keys": changed,
                "status": report.status,
            },
        )
        return await self._build_response(report)

    # ── 유스케이스: PDF 생성 ──
    async def generate_report_pdf(
        self, report_id: str, institution_id: str
    ) -> bytes:
        from app.modules.examination.report.service import CombinedReportService
        from app.modules.comprehensive_report.constants import EXAM_TYPE_LABELS

        self._require_write()
        report = await self._get_owned(report_id, institution_id)

        if not is_confirmed(report.status):
            raise InvalidOperationException(
                "확인 완료(confirmed) 이후에만 PDF를 생성할 수 있습니다."
            )

        client = await self._uow.repo(ClientRepository).get(report.client_id)
        examiner_name = await self._member_name(report.examiner_id)

        # 실시 검사 메타
        links = await self._link_repo.list_by_report(report.id)
        exams_meta: list[dict] = []
        for link in links:
            exam = await self._exam_repo.get(link.examination_id, include_deleted=True)
            exam_date = (exam.started_at or exam.created_at) if exam else None
            exams_meta.append({
                "label": EXAM_TYPE_LABELS.get(link.exam_type, link.exam_type),
                "exam_date": exam_date.strftime("%Y-%m-%d") if exam_date else "-",
                "is_deleted": (exam is None or exam.deleted_at is not None),
            })

        pdf_bytes = CombinedReportService().generate_pdf(
            title=report.title or "종합 심리평가 보고서",
            sections=list(report.sections or []),
            client_name=client.name if client else None,
            client_gender=client.gender if client else None,
            client_birth_date=client.birth_date if client else None,
            examiner_name=examiner_name,
            exams_meta=exams_meta,
        )

        # 상태 전이: confirmed → report_generated (최초 PDF 시점)
        if report.status == "confirmed":
            from app.core.datetime_utils import utc_now
            validate_transition(report.status, "report_generated")
            report.status = "report_generated"
            report.report_generated_at = utc_now()
            await self._repo.flush()
            await self._audit(
                action="state_change",
                entity_id=report.id,
                metadata={"to": "report_generated"},
            )

        await self._audit(
            action="generate_report",
            entity_id=report.id,
            metadata={"size_bytes": len(pdf_bytes)},
        )
        return pdf_bytes

    # ── 내부 헬퍼 ──
    def _require_mutable(self, report: ComprehensiveReport) -> None:
        if report.status in ("report_generated", "completed"):
            raise InvalidOperationException(
                f"현재 상태({report.status})에서는 보고서를 편집할 수 없습니다."
            )

    async def _member_name(self, member_id: str | None) -> str | None:
        if not member_id:
            return None
        from app.modules.member.repository import MemberRepository
        member = await self._uow.repo(MemberRepository).get(member_id)
        return member.name if member else None

    async def _build_response(
        self, report: ComprehensiveReport
    ) -> ComprehensiveReportResponse:
        # flush 후 onupdate/server_default 컬럼이 expire되어 접근 시 lazy IO(MissingGreenlet)
        # 발생 → 명시적 refresh로 모든 컬럼 재로딩.
        await self._repo.refresh(report)
        client = await self._uow.repo(ClientRepository).get(report.client_id)
        examiner_name = await self._member_name(report.examiner_id)

        links = await self._link_repo.list_by_report(report.id)
        linked: list[LinkedExamination] = []
        for link in links:
            exam = await self._exam_repo.get(link.examination_id, include_deleted=True)
            linked.append(LinkedExamination(
                examination_id=link.examination_id,
                exam_type=link.exam_type,
                exam_type_label=EXAM_TYPE_LABELS.get(link.exam_type, link.exam_type),
                exam_date=(exam.started_at or exam.created_at) if exam else None,
                sort_order=link.sort_order,
                is_deleted=(exam is None or exam.deleted_at is not None),
            ))

        sections = [ReportSection(**s) for s in (report.sections or [])]

        return ComprehensiveReportResponse(
            id=report.id,
            institution_id=report.institution_id,
            client_id=report.client_id,
            client_name=client.name if client else None,
            examiner_id=report.examiner_id,
            examiner_name=examiner_name,
            title=report.title,
            status=report.status,
            status_label=STATUS_LABELS.get(report.status, report.status),
            sections=sections,
            linked_examinations=linked,
            ai_model_version=report.ai_model_version,
            ai_generated_at=report.ai_generated_at,
            confirmed_by=report.confirmed_by,
            confirmed_at=report.confirmed_at,
            report_generated_at=report.report_generated_at,
            note=report.note,
            created_at=report.created_at,
            updated_at=report.updated_at,
        )
