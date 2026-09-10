from app.core.datetime_utils import utc_now

from ..repository import CareBoardEntryRepository


class PruneEntriesService:
    """재구축 한 바퀴에서 만나지 못한 행을 정리한다 — 남은 행은 두 갈래다.

    · 원천이 사라짐(회기·문서 삭제) → 행은 남기고 `source_deleted_at`만 찍는다(§9-2).
    · 원천은 있는데 이력에서 빠짐(완료 → 예정 되돌림) → 치운다. soft delete라
      `uq_care_board_entries_source`(deleted_at IS NULL 부분 인덱스)를 비껴가
      다시 완료되면 새 행으로 살아난다.
    """

    def __init__(
        self,
        repo: CareBoardEntryRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: str,
        client_id: str,
        kept: set[tuple[str, str]],
        excluded: set[tuple[str, str]],
    ) -> tuple[int, int]:
        # load
        rows = await self.repo.list_all_for_client(
            center_id=center_id, client_id=client_id
        )

        # prune
        closed = 0
        removed = 0
        for row in rows:
            key = (row.source_table, row.source_id)
            if key in kept:
                continue
            if key in excluded:
                await self.repo.remove_by_id(row.id)
                removed += 1
            elif row.source_deleted_at is None:
                await self.repo.update_by_id(row.id, source_deleted_at=utc_now())
                closed += 1

        # return
        return closed, removed
