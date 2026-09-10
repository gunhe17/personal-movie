from datetime import date, datetime, time, timedelta

from app.core.datetime_utils import kst_to_utc_naive, utc_now
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.facade import (
    AssessmentCaseFacade,
    AssessmentSessionFacade,
)
from app.modules.center.facade import MemberFacade
from app.modules.center.member.schemas import (
    MemberMetricsResponse,
    MonthlySessionMetric,
)
from app.modules.counseling.facade import (
    CounselingCaseFacade,
    CounselingSessionFacade,
)
from app.modules.schedule.facade import ScheduleFacade


def _kst_month_bounds_utc_naive() -> tuple[datetime, datetime, datetime]:
    # utc_now()는 UTC naive. KST = UTC + 9h 이므로 9시간 더해 KST 달력 날짜를 구한다.
    now_kst = utc_now() + timedelta(hours=9)
    y, m = now_kst.year, now_kst.month

    month_start_kst = date(y, m, 1)
    next_month_start_kst = date(y + 1, 1, 1) if m == 12 else date(y, m + 1, 1)
    prev_month_start_kst = date(y - 1, 12, 1) if m == 1 else date(y, m - 1, 1)

    # KST 자정 → UTC naive 변환 (DB 저장값과 동일 기준)
    prev_month_start = kst_to_utc_naive(prev_month_start_kst, time(0, 0))
    month_start = kst_to_utc_naive(month_start_kst, time(0, 0))
    next_month_start = kst_to_utc_naive(next_month_start_kst, time(0, 0))
    return prev_month_start, month_start, next_month_start


def _summarize_monthly_sessions(
    sessions: list,
    schedule_start_by_id: dict[str, datetime | None],
    prev_month_start: datetime,
    month_start: datetime,
    next_month_start: datetime,
) -> MonthlySessionMetric:
    # 집계 기준은 Schedule.start. total은 취소·노쇼 포함 전체, prev_total은 지난 달 증감 비교용.
    completed = 0
    scheduled = 0
    total = 0
    prev_total = 0
    for s in sessions:
        start = schedule_start_by_id.get(s.schedule_id)
        if start is None:
            continue
        if month_start <= start < next_month_start:
            total += 1
            if s.status == "completed":
                completed += 1
            elif s.status == "scheduled":
                scheduled += 1
        elif prev_month_start <= start < month_start:
            prev_total += 1
    return MonthlySessionMetric(
        completed=completed,
        scheduled=scheduled,
        total=total,
        prev_total=prev_total,
    )


async def get_member_metrics_handler(
    center_id: str,
    member_id: str,
    uow: UnitOfWork,
) -> MemberMetricsResponse:
    member_facade = MemberFacade(uow)
    counseling_case_facade = CounselingCaseFacade(uow)
    counseling_session_facade = CounselingSessionFacade(uow)
    assessment_case_facade = AssessmentCaseFacade(uow)
    assessment_session_facade = AssessmentSessionFacade(uow)
    schedule_facade = ScheduleFacade(uow)

    await member_facade.get_member_validated(member_id, center_id)

    prev_month_start, month_start, next_month_start = _kst_month_bounds_utc_naive()
    empty = MonthlySessionMetric(completed=0, scheduled=0, total=0, prev_total=0)

    counseling_case_summaries = (
        await counseling_case_facade.list_all_cases_summary_by_counselor(
            center_id, member_id
        )
    )
    counseling_case_ids = [c_id for c_id, _pid in counseling_case_summaries]

    assigned_clients_count = 0
    if counseling_case_ids:
        client_ids_by_case = (
            await counseling_case_facade.aggregate_active_client_ids_by_case_ids(
                counseling_case_ids
            )
        )
        unique_client_ids: set[str] = set()
        for client_ids in client_ids_by_case.values():
            unique_client_ids.update(client_ids)
        assigned_clients_count = len(unique_client_ids)

    counseling_metric = empty
    if counseling_case_ids:
        sessions = await counseling_session_facade.get_sessions_by_case_ids(
            counseling_case_ids
        )
        schedule_ids = [s.schedule_id for s in sessions if s.schedule_id]
        start_by_id: dict[str, datetime | None] = {}
        if schedule_ids:
            schedules = await schedule_facade.list_schedules_by_ids(schedule_ids)
            start_by_id = {sch.id: sch.start for sch in schedules}
        counseling_metric = _summarize_monthly_sessions(
            sessions,
            start_by_id,
            prev_month_start,
            month_start,
            next_month_start,
        )

    assessment_metric = empty
    assessment_case_ids = await assessment_case_facade.list_case_ids_by_counselor(
        center_id, member_id
    )
    if assessment_case_ids:
        a_sessions = await assessment_session_facade.get_sessions_by_case_ids(
            assessment_case_ids
        )
        a_schedule_ids = [s.schedule_id for s in a_sessions if s.schedule_id]
        a_start_by_id: dict[str, datetime | None] = {}
        if a_schedule_ids:
            a_schedules = await schedule_facade.list_schedules_by_ids(a_schedule_ids)
            a_start_by_id = {sch.id: sch.start for sch in a_schedules}
        assessment_metric = _summarize_monthly_sessions(
            a_sessions,
            a_start_by_id,
            prev_month_start,
            month_start,
            next_month_start,
        )

    return MemberMetricsResponse(
        assigned_clients_count=assigned_clients_count,
        counseling=counseling_metric,
        assessment=assessment_metric,
    )


TOOL = {
    "name": "get_member_metrics_handler",
    "permission": "read:member",
    "purpose": "센터 멤버(상담사)의 이번 달·지난 달 상담·검사 회기 실적과 담당 내담자 수 지표를 조회한다.",
    "keywords": [
        "get member metrics",
        "멤버 실적",
        "상담사 지표",
        "직원 통계",
        "회기 실적",
        "담당 내담자 수",
        "이번달 상담 수",
        "활동 지표",
        "지난달보다",
        "지난달 대비",
        "늘었어",
        "제일 바쁜",
        "가장 많이",
        "member metrics",
    ],
    "boundaries": "한 멤버의 '월별 집계 지표'(상담/검사 완료·예정 회기 수, 전월 대비, 담당 내담자 수)만 본다. 멤버 기본 정보·프로필은 get_member_detail_handler를 쓴다. 읽기 전용이다.",
    "output": "멤버 활동 지표 (MemberMetricsResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "member_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 멤버",
                "description": "지표를 조회할 멤버(상담사)의 UUID. 현재 센터 범위 안에서 해석된다.",
            },
        },
        "required": ["member_id"],
    },
}
