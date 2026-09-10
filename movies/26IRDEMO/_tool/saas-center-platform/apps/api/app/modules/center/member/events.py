from dataclasses import dataclass

from app.core.type import uuid_str

from .models import Member
from .schemas import MemberResponse


@dataclass(frozen=True, kw_only=True)
class MemberAtomic:
    _act: str
    member: Member
    _changed: dict | None = None

    @classmethod
    def created(cls, *, member: Member) -> tuple["MemberAtomic", Member]:
        return cls(_act="created", member=member), member

    @classmethod
    def updated(cls, *, member: Member, changed: dict | None = None) -> tuple["MemberAtomic", Member]:
        return cls(_act="updated", member=member, _changed=changed), member

    @classmethod
    def deleted(cls, *, member: Member) -> tuple["MemberAtomic", Member]:
        return cls(_act="deleted", member=member), member

    @classmethod
    def left(cls, *, member: Member) -> tuple["MemberAtomic", Member]:
        return cls(_act="left", member=member), member

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "member"

    def act_entity_id(self) -> uuid_str:
        return self.member.id

    def payload(self) -> dict:
        dump = MemberResponse.model_validate(self.member, from_attributes=True).model_dump(mode="json")
        if self._act == "updated":
            return {"input": self._changed or {}, "result": dump}
        return {"data": dump}
