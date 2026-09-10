from app.core.datetime_utils import utc_now

from ..events import CareBoardEntryAtomic
from ..repository import CareBoardEntryRepository


class MarkSourceDeletedService:
    """원본이 지워져도 행은 남는다 — 열지 못하게만 한다(domain.md §9-2)."""

    def __init__(self, repo: CareBoardEntryRepository):
        self.repo = repo

    async def execute(
        self, *, source_table: str, source_id: str
    ) -> list[CareBoardEntryAtomic]:
        # 그룹 원천은 내담자 수만큼 행이 있다 — 전부 닫는다
        rows = await self.repo.list_by_source(
            source_table=source_table, source_id=source_id
        )
        changed = {"source_deleted_at": utc_now()}
        atomics = []
        for row in rows:
            updated = await self.repo.update_by_id(row.id, **changed)
            if updated is not None:
                atomic, _ = CareBoardEntryAtomic.updated(entry=updated, changed=changed)
                atomics.append(atomic)
        return atomics
