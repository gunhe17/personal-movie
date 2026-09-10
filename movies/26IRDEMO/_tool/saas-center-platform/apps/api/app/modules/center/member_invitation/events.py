from dataclasses import dataclass

from app.core.type import uuid_str

from .models import MemberInvitation


@dataclass(frozen=True, kw_only=True)
class MemberInvitationAtomic:
    _act: str
    invitation: MemberInvitation

    @classmethod
    def created(cls, *, invitation: MemberInvitation) -> tuple["MemberInvitationAtomic", MemberInvitation]:
        return cls(_act="created", invitation=invitation), invitation

    @classmethod
    def cancelled(cls, *, invitation: MemberInvitation) -> tuple["MemberInvitationAtomic", MemberInvitation]:
        return cls(_act="cancelled", invitation=invitation), invitation

    @classmethod
    def accepted(cls, *, invitation: MemberInvitation) -> tuple["MemberInvitationAtomic", MemberInvitation]:
        return cls(_act="accepted", invitation=invitation), invitation

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "member_invitation"

    def act_entity_id(self) -> uuid_str:
        return self.invitation.id

    def payload(self) -> dict:
        # role_code/role_name은 Role enrich이라 모델에 없음 — 모델 컬럼 평문만 dump
        inv = self.invitation
        return {
            "data": {
                "id": inv.id,
                "center_id": inv.center_id,
                "invited_by": inv.invited_by,
                "name": inv.name,
                "email": inv.email,
                "role_id": inv.role_id,
                "employment_type": inv.employment_type,
                "member_id": inv.member_id,
                "accepted_at": inv.accepted_at.isoformat() if inv.accepted_at else None,
                "expires_at": inv.expires_at.isoformat() if inv.expires_at else None,
            }
        }
