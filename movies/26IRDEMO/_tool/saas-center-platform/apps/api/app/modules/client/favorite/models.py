from sqlalchemy import Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class ClientFavorite(BaseModel):
    __tablename__ = "client_favorites"
    __table_args__ = (
        UniqueConstraint(
            "person_id", "client_id", name="uq_client_favorites_person_client"
        ),
        Index("ix_client_favorites_person_center", "person_id", "center_id"),
    )

    center_id: Mapped[str] = mapped_column(String(36), nullable=False)
    person_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "persons"})
    client_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "clients"})
