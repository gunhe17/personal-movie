from enum import Enum
from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class FormStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"


# #
# model

class Form(BaseModel):
    __tablename__ = "forms"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False)
    template_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "form_templates"})
    created_by: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "accounts"})
    submitted_by: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "accounts"})
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=FormStatus.DRAFT)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    # 보호자 원격 작성 링크 인증 — 발송으로 태어난 인스턴스만 값을 갖는다(상담사 직접 작성은 None).
    # 링크는 instance_id 만 담고, 이 코드는 문자 본문에 따로 실어 URL 유출만으로 열리지 않게 한다.
    verification_code: Mapped[str | None] = mapped_column(String(4), nullable=True)
    failed_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    __table_args__ = (
        Index("ix_forms_center_status", "center_id", "status"),
        Index("ix_forms_template", "template_id"),
    )
