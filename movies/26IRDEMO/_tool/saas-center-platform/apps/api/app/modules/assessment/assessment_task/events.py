from dataclasses import dataclass

from app.core.type import uuid_str

from .models import AssessmentTask
from .schemas import TaskResponse


@dataclass(frozen=True, kw_only=True)
class AssessmentTaskAtomic:
    _act: str
    task: AssessmentTask
    _changed: dict | None = None

    @classmethod
    def created(
        cls, *, task: AssessmentTask
    ) -> tuple["AssessmentTaskAtomic", AssessmentTask]:
        return cls(_act="created", task=task), task

    @classmethod
    def started(
        cls, *, task: AssessmentTask
    ) -> tuple["AssessmentTaskAtomic", AssessmentTask]:
        return cls(_act="started", task=task), task

    @classmethod
    def cancelled(
        cls, *, task: AssessmentTask
    ) -> tuple["AssessmentTaskAtomic", AssessmentTask]:
        return cls(_act="cancelled", task=task), task

    @classmethod
    def refused(
        cls, *, task: AssessmentTask
    ) -> tuple["AssessmentTaskAtomic", AssessmentTask]:
        return cls(_act="refused", task=task), task

    @classmethod
    def updated(
        cls, *, task: AssessmentTask, changed: dict
    ) -> tuple["AssessmentTaskAtomic", AssessmentTask]:
        return cls(_act="updated", task=task, _changed=changed), task

    @classmethod
    def submitted(
        cls, *, task: AssessmentTask
    ) -> tuple["AssessmentTaskAtomic", AssessmentTask]:
        return cls(_act="submitted", task=task), task

    @classmethod
    def completed(
        cls, *, task: AssessmentTask
    ) -> tuple["AssessmentTaskAtomic", AssessmentTask]:
        return cls(_act="completed", task=task), task

    @classmethod
    def reverted(
        cls, *, task: AssessmentTask
    ) -> tuple["AssessmentTaskAtomic", AssessmentTask]:
        return cls(_act="reverted", task=task), task

    @classmethod
    def cancel_reverted(
        cls, *, task: AssessmentTask
    ) -> tuple["AssessmentTaskAtomic", AssessmentTask]:
        return cls(_act="cancel_reverted", task=task), task

    @classmethod
    def deleted(
        cls, *, task: AssessmentTask
    ) -> tuple["AssessmentTaskAtomic", AssessmentTask]:
        return cls(_act="deleted", task=task), task

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "assessment_task"

    def act_entity_id(self) -> uuid_str:
        return self.task.id

    def payload(self) -> dict:
        dump = TaskResponse.model_validate(self.task, from_attributes=True).model_dump(
            mode="json"
        )
        if self._act == "updated":
            return {"input": self._changed, "result": dump}
        return {"data": dump}
