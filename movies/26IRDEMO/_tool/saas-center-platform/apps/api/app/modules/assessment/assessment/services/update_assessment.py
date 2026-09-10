from app.core.exceptions import (
    ConflictException,
    EntityNotFoundException,
    InvalidOperationException,
)
from app.core.type import unset

from ..models import Assessment
from ..models import AssessmentType
from ..repository import AssessmentRepository


class UpdateAssessmentService:
    def __init__(
        self,
        repo: AssessmentRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        assessment_id: str,
        *,
        code: str = unset,
        version: str = unset,
        kor_name: str = unset,
        eng_name: str = unset,
        assessment_type: AssessmentType = unset,
        description: str | None = unset,
        duration: int | None = unset,
        age: str | None = unset,
        status: str = unset,
        workflow_type: str = unset,
        external_url: str | None = unset,
        supports_online: bool = unset,
        definition: dict = unset,
    ) -> Assessment:
        # load (삭제 포함 — 삭제된 검사 구분을 위해)
        assessment = await self.repo.find_by_id_including_deleted(id=assessment_id)
        if not assessment:
            raise EntityNotFoundException(f"검사를 찾을 수 없습니다: {assessment_id}")
        if assessment.deleted_at is not None:
            raise InvalidOperationException(
                "삭제된 검사는 수정할 수 없습니다. 먼저 복구해주세요"
            )

        # verify (code 변경 시 중복 체크)
        if code is not unset and code != assessment.code:
            if await self.repo.find_by_code(code):
                raise ConflictException("이미 존재하는 검사 코드입니다")

        # update
        updated = await self.repo.update_in_place(
            assessment_id,
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
        assert updated is not None
        return updated
