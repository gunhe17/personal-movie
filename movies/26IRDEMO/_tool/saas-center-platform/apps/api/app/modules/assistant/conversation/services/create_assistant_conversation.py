from app.core.type import uuid_str

from ..models import AssistantConversation
from ..repository import AssistantConversationRepository


class CreateAssistantConversationService:
    def __init__(
        self,
        repo: AssistantConversationRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: uuid_str,
        member_id: uuid_str,
    ) -> AssistantConversation:
        # return
        return await self.repo.add(
            center_id=center_id,
            member_id=member_id,
        )
