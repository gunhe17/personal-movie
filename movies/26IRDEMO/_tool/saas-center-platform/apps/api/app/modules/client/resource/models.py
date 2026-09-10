from sqlalchemy import Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class ClientResource(BaseModel):
    __tablename__ = "client_resources"
    __table_args__ = (
        UniqueConstraint("client_id", "resource_id", name="uq_client_resource"),
        Index("ix_client_resources_client", "client_id"),
        Index("ix_client_resources_center", "center_id"),
        Index("ix_client_resources_type", "client_id", "resource_type"),
    )

    center_id: Mapped[str] = mapped_column(String(36), nullable=False)
    client_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "clients"})
    resource_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_type_field": "resource_type", "reference_tables": {"form_instance": "forms", "pre_admission": "documents", "consent": "documents", "assessment": "documents", "other": "documents"}})
    resource_type: Mapped[str] = mapped_column(String(20), nullable=False)
