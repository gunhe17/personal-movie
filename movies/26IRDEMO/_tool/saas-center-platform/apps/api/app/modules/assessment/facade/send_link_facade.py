from dataclasses import dataclass

from app.core.config import settings
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..assessment.repository import AssessmentRepository
from ..assessment.services import (
    GetAssessmentsByIdsService,
    ValidateOnlineSupportService,
)
from ..assessment_task.models import AssessmentTask
from ..assessment_task.repository import AssessmentTaskRepository
from ..assessment_task.services import ListTasksByCaseService
from ..send_link.events import SendLinkAtomic
from ..send_link.models import AssessmentSendLink
from ..send_link.repository import AssessmentSendLinkRepository
from ..send_link.schemas import SendLinkCreate
from ..send_link.services import (
    CreateSendLinkService,
    GetActivePublicSendLinkService,
    GetSendLinkService,
    ListSendLinksService,
    ListSendLinksByCenterService,
    VerifySendLinkService,
)


@dataclass
class VerifiedLinkTasks:
    send_link: AssessmentSendLink
    tasks: list[AssessmentTask]
    assessment_names: dict[str, str]  # assessment_id → kor_name


class SendLinkFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def _validate_online_support(self, assessment_ids: list[str]) -> None:
        repo = self._uow.repo(AssessmentRepository)
        await ValidateOnlineSupportService(repo).execute(assessment_ids)

    async def create_send_link(
        self,
        center_id: str,
        case_id: str,
        data: SendLinkCreate,
    ) -> tuple[SendLinkAtomic, AssessmentSendLink]:
        await self._validate_online_support(data.assessment_ids)

        repo = self._uow.repo(AssessmentSendLinkRepository)
        service = CreateSendLinkService(repo)
        return await service.execute(
            center_id=center_id,
            case_id=case_id,
            recipients=[r.model_dump() for r in data.recipients],
            assessment_ids=data.assessment_ids,
            channel=data.channel.value,
            expires_at=data.expires_at,
        )

    async def get_send_link(
        self,
        center_id: str,
        case_id: str,
        send_link_id: str,
        validate_active: bool = False,
    ) -> AssessmentSendLink:
        repo = self._uow.repo(AssessmentSendLinkRepository)
        service = GetSendLinkService(repo)
        return await service.execute(center_id, case_id, send_link_id, validate_active)

    async def list_send_links(
        self,
        center_id: str,
        case_id: str,
    ) -> list[AssessmentSendLink]:
        repo = self._uow.repo(AssessmentSendLinkRepository)
        service = ListSendLinksService(repo)
        return await service.execute(center_id, case_id)

    async def list_by_center(self, center_id: str, page: int, size: int):
        repo = self._uow.repo(AssessmentSendLinkRepository)
        return await ListSendLinksByCenterService(repo).execute(
            center_id, page=page, size=size
        )

    async def verify_and_collect_tasks(
        self,
        send_link_id: str,
        verification_code: str,
    ) -> VerifiedLinkTasks:
        repo = self._uow.repo(AssessmentSendLinkRepository)
        send_link = await VerifySendLinkService(repo).execute(
            send_link_id=send_link_id,
            verification_code=verification_code,
        )

        return await self.collect_tasks(send_link)

    async def collect_tasks(self, send_link: AssessmentSendLink) -> VerifiedLinkTasks:
        task_repo = self._uow.repo(AssessmentTaskRepository)
        all_tasks = await ListTasksByCaseService(task_repo).execute(
            case_id=send_link.case_id
        )
        link_assessment_ids = set(send_link.assessment_ids)
        tasks = [t for t in all_tasks if t.assessment_id in link_assessment_ids]

        assessment_repo = self._uow.repo(AssessmentRepository)
        assessments = await GetAssessmentsByIdsService(assessment_repo).execute(
            list(link_assessment_ids)
        )
        names = {a.id: a.kor_name for a in assessments}

        return VerifiedLinkTasks(
            send_link=send_link, tasks=tasks, assessment_names=names
        )

    async def get_active_link_public(self, send_link_id: str) -> AssessmentSendLink:
        repo = self._uow.repo(AssessmentSendLinkRepository)
        return await GetActivePublicSendLinkService(repo).execute(
            send_link_id=send_link_id
        )

    @staticmethod
    def build_url(send_link_id: str) -> str:
        base_url = settings.ONLINE_ASSESSMENT_BASE_URL
        if not base_url:
            base_url = f"{settings.FRONTEND_URL}/verify-link"
        return f"{base_url}?send_link_id={send_link_id}"
