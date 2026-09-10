from fastapi import APIRouter, Depends

from app.application.handlers.ai_lab.get_lab_metadata import get_lab_metadata_handler
from app.behavior import behavior, UnscopedContext, authenticate_admin, require_role
from app.modules.platform_admin.admin_account.models import AdminRole
from .schemas import LabMetadataResponse

router = APIRouter(prefix="/internal/ai-lab/metadata", tags=["AI Lab"])


@router.get("", response_model=LabMetadataResponse)
async def get_lab_metadata(
    ctx: UnscopedContext = Depends(
        behavior.request_unscoped(
            authenticate_admin(),
            require_role(*AdminRole.SUPER_PLUS),
        )
    ),
):
    return get_lab_metadata_handler()
