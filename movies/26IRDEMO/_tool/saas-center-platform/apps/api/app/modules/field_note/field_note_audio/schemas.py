from datetime import datetime
from pydantic import BaseModel


class FieldNoteAudioResponse(BaseModel):
    id: str
    field_note_id: str
    chunk_index: int
    storage_path: str
    duration: float
    transcript: str | None
    transcript_status: str
    diarized_transcript: str | None = None
    stt_model_used: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AudioUploadResponse(BaseModel):
    id: str
    chunk_index: int
    storage_path: str
    duration: float
    transcript_status: str
    created_at: datetime

    model_config = {"from_attributes": True}
