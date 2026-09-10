import secrets

from app.infrastructure.hash.factory import get_password_hasher

from ..schemas import CreateShareTokenCommand
from ..models import ShareToken
from ..repository import ShareTokenRepository
from ..events import ShareTokenAtomic


class CreateShareTokenService:
    def __init__(self, repo: ShareTokenRepository):
        self.repo = repo

    async def execute(self, command: CreateShareTokenCommand) -> tuple[ShareTokenAtomic, ShareToken]:
        token = secrets.token_urlsafe(32)

        password_hash = None
        if command.password:
            password_hash = get_password_hasher().hash(value=command.password)

        # return
        share_token = await self.repo.add(
            token=token,
            document_id=command.document_id,
            created_by=command.created_by,
            expires_at=command.expires_at,
            max_downloads=command.max_downloads,
            download_count=0,
            password_hash=password_hash,
        )
        return ShareTokenAtomic.created(share_token=share_token)
