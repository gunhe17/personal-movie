from enum import Enum

from sqlalchemy import Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class MemoType(str, Enum):
    INQUIRY = "inquiry"
    COMPLAINT = "complaint"
    REQUEST = "request"
    OTHER = "other"


# #
# model

class CSMemo(BaseModel):
    __tablename__ = "cs_memos"

    center_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_by: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "admin_accounts"})
    memo_type: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    center_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        Index(
            "idx_cs_memos_created_by",
            "created_by",
            "created_at",
            postgresql_where="deleted_at IS NULL",
        ),
        Index(
            "idx_cs_memos_center",
            "center_id",
            "created_at",
            postgresql_where="deleted_at IS NULL",
        ),
        Index(
            "idx_cs_memos_type",
            "memo_type",
            "created_at",
            postgresql_where="deleted_at IS NULL",
        ),
    )
