from ..repository import FieldNoteAudioRepository
from ..models import FieldNoteAudio, FieldNoteAudioTranscriptStatus


class CreateAudioChunkService:
    def __init__(self, repo: FieldNoteAudioRepository):
        self.repo = repo

    async def execute(
        self,
        field_note_id: str,
        *,
        storage_path: str,
        duration: float,
        transcript_status: FieldNoteAudioTranscriptStatus = FieldNoteAudioTranscriptStatus.PENDING,
        stt_model_used: str | None = None,
        diarized_transcript: str | None = None,
    ) -> FieldNoteAudio:
        # load
        chunk_index = await self.repo.next_chunk_index(field_note_id=field_note_id)

        # return
        return await self.repo.add(
            field_note_id=field_note_id,
            chunk_index=chunk_index,
            storage_path=storage_path,
            duration=duration,
            transcript_status=transcript_status,
            stt_model_used=stt_model_used,
            diarized_transcript=diarized_transcript,
        )
