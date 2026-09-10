from app.core.datetime_utils import utc_now
from app.core.exceptions import InvalidOperationException
from ..models import AssessmentSendLink
from ..repository import AssessmentSendLinkRepository


class GetSendLinkService:
    def __init__(self, repo: AssessmentSendLinkRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        case_id: str,
        send_link_id: str,
        validate_active: bool = False,
    ) -> AssessmentSendLink:
        # load
        send_link = await self.repo.get_in_center_case(
            center_id=center_id,
            case_id=case_id,
            send_link_id=send_link_id,
        )

        # verify
        if validate_active:
            if send_link.revoked_at is not None:
                raise InvalidOperationException("무효화된 바로링크입니다.")
            if (
                send_link.expires_at is not None
                and send_link.expires_at < utc_now()
            ):
                raise InvalidOperationException("만료된 바로링크입니다.")

        # return
        return send_link
