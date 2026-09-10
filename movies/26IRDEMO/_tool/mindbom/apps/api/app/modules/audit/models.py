"""감사추적 (Audit Trail) 모델 — GMP/SaMD 필수

모든 데이터 변경 이력을 불변(immutable) 로그로 기록.
SaMD 2등급 요구사항: 누가, 언제, 무엇을, 어떻게 변경했는지 추적 가능해야 함.
"""
from sqlalchemy import Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.models import BaseModel


class AuditLog(BaseModel):
    """감사추적 로그

    Attributes:
        entity_type: 대상 엔티티 타입 (예: "examination", "client")
        entity_id: 대상 엔티티 ID
        action: 행위 (create, update, delete, state_change, login_success 등)
        actor_id: 행위자 ID (없을 수 있음 - 익명 로그인 시도 등)
        actor_email: 행위자 이메일 (비정규화 — 계정 삭제 시에도 추적 가능)
        actor_role: 행위자 역할 (없을 수 있음)
        institution_id: 기관 ID (인증 전 이벤트는 NULL)
        trace_id: HTTP 요청 trace ID — 미들웨어와 audit 로그 매칭용
        ip_address: 클라이언트 IP
        user_agent: 클라이언트 UA
        old_value: 변경 전 값 (JSON)
        new_value: 변경 후 값 (JSON)
        metadata_json: 추가 정보 (JSON)
    """

    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_entity", "entity_type", "entity_id"),
        Index("ix_audit_logs_inst_created", "institution_id", "created_at"),
        Index("ix_audit_logs_actor_created", "actor_id", "created_at"),
    )

    entity_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    entity_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    actor_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    actor_email: Mapped[str] = mapped_column(String(255), nullable=False)
    actor_role: Mapped[str | None] = mapped_column(String(50), nullable=True)

    institution_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    trace_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)

    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)

    old_value: Mapped[str | None] = mapped_column(Text, nullable=True, comment="변경 전 (JSON)")
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True, comment="변경 후 (JSON)")
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True, comment="추가 메타데이터 (JSON)")
