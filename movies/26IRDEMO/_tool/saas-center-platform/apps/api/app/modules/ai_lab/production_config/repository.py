from sqlalchemy import select, update as sql_update

from app.core.type import utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import ProductionAIConfig


class ProductionAIConfigRepository(PostgresRepository[ProductionAIConfig]):
    model = ProductionAIConfig

    # #
    # command

    @typecheck
    async def add(
        self,
        pipeline_step: str,
        model_name: str,
        module: str = "field_note",
        provider: str = "openai",
        system_prompt: str | None = None,
        user_prompt_template: str | None = None,
        model_params: str | None = None,
        promoted_from_version_id: uuid_str | None = None,
        promoted_by: uuid_str | None = None,
        promoted_at: utc_dt | None = None,
        is_active: bool = True,
        description: str | None = None,
        diarization_strategy: str | None = None,
    ) -> ProductionAIConfig:
        return await super().add(
            ProductionAIConfig(
                pipeline_step=pipeline_step,
                model_name=model_name,
                module=module,
                provider=provider,
                system_prompt=system_prompt,
                user_prompt_template=user_prompt_template,
                model_params=model_params,
                promoted_from_version_id=promoted_from_version_id,
                promoted_by=promoted_by,
                promoted_at=promoted_at,
                is_active=is_active,
                description=description,
                diarization_strategy=diarization_strategy,
            )
        )

    @typecheck
    async def deactivate_by_step(
        self,
        pipeline_step: str,
        module: str | None = None,
    ) -> None:
        where = [
            ProductionAIConfig.pipeline_step == pipeline_step,
            ProductionAIConfig.is_active.is_(True),
            ProductionAIConfig.deleted_at.is_(None),
        ]
        if module:
            where.append(ProductionAIConfig.module == module)
        await self._session.execute(
            sql_update(ProductionAIConfig).where(*where).values(is_active=False)
        )

    # #
    # query

    @typecheck
    async def find_active_by_step(
        self,
        pipeline_step: str,
        module: str | None = None,
    ) -> ProductionAIConfig | None:
        where = [
            ProductionAIConfig.pipeline_step == pipeline_step,
            ProductionAIConfig.is_active.is_(True),
        ]
        if module:
            where.append(ProductionAIConfig.module == module)
        return await self._find(where=where, order_by="created_at", descending=True)

    @typecheck
    async def list_active(
        self,
        module: str | None = None,
    ) -> list[ProductionAIConfig]:
        conditions = [
            ProductionAIConfig.deleted_at.is_(None),
            ProductionAIConfig.is_active.is_(True),
        ]
        if module:
            conditions.append(ProductionAIConfig.module == module)
        stmt = (
            select(ProductionAIConfig)
            .where(*conditions)
            .order_by(ProductionAIConfig.module, ProductionAIConfig.pipeline_step)
        )
        return await self._scalars(stmt)
