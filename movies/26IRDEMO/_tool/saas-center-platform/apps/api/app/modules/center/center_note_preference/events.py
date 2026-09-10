from dataclasses import dataclass

from app.core.type import uuid_str

from .models import CenterNotePreference


@dataclass(frozen=True, kw_only=True)
class CenterNotePreferenceAtomic:
    _act: str
    preference: CenterNotePreference

    @classmethod
    def upserted(
        cls,
        *,
        preference: CenterNotePreference,
    ) -> tuple["CenterNotePreferenceAtomic", CenterNotePreference]:
        return cls(_act="upserted", preference=preference), preference

    def act(self) -> str:
        return self._act

    def act_entity_name(self) -> str:
        return "center_note_preference"

    def act_entity_id(self) -> uuid_str:
        return self.preference.id

    def payload(self) -> dict:
        return {
            "data": {
                "center_id": self.preference.center_id,
                "default_template_type": self.preference.default_template_type,
            }
        }
