from app.core.exceptions import InvalidOperationException
from ..events import MemberAtomic
from ..repository import MemberRepository
from ..models import Member


class DeactivateMemberService:
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
        if member.status == "inactive":
            raise InvalidOperationException("이미 inactive 상태입니다")
        if member.status != "active":
            raise InvalidOperationException(
                f"'{member.status}' → 'inactive' 전환은 허용되지 않습니다."
            )

        # update
        member = await self.repo.update_in_place(id=member.id, status="inactive")

        # return
        return MemberAtomic.updated(member=member, changed={"status": "inactive"})
