from sqlalchemy import BigInteger, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class GlobalDocument(BaseModel):
    __tablename__ = "global_documents"

    uploader_id: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "members"})
    file_type: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    original_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    storage_path: Mapped[str] = mapped_column(String(512), nullable=False, unique=True)
    checksum: Mapped[str | None] = mapped_column(String(64), nullable=True)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("ix_global_documents_deleted_at", "deleted_at"),
        Index("ix_global_documents_uploader", "uploader_id"),
    )
