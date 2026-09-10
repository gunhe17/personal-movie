from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..conversation.events import AssistantTurnAtomic
from ..conversation.models import (
    AssistantConversation,
    AssistantTurn,
    AssistantTurnStatus,
)
from ..conversation.repository import (
    AssistantConversationRepository,
    AssistantTurnRepository,
)
from ..conversation.schemas import (
    AssistantConversationDetailResponse,
    AssistantConversationListResponse,
    AssistantConversationResponse,
    AssistantTurnResponse,
)
from ..conversation.services.claim_assistant_turn import ClaimAssistantTurnService
from ..conversation.services.create_assistant_conversation import (
    CreateAssistantConversationService,
)
from ..conversation.services.create_assistant_turn import CreateAssistantTurnService
from ..conversation.services.delete_assistant_conversation import (
    DeleteAssistantConversationService,
)
from ..conversation.services.finish_assistant_turn import FinishAssistantTurnService
from ..conversation.services.get_assistant_conversation import (
    GetAssistantConversationService,
)
from ..conversation.services.list_assistant_conversations import (
    ListAssistantConversationsService,
)
from ..conversation.services.list_assistant_turns import ListAssistantTurnsService
from ..conversation.services.sweep_assistant_conversations import (
    SweepAssistantConversationsService,
)
from ..conversation.services.sweep_assistant_turns import SweepAssistantTurnsService
from ..conversation.services.update_assistant_conversation import (
    UpdateAssistantConversationService,
)


class AssistantFacade:
    def __init__(
        self,
        uow: UnitOfWork,
    ):
        self._uow = uow

    def _conversation_repo(self) -> AssistantConversationRepository:
        return self._uow.repo(AssistantConversationRepository)

    def _turn_repo(self) -> AssistantTurnRepository:
        return self._uow.repo(AssistantTurnRepository)

    # #
    # conversation

    async def create_assistant_conversation_with_response(
        self,
        *,
        center_id: str,
        member_id: str,
    ) -> AssistantConversationResponse:
        conversation = await CreateAssistantConversationService(
            self._conversation_repo()
        ).execute(
            center_id=center_id,
            member_id=member_id,
        )
        return AssistantConversationResponse.model_validate(conversation)

    async def get_assistant_conversation(
        self,
        conversation_id: str,
        center_id: str,
    ) -> AssistantConversation:
        return await GetAssistantConversationService(self._conversation_repo()).execute(
            conversation_id=conversation_id,
            center_id=center_id,
        )

    async def list_assistant_conversations_with_response(
        self,
        *,
        center_id: str,
        member_id: str,
        page: int = 1,
        size: int = 20,
    ) -> AssistantConversationListResponse:
        conversations, page_meta = await ListAssistantConversationsService(
            self._conversation_repo()
        ).execute(
            center_id=center_id,
            member_id=member_id,
            page=page,
            size=size,
        )
        return AssistantConversationListResponse(
            items=[
                AssistantConversationResponse.model_validate(c) for c in conversations
            ],
            **page_meta,
        )

    async def get_assistant_conversation_with_response(
        self,
        conversation_id: str,
        center_id: str,
    ) -> AssistantConversationDetailResponse:
        conversation = await GetAssistantConversationService(
            self._conversation_repo()
        ).execute(
            conversation_id=conversation_id,
            center_id=center_id,
        )
        turns = await ListAssistantTurnsService(self._turn_repo()).execute(
            conversation_id=conversation_id,
            center_id=center_id,
        )
        return AssistantConversationDetailResponse(
            id=conversation.id,
            title=conversation.title,
            created_at=conversation.created_at,
            updated_at=conversation.updated_at,
            turns=[AssistantTurnResponse.model_validate(t) for t in turns],
        )

    async def update_assistant_conversation(
        self,
        conversation_id: str,
        center_id: str,
        *,
        title: str | None,
    ) -> AssistantConversation:
        return await UpdateAssistantConversationService(
            self._conversation_repo()
        ).execute(
            conversation_id=conversation_id,
            center_id=center_id,
            title=title,
        )

    async def update_assistant_conversation_with_response(
        self,
        conversation_id: str,
        center_id: str,
        *,
        title: str,
    ) -> AssistantConversationResponse:
        conversation = await UpdateAssistantConversationService(
            self._conversation_repo()
        ).execute(
            conversation_id=conversation_id,
            center_id=center_id,
            title=title,
        )
        return AssistantConversationResponse.model_validate(conversation)

    async def delete_assistant_conversation(
        self,
        conversation_id: str,
        center_id: str,
    ) -> None:
        await DeleteAssistantConversationService(self._conversation_repo()).execute(
            conversation_id=conversation_id,
            center_id=center_id,
        )

    # #
    # turn

    async def create_assistant_turn(
        self,
        *,
        conversation_id: str,
        center_id: str,
        user_message: str,
    ) -> tuple[AssistantTurnAtomic, AssistantTurn]:
        return await CreateAssistantTurnService(self._turn_repo()).execute(
            conversation_id=conversation_id,
            center_id=center_id,
            user_message=user_message,
        )

    async def finish_assistant_turn(
        self,
        turn_id: str,
        center_id: str,
        *,
        status: AssistantTurnStatus,
        events: list,
        completion: str | None = None,
        bookmark: dict | None = None,
    ) -> AssistantTurn:
        return await FinishAssistantTurnService(self._turn_repo()).execute(
            turn_id=turn_id,
            center_id=center_id,
            status=status,
            events=events,
            completion=completion,
            bookmark=bookmark,
        )

    async def claim_assistant_turn(
        self,
        conversation_id: str,
        center_id: str,
        *,
        answer_event: dict,
    ) -> AssistantTurn | None:
        return await ClaimAssistantTurnService(self._turn_repo()).execute(
            conversation_id=conversation_id,
            center_id=center_id,
            answer_event=answer_event,
        )

    async def sweep_assistant(
        self,
        *,
        running_cutoff,
        empty_cutoff,
    ) -> tuple[int, int]:
        stale = await SweepAssistantTurnsService(self._turn_repo()).execute(
            cutoff=running_cutoff,
        )
        empty = await SweepAssistantConversationsService(
            self._conversation_repo()
        ).execute(
            cutoff=empty_cutoff,
        )
        return stale, empty

    async def list_assistant_turns(
        self,
        conversation_id: str,
        center_id: str,
        *,
        status: AssistantTurnStatus | None = None,
    ) -> list[AssistantTurn]:
        return await ListAssistantTurnsService(self._turn_repo()).execute(
            conversation_id=conversation_id,
            center_id=center_id,
            status=status,
        )
