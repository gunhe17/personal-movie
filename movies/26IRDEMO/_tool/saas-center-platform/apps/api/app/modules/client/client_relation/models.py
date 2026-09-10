from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class ClientRelation(BaseModel):
    __tablename__ = "client_relations"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False)
    client_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "clients"})
    related_client_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "clients"})
    relation_type: Mapped[str] = mapped_column(String(20), nullable=False)
    relation_detail: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
