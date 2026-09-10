from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class SiblingRelation(BaseModel):
    __tablename__ = "sibling_relations"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False)
    client_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "clients"})
    sibling_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "clients"})
    relation_detail: Mapped[str | None] = mapped_column(String(50), nullable=True)
