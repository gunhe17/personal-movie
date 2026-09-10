from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.storage import get_storage_client
from ..repository import FieldNoteRepository
from ..schemas import AudioDownloadUrlResponse
from ..services import GetFieldNoteService
from ...field_note_audio.repository import FieldNoteAudioRepository
from ...field_note_audio.services import GetAudioByIdService


async def get_audio_download_url_handler(
    field_note_id: str,
    audio_id: str,
    center_id: str,
    uow: UnitOfWork,
    expires_in: int = 3600,
) -> AudioDownloadUrlResponse:
    await GetFieldNoteService(uow.repo(FieldNoteRepository)).execute(
        field_note_id, center_id
    )
    audio = await GetAudioByIdService(uow.repo(FieldNoteAudioRepository)).execute(
        audio_id, field_note_id
    )

    storage_client = get_storage_client()
    download_url = await storage_client.get_presigned_url(
        path=audio.storage_path,
        expires_in=expires_in,
    )

    return AudioDownloadUrlResponse(
        download_url=download_url,
        expires_in=expires_in,
        audio_id=audio.id,
        chunk_index=audio.chunk_index,
        duration=audio.duration,
    )


TOOL = {
    "name": "get_audio_download_url_handler",
    "permission": "read:counseling_note",
    "purpose": "필드노트 오디오의 임시 다운로드 URL을 발급한다.",
    "keywords": ["오디오 URL", "녹음 다운로드 링크", "audio url", "음성 파일 링크"],
    "boundaries": "필드노트 오디오의 '임시 URL' 발급(만료 있음). 청크 업로드는 upload_audio_chunk_handler.",
    "output": "오디오 임시 다운로드 URL (AudioDownloadUrlResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "field_note_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 필드노트",
                "description": "필드노트의 UUID.",
            },
            "audio_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 오디오",
                "description": "다운로드할 오디오의 UUID.",
            },
            "expires_in": {
                "type": "integer",
                "title": "만료 시간(초)",
                "description": "URL 만료 시간(초, 기본 3600).",
            },
        },
        "required": ["field_note_id", "audio_id"],
    },
}
