from app.core.datetime_utils import utc_now

from app.core.exceptions import InvalidOperationException
from ..models import ProductionAIConfig
from ..repository import ProductionAIConfigRepository


class PromoteToProductionService:
    def __init__(self, repo: ProductionAIConfigRepository) -> None:
        self.repo = repo

    async def execute(
        self,
        *,
        pipeline_step: str,
        model_name: str,
        provider: str = "openai",
        system_prompt: str | None = None,
        user_prompt_template: str | None = None,
        model_params: str | None = None,
        promoted_from_version_id: str | None = None,
        promoted_by: str | None = None,
        description: str | None = None,
        module: str = "field_note",
        diarization_strategy: str | None = None,
    ) -> ProductionAIConfig:
        # verify
        if not pipeline_step or not pipeline_step.strip():
            raise InvalidOperationException("pipeline_step은 필수입니다.")

        # deactivate
        await self.repo.deactivate_by_step(pipeline_step=pipeline_step, module=module)

        # return
        now = utc_now()
        return await self.repo.add(
            module=module,
            pipeline_step=pipeline_step,
            model_name=model_name,
            provider=provider,
            system_prompt=system_prompt,
            user_prompt_template=user_prompt_template,
            model_params=model_params,
            promoted_from_version_id=promoted_from_version_id,
            promoted_by=promoted_by,
            promoted_at=now,
            is_active=True,
            description=description,
            diarization_strategy=diarization_strategy,
        )
