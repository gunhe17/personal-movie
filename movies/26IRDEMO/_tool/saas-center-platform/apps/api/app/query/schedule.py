"""query_schedule — 일정 조회 (레이어 면제 구역, ARCHITECTURE.md EX-11)."""

from datetime import date, datetime, time

from sqlalchemy import literal_column, or_, select
from sqlalchemy.dialects.postgresql import aggregate_order_by
from sqlalchemy.orm import aliased
from sqlalchemy.sql import func

from app.core.datetime_utils import coerce_date
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.assessment_case.models import AssessmentCase
from app.modules.assessment.assessment_case_participant.models import (
    AssessmentCaseParticipant,
)
from app.modules.assessment.assessment_session.models import AssessmentSession
from app.modules.center.member.models import Member
from app.modules.center.room.models import Room
from app.modules.client.profile.models import Client
from app.modules.counseling.counseling_case.models import CounselingCase
from app.modules.counseling.counseling_case_participant.models import (
    CaseParticipantType,
    CounselingCaseParticipant,
)
from app.modules.counseling.counseling_session.models import CounselingSession
from app.modules.person.person.models import Person
from app.modules.schedule.schedule.models import Schedule
from app.infrastructure.persistence.agent_query import fetch

async def query_schedule_handler(
    center_id: str,
    *,
    owner_scope: str | None = None,
    schedule_type: str | None = None,
    title: str | None = None,
    memo: str | None = None,
    date_from: str | date | None = None,
    date_to: str | date | None = None,
    member_ids: list[str] | None = None,
    room_id: str | None = None,
    limit: int | None = None,
    sort: str | None = None,
    fields: list[str] | None = None,
    uow: UnitOfWork,
    namespaced: bool = True,
) -> dict:
    namespace = "schedule"
    # D13 쌍 — member_name·room_name·client_names의 원천 id는 fields 절삭과 무관하게 동반
    identity = (
        "id",
        "title",
        "start",
        "end",
        "member_id",
        "room_id",
    )
    opt_in = ("memo",)  # select엔 있으나 기본 출력에선 빠짐 — fields로만

    sorts = {
        "latest": Schedule.start.desc(),
        "oldest": Schedule.start.asc(),
    }
    cancelled = "cancelled"

    def own_schedule_ids(member_id: str):
        """공동 담당으로 참여한 회기의 일정 id — 일정 소유자(member_id)는 주담당 1인뿐이라 별도 합류."""
        CounselorParticipant = aliased(CounselingCaseParticipant)
        AssistantParticipant = aliased(AssessmentCaseParticipant)
        counseling_cases = select(CounselingCase.id).where(
            CounselingCase.center_id == center_id,
            CounselingCase.counselor_id == member_id,
            CounselingCase.deleted_at.is_(None),
        ).union(
            select(CounselorParticipant.counseling_case_id).where(
                CounselorParticipant.center_id == center_id,
                CounselorParticipant.participant_id == member_id,
                CounselorParticipant.participant_type == CaseParticipantType.COUNSELOR.value,
                CounselorParticipant.is_active.is_(True),
                CounselorParticipant.deleted_at.is_(None),
            )
        )
        assessment_cases = select(AssessmentCase.id).where(
            AssessmentCase.center_id == center_id,
            AssessmentCase.counselor_id == member_id,
            AssessmentCase.deleted_at.is_(None),
        ).union(
            select(AssistantParticipant.case_id).where(
                AssistantParticipant.center_id == center_id,
                AssistantParticipant.participant_id == member_id,
                AssistantParticipant.participant_type == "assistant",  # 검사 참여자엔 is_active 없음(모델 비대칭)
                AssistantParticipant.deleted_at.is_(None),
            )
        )
        return select(CounselingSession.schedule_id).where(
            CounselingSession.counseling_case_id.in_(counseling_cases),
            CounselingSession.deleted_at.is_(None),
            CounselingSession.schedule_id.isnot(None),
        ).union(
            select(AssessmentSession.schedule_id).where(
                AssessmentSession.case_id.in_(assessment_cases),
                AssessmentSession.deleted_at.is_(None),
                AssessmentSession.schedule_id.isnot(None),
            )
        )

    def client_names():
        """union을 subquery로 감싸면 바깥 Schedule과의 상관이 끊겨 전체 내담자를 긁는다(2026-08-20 실측) — 그래서 경로별 상관 스칼라 서브쿼리 + array_cat."""
        CounselingSess = aliased(CounselingSession)
        CounselingClientParticipant = aliased(CounselingCaseParticipant)
        CounselingClient = aliased(Client)
        counseling = (
            select(
                func.coalesce(
                    func.array_remove(
                        func.array_agg(
                            aggregate_order_by(CounselingClient.name, CounselingClient.id)
                        ),
                        None,
                    ),
                    literal_column("'{}'::text[]"),
                )
            )
            .select_from(CounselingSess)
            .join(
                CounselingClientParticipant,
                (
                    CounselingClientParticipant.counseling_case_id
                    == CounselingSess.counseling_case_id
                )
                & (
                    CounselingClientParticipant.participant_type
                    == CaseParticipantType.CLIENT.value
                )
                & CounselingClientParticipant.is_active.is_(True)
                & CounselingClientParticipant.deleted_at.is_(None),
            )
            .join(
                CounselingClient,
                CounselingClient.id == CounselingClientParticipant.participant_id,
            )
            .where(
                CounselingSess.schedule_id == Schedule.id,
                CounselingSess.status != cancelled,
                CounselingSess.deleted_at.is_(None),
            )
            .correlate(Schedule)
            .scalar_subquery()
        )
        AssessmentSess = aliased(AssessmentSession)
        AssessmentClientParticipant = aliased(AssessmentCaseParticipant)
        AssessmentClient = aliased(Client)
        assessment = (
            select(
                func.coalesce(
                    func.array_remove(
                        func.array_agg(
                            aggregate_order_by(AssessmentClient.name, AssessmentClient.id)
                        ),
                        None,
                    ),
                    literal_column("'{}'::text[]"),
                )
            )
            .select_from(AssessmentSess)
            .join(
                AssessmentClientParticipant,
                (AssessmentClientParticipant.case_id == AssessmentSess.case_id)
                & (AssessmentClientParticipant.participant_type == "client")
                & AssessmentClientParticipant.deleted_at.is_(None),
            )
            .join(
                AssessmentClient,
                AssessmentClient.id == AssessmentClientParticipant.participant_id,
            )
            .where(
                AssessmentSess.schedule_id == Schedule.id,
                AssessmentSess.status != cancelled,
                AssessmentSess.deleted_at.is_(None),
            )
            .correlate(Schedule)
            .scalar_subquery()
        )
        return func.array_cat(counseling, assessment)

    # filters
    where = [
        Schedule.center_id == center_id,
        Schedule.deleted_at.is_(None),
    ]

    today = date.today()  # 기본 창 ±1년 (구 facade 동치) — 겹침 판정
    lo = coerce_date(date_from, "date_from") or today.replace(year=today.year - 1)
    hi = coerce_date(date_to, "date_to") or today.replace(year=today.year + 1)
    where += [
        Schedule.start < datetime.combine(hi, time.max),
        Schedule.end > datetime.combine(lo, time.min),
    ]

    if schedule_type:
        where.append(Schedule.schedule_type == schedule_type)
    if title:
        where.append(Schedule.title.ilike(f"%{title}%"))
    if memo:
        where.append(Schedule.memo.ilike(f"%{memo}%"))
    if room_id:
        where.append(Schedule.room_id == room_id)

    # scope
    if owner_scope is not None:
        where.append(
            or_(
                Schedule.member_id == owner_scope,
                Schedule.id.in_(own_schedule_ids(owner_scope)),
            )
        )
    elif member_ids:
        where.append(Schedule.member_id.in_(member_ids))

    # project
    stmt = (
        select(
            Schedule.id,
            Schedule.title,
            Schedule.start,
            Schedule.end,
            Schedule.member_id,
            Schedule.room_id,
            Schedule.schedule_type,
            Schedule.memo,
            Person.name.label("member_name"),
            Room.name.label("room_name"),
            client_names().label("client_names"),
        )
        .outerjoin(Member, Member.id == Schedule.member_id)
        .outerjoin(Person, Person.id == Member.person_id)
        .outerjoin(Room, Room.id == Schedule.room_id)
        .where(*where)
        .order_by(sorts.get(sort or "oldest", sorts["oldest"]), Schedule.id)
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
    "name": "query_schedule_handler",
    "permission": "read:schedule",
    "purpose": "일정을 기간·유형·담당자·룸으로 유연 조회한다.",
    "keywords": [
        "query schedule",
        "일정 조회",
        "스케줄",
        "캘린더",
        "예약",
        "일정 검색",
    ],
    "boundaries": "읽기 전용 단일 엔티티 유연 조회. 세션·내담자까지 엮은 캘린더 합성 뷰는 list_schedules_handler. 일정으로는 내담자를 직접 거를 수 없음(다홉) — 내담자 기준은 query_counseling_session(client_id).",
    "output": "{rows: 일정 dict 배열 (fields로 절삭). 정렬: 시작시각 오름차순(다가오는 순). 행에 member_name·room_name·client_names(참여 내담자 이름 리스트) 동반., aggregate: {count(전체 건수), exact(false면 하한)}}",
    "input_schema": {
        "type": "object",
        "properties": {
            "schedule_type": {
                "type": "string",
                "title": "유형",
                "enum": ["assessment", "counseling", "meeting", "block"],
            },
            "memo": {"type": "string", "title": "메모 키워드"},
            "title": {"type": "string", "title": "제목 검색"},
            "date_from": {"type": "string", "format": "date", "title": "시작일"},
            "date_to": {"type": "string", "format": "date", "title": "종료일"},
            "member_ids": {
                "type": "array",
                "items": {"type": "string", "format": "uuid"},
                "title": "담당 멤버 필터",
            },
            "room_id": {"type": "string", "format": "uuid", "title": "룸 필터"},
            "limit": {"type": "integer", "title": "최대 개수"},
            "sort": {
                "type": "string",
                "title": "정렬",
                "enum": ["latest", "oldest"],
                "description": "'최신순'→latest(일정 시각 기준), '오래된 순'→oldest",
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
