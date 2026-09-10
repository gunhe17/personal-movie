import secrets
from datetime import timedelta

from app.core.exceptions import ConflictException
from app.core.type import utc_dt, uuid_str

from ..events import CenterLinkInvitationAtomic
from ..models import CenterLinkInvitation
from ..repository import CenterLinkInvitationRepository

INVITATION_TTL_HOURS = 48
CODE_GENERATION_MAX_ATTEMPTS = 10


class IssueInvitationService:
    def __init__(self, repo: CenterLinkInvitationRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: uuid_str,
        guardian_client_id: uuid_str,
        issued_by_member_id: uuid_str,
        now: utc_dt,
    ) -> tuple[CenterLinkInvitationAtomic, CenterLinkInvitation]:
        # compute (재발급 = 기존 유효 코드 무효화)
        existing = await self.repo.list_valid_for_guardian(
            center_id=center_id,
            guardian_client_id=guardian_client_id,
            now=now,
        )
        for invitation in existing:
            await self.repo.update_in_place(id=invitation.id, revoked_at=now)

        code = await self._generate_code(now=now)

        # return
        invitation = await self.repo.add(
            center_id=center_id,
            guardian_client_id=guardian_client_id,
            code=code,
            issued_by_member_id=issued_by_member_id,
            expires_at=now + timedelta(hours=INVITATION_TTL_HOURS),
        )
        return CenterLinkInvitationAtomic.issued(invitation=invitation)

    async def _generate_code(self, *, now: utc_dt) -> str:
        for _ in range(CODE_GENERATION_MAX_ATTEMPTS):
            code = f"{secrets.randbelow(1_000_000):06d}"
            if not await self.repo.exists_valid_code(code=code, now=now):
                return code
        raise ConflictException("초대 코드 발급에 실패했습니다. 다시 시도해 주세요.")
