# [DEPRECATED] MemberFacade가 CreateMemberFromInvitationService를 사용하므로 미사용
from ..repository import MemberRepository
from ..models import Member


class CreateCenterAdminMemberService:
    def __init__(self, member_repo: MemberRepository):
        self.member_repo = member_repo

    async def execute(
        self,
        center_id: str,
        person_id: str,
        role_id: str,
    ) -> Member:
        # verify
        existing = await self.member_repo.find_by_person(
            center_id=center_id,
            person_id=person_id,
        )
        if existing:
            raise ValueError("이미 해당 센터의 멤버입니다")

        # create
        member = await self.member_repo.add(
            center_id=center_id,
            person_id=person_id,
            role_id=role_id,
            employment_type="FULLTIME",
        )

        # return
        return member
