from enum import Enum

from sqlalchemy import Boolean, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class FAQCategory(str, Enum):
    GETTING_STARTED = "getting_started"
    GENERAL = "general"
    TECHNICAL = "technical"
    FEATURE = "feature"


# sort_order: 카테고리 내 정렬 순서(드래그앤드롭) / is_published: 센터 웹 노출 여부
class FAQ(BaseModel):

    __tablename__ = "faqs"

    created_by: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "admin_accounts"})
    category: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="카테고리: getting_started/general/technical/feature"
    )
    question: Mapped[str] = mapped_column(String(500), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)

    __table_args__ = (
        Index(
            "idx_faqs_category_order",
            "category",
            "sort_order",
            postgresql_where="is_published = true AND deleted_at IS NULL",
        ),
    )
