from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CareBoardEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    center_id: str
    client_id: str
    kind: str
    occurred_at: datetime
    source_table: str
    source_id: str
    case_id: str | None = None
    actor_id: str | None = None
    person_id: str | None = None
    share_class: str
    title: str | None = None
    subtitle: str | None = None
    body: str | None = None
    meta: str | None = None
    pinned: bool
    pinned_at: datetime | None = None
    pinned_by: str | None = None
    source_deleted_at: datetime | None = None


class CareBoardStreamRow(CareBoardEntryResponse):
    # read 시점 해소 — 저장 스냅샷이 아니다(live name)
    actor_name: str | None = None
    pinned_by_name: str | None = None


class CareBoardStreamResponse(BaseModel):
    rows: list[CareBoardStreamRow]
    next_cursor: str | None = None
    pinned: list[CareBoardStreamRow] = []
    unread_count: int = 0
    last_seen_at: datetime | None = None
