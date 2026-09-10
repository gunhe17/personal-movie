from ..events import AssessmentTaskAtomic
from ..repository import AssessmentTaskRepository
from ..models import AssessmentTask


class CreateTasksForCaseService:
    def __init__(
        self,
        repo: AssessmentTaskRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        case_id: str,
        assessment_execution_methods: dict[str, str],
    ) -> tuple[list[AssessmentTaskAtomic], list[AssessmentTask]]:
        atomics: list[AssessmentTaskAtomic] = []
        tasks: list[AssessmentTask] = []

        for assessment_id, execution_method in assessment_execution_methods.items():
            # 기존 행 재사용 = 사실 없음(atomic 미생성)
            existing = await self.repo.find_by_case_assessment(
                case_id=case_id,
                assessment_id=assessment_id,
            )
            if existing:
                tasks.append(existing)
                continue

            task = await self.repo.add(
                center_id=center_id,
                case_id=case_id,
                assessment_id=assessment_id,
                execution_method=execution_method,
            )
            atomic, _ = AssessmentTaskAtomic.created(task=task)
            atomics.append(atomic)
            tasks.append(task)

        return atomics, tasks
