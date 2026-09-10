from datetime import datetime
from enum import Enum

from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class InvitationStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    EXPIRED = "expired"


# #
# model

class MemberInvitation(BaseModel):
    __tablename__ = "member_invitations"

    # 파생 생명주기 상태 — 컬럼 아님(accepted_at·expires_at + now로 repo가 계산). 분류 아키타입으로 필터.
    AGENT_DERIVED_STATUS = InvitationStatus

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    role_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "roles"})
    member_id: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "members"})
    invited_by: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "accounts"})
    employment_type: Mapped[str | None] = mapped_column(String(20), nullable=True, default=None)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
