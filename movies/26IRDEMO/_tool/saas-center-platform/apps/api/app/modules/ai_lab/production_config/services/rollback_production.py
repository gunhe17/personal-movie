from app.core.exceptions import EntityNotFoundException, InvalidOperationException
from ..models import ProductionAIConfig
from ..repository import ProductionAIConfigRepository


class RollbackProductionService:
    def __init__(self, repo: ProductionAIConfigRepository) -> None:
        self.repo = repo

    async def execute(self, *, config_id: str) -> ProductionAIConfig:
        # load
        target = await self.repo.find_by_id(id=config_id)
        if not target:
            raise EntityNotFoundException(f"롤백 대상 설정을 찾을 수 없습니다: {config_id}")
        if target.is_active:
            raise InvalidOperationException("이미 활성 상태인 설정입니다.")

        # deactivate
        await self.repo.deactivate_by_step(pipeline_step=target.pipeline_step, module=target.module)

        # return
        target.is_active = True
        return target
