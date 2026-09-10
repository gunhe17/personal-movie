from app.core.exceptions import InvalidOperationException
from ..events import MemberAtomic
from ..repository import MemberRepository
from ..models import Member


class ActivateMemberService:
    def __init__(
        self,
        repo: MemberRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        member: Member,
    ) -> tuple[MemberAtomic, Member]:
        # verify
        if member.status == "active":
            raise InvalidOperationException("이미 active 상태입니다")
        if member.status != "inactive":
            raise InvalidOperationException(
                f"'{member.status}' → 'active' 전환은 허용되지 않습니다."
            )

        # update
        member = await self.repo.update_in_place(id=member.id, status="active")

        # return
        return MemberAtomic.updated(member=member, changed={"status": "active"})
