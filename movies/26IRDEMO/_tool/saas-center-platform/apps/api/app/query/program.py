"""query_program — 프로그램 카탈로그 조회 (레이어 면제 구역, ARCHITECTURE.md EX-11)."""

from datetime import date, datetime, time

from sqlalchemy import literal_column, select
from sqlalchemy.dialects.postgresql import aggregate_order_by
from sqlalchemy.orm import aliased
from sqlalchemy.sql import func

from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.member.models import Member
from app.modules.center.program.models import Program
from app.modules.center.program_member.models import ProgramMember
from app.modules.person.person.models import Person
from app.infrastructure.persistence.agent_query import fetch


async def query_program_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,  # noqa: ARG001 — 센터 공용 카탈로그, 행 필터 없음
    name: str | None = None,
    program_type: str | None = None,
    is_active: bool | None = None,
    keyword: str | None = None,
    price_min: int | None = None,
    price_max: int | None = None,
    duration_min: int | None = None,
    duration_max: int | None = None,
    counselor_id: str | None = None,
    counselor_ids: list[str] | None = None,
    date_from: str | date | None = None,
    date_to: str | date | None = None,
    sort: str | None = None,
    limit: int | None = None,
    fields: list[str] | None = None,
    uow: UnitOfWork,
    namespaced: bool = True,
) -> dict:
    namespace = "program"
    # D13 쌍 — counselor_names의 원천은 program.id
    identity = (
        "id",
        "name",
    )
    opt_in = ("description",)

    sorts = {
        "latest": Program.created_at.desc(),
        "oldest": Program.created_at.asc(),
        "price_high": Program.price.desc(),
        "price_low": Program.price.asc(),
        "duration_minutes_high": Program.duration_minutes.desc(),
        "duration_minutes_low": Program.duration_minutes.asc(),
    }

    def counselor_names():
        """ProgramMember ⋈ Member ⋈ Person — 빈 담당은 [] (array_agg NULL 방지)."""
        PM = aliased(ProgramMember)
        CounselorMember = aliased(Member)
        CounselorPerson = aliased(Person)
        return (
            select(
                func.coalesce(
                    func.array_remove(
                        func.array_agg(
                            aggregate_order_by(CounselorPerson.name, CounselorMember.id)
                        ),
                        None,
                    ),
                    literal_column("'{}'::text[]"),
                )
            )
            .select_from(PM)
            .join(CounselorMember, CounselorMember.id == PM.member_id)
            .join(CounselorPerson, CounselorPerson.id == CounselorMember.person_id)
            .where(
                PM.program_id == Program.id,
                PM.deleted_at.is_(None),
                CounselorMember.deleted_at.is_(None),
                CounselorPerson.deleted_at.is_(None),
            )
            .correlate(Program)
            .scalar_subquery()
        )

    # filters
    where = [
        Program.center_id == center_id,
        Program.deleted_at.is_(None),
    ]

    if name:
        where.append(Program.name.ilike(f"%{name}%"))
    if program_type:
        where.append(Program.program_type == program_type.upper())
    if is_active is not None:
        where.append(Program.is_active.is_(is_active))
    if keyword:
        where.append(Program.description.ilike(f"%{keyword}%"))
    if price_min is not None:
        where.append(Program.price >= price_min)
    if price_max is not None:
        where.append(Program.price <= price_max)
    if duration_min is not None:
        where.append(Program.duration_minutes >= duration_min)
    if duration_max is not None:
        where.append(Program.duration_minutes <= duration_max)
    if date_from:
        where.append(
            Program.created_at
            >= datetime.combine(coerce_date(date_from, "date_from"), time.min)
        )
    if date_to:
        where.append(
            Program.created_at
            <= datetime.combine(coerce_date(date_to, "date_to"), time.max)
        )

    collected_counselor_ids = list(counselor_ids or [])
    if counselor_id:
        collected_counselor_ids.append(counselor_id)
    if collected_counselor_ids:
        where.append(
            Program.id.in_(
                select(ProgramMember.program_id).where(
                    ProgramMember.center_id == center_id,
                    ProgramMember.member_id.in_(collected_counselor_ids),
                    ProgramMember.deleted_at.is_(None),
                )
            )
        )

    # scope
    # 센터 공용 카탈로그 — owner_scope 행 필터 없음

    # project — 구 repo 기본 정렬은 name ASC (sort 미지정 시)
    stmt = (
        select(
            Program.id,
            Program.name,
            Program.program_type,
            Program.price,
            Program.duration_minutes,
            Program.is_active,
            Program.description,
            counselor_names().label("counselor_names"),
        )
        .where(*where)
        .order_by(sorts.get(sort, Program.name.asc()), Program.id)
    )

    # return
    rows, count = await fetch(
        uow.session,
        stmt,
        namespace=namespace if namespaced else None,
        identity=identity,
        fields=fields,
        opt_in=opt_in,
        limit=limit,
    )

    return {
        "rows": rows,
        "aggregate": {
            "count": count,
            "exact": True,
        },
    }


TOOL = {
    "name": "query_program_handler",
    "permission": "read:program",
    "purpose": "프로그램 카탈로그를 이름·유형·가격대로 유연 조회한다.",
    "keywords": [
        "query program",
        "프로그램",
        "프로그램 목록",
        "개인상담 프로그램",
        "그룹 프로그램",
    ],
    "boundaries": "읽기 전용 프로그램 유연 조회. 담당 상담사 필터는 counselor_id(이름은 query_member로 id 확인). 가격표는 query_price_list_handler.",
    "output": "{rows: 프로그램 dict 배열 (fields로 절삭). 행에 counselor_names(담당 상담사) 동반., aggregate: {count(전체 건수), exact(false면 하한)}}",
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {"type": "string", "title": "프로그램 이름 검색"},
            "program_type": {
                "type": "string",
                "title": "유형",
                "enum": ["INDIVIDUAL", "GROUP"],
            },
            "is_active": {"type": "boolean", "title": "활성 여부"},
            "keyword": {"type": "string", "title": "설명 키워드 검색"},
            "price_min": {"type": "integer", "title": "가격 하한 (원)"},
            "price_max": {"type": "integer", "title": "가격 상한 (원)"},
            "duration_min": {"type": "integer", "title": "회기 시간 하한 (분)"},
            "duration_max": {
                "type": "integer",
                "title": "회기 시간 상한 (분)",
                "description": "'60분짜리'→min 60, max 60",
            },
            "counselor_id": {
                "type": "string",
                "title": "담당 상담사 id",
                "description": "이 상담사가 담당하는 프로그램으로 필터. 이름은 query_member로 id 확인 후 넘긴다.",
            },
            "counselor_ids": {
                "type": "array",
                "items": {"type": "string"},
                "title": "담당 상담사 id 목록",
                "description": "여러 상담사 담당 프로그램 필터.",
            },
            "date_from": {"type": "string", "format": "date", "title": "생성일 시작"},
            "date_to": {"type": "string", "format": "date", "title": "생성일 종료"},
            "sort": {
                "type": "string",
                "title": "정렬",
                "enum": [
                    "latest",
                    "oldest",
                    "price_high",
                    "price_low",
                    "duration_minutes_high",
                    "duration_minutes_low",
                ],
                "description": "'최신순'→latest, '비싼순/가장 비싼'→price_high, '싼 순'→price_low, '긴 회기순'→duration_minutes_high",
            },
            "limit": {"type": "integer", "title": "최대 개수"},
            "fields": {
                "type": "array",
                "items": {"type": "string"},
                "title": "반환 필드",
            },
        },
        "required": [],
    },
}
