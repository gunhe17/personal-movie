from ..models import ProductionAIConfig
from ..repository import ProductionAIConfigRepository


class ListProductionConfigsService:
    def __init__(self, repo: ProductionAIConfigRepository) -> None:
        self.repo = repo

    async def execute(self, module: str | None = None) -> list[ProductionAIConfig]:
        # return
        return await self.repo.list_active(module=module)
