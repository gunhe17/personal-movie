from ..models import LabPromptVersion
from ..repository import LabPromptVersionRepository


class CreatePromptVersionService:
    def __init__(
        self,
        repo: LabPromptVersionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        prompt_key: str,
        name: str,
        system_prompt: str,
        user_prompt_template: str | None = None,
        author_id: str | None = None,
        description: str | None = None,
    ) -> LabPromptVersion:
        # load
        next_ver = await self.repo.next_version(prompt_key=prompt_key)

        # return
        return await self.repo.add(
            prompt_key=prompt_key,
            version=next_ver,
            name=name,
            system_prompt=system_prompt,
            user_prompt_template=user_prompt_template,
            author_id=author_id,
            is_active=True,
            is_production=False,
            description=description,
        )
