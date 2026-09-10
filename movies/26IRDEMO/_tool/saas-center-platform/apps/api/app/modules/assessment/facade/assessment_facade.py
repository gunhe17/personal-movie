from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..assessment.repository import AssessmentRepository
from ..assessment.models import Assessment
from ..assessment.services import (
    GetAssessmentService,
    GetAssessmentsByIdsService,
    GetAllAssessmentIdsService,
    CreateAssessmentService,
    UpdateAssessmentService,
)
from ..center_assessment.events import CenterAssessmentAtomic
from ..center_assessment.models import CenterAssessment
from ..center_assessment.repository import CenterAssessmentRepository
from ..center_assessment.services import (
    InitializeCenterAssessmentsService,
    ListCenterAssessmentsService,
    AssignCenterAssessmentService,
    UpdateCenterAssessmentService,
    UnassignCenterAssessmentService,
)


class AssessmentFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def get_assessments_by_ids(
        self, assessment_ids: list[str]
    ) -> list[Assessment]:
        if not assessment_ids:
            return []

        repo = self._uow.repo(AssessmentRepository)
        service = GetAssessmentsByIdsService(repo)
        return await service.execute(assessment_ids)

    async def get_assessment_summaries_by_ids(
        self, assessment_ids: list[str]
    ) -> dict[str, str]:
        assessments = await self.get_assessments_by_ids(assessment_ids)
        return {a.id: a.kor_name for a in assessments}

    async def initialize_center_assessments(
        self,
        center_id: str,
    ) -> tuple[list[CenterAssessmentAtomic], list[CenterAssessment]]:
        assessment_repo = self._uow.repo(AssessmentRepository)
        get_ids_service = GetAllAssessmentIdsService(assessment_repo)
        assessment_ids = await get_ids_service.execute()

        ca_repo = self._uow.repo(CenterAssessmentRepository)
        init_service = InitializeCenterAssessmentsService(ca_repo)
        return await init_service.execute(center_id, assessment_ids)

    async def create_assessment(self, **fields) -> Assessment:
        repo = self._uow.repo(AssessmentRepository)
        return await CreateAssessmentService(repo).execute(**fields)

    async def update_assessment(self, assessment_id: str, **fields) -> Assessment:
        repo = self._uow.repo(AssessmentRepository)
        return await UpdateAssessmentService(repo).execute(assessment_id, **fields)

    async def assign_center_assessment(
        self,
        center_id: str,
        assessment_id: str,
    ) -> tuple[CenterAssessmentAtomic, CenterAssessment]:
        await GetAssessmentService(self._uow.repo(AssessmentRepository)).execute(
            assessment_id
        )
        ca_repo = self._uow.repo(CenterAssessmentRepository)
        atomic, entity = await AssignCenterAssessmentService(ca_repo).execute(
            center_id, assessment_id
        )
        return atomic, entity

    async def toggle_center_assessment(
        self,
        center_id: str,
        assessment_id: str,
        is_active: bool,
    ) -> tuple[CenterAssessmentAtomic, CenterAssessment]:
        ca_repo = self._uow.repo(CenterAssessmentRepository)
        atomic, entity = await UpdateCenterAssessmentService(ca_repo).execute(
            center_id, assessment_id, is_active
        )
        return atomic, entity

    async def unassign_center_assessment(
        self,
        center_id: str,
        assessment_id: str,
    ) -> tuple[CenterAssessmentAtomic, CenterAssessment]:
        ca_repo = self._uow.repo(CenterAssessmentRepository)
        return await UnassignCenterAssessmentService(ca_repo).execute(
            center_id, assessment_id
        )
