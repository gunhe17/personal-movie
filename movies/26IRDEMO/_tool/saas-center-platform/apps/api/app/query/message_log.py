"""query_message_log — 문자·알림톡 발송 기록 조회 (레이어 면제 구역, ARCHITECTURE.md EX-11)."""

from datetime import date, datetime, time

from sqlalchemy import or_, select

from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.messaging.messaging.models import MessageLog
from app.infrastructure.persistence.agent_query import fetch


async def query_message_log_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,  # noqa: ARG001 — read:send_link 게이트의 센터 단위 발송 기록 조회
    message_type: str | None = None,
    status: str | None = None,
    recipient: str | None = None,
    template_code: str | None = None,
    keyword: str | None = None,
    attempts_min: int | None = None,
    attempts_max: int | None = None,
    sent_from: str | date | None = None,
    sent_to: str | date | None = None,
    scheduled_from: str | date | None = None,
    scheduled_to: str | date | None = None,
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
    namespace = "message_log"
    identity = ("id",)
    opt_in = (
        "message",
        "error_message",
    )

    sorts = {
        "latest": MessageLog.created_at.desc(),
        "oldest": MessageLog.created_at.asc(),
        "attempts_high": MessageLog.attempts.desc(),
        "attempts_low": MessageLog.attempts.asc(),
        "sent_earliest": MessageLog.sent_at.asc(),
        "sent_latest": MessageLog.sent_at.desc(),
        "scheduled_earliest": MessageLog.scheduled_at.asc(),
        "scheduled_latest": MessageLog.scheduled_at.desc(),
    }

    # filters
    where = [
        MessageLog.center_id == center_id,
        MessageLog.deleted_at.is_(None),
    ]

    collected = list(ids or [])
    if id:
        collected.append(id)
    if collected:
        where.append(MessageLog.id.in_(collected))

    if message_type:
        where.append(MessageLog.message_type == message_type)
    if status:
        where.append(MessageLog.status == status)
    if recipient:
        where.append(MessageLog.recipient.ilike(f"%{recipient}%"))
    if template_code:
        where.append(MessageLog.template_code.ilike(f"%{template_code}%"))
    if keyword:
        where.append(
            or_(
                MessageLog.message.ilike(f"%{keyword}%"),
                MessageLog.error_message.ilike(f"%{keyword}%"),
            )
        )
    if attempts_min is not None:
        where.append(MessageLog.attempts >= attempts_min)
    if attempts_max is not None:
        where.append(MessageLog.attempts <= attempts_max)

    for col, lo, hi, lo_name, hi_name in (
        (MessageLog.sent_at, sent_from, sent_to, "sent_from", "sent_to"),
        (
            MessageLog.scheduled_at,
            scheduled_from,
            scheduled_to,
            "scheduled_from",
            "scheduled_to",
        ),
    ):
        lo_d = coerce_date(lo, lo_name)
        hi_d = coerce_date(hi, hi_name)
        if lo_d:
            where.append(col >= datetime.combine(lo_d, time.min))
        if hi_d:
            where.append(col <= datetime.combine(hi_d, time.max))

    created_from = coerce_date(date_from, "date_from")
    created_to = coerce_date(date_to, "date_to")
    if created_from:
        where.append(MessageLog.created_at >= datetime.combine(created_from, time.min))
    if created_to:
        where.append(MessageLog.created_at <= datetime.combine(created_to, time.max))

    # scope
    # 센터 단위 조회 — owner_scope 행 필터 없음

    # project
    stmt = (
        select(
            MessageLog.id,
            MessageLog.message_type,
            MessageLog.status,
            MessageLog.recipient,
            MessageLog.template_code,
            MessageLog.sent_at,
            MessageLog.scheduled_at,
            MessageLog.attempts,
            MessageLog.message,
            MessageLog.error_message,
        )
        .where(*where)
        .order_by(sorts.get(sort or "latest", sorts["latest"]), MessageLog.id)
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
    "name": "query_message_log_handler",
    "permission": "read:send_link",
    "purpose": "문자·알림톡 발송 기록을 유형·상태·수신자·템플릿·시도횟수·발송/예약/등록 기간으로 유연 조회한다.",
    "keywords": [
        "query message log",
        "문자 발송 기록",
        "알림톡 발송",
        "발송 이력",
        "발송 실패",
        "메시지 로그",
    ],
    "boundaries": "발송 기록 조회만 — 재발송·발송 실행은 불가. 검사·서식 발송 원본으로는 못 거름(발송 연계 참조는 미노출) — 수신자 전화번호·템플릿·기간으로 조회.",
    "output": "{rows: 발송 기록 dict 배열 (fields로 절삭)., aggregate: {count(전체 건수), exact(false면 하한)}}",
    "input_schema": {
        "type": "object",
        "properties": {
            "message_type": {
                "type": "string",
                "title": "메시지 유형",
                "enum": ["alarmtalk", "sms", "lms"],
                "description": "'알림톡'→alarmtalk, 'SMS/문자'→sms, 'LMS/장문'→lms",
            },
            "status": {
                "type": "string",
                "title": "발송 상태",
                "enum": ["pending", "sent", "failed", "cancelled"],
                "description": "'대기중'→pending, '발송됨/성공'→sent, '실패'→failed, '취소'→cancelled",
            },
            "recipient": {
                "type": "string",
                "title": "수신자 전화번호 검색",
            },
            "template_code": {
                "type": "string",
                "title": "템플릿 코드 검색",
            },
            "keyword": {
                "type": "string",
                "title": "본문·오류 메시지 검색",
                "description": "message·error_message 대상 부분 검색",
            },
            "attempts_min": {"type": "integer", "title": "시도 횟수 하한"},
            "attempts_max": {"type": "integer", "title": "시도 횟수 상한"},
            "sent_from": {"type": "string", "format": "date", "title": "발송일 시작"},
            "sent_to": {"type": "string", "format": "date", "title": "발송일 종료"},
            "scheduled_from": {"type": "string", "format": "date", "title": "예약일 시작"},
            "scheduled_to": {"type": "string", "format": "date", "title": "예약일 종료"},
            "date_from": {"type": "string", "format": "date", "title": "등록일 시작"},
            "date_to": {"type": "string", "format": "date", "title": "등록일 종료"},
            "id": {"type": "string", "format": "uuid", "title": "발송 기록 ID"},
            "ids": {
                "type": "array",
                "items": {"type": "string", "format": "uuid"},
                "title": "발송 기록 ID 복수",
            },
            "sort": {
                "type": "string",
                "title": "정렬",
                "enum": [
                    "latest",
                    "oldest",
                    "attempts_high",
                    "attempts_low",
                    "sent_earliest",
                    "sent_latest",
                    "scheduled_earliest",
                    "scheduled_latest",
                ],
                "description": "'최신순'→latest(기본), '시도 많은순'→attempts_high, '발송 이른순'→sent_earliest, '발송 최근순'→sent_latest, '예약 임박순'→scheduled_earliest, '예약 늦은순'→scheduled_latest",
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
