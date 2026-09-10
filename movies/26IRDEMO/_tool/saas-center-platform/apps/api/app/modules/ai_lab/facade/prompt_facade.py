from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..prompt_version.models import LabPromptVersion
from ..prompt_version.repository import LabPromptVersionRepository
from ..production_config.services.find_production_config import (
    FindProductionConfigService,
)
from ..production_config.services.list_production_configs import (
    ListProductionConfigsService,
)
from ..prompt_version.services.create_prompt_version import CreatePromptVersionService
from ..prompt_version.services.find_prompt_version import FindPromptVersionService
from ..prompt_version.services.get_prompt_version import GetPromptVersionService
from ..prompt_version.services.list_prompt_versions import ListPromptVersionsService
from ..prompt_version.services.delete_prompt_version import DeletePromptVersionService
from ..prompt_version.services.import_production_prompts import (
    ImportProductionPromptsService,
)
from ..prompt_version.services.update_prompt_version import UpdatePromptVersionService
from ..production_config.repository import ProductionAIConfigRepository


class PromptFacade:
    def __init__(self, uow: UnitOfWork) -> None:
        self._uow = uow

    async def list_prompts(
        self, prompt_key: str | None = None
    ) -> list[LabPromptVersion]:
        repo = self._uow.repo(LabPromptVersionRepository)
        return await ListPromptVersionsService(repo).execute(prompt_key)

    async def find_prompt(self, prompt_id: str) -> LabPromptVersion | None:
        repo = self._uow.repo(LabPromptVersionRepository)
        return await FindPromptVersionService(repo).execute(prompt_id)

    async def create_prompt(self, **kwargs) -> LabPromptVersion:
        repo = self._uow.repo(LabPromptVersionRepository)
        return await CreatePromptVersionService(repo).execute(**kwargs)

    async def update_prompt(
        self, prompt_id: str, data: dict
    ) -> LabPromptVersion | None:
        repo = self._uow.repo(LabPromptVersionRepository)
        return await UpdatePromptVersionService(repo).execute(prompt_id, data)

    async def delete_prompt(self, prompt_id: str) -> None:
        repo = self._uow.repo(LabPromptVersionRepository)
        await DeletePromptVersionService(repo).execute(prompt_id)

    async def import_production_prompts(
        self,
        module: str = "field_note",
        author_id: str | None = None,
        *,
        module_prompts: dict[str, dict[str, str]]
        | None = None,  # 크로스모듈 프롬프트, handler 주입
    ) -> list[LabPromptVersion]:
        # 우선순위: DB active config > module_prompts fallback
        repo = self._uow.repo(LabPromptVersionRepository)
        svc = ImportProductionPromptsService(repo)

        config_repo = self._uow.repo(ProductionAIConfigRepository)
        active_configs = await ListProductionConfigsService(config_repo).execute(
            module=module
        )

        if active_configs:
            production_prompts = {
                c.pipeline_step: {
                    "name": f"{c.pipeline_step} (production)",
                    "system_prompt": c.system_prompt,
                }
                for c in active_configs
                if c.system_prompt
            }
            if production_prompts:
                return await svc.execute(production_prompts, author_id)

        if module_prompts:
            return await svc.execute(module_prompts, author_id)

        return []

    async def get_prompt_content(
        self, prompt_version_id: str
    ) -> tuple[str, str | None]:
        repo = self._uow.repo(LabPromptVersionRepository)
        pv = await GetPromptVersionService(repo).execute(prompt_version_id)
        return pv.system_prompt, pv.user_prompt_template

    async def resolve_prompt(
        self,
        *,
        experiment_type: str,
        system_prompt: str | None = None,
        user_prompt_template: str | None = None,
        prompt_version_id: str | None = None,
        fallback_prompts: dict[str, dict[str, str]]
        | None = None,  # 크로스모듈 프롬프트, handler 주입
    ) -> tuple[str, str | None]:
        # 우선순위: 명시 prompt > prompt_version > DB config > fallback_prompts
        if system_prompt is not None:
            return system_prompt, user_prompt_template

        if prompt_version_id:
            return await self.get_prompt_content(prompt_version_id)

        step = _experiment_type_to_step(experiment_type)
        if step:
            config_repo = self._uow.repo(ProductionAIConfigRepository)
            config = await FindProductionConfigService(config_repo).execute(step)
            if config and config.system_prompt:
                return config.system_prompt, config.user_prompt_template

        if step and fallback_prompts and step in fallback_prompts:
            return fallback_prompts[step].get("system_prompt", ""), None

        return "", None


def _experiment_type_to_step(experiment_type: str) -> str | None:
    if experiment_type.startswith("llm_"):
        return experiment_type[4:]
    if experiment_type.startswith("stt_"):
        return experiment_type[4:]
    return None
