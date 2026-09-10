from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class Family(BaseModel):
    __tablename__ = "families"

    name: Mapped[str | None] = mapped_column(String(100), nullable=True)
