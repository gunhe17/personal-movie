from app.core.type import uuid_str

from ..models import AssistantTurn
from ..repository import AssistantTurnRepository


class ClaimAssistantTurnService:
    def __init__(
        self,
        repo: AssistantTurnRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        conversation_id: uuid_str,
        center_id: uuid_str,
        *,
        answer_event: dict,
    ) -> AssistantTurn | None:
        # return (None = 이미 처리됨 — 이중 클릭)
        return await self.repo.claim_paused(
            conversation_id=conversation_id,
            center_id=center_id,
            answer_event=answer_event,
        )
