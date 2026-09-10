import secrets
from datetime import datetime

from ..events import SendResultAtomic
from ..repository import AssessmentSendResultRepository
from ..models import AssessmentSendResult


def generate_verification_code() -> str:
    # 공개 verify 엔드포인트의 인증 비밀 — CSPRNG 사용(MT는 상태 복원 가능)
    return f"{secrets.randbelow(10000):04d}"


class CreateSendResultService:
    def __init__(
        self,
        repo: AssessmentSendResultRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: str,
        case_id: str,
        recipients: list[dict],
        channel: str,
        expires_at: datetime | None = None,
    ) -> tuple[SendResultAtomic, AssessmentSendResult]:
        # verify
        await self.repo.revoke_active_results(center_id=center_id, case_id=case_id)

        # load
        verification_code = generate_verification_code()

        # persist
        send_result = await self.repo.add(
            center_id=center_id,
            case_id=case_id,
            verification_code=verification_code,
            recipients=recipients,
            channel=channel,
            expires_at=expires_at,
        )

        # return
        return SendResultAtomic.created(send_result=send_result)
