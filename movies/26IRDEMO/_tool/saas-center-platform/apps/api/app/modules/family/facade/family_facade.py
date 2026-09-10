from datetime import date, datetime

from app.core.type import unset
from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..family.models import Family
from ..family.repository import FamilyRepository
from ..family.services import CreateFamilyService, GetFamilyService
from ..family_member.models import FamilyMember
from ..family_member.repository import FamilyMemberRepository
from ..family_member.services import (
    AddFamilyMemberService,
    FindMembershipByPersonService,
    ListFamilyMembersService,
    RemoveFamilyMemberService,
)
from ..invitation.models import FamilyInvitation
from ..invitation.repository import FamilyInvitationRepository
from ..invitation.services import (
    ClaimFamilyInvitationService,
    GetValidFamilyInvitationService,
    IssueFamilyInvitationService,
)
from ..profile.models import Profile
from ..profile.repository import ProfileRepository
from ..profile.services import (
    CreateProfileService,
    GetProfileService,
    ListProfilesService,
    RemoveProfileService,
    UpdateProfileService,
)


class FamilyFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def ensure_family(self, *, person_id: str) -> Family:
        member_repo = self._uow.repo(FamilyMemberRepository)
        family_repo = self._uow.repo(FamilyRepository)

        membership = await FindMembershipByPersonService(member_repo).execute(
            person_id=person_id
        )
        if membership is not None:
            return await GetFamilyService(family_repo).execute(
                family_id=membership.family_id
            )

        family = await CreateFamilyService(family_repo).execute()
        await AddFamilyMemberService(member_repo).execute(
            family_id=family.id,
            person_id=person_id,
            role="owner",
        )
        return family

    async def find_family_id(self, *, person_id: str) -> str | None:
        membership = await FindMembershipByPersonService(
            self._uow.repo(FamilyMemberRepository)
        ).execute(person_id=person_id)
        return membership.family_id if membership else None

    async def find_membership(self, *, person_id: str) -> FamilyMember | None:
        return await FindMembershipByPersonService(
            self._uow.repo(FamilyMemberRepository)
        ).execute(person_id=person_id)

    async def list_members(self, *, family_id: str) -> list[FamilyMember]:
        return await ListFamilyMembersService(
            self._uow.repo(FamilyMemberRepository)
        ).execute(family_id=family_id)

    async def add_member(
        self, *, family_id: str, person_id: str, role: str = "member"
    ) -> FamilyMember:
        return await AddFamilyMemberService(
            self._uow.repo(FamilyMemberRepository)
        ).execute(family_id=family_id, person_id=person_id, role=role)

    async def remove_member(self, *, member_id: str) -> FamilyMember | None:
        return await RemoveFamilyMemberService(
            self._uow.repo(FamilyMemberRepository)
        ).execute(member_id=member_id)

    async def issue_invitation(
        self, *, family_id: str, invited_by_person_id: str, now: datetime
    ) -> FamilyInvitation:
        return await IssueFamilyInvitationService(
            self._uow.repo(FamilyInvitationRepository)
        ).execute(
            family_id=family_id,
            invited_by_person_id=invited_by_person_id,
            now=now,
        )

    async def get_valid_invitation(self, *, code: str, now: datetime) -> FamilyInvitation:
        return await GetValidFamilyInvitationService(
            self._uow.repo(FamilyInvitationRepository)
        ).execute(code=code, now=now)

    async def claim_invitation(
        self, *, invitation_id: str, person_id: str, now: datetime
    ) -> FamilyInvitation | None:
        return await ClaimFamilyInvitationService(
            self._uow.repo(FamilyInvitationRepository)
        ).execute(invitation_id=invitation_id, person_id=person_id, now=now)

    async def create_profile(
        self,
        *,
        family_id: str,
        display_name: str,
        relation: str = "child",
        birth_date: date | None = None,
        gender: str | None = None,
        image_url: str | None = None,
    ) -> Profile:
        return await CreateProfileService(self._uow.repo(ProfileRepository)).execute(
            family_id=family_id,
            display_name=display_name,
            relation=relation,
            birth_date=birth_date,
            gender=gender,
            image_url=image_url,
        )

    async def get_profile(self, *, profile_id: str, family_id: str) -> Profile:
        return await GetProfileService(self._uow.repo(ProfileRepository)).execute(
            profile_id=profile_id,
            family_id=family_id,
        )

    async def list_profiles(self, *, family_id: str) -> list[Profile]:
        return await ListProfilesService(self._uow.repo(ProfileRepository)).execute(
            family_id=family_id
        )

    async def update_profile(
        self,
        *,
        profile_id: str,
        family_id: str,
        display_name: str = unset,
        birth_date: date | None = unset,
        gender: str | None = unset,
        image_url: str | None = unset,
    ) -> Profile:
        return await UpdateProfileService(self._uow.repo(ProfileRepository)).execute(
            profile_id=profile_id,
            family_id=family_id,
            display_name=display_name,
            birth_date=birth_date,
            gender=gender,
            image_url=image_url,
        )

    async def remove_profile(self, *, profile_id: str, family_id: str) -> Profile | None:
        return await RemoveProfileService(self._uow.repo(ProfileRepository)).execute(
            profile_id=profile_id,
            family_id=family_id,
        )
