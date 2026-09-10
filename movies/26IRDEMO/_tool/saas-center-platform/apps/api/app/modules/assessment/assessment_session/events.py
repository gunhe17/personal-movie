from dataclasses import dataclass

from app.core.type import uuid_str

from .models import AssessmentSession
from .schemas import AssessmentSessionResponse


@dataclass(frozen=True, kw_only=True)
class AssessmentSessionAtomic:
    _act: str
    session: AssessmentSession
    _changed: dict | None = None

    @classmethod
    def created(
        cls, *, session: AssessmentSession
    ) -> tuple["AssessmentSessionAtomic", AssessmentSession]:
        return cls(_act="created", session=session), session

    @classmethod
    def updated(
        cls, *, session: AssessmentSession, changed: dict
    ) -> tuple["AssessmentSessionAtomic", AssessmentSession]:
        return cls(_act="updated", session=session, _changed=changed), session

    @classmethod
    def cancelled(
        cls, *, session: AssessmentSession
    ) -> tuple["AssessmentSessionAtomic", AssessmentSession]:
        return cls(_act="cancelled", session=session), session

    @classmethod
    def attended(
        cls, *, session: AssessmentSession
    ) -> tuple["AssessmentSessionAtomic", AssessmentSession]:
        return cls(_act="attended", session=session), session

    @classmethod
    def no_show(
        cls, *, session: AssessmentSession
    ) -> tuple["AssessmentSessionAtomic", AssessmentSession]:
        return cls(_act="no_show", session=session), session

    @classmethod
    def reverted(
        cls, *, session: AssessmentSession
    ) -> tuple["AssessmentSessionAtomic", AssessmentSession]:
        return cls(_act="reverted", session=session), session

    @classmethod
    def deleted(
        cls, *, session: AssessmentSession
    ) -> tuple["AssessmentSessionAtomic", AssessmentSession]:
        return cls(_act="deleted", session=session), session

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "assessment_session"

    def act_entity_id(self) -> uuid_str:
        return self.session.id

    def payload(self) -> dict:
        dump = AssessmentSessionResponse.model_validate(self.session).model_dump(
            mode="json"
        )
        if self._act == "updated":
            return {"input": self._changed, "result": dump}
        return {"data": dump}
