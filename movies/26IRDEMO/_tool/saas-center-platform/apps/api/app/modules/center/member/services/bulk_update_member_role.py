from app.core.exceptions import EntityNotFoundException
from ..events import MemberAtomic
from ..repository import MemberRepository
from ..models import Member


class BulkUpdateMemberRoleService:
    def __init__(self, repo: MemberRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        member_ids: list[str],
        new_role_id: str,
    ) -> tuple[list[MemberAtomic], list[Member]]:
        # update
        members = await self.repo.update_role_by_ids(
            center_id=center_id,
            member_ids=member_ids,
            new_role_id=new_role_id,
        )

        # verify
        if len(members) != len(member_ids):
            found_ids = {m.id for m in members}
            missing_ids = [mid for mid in member_ids if mid not in found_ids]
            raise EntityNotFoundException(
                f"멤버를 찾을 수 없습니다: {', '.join(missing_ids)}"
            )

        # return
        atomics = [
            MemberAtomic.updated(member=m, changed={"role_id": new_role_id})[0]
            for m in members
        ]
        return atomics, members
