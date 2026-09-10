from app.infrastructure.storage import get_storage_client
from app.core.logger import get_logger
from ..schemas import ImageDeleteResponse

logger = get_logger(__name__)


async def delete_image_handler(path: str) -> ImageDeleteResponse:
    storage_client = get_storage_client()
    await storage_client.delete_file(path)

    logger.info(f"Image deleted: {path}")

    return ImageDeleteResponse(
        message="이미지가 삭제되었습니다",
        path=path,
    )


TOOL = {
    "name": 'delete_image_handler',
    "permission": None,
    "purpose": '업로드된 이미지를 삭제한다.',
    "keywords": ['이미지 삭제', '사진 삭제', 'image 삭제'],
    "boundaries": '이미지 삭제. 업로드는 upload_image_handler.',
    "output": '삭제 결과 (ImageDeleteResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'path': {'type': 'string', 'title': '이미지 경로', 'description': '삭제할 이미지의 경로.'},
        },
        "required": ['path'],
    },
}
