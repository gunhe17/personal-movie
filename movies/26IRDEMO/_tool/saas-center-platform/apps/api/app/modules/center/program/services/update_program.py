from app.core.exceptions import ConflictException
from ..events import ProgramAtomic
from ..repository import ProgramRepository
from ..models import Program


class UpdateProgramService:
    def __init__(self, repo: ProgramRepository):
        self.repo = repo

    async def execute(
        self,
        program_id: str,
        center_id: str,
        changed: dict | None = None,
        name: str | None = None,
        program_type: str | None = None,
        description: str | None = None,
        price: int | None = None,
        duration_minutes: int | None = None,
        is_active: bool | None = None,
    ) -> tuple[ProgramAtomic, Program]:
        # load
        program = await self.repo.get_in_center(program_id=program_id, center_id=center_id)

        # update
        update_data: dict = {}
        if name is not None:
            update_data["name"] = name
        if program_type is not None:
            update_data["program_type"] = program_type
        if description is not None:
            update_data["description"] = description
        if price is not None:
            update_data["price"] = price
        if duration_minutes is not None:
            update_data["duration_minutes"] = duration_minutes
        if is_active is not None:
            update_data["is_active"] = is_active

        new_name = update_data.get("name", program.name)
        new_type = update_data.get("program_type", program.program_type)
        if new_name != program.name or new_type != program.program_type:
            existing = await self.repo.find_by_name_and_type(
                center_id=center_id,
                name=new_name,
                program_type=new_type,
            )
            if existing and existing.id != program.id:
                raise ConflictException(
                    f"같은 유형의 프로그램 이름이 이미 존재합니다: {new_name}"
                )

        if not update_data:
            return ProgramAtomic.updated(program=program, changed=changed or {})

        # return
        updated = await self.repo.update_in_place(program.id, **update_data)
        assert updated is not None
        return ProgramAtomic.updated(program=updated, changed=changed or {})
