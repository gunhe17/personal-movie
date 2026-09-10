from app.core.exceptions import EntityNotFoundException, InvalidOperationException
from app.core.type import unset
from ..models import LabSampleDataset
from ..repository import LabSampleDatasetRepository


class UpdateSampleService:
    def __init__(self, repo: LabSampleDatasetRepository):
        self.repo = repo

    async def execute(
        self,
        sample_id: str,
        *,
        name: str | None = unset,
        description: str | None = unset,
        text_content: str | None = unset,
        tags: str | None = unset,
    ) -> LabSampleDataset:
        # load
        sample = await self.repo.find_by_id(id=sample_id)
        if not sample:
            raise EntityNotFoundException(f"Sample not found: {sample_id}")

        # apply (빈 name은 무시 — 기존 정책 유지)
        fields: dict = {}
        if name is not unset and name:
            fields["name"] = name
        if description is not unset:
            fields["description"] = description
        if text_content is not unset:
            if text_content and len(text_content) > 50000:
                raise InvalidOperationException("text_content는 최대 50,000자까지 허용됩니다.")
            fields["text_content"] = text_content
        if tags is not unset:
            fields["tags"] = tags

        # return
        if not fields:
            return sample
        updated = await self.repo.update_in_place(id=sample_id, **fields)
        assert updated is not None
        return updated
