from typing import Any

from sqlalchemy import and_, func, select

from app.core.type import unset, utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import Page, PostgresRepository

from .models import LabExperimentRun


class LabExperimentRunRepository(PostgresRepository[LabExperimentRun]):
    model = LabExperimentRun

    # #
    # command

    @typecheck
    async def add(
        self,
        experiment_type: str,
        model_name: str,
        provider: str = "openai",
        field_note_id: uuid_str | None = None,
        field_note_audio_id: uuid_str | None = None,
        sample_id: uuid_str | None = None,
        group_id: uuid_str | None = None,
        model_params: str | None = None,
        prompt_version_id: uuid_str | None = None,
        author_id: uuid_str | None = None,
        status: str = "pending",
        started_at: utc_dt | None = None,
        input_text: str | None = None,
        input_audio_duration: float | None = None,
        tags: str | None = None,
        memo: str | None = None,
    ) -> LabExperimentRun:
        return await super().add(
            LabExperimentRun(
                experiment_type=experiment_type,
                model_name=model_name,
                provider=provider,
                field_note_id=field_note_id,
                field_note_audio_id=field_note_audio_id,
                sample_id=sample_id,
                group_id=group_id,
                model_params=model_params,
                prompt_version_id=prompt_version_id,
                author_id=author_id,
                status=status,
                started_at=started_at,
                input_text=input_text,
                input_audio_duration=input_audio_duration,
                tags=tags,
                memo=memo,
            )
        )

    @typecheck
    async def update_in_place(
        self,
        id: uuid_str,
        *,
        quality_score: int | None = unset,
        quality_note: str | None = unset,
    ) -> LabExperimentRun | None:
        return await self.update_fields(
            id,
            quality_score=quality_score,
            quality_note=quality_note,
        )

    # #
    # query

    @typecheck
    async def list_with_page(
        self,
        experiment_type: str | None = None,
        experiment_type_prefix: str | None = None,
        field_note_id: uuid_str | None = None,
        sample_id: uuid_str | None = None,
        status: str | None = None,
        *,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[LabExperimentRun], Page]:
        where = []
        if experiment_type:
            where.append(LabExperimentRun.experiment_type == experiment_type)
        elif experiment_type_prefix:
            where.append(LabExperimentRun.experiment_type.startswith(experiment_type_prefix))
        if field_note_id:
            where.append(LabExperimentRun.field_note_id == field_note_id)
        if sample_id:
            where.append(LabExperimentRun.sample_id == sample_id)
        if status:
            where.append(LabExperimentRun.status == status)
        return await self._page(
            where=where,
            order_by="created_at",
            descending=True,
            page=page,
            size=size,
        )

    @typecheck
    async def list_by_group(
        self,
        group_id: uuid_str,
        status: str | None = None,
    ) -> list[LabExperimentRun]:
        where = [LabExperimentRun.group_id == group_id]
        if status:
            where.append(LabExperimentRun.status == status)
        return await self._filter(where=where, order_by="created_at")

    @typecheck
    async def get_lab_cost_summary(
        self,
        date_from: utc_dt | None = None,
        date_to: utc_dt | None = None,
    ) -> dict[str, Any]:
        conditions = [
            LabExperimentRun.deleted_at.is_(None),
            LabExperimentRun.status == "completed",
        ]
        if date_from:
            conditions.append(LabExperimentRun.created_at >= date_from)
        if date_to:
            conditions.append(LabExperimentRun.created_at < date_to)

        stmt = (
            select(
                func.count().label("total_runs"),
                func.coalesce(func.sum(LabExperimentRun.input_tokens), 0).label("input_tokens"),
                func.coalesce(func.sum(LabExperimentRun.output_tokens), 0).label("output_tokens"),
                func.coalesce(func.sum(LabExperimentRun.input_audio_duration), 0.0).label("audio_seconds"),
                func.coalesce(func.sum(LabExperimentRun.estimated_cost_usd), 0.0).label("cost_usd"),
            )
            .where(and_(*conditions))
        )
        row = (await self._session.execute(stmt)).one()

        type_stmt = (
            select(
                LabExperimentRun.experiment_type.label("type"),
                func.count().label("runs"),
                func.coalesce(func.sum(LabExperimentRun.estimated_cost_usd), 0.0).label("cost_usd"),
                func.avg(LabExperimentRun.latency_ms).label("avg_latency_ms"),
            )
            .where(and_(*conditions))
            .group_by(LabExperimentRun.experiment_type)
        )
        type_rows = (await self._session.execute(type_stmt)).all()

        return {
            "total_runs": row.total_runs,
            "total_input_tokens": row.input_tokens,
            "total_output_tokens": row.output_tokens,
            "total_audio_seconds": float(row.audio_seconds),
            "estimated_cost_usd": float(row.cost_usd),
            "by_type": [
                {
                    "type": r.type,
                    "runs": r.runs,
                    "cost_usd": float(r.cost_usd),
                    "avg_latency_ms": round(r.avg_latency_ms, 1) if r.avg_latency_ms else None,
                }
                for r in type_rows
            ],
        }
