from datetime import datetime

from app.core.datetime_utils import utc_now
from app.core.logger import get_logger
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.client.favorite.schemas import (
    ClientFavoriteListResponse,
    ClientSignal,
    FavoriteClientSummary,
)
from app.infrastructure.persistence.new_repository import single_page
from app.modules.client.facade import ClientFacade
from app.modules.assessment.facade.assessment_case_facade import AssessmentCaseFacade
from app.modules.counseling.facade.counseling_session_facade import (
    CounselingSessionFacade,
)
from app.modules.schedule.facade.schedule_facade import ScheduleFacade

logger = get_logger(__name__)


async def list_favorites_handler(
    person_id: str,
    center_id: str,
    uow: UnitOfWork,
) -> ClientFavoriteListResponse:
    # 신호는 client별 1개(우선순위: session_today > log_missing > assessment_result_ready).
    # Best-effort: 신호 계산이 실패해도 favorites 본 응답(카드)은 보존한다.
    client_facade = ClientFacade(uow)

    favorites = await client_facade.list_favorites(person_id, center_id)
    logger.info(
        "[favorites/list] person_id=%s center_id=%s → %d favorites",
        person_id,
        center_id,
        len(favorites),
    )
    if not favorites:
        return ClientFavoriteListResponse(items=[], **single_page([]))

    ordered_ids = [f.client_id for f in favorites]
    clients = await client_facade.list_clients_by_ids(ordered_ids)

    # favorites가 최신순이므로 그 순서를 유지하도록 정렬
    position = {cid: i for i, cid in enumerate(ordered_ids)}
    clients.sort(key=lambda c: position.get(c.id, len(ordered_ids)))

    signal_map: dict[str, ClientSignal] = await _build_signal_map_safe(
        uow, center_id, ordered_ids
    )

    items: list[FavoriteClientSummary] = []
    for c in clients:
        summary = FavoriteClientSummary.model_validate(c)
        summary.is_favorited = True
        summary.signal = signal_map.get(c.id)
        items.append(summary)

    return ClientFavoriteListResponse(items=items, **single_page(items))


async def _build_signal_map_safe(
    uow: UnitOfWork,
    center_id: str,
    client_ids: list[str],
) -> dict[str, ClientSignal]:
    # 신호 합성 best-effort — 어떤 도메인 facade가 실패해도 빈 dict로 폴백.
    try:
        assessment_facade = AssessmentCaseFacade(uow)
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

        today_sessions = await counseling_facade.aggregate_today_sessions_per_client(
            center_id, client_ids, schedule_ids_today, schedule_start_map
        )
        unlogged_sessions = (
            await counseling_facade.aggregate_latest_unlogged_per_client(
                center_id, client_ids
            )
        )
        unshared_assessments = (
            await assessment_facade.aggregate_unshared_completed_per_client(
                center_id, client_ids
            )
        )

        return ClientFacade(uow).build_client_signals(
            today_sessions=today_sessions,
            unlogged_sessions=unlogged_sessions,
            unshared_assessments=unshared_assessments,
        )
    except Exception:
        logger.exception("favorites 신호 합성 실패 — 빈 signal로 폴백")
        return {}


TOOL = {
    "name": "list_favorites_handler",
    "permission": "read:client",
    "purpose": "로그인한 사용자가 즐겨찾기한 내담자 목록을 조회한다.",
    "keywords": [
        "list favorites",
        "즐겨찾기 내담자",
        "즐겨찾기 목록",
        "관심 내담자",
        "북마크 고객",
        "favorites",
    ],
    "boundaries": "'본인'이 즐겨찾기한 내담자만 조회(읽기 전용). 전체 내담자 목록은 list_clients_handler.",
    "output": "즐겨찾기한 내담자 목록 (ClientFavoriteListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {},
        "required": [],
    },
}
