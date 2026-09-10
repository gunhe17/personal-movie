from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, DateTime, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


class CareBoardKind(str, Enum):
    COUNSELING = "counseling"
    ASSESSMENT = "assessment"
    FIELDNOTE = "fieldnote"
    DOCUMENT = "document"
    VOUCHER = "voucher"
    MEMO = "memo"
    HANDOVER = "handover"


# 센터 간 인계(docs/careboard/domain.md §16)에서 무엇이 나갈 수 있는지의 3단 분류.
# internal = 센터 내부 발화라 내담자에게도 타 센터에도 나가지 않는다.
class CareBoardShareClass(str, Enum):
    FACT = "fact"
    CLINICAL = "clinical"
    INTERNAL = "internal"


# #
# model

class CareBoardEntry(BaseModel):
    __tablename__ = "care_board_entries"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    client_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "clients"})
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)

    source_table: Mapped[str] = mapped_column(String(50), nullable=False)
    source_id: Mapped[str] = mapped_column(String(36), nullable=False, info={"reference_type_field": "source_table"})
    case_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    actor_id: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "members"})

    person_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True, info={"reference_table_name": "persons"})
    share_class: Mapped[str] = mapped_column(String(20), nullable=False, comment="fact|clinical|internal — 센터 간 인계 가능 등급")

    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    subtitle: Mapped[str | None] = mapped_column(String(50), nullable=True)
    body: Mapped[str | None] = mapped_column(String(300), nullable=True, comment="표시용 절삭본 — LLM 입력으로 쓰지 않는다(원본 재조회)")
    meta: Mapped[str | None] = mapped_column(String(200), nullable=True)

    pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    pinned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    pinned_by: Mapped[str | None] = mapped_column(String(36), nullable=True, info={"reference_table_name": "members"})
    source_deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)

    __table_args__ = (
        Index("ix_care_board_entries_client_time", "center_id", "client_id", "occurred_at"),
        # client_id까지 포함한다 — 그룹 케이스는 한 원천(case·session)이 참여 내담자
        # 각각의 보드에 행을 만든다. 원천 키만으로 유일하게 두면 두 번째 내담자가 막힌다.
        Index(
            "uq_care_board_entries_source",
            "source_table",
            "source_id",
            "client_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )
