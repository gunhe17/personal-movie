from enum import Enum
from datetime import datetime

from sqlalchemy import DateTime, Index, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class VoucherExtractionStatus(str, Enum):
    PROCESSING = "processing"
    REVIEW = "review"        # 1단계(영역·서식 정의) 완료 — 운영자 확정을 기다린다
    PAUSED = "paused"        # 운영자가 중단 — progress 는 그대로, resume 이 이어받는다
    COMPLETED = "completed"
    FAILED = "failed"


# #
# model

class VoucherExtraction(BaseModel):
    __tablename__ = "voucher_extractions"

    source_document_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    artifact_document_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=VoucherExtractionStatus.PROCESSING, server_default=VoucherExtractionStatus.PROCESSING.value)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False, server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    failed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    completed: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    failed: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 진행 상태(processing·paused 중만 의미) — 완료 시 무시(status가 정본):
    #   {stage, claimed_at?, stop_requested?, data:{스테이지 간 인계}}
    progress: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    @property
    def all_document_ids(self) -> list:
        return [
            *(self.source_document_ids or []),
            *(self.artifact_document_ids or []),
        ]

    @property
    def is_completed(self) -> bool:
        return self.status == VoucherExtractionStatus.COMPLETED

    @property
    def is_processing(self) -> bool:
        return self.status == VoucherExtractionStatus.PROCESSING

    __table_args__ = (
        Index("ix_voucher_extractions_status", "status"),
        Index("ix_voucher_extractions_deleted_at", "deleted_at"),
    )
