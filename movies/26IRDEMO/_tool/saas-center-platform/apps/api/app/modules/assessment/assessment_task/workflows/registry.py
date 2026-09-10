from typing import Type
from .protocol import WorkflowEngine
from .exceptions import WorkflowNotFoundError
from app.core.logger import get_logger


logger = get_logger(__name__)


class WorkflowRegistry:
    _instance = None
    _workflows: dict[str, Type[WorkflowEngine]] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def register(self, workflow_class: Type[WorkflowEngine]) -> None:
        temp = workflow_class()
        workflow_type = temp.workflow_type

        if workflow_type in self._workflows:
            logger.warning("workflow 중복 등록 무시: %s", workflow_type)
            return

        self._workflows[workflow_type] = workflow_class
        logger.info("workflow 등록: %s (%s)", temp.name, workflow_type)

    def get(self, workflow_type: str) -> WorkflowEngine:
        workflow_class = self._workflows.get(workflow_type)

        if not workflow_class:
            raise WorkflowNotFoundError(
                f"No workflow found for type: {workflow_type}"
            )

        return workflow_class()

    def has(self, workflow_type: str) -> bool:
        return workflow_type in self._workflows

    def list_all(self) -> list[dict]:
        result = []
        for workflow_type, workflow_class in self._workflows.items():
            temp = workflow_class()
            result.append({"workflow_type": workflow_type, "name": temp.name})
        return result


registry = WorkflowRegistry()
