from app.modules.center.facade import RoomFacade
from app.modules.schedule.schedule.schemas import ConflictingSchedule, ScheduleConflictDetail


async def enrich_flat_conflict_room_names(
    room_facade: RoomFacade,
    conflict_schedules: list[ConflictingSchedule],
) -> None:
    # 담당자 축 충돌은 서로 다른 방일 수 있어, 등장한 모든 room_id를 한 번에 조회
    room_ids = {cs.room_id for cs in conflict_schedules if cs.room_id}
    if not room_ids:
        return
    room_map = await room_facade.get_rooms_by_ids(list(room_ids))
    for cs in conflict_schedules:
        if cs.room_id and cs.room_id in room_map:
            cs.room_name = getattr(room_map[cs.room_id], "name", None)


async def enrich_conflict_detail_room_names(
    room_facade: RoomFacade,
    conflicts: list[ScheduleConflictDetail],
) -> None:
    flat = [cs for conflict in conflicts for cs in conflict.conflicting_schedules]
    await enrich_flat_conflict_room_names(room_facade, flat)
