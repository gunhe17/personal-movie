"""직원 초대 Services"""
import hashlib
import secrets
from datetime import timedelta

from app.core.datetime_utils import utc_now
from app.core.exceptions import (
    ConflictException,
    EntityNotFoundException,
    InvalidOperationException,
    PermissionDeniedException,
)
from app.modules.invitation.models import Invitation
from app.modules.invitation.repository import InvitationRepository

INVITATION_TTL_DAYS = 7


def hash_token(raw_token: str) -> str:
    """sha256 hex digest (64 chars) — DB 저장용"""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def is_invitation_redeemable(inv: Invitation, now=None) -> bool:
    """수락·사용 가능한 상태인지 (status=pending + 미만료)"""
    now = now or utc_now()
    return (
        inv.status == "pending"
        and inv.accepted_at is None
        and inv.revoked_at is None
        and inv.expires_at > now
    )


class CreateInvitationService:
    """초대 생성 (토큰 발급 + DB 저장)

    Returns:
        (invitation, raw_token) — raw_token은 메일 본문에만 사용, DB엔 hash만 저장
    """

    def __init__(self, repo: InvitationRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        institution_id: str,
        email: str,
        name: str,
        role: str,
        invited_by_account_id: str,
    ) -> tuple[Invitation, str]:
        # 동일 기관·이메일에 살아있는 pending 초대가 있으면 거부 (재발송 경로로 처리)
        existing = await self.repo.get_pending_by_email(institution_id, email)
        if existing and is_invitation_redeemable(existing):
            raise ConflictException(
                "이미 발송된 초대가 있습니다. 재발송으로 처리해주세요."
            )

        raw_token = secrets.token_urlsafe(32)
        invitation = await self.repo.create({
            "institution_id": institution_id,
            "email": email,
            "name": name,
            "role": role,
            "token_hash": hash_token(raw_token),
            "status": "pending",
            "expires_at": utc_now() + timedelta(days=INVITATION_TTL_DAYS),
            "invited_by_account_id": invited_by_account_id,
        })
        return invitation, raw_token


class VerifyInvitationService:
    """토큰 검증 — 미리보기 정보 반환

    Raises:
        InvalidOperationException: 무효/만료/취소/사용된 토큰 (enumeration 방지 위해 단일 메시지)
    """

    GENERIC_ERROR = "유효하지 않거나 만료된 초대 링크입니다."

    def __init__(self, repo: InvitationRepository):
        self.repo = repo

    async def execute(self, raw_token: str) -> Invitation:
        record = await self.repo.get_by_token_hash(hash_token(raw_token))
        if record is None or not is_invitation_redeemable(record):
            raise InvalidOperationException(self.GENERIC_ERROR)
        return record


class RevokeInvitationService:
    """초대 취소 (status=revoked)"""

    def __init__(self, repo: InvitationRepository):
        self.repo = repo

    async def execute(self, invitation_id: str, institution_id: str) -> Invitation:
        invitation = await self.repo.get(invitation_id)
        if invitation is None:
            raise EntityNotFoundException(f"초대를 찾을 수 없습니다: {invitation_id}")
        if invitation.institution_id != institution_id:
            raise PermissionDeniedException("해당 기관의 초대가 아닙니다.")
        if invitation.status != "pending":
            raise InvalidOperationException("이미 처리된 초대는 취소할 수 없습니다.")

        invitation.status = "revoked"
        invitation.revoked_at = utc_now()
        await self.repo.flush()
        return invitation


class MarkInvitationAcceptedService:
    """초대 수락 처리 — race protection을 위해 status 재확인 후 갱신"""

    def __init__(self, repo: InvitationRepository):
        self.repo = repo

    async def execute(self, invitation_id: str) -> Invitation:
        invitation = await self.repo.get(invitation_id)
        if invitation is None or not is_invitation_redeemable(invitation):
            raise InvalidOperationException(VerifyInvitationService.GENERIC_ERROR)
        invitation.status = "accepted"
        invitation.accepted_at = utc_now()
        await self.repo.flush()
        return invitation


def build_invite_email(
    invite_url: str,
    *,
    institution_name: str,
    inviter_name: str | None,
    role: str,
) -> tuple[str, str]:
    """이메일 제목 + HTML 본문 생성

    Returns:
        (subject, html_body)
    """
    subject = f"[마인드봄] {institution_name} 초대"
    inviter_line = (
        f"{inviter_name}님이" if inviter_name else "관리자가"
    )
    role_label = {
        "admin": "관리자",
        "clinician": "임상심리사",
        "researcher": "연구원",
    }.get(role, role)
    html_body = f"""\
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"></head>
<body style="font-family: 'Apple SD Gothic Neo', system-ui, sans-serif; color:#1f2937; max-width:540px; margin:0 auto; padding:32px 24px;">
  <h2 style="font-size:20px; margin:0 0 16px;">{institution_name} 초대</h2>
  <p style="font-size:14px; line-height:1.6;">
    안녕하세요. {inviter_line} <strong>{institution_name}</strong>의 <strong>{role_label}</strong>으로 초대했습니다.<br>
    아래 버튼을 눌러 비밀번호를 설정하면 가입이 완료됩니다.
    링크는 <strong>7일 동안만 유효</strong>합니다.
  </p>
  <p style="margin:24px 0;">
    <a href="{invite_url}"
       style="display:inline-block; padding:12px 24px; background-color:#4f46e5; color:#ffffff;
              text-decoration:none; border-radius:8px; font-size:14px; font-weight:600;">
      초대 수락 및 비밀번호 설정
    </a>
  </p>
  <p style="font-size:12px; color:#6b7280; line-height:1.6;">
    버튼이 작동하지 않으면 아래 링크를 브라우저에 직접 붙여넣어 주세요:<br>
    <a href="{invite_url}" style="color:#4f46e5; word-break:break-all;">{invite_url}</a>
  </p>
  <hr style="border:none; border-top:1px solid #e5e7eb; margin:24px 0;">
  <p style="font-size:12px; color:#9ca3af;">
    본인이 받을 초대가 아니라면 이 메일을 무시해주세요.
  </p>
</body>
</html>"""
    return subject, html_body
