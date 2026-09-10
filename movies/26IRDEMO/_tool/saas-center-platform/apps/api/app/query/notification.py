"""query_notification — 내 알림 조회 (레이어 면제 구역, ARCHITECTURE.md EX-11)."""

from datetime import date, datetime, time

from sqlalchemy import or_, select

from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.member.models import Member
from app.modules.notification.notification.models import Notification
from app.modules.person.person.models import Person
from app.infrastructure.persistence.agent_query import fetch


async def query_notification_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,  # noqa: ARG001 — 알림은 항상 본인(recipient) 고정
    actor_membership_id: str,
    category: str | None = None,
    event_type: str | None = None,
    priority: str | None = None,
    keyword: str | None = None,
    is_read: bool | None = None,
    date_from: str | date | None = None,
    date_to: str | date | None = None,
    sort: str | None = None,
    fields: list[str] | None = None,
    uow: UnitOfWork,
    namespaced: bool = True,
) -> dict:
    namespace = "notification"
    identity = (
        "id",
        "title",
    )
    opt_in = (
        "category",
        "is_read",
        "body",
        "event_type",
        "priority",
        "read_at",
        "created_at",
        "recipient_id",
    )

    sorts = {
        "latest": Notification.created_at.desc(),
        "oldest": Notification.created_at.asc(),
    }

    # scope — membership→person→account (본인 외 조회 경로 없음)
    recipient_id = await uow.session.scalar(
        select(Person.account_id)
        .select_from(Member)
        .join(Person, Person.id == Member.person_id)
        .where(
            Member.id == actor_membership_id,
            Member.center_id == center_id,
            Member.deleted_at.is_(None),
            Person.deleted_at.is_(None),
        )
    )
    if recipient_id is None:
        return {
            "rows": [],
            "aggregate": {"count": 0, "exact": True},
            "notice": "계정 연결이 없어 알림을 조회할 수 없습니다",
        }

    # filters
    where = [
        Notification.center_id == center_id,
        Notification.deleted_at.is_(None),
        Notification.recipient_id == recipient_id,
    ]

    if category:
        where.append(Notification.category == category)
    if event_type:
        where.append(Notification.event_type == event_type)
    if priority:
        where.append(Notification.priority == priority)
    if keyword:
        where.append(
            or_(
                Notification.title.ilike(f"%{keyword}%"),
                Notification.body.ilike(f"%{keyword}%"),
            )
        )
    # 구 facade 동치 — is_read=false만 unread_only. true는 필터 없음
    if is_read is False:
        where.append(Notification.is_read.is_(False))

    created_from = coerce_date(date_from, "date_from")
    created_to = coerce_date(date_to, "date_to")
    if created_from:
        where.append(Notification.created_at >= datetime.combine(created_from, time.min))
    if created_to:
        where.append(Notification.created_at <= datetime.combine(created_to, time.max))

    # project
    stmt = (
        select(
            Notification.id,
            Notification.title,
            Notification.category,
            Notification.is_read,
            Notification.body,
            Notification.event_type,
            Notification.priority,
            Notification.read_at,
            Notification.created_at,
            Notification.recipient_id,
        )
        .where(*where)
        .order_by(sorts.get(sort or "latest", sorts["latest"]), Notification.id)
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
    "name": "query_notification_handler",
    "permission": None,
    "purpose": "내 알림을 조회한다 — 목록·안 읽은 개수.",
    "keywords": ["query notification", "알림", "안 읽은 알림", "알림 몇 개", "새 알림"],
    "boundaries": "항상 본인 알림만 (수신자 고정). 읽음 처리는 write 도구.",
    "output": "{rows: 알림 행(fields 절삭), aggregate: {count(전체 건수), exact}}. '안 읽은 알림 몇 개'는 is_read=false로 걸러 aggregate.count를 읽는다(행 절삭과 무관하게 정확).",
    "input_schema": {
        "type": "object",
        "properties": {
            "category": {"type": "string", "title": "카테고리"},
            "event_type": {"type": "string", "title": "이벤트 종류"},
            "priority": {"type": "string", "title": "우선순위", "description": "'긴급 알림'→우선순위 필터"},
            "keyword": {"type": "string", "title": "제목·내용 키워드 검색"},
            "date_from": {"type": "string", "format": "date", "title": "수신일 시작"},
            "date_to": {"type": "string", "format": "date", "title": "수신일 종료"},
            "is_read": {
                "type": "boolean",
                "title": "읽음 여부",
                "description": "'안 읽은 것만'→false. 안 읽은 개수는 이걸로 걸러 aggregate.count",
            },
            "sort": {
                "type": "string",
                "enum": ["latest", "oldest"],
                "title": "정렬",
                "description": "'최신순'→latest(기본), '오래된 순'→oldest",
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
