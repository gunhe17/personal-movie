from typing import Protocol, runtime_checkable
from ..models import AssessmentTask


@runtime_checkable
class WorkflowEngine(Protocol):
    @property
    def workflow_type(self) -> str:
        ...

    @property
    def name(self) -> str:
        ...

    def validate_start(self, task: AssessmentTask) -> bool:
        ...

    async def on_start(self, task: AssessmentTask) -> dict:
        ...

    async def on_submit(
        self,
        task: AssessmentTask,
        data: dict
    ) -> AssessmentTask:
        ...

    async def on_complete(self, task: AssessmentTask) -> AssessmentTask:
        ...

    def get_available_actions(self, task: AssessmentTask) -> list[str]:
        ...
