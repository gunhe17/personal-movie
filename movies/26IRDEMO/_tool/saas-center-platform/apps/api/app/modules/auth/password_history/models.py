from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class PasswordHistory(BaseModel):
    __tablename__ = "password_histories"

    account_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "accounts"})
    password: Mapped[str] = mapped_column(String(255), nullable=False)
