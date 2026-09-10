from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class FamilyInvitation(BaseModel):
    __tablename__ = "family_invitations"

    family_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "families"})
    invited_by_person_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "persons"})
    claimed_by_person_id: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "persons"})
    code: Mapped[str] = mapped_column(String(6), nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
