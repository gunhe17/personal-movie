import secrets
from datetime import datetime

from ..events import SendLinkAtomic
from ..repository import AssessmentSendLinkRepository
from ..models import AssessmentSendLink


def generate_verification_code() -> str:
    # 공개 verify 엔드포인트의 인증 비밀 — CSPRNG 사용(MT는 상태 복원 가능)
    return f"{secrets.randbelow(10000):04d}"


class CreateSendLinkService:
    def __init__(
        self,
        repo: AssessmentSendLinkRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: str,
        case_id: str,
        recipients: list[dict],
        assessment_ids: list[str],
        channel: str,
        expires_at: datetime | None = None,
    ) -> tuple[SendLinkAtomic, AssessmentSendLink]:
        # verify
        await self.repo.revoke_active_links(center_id=center_id, case_id=case_id)

        # load
        verification_code = generate_verification_code()

        # persist
        send_link = await self.repo.add(
            center_id=center_id,
            case_id=case_id,
            verification_code=verification_code,
            recipients=recipients,
            assessment_ids=assessment_ids,
            channel=channel,
            expires_at=expires_at,
        )

        # return
        return SendLinkAtomic.created(send_link=send_link)
