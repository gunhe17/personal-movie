from datetime import datetime

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..llm_call.repository import LlmCallRepository
from ..llm_call.schemas import LlmCallRecord
from ..llm_call.services.list_activity import ListLlmCallActivityService
from ..llm_call.services import (
    AggregateCallsBySessionService,
    AggregateCenterUsageService,
    AggregateProductionCostsService,
    AggregateProductionUsageService,
    AggregateUsageBySourceService,
)


class LlmCallFacade:
    def __init__(self, uow: UnitOfWork) -> None:
        self._uow = uow

    async def add_llm_call(
        self,
        *,
        session_id: str | None = None,
        model: str | None = None,
        input_tokens: int = 0,
        output_tokens: int = 0,
        latency_ms: float | None = None,
        error_message: str | None = None,
        meta: dict | None = None,
        purpose: str | None = None,
        center_id: str | None = None,
        source_type: str = "agent",
        source_id: str | None = None,
        audio_duration_seconds: float | None = None,
        member_id: str | None = None,
    ):
        from app.modules.llm.credit_balance.repository import CreditBalanceRepository
        from app.modules.llm.credit_rate_config.repository import (
            CreditRateConfigRepository,
        )
        from app.modules.llm.llm_call.services import RecordLlmCallService

        return await RecordLlmCallService(
            self._uow.repo(LlmCallRepository),
            self._uow.repo(CreditBalanceRepository),
            self._uow.repo(CreditRateConfigRepository),
        ).execute(
            session_id=session_id,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=latency_ms,
            error_message=error_message,
            meta=meta,
            purpose=purpose,
            center_id=center_id,
            source_type=source_type,
            source_id=source_id,
            audio_duration_seconds=audio_duration_seconds,
            member_id=member_id,
        )

    async def aggregate_by_conversation(self, conversation_id: str) -> dict:
        repo = self._uow.repo(LlmCallRepository)
        return await AggregateCallsBySessionService(repo).execute(conversation_id)

    async def list_activity(
        self,
        center_id: str,
        *,
        member_id: str | None = None,
        source_id: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        limit: int = 20,
    ) -> tuple[list[LlmCallRecord], int]:
        rows, total = await ListLlmCallActivityService(
            self._uow.repo(LlmCallRepository)
        ).execute(
            center_id,
            member_id=member_id,
            source_id=source_id,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
        )
        return [LlmCallRecord.model_validate(row) for row in rows], total

    async def get_production_cost_summary(
        self,
        source_type: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> dict:
        # source_type None = 전체 프로덕션 AI 비용 집계
        repo = self._uow.repo(LlmCallRepository)
        service = AggregateProductionCostsService(repo)
        return await service.execute(
            source_type=source_type,
            date_from=date_from,
            date_to=date_to,
        )

    async def get_raw_production_usage(
        self,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> tuple[dict, list[dict]]:
        repo = self._uow.repo(LlmCallRepository)
        return await AggregateProductionUsageService(repo).execute(
            date_from=date_from,
            date_to=date_to,
        )

    async def aggregate_usage_by_source(
        self,
        source_type: str,
        source_id: str,
    ) -> list[dict]:
        repo = self._uow.repo(LlmCallRepository)
        return await AggregateUsageBySourceService(repo).execute(
            source_type=source_type,
            source_id=source_id,
        )

    async def get_center_usage_summary(
        self,
        center_id: str,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> tuple[dict, list[dict], list[dict]]:
        repo = self._uow.repo(LlmCallRepository)
        return await AggregateCenterUsageService(repo).execute(
            center_id,
            date_from=date_from,
            date_to=date_to,
        )
