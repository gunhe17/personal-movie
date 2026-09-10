from datetime import date

from app.core.type import unset
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..member.default_avatars import resolve_member_default_avatar
from ..member.events import MemberAtomic
from ..member.repository import MemberRepository
from ..member.schemas import MemberResponse
from ..member.services import (
    UpdateMemberService,
    ActivateMemberService,
    DeactivateMemberService,
    DeleteMembersByPersonService,
    GetMemberService,
    GetMembersByIdsService,
    ListMembersByPersonService,
    DeleteMemberService,
    CreateMemberFromInvitationService,
    CountMembersByRolesService,
    CountMembersByRoleService,
    BulkUpdateMemberRoleService,
    ListMembersByCenterService,
    LeaveCenterService,
)
from ..member.models import Member


class MemberFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def get_members_by_ids(self, member_ids: list[str]) -> dict[str, Member]:
        repo = self._uow.repo(MemberRepository)
        service = GetMembersByIdsService(repo)
        return await service.execute(member_ids)

    async def get_member_validated(self, member_id: str, center_id: str) -> Member:
        repo = self._uow.repo(MemberRepository)
        service = GetMemberService(repo)
        return await service.execute(member_id, center_id)

    async def list_by_person(self, person_id: str) -> list[Member]:
        repo = self._uow.repo(MemberRepository)
        service = ListMembersByPersonService(repo)
        return await service.execute(person_id)

    async def update_member(
        self,
        member_id: str,
        center_id: str,
        role_id: str = unset,
        employment_type: str | None = unset,
        hire_date: date | None = unset,
        memo: str | None = unset,
        profile_image_url: str | None = unset,
        careers: list[str] | None = unset,
        educations: list[str] | None = unset,
        certifications: list[str] | None = unset,
        changed: dict | None = None,
    ) -> tuple[MemberAtomic, Member]:
        repo = self._uow.repo(MemberRepository)

        # ADMIN 역할 보호(role_id 변경 차단)는 application handler가 선행.
        service = UpdateMemberService(repo)
        fields = {
            "role_id": role_id,
            "employment_type": employment_type,
            "hire_date": hire_date,
            "memo": memo,
            "profile_image_url": profile_image_url,
            "careers": careers,
            "educations": educations,
            "certifications": certifications,
        }
        return await service.execute(
            member_id=member_id,
            center_id=center_id,
            changed=changed
            if changed is not None
            else {
                key: value.isoformat() if isinstance(value, date) else value
                for key, value in fields.items()
                if value is not unset
            },
            **fields,
        )

    async def create_center_admin_member(
        self,
        center_id: str,
        person_id: str,
        role_id: str,
    ) -> tuple[MemberAtomic, Member]:
        repo = self._uow.repo(MemberRepository)

        from app.modules.center.member.services.assign_member_color import (
            AssignMemberColorService,
        )

        color_service = AssignMemberColorService(repo)
        color = await color_service.execute(center_id)

        service = CreateMemberFromInvitationService(repo)
        return await service.execute(
            center_id=center_id,
            person_id=person_id,
            role_id=role_id,
            employment_type="FULLTIME",
            color=color,
            profile_image_url=await resolve_member_default_avatar(self._uow, person_id),
        )

    async def count_members_by_roles(self, center_id: str) -> dict[str, int]:
        repo = self._uow.repo(MemberRepository)
        service = CountMembersByRolesService(repo)
        return await service.execute(center_id)

    async def count_members_by_role(self, center_id: str, role_id: str) -> int:
        repo = self._uow.repo(MemberRepository)
        service = CountMembersByRoleService(repo)
        return await service.execute(center_id, role_id)

    async def list_members_by_center(
        self,
        center_id: str,
        skip: int,
        limit: int,
        role_id: str | None = None,
        person_ids: list[str] | None = None,
    ) -> tuple[list[Member], int]:
        repo = self._uow.repo(MemberRepository)
        service = ListMembersByCenterService(repo)
        return await service.execute(center_id, skip, limit, role_id, person_ids)

    async def list_member_ids_by_person_ids(
        self,
        center_id: str,
        person_ids: list[str],
    ) -> list[str]:
        if not person_ids:
            return []

        members, _ = await self.list_members_by_center(
            center_id,
            skip=0,
            limit=100,
            person_ids=person_ids,
        )
        return [m.id for m in members]

    async def bulk_update_member_role(
        self,
        center_id: str,
        member_ids: list[str],
        new_role_id: str,
    ) -> tuple[list[MemberAtomic], list[Member]]:
        # ADMIN 역할 관련 차단은 application handler가 선행.
        repo = self._uow.repo(MemberRepository)
        service = BulkUpdateMemberRoleService(repo)
        return await service.execute(center_id, member_ids, new_role_id)

    async def activate_member(
        self, center_id: str, member_id: str
    ) -> tuple[MemberAtomic, Member]:
        repo = self._uow.repo(MemberRepository)
        member = await GetMemberService(repo).execute(member_id, center_id)
        return await ActivateMemberService(repo).execute(member)

    async def deactivate_member(
        self, center_id: str, member_id: str
    ) -> tuple[MemberAtomic, Member]:
        # ADMIN 비활성화 차단은 application handler가 선행.
        repo = self._uow.repo(MemberRepository)
        member = await GetMemberService(repo).execute(member_id, center_id)
        return await DeactivateMemberService(repo).execute(member)

    async def delete_members_by_person(
        self, person_id: str
    ) -> tuple[list[MemberAtomic], int]:
        repo = self._uow.repo(MemberRepository)
        return await DeleteMembersByPersonService(repo).execute(person_id)

    async def get_member_role_id_by_person(self, center_id: str, person_id: str) -> str:
        repo = self._uow.repo(MemberRepository)
        from ..member.services import FindMemberByPersonService

        get_service = FindMemberByPersonService(repo)
        member = await get_service.execute(center_id, person_id)
        if not member:
            from app.core.exceptions import EntityNotFoundException

            raise EntityNotFoundException("해당 센터의 멤버십을 찾을 수 없습니다.")
        return member.role_id

    async def leave_center(
        self, person_id: str, center_id: str
    ) -> tuple[MemberAtomic, Member]:
        # ADMIN 차단은 application handler가 선행.
        repo = self._uow.repo(MemberRepository)
        service = LeaveCenterService(repo)
        return await service.execute(person_id, center_id)

    async def get_member_role_id(self, member_id: str, center_id: str) -> str:
        repo = self._uow.repo(MemberRepository)
        get_service = GetMemberService(repo)
        member = await get_service.execute(member_id, center_id)
        return member.role_id

    async def delete_member(
        self, member_id: str, center_id: str
    ) -> tuple[MemberAtomic, Member]:
        # ADMIN 차단은 application handler가 선행.
        repo = self._uow.repo(MemberRepository)
        service = DeleteMemberService(repo)
        return await service.execute(member_id, center_id)

    async def get_member_with_response(
        self,
        member_id: str,
        center_id: str,
    ) -> MemberResponse:
        repo = self._uow.repo(MemberRepository)
        service = GetMemberService(repo)
        member = await service.execute(member_id, center_id)
        return MemberResponse.model_validate(member)
