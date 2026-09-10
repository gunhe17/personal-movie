from sqlalchemy import Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class FamilyMember(BaseModel):
    __tablename__ = "family_members"
    __table_args__ = (
        Index(
            "uq_family_members_family_person_active",
            "family_id",
            "person_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    family_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "families"})
    person_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "persons"})
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="owner")
