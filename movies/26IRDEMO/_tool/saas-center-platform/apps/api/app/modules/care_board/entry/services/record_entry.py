from datetime import datetime

from ..events import CareBoardEntryAtomic
from ..models import CareBoardEntry
from ..repository import CareBoardEntryRepository


class RecordEntryService:
    """원천 1건 → entry 1행 (source 기준 upsert).

    반응 재실행·백필 재실행이 같은 행을 두 번 만들지 않도록 source 키로 갱신한다
    — uq_care_board_entries_source가 그 계약의 DB 측 보증.
    """

    def __init__(self, repo: CareBoardEntryRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: str,
        client_id: str,
        kind: str,
        occurred_at: datetime,
        source_table: str,
        source_id: str,
        share_class: str,
        case_id: str | None = None,
        actor_id: str | None = None,
        person_id: str | None = None,
        title: str | None = None,
        subtitle: str | None = None,
        body: str | None = None,
        meta: str | None = None,
    ) -> tuple[CareBoardEntryAtomic, CareBoardEntry]:
        existing = await self.repo.find_by_source(
            source_table=source_table, source_id=source_id, client_id=client_id
        )
        if existing is None:
            created = await self.repo.add(
                center_id=center_id,
                client_id=client_id,
                kind=kind,
                occurred_at=occurred_at,
                source_table=source_table,
                source_id=source_id,
                share_class=share_class,
                case_id=case_id,
                actor_id=actor_id,
                person_id=person_id,
                title=title,
                subtitle=subtitle,
                body=body,
                meta=meta,
            )
            return CareBoardEntryAtomic.created(entry=created)

        changed = {
            "occurred_at": occurred_at,
            "case_id": case_id,
            "actor_id": actor_id,
            "person_id": person_id,
            "share_class": share_class,
            "title": title,
            "subtitle": subtitle,
            "body": body,
            "meta": meta,
            # 사라졌다 돌아온 원천(문서 restore 등)은 다시 열린다 — 안 지우면 영영 닫힌 채 남는다
            "source_deleted_at": None,
        }
        updated = await self.repo.update_by_id(existing.id, **changed)
        assert updated is not None
        return CareBoardEntryAtomic.updated(entry=updated, changed=changed)
