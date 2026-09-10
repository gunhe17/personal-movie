from ...field_note_audio.models import FieldNoteAudio
from ...field_note_audio.repository import FieldNoteAudioRepository
from ..events import FieldNoteAudioAtomic


class ClearAudioTranscriptService:
    def __init__(
        self,
        audio_repo: FieldNoteAudioRepository,
    ):
        self.repo = audio_repo

    async def execute(
        self,
        audio_id: str,
    ) -> tuple[FieldNoteAudioAtomic, FieldNoteAudio]:
        # mutate
        audio = await self.repo.update_in_place(
            audio_id=audio_id,
            diarized_transcript=None,
        )

        # return
        return FieldNoteAudioAtomic.updated(
            audio=audio,
            changed={"diarized_transcript": None},
        )
