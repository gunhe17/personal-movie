from datetime import date, datetime, time
from math import ceil

from sqlalchemy import case, or_, select, tuple_

from app.infrastructure.persistence.agent_query import resolve_sort
from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import Page, PostgresRepository

from .models import Client
from app.modules.client.client_relation.models import ClientRelation


class ClientRepository(PostgresRepository[Client]):
    model = Client

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        code: str,
        role: str,
        name: str,
        person_id: uuid_str | None = None,
        birth_date: date | None = None,
        gender: str | None = None,
        phone: str | None = None,
        email: str | None = None,
        address: str | None = None,
        profile_image_url: str | None = None,
        status: str = "active",
        memo: str | None = None,
    ) -> Client:
        return await super().add(
            Client(
                center_id=center_id,
                code=code,
                role=role,
                name=name,
                person_id=person_id,
                birth_date=birth_date,
                gender=gender,
                phone=phone,
                email=email,
                address=address,
                profile_image_url=profile_image_url,
                status=status,
                memo=memo,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        person_id: uuid_str | None = unset,
        role: str = unset,
        name: str = unset,
        birth_date: date | None = unset,
        gender: str | None = unset,
        phone: str | None = unset,
        email: str | None = unset,
        address: str | None = unset,
        profile_image_url: str | None = unset,
        status: str = unset,
        memo: str | None = unset,
    ) -> Client | None:
        return await self.update_fields(
            id,
            person_id=person_id,
            role=role,
            name=name,
            birth_date=birth_date,
            gender=gender,
            phone=phone,
            email=email,
            address=address,
            profile_image_url=profile_image_url,
            status=status,
            memo=memo,
        )

    # #
    # query

    @typecheck
    async def find_in_center(
        self,
        center_id: uuid_str,
        client_id: uuid_str,
    ) -> Client | None:
        return await self._find(
            where=[Client.center_id == center_id, Client.id == client_id]
        )

    @typecheck
    async def get_in_center(
        self,
        center_id: uuid_str,
        client_id: uuid_str,
    ) -> Client:
        client = await self.find_in_center(center_id=center_id, client_id=client_id)
        if client is None:
            raise EntityNotFoundException(f"내담자를 찾을 수 없습니다: {client_id}")
        return client

    @typecheck
    async def find_by_person_in_center(
        self,
        center_id: uuid_str,
        person_id: uuid_str,
    ) -> Client | None:
        return await self._find(
            where=[Client.person_id == person_id, Client.center_id == center_id]
        )

    @typecheck
    async def find_by_name_birth_in_center(
        self,
        center_id: uuid_str,
        name: str,
        birth_date: date | None,
    ) -> Client | None:
        return await self._find(
            where=[
                Client.name == name,
                Client.birth_date == birth_date,
                Client.center_id == center_id,
            ]
        )

    @typecheck
    async def exists_code_in_center(
        self,
        center_id: uuid_str,
        code: str,
    ) -> bool:
        return await self._count(
            where=[Client.center_id == center_id, Client.code == code]
        ) > 0

    @typecheck
    async def list_in_center_with_page(
        self,
        center_id: uuid_str,
        role: str | None = None,
        status: str | None = None,
        gender: str | None = None,
        search: str | None = None,
        sort: str | None = None,
        ids: list[str] | None = None,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[Client], Page]:
        where = [Client.center_id == center_id]
        if ids is not None:
            where.append(Client.id.in_(ids))
        if role:
            where.append(Client.role == role)
        if status:
            where.append(Client.status == status)
        if gender:
            where.append(Client.gender == gender)
        if search:
            keyword = f"%{search}%"
            where.append(
                or_(
                    Client.name.ilike(keyword),
                    Client.code.ilike(keyword),
                    Client.phone.ilike(keyword),
                )
            )

        total = await self._count(where=where)

        sort_map = {
            "asc": (Client.created_at, False),
            "desc": (Client.created_at, True),
            "name": (Client.name, False),
        }
        col, descending = sort_map.get(sort, (Client.created_at, True))

        # 비활성(휴면·보관)은 목록 전체의 맨 뒤로 — 정렬 1순위가 활성 여부, 2순위가 선택한 정렬.
        # 화면에서 현재 페이지만 재정렬하면 "그 페이지의 맨 아래"가 한계라 페이지 경계에서 순서가 어긋난다.
        # (표현식 정렬이라 _filter로는 안 됨 → stmt 직접 구성 + _scalars)
        active_first = case((Client.status == "active", 0), else_=1)
        stmt = (
            select(Client)
            .where(Client.deleted_at.is_(None), *where)
            .order_by(active_first, col.desc() if descending else col.asc())
            .offset(skip)
            .limit(limit)
        )
        items = await self._scalars(stmt)
        return items, Page(
            total=total,
            page=skip // limit + 1 if limit else 1,
            size=limit,
            pages=ceil(total / limit) if limit else 0,
        )

    @typecheck
    async def list_by_ids(self, client_ids: list[str]) -> list[Client]:
        if not client_ids:
            return []
        return await self._filter(where=[Client.id.in_(client_ids)])

    @typecheck
    async def list_by_names_and_births(
        self,
        center_id: uuid_str,
        candidates: list[tuple[str, date]],
    ) -> list[Client]:
        if not candidates:
            return []
        return await self._filter(
            where=[
                Client.center_id == center_id,
                tuple_(Client.name, Client.birth_date).in_(candidates),
            ]
        )

    @typecheck
    async def aggregate_guardian_phones_by_client_ids(
        self,
        center_id: uuid_str,
        client_ids: list[str],
    ) -> dict[str, list[str]]:
        if not client_ids:
            return {}

        guardian = Client.__table__.alias("guardian")
        stmt = (
            select(ClientRelation.client_id, guardian.c.phone)
            .join(
                guardian,
                (guardian.c.id == ClientRelation.related_client_id)
                & guardian.c.deleted_at.is_(None)
                & guardian.c.phone.isnot(None),
            )
            .where(
                ClientRelation.center_id == center_id,
                ClientRelation.client_id.in_(client_ids),
                ClientRelation.relation_type == "guardian",
                ClientRelation.deleted_at.is_(None),
            )
        )
        rows = (await self._session.execute(stmt)).all()

        mapping: dict[str, list[str]] = {}
        for client_id, phone in rows:
            mapping.setdefault(client_id, []).append(phone)
        return mapping

    @typecheck
    async def aggregate_guardian_births_by_client_ids(
        self,
        center_id: uuid_str,
        client_ids: list[str],
    ) -> dict[str, list[str]]:
        if not client_ids:
            return {}

        guardian = Client.__table__.alias("guardian")
        stmt = (
            select(ClientRelation.client_id, guardian.c.birth_date)
            .join(
                guardian,
                (guardian.c.id == ClientRelation.related_client_id)
                & guardian.c.deleted_at.is_(None)
                & guardian.c.birth_date.isnot(None),
            )
            .where(
                ClientRelation.center_id == center_id,
                ClientRelation.client_id.in_(client_ids),
                ClientRelation.relation_type == "guardian",
                ClientRelation.deleted_at.is_(None),
            )
        )
        rows = (await self._session.execute(stmt)).all()

        mapping: dict[str, list[str]] = {}
        for client_id, birth_date in rows:
            mapping.setdefault(client_id, []).append(str(birth_date))
        return mapping

    @typecheck
    async def list_in_center(
        self,
        center_id: uuid_str,
        name: str | None = None,
        phone: str | None = None,
        birth_date: date | None = None,
        role: str | None = None,
        memo: str | None = None,
        status: str | None = None,
        gender: str | None = None,
        code: str | None = None,
        email: str | None = None,
        address: str | None = None,
    ) -> list[Client]:
        where = [Client.center_id == center_id]
        if name:
            where.append(Client.name.like(f"%{name}%"))
        if phone:
            where.append(Client.phone == phone)
        if birth_date:
            where.append(Client.birth_date == birth_date)
        if role:
            where.append(Client.role == role)
        if memo:
            where.append(Client.memo.ilike(f"%{memo}%"))
        if status:
            where.append(Client.status == status)
        if gender:
            where.append(Client.gender == gender)
        if code:
            where.append(Client.code == code)
        if email:
            where.append(Client.email.ilike(f"%{email}%"))
        if address:
            where.append(Client.address.ilike(f"%{address}%"))
        return await self._filter(where=where, order_by="created_at", descending=True)

    @typecheck
    async def list_agent_filtered(
        self,
        center_id: uuid_str,
        *,
        sort: str | None = None,
        limit: int = 20,
        name: str | None = None,
        code: str | None = None,
        phone: str | None = None,
        email: str | None = None,
        address: str | None = None,
        memo: str | None = None,
        role: str | None = None,
        status: str | None = None,
        gender: str | None = None,
        birth_date: date | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        ids: list[str] | None = None,
    ) -> tuple[list[Client], int]:
        where = [Client.center_id == center_id]
        if ids is not None:
            where.append(Client.id.in_(ids))
        if name:
            where.append(Client.name.like(f"%{name}%"))
        if code:
            where.append(Client.code == code)
        if phone:
            where.append(Client.phone == phone)
        if email:
            where.append(Client.email.ilike(f"%{email}%"))
        if address:
            where.append(Client.address.ilike(f"%{address}%"))
        if memo:
            where.append(Client.memo.ilike(f"%{memo}%"))
        if role:
            where.append(Client.role == role)
        if status:
            where.append(Client.status == status)
        if gender:
            where.append(Client.gender == gender)
        if birth_date:
            where.append(Client.birth_date == birth_date)
        if date_from:
            where.append(Client.created_at >= datetime.combine(date_from, time.min))
        if date_to:
            where.append(Client.created_at <= datetime.combine(date_to, time.max))
        col, descending = resolve_sort(sort)
        rows = await self._filter(
            where=where, order_by=col, descending=descending, limit=limit
        )
        total = await self._count(where=where)
        return rows, total
