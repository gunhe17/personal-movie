"""cross-module READ 전용 표면 — DTO 반환(entity 미노출). write는 facade 경유."""
from dataclasses import dataclass

from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.center.models import Center
from app.modules.center.center.repository import CenterRepository
from app.modules.center.member.models import Member
from app.modules.center.member.repository import MemberRepository


@dataclass(frozen=True)
class MemberRef:
    id: uuid_str
    center_id: uuid_str
    person_id: uuid_str


@dataclass(frozen=True)
class CenterRef:
    id: uuid_str
    name: str


def _to_member_ref(member: Member) -> MemberRef:
    return MemberRef(
        id=member.id,
        center_id=member.center_id,
        person_id=member.person_id,
    )


def _to_center_ref(center: Center) -> CenterRef:
    return CenterRef(
        id=center.id,
        name=center.name,
    )


class MemberClient:
    def __init__(
        self,
        uow: UnitOfWork,
    ):
        self._repo = uow.repo(MemberRepository)

    async def list_by_person(
        self,
        person_id: uuid_str,
    ) -> list[MemberRef]:
        return [_to_member_ref(m) for m in await self._repo.list_by_person(person_id)]

    async def find_by_person(
        self,
        center_id: uuid_str,
        person_id: uuid_str,
    ) -> MemberRef | None:
        member = await self._repo.find_by_person(center_id=center_id, person_id=person_id)
        return _to_member_ref(member) if member else None

    async def list_by_ids(
        self,
        member_ids: list[uuid_str],
    ) -> list[MemberRef]:
        return [_to_member_ref(m) for m in await self._repo.list_by_ids(member_ids)]

    async def list_by_center(
        self,
        center_id: uuid_str,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[MemberRef]:
        members = await self._repo.list_by_center(center_id=center_id, skip=skip, limit=limit)
        return [_to_member_ref(m) for m in members]


class CenterClient:
    def __init__(
        self,
        uow: UnitOfWork,
    ):
        self._repo = uow.repo(CenterRepository)

    async def list_active(
        self,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[CenterRef]:
        return [_to_center_ref(c) for c in await self._repo.list_active(skip=skip, limit=limit)]
