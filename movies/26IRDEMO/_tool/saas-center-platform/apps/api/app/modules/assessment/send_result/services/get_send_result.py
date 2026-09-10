from app.core.datetime_utils import utc_now
from app.core.exceptions import InvalidOperationException
from ..models import AssessmentSendResult
from ..repository import AssessmentSendResultRepository


class GetSendResultService:
    def __init__(self, repo: AssessmentSendResultRepository):
        self.repo = repo

    async def execute(
        self,
        center_id: str,
        case_id: str,
        send_result_id: str,
        validate_active: bool = False,
    ) -> AssessmentSendResult:
        # load
        send_result = await self.repo.get_in_center_case(
            center_id=center_id,
            case_id=case_id,
            send_result_id=send_result_id,
        )

        # verify
        if validate_active:
            if send_result.revoked_at is not None:
                raise InvalidOperationException("무효화된 결과전송입니다.")
            if (
                send_result.expires_at is not None
                and send_result.expires_at < utc_now()
            ):
                raise InvalidOperationException("만료된 결과전송입니다.")

        # return
        return send_result
