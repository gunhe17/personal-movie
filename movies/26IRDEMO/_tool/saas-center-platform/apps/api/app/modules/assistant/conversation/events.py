from dataclasses import dataclass

from app.core.type import uuid_str

from .models import AssistantTurn


@dataclass(frozen=True, kw_only=True)
class AssistantTurnAtomic:
    _act: str
    turn: AssistantTurn

    @classmethod
    def started(
        cls,
        *,
        turn: AssistantTurn,
    ) -> tuple["AssistantTurnAtomic", AssistantTurn]:
        return cls(_act="started", turn=turn), turn

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "assistant_turn"

    def act_entity_id(self) -> uuid_str:
        return self.turn.id

    def payload(self) -> dict:
        return {
            "data": {
                "id": self.turn.id,
                "conversation_id": self.turn.conversation_id,
                "user_message": self.turn.user_message,
            }
        }
