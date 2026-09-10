from datetime import date, datetime, time

from sqlalchemy import or_, select

from app.infrastructure.persistence.agent_query import resolve_sort
from app.core.type import unset, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import Page, PostgresRepository

from .models import Assessment, AssessmentType


class AssessmentRepository(PostgresRepository[Assessment]):

    @typecheck
    async def list_agent_filtered(
        self,
        center_id: uuid_str,  # 미사용 — 검사 카탈로그는 글로벌(센터 스코프는 ids로 선적용)
        *,
        sort: str | None = None,
        limit: int = 20,
        name: str | None = None,
        code: str | None = None,
        assessment_type: str | None = None,
        workflow_type: str | None = None,
        version: int | None = None,
        supports_online: bool | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        ids: list[str] | None = None,
    ) -> tuple[list[Assessment], int]:
        where = []
        if ids is not None:
            where.append(Assessment.id.in_(ids))
        if name:
            where.append(
                or_(
                    Assessment.kor_name.ilike(f"%{name}%"),
                    Assessment.eng_name.ilike(f"%{name}%"),
                )
            )
        if code:
            where.append(Assessment.code.ilike(f"%{code}%"))
        if assessment_type:
            where.append(Assessment.assessment_type == assessment_type)
        if workflow_type:
            where.append(Assessment.workflow_type == workflow_type)
        if version is not None:
            where.append(Assessment.version == str(version))
        if supports_online is not None:
            where.append(Assessment.supports_online.is_(supports_online))
        if date_from:
            where.append(Assessment.created_at >= datetime.combine(date_from, time.min))
        if date_to:
            where.append(Assessment.created_at <= datetime.combine(date_to, time.max))
        col, descending = resolve_sort(sort, default_col="kor_name", default_desc=False)
        rows = await self._filter(
            where=where, order_by=col, descending=descending, limit=limit
        )
        total = await self._count(where=where)
        return rows, total
    model = Assessment

    # #
    # command

    @typecheck
    async def add(
        self,
        *,
        code: str,
        version: str,
        kor_name: str,
        eng_name: str,
        assessment_type: AssessmentType,
        description: str | None = None,
        duration: int | None = None,
        age: str | None = None,
        status: str = "private",
        workflow_type: str = "self_report",
        external_url: str | None = None,
        supports_online: bool = False,
        definition: dict | None = None,
    ) -> Assessment:
        return await super().add(
            Assessment(
                code=code,
                version=version,
                kor_name=kor_name,
                eng_name=eng_name,
                assessment_type=assessment_type,
                description=description,
                duration=duration,
                age=age,
                status=status,
                workflow_type=workflow_type,
                external_url=external_url,
                supports_online=supports_online,
                definition=definition if definition is not None else {},
            )
        )

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        code: str = unset,
        version: str = unset,
        kor_name: str = unset,
        eng_name: str = unset,
        assessment_type: AssessmentType = unset,
        description: str | None = unset,
        duration: int | None = unset,
        age: str | None = unset,
        status: str = unset,
        workflow_type: str = unset,
        external_url: str | None = unset,
        supports_online: bool = unset,
        definition: dict = unset,
    ) -> Assessment | None:
        return await self.update_fields(
            id,
            code=code,
            version=version,
            kor_name=kor_name,
            eng_name=eng_name,
            assessment_type=assessment_type,
            description=description,
            duration=duration,
            age=age,
            status=status,
            workflow_type=workflow_type,
            external_url=external_url,
            supports_online=supports_online,
            definition=definition,
        )

    # #
    # query

    @typecheck
    async def find_by_id_including_deleted(self, id: uuid_str) -> Assessment | None:
        stmt = select(Assessment).where(Assessment.id == id)
        return (await self._session.execute(stmt)).scalar_one_or_none()

    @typecheck
    async def find_by_code(self, code: str) -> Assessment | None:
        return await self._find(where=[Assessment.code == code])


    @typecheck
    async def list_by_status_with_page(
        self,
        status: str,
        *,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[Assessment], Page]:
        return await self._page(
            where=[Assessment.status == status],
            order_by="code",
            page=page,
            size=size,
        )


    @typecheck
    async def list_all_with_page(
        self,
        *,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[Assessment], Page]:
        return await self._page(order_by="code", page=page, size=size)

    @typecheck
    async def list_all_ids(self) -> list[str]:
        rows = await self._filter(order_by="code")
        return [row.id for row in rows]

    @typecheck
    async def list_by_ids(self, ids: list[str]) -> list[Assessment]:
        if not ids:
            return []
        return await self._filter(where=[Assessment.id.in_(ids)])
