"""query_notice — 공지 조회 (레이어 면제 구역, ARCHITECTURE.md EX-11)."""

from datetime import date, datetime, time

from sqlalchemy import select

from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.notice.notice.models import Notice
from app.infrastructure.persistence.agent_query import fetch


async def query_notice_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,  # noqa: ARG001 — 공지는 센터 공용, row-filter 없음
    category: str | None = None,
    keyword: str | None = None,
    is_pinned: bool | None = None,
    published_from: str | date | None = None,
    published_to: str | date | None = None,
    sort: str | None = None,
    fields: list[str] | None = None,
    uow: UnitOfWork,
    namespaced: bool = True,
) -> dict:
    namespace = "notice"
    identity = (
        "id",
        "title",
    )
    opt_in = (  # select엔 있으나 기본 출력에선 빠짐 — fields로만
        "category",
        "is_pinned",
        "content",
        "is_published",
        "published_at",
        "created_at",
        "created_by",
    )
    # published_at 축 — repo resolve_sort(time_col/default=published_at, event published)
    sorts = {
        "latest": Notice.published_at.desc(),
        "oldest": Notice.published_at.asc(),
        "published_earliest": Notice.published_at.asc(),
        "published_latest": Notice.published_at.desc(),
    }

    # filters — 플랫폼 전역(Notice에 center_id 컬럼 없음). 발행분만 고정(초안 비노출).
    # CI tenant token: center_id == 는 모델에 없어 적용 불가 — 시그니처만 소비.
    _ = center_id
    where = [
        Notice.deleted_at.is_(None),
        Notice.is_published.is_(True),
    ]

    if category:
        where.append(Notice.category == category)
    if keyword:
        where.append(Notice.title.ilike(f"%{keyword}%"))
    if is_pinned is not None:
        where.append(Notice.is_pinned.is_(is_pinned))
    if published_from:
        where.append(Notice.published_at >= coerce_date(published_from, "published_from"))
    if published_to:
        where.append(Notice.published_at <= datetime.combine(coerce_date(published_to, "published_to"), time.max))

    # scope
    # 플랫폼 공용 — owner_scope 행 필터 없음

    # project
    stmt = (
        select(
            Notice.id,
            Notice.title,
            Notice.category,
            Notice.is_pinned,
            Notice.content,
            Notice.is_published,
            Notice.published_at,
            Notice.created_at,
            Notice.created_by,
        )
        .where(*where)
        .order_by(
            Notice.is_pinned.desc(),
            sorts.get(sort or "latest", sorts["latest"]),
            Notice.id,
        )
    )

    # return
    rows, count = await fetch(
        uow.session,
        stmt,
        limit=50,  # 구 facade 상한 — TOOL에 limit이 없어 모델이 못 준다
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
    "name": "query_notice_handler",
    "permission": None,  # list_notices/get_notice 엔드포인트가 membership-only(authenticate)라 그대로
    "purpose": "공지를 분류·키워드·고정·기간으로 유연 조회한다.",
    "keywords": [
        "query notice",
        "공지 조회",
        "공지사항",
        "공지 검색",
        "고정 공지",
        "notice",
    ],
    "boundaries": "읽기 전용 단일 엔티티 유연 조회. 페이지네이션 목록은 list_notices_handler, 단건 상세는 get_notice_handler. 발행된 공지만 조회 — 미발행 초안은 조회 대상 아님(관리자 전용).",
    "output": "{rows: 공지 dict 배열 (fields로 절삭)., aggregate: {count, exact(false면 하한)}}",
    "input_schema": {
        "type": "object",
        "properties": {
            "category": {
                "type": "string",
                "title": "분류 필터",
                "enum": ["maintenance", "update", "announcement"],
            },
            "keyword": {"type": "string", "title": "키워드 검색"},
            "is_pinned": {"type": "boolean", "title": "고정 공지 필터"},
            "published_from": {"type": "string", "format": "date", "title": "발행일 시작"},
            "published_to": {"type": "string", "format": "date", "title": "발행일 종료"},
            "sort": {
                "type": "string",
                "enum": ["latest", "oldest", "published_earliest", "published_latest"],
                "title": "정렬",
                "description": "'최신순'→latest(기본, 고정 공지 우선), '오래된 순'→oldest, '발행 이른순'→published_earliest, '발행 최근순'→published_latest",
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
