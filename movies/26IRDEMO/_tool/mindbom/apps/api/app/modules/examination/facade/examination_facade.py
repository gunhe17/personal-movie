"""Examination Facade — Service 조합 + 감사 통합"""
from datetime import datetime

from app.core.dependencies import ClientInfo
from app.modules.auth.dependencies import InstitutionContext
from app.core.unit_of_work import UnitOfWork
from app.modules.audit.repository import AuditLogRepository
from app.modules.audit.services import AuditLogger
from app.modules.examination.common.repository import (
    ExaminationBatteryRepository,
    ExaminationRepository,
)
from app.modules.notification.repository import NotificationRepository
from app.modules.notification.services import NotificationPublisher
from app.modules.examination.common.schemas import (
    DashboardStats,
    ExaminationBatteryCreate,
    ExaminationBatteryResponse,
    ExaminationCreate,
    ExaminationListWithNamesResponse,
    ExaminationResponse,
    ExaminationUpdate,
)
from app.modules.examination.common.progress_service import GetExamProgressService
from app.modules.examination.common.services import (
    CreateBatteryService,
    CreateExaminationService,
    GetDashboardStatsService,
    GetExaminationService,
    ListExaminationsWithNamesService,
    UpdateExaminationService,
)


class ExaminationFacade:
    """검사 도메인 비즈니스 로직 조합 + 감사 추적

    Handler에서 한 번에 호출, Facade가 Service 조합 + DTO 변환 + audit 기록.
    """

    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def _audit_logger(self) -> AuditLogger:
        return AuditLogger(self._uow.repo(AuditLogRepository))

    def _notifier(self) -> NotificationPublisher:
        return NotificationPublisher(self._uow.repo(NotificationRepository))

    async def list_examinations(
        self,
        ctx: InstitutionContext,
        *,
        page: int = 1,
        size: int = 20,
        status: str | None = None,
        exam_type: str | None = None,
        client_id: str | None = None,
        examiner_id: str | None = None,
        mine: bool = False,
        search: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> ExaminationListWithNamesResponse:
        # 권한: clinician은 본인이 examiner인 검사만 강제. admin/researcher는 examiner_id/mine 옵션 사용.
        if ctx.role == "clinician" or mine:
            effective_examiner = ctx.member_id
        else:
            effective_examiner = examiner_id

        repo = self._uow.repo(ExaminationRepository)
        return await ListExaminationsWithNamesService(repo).execute(
            ctx.institution_id, page=page, size=size,
            status=status, exam_type=exam_type,
            client_id=client_id, examiner_id=effective_examiner,
            search=search, date_from=date_from, date_to=date_to,
        )

    async def get_examination(
        self,
        ctx: InstitutionContext,
        exam_id: str,
    ) -> ExaminationResponse:
        repo = self._uow.repo(ExaminationRepository)
        exam = await GetExaminationService(repo).fetch(
            exam_id,
            ctx.institution_id,
            require_examiner_id=ctx.member_id if ctx.role == "clinician" else None,
        )
        result = ExaminationResponse.model_validate(exam)
        # 단계 진입 판정에 쓰이므로 상세 조회에는 항상 실어 보낸다.
        # status만으로는 "수집이 끝났는지"를 알 수 없다(progress.py 참고).
        result.progress = await GetExamProgressService(self._uow).execute(exam)
        return result

    async def create_examination(
        self,
        ctx: InstitutionContext,
        data: ExaminationCreate,
        client_info: ClientInfo,
    ) -> ExaminationResponse:
        repo = self._uow.repo(ExaminationRepository)
        result = await CreateExaminationService(repo).execute(
            ctx.institution_id,
            data,
            require_examiner_id=ctx.member_id if ctx.role == "clinician" else None,
        )
        await self._audit_logger().log(
            action="create",
            entity_type="examination",
            entity_id=result.id,
            actor_id=ctx.account_id,
            actor_email=ctx.email,
            actor_role=ctx.role,
            institution_id=ctx.institution_id,
            ip_address=client_info.ip_address,
            user_agent=client_info.user_agent,
            new_value=result.model_dump(mode="json"),
        )

        # 알림: 새 검사가 다른 멤버에게 할당되면 발송
        await self._notifier().publish(
            institution_id=ctx.institution_id,
            recipient_member_id=result.examiner_id,
            type="examination.assigned",
            title="새 검사가 할당되었습니다",
            entity_type="examination",
            entity_id=result.id,
            link_path=f"/examinations/{result.id}",
            actor_member_id=ctx.member_id,
            skip_self=True,
        )
        return result

    async def create_battery(
        self,
        ctx: InstitutionContext,
        data: ExaminationBatteryCreate,
        client_info: ClientInfo,
    ) -> ExaminationBatteryResponse:
        battery_repo = self._uow.repo(ExaminationBatteryRepository)
        exam_repo = self._uow.repo(ExaminationRepository)
        result = await CreateBatteryService(battery_repo, exam_repo).execute(
            ctx.institution_id,
            data,
            require_examiner_id=ctx.member_id if ctx.role == "clinician" else None,
        )

        await self._audit_logger().log(
            action="create",
            entity_type="examination_battery",
            entity_id=result.id,
            actor_id=ctx.account_id,
            actor_email=ctx.email,
            actor_role=ctx.role,
            institution_id=ctx.institution_id,
            ip_address=client_info.ip_address,
            user_agent=client_info.user_agent,
            new_value=result.model_dump(mode="json"),
            metadata={
                "exam_types": [e.exam_type for e in result.examinations],
                "exam_ids": [e.id for e in result.examinations],
                "count": len(result.examinations),
            },
        )

        # 알림: 배터리 할당 (검사자에게 1회)
        await self._notifier().publish(
            institution_id=ctx.institution_id,
            recipient_member_id=result.examiner_id,
            type="examination.assigned",
            title="새 검사 배터리가 할당되었습니다",
            body=f"{len(result.examinations)}개 검사가 등록되었습니다.",
            entity_type="examination_battery",
            entity_id=result.id,
            link_path="/examinations",
            actor_member_id=ctx.member_id,
            skip_self=True,
        )
        return result

    async def update_examination(
        self,
        ctx: InstitutionContext,
        exam_id: str,
        data: ExaminationUpdate,
        client_info: ClientInfo,
    ) -> ExaminationResponse:
        repo = self._uow.repo(ExaminationRepository)
        require_examiner = ctx.member_id if ctx.role == "clinician" else None
        # GetExaminationService가 institution 권한도 검증 — Service 일관 호출
        old_response = await GetExaminationService(repo).execute(
            exam_id,
            ctx.institution_id,
            require_examiner_id=require_examiner,
        )
        old_status = old_response.status
        old_snapshot = old_response.model_dump(mode="json")

        result = await UpdateExaminationService(repo).execute(
            exam_id,
            ctx.institution_id,
            data,
            require_examiner_id=require_examiner,
        )

        is_state_change = (
            data.status is not None and data.status != old_status
        )
        await self._audit_logger().log(
            action="state_change" if is_state_change else "update",
            entity_type="examination",
            entity_id=exam_id,
            actor_id=ctx.account_id,
            actor_email=ctx.email,
            actor_role=ctx.role,
            institution_id=ctx.institution_id,
            ip_address=client_info.ip_address,
            user_agent=client_info.user_agent,
            old_value=old_snapshot,
            new_value=result.model_dump(mode="json"),
            metadata={"from": old_status, "to": data.status} if is_state_change else None,
        )

        # 알림: confirmed 전이 시 검사 담당자에게 발송 (본인이 직접 확정한 경우 생략)
        if is_state_change and data.status == "confirmed":
            await self._notifier().publish(
                institution_id=ctx.institution_id,
                recipient_member_id=result.examiner_id,
                type="examination.confirmed",
                title="검사 결과가 확정되었습니다",
                entity_type="examination",
                entity_id=exam_id,
                link_path=f"/examinations/{exam_id}/{result.exam_type}/results",
                actor_member_id=ctx.member_id,
                skip_self=True,
            )
        return result

    async def get_dashboard_stats(
        self, ctx: InstitutionContext
    ) -> DashboardStats:
        repo = self._uow.repo(ExaminationRepository)
        return await GetDashboardStatsService(repo).execute(
            ctx.institution_id,
            examiner_id=ctx.member_id if ctx.role == "clinician" else None,
        )
