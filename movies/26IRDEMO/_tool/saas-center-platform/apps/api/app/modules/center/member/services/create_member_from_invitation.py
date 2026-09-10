from ..events import MemberAtomic
from ..repository import MemberRepository
from ..models import Member


class CreateMemberFromInvitationService:
    def __init__(self, repo: MemberRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        person_id: str,
        role_id: str,
        employment_type: str,
        color: str | None = None,
        profile_image_url: str | None = None,
    ) -> tuple[MemberAtomic, Member]:
        # verify
        existing = await self.repo.find_by_person(
            center_id=center_id,
            person_id=person_id,
        )
        if existing:
            raise ValueError("이미 해당 센터의 멤버입니다")

        # create
        member = await self.repo.add(
            center_id=center_id,
            person_id=person_id,
            role_id=role_id,
            employment_type=employment_type,
            color=color,
            profile_image_url=profile_image_url,
        )

        # return
        return MemberAtomic.created(member=member)
