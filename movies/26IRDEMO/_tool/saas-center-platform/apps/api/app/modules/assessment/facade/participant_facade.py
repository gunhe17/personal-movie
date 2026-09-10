from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..assessment_case_participant.events import AssessmentCaseParticipantAtomic
from ..assessment_case_participant.repository import AssessmentCaseParticipantRepository
from ..assessment_case_participant.services import (
    GetCaseParticipantsByCaseIdsService,
    UnassignCaseParticipantsService,
    CreateCaseParticipantSimpleService,
    ListCaseIdsByClientIdsService,
)


class AssessmentCaseParticipantFacade:
    def __init__(
        self,
        uow: UnitOfWork,
    ):
        self._uow = uow

    async def get_participants_by_case_ids(
        self,
        case_ids: list[str],
    ):
        repo = self._uow.repo(AssessmentCaseParticipantRepository)
        service = GetCaseParticipantsByCaseIdsService(repo)
        return await service.execute(case_ids)

    async def list_case_ids_by_client_ids(
        self,
        center_id: str,
        client_ids: list[str],
    ) -> list[str]:
        repo = self._uow.repo(AssessmentCaseParticipantRepository)
        return await ListCaseIdsByClientIdsService(repo).execute(
            center_id=center_id,
            client_ids=client_ids,
        )

    async def unassign_participants(
        self,
        case_id: str,
        participants_to_unassign: list[dict],
    ) -> tuple[list[AssessmentCaseParticipantAtomic], list[dict]]:
        repo = self._uow.repo(AssessmentCaseParticipantRepository)
        service = UnassignCaseParticipantsService(repo)
        return await service.execute(case_id, participants_to_unassign)

    async def add_participants(
        self,
        center_id: str,
        case_id: str,
        participants_to_add: list[dict],
    ) -> tuple[list[AssessmentCaseParticipantAtomic], list[dict]]:
        repo = self._uow.repo(AssessmentCaseParticipantRepository)
        service = CreateCaseParticipantSimpleService(repo)
        atomics: list[AssessmentCaseParticipantAtomic] = []
        added = []

        for p in participants_to_add:
            atomic, _ = await service.execute(
                center_id=center_id,
                case_id=case_id,
                participant_type=p["type"],
                participant_id=p["id"],
            )
            atomics.append(atomic)
            added.append(p)

        return atomics, added
