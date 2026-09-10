from app.core.datetime_utils import utc_now
from app.core.exceptions import InvalidOperationException

from ..models import AssessmentSendLink
from ..repository import AssessmentSendLinkRepository

MAX_FAILED_ATTEMPTS = 5


class VerifySendLinkService:
    """
    검사링크 인증 코드 검증 (단일 비즈니스 로직)

    책임:
    - SendLink 조회 + 만료/무효화 검증
    - 인증 실패 횟수 제한
    - 인증 코드 매칭
    """

    def __init__(self, repo: AssessmentSendLinkRepository):
        self.repo = repo

    async def execute(
        self,
        send_link_id: str,
        verification_code: str,
    ) -> AssessmentSendLink:
        send_link = await self.repo.get_by_id_public(send_link_id=send_link_id)

        if send_link.revoked_at is not None:
            raise InvalidOperationException("무효화된 검사 링크입니다.")
        if send_link.expires_at is not None and send_link.expires_at < utc_now():
            raise InvalidOperationException("만료된 검사 링크입니다.")

        if send_link.failed_attempts >= MAX_FAILED_ATTEMPTS:
            raise InvalidOperationException(
                "인증 시도 횟수를 초과했습니다. 센터에 검사 링크 재전송을 요청해주세요."
            )

        if send_link.verification_code != verification_code:
            new_count = await self.repo.increment_failed_attempts(
                send_link_id=send_link_id
            )
            remaining = MAX_FAILED_ATTEMPTS - new_count
            raise InvalidOperationException(
                f"인증번호가 일치하지 않습니다. (남은 시도: {remaining}회)"
            )

        return send_link
