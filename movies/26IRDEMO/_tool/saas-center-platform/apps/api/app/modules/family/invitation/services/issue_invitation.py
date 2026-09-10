import secrets
from datetime import timedelta

from app.core.exceptions import ConflictException
from app.core.type import utc_dt, uuid_str

from ..models import FamilyInvitation
from ..repository import FamilyInvitationRepository

INVITATION_TTL_HOURS = 48
CODE_GENERATION_MAX_ATTEMPTS = 10


class IssueFamilyInvitationService:
    def __init__(self, repo: FamilyInvitationRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        family_id: uuid_str,
        invited_by_person_id: uuid_str,
        now: utc_dt,
    ) -> FamilyInvitation:
        # compute (재발급 = 기존 유효 코드 무효화)
        existing = await self.repo.list_valid_for_family(family_id=family_id, now=now)
        for invitation in existing:
            await self.repo.update_in_place(id=invitation.id, revoked_at=now)

        code = await self._generate_code(now=now)

        # return
        return await self.repo.add(
            family_id=family_id,
            code=code,
            invited_by_person_id=invited_by_person_id,
            expires_at=now + timedelta(hours=INVITATION_TTL_HOURS),
        )

    async def _generate_code(self, *, now: utc_dt) -> str:
        for _ in range(CODE_GENERATION_MAX_ATTEMPTS):
            code = f"{secrets.randbelow(1_000_000):06d}"
            if not await self.repo.exists_valid_code(code=code, now=now):
                return code
        raise ConflictException("초대 코드 발급에 실패했습니다. 다시 시도해 주세요.")
