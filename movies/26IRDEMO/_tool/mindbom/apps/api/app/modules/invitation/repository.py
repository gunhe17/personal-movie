"""직원 초대 Repository"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.repository import BaseRepository
from app.modules.auth.account.models import Account
from app.modules.invitation.models import Invitation


class InvitationRepository(BaseRepository[Invitation]):
    def __init__(self, session: AsyncSession):
        super().__init__(Invitation, session)

    async def get_by_token_hash(self, token_hash: str) -> Invitation | None:
        stmt = select(Invitation).where(
            Invitation.token_hash == token_hash,
            Invitation.deleted_at.is_(None),
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_pending_by_email(
        self, institution_id: str, email: str
    ) -> Invitation | None:
        stmt = select(Invitation).where(
            Invitation.institution_id == institution_id,
            Invitation.email == email,
            Invitation.status == "pending",
            Invitation.deleted_at.is_(None),
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_pending_with_inviter(
        self, institution_id: str
    ) -> list[tuple[Invitation, str | None]]:
        """기관의 pending 초대 + 발송자 이름 조인"""
        stmt = (
            select(Invitation, Account.name)
            .outerjoin(Account, Invitation.invited_by_account_id == Account.id)
            .where(
                Invitation.institution_id == institution_id,
                Invitation.status == "pending",
                Invitation.deleted_at.is_(None),
            )
            .order_by(Invitation.created_at.desc())
        )
        result = await self._session.execute(stmt)
        return [(inv, name) for inv, name in result.all()]
