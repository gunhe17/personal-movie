from ...field_note_audio.models import FieldNoteAudio, FieldNoteAudioTranscriptStatus
from ...field_note_audio.repository import FieldNoteAudioRepository
from ..events import FieldNoteAudioAtomic


class MarkAudioTranscribedService:
    def __init__(
        self,
        audio_repo: FieldNoteAudioRepository,
    ):
        self.repo = audio_repo

    async def execute(
        self,
        audio_id: str,
        *,
        text: str,
        model: str,
    ) -> tuple[FieldNoteAudioAtomic, FieldNoteAudio]:
        # mutate
        audio = await self.repo.update_in_place(
            audio_id=audio_id,
            transcript=text,
            transcript_status=FieldNoteAudioTranscriptStatus.COMPLETED,
            stt_model_used=model,
        )

        # return (전사 본문은 민감값 — changed 에서 제외)
        return FieldNoteAudioAtomic.updated(
            audio=audio,
            changed={
                "transcript_status": FieldNoteAudioTranscriptStatus.COMPLETED,
                "stt_model_used": model,
            },
        )
