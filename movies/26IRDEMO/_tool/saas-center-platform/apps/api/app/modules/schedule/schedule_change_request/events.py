from dataclasses import dataclass

from app.core.type import uuid_str

from .models import ScheduleChangeRequest
from .schemas import ScheduleChangeRequestResponse


@dataclass(frozen=True, kw_only=True)
class ScheduleChangeRequestAtomic:
    _act: str
    request: ScheduleChangeRequest

    @classmethod
    def created(cls, *, request: ScheduleChangeRequest) -> tuple["ScheduleChangeRequestAtomic", ScheduleChangeRequest]:
        return cls(_act="created", request=request), request

    @classmethod
    def approved(cls, *, request: ScheduleChangeRequest) -> tuple["ScheduleChangeRequestAtomic", ScheduleChangeRequest]:
        return cls(_act="approved", request=request), request

    @classmethod
    def rejected(cls, *, request: ScheduleChangeRequest) -> tuple["ScheduleChangeRequestAtomic", ScheduleChangeRequest]:
        return cls(_act="rejected", request=request), request

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "schedule_change_request"

    def act_entity_id(self) -> uuid_str:
        return self.request.id

    def payload(self) -> dict:
        return {"data": ScheduleChangeRequestResponse.model_validate(self.request).model_dump(mode="json")}
