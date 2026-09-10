from sqlalchemy import Boolean, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class PushToken(BaseModel):
    __tablename__ = "push_tokens"

    # NULL = 내담자 앱 토큰. 기기는 센터가 아니라 계정에 속한다(보호자는 센터 N곳에 걸침)
    center_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    account_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "accounts"})
    token: Mapped[str] = mapped_column(String(512), nullable=False, unique=True)
    device_info: Mapped[str | None] = mapped_column(String(256), nullable=True)
    platform: Mapped[str] = mapped_column(String(10), nullable=False, default="web")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        Index("ix_push_tokens_center_account", "center_id", "account_id"),
        Index("ix_push_tokens_account", "account_id"),
        Index("ix_push_tokens_token", "token", unique=True),
    )
