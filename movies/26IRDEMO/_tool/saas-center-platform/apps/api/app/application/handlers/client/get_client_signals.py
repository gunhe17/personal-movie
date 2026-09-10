# 단일 내담자 컨텍스트의 신호 합성 — 횡단(여러 내담자) 발견은 list_favorites_handler 담당.
# Best-effort: 어느 도메인 조회가 실패해도 나머지 신호는 그대로 반환한다.
from datetime import datetime

from app.core.datetime_utils import utc_now
from app.core.logger import get_logger
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.facade.assessment_case_facade import AssessmentCaseFacade
from app.modules.billing.facade.billable_facade import BillableFacade
from app.modules.counseling.facade.counseling_session_facade import (
    CounselingSessionFacade,
)
from app.modules.schedule.facade.schedule_facade import ScheduleFacade
from app.modules.client.favorite.schemas import (
    ClientSignal,
    ClientSignalListResponse,
)
from app.infrastructure.persistence.new_repository import single_page

logger = get_logger(__name__)


async def get_client_signals_handler(
    center_id: str,
    client_id: str,
    uow: UnitOfWork,
) -> ClientSignalListResponse:
    # append 순서 = 표시 우선순위.
    signals: list[ClientSignal] = []

    try:
        counseling_facade = CounselingSessionFacade(uow)
        schedule_facade = ScheduleFacade(uow)
        today_str = utc_now().date().isoformat()
        schedule_ids_today = await schedule_facade.list_schedule_ids_by_date_range(
            center_id, "counseling", today_str, today_str
        )
        schedule_start_map: dict[str, datetime] = {}
        if schedule_ids_today:
            schedules = await schedule_facade.list_schedules_by_ids(schedule_ids_today)
            schedule_start_map = {s.id: s.start for s in schedules}

        today_map = await counseling_facade.aggregate_today_sessions_per_client(
            center_id, [client_id], schedule_ids_today, schedule_start_map
        )
        if client_id in today_map:
            today_session = today_map[client_id]
            signals.append(
                ClientSignal(
                    type="session_today",
                    icon_name="time-outline",
                    detail=f"오늘 {_format_time_kst(today_session.start)} 상담",
                    action="지난 일지를 검토해 주세요",
                    session_id=today_session.session_id,
                    session_start=today_session.start,
                )
            )
    except Exception:
        logger.exception("[signals] session_today 조회 실패")

    try:
        counseling_facade = CounselingSessionFacade(uow)
        unlogged_map = await counseling_facade.aggregate_latest_unlogged_per_client(
            center_id, [client_id]
        )
        if client_id in unlogged_map:
            unlogged = unlogged_map[client_id]
            signals.append(
                ClientSignal(
                    type="log_missing",
                    icon_name="document-text-outline",
                    detail=f"{_format_relative_date(unlogged.completed_at)} 상담",
                    action="일지를 작성해 주세요",
                    session_id=unlogged.session_id,
                    session_start=unlogged.completed_at,
                )
            )
    except Exception:
        logger.exception("[signals] log_missing 조회 실패")

    try:
        assessment_facade = AssessmentCaseFacade(uow)
        unshared_map = await assessment_facade.aggregate_unshared_completed_per_client(
            center_id, [client_id]
        )
        if client_id in unshared_map:
            unshared = unshared_map[client_id]
            signals.append(
                ClientSignal(
                    type="assessment_result_ready",
                    icon_name="analytics-outline",
                    detail=f"{_format_relative_date(unshared.completed_at)} 검사 완료",
                    action="결과를 공유해 주세요",
                    assessment_case_id=unshared.case_id,
                )
            )
    except Exception:
        logger.exception("[signals] assessment_result_ready 조회 실패")

    try:
        billing_facade = BillableFacade(uow)
        unpaid = await billing_facade.get_client_unpaid_summary(
            center_id=center_id, client_id=client_id
        )
        if unpaid.unpaid_count > 0:
            detail = f"{unpaid.unpaid_amount:,}원"
            if unpaid.oldest_issued_at:
                days = (utc_now().date() - unpaid.oldest_issued_at.date()).days
                if days > 0:
                    detail += f" · {days}일 경과"
            signals.append(
                ClientSignal(
                    type="billing_unpaid",
                    icon_name="card-outline",
                    detail=detail,
                    action="결제를 안내해 주세요",
                )
            )
    except Exception:
        logger.exception("[signals] billing_unpaid 조회 실패")

    return ClientSignalListResponse(items=signals, **single_page(signals))


def _format_time_kst(dt: datetime) -> str:
    # DB는 UTC naive 저장이라 +9로 KST 변환.
    kst_hour = (dt.hour + 9) % 24
    return f"{kst_hour:02d}:{dt.minute:02d}"


def _format_relative_date(dt: datetime | None) -> str:
    if dt is None:
        return ""
    now = utc_now()
    delta_days = (now.date() - dt.date()).days
    if delta_days <= 0:
        return "오늘"
    if delta_days == 1:
        return "어제"
    if delta_days < 7:
        return f"{delta_days}일 전"
    return f"{dt.year}.{dt.month:02d}.{dt.day:02d}"


TOOL = {
    "name": "get_client_signals_handler",
    "permission": "read:client",
    "purpose": "내담자와 관련된 주의 신호(미납·결석·검사 미확인 등)를 조회한다.",
    "keywords": [
        "get client signals",
        "내담자 신호",
        "주의 사항",
        "내담자 알림",
        "위험 신호",
        "챙길 것",
        "client signals",
    ],
    "boundaries": "한 내담자의 '주의 신호'만 모아 본다(읽기 전용). 회기 직전 준비 신호는 get_prep_signals_handler, 일반 지표는 get_client_metrics_handler.",
    "output": "주의 신호 목록 (ClientSignalListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 내담자",
                "description": "신호를 조회할 내담자의 UUID.",
            },
        },
        "required": ["client_id"],
    },
}
