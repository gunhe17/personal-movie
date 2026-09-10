from datetime import datetime

from sqlalchemy import DateTime, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class CenterLink(BaseModel):
    __tablename__ = "center_links"
    __table_args__ = (
        Index(
            "uq_center_links_profile_center_alive",
            "profile_id",
            "center_id",
            unique=True,
            postgresql_where=text(
                "deleted_at IS NULL AND status IN ('requested', 'active', 'suspended')"
            ),
        ),
        Index(
            "uq_center_links_family_client_alive",
            "family_id",
            "client_id",
            unique=True,
            postgresql_where=text(
                "deleted_at IS NULL AND status IN ('requested', 'active', 'suspended')"
            ),
        ),
    )

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    family_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "families"})
    profile_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "profiles"})
    person_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "persons"})
    client_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "clients"})
    guardian_client_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "clients"})
    invitation_id: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "center_link_invitations"})
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    end_reason: Mapped[str | None] = mapped_column(String(50), nullable=True)
    linked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
