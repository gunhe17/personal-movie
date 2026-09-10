from ..models import LabPromptVersion
from ..repository import LabPromptVersionRepository


class ImportProductionPromptsService:
    def __init__(
        self,
        repo: LabPromptVersionRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        production_prompts: dict[str, dict[str, str]],
        author_id: str | None = None,
    ) -> list[LabPromptVersion]:
        imported = []
        for key, info in production_prompts.items():
            existing = await self.repo.find_production_by_key(prompt_key=key)
            if existing:
                continue

            next_ver = await self.repo.next_version(prompt_key=key)
            version = await self.repo.add(
                prompt_key=key,
                version=next_ver,
                name=f"{info['name']} (프로덕션)",
                system_prompt=info["system_prompt"],
                author_id=author_id,
                is_active=True,
                is_production=True,
                description="프로덕션 프롬프트 자동 import",
            )
            imported.append(version)

        return imported
