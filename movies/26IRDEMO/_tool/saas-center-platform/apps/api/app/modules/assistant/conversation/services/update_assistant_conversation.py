from app.core.type import unset, uuid_str

from ..models import AssistantConversation
from ..repository import AssistantConversationRepository


class UpdateAssistantConversationService:
    def __init__(
        self,
        repo: AssistantConversationRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        conversation_id: uuid_str,
        center_id: uuid_str,
        *,
        title: str | None = unset,
    ) -> AssistantConversation:
        # return
        return await self.repo.update_in_center(
            conversation_id=conversation_id,
            center_id=center_id,
            title=title,
        )
