import math

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..program.events import ProgramAtomic
from ..program.repository import ProgramRepository
from ..program.models import Program
from ..program.schemas import ProgramResponse, ProgramListResponse, ProgramSummary
from ..program.services import (
    CreateProgramService,
    GetProgramService,
    GetProgramsByIdsService,
    ListProgramsService,
    UpdateProgramService,
    DeleteProgramService,
    ListProgramsByNameService,
)
from ..program_member.repository import ProgramMemberRepository
from ..program_member.models import ProgramMember
from ..program_member.services import ListByProgramIdsService


class ProgramFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def lookup_agent_ref(self, center_id: str, value: str) -> dict | None:
        ids = await self.list_program_ids_by_name(center_id, value)
        if not ids:
            return None
        programs = await self.get_programs_by_ids(ids[:1])
        program = programs.get(ids[0])
        if not program:
            return None
        return {"id": program.id, "name": program.name}

    async def create_program(
        self,
        center_id: str,
        name: str,
        program_type: str,
        price: int,
        duration_minutes: int,
        description: str | None = None,
    ) -> tuple[ProgramAtomic, Program]:
        repo = self._uow.repo(ProgramRepository)
        service = CreateProgramService(repo)
        return await service.execute(
            center_id=center_id,
            name=name,
            program_type=program_type,
            price=price,
            duration_minutes=duration_minutes,
            description=description,
        )

    async def get_programs_by_ids(self, program_ids: list[str]) -> dict[str, Program]:
        repo = self._uow.repo(ProgramRepository)
        service = GetProgramsByIdsService(repo)
        return await service.execute(program_ids)

    async def get_program_summaries_by_ids(
        self, program_ids: list[str]
    ) -> dict[str, str]:
        if not program_ids:
            return {}
        program_map = await self.get_programs_by_ids(program_ids)
        return {pid: program.name for pid, program in program_map.items()}

    async def find_program(self, program_id: str) -> Program | None:
        result = await self.get_programs_by_ids([program_id])
        return result.get(program_id)

    async def list_programs(
        self, center_id: str, skip: int, limit: int
    ) -> tuple[list[Program], int]:
        repo = self._uow.repo(ProgramRepository)
        service = ListProgramsService(repo)
        return await service.execute(center_id, skip, limit)

    async def list_program_ids_by_name(
        self,
        center_id: str,
        name: str,
    ) -> list[str]:
        repo = self._uow.repo(ProgramRepository)
        service = ListProgramsByNameService(repo)
        programs = await service.execute(center_id, name)
        return [p.id for p in programs]

    async def list_program_ids_by_type(
        self,
        center_id: str,
        program_type: str,
    ) -> list[str]:
        from ..program.services import ListProgramIdsByTypeService

        repo = self._uow.repo(ProgramRepository)
        service = ListProgramIdsByTypeService(repo)
        return await service.execute(center_id, program_type)

    async def get_members_by_program_ids(
        self, program_ids: list[str]
    ) -> dict[str, list[ProgramMember]]:
        repo = self._uow.repo(ProgramMemberRepository)
        service = ListByProgramIdsService(repo)
        return await service.execute(program_ids)

    async def create(
        self,
        center_id: str,
        name: str,
        program_type: str,
        price: int,
        duration_minutes: int,
        description: str | None = None,
    ) -> tuple[ProgramAtomic, Program]:
        repo = self._uow.repo(ProgramRepository)
        service = CreateProgramService(repo)
        return await service.execute(
            center_id=center_id,
            name=name,
            program_type=program_type,
            price=price,
            duration_minutes=duration_minutes,
            description=description,
        )

    async def get_with_response(
        self, center_id: str, program_id: str
    ) -> ProgramResponse:
        repo = self._uow.repo(ProgramRepository)
        service = GetProgramService(repo)
        program = await service.execute(program_id, center_id)
        return ProgramResponse.model_validate(program)

    async def list_with_response(
        self,
        center_id: str,
        offset: int = 0,
        limit: int = 20,
        skip: int | None = None,
        page: int | None = None,
        size: int | None = None,
    ) -> ProgramListResponse:
        limit = min(limit, 50)
        if skip is None:
            skip = offset
        if page is None:
            page = offset // limit + 1 if limit else 1
        if size is None:
            size = limit
        repo = self._uow.repo(ProgramRepository)
        service = ListProgramsService(repo)
        programs, total = await service.execute(center_id, skip, limit)

        return ProgramListResponse(
            items=[ProgramSummary.model_validate(p) for p in programs],
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if total > 0 else 0,
        )

    async def update(
        self,
        center_id: str,
        program_id: str,
        name: str | None = None,
        program_type: str | None = None,
        description: str | None = None,
        price: int | None = None,
        duration_minutes: int | None = None,
        is_active: bool | None = None,
        changed: dict | None = None,
    ) -> tuple[ProgramAtomic, Program]:
        repo = self._uow.repo(ProgramRepository)
        service = UpdateProgramService(repo)
        return await service.execute(
            program_id=program_id,
            center_id=center_id,
            changed=changed,
            name=name,
            program_type=program_type,
            description=description,
            price=price,
            duration_minutes=duration_minutes,
            is_active=is_active,
        )

    async def delete(
        self, center_id: str, program_id: str
    ) -> tuple[ProgramAtomic, Program]:
        repo = self._uow.repo(ProgramRepository)
        service = DeleteProgramService(repo)
        return await service.execute(program_id, center_id)
