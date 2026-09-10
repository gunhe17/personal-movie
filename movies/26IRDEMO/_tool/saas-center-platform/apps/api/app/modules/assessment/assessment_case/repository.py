from datetime import date

from sqlalchemy import cast, exists, func, literal, or_, select
from sqlalchemy.dialects.postgresql import JSONB as JSONB_TYPE

from .models import CaseStatus
from app.core.exceptions import EntityNotFoundException
from app.core.type import unset, utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.agent_query import resolve_sort
from app.infrastructure.persistence.new_repository import Page, PostgresRepository
from app.modules.assessment.assessment_session.models import AssessmentSession

from .models import AssessmentCase


class AssessmentCaseRepository(PostgresRepository[AssessmentCase]):
    model = AssessmentCase

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        case_code: str,
        counselor_id: uuid_str,
        institution_summary: dict | None = None,
        assessment_summary: list | None = None,
        set_summary: dict | None = None,
        documents: list | None = None,
        tags: list[str] | None = None,
        is_final_report_required: bool = False,
        status: str = "pending",
    ) -> AssessmentCase:
        return await super().add(
            AssessmentCase(
                center_id=center_id,
                case_code=case_code,
                counselor_id=counselor_id,
                institution_summary=institution_summary,
                assessment_summary=assessment_summary if assessment_summary is not None else [],
                set_summary=set_summary,
                documents=documents if documents is not None else [],
                tags=tags if tags is not None else [],
                is_final_report_required=is_final_report_required,
                status=status,
            )
        )

    @typecheck
    async def update_in_center(
        self,
        case_id: uuid_str,
        center_id: uuid_str,
        *,
        status: str = unset,
        completed_at: utc_dt | None = unset,
        counselor_id: uuid_str = unset,
        institution_summary: dict | None = unset,
        assessment_summary: list = unset,
        set_summary: dict | None = unset,
        documents: list = unset,
        tags: list[str] = unset,
        is_final_report_required: bool = unset,
    ) -> AssessmentCase:
        await self.get_in_center(center_id=center_id, case_id=case_id)
        updated = await self.update_fields(
            case_id,
            status=status,
            completed_at=completed_at,
            counselor_id=counselor_id,
            institution_summary=institution_summary,
            assessment_summary=assessment_summary,
            set_summary=set_summary,
            documents=documents,
            tags=tags,
            is_final_report_required=is_final_report_required,
        )
        assert updated is not None
        return updated

    @typecheck
    async def remove_in_center(
        self,
        case_id: uuid_str,
        center_id: uuid_str,
    ) -> AssessmentCase | None:
        await self.get_in_center(center_id=center_id, case_id=case_id)
        return await self.remove_by_id(case_id)

    # #
    # query

    @typecheck
    async def find_in_center(
        self,
        center_id: uuid_str,
        case_id: uuid_str,
    ) -> AssessmentCase | None:
        return await self._find(
            where=[
                AssessmentCase.center_id == center_id,
                AssessmentCase.id == case_id,
            ]
        )

    @typecheck
    async def get_in_center(
        self,
        center_id: uuid_str,
        case_id: uuid_str,
    ) -> AssessmentCase:
        case = await self.find_in_center(center_id=center_id, case_id=case_id)
        if case is None:
            raise EntityNotFoundException(f"AssessmentCase not found: {case_id}")
        return case


    @typecheck
    async def list_ids_by_counselor(
        self,
        center_id: uuid_str,
        counselor_id: uuid_str,
    ) -> list[str]:
        rows = await self._filter(
            where=[
                AssessmentCase.center_id == center_id,
                AssessmentCase.counselor_id == counselor_id,
            ]
        )
        return [row.id for row in rows]

    @typecheck
    async def list_by_counselor_ids(
        self,
        center_id: uuid_str,
        counselor_ids: list[str],
        status: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[AssessmentCase]:
        if not counselor_ids:
            return []
        where = [
            AssessmentCase.center_id == center_id,
            AssessmentCase.counselor_id.in_(counselor_ids),
        ]
        if status:
            where.append(AssessmentCase.status == status)
        if date_from:
            where.append(AssessmentCase.created_at >= date_from)
        if date_to:
            where.append(AssessmentCase.created_at <= date_to)
        return await self._filter(
            where=where,
            order_by="created_at",
            descending=True,
        )

    @typecheck
    async def list_by_ids(self, case_ids: list[str]) -> list[AssessmentCase]:
        if not case_ids:
            return []
        return await self._filter(where=[AssessmentCase.id.in_(case_ids)])

    @typecheck
    async def list_agent_filtered(
        self,
        center_id: uuid_str,
        *,
        sort: str = "desc",
        limit: int = 20,
        case_code: str | None = None,
        status: str | None = None,
        tags: list[str] | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        counselor_ids: list[str] | None = None,
        completed_from: date | None = None,
        completed_to: date | None = None,
        is_final_report_required: bool | None = None,
        ids: list[str] | None = None,
    ) -> tuple[list[AssessmentCase], int]:
        where = self._build_conditions(
            center_id,
            status=status,
            counselor_id=",".join(counselor_ids) if counselor_ids else None,
            search=case_code,
            date_from=date_from,
            date_to=date_to,
            tags=tags,
            report_required=is_final_report_required,
            completed_from=completed_from,
            completed_to=completed_to,
        )
        if ids is not None:
            where.append(AssessmentCase.id.in_(ids))
        col, descending = resolve_sort(sort, event_columns={"completed": "completed_at"})
        rows = await self._filter(
            where=where, order_by=col, descending=descending, limit=limit
        )
        total = await self._count(where=where)
        return rows, total

    @typecheck
    async def list_completed_by_ids(self, case_ids: list[str]) -> list[AssessmentCase]:
        if not case_ids:
            return []
        return await self._filter(
            where=[
                AssessmentCase.id.in_(case_ids),
                AssessmentCase.status == CaseStatus.COMPLETED,
            ]
        )

    @typecheck
    async def list_in_center_with_page(
        self,
        center_id: uuid_str,
        status: str | None = None,
        counselor_id: uuid_str | None = None,
        search: str | None = None,
        sort_order: str = "desc",
        has_institution: bool | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        case_ids_filter: list[str] | None = None,
        tags: list[str] | None = None,
        report_required: bool | None = None,
        completed_from: date | None = None,
        completed_to: date | None = None,
        has_schedule: bool | None = None,
        *,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[AssessmentCase], Page]:
        where = self._build_conditions(
            center_id=center_id,
            status=status,
            counselor_id=counselor_id,
            search=search,
            has_institution=has_institution,
            date_from=date_from,
            date_to=date_to,
            case_ids_filter=case_ids_filter,
            tags=tags,
            report_required=report_required,
            completed_from=completed_from,
            completed_to=completed_to,
            has_schedule=has_schedule,
        )
        return await self._page(
            where=where,
            page=page,
            size=size,
            order_by="created_at",
            descending=sort_order != "asc",
        )

    @typecheck
    async def next_case_code(
        self,
        center_id: uuid_str,
        prefix: str = "AC",
    ) -> str:
        stmt = select(func.max(AssessmentCase.case_code)).where(
            AssessmentCase.center_id == center_id,
            AssessmentCase.case_code.like(f"{prefix}%"),
        )
        result = await self._session.execute(stmt)
        last_code = result.scalar_one_or_none()

        if last_code:
            try:
                next_number = int(last_code[len(prefix):]) + 1
            except (ValueError, IndexError):
                next_number = 1
        else:
            next_number = 1

        if next_number > 9999:
            raise ValueError(f"Case code limit exceeded for center {center_id}")

        return f"{prefix}{next_number:04d}"

    # #
    # helpers

    def _build_conditions(
        self,
        center_id: str,
        status: str | None = None,
        counselor_id: str | None = None,
        search: str | None = None,
        has_institution: bool | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        case_ids_filter: list[str] | None = None,
        tags: list[str] | None = None,
        report_required: bool | None = None,
        completed_from: date | None = None,
        completed_to: date | None = None,
        has_schedule: bool | None = None,
    ) -> list:
        where: list = [AssessmentCase.center_id == center_id]

        if status:
            where.append(AssessmentCase.status == status)
        if counselor_id:
            # 담당자 다중 선택은 콤마 조인된 ID 문자열로 전달된다 (단일=원소 1개)
            where.append(AssessmentCase.counselor_id.in_(counselor_id.split(",")))

        if search or case_ids_filter:
            search_conditions = []
            if search:
                search_conditions.append(AssessmentCase.case_code.ilike(f"%{search}%"))
            if case_ids_filter:
                search_conditions.append(AssessmentCase.id.in_(case_ids_filter))
            where.append(or_(*search_conditions))

        json_null = cast(literal("null"), JSONB_TYPE)
        if has_institution is True:
            where.append(AssessmentCase.institution_summary.isnot(None))
            where.append(AssessmentCase.institution_summary != json_null)
        elif has_institution is False:
            where.append(
                or_(
                    AssessmentCase.institution_summary.is_(None),
                    AssessmentCase.institution_summary == json_null,
                )
            )

        if date_from:
            where.append(func.date(AssessmentCase.created_at) >= date_from)
        if date_to:
            where.append(func.date(AssessmentCase.created_at) <= date_to)

        if tags:
            where.append(AssessmentCase.tags.op("&&")(tags))

        if report_required is not None:
            where.append(AssessmentCase.is_final_report_required == report_required)

        if completed_from:
            where.append(AssessmentCase.completed_at.isnot(None))
            where.append(func.date(AssessmentCase.completed_at) >= completed_from)
        if completed_to:
            where.append(AssessmentCase.completed_at.isnot(None))
            where.append(func.date(AssessmentCase.completed_at) <= completed_to)

        if has_schedule is not None:
            session_exists = exists().where(
                AssessmentSession.case_id == AssessmentCase.id,
                AssessmentSession.deleted_at.is_(None),
            )
            where.append(session_exists if has_schedule else ~session_exists)

        return where
