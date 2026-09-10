from app.core.type import uuid_str

from ..repository import CenterLinkInvitationRepository


class RestoreInvitationService:
    def __init__(
        self,
        repo: CenterLinkInvitationRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        invitation_id: uuid_str,
    ) -> None:
        # update — claim 흔적 해제로 초대 재사용 가능 상태 복원
        await self.repo.update_in_place(
            id=invitation_id,
            claimed_at=None,
            claimed_by_person_id=None,
        )
