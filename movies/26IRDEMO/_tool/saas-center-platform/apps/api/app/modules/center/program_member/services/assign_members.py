from app.core.exceptions import ConflictException

from ..events import ProgramMemberAtomic
from ..models import ProgramMember
from ..repository import ProgramMemberRepository


class AssignMembersService:
    def __init__(self, repo: ProgramMemberRepository):
        self.repo = repo

    async def execute(
        self,
        program_id: str,
        center_id: str,
        member_ids: list[str],
    ) -> tuple[list[ProgramMemberAtomic], list[ProgramMember]]:
        # verify
        existing = await self.repo.list_existing_member_ids(
            program_id=program_id,
            member_ids=member_ids,
        )
        if existing:
            raise ConflictException(f"Members already assigned: {', '.join(existing)}")

        # assign
        created = []
        for member_id in member_ids:
            soft_deleted = await self.repo.find_deleted_only(
                program_id=program_id,
                member_id=member_id,
            )
            if soft_deleted:
                restored = await self.repo.restore_by_id(id=soft_deleted.id)
                created.append(restored)
            else:
                pm = await self.repo.add(
                    center_id=center_id,
                    program_id=program_id,
                    member_id=member_id,
                )
                created.append(pm)

        atomics = [ProgramMemberAtomic.assigned(program_member=pm)[0] for pm in created]
        return atomics, created
