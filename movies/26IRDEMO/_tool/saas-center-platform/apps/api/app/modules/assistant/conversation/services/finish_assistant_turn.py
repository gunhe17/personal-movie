from app.core.datetime_utils import utc_now
from app.core.type import unset, uuid_str

from ..models import AssistantTurn, AssistantTurnStatus
from ..repository import AssistantTurnRepository


class FinishAssistantTurnService:
    def __init__(
        self,
        repo: AssistantTurnRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        turn_id: uuid_str,
        center_id: uuid_str,
        *,
        status: AssistantTurnStatus,
        events: list,
        completion: str | None = unset,
        bookmark: dict | None = unset,
    ) -> AssistantTurn:
        # return (터미널 UPDATE 1회 — 완주/멈춤/단절 공용)
        return await self.repo.update_in_center(
            turn_id=turn_id,
            center_id=center_id,
            status=status,
            events=events,
            completion=completion,
            bookmark=bookmark,
            ended_at=utc_now(),
        )
