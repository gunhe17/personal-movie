from fastapi import APIRouter, File, UploadFile, Query

from app.modules.upload.image.schemas import ImageCategory, ImageUploadResponse
from app.modules.upload.image.handlers.upload_image import upload_image_handler

router = APIRouter(tags=["Admin - Upload"])


@router.post(
    "/images/",
    status_code=201,
    response_model=ImageUploadResponse,
)
async def admin_upload_image(
    file: UploadFile = File(..., description="업로드할 이미지 파일"),
    category: ImageCategory = Query(..., description="이미지 카테고리"),
    entity_id: str = Query(..., description="연관 엔티티 ID"),
):
    return await upload_image_handler(file, category, entity_id)
