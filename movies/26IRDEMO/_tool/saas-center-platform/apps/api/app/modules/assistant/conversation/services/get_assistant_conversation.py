from app.core.type import uuid_str

from ..models import AssistantConversation
from ..repository import AssistantConversationRepository


class GetAssistantConversationService:
    def __init__(
        self,
        repo: AssistantConversationRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        conversation_id: uuid_str,
        center_id: uuid_str,
    ) -> AssistantConversation:
        # return
        return await self.repo.get_in_center(
            conversation_id=conversation_id,
            center_id=center_id,
        )
