from app.core.exceptions import InvalidOperationException
from ..events import CenterNotePreferenceAtomic
from ..models import CenterNotePreference
from ..repository import CenterNotePreferenceRepository
from ..schemas import VALID_TEMPLATE_TYPES


class UpsertNotePreferenceService:
    def __init__(self, repo: CenterNotePreferenceRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        default_template_type: str,
    ) -> tuple[CenterNotePreferenceAtomic, CenterNotePreference]:
        # verify
        if default_template_type not in VALID_TEMPLATE_TYPES:
            raise InvalidOperationException(
                f"유효하지 않은 서식 타입입니다: {default_template_type}. "
                f"허용값: {', '.join(sorted(VALID_TEMPLATE_TYPES))}"
            )

        # return
        preference = await self.repo.upsert_template_in_center(
            center_id=center_id,
            default_template_type=default_template_type,
        )
        return CenterNotePreferenceAtomic.upserted(preference=preference)
