from dataclasses import dataclass

from app.core.type import uuid_str

from .models import CounselingSession
from .schemas import CounselingSessionResponse


@dataclass(frozen=True, kw_only=True)
class CounselingSessionAtomic:
    _act: str
    session: CounselingSession
    _changed: dict | None = None

    @classmethod
    def created(cls, *, session: CounselingSession) -> tuple["CounselingSessionAtomic", CounselingSession]:
        return cls(_act="created", session=session), session

    @classmethod
    def updated(cls, *, session: CounselingSession, changed: dict) -> tuple["CounselingSessionAtomic", CounselingSession]:
        return cls(_act="updated", session=session, _changed=changed), session

    @classmethod
    def cancelled(cls, *, session: CounselingSession) -> tuple["CounselingSessionAtomic", CounselingSession]:
        return cls(_act="cancelled", session=session), session

    @classmethod
    def reverted(cls, *, session: CounselingSession) -> tuple["CounselingSessionAtomic", CounselingSession]:
        return cls(_act="reverted", session=session), session

    @classmethod
    def deleted(cls, *, session: CounselingSession) -> tuple["CounselingSessionAtomic", CounselingSession]:
        return cls(_act="deleted", session=session), session

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "counseling_session"

    def act_entity_id(self) -> uuid_str:
        return self.session.id

    def payload(self) -> dict:
        dump = CounselingSessionResponse.model_validate(self.session).model_dump(mode="json")
        if self._act == "updated":
            return {"input": self._changed, "result": dump}
        return {"data": dump}
