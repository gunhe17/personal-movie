from sqlalchemy import Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class ProgramMember(BaseModel):
    __tablename__ = "program_members"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    program_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "programs"})
    member_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "members"})

    __table_args__ = (
        Index(
            "idx_program_member_unique",
            "program_id",
            "member_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )
