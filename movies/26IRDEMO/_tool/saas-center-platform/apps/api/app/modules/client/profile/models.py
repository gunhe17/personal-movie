from datetime import date

from sqlalchemy import Date, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class Client(BaseModel):
    __tablename__ = "clients"
    __table_args__ = (
        Index(
            "uq_clients_center_code",
            "center_id",
            "code",
            unique=True,
            postgresql_where="deleted_at IS NULL",
        ),
    )

    center_id: Mapped[str] = mapped_column(String(36), nullable=False)
    person_id: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "persons"})
    code: Mapped[str] = mapped_column(String(6), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(10), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    profile_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    memo: Mapped[str | None] = mapped_column(String(2000), nullable=True)
