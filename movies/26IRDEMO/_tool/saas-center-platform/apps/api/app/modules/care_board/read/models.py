from datetime import datetime

from sqlalchemy import DateTime, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class CareBoardRead(BaseModel):
    __tablename__ = "care_board_reads"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "clients"})
    member_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "members"})
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)

    __table_args__ = (
        Index(
            "uq_care_board_reads_member",
            "center_id",
            "client_id",
            "member_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )
