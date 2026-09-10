from ..events import ProgramMemberAtomic
from ..repository import ProgramMemberRepository
from ..models import ProgramMember


# member_ids를 최종 상태로 간주해 추가분은 배정(soft-deleted면 복원), 빠진 멤버는 해제. 빈 목록 = 전원 해제.
class BulkAssignMembersService:
    def __init__(
        self,
        repo: ProgramMemberRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        program_id: str,
        center_id: str,
        member_ids: list[str],
    ) -> tuple[list[ProgramMemberAtomic], list[ProgramMember]]:
        target = list(dict.fromkeys(member_ids))
        target_set = set(target)

        current = await self.repo.list_by_program(program_id)
        current_by_id = {pm.member_id: pm for pm in current}

        atomics: list[ProgramMemberAtomic] = []
        for pm in current:
            if pm.member_id not in target_set:
                removed = await self.repo.remove_by_id(id=pm.id)
                if removed:
                    atomic, _ = ProgramMemberAtomic.unassigned(program_member=removed)
                    atomics.append(atomic)

        result: list[ProgramMember] = []
        for member_id in target:
            existing = current_by_id.get(member_id)
            if existing:
                result.append(existing)
                continue

            soft_deleted = await self.repo.find_deleted_only(program_id, member_id)
            if soft_deleted:
                restored = await self.repo.restore_by_id(id=soft_deleted.id)
                assert restored is not None
                atomic, pm_model = ProgramMemberAtomic.assigned(program_member=restored)
            else:
                atomic, pm_model = ProgramMemberAtomic.assigned(
                    program_member=await self.repo.add(
                        center_id=center_id,
                        program_id=program_id,
                        member_id=member_id,
                    )
                )
            atomics.append(atomic)
            result.append(pm_model)

        return atomics, result
