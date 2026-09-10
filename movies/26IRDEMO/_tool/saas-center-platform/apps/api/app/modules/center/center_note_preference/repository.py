from app.core.type import uuid_str
from app.core.type import typecheck
from app.infrastructure.persistence.new_repository import PostgresRepository

from .models import CenterNotePreference


class CenterNotePreferenceRepository(PostgresRepository[CenterNotePreference]):
    model = CenterNotePreference

    # #
    # command

    @typecheck
    async def add(
        self,
        center_id: uuid_str,
        default_template_type: str,
    ) -> CenterNotePreference:
        return await super().add(
            CenterNotePreference(
                center_id=center_id,
                default_template_type=default_template_type,
            )
        )

    @typecheck
    async def upsert_template_in_center(
        self,
        center_id: uuid_str,
        *,
        default_template_type: str,
    ) -> CenterNotePreference:
        pref = await self.find_in_center(center_id=center_id)
        if pref is None:
            return await self.add(
                center_id=center_id,
                default_template_type=default_template_type,
            )
        updated = await self.update_fields(pref.id, default_template_type=default_template_type)
        assert updated is not None
        return updated

    # #
    # query

    @typecheck
    async def find_in_center(self, center_id: uuid_str) -> CenterNotePreference | None:
        return await self._find(where=[CenterNotePreference.center_id == center_id])
