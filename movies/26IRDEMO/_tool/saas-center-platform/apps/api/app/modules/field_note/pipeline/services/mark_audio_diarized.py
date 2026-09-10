import json

from ...field_note_audio.models import FieldNoteAudio
from ...field_note_audio.repository import FieldNoteAudioRepository
from ..events import FieldNoteAudioAtomic


class MarkAudioDiarizedService:
    def __init__(
        self,
        audio_repo: FieldNoteAudioRepository,
    ):
        self.repo = audio_repo

    async def execute(
        self,
        audio_id: str,
        *,
        diarize_result: dict,
        stt_model: str,
    ) -> tuple[FieldNoteAudioAtomic, FieldNoteAudio]:
        # mutate
        audio = await self.repo.update_in_place(
            audio_id=audio_id,
            diarized_transcript=json.dumps(diarize_result, ensure_ascii=False),
            stt_model_used=stt_model,
        )

        # return (화자분리 본문은 민감값 — changed 에서 제외)
        return FieldNoteAudioAtomic.updated(
            audio=audio,
            changed={"stt_model_used": stt_model},
        )
