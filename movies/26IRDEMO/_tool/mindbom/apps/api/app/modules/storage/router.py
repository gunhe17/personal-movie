"""파일 서빙 라우터 — S3/Local 스토리지에서 파일 다운로드"""
from fastapi import APIRouter, Depends
from fastapi.responses import Response

from app.modules.auth.dependencies import get_current_user
from app.infrastructure.storage import StorageBackend, get_storage

router = APIRouter(prefix="/storage", tags=["storage"])


@router.get("/{file_path:path}")
async def serve_file(
    file_path: str,
    _current_user: dict = Depends(get_current_user),
    storage: StorageBackend = Depends(get_storage),
) -> Response:
    """스토리지에서 파일을 읽어 응답 (인증 필수)"""
    data, content_type = await storage.download(file_path)
    return Response(
        content=data,
        media_type=content_type,
        headers={"Cache-Control": "private, max-age=3600"},
    )
