from sqlalchemy import String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class CenterLinkAudit(BaseModel):
    __tablename__ = "center_link_audits"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    link_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True, info={"reference_table_name": "center_links"})
    invitation_id: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "center_link_invitations"})
    actor_id: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "members"})
    actor_type: Mapped[str] = mapped_column(String(20), nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
