from ..repository import FieldNoteRepository


class ListAudioCandidatesForLabService:
    def __init__(self, repo: FieldNoteRepository) -> None:
        self.repo = repo

    async def execute(self, limit: int = 50) -> list[dict]:
        # load
        rows = await self.repo.aggregate_audio_candidates_for_lab(limit=limit)

        # return
        return [
            {
                "field_note_id": r.field_note_id,
                "chunk_count": int(r.chunk_count or 0),
                "duration": float(r.duration or 0.0),
                "transcribe_status": r.transcribe_status,
                "diarization_status": r.diarization_status,
                "created_at": r.created_at,
            }
            for r in rows
        ]
