from datetime import date

from app.core.type import unset
from ..events import MemberAtomic
from ..repository import MemberRepository
from ..models import Member


class UpdateMemberService:
    def __init__(self, repo: MemberRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        member_id: str,
        center_id: str,
        changed: dict | None = None,
        role_id: str = unset,
        employment_type: str | None = unset,
        hire_date: date | None = unset,
        profile_image_url: str | None = unset,
        memo: str | None = unset,
        careers: list[str] | None = unset,
        educations: list[str] | None = unset,
        certifications: list[str] | None = unset,
    ) -> tuple[MemberAtomic, Member]:
        # load
        member = await self.repo.get_in_center(member_id=member_id, center_id=center_id)

        # build
        update_data = {
            k: v
            for k, v in {
                "role_id": role_id,
                "employment_type": employment_type,
                "hire_date": hire_date,
                "profile_image_url": profile_image_url,
                "memo": memo,
                "careers": careers,
                "educations": educations,
                "certifications": certifications,
            }.items()
            if v is not unset
        }

        # guard
        if not update_data:
            return MemberAtomic.updated(member=member, changed=changed)

        # return
        updated = await self.repo.update_in_place(member_id, **update_data)
        assert updated is not None
        return MemberAtomic.updated(member=updated, changed=changed)
