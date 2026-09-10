from app.core.exceptions import ConflictException
from ..events import ProgramAtomic
from ..repository import ProgramRepository
from ..models import Program


class CreateProgramService:
    def __init__(self, repo: ProgramRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        name: str,
        program_type: str,
        price: int,
        duration_minutes: int,
        description: str | None = None,
    ) -> tuple[ProgramAtomic, Program]:
        # verify
        existing = await self.repo.find_by_name_and_type(
            center_id=center_id,
            name=name,
            program_type=program_type,
        )
        if existing:
            raise ConflictException(
                f"같은 유형의 프로그램 이름이 이미 존재합니다: {name}"
            )

        # return
        program = await self.repo.add(
            center_id=center_id,
            name=name,
            program_type=program_type,
            price=price,
            duration_minutes=duration_minutes,
            description=description,
        )
        return ProgramAtomic.created(program=program)
