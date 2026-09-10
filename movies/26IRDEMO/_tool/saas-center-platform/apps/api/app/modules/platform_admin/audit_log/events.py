from dataclasses import dataclass, field

from app.core.type import uuid_str


@dataclass(frozen=True, kw_only=True)
class AdminAuditAtomic:
    """운영자 감사 사실 — 옛 AuditLogger.log(action/target_type/target_id) 대체.

    admin 액션은 도메인별 마커가 없어 이 하나로 통일한다(감사 계약이 균일: act·대상·payload).
    event.actor_type='admin'·event.ip_address가 운영자·IP를, actor_id가 admin_account_id를 담는다.
    """

    _act: str
    _entity_name: str
    _entity_id: uuid_str
    _payload: dict = field(default_factory=dict)

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return self._entity_name

    def act_entity_id(self) -> uuid_str:
        return self._entity_id

    def payload(self) -> dict:
        return self._payload
