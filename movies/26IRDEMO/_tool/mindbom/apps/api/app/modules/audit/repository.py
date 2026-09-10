"""감사추적 Repository — append-only / immutable

GMP/SaMD 원칙: audit 로그는 생성 후 수정/삭제 불가.
update/delete 메서드는 의도적으로 봉인되어 있으며 호출 시 RuntimeError를 발생시킴.
"""
from datetime import datetime
from typing import Any

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.repository import BaseRepository
from app.modules.audit.models import AuditLog
from app.modules.member.models import Member


class AuditLogRepository(BaseRepository[AuditLog]):
    def __init__(self, session: AsyncSession):
        super().__init__(AuditLog, session)

    # ── 변경 차단 (immutability 강제) ──
    async def update(self, *args: Any, **kwargs: Any) -> AuditLog | None:  # type: ignore[override]
        raise RuntimeError("AuditLog는 변경할 수 없습니다 (immutable, append-only).")

    async def delete(self, *args: Any, **kwargs: Any) -> bool:  # type: ignore[override]
        raise RuntimeError("AuditLog는 삭제할 수 없습니다 (immutable, append-only).")

    async def list_with_filters(
        self,
        institution_id: str,
        *,
        skip: int,
        size: int,
        entity_type: str | None = None,
        entity_id: str | None = None,
        action: str | None = None,
        actor_id: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> tuple[list[AuditLog], int]:
        """필터 적용 페이지네이션 조회 (items, total) 반환

        deleted_at 필터 없음 — audit는 immutable이라 soft-delete 자체가 부적합.

        institution_id 매칭 정책:
        - 직접 매치: AuditLog.institution_id == institution_id
        - 인증 전/시스템 이벤트(login_failed/logout/account_locked 등)는
          institution_id가 NULL이지만 actor_id가 해당 기관 멤버이면 포함.
        """
        member_subq = (
            select(Member.account_id)
            .where(Member.institution_id == institution_id)
            .scalar_subquery()
        )
        conditions: list[Any] = [
            or_(
                AuditLog.institution_id == institution_id,
                and_(
                    AuditLog.institution_id.is_(None),
                    AuditLog.actor_id.in_(member_subq),
                ),
            ),
        ]
        if entity_type:
            conditions.append(AuditLog.entity_type == entity_type)
        if entity_id:
            conditions.append(AuditLog.entity_id == entity_id)
        if action:
            conditions.append(AuditLog.action == action)
        if actor_id:
            conditions.append(AuditLog.actor_id == actor_id)
        if date_from:
            conditions.append(AuditLog.created_at >= date_from)
        if date_to:
            conditions.append(AuditLog.created_at <= date_to)

        where_clause = and_(*conditions)

        list_stmt = (
            select(AuditLog)
            .where(where_clause)
            .order_by(AuditLog.created_at.desc())
            .offset(skip)
            .limit(size)
        )
        count_stmt = select(func.count()).select_from(AuditLog).where(where_clause)

        list_result = await self._session.execute(list_stmt)
        items = list(list_result.scalars().all())

        count_result = await self._session.execute(count_stmt)
        total = count_result.scalar_one()

        return items, total
