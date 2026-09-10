from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class AdminAccountInvitation(BaseModel):
    __tablename__ = "admin_account_invitations"

    invited_by: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "admin_accounts"})
    role: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    token: Mapped[str] = mapped_column(String(512), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True, default=None)
