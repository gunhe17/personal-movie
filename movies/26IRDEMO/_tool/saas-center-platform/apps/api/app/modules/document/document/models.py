from sqlalchemy import BigInteger, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class Document(BaseModel):
    __tablename__ = "documents"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    uploader_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "members"})
    file_type: Mapped[str] = mapped_column(String(100), nullable=False)
    access_level: Mapped[str] = mapped_column(String(20), nullable=False, default="center")
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    original_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    storage_path: Mapped[str] = mapped_column(String(512), nullable=False, unique=True)
    checksum: Mapped[str] = mapped_column(String(64), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("ix_documents_center_deleted", "center_id", "deleted_at"),
        Index("ix_documents_checksum", "center_id", "checksum"),
    )
