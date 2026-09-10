from ..models import ProductionAIConfig
from ..repository import ProductionAIConfigRepository


class FindProductionConfigService:
    def __init__(self, repo: ProductionAIConfigRepository) -> None:
        self.repo = repo

    async def execute(self, pipeline_step: str, module: str | None = None) -> ProductionAIConfig | None:
        # return
        return await self.repo.find_active_by_step(pipeline_step=pipeline_step, module=module)
