"""알림 모델 — member 단위 인앱 알림"""
from datetime import datetime

from sqlalchemy import DateTime, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.models import BaseModel


class Notification(BaseModel):
    """인앱 알림

    Attributes:
        institution_id: 기관 ID (멀티테넌시 격리)
        recipient_member_id: 수신 멤버 ID
        type: 알림 유형 (예: "examination.ai_draft_ready")
        title: 표시 제목
        body: 본문 (선택)
        entity_type: 연결 엔티티 타입 (예: "examination")
        entity_id: 연결 엔티티 ID
        link_path: 클릭 시 이동할 프론트 경로 (예: "/examinations/{id}")
        actor_member_id: 발생시킨 멤버 ID (시스템 발송이면 NULL)
        metadata_json: 추가 메타데이터 (JSON 직렬화 문자열)
        read_at: 읽음 시각 (NULL=미읽음)
    """

    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notif_recipient_created", "recipient_member_id", "created_at"),
        Index("ix_notif_recipient_unread", "recipient_member_id", "read_at"),
    )

    institution_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    recipient_member_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)

    type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)

    entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    entity_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    link_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    actor_member_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
