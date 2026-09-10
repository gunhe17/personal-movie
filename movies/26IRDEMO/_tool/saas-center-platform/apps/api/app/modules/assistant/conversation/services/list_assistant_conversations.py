from app.core.type import uuid_str
from app.infrastructure.persistence.new_repository import Page

from ..models import AssistantConversation
from ..repository import AssistantConversationRepository


class ListAssistantConversationsService:
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
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[AssistantConversation], Page]:
        # return
        return await self.repo.list_for_member_with_page(
            center_id=center_id,
            member_id=member_id,
            page=page,
            size=size,
        )
