"""Member Repository"""
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.repository import BaseRepository
from app.modules.auth.account.models import Account
from app.modules.member.models import Member


class MemberRepository(BaseRepository[Member]):
    def __init__(self, session: AsyncSession):
        super().__init__(Member, session)

    def _filtered_stmt(
        self,
        institution_id: str,
        *,
        search: str | None,
        role: str | None,
    ):
        stmt = (
            select(Member, Account.email)
            .outerjoin(Account, Member.account_id == Account.id)
            .where(
                Member.institution_id == institution_id,
                Member.deleted_at.is_(None),
            )
        )
        if role:
            stmt = stmt.where(Member.role == role)
        if search:
            pattern = f"%{search}%"
            stmt = stmt.where(
                or_(Member.name.ilike(pattern), Account.email.ilike(pattern))
            )
        return stmt

    async def list_paged_with_emails(
        self,
        institution_id: str,
        *,
        skip: int = 0,
        limit: int = 20,
        search: str | None = None,
        role: str | None = None,
    ) -> list[tuple[Member, str | None]]:
        stmt = (
            self._filtered_stmt(institution_id, search=search, role=role)
            .order_by(Member.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return [(member, email) for member, email in result.all()]

    async def count_filtered(
        self,
        institution_id: str,
        *,
        search: str | None = None,
        role: str | None = None,
    ) -> int:
        subquery = self._filtered_stmt(
            institution_id, search=search, role=role
        ).subquery()
        stmt = select(func.count()).select_from(subquery)
        result = await self._session.execute(stmt)
        return int(result.scalar() or 0)

    async def get_with_email_by_institution(
        self, institution_id: str, member_id: str
    ) -> tuple[Member, str | None] | None:
        """기관 소속 직원 단건 + 계정 이메일 조인"""
        stmt = (
            select(Member, Account.email)
            .outerjoin(Account, Member.account_id == Account.id)
            .where(
                Member.id == member_id,
                Member.institution_id == institution_id,
                Member.deleted_at.is_(None),
            )
        )
        result = await self._session.execute(stmt)
        row = result.first()
        if not row:
            return None
        member, email = row
        return member, email

    async def get_by_account(self, institution_id: str, account_id: str) -> Member | None:
        stmt = select(Member).where(
            Member.institution_id == institution_id,
            Member.account_id == account_id,
            Member.deleted_at.is_(None),
            Member.is_active.is_(True),
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all_by_account_id(self, account_id: str) -> list[Member]:
        """계정의 모든 활성 멤버십 조회"""
        stmt = select(Member).where(
            Member.account_id == account_id,
            Member.deleted_at.is_(None),
            Member.is_active.is_(True),
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def list_with_emails(
        self, institution_id: str
    ) -> list[tuple[Member, str | None]]:
        """기관 소속 멤버 전체 + 계정 이메일 조인 (목록용)"""
        stmt = (
            select(Member, Account.email)
            .outerjoin(Account, Member.account_id == Account.id)
            .where(
                Member.institution_id == institution_id,
                Member.deleted_at.is_(None),
            )
            .order_by(Member.created_at.desc())
        )
        result = await self._session.execute(stmt)
        return [(member, email) for member, email in result.all()]
