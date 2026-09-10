from app.core.datetime_utils import utc_now
from app.core.exceptions import InvalidOperationException

from ..models import AssessmentSendResult
from ..repository import AssessmentSendResultRepository

MAX_FAILED_ATTEMPTS = 5


class VerifySendResultService:
    # (atomic, model) 전환 SKIP 판정 — 유일 mutation(increment_failed_attempts)은 raise 경로라
    # 반환으로 못 나른다. 접근 사실은 handler의 SendResultAccessAtomic(verified/verification_failed)이
    # emit+reject로 기록(application/handlers/assessment/verify_send_result.py). 성공 경로는 mutation 없음.
    def __init__(
        self,
        repo: AssessmentSendResultRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        send_result_id: str,
        verification_code: str,
    ) -> AssessmentSendResult:
        # load
        send_result = await self.repo.get_by_id_public(send_result_id=send_result_id)

        # verify
        if send_result.revoked_at is not None:
            raise InvalidOperationException("무효화된 결과전송입니다.")
        if send_result.expires_at is not None and send_result.expires_at < utc_now():
            raise InvalidOperationException("만료된 결과전송입니다.")

        # rate-limit
        if send_result.failed_attempts >= MAX_FAILED_ATTEMPTS:
            raise InvalidOperationException(
                "인증 시도 횟수를 초과했습니다. 새로운 결과전송을 요청해주세요."
            )

        if send_result.verification_code != verification_code:
            new_count = await self.repo.increment_failed_attempts(
                send_result_id=send_result_id
            )
            remaining = MAX_FAILED_ATTEMPTS - new_count
            raise InvalidOperationException(
                f"인증번호가 일치하지 않습니다. (남은 시도: {remaining}회)"
            )

        # return
        return send_result
