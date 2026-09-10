from fastapi import APIRouter, Depends, File, UploadFile, Query

from app.application.handlers.upload import (
    upload_image_app_handler,
    delete_image_app_handler,
)
from app.behavior import behavior, UnscopedContext, authenticate
from .schemas import ImageCategory, ImageUploadResponse, ImageDeleteResponse

router = APIRouter(prefix="/images", tags=["Upload - Image"])


def _account():
    return behavior.request_unscoped(authenticate())


@router.post(
    "/",
    status_code=201,
    response_model=ImageUploadResponse,
)
async def upload_image(
    file: UploadFile = File(..., description="업로드할 이미지 파일"),
    category: ImageCategory = Query(..., description="이미지 카테고리"),
    entity_id: str = Query(..., description="연관 엔티티 ID"),
    ctx: UnscopedContext = Depends(_account()),
):
    return await upload_image_app_handler(
        file=file,
        category=category,
        entity_id=entity_id,
        person_id=ctx.person_id,
        uow=ctx.uow,
    )


@router.delete(
    "/",
    response_model=ImageDeleteResponse,
)
async def delete_image(
    path: str = Query(..., description="삭제할 이미지 경로"),
    ctx: UnscopedContext = Depends(_account()),
):
    return await delete_image_app_handler(
        path=path,
        person_id=ctx.person_id,
        uow=ctx.uow,
    )
