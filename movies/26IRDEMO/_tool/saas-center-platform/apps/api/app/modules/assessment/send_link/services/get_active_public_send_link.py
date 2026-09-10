from app.core.datetime_utils import utc_now
from app.core.exceptions import InvalidOperationException

from ..models import AssessmentSendLink
from ..repository import AssessmentSendLinkRepository


class GetActivePublicSendLinkService:
    def __init__(
        self,
        repo: AssessmentSendLinkRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        send_link_id: str,
    ) -> AssessmentSendLink:
        # load
        send_link = await self.repo.get_by_id_public(send_link_id=send_link_id)

        # verify — 링크 토큰 인증 후 재검증 (토큰 수명 내 revoke 대응)
        if send_link.revoked_at is not None:
            raise InvalidOperationException("무효화된 검사 링크입니다.")
        if send_link.expires_at is not None and send_link.expires_at < utc_now():
            raise InvalidOperationException("만료된 검사 링크입니다.")

        # return
        return send_link
