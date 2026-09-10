from datetime import date, datetime, time

from sqlalchemy import literal, select
from sqlalchemy.dialects.postgresql import aggregate_order_by
from sqlalchemy.orm import aliased
from sqlalchemy.sql import func

from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.client.profile.models import Client
from app.modules.counseling.counseling_case.models import CounselingCase
from app.modules.counseling.counseling_case_participant.models import (
    CaseParticipantType,
    CounselingCaseParticipant,
)
from app.modules.counseling.counseling_session.models import CounselingSession
from app.modules.schedule.schedule.models import Schedule
from app.infrastructure.persistence.agent_query import fetch


async def query_counseling_session_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,
    status: str | None = None,
    session_number_min: int | None = None,
    session_number_max: int | None = None,
    client_id: str | None = None,
    counseling_case_id: str | None = None,
    counseling_case_ids: list[str] | None = None,
    schedule_id: str | None = None,
    schedule_ids: list[str] | None = None,
    date_from: str | date | None = None,
    date_to: str | date | None = None,
    completed_from: str | date | None = None,
    completed_to: str | date | None = None,
    sort: str | None = None,
    limit: int | None = None,
    fields: list[str] | None = None,
    uow: UnitOfWork,
    namespaced: bool = True,
) -> dict:
    namespace = "session"
    # D13 쌍 — 표시명(schedule_name·client_names/ids)의 원천 id는 fields 절삭과 무관하게 동반
    identity = (
        "id",
        "session_number",
        "schedule_id",
        "counseling_case_id",
    )
    opt_in = ("cancel_reason",)  # select엔 있으나 기본 출력에선 빠짐 — fields로만

    # 정렬 어휘 SSOT — TOOL sort enum도 여기서 나온다
    sorts = {
        "latest": CounselingSession.created_at.desc(),
        "oldest": CounselingSession.created_at.asc(),
        "completed_latest": CounselingSession.completed_at.desc(),
        "completed_earliest": CounselingSession.completed_at.asc(),
    }

    # "MM-DD HH:MM · {title}" (title 없으면 시각만) — ScheduleFacade.get_schedule_summaries_by_ids 동치
    schedule_name = func.to_char(Schedule.start, "MM-DD HH24:MI").concat(
        func.coalesce(literal(" · ").concat(Schedule.title), "")
    )

    def accessible_case_ids(member_id: str):
        """열람 범위 = 주담당 + **활성** 공동 상담사 (쓰기 범위=주담당 전용과 다르다).

        CounselingCaseFacade.list_accessible_case_ids 동치 — 동치성은 G2 테스트가 핀한다.
        소비자가 2개째가 되면 app/query/scope.py로 추출.
        """
        CounselorParticipant = aliased(CounselingCaseParticipant)  # 바깥 FROM과 자동 correlate 방지
        return (
            select(CounselingCase.id)
            .where(
                CounselingCase.center_id == center_id,
                CounselingCase.counselor_id == member_id,
                CounselingCase.deleted_at.is_(None),
            )
            .union(
                select(CounselorParticipant.counseling_case_id).where(
                    CounselorParticipant.center_id == center_id,
                    CounselorParticipant.participant_id == member_id,
                    CounselorParticipant.participant_type == CaseParticipantType.COUNSELOR.value,
                    CounselorParticipant.is_active.is_(True),
                    CounselorParticipant.deleted_at.is_(None),
                )
            )
        )

    # filters
    where = [CounselingSession.center_id == center_id, CounselingSession.deleted_at.is_(None)]

    if status:
        where.append(CounselingSession.status == status)
    if session_number_min is not None:
        where.append(CounselingSession.session_number >= session_number_min)
    if session_number_max is not None:
        where.append(CounselingSession.session_number <= session_number_max)
    if counseling_case_id:
        where.append(CounselingSession.counseling_case_id == counseling_case_id)
    if counseling_case_ids:
        where.append(CounselingSession.counseling_case_id.in_(counseling_case_ids))
    if schedule_id:
        where.append(CounselingSession.schedule_id == schedule_id)
    if schedule_ids:
        where.append(CounselingSession.schedule_id.in_(schedule_ids))
    if date_from:
        where.append(Schedule.start >= coerce_date(date_from, "date_from"))
    if date_to:
        where.append(Schedule.start <= datetime.combine(coerce_date(date_to, "date_to"), time.max))
    if completed_from:
        where.append(
            CounselingSession.completed_at >= coerce_date(completed_from, "completed_from")
        )
    if completed_to:
        where.append(CounselingSession.completed_at <= datetime.combine(coerce_date(completed_to, "completed_to"), time.max))

    # 내담자의 회기 — 참여 케이스 전체 역산(구 facade 역조인 동치)
    if client_id:
        ClientParticipant = aliased(CounselingCaseParticipant)
        where.append(
            CounselingSession.counseling_case_id.in_(
                select(ClientParticipant.counseling_case_id).where(
                    ClientParticipant.center_id == center_id,
                    ClientParticipant.participant_id == client_id,
                    ClientParticipant.participant_type == CaseParticipantType.CLIENT.value,
                    ClientParticipant.deleted_at.is_(None),
                )
            )
        )

    # scope
    if owner_scope:
        where.append(CounselingSession.counseling_case_id.in_(accessible_case_ids(owner_scope)))

    # project
    stmt = (
        select(
            CounselingSession.id,
            CounselingSession.status,
            CounselingSession.session_number,
            CounselingSession.completed_at,
            CounselingSession.cancel_reason,
            CounselingSession.counseling_case_id,
            CounselingSession.schedule_id,
            CounselingCase.case_code.label("case_code"),
            schedule_name.label("schedule_name"),
            func.array_remove(func.array_agg(aggregate_order_by(Client.id, Client.id)), None).label(
                "client_ids"
            ),
            func.array_remove(
                func.array_agg(aggregate_order_by(Client.name, Client.id)), None
            ).label("client_names"),
        )
        .join(CounselingCase, CounselingCase.id == CounselingSession.counseling_case_id)
        .outerjoin(Schedule, Schedule.id == CounselingSession.schedule_id)
        .outerjoin(
            CounselingCaseParticipant,
            (CounselingCaseParticipant.counseling_case_id == CounselingSession.counseling_case_id)
            & (CounselingCaseParticipant.participant_type == CaseParticipantType.CLIENT.value)
            & CounselingCaseParticipant.is_active.is_(True)
            & CounselingCaseParticipant.deleted_at.is_(None),
        )
        .outerjoin(Client, Client.id == CounselingCaseParticipant.participant_id)
        .where(*where)
        .group_by(CounselingSession.id, CounselingCase.case_code, Schedule.start, Schedule.title)
        .order_by(sorts.get(sort or "latest", sorts["latest"]), CounselingSession.id)
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
    "name": "query_counseling_session_handler",
    "permission": "read:counseling",
    "purpose": "상담 회기를 상태·회기번호·기간으로 유연 조회한다.",
    "keywords": [
        "query counseling session",
        "상담 회기",
        "회기 조회",
        "노쇼 회기",
        "마지막 회기",
        "완료된 회기",
    ],
    "boundaries": "읽기 전용 회기 조회. 내담자의 회기는 client_id 하나로 직행(서버가 참여 케이스 전체 조인 — participant 수동 연쇄 불요). 케이스 코드는 query_case_handler로 id 확인.",
    "output": "{rows: 회기 dict 배열 (fields로 절삭). 기본 정렬: created_at 최신순(desc). 행에 case_code·schedule_name·client_ids/client_names(참여 내담자 id·이름 목록) 동반., aggregate: {count(전체 건수), exact(false면 하한)}}",
    "input_schema": {
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "title": "상태",
                "enum": ["scheduled", "completed", "cancelled", "no_show"],
            },
            "session_number_min": {"type": "integer", "title": "회기 번호 하한"},
            "session_number_max": {"type": "integer", "title": "회기 번호 상한"},
            "date_from": {"type": "string", "format": "date", "title": "기간 시작일"},
            "date_to": {"type": "string", "format": "date", "title": "기간 종료일"},
            "counseling_case_id": {
                "type": "string",
                "format": "uuid",
                "title": "케이스 UUID",
            },
            "client_id": {
                "type": "string",
                "format": "uuid",
                "title": "내담자 UUID",
                "description": "내담자의 회기 — 참여 케이스 전체를 서버가 조인(participant 경유 불요)",
            },
            "counseling_case_ids": {
                "type": "array",
                "items": {"type": "string"},
                "title": "케이스 UUID 목록",
            },
            "schedule_id": {"type": "string", "format": "uuid", "title": "일정 UUID"},
            "schedule_ids": {
                "type": "array",
                "items": {"type": "string"},
                "title": "일정 UUID 목록",
            },
            "completed_from": {
                "type": "string",
                "format": "date",
                "title": "완료일 시작",
            },
            "completed_to": {
                "type": "string",
                "format": "date",
                "title": "완료일 종료",
            },
            "sort": {
                "type": "string",
                "enum": ["latest", "oldest", "completed_earliest", "completed_latest"],
                "title": "정렬",
                "description": "'최신순/마지막'→latest(기본), '오래된 순/처음부터'→oldest, '완료 이른순'→completed_earliest, '완료 최근순'→completed_latest",
            },
            "limit": {
                "type": "integer",
                "title": "최대 개수",
                "description": "'마지막/최근 회기'는 limit 1. '첫 회기'는 session_number_max 1",
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
