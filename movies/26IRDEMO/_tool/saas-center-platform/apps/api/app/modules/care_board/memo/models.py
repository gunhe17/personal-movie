from datetime import datetime

from sqlalchemy import DateTime, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class CareMemo(BaseModel):
    __tablename__ = "care_memos"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "clients"})
    author_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "members"})
    body: Mapped[str] = mapped_column(Text, nullable=False)
    edited_by: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "members"}, comment="작성자가 아닌 사람(관리자)이 고쳤을 때만")
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)

    __table_args__ = (
        Index("ix_care_memos_client", "center_id", "client_id", "created_at"),
    )
