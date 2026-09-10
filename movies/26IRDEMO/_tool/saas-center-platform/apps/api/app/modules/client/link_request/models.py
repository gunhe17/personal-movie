from enum import Enum
from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class LinkRequestStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


# #
# model

class ClientLinkRequest(BaseModel):
    __tablename__ = "client_link_requests"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False)
    person_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_table_name": "persons"})
    client_id: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "clients"})
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=LinkRequestStatus.PENDING)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
