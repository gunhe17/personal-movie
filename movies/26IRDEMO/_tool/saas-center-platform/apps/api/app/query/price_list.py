"""query_price_list — 가격표 조회 (레이어 면제 구역, ARCHITECTURE.md EX-11)."""

from datetime import date, datetime, time

from sqlalchemy import select
from sqlalchemy.sql import case

from app.core.datetime_utils import coerce_date
from app.core.logger import get_logger
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.assessment.models import Assessment
from app.modules.assessment.assessment_set.models import AssessmentSet
from app.modules.billing.price_list.models import PriceList, ServiceType
from app.modules.center.program.models import Program
from app.modules.person.person.models import Person
from app.infrastructure.persistence.agent_query import fetch

logger = get_logger(__name__)


async def query_price_list_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,  # noqa: ARG001 — 센터 공용 가격표, 행 필터 없음
    service_type: str | None = None,
    service_name: str | None = None,
    is_active: bool | None = None,
    price_min: int | None = None,
    price_max: int | None = None,
    source: str | None = None,
    keyword: str | None = None,
    reference_id: str | None = None,
    date_from: str | date | None = None,
    date_to: str | date | None = None,
    sort: str | None = None,
    fields: list[str] | None = None,
    uow: UnitOfWork,
    namespaced: bool = True,
) -> dict:
    namespace = "price_list"
    # D13 쌍 — reference_name→reference_id. created_by_name은 WAIVER(opt_in)
    identity = (
        "id",
        "service_name",
        "reference_id",
    )
    opt_in = (
        "memo",
        "center_id",
        "created_by",
        "created_by_name",
        "source",
    )
    sorts = {
        "latest": PriceList.created_at.desc(),
        "oldest": PriceList.created_at.asc(),
        "unit_price_high": PriceList.unit_price.desc(),
        "unit_price_low": PriceList.unit_price.asc(),
    }

    # filters
    where = [
        PriceList.center_id == center_id,
        PriceList.deleted_at.is_(None),
    ]

    if service_type:
        try:
            where.append(PriceList.service_type == ServiceType(service_type).value)
        except ValueError:
            logger.warning("[price_list] unknown service_type=%r — ignored", service_type)
    search = keyword or service_name
    if search:
        where.append(PriceList.service_name.ilike(f"%{search}%"))
    if is_active is not None:
        where.append(PriceList.is_active.is_(is_active))
    if source:
        where.append(PriceList.source == source)
    if price_min is not None:
        where.append(PriceList.unit_price >= price_min)
    if price_max is not None:
        where.append(PriceList.unit_price <= price_max)
    if reference_id is not None:
        where.append(PriceList.reference_id == reference_id)
    if date_from:
        where.append(
            PriceList.created_at
            >= datetime.combine(coerce_date(date_from, "date_from"), time.min)
        )
    if date_to:
        where.append(
            PriceList.created_at
            <= datetime.combine(coerce_date(date_to, "date_to"), time.max)
        )

    # project
    # reference_id 다형(service_type) — program.name / assessment.kor_name / set.name
    program_name = (
        select(Program.name)
        .where(Program.id == PriceList.reference_id)
        .correlate(PriceList)
        .scalar_subquery()
    )
    assessment_name = (
        select(Assessment.kor_name)
        .where(Assessment.id == PriceList.reference_id)
        .correlate(PriceList)
        .scalar_subquery()
    )
    set_name = (
        select(AssessmentSet.name)
        .where(AssessmentSet.id == PriceList.reference_id)
        .correlate(PriceList)
        .scalar_subquery()
    )
    reference_name = case(
        (PriceList.service_type == ServiceType.COUNSELING.value, program_name),
        (PriceList.service_type == ServiceType.ASSESSMENT.value, assessment_name),
        (PriceList.service_type == ServiceType.PACKAGE.value, set_name),
    )

    order = (
        (
            sorts[sort],
            PriceList.id,
        )
        if sort in sorts
        else (
            # 구 repo 기본 — 활성 우선 → 유형 → 이름
            PriceList.is_active.desc(),
            PriceList.service_type.asc(),
            PriceList.service_name.asc(),
            PriceList.id,
        )
    )

    stmt = (
        select(
            PriceList.id,
            PriceList.center_id,
            PriceList.service_name,
            PriceList.service_type,
            PriceList.unit_price,
            PriceList.is_active,
            PriceList.memo,
            PriceList.reference_id,
            PriceList.source,
            PriceList.created_by,
            reference_name.label("reference_name"),
            Person.name.label("created_by_name"),
        )
        .outerjoin(
            Person,
            (Person.account_id == PriceList.created_by)
            & Person.deleted_at.is_(None),
        )
        .where(*where)
        .order_by(*order)
    )

    # return
    rows, count = await fetch(
        uow.session,
        stmt,
        namespace=namespace if namespaced else None,
        identity=identity,
        fields=fields,
        opt_in=opt_in,
    )

    return {
        "rows": rows,
        "aggregate": {
            "count": count,
            "exact": True,
        },
    }


TOOL = {
    "name": "query_price_list_handler",
    "permission": "read:billing",
    "purpose": "서비스 가격표를 유형·이름·가격대로 유연 조회한다.",
    "keywords": [
        "query price list",
        "가격표",
        "가격 조회",
        "상담 비용",
        "검사 비용",
        "요금",
    ],
    "boundaries": "읽기 전용 가격표 유연 조회. 실제 청구 내역은 query_billable_handler.",
    "output": "{rows: 가격표 dict 배열 (fields로 절삭). 정렬: 활성 우선 → 유형 → 이름. 행에 reference_name(연결 프로그램/검사/세트명) 동반., aggregate: {count, exact(false면 하한)}}",
    "input_schema": {
        "type": "object",
        "properties": {
            "service_type": {
                "type": "string",
                "title": "서비스 유형",
                "enum": ["counseling", "assessment", "package"],
            },
            "service_name": {"type": "string", "title": "서비스명 검색"},
            "is_active": {"type": "boolean", "title": "활성 여부"},
            "price_min": {"type": "integer", "title": "가격 하한 (원)"},
            "price_max": {"type": "integer", "title": "가격 상한 (원)"},
            "source": {"type": "string", "title": "출처"},
            "keyword": {"type": "string", "title": "키워드 검색"},
            "reference_id": {
                "type": "string",
                "title": "대상 id",
                "description": "가격이 매겨진 대상(프로그램/검사) id로 필터.",
            },
            "date_from": {"type": "string", "format": "date", "title": "생성일 시작"},
            "date_to": {"type": "string", "format": "date", "title": "생성일 종료"},
            "sort": {
                "type": "string",
                "title": "정렬",
                "enum": ["latest", "oldest", "unit_price_high", "unit_price_low"],
                "description": "'비싼순/가장 비싼'→unit_price_high, '싼 순'→unit_price_low, '최신순'→latest",
            },
            "fields": {
                "type": "array",
                "items": {"type": "string"},
                "title": "반환 필드",
            },
        },
        "required": [],
    },
}
