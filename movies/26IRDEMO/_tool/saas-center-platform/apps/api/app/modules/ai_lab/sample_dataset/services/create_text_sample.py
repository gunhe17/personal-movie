from app.core.exceptions import InvalidOperationException
from ..models import LabSampleDataset
from ..repository import LabSampleDatasetRepository


class CreateTextSampleService:
    def __init__(self, repo: LabSampleDatasetRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        name: str,
        text_content: str,
        description: str | None = None,
        tags: str | None = None,
        source_type: str = "manual",
        source_id: str | None = None,
        author_id: str | None = None,
    ) -> LabSampleDataset:
        # verify
        if len(text_content) > 50000:
            raise InvalidOperationException("text_content는 최대 50,000자까지 허용됩니다.")

        # return
        return await self.repo.add(
            name=name,
            input_type="text",
            text_content=text_content,
            description=description,
            tags=tags,
            source_type=source_type,
            field_note_id=source_id,
            author_id=author_id,
        )
