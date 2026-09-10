from dataclasses import dataclass

from ..field_note_audio.models import FieldNoteAudio


@dataclass(frozen=True, kw_only=True)
class FieldNoteAudioAtomic:
    audio: FieldNoteAudio
    _changed: dict

    @classmethod
    def updated(
        cls,
        *,
        audio: FieldNoteAudio,
        changed: dict,
    ) -> tuple["FieldNoteAudioAtomic", FieldNoteAudio]:
        return cls(audio=audio, _changed=changed), audio

    def act(self) -> str:
        return "updated"

    def act_entity_name(self) -> str:
        return "field_note_audio"

    def act_entity_id(self) -> str:
        return self.audio.id

    def payload(self) -> dict:
        # 전사·화자분리 본문은 민감값 — payload 는 상태 필드만
        return {
            "input": self._changed,
            "result": {
                "id": self.audio.id,
                "transcript_status": self.audio.transcript_status,
                "stt_model_used": self.audio.stt_model_used,
            },
        }


@dataclass(frozen=True, kw_only=True)
class FieldNotePipelineDispatchAtomic:
    field_note_id: str
    job_type: str
    params: dict

    @classmethod
    def requested(
        cls,
        *,
        field_note_id: str,
        job_type: str,
        params: dict,
    ) -> tuple["FieldNotePipelineDispatchAtomic", None]:
        return cls(field_note_id=field_note_id, job_type=job_type, params=params), None

    def act(self) -> str:
        return "pipeline_requested"

    def act_entity_name(self) -> str:
        return "field_note"

    def act_entity_id(self) -> str:
        return self.field_note_id

    def payload(self) -> dict:
        return {
            "field_note_id": self.field_note_id,
            "job_type": self.job_type,
            "params": self.params,
        }
