from dataclasses import dataclass

from app.core.type import uuid_str

from .models import ProgramMember


@dataclass(frozen=True, kw_only=True)
class ProgramMemberAtomic:
    _act: str
    program_member: ProgramMember

    @classmethod
    def assigned(
        cls,
        *,
        program_member: ProgramMember,
    ) -> tuple["ProgramMemberAtomic", ProgramMember]:
        return cls(_act="assigned", program_member=program_member), program_member

    @classmethod
    def unassigned(
        cls,
        *,
        program_member: ProgramMember,
    ) -> tuple["ProgramMemberAtomic", ProgramMember]:
        return cls(_act="unassigned", program_member=program_member), program_member

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "program_member"

    def act_entity_id(self) -> uuid_str:
        return self.program_member.id

    def payload(self) -> dict:
        return {
            "data": {
                "program_id": self.program_member.program_id,
                "member_id": self.program_member.member_id,
            }
        }
