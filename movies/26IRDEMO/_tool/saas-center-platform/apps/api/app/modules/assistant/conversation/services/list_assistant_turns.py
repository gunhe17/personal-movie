from app.core.type import uuid_str

from ..models import AssistantTurn, AssistantTurnStatus
from ..repository import AssistantTurnRepository


class ListAssistantTurnsService:
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
        status: AssistantTurnStatus | None = None,
    ) -> list[AssistantTurn]:
        # return
        return await self.repo.list_in_conversation(
            conversation_id=conversation_id,
            center_id=center_id,
            status=status,
        )
