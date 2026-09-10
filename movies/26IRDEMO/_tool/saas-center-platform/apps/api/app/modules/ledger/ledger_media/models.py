from enum import Enum

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class LedgerMediaType(str, Enum):
    IMAGE = "image"
    VIDEO = "video"


class LedgerMediaUploadStatus(str, Enum):
    PENDING = "pending"
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


# #
# model

class LedgerMedia(BaseModel):
    __tablename__ = "ledger_media"

    entry_id: Mapped[str] = mapped_column(
        String(36), nullable=False, index=True, info={"reference_table_name": "ledger_entries"}
    )
    media_type: Mapped[str] = mapped_column(String(10), nullable=False)
    upload_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=LedgerMediaUploadStatus.PENDING.value
    )
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    checksum: Mapped[str | None] = mapped_column(String(128), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    poster_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # 쿼터 귀속 월(YYYY-MM) — 발급 시점 동결이라 완료가 다음 달로 넘어가도 안 옮겨간다
    quota_month: Mapped[str] = mapped_column(String(7), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
