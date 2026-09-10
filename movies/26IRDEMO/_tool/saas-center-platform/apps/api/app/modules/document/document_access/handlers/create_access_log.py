from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import DocumentAccessCreate
from ..schemas import CreateAccessLogCommand
from ..repository import DocumentAccessRepository
from ..services import CreateAccessLogService


async def create_access_log_internal(
    uow: UnitOfWork,
    data: DocumentAccessCreate,
) -> None:
    # Schema → Command 변환 (API Layer → Service Layer)
    command = CreateAccessLogCommand(
        document_id=data.document_id,
        s3_version_id=data.s3_version_id,
        account_id=data.account_id,
        action=data.action.value,
        ip_address=data.ip_address,
        user_agent=data.user_agent,
    )

    # Repository 획득
    access_repo = uow.repo(DocumentAccessRepository)

    # Service 실행
    create_service = CreateAccessLogService(access_repo)
    await create_service.execute(command)
