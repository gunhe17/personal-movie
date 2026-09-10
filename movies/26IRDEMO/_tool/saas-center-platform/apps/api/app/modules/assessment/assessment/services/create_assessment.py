from app.core.exceptions import ConflictException

from ..models import Assessment
from ..models import AssessmentType
from ..repository import AssessmentRepository


class CreateAssessmentService:
    def __init__(self, repo: AssessmentRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        code: str,
        version: str,
        kor_name: str,
        eng_name: str,
        assessment_type: AssessmentType,
        description: str | None = None,
        duration: int | None = None,
        age: str | None = None,
        status: str = "private",
        workflow_type: str = "self_report",
        external_url: str | None = None,
        supports_online: bool = False,
        definition: dict | None = None,
    ) -> Assessment:
        # verify
        if await self.repo.find_by_code(code):
            raise ConflictException("이미 존재하는 검사 코드입니다")

        # return
        return await self.repo.add(
            code=code,
            version=version,
            kor_name=kor_name,
            eng_name=eng_name,
            assessment_type=assessment_type,
            description=description,
            duration=duration,
            age=age,
            status=status,
            workflow_type=workflow_type,
            external_url=external_url,
            supports_online=supports_online,
            definition=definition,
        )
