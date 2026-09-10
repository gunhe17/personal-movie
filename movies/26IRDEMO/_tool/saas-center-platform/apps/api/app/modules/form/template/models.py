from enum import Enum
from sqlalchemy import Boolean, Index, Integer, String, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class FormTemplateStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"


# #
# model

class FormTemplate(BaseModel):
    __tablename__ = "form_templates"

    center_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    # 이 양식이 어느 서식에서 왔는가 — 센터가 공용 서식을 자기 양식으로 들여올 때 새긴다.
    # 이름이 아니라 이 id 가 동일성의 근거라, 이름을 바꾸거나 내용을 고쳐도 바우처와의
    # 연결이 유지되고 같은 서식을 두 번 들여오지 않는다. 직접 만든 양식은 None.
    source_template_id: Mapped[str | None] = mapped_column(
        String(36), nullable=True, info={"reference_table_name": "form_templates"}
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=FormTemplateStatus.DRAFT)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    schema: Mapped[dict] = mapped_column(JSONB, nullable=False)

    __table_args__ = (
        Index(
            "uq_form_templates_center_name_version",
            "center_id", "name", "version",
            unique=True,
            # 삭제된 양식이 이름을 계속 점유하면 같은 이름을 다시 쓸 수 없다
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index(
            "ix_form_templates_center_active",
            "center_id", "is_active",
            postgresql_where=text("is_active = true"),
        ),
        Index(
            "ix_form_templates_system",
            "is_active",
            postgresql_where=text("center_id IS NULL AND is_active = true"),
        ),
    )
