from dataclasses import dataclass

from app.core.type import uuid_str

from .models import Program
from .schemas import ProgramResponse


@dataclass(frozen=True, kw_only=True)
class ProgramAtomic:
    _act: str
    program: Program
    _changed: dict | None = None

    @classmethod
    def created(cls, *, program: Program) -> tuple["ProgramAtomic", Program]:
        return cls(_act="created", program=program), program

    @classmethod
    def updated(cls, *, program: Program, changed: dict) -> tuple["ProgramAtomic", Program]:
        return cls(_act="updated", program=program, _changed=changed), program

    @classmethod
    def deleted(cls, *, program: Program) -> tuple["ProgramAtomic", Program]:
        return cls(_act="deleted", program=program), program

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "program"

    def act_entity_id(self) -> uuid_str:
        return self.program.id

    def payload(self) -> dict:
        dump = ProgramResponse.model_validate(self.program).model_dump(mode="json")
        if self._act == "updated":
            return {"input": self._changed, "result": dump}
        return {"data": dump}
