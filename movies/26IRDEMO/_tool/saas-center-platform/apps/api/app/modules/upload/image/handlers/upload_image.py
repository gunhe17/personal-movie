import uuid
from fastapi import UploadFile

from app.infrastructure.storage import get_storage_client
from app.core.logger import get_logger
from app.core.exceptions import InvalidOperationException
from ..schemas import ImageCategory, ImageUploadResponse

logger = get_logger(__name__)

# 허용되는 이미지 MIME 타입
ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
}

# 최대 파일 크기 (10MB)
MAX_FILE_SIZE = 10 * 1024 * 1024


async def upload_image_handler(
    file: UploadFile,
    category: ImageCategory,
    entity_id: str,
) -> ImageUploadResponse:
    # 1. 파일 유효성 검사
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise InvalidOperationException(
            f"허용되지 않는 파일 형식입니다. 허용: {', '.join(ALLOWED_CONTENT_TYPES)}"
        )

    # 2. 파일 읽기
    file_data = await file.read()
    file_size = len(file_data)

    if file_size > MAX_FILE_SIZE:
        raise InvalidOperationException(
            f"파일 크기가 너무 큽니다. 최대: {MAX_FILE_SIZE // (1024 * 1024)}MB"
        )

    if file_size == 0:
        raise InvalidOperationException("빈 파일은 업로드할 수 없습니다")

    # 3. 파일 경로 생성
    file_extension = _get_extension(file.filename, file.content_type)
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    storage_path = f"{category.value}/{entity_id}/{unique_filename}"

    # 4. 스토리지에 업로드
    storage_client = get_storage_client()
    await storage_client.upload_file(
        file_data=file_data,
        path=storage_path,
        content_type=file.content_type,
    )

    # 5. 영구 공개 URL 생성 (presigned URL은 1시간 후 만료되므로 사용하지 않음)
    url = storage_client.get_public_url(storage_path)

    logger.info(f"Image uploaded: {storage_path} ({file_size} bytes)")

    return ImageUploadResponse(
        url=url,
        path=storage_path,
        size=file_size,
        content_type=file.content_type,
    )


def _get_extension(filename: str | None, content_type: str) -> str:
    if filename and "." in filename:
        return "." + filename.rsplit(".", 1)[1].lower()

    extension_map = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "image/webp": ".webp",
    }
    return extension_map.get(content_type, ".bin")


TOOL = {
    "name": 'upload_image_handler',
    "permission": None,
    "purpose": '이미지를 업로드한다.',
    "keywords": ['이미지 업로드', '사진 올리기', 'image upload'],
    "boundaries": '이미지를 올리고 저장 경로를 돌려준다. 삭제는 delete_image_handler.',
    "output": '업로드된 이미지의 공개 URL과 저장 경로 (ImageUploadResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'file': {'type': 'string', 'title': '이미지 파일', 'description': '업로드할 이미지 파일.'},
            'category': {'type': 'string', 'enum': ['center-logo', 'center-image', 'room-thumbnail', 'profile', 'client-profile', 'member-profile', 'notice'], 'title': '이미지 용도', 'description': '이미지 분류.'},
            'entity_id': {'type': 'string', 'format': 'uuid', 'title': '연결 대상', 'description': '이미지가 연결될 대상의 식별 번호.'},
        },
        "required": ['file', 'category', 'entity_id'],
    },
}
