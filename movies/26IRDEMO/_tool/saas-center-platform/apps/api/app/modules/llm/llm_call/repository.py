from typing import Any

from sqlalchemy import and_, func, select

from app.core.type import utc_dt, uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import LlmCall


class LlmCallRepository(PostgresRepository[LlmCall]):
    model = LlmCall

    # #
    # command

    @typecheck
    async def add(
        self,
        purpose: str,
        session_id: uuid_str | None = None,
        center_id: uuid_str | None = None,
        source_type: str = "agent",
        source_id: uuid_str | None = None,
        member_id: uuid_str | None = None,
        model: str | None = None,
        input_tokens: int = 0,
        output_tokens: int = 0,
        tokens_per_credit: int | None = None,
        credits_charged: int | None = None,
        audio_duration_seconds: float | None = None,
        latency_ms: float | None = None,
        error_message: str | None = None,
        meta: dict[str, Any] | None = None,
    ) -> LlmCall:
        return await super().add(
            LlmCall(
                purpose=purpose,
                session_id=session_id,
                center_id=center_id,
                source_type=source_type,
                source_id=source_id,
                member_id=member_id,
                model=model,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                tokens_per_credit=tokens_per_credit,
                credits_charged=credits_charged,
                audio_duration_seconds=audio_duration_seconds,
                latency_ms=latency_ms,
                error_message=error_message,
                meta=meta,
            )
        )

    # #
    # query

    @typecheck
    async def list_by_session(self, session_id: uuid_str) -> list[LlmCall]:
        return await self._filter(
            where=[LlmCall.session_id == session_id],
            order_by="created_at",
        )

    @typecheck
    async def list_recent_by_center(
        self,
        center_id: uuid_str,
        *,
        limit: int = 20,
        date_from: utc_dt | None = None,
        exclude_purposes: set[str] | frozenset[str] | None = None,
    ) -> list[LlmCall]:
        where: list = [LlmCall.center_id == center_id]
        if date_from:
            where.append(LlmCall.created_at >= date_from)
        if exclude_purposes:
            where.append(LlmCall.purpose.notin_(exclude_purposes))
        return await self._filter(
            where=where,
            order_by="created_at",
            descending=True,
            limit=limit,
        )

    @typecheck
    async def list_activity_in_center(
        self,
        center_id: uuid_str,
        *,
        member_id: uuid_str | None = None,
        source_id: uuid_str | None = None,
        date_from: utc_dt | None = None,
        date_to: utc_dt | None = None,
        limit: int = 20,
    ) -> tuple[list[LlmCall], int]:
        where = [
            LlmCall.center_id == center_id,
            LlmCall.deleted_at.is_(None),
        ]
        if member_id is not None:
            where.append(LlmCall.member_id == member_id)
        if source_id is not None:
            where.append(LlmCall.source_id == source_id)
        if date_from is not None:
            where.append(LlmCall.created_at >= date_from)
        if date_to is not None:
            where.append(LlmCall.created_at <= date_to)
        rows = await self._filter(
            where=where,
            order_by="created_at",
            descending=True,
            limit=limit,
        )
        total = await self._session.scalar(
            select(func.count()).select_from(LlmCall).where(*where)
        )
        return rows, total or 0

    @typecheck
    async def aggregate_by_source(
        self,
        source_type: str,
        source_id: uuid_str,
    ) -> list[dict]:
        stmt = (
            select(
                LlmCall.purpose.label("purpose"),
                LlmCall.model.label("model"),
                func.count().label("calls"),
                func.coalesce(func.sum(LlmCall.input_tokens), 0).label("input_tokens"),
                func.coalesce(func.sum(LlmCall.output_tokens), 0).label(
                    "output_tokens"
                ),
            )
            .where(
                LlmCall.source_type == source_type,
                LlmCall.source_id == source_id,
                LlmCall.deleted_at.is_(None),
            )
            .group_by(LlmCall.purpose, LlmCall.model)
        )
        rows = (await self._session.execute(stmt)).all()
        return [
            {
                "purpose": r.purpose,
                "model": r.model,
                "calls": r.calls,
                "input_tokens": r.input_tokens,
                "output_tokens": r.output_tokens,
            }
            for r in rows
        ]

    @typecheck
    async def aggregate_by_session(self, session_id: uuid_str) -> dict:
        stmt = select(
            func.count().label("calls"),
            func.coalesce(func.sum(LlmCall.input_tokens), 0).label("input_tokens"),
            func.coalesce(func.sum(LlmCall.output_tokens), 0).label("output_tokens"),
        ).where(
            LlmCall.session_id == session_id,
            LlmCall.deleted_at.is_(None),
        )
        row = (await self._session.execute(stmt)).one()
        return {
            "calls": row.calls,
            "input_tokens": row.input_tokens,
            "output_tokens": row.output_tokens,
        }

    @typecheck
    async def get_production_cost_summary(
        self,
        *,
        source_type: str | None = None,
        date_from: utc_dt | None = None,
        date_to: utc_dt | None = None,
    ) -> tuple[dict, list[dict]]:
        conditions = [
            LlmCall.deleted_at.is_(None),
        ]
        if source_type:
            conditions.append(LlmCall.source_type == source_type)
        if date_from:
            conditions.append(LlmCall.created_at >= date_from)
        if date_to:
            conditions.append(LlmCall.created_at < date_to)

        where = and_(*conditions)

        totals_stmt = select(
            func.count().label("total_calls"),
            func.coalesce(func.sum(LlmCall.input_tokens), 0).label("input_tokens"),
            func.coalesce(func.sum(LlmCall.output_tokens), 0).label("output_tokens"),
            func.coalesce(func.sum(LlmCall.audio_duration_seconds), 0.0).label(
                "audio_seconds"
            ),
        ).where(where)
        totals_row = (await self._session.execute(totals_stmt)).one()

        totals = {
            "total_calls": totals_row.total_calls,
            "total_input_tokens": totals_row.input_tokens,
            "total_output_tokens": totals_row.output_tokens,
            "total_audio_seconds": float(totals_row.audio_seconds),
        }

        purpose_stmt = (
            select(
                LlmCall.purpose.label("purpose"),
                LlmCall.model.label("model"),
                func.count().label("calls"),
                func.coalesce(func.sum(LlmCall.input_tokens), 0).label("input_tokens"),
                func.coalesce(func.sum(LlmCall.output_tokens), 0).label(
                    "output_tokens"
                ),
                func.coalesce(func.sum(LlmCall.audio_duration_seconds), 0.0).label(
                    "audio_seconds"
                ),
            )
            .where(where)
            .group_by(LlmCall.purpose, LlmCall.model)
        )
        purpose_rows = (await self._session.execute(purpose_stmt)).all()

        by_purpose = [
            {
                "purpose": r.purpose,
                "model": r.model,
                "calls": r.calls,
                "input_tokens": r.input_tokens,
                "output_tokens": r.output_tokens,
                "audio_seconds": float(r.audio_seconds),
            }
            for r in purpose_rows
        ]

        return totals, by_purpose

    @typecheck
    async def get_center_usage_summary(
        self,
        center_id: uuid_str,
        *,
        date_from: utc_dt | None = None,
        date_to: utc_dt | None = None,
    ) -> tuple[dict, list[dict], list[dict]]:
        conditions = [
            LlmCall.center_id == center_id,
            LlmCall.deleted_at.is_(None),
        ]
        if date_from:
            conditions.append(LlmCall.created_at >= date_from)
        if date_to:
            conditions.append(LlmCall.created_at < date_to)

        where = and_(*conditions)

        totals_stmt = select(
            func.count().label("total_calls"),
            func.coalesce(func.sum(LlmCall.input_tokens), 0).label("input_tokens"),
            func.coalesce(func.sum(LlmCall.output_tokens), 0).label("output_tokens"),
            func.coalesce(func.sum(LlmCall.audio_duration_seconds), 0.0).label(
                "audio_seconds"
            ),
            func.count(func.distinct(LlmCall.member_id)).label("active_members"),
        ).where(where)
        totals_row = (await self._session.execute(totals_stmt)).one()

        totals = {
            "total_calls": totals_row.total_calls,
            "total_input_tokens": totals_row.input_tokens,
            "total_output_tokens": totals_row.output_tokens,
            "total_audio_seconds": float(totals_row.audio_seconds),
            "active_members": totals_row.active_members,
        }

        purpose_stmt = (
            select(
                LlmCall.purpose.label("purpose"),
                func.count().label("calls"),
                func.coalesce(
                    func.sum(LlmCall.input_tokens + LlmCall.output_tokens), 0
                ).label("total_tokens"),
                func.coalesce(func.sum(LlmCall.credits_charged), 0).label("credits"),
            )
            .where(where)
            .group_by(LlmCall.purpose)
        )
        purpose_rows = (await self._session.execute(purpose_stmt)).all()

        by_purpose = [
            {
                "purpose": r.purpose,
                "calls": r.calls,
                "total_tokens": r.total_tokens,
                "credits": r.credits,
            }
            for r in purpose_rows
        ]

        daily_stmt = (
            select(
                func.date(LlmCall.created_at).label("date"),
                func.coalesce(
                    func.sum(LlmCall.input_tokens + LlmCall.output_tokens), 0
                ).label("tokens"),
                func.count().label("calls"),
                func.coalesce(func.sum(LlmCall.credits_charged), 0).label("credits"),
            )
            .where(where)
            .group_by(func.date(LlmCall.created_at))
            .order_by(func.date(LlmCall.created_at))
        )
        daily_rows = (await self._session.execute(daily_stmt)).all()

        daily = [
            {
                "date": str(r.date),
                "tokens": r.tokens,
                "calls": r.calls,
                "credits": r.credits,
            }
            for r in daily_rows
        ]

        return totals, by_purpose, daily

    @typecheck
    async def get_daily_purpose_breakdown(
        self,
        center_id: uuid_str,
        *,
        date_from: utc_dt | None = None,
        date_to: utc_dt | None = None,
    ) -> list[dict]:
        conditions = [
            LlmCall.center_id == center_id,
            LlmCall.deleted_at.is_(None),
        ]
        if date_from:
            conditions.append(LlmCall.created_at >= date_from)
        if date_to:
            conditions.append(LlmCall.created_at < date_to)

        stmt = (
            select(
                func.date(LlmCall.created_at).label("date"),
                LlmCall.purpose.label("purpose"),
                func.count().label("calls"),
                func.coalesce(func.sum(LlmCall.credits_charged), 0).label("credits"),
            )
            .where(and_(*conditions))
            .group_by(func.date(LlmCall.created_at), LlmCall.purpose)
            .order_by(func.date(LlmCall.created_at), LlmCall.purpose)
        )
        rows = (await self._session.execute(stmt)).all()

        return [
            {
                "date": str(r.date),
                "purpose": r.purpose,
                "calls": r.calls,
                "credits": r.credits,
            }
            for r in rows
        ]
