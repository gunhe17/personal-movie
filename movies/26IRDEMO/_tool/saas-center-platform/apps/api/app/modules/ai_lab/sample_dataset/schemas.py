from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class SampleDatasetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    input_type: str = Field(pattern="^(text|audio)$")
    text_content: str | None = Field(None, max_length=50000)
    tags: str | None = Field(None, max_length=500)
    source_type: str | None = Field(None)
    source_id: str | None = None

    @model_validator(mode="after")
    def validate_text_content(self) -> "SampleDatasetCreate":
        if self.input_type == "text" and not self.text_content:
            raise ValueError("input_type이 'text'일 때 text_content는 필수입니다.")
        return self


class SampleDatasetUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    text_content: str | None = Field(None, max_length=50000)
    tags: str | None = Field(None, max_length=500)


class SampleDatasetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str | None = None
    input_type: str
    text_content: str | None = None
    s3_key: str | None = None
    audio_duration: float | None = None
    audio_file_size: int | None = None
    tags: str | None = None
    source_type: str | None = None
    field_note_id: str | None = None
    reference_segments: str | None = None  # 정답 화자 라벨(JSON) — 정확도 비교용
    author_id: str | None = None
    usage_count: int
    last_used_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class SampleDatasetSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    input_type: str
    tags: str | None = None
    usage_count: int
    last_used_at: datetime | None = None
    created_at: datetime


class SampleDatasetListResponse(BaseModel):
    items: list[SampleDatasetSummary]
    total: int
    page: int
    size: int
    pages: int


class SampleAudioUrlResponse(BaseModel):
    download_url: str
    expires_in: int
    sample_id: str
    audio_duration: float | None = None
    audio_file_size: int | None = None


class FieldNoteCandidate(BaseModel):
    field_note_id: str
    chunk_count: int
    duration: float
    transcribe_status: str | None = None
    diarization_status: str | None = None
    created_at: datetime
    already_imported: bool


class FieldNoteCandidateListResponse(BaseModel):
    items: list[FieldNoteCandidate]


class ImportFieldNoteSampleRequest(BaseModel):
    field_note_id: str = Field(min_length=1)
    name: str | None = Field(None, max_length=200)


class ReferenceSegment(BaseModel):
    speaker: str
    text: str = ""
    start: float = 0.0
    end: float = 0.0


class ReferenceSegmentsUpdate(BaseModel):
    segments: list[ReferenceSegment]
