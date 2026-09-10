"""query_assessment_package — 검사 패키지 조회 (레이어 면제 구역, ARCHITECTURE.md EX-11)."""

from datetime import date, datetime, time

from sqlalchemy import select

from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.assessment_package.models import AssessmentPackage
from app.infrastructure.persistence.agent_query import fetch


async def query_assessment_package_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,  # noqa: ARG001 — read:assessment_case 게이트의 센터 단위 조회
    name: str | None = None,
    keyword: str | None = None,
    package_price_min: int | None = None,
    package_price_max: int | None = None,
    is_active: bool | None = None,
    date_from: str | date | None = None,
    date_to: str | date | None = None,
    id: str | None = None,
    ids: list[str] | None = None,
    sort: str | None = None,
    limit: int | None = None,
    fields: list[str] | None = None,
    uow: UnitOfWork,
    namespaced: bool = True,
) -> dict:
    namespace = "assessment_package"
    identity = (
        "id",
    )
    opt_in = (  # select엔 있으나 기본 출력에선 빠짐 — fields로만
        "description",
    )
    sorts = {
        "latest": AssessmentPackage.created_at.desc(),
        "oldest": AssessmentPackage.created_at.asc(),
        "package_price_high": AssessmentPackage.package_price.desc(),
        "package_price_low": AssessmentPackage.package_price.asc(),
    }

    collected = list(ids or [])
    if id:
        collected.append(id)
    merged_ids = collected or None

    # filters
    where = [
        AssessmentPackage.center_id == center_id,
        AssessmentPackage.deleted_at.is_(None),
    ]

    if merged_ids is not None:
        where.append(AssessmentPackage.id.in_(merged_ids))
    if name:
        where.append(AssessmentPackage.name.ilike(f"%{name}%"))
    if keyword:
        where.append(AssessmentPackage.description.ilike(f"%{keyword}%"))
    if package_price_min is not None:
        where.append(AssessmentPackage.package_price >= package_price_min)
    if package_price_max is not None:
        where.append(AssessmentPackage.package_price <= package_price_max)
    if is_active is not None:
        where.append(AssessmentPackage.is_active.is_(is_active))
    if date_from:
        where.append(AssessmentPackage.created_at >= coerce_date(date_from, "date_from"))
    if date_to:
        where.append(AssessmentPackage.created_at <= datetime.combine(coerce_date(date_to, "date_to"), time.max))

    # scope
    # 센터 단위 — owner_scope 행 필터 없음

    # project
    stmt = (
        select(
            AssessmentPackage.id,
            AssessmentPackage.name,
            AssessmentPackage.package_price,
            AssessmentPackage.is_active,
            AssessmentPackage.description,
        )
        .where(*where)
        .order_by(
            sorts.get(sort or "latest", sorts["latest"]),
            AssessmentPackage.id,
        )
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
    "name": "query_assessment_package_handler",
    "permission": "read:assessment_case",
    "purpose": "센터가 판매하는 검사 패키지를 이름·가격대·활성 여부로 유연 조회한다.",
    "keywords": [
        "query assessment package",
        "검사 패키지",
        "검사 세트 상품",
        "패키지 가격",
        "패키지 판매",
    ],
    "boundaries": "패키지 자체 조회만 — 구성 검사(개별 검사)로는 못 거름. 구성은 패키지 요약 필드에만 담기며, 개별 검사 종류 상세는 query_assessment_handler, 수검자별 검사 건은 query_assessment_case_handler.",
    "output": "{rows: 검사 패키지 dict 배열 (fields로 절삭)., aggregate: {count(전체 건수), exact(false면 하한)}}",
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {"type": "string", "title": "패키지명 검색"},
            "keyword": {
                "type": "string",
                "title": "설명 검색",
                "description": "description 대상 부분 검색",
            },
            "package_price_min": {"type": "integer", "title": "패키지 가격 하한 (원)"},
            "package_price_max": {"type": "integer", "title": "패키지 가격 상한 (원)"},
            "is_active": {"type": "boolean", "title": "활성 여부"},
            "date_from": {"type": "string", "format": "date", "title": "등록일 시작"},
            "date_to": {"type": "string", "format": "date", "title": "등록일 종료"},
            "id": {"type": "string", "format": "uuid", "title": "검사 패키지 ID"},
            "ids": {
                "type": "array",
                "items": {"type": "string", "format": "uuid"},
                "title": "검사 패키지 ID 복수",
            },
            "sort": {
                "type": "string",
                "title": "정렬",
                "enum": ["latest", "oldest", "package_price_high", "package_price_low"],
                "description": "'최신순'→latest(기본), '가격 높은순'→package_price_high",
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
