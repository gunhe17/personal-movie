import uuid
from fastapi import UploadFile

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.storage import get_storage_client
from app.core.logger import get_logger
from app.core.exceptions import InvalidOperationException
from app.infrastructure.worker import TaskDispatcher
from ...field_note_audio.schemas import AudioUploadResponse
from ..repository import FieldNoteRepository
from ..services import GetFieldNoteService
from ...field_note_audio.repository import FieldNoteAudioRepository
from ...field_note_audio.services import CreateAudioChunkService

logger = get_logger(__name__)

ALLOWED_AUDIO_TYPES = {
    "audio/mp4",
    "audio/x-m4a",
    "audio/aac",
    "audio/mpeg",
    "audio/wav",
    "audio/webm",
    "audio/ogg",
    "application/octet-stream",
}


async def upload_audio_chunk_handler(
    field_note_id: str,
    center_id: str,
    file: UploadFile,
    duration: float,
    uow: UnitOfWork,
    dispatcher: TaskDispatcher | None = None,
    member_id: str | None = None,
) -> AudioUploadResponse:
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_AUDIO_TYPES:
        raise InvalidOperationException(
            f"지원하지 않는 오디오 형식입니다: {content_type}"
        )

    audio_data = await file.read()
    if not audio_data:
        raise InvalidOperationException("빈 오디오 파일입니다.")

    ext = "m4a"
    if content_type == "audio/webm":
        ext = "webm"
    elif content_type == "audio/ogg":
        ext = "ogg"
    elif content_type == "audio/wav":
        ext = "wav"

    storage_path = f"field-notes/{field_note_id}/audio/{uuid.uuid4()}.{ext}"

    storage_client = get_storage_client()
    await storage_client.upload_file(audio_data, storage_path, content_type)
    logger.info(
        f"Audio chunk uploaded: field_note={field_note_id}, "
        f"path={storage_path}, size={len(audio_data)} bytes"
    )

    await GetFieldNoteService(uow.repo(FieldNoteRepository)).execute(
        field_note_id, center_id
    )
    audio = await CreateAudioChunkService(uow.repo(FieldNoteAudioRepository)).execute(
        field_note_id,
        storage_path=storage_path,
        duration=duration,
    )

    if dispatcher:
        await dispatcher.dispatch(
            "transcribe_chunk",
            target_id=field_note_id,
            center_id=center_id,
            params={
                "audio_id": audio.id,
                "storage_path": storage_path,
                "member_id": member_id,
            },
        )

    return AudioUploadResponse.model_validate(audio)


TOOL = {
    "name": "upload_audio_chunk_handler",
    "permission": "write:counseling_note",
    "agent_exposed": False,  # 오디오 바이너리 스트림 — agent 입력 부적합
    "purpose": "녹음 오디오 청크를 업로드한다.",
    "keywords": ["오디오 청크 업로드", "녹음 조각 전송", "audio chunk", "음성 업로드"],
    "boundaries": "녹음 중 오디오 '청크'를 올린다. 종료는 finish_recording_handler.",
    "output": "청크 업로드 결과 (AudioUploadResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "field_note_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 필드노트",
                "description": "청크를 올릴 필드노트의 UUID.",
            },
            "file": {
                "type": "string",
                "title": "오디오 청크 파일",
                "description": "업로드할 오디오 청크 파일.",
            },
            "duration": {
                "type": "number",
                "title": "청크 길이(초)",
                "description": "청크 길이(초).",
            },
        },
        "required": ["field_note_id", "file", "duration"],
    },
}
