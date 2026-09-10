from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class RolePermission(BaseModel):
    __tablename__ = "role_permissions"

    role_id: Mapped[str] = mapped_column(String(36), primary_key=True, info={"reference_table_name": "roles"})
    permission_id: Mapped[int] = mapped_column(Integer, primary_key=True, info={"reference_table_name": "permissions"})
