from datetime import date

from sqlalchemy import Date, String
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models import BaseModel


# #
# model

class Profile(BaseModel):
    __tablename__ = "profiles"

    family_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True, info={"reference_table_name": "families"})
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    relation: Mapped[str] = mapped_column(String(20), nullable=False, default="child")
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(10), nullable=True)
    # 보호자가 고른 아바타 — 업로드 사진과 기본 아바타가 한 컬럼에 함께 산다
    # (기본 아바타는 경로에 default-avatars/ 프리픽스가 있어 URL만으로 구분된다 — Client와 같은 규약).
    # 연결된 센터 Client의 사진보다 이 값이 우선한다(보호자 화면의 주인은 보호자).
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
