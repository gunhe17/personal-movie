from app.core.exceptions import EntityNotFoundException, InvalidOperationException
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.storage import get_storage_client

from ...facade import SampleFacade
from ..schemas import SampleAudioUrlResponse


async def get_sample_audio_url_handler(
    sample_id: str,
    expires_in: int,
    uow: UnitOfWork,
) -> SampleAudioUrlResponse:
    sample = await SampleFacade(uow).find_sample(sample_id)
    if not sample:
        raise EntityNotFoundException(f"Sample not found: {sample_id}")
    if sample.input_type != "audio" or not sample.s3_key:
        raise InvalidOperationException("샘플이 오디오가 아니거나 S3 키가 없습니다.")

    storage = get_storage_client()
    download_url = await storage.get_presigned_url(
        path=sample.s3_key, expires_in=expires_in
    )
    return {
        "download_url": download_url,
        "expires_in": expires_in,
        "sample_id": sample.id,
        "audio_duration": sample.audio_duration,
        "audio_file_size": sample.audio_file_size,
    }


TOOL = {
    "name": "get_sample_audio_url_handler",
    "permission": None,
    "purpose": "샘플 오디오의 임시 다운로드 URL을 발급한다.",
    "keywords": ["샘플 오디오 URL", "오디오 링크", "audio url", "녹음 다운로드 링크"],
    "boundaries": "샘플의 오디오 '임시 URL' 발급(만료 있음). 샘플 정보는 get_sample_handler.",
    "output": "샘플 오디오 임시 다운로드 URL (SampleAudioUrlResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "sample_id": {"type": "string", "format": "uuid", "title": "대상 샘플", "description": "오디오 URL을 발급할 샘플의 UUID."},
            "expires_in": {"type": "integer", "title": "만료 시간(초)", "description": "발급할 URL의 만료 시간(초)."},
        },
        "required": ["sample_id", "expires_in"],
    },
}
