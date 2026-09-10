from dataclasses import dataclass

from app.core.type import uuid_str

from .models import CenterLinkInvitation


@dataclass(frozen=True, kw_only=True)
class CenterLinkInvitationAtomic:
    _act: str
    invitation: CenterLinkInvitation

    @classmethod
    def issued(
        cls,
        *,
        invitation: CenterLinkInvitation,
    ) -> tuple["CenterLinkInvitationAtomic", CenterLinkInvitation]:
        return cls(_act="issued", invitation=invitation), invitation

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "center_link_invitation"

    def act_entity_id(self) -> uuid_str:
        return self.invitation.id

    def payload(self) -> dict:
        # code(베어러 코드)는 payload 금지 — 반응이 id로 재조회한다
        return {
            "data": {
                "id": self.invitation.id,
                "center_id": self.invitation.center_id,
                "guardian_client_id": self.invitation.guardian_client_id,
                "issued_by_member_id": self.invitation.issued_by_member_id,
                "expires_at": self.invitation.expires_at.isoformat(),
            }
        }
