from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..repository import EventAtomicRepository


async def aggregate_actor_usage(
    uow: UnitOfWork,
    *,
    center_id: str,
    actor_id: str,
    since,
) -> dict:
    repo = uow.repo(EventAtomicRepository)
    top = await repo.aggregate_act_counts_by_actor(
        center_id=center_id, actor_id=actor_id, since=since
    )
    hours = await repo.aggregate_active_hours_by_actor(
        center_id=center_id, actor_id=actor_id, since=since
    )
    return {
        "top_features": [{"key": k, "count": n} for k, n in top],
        "active_hours": hours,
    }


async def list_recent_interactions(
    uow: UnitOfWork,
    *,
    center_id: str,
    actor_id: str,
    limit: int = 3,
) -> list[dict]:
    # actor의 최근 인터랙션 엔티티 — 프로필 앵커용 (entity_name·entity_id·payload).
    repo = uow.repo(EventAtomicRepository)
    return await repo.aggregate_recent_entities_by_actor(
        center_id=center_id, actor_id=actor_id, limit=limit
    )
