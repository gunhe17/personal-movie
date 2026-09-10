from app.core.type import uuid_str

from ..events import AssistantTurnAtomic
from ..models import AssistantTurn
from ..repository import AssistantTurnRepository


class CreateAssistantTurnService:
    def __init__(
        self,
        repo: AssistantTurnRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        conversation_id: uuid_str,
        center_id: uuid_str,
        user_message: str,
    ) -> tuple[AssistantTurnAtomic, AssistantTurn]:
        # discard (새 턴이 시작되면 낡은 책갈피는 폐기)
        await self.repo.update_paused_to_abandoned(
            conversation_id=conversation_id,
            center_id=center_id,
        )

        # create (write-ahead — status=running)
        turn = await self.repo.add(
            conversation_id=conversation_id,
            center_id=center_id,
            user_message=user_message,
        )

        # return
        return AssistantTurnAtomic.started(turn=turn)
