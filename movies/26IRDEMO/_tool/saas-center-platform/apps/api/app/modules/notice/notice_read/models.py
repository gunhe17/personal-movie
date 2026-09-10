from sqlalchemy import Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class NoticeRead(BaseModel):
    __tablename__ = "notice_reads"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False)
    notice_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "notices"})
    member_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "members"})

    __table_args__ = (
        UniqueConstraint("notice_id", "member_id", name="uq_notice_reads_notice_member"),
        Index("idx_notice_reads_notice", "notice_id"),
        Index("idx_notice_reads_center", "notice_id", "center_id"),
    )
