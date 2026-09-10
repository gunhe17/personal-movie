from app.core.exceptions import InvalidOperationException

from ..repository import AssessmentRepository


class ValidateOnlineSupportService:
    def __init__(self, repo: AssessmentRepository):
        self.repo = repo

    async def execute(self, assessment_ids: list[str]) -> None:
        # load
        assessments = await self.repo.list_by_ids(ids=assessment_ids)

        # verify
        unsupported = [a.code for a in assessments if not a.supports_online]
        if unsupported:
            raise InvalidOperationException(
                f"온라인 검사를 지원하지 않는 검사가 포함되어 있습니다: {', '.join(unsupported)}"
            )
