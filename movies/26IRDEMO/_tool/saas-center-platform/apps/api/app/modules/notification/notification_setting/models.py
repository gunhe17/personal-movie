from sqlalchemy import Boolean, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class NotificationSetting(BaseModel):
    __tablename__ = "notification_settings"

    # NULL = 계정 전역 설정(내담자 앱). 센터 스코프 행보다 우선순위가 낮다
    center_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    account_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "accounts"})
    event_type: Mapped[str | None] = mapped_column(String(50), nullable=True, default=None)
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    channel_in_app: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    channel_push: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    channel_alarmtalk: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    __table_args__ = (
        Index(
            "ix_noti_settings_category_only",
            "center_id", "account_id", "category",
            unique=True,
            postgresql_where=text("event_type IS NULL"),
        ),
        Index(
            "ix_noti_settings_event_type",
            "center_id", "account_id", "category", "event_type",
            unique=True,
            postgresql_where=text("event_type IS NOT NULL"),
        ),
        # 위 두 인덱스는 center_id가 NULL이면 유일성을 못 지킨다(NULL끼리는 서로 다름)
        # — 전역 행 전용 unique가 없으면 (account, category) 중복이 조용히 쌓인다
        Index(
            "uq_noti_settings_global_category",
            "account_id", "category",
            unique=True,
            postgresql_where=text("center_id IS NULL AND event_type IS NULL"),
        ),
        Index(
            "uq_noti_settings_global_event",
            "account_id", "category", "event_type",
            unique=True,
            postgresql_where=text("center_id IS NULL AND event_type IS NOT NULL"),
        ),
    )
