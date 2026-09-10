from ...field_note_audio.repository import FieldNoteAudioRepository


class GetFirstAudioForLabService:
    def __init__(self, audio_repo: FieldNoteAudioRepository) -> None:
        self._audio_repo = audio_repo

    async def execute(self, field_note_id: str) -> dict | None:
        # load
        audio = await self._audio_repo.find_first_with_storage(field_note_id=field_note_id)
        if not audio:
            return None

        # return
        return {"storage_path": audio.storage_path, "duration": audio.duration or 0.0}
