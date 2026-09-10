from dataclasses import dataclass

from app.core.type import uuid_str

from .models import Room
from .schemas import RoomResponse


@dataclass(frozen=True, kw_only=True)
class RoomAtomic:
    _act: str
    room: Room
    _changed: dict | None = None

    @classmethod
    def created(cls, *, room: Room) -> tuple["RoomAtomic", Room]:
        return cls(_act="created", room=room), room

    @classmethod
    def updated(cls, *, room: Room, changed: dict) -> tuple["RoomAtomic", Room]:
        return cls(_act="updated", room=room, _changed=changed), room

    @classmethod
    def deleted(cls, *, room: Room) -> tuple["RoomAtomic", Room]:
        return cls(_act="deleted", room=room), room

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "room"

    def act_entity_id(self) -> uuid_str:
        return self.room.id

    def payload(self) -> dict:
        dump = RoomResponse.model_validate(self.room).model_dump(mode="json")
        if self._act == "updated":
            return {"input": self._changed, "result": dump}
        return {"data": dump}
