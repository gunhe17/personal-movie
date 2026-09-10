from datetime import date

from sqlalchemy import String, Text, Date
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.persistence.models import BaseModel


# #
# model

class Member(BaseModel):
    __tablename__ = "members"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    person_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "persons"})
    role_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "roles"})

    person: Mapped["Person"] = relationship("Person", primaryjoin="Member.person_id == Person.id", foreign_keys="[Member.person_id]", lazy="select", viewonly=True)  # type: ignore

    employment_type: Mapped[str] = mapped_column(String(20), nullable=True)
    hire_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    profile_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)
    memo: Mapped[str | None] = mapped_column(Text, nullable=True)
    careers: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    educations: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    certifications: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
