from app.core.exceptions import InvalidOperationException
from app.modules.assessment.engine import plugins  # noqa: F401 — import 시 registry 자기등록
from app.modules.assessment.engine.registry import registry
from ..repository import AssessmentTaskRepository
from ..models import AssessmentTask


class CalculateScoresService:
    def __init__(self, repo: AssessmentTaskRepository):
        self.repo = repo

    async def execute(
        self,
        task: AssessmentTask,
        assessment_code: str,
        context: dict | None = None,
    ) -> tuple[dict, dict]:
        # verify
        if not registry.has(assessment_code):
            raise InvalidOperationException(
                f"No scoring engine for code: {assessment_code}"
            )

        # load
        engine = registry.get(assessment_code)

        responses = task.process.get("responses", [])
        if not responses:
            raise InvalidOperationException("No responses found in task")

        # verify
        engine.validate_responses(responses)

        # compute
        scores = engine.calculate_scores(responses, context=context)

        interpretation = engine.interpret(scores, context=context)

        return scores, interpretation
