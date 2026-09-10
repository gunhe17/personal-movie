from ...field_note_audio.models import FieldNoteAudio
from ...field_note_audio.repository import FieldNoteAudioRepository
from ..events import FieldNoteAudioAtomic


class UpdateAudioTranscriptStatusService:
    def __init__(
        self,
        audio_repo: FieldNoteAudioRepository,
    ):
        self.repo = audio_repo

    async def execute(
        self,
        audio_id: str,
        *,
        transcript_status: str,
    ) -> tuple[FieldNoteAudioAtomic, FieldNoteAudio]:
        # mutate
        audio = await self.repo.update_in_place(
            audio_id=audio_id,
            transcript_status=transcript_status,
        )

        # return
        return FieldNoteAudioAtomic.updated(
            audio=audio,
            changed={"transcript_status": transcript_status},
        )
