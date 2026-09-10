from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class PlanConfig(BaseModel):
    __tablename__ = "plan_configs"

    plan_type: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    base_plan: Mapped[str | None] = mapped_column(String(30), nullable=True)
    label: Mapped[str] = mapped_column(String(50), nullable=False)
    badge_text: Mapped[str | None] = mapped_column(String(50), nullable=True)
    tagline: Mapped[str | None] = mapped_column(String(200), nullable=True)
    audience: Mapped[str | None] = mapped_column(String(200), nullable=True)
    badge_bg: Mapped[str | None] = mapped_column(String(50), nullable=True)
    price_monthly: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    credit_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    plan_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_recommended: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    features: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    base_features: Mapped[str | None] = mapped_column(Text, nullable=True)
    additions: Mapped[str | None] = mapped_column(Text, nullable=True)
    feature_labels: Mapped[str | None] = mapped_column(Text, nullable=True)
    feature_descriptions: Mapped[str | None] = mapped_column(Text, nullable=True)
