from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..production_config.models import ProductionAIConfig
from ..production_config.repository import ProductionAIConfigRepository
from ..production_config.services.promote_to_production import PromoteToProductionService
from ..production_config.services.list_production_configs import ListProductionConfigsService


class ProductionConfigFacade:
    def __init__(self, uow: UnitOfWork) -> None:
        self._uow = uow

    async def list_production_configs(self, module: str | None = None) -> list[ProductionAIConfig]:
        repo = self._uow.repo(ProductionAIConfigRepository)
        return await ListProductionConfigsService(repo).execute(module=module)

    async def promote_to_production(self, **kwargs) -> ProductionAIConfig:
        repo = self._uow.repo(ProductionAIConfigRepository)
        return await PromoteToProductionService(repo).execute(**kwargs)
