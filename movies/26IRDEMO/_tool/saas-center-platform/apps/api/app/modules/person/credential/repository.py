from datetime import date
from typing import Any

from sqlalchemy import select

from .models import PersonCredential, CredentialStatus
from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import Page, PostgresRepository


class PersonCredentialRepository(PostgresRepository[PersonCredential]):
    model = PersonCredential

    # #
    # command

    @typecheck
    async def add(
        self,
        person_id: uuid_str,
        credential_type: str,
        title: str,
        organization: str,
        description: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        is_current: bool = False,
        meta: dict[str, Any] | None = None,
    ) -> PersonCredential:
        return await super().add(
            PersonCredential(
                person_id=person_id,
                credential_type=credential_type,
                title=title,
                organization=organization,
                description=description,
                start_date=start_date,
                end_date=end_date,
                is_current=is_current,
                meta=meta,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        title: str = unset,
        organization: str = unset,
        description: str | None = unset,
        start_date: date | None = unset,
        end_date: date | None = unset,
        is_current: bool = unset,
        meta: dict[str, Any] | None = unset,
        attachment_url: str | None = unset,
        attachment_filename: str | None = unset,
        attachment_content_type: str | None = unset,
        attachment_size: int | None = unset,
        status: str = unset,
        requested_at: utc_dt | None = unset,
        reviewed_at: utc_dt | None = unset,
        reviewed_by: uuid_str | None = unset,
        reject_reason: str | None = unset,
    ) -> PersonCredential | None:
        return await self.update_fields(
            id,
            title=title,
            organization=organization,
            description=description,
            start_date=start_date,
            end_date=end_date,
            is_current=is_current,
            meta=meta,
            attachment_url=attachment_url,
            attachment_filename=attachment_filename,
            attachment_content_type=attachment_content_type,
            attachment_size=attachment_size,
            status=status,
            requested_at=requested_at,
            reviewed_at=reviewed_at,
            reviewed_by=reviewed_by,
            reject_reason=reject_reason,
        )

    # #
    # query

    @typecheck
    async def get_by_person(
        self,
        id: uuid_str,
        person_id: uuid_str,
    ) -> PersonCredential:
        credential = await self._find(
            where=[
                PersonCredential.id == id,
                PersonCredential.person_id == person_id,
            ]
        )
        if credential is None:
            raise EntityNotFoundException(f"Credential not found: {id}")
        return credential

    @typecheck
    async def list_by_person(
        self,
        person_id: uuid_str,
        *,
        credential_type: str | None = None,
    ) -> list[PersonCredential]:
        where = [PersonCredential.person_id == person_id]
        if credential_type:
            where.append(PersonCredential.credential_type == credential_type)
        stmt = (
            select(PersonCredential)
            .where(PersonCredential.deleted_at.is_(None), *where)
            .order_by(
                PersonCredential.credential_type,
                PersonCredential.start_date.desc().nullslast(),
                PersonCredential.created_at.desc(),
            )
        )
        return await self._scalars(stmt)


    @typecheck
    async def list_pending_with_page(
        self,
        *,
        credential_type: str | None = None,
        page: int = 1,
        size: int = 50,
    ) -> tuple[list[PersonCredential], Page]:
        where = [PersonCredential.status == CredentialStatus.PENDING]
        if credential_type:
            where.append(PersonCredential.credential_type == credential_type)
        return await self._page(
            where=where,
            page=page,
            size=size,
            order_by="requested_at",
        )

    @typecheck
    async def recompute_certification(self, person_id: uuid_str) -> bool:
        # credential 상태 변경 시 Person.is_certified 캐시 동기화 (같은 UoW tx 안에서 호출).
        # 정책(C안): certification ≥1 verified AND education ≥1 verified.
        # 형제 서브모듈(person) UPDATE = 모듈 내 한 aggregate — 허용.
        from sqlalchemy import func, select, update as sql_update

        from app.modules.person.person.models import Person

        stmt = (
            select(PersonCredential.credential_type, func.count().label("cnt"))
            .where(
                PersonCredential.person_id == person_id,
                PersonCredential.status == CredentialStatus.VERIFIED,
                PersonCredential.deleted_at.is_(None),
                PersonCredential.credential_type.in_(["certification", "education"]),
            )
            .group_by(PersonCredential.credential_type)
        )
        rows = (await self._session.execute(stmt)).all()
        counts = {credential_type: cnt for credential_type, cnt in rows}

        is_certified = (
            counts.get("certification", 0) >= 1
            and counts.get("education", 0) >= 1
        )

        await self._session.execute(
            sql_update(Person)
            .where(Person.id == person_id)
            .values(is_certified=is_certified)
        )
        return is_certified
