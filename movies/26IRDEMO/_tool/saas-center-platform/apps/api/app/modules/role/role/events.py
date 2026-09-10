from dataclasses import dataclass

from app.core.type import uuid_str

from .models import Role
from .schemas import RoleResponse


@dataclass(frozen=True, kw_only=True)
class RoleAtomic:
    _act: str
    role: Role
    _changed: dict | None = None

    @classmethod
    def created(cls, *, role: Role) -> tuple["RoleAtomic", Role]:
        return cls(_act="created", role=role), role

    @classmethod
    def updated(cls, *, role: Role, changed: dict) -> tuple["RoleAtomic", Role]:
        return cls(_act="updated", role=role, _changed=changed), role

    @classmethod
    def deleted(cls, *, role: Role) -> tuple["RoleAtomic", Role]:
        return cls(_act="deleted", role=role), role

    @classmethod
    def version_incremented(cls, *, role: Role) -> tuple["RoleAtomic", Role]:
        return cls(_act="version_incremented", role=role), role

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "role"

    def act_entity_id(self) -> uuid_str:
        return self.role.id

    def payload(self) -> dict:
        dump = RoleResponse.model_validate(self.role).model_dump(mode="json")
        if self._act == "updated":
            return {"input": self._changed, "result": dump}
        return {"data": dump}
