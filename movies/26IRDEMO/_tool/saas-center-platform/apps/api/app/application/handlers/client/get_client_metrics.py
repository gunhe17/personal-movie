# counseling/assessment/schedule 데이터를 집계하는 크로스 모듈 핸들러.
from datetime import date, datetime, time, timedelta

from app.core.datetime_utils import kst_to_utc_naive, utc_now
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.facade import (
    AssessmentCaseParticipantFacade,
    AssessmentSessionFacade,
)
from app.modules.client.profile.schemas import (
    ClientMetricsResponse,
    MonthlySessionMetric,
)
from app.modules.counseling.facade import (
    CounselingCaseFacade,
    CounselingSessionFacade,
)
from app.modules.schedule.facade import ScheduleFacade


def _kst_month_bounds_utc_naive() -> tuple[datetime, datetime, datetime]:
    # 월 경계는 KST 기준으로 잡되 UTC naive로 반환한다 (DB가 UTC naive 저장).
    now_kst = utc_now() + timedelta(hours=9)
    y, m = now_kst.year, now_kst.month

    month_start_kst = date(y, m, 1)
    next_month_start_kst = date(y + 1, 1, 1) if m == 12 else date(y, m + 1, 1)
    prev_month_start_kst = date(y - 1, 12, 1) if m == 1 else date(y, m - 1, 1)

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


async def get_client_metrics_handler(
    center_id: str,
    client_id: str,
    uow: UnitOfWork,
) -> ClientMetricsResponse:
    counseling_case_facade = CounselingCaseFacade(uow)
    counseling_session_facade = CounselingSessionFacade(uow)
    assessment_participant_facade = AssessmentCaseParticipantFacade(uow)
    assessment_session_facade = AssessmentSessionFacade(uow)
    schedule_facade = ScheduleFacade(uow)

    prev_month_start, month_start, next_month_start = _kst_month_bounds_utc_naive()
    empty = MonthlySessionMetric(completed=0, scheduled=0, total=0, prev_total=0)

    counseling_case_ids = await counseling_case_facade.list_case_ids_by_participant_ids(
        [client_id], center_id
    )

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

    assessment_case_ids = (
        await assessment_participant_facade.list_case_ids_by_client_ids(
            center_id, [client_id]
        )
    )

    assessment_metric = empty
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

    return ClientMetricsResponse(
        counseling_case_count=len(counseling_case_ids),
        assessment_case_count=len(assessment_case_ids),
        counseling=counseling_metric,
        assessment=assessment_metric,
    )


TOOL = {
    "name": "get_client_metrics_handler",
    "permission": "read:client",
    "purpose": "내담자의 상담·검사·출결 등 활동 지표를 조회한다.",
    "keywords": [
        "get client metrics",
        "내담자 지표",
        "고객 통계",
        "내담자 활동",
        "상담 횟수",
        "내담자 metrics",
        "고객 지표",
    ],
    "boundaries": "한 내담자의 '집계 지표'만 본다(읽기 전용). 주의 신호는 get_client_signals_handler, 결제 요약은 get_billing_summary_handler.",
    "output": "활동 집계 지표 (ClientMetricsResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 내담자",
                "description": "지표를 조회할 내담자의 UUID.",
            },
        },
        "required": ["client_id"],
    },
}
