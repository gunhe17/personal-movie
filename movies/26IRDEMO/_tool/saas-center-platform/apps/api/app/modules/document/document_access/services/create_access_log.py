from ..schemas import CreateAccessLogCommand
from ..models import DocumentAccess
from ..repository import DocumentAccessRepository


class CreateAccessLogService:
    def __init__(self, repo: DocumentAccessRepository):
        self.repo = repo

    async def execute(self, command: CreateAccessLogCommand) -> DocumentAccess:
        # return
        return await self.repo.add(
            document_id=command.document_id,
            s3_version_id=command.s3_version_id,
            account_id=command.account_id,
            action=command.action,
            ip_address=command.ip_address,
            user_agent=command.user_agent,
        )
