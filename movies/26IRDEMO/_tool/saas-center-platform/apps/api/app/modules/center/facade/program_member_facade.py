from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.persistence.new_repository import single_page
from ..program.repository import ProgramRepository
from ..program.services import GetProgramService
from ..program_member.events import ProgramMemberAtomic
from ..program_member.models import ProgramMember
from ..program_member.repository import ProgramMemberRepository
from ..program_member.schemas import ProgramMemberResponse, ProgramMemberListResponse
from ..program_member.services import (
    AssignMembersService,
    UnassignMemberService,
    ListProgramMembersService,
)


class ProgramMemberFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def _get_program_service(self) -> GetProgramService:
        repo = self._uow.repo(ProgramRepository)
        return GetProgramService(repo)

    async def assign_members(
        self,
        center_id: str,
        program_id: str,
        member_ids: list[str],
    ) -> tuple[list[ProgramMemberAtomic], list]:
        await self._get_program_service().execute(program_id, center_id)

        repo = self._uow.repo(ProgramMemberRepository)
        service = AssignMembersService(repo)
        return await service.execute(program_id, center_id, member_ids)

    async def assign_with_response(
        self,
        center_id: str,
        program_id: str,
        member_ids: list[str],
    ) -> tuple[list[ProgramMemberAtomic], ProgramMemberListResponse]:
        await self._get_program_service().execute(program_id, center_id)

        repo = self._uow.repo(ProgramMemberRepository)
        service = AssignMembersService(repo)
        atomics, created = await service.execute(program_id, center_id, member_ids)

        return atomics, ProgramMemberListResponse(
            items=[ProgramMemberResponse.model_validate(pm) for pm in created],
            **single_page(created),
        )

    async def list_with_response(
        self,
        center_id: str,
        program_id: str,
    ) -> ProgramMemberListResponse:
        await self._get_program_service().execute(program_id, center_id)

        repo = self._uow.repo(ProgramMemberRepository)
        service = ListProgramMembersService(repo)
        members = await service.execute(program_id)

        return ProgramMemberListResponse(
            items=[ProgramMemberResponse.model_validate(pm) for pm in members],
            **single_page(members),
        )

    async def unassign(
        self,
        center_id: str,
        program_id: str,
        member_id: str,
    ) -> tuple[ProgramMemberAtomic, ProgramMember]:
        repo = self._uow.repo(ProgramMemberRepository)
        service = UnassignMemberService(repo)
        return await service.execute(program_id, member_id, center_id)
