from sqlalchemy import Float, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class DirectoryCenter(BaseModel):
    __tablename__ = "directory_centers"

    # 외부 디렉토리 CSV의 행 id — 멱등 재임포트 자연키
    source_id: Mapped[int] = mapped_column(Integer, nullable=False)
    # 외부 정의 열린 집합 (센터·복지기관·기타·병원 …)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    website_url: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    phone_number: Mapped[str | None] = mapped_column(String(30), nullable=True, default=None)
    operating_hours_text: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    __table_args__ = (
        Index(
            "uq_directory_centers_source_id_active",
            "source_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index("ix_directory_centers_lat_lng", "latitude", "longitude"),
    )
