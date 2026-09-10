import uuid
from fastapi import UploadFile

from app.infrastructure.storage import get_storage_client
from app.core.logger import get_logger
from app.core.exceptions import InvalidOperationException
from ..schemas import AttachmentUploadResponse

logger = get_logger(__name__)

# 허용되는 파일 MIME 타입 (이미지 + 문서)
ALLOWED_CONTENT_TYPES = {
    # 이미지
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    # 문서
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    # 아래아한글
    "application/haansofthwp",
    "application/x-hwp",
    "application/vnd.hancom.hwp",
    "application/vnd.hancom.hwpx",
}

# 최대 파일 크기 (10MB)
MAX_FILE_SIZE = 10 * 1024 * 1024

# 저장소 경로 prefix (기존 경로와 완전 분리)
STORAGE_PREFIX = "notice-attachment"


async def upload_notice_attachment_handler(
    file: UploadFile,
    notice_id: str,
) -> AttachmentUploadResponse:
    # 1. 파일 유효성 검사
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise InvalidOperationException(
            "허용되지 않는 파일 형식입니다. "
            "이미지(JPG/PNG/GIF/WebP), 문서(PDF/DOC/XLS/PPT), 한글(HWP/HWPX) 파일만 업로드할 수 있습니다."
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

    # 3. 파일 경로 생성 (기존 경로와 완전 분리)
    file_extension = _get_extension(file.filename, file.content_type)
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    storage_path = f"{STORAGE_PREFIX}/{notice_id}/{unique_filename}"

    # 4. 스토리지에 업로드
    storage_client = get_storage_client()
    await storage_client.upload_file(
        file_data=file_data,
        path=storage_path,
        content_type=file.content_type,
    )

    # 5. 공개 URL 생성
    url = storage_client.get_public_url(storage_path)
    original_name = file.filename or unique_filename

    logger.info(f"Attachment uploaded: {storage_path} ({file_size} bytes)")

    return AttachmentUploadResponse(
        url=url,
        path=storage_path,
        name=original_name,
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
        "application/pdf": ".pdf",
        "application/msword": ".doc",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
        "application/vnd.ms-excel": ".xls",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
        "application/vnd.ms-powerpoint": ".ppt",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
        "application/haansofthwp": ".hwp",
        "application/x-hwp": ".hwp",
        "application/vnd.hancom.hwp": ".hwp",
        "application/vnd.hancom.hwpx": ".hwpx",
    }
    return extension_map.get(content_type, ".bin")


TOOL = {
    "name": "upload_notice_attachment_handler",
    "permission": None,
    "purpose": "공지 첨부파일을 업로드한다.",
    "keywords": ["공지 첨부 업로드", "첨부파일 올리기", "notice attachment"],
    "boundaries": "운영자 전용 — 공지 첨부파일 업로드(이미지·문서).",
    "output": "업로드된 첨부 정보 — URL·경로 (AttachmentUploadResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "file": {'type': 'string', 'title': '첨부 파일', 'description': '업로드할 첨부 파일(이미지·문서).'},
            "notice_id": {'type': 'string', 'format': 'uuid', 'title': '대상 공지', 'description': '첨부를 붙일 공지 UUID(초안이면 draft).'},
        },
        "required": ["file", "notice_id"],
    },
}
