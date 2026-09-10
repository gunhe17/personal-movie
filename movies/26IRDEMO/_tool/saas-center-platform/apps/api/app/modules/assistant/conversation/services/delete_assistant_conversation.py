from app.core.type import uuid_str

from ..repository import AssistantConversationRepository


class DeleteAssistantConversationService:
    def __init__(
        self,
        repo: AssistantConversationRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        conversation_id: uuid_str,
        center_id: uuid_str,
    ) -> None:
        # return
        await self.repo.remove_in_center(
            conversation_id=conversation_id,
            center_id=center_id,
        )
