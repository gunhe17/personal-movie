from __future__ import annotations

from datetime import datetime

from app.core.config import settings
from app.infrastructure.email.templates._josa import _josa_i_ga


def member_invitation_email(
    invitee_name: str,
    invitee_email: str,
    inviter_name: str,
    center_name: str,
    token: str,
    expires_at: datetime,
    role_name: str,
    employment_type: str | None = None,
) -> tuple[str, str]:
    invitation_link = f"{settings.FRONTEND_URL}/accept-invitation?token={token}"
    expires_str = expires_at.strftime("%Y년 %m월 %d일 %H:%M")
    josa = _josa_i_ga(center_name)

    html_content = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
</style>
</head>
<body style="margin:0; padding:0; background-color:#f4f8ff; font-family:'Pretendard',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; letter-spacing:-0.41px;">

<!-- Wrapper -->
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f8ff;">
<tr><td align="center" style="padding:40px 24px 20px;">

    <!-- Header: Logo -->
    <table width="560" cellpadding="0" cellspacing="0" style="padding:0 0 16px 0;">
    <tr>
        <td align="left">
            <span style="font-size:18px; font-weight:700; color:#256ef4; letter-spacing:-0.5px;">mind scope</span>
        </td>
    </tr>
    </table>

    <!-- Body Card -->
    <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; border:1px solid #e5e7eb; box-shadow:0px 4px 12px 0px rgba(200,200,200,0.1);">
    <tr><td style="padding-bottom:28px;">

        <!-- Hero: Main Content -->
        <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
            <td style="padding:28px 32px 0;">
                <h1 style="margin:0 0 12px; font-size:18px; font-weight:700; color:#111827; line-height:1.4; letter-spacing:-0.41px;">{center_name}{josa} 당신을 초대했습니다.</h1>
                <p style="margin:0; font-size:13px; color:#6b7280; line-height:1.8; letter-spacing:-0.41px;">
                    <strong style="color:#374151; font-weight:600;">{invitee_name}</strong>님,<br>
                    <strong style="color:#374151; font-weight:600;">{inviter_name}</strong>님이 <strong style="color:#374151; font-weight:600;">{center_name}</strong>의 <strong style="color:#374151; font-weight:600;">{role_name}</strong> 역할로 당신을 초대했습니다.<br>
                    아래 버튼을 눌러 초대를 수락해주세요.
                </p>
            </td>
        </tr>
        </table>

        <!-- CTA Button -->
        <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
            <td align="center" style="padding:40px 32px 32px;">
                <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                    <td align="center" bgcolor="#256ef4" style="border-radius:10px;">
                        <a href="{invitation_link}"
                           style="color:#ffffff; border-radius:10px; padding:11px 28px; display:inline-block; text-decoration:none; font-size:13px; font-weight:600; letter-spacing:-0.41px;">
                            초대 수락하기&nbsp;→
                        </a>
                    </td>
                </tr>
                </table>
            </td>
        </tr>
        </table>

        <!-- Divider -->
        <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
            <td style="padding:0 32px;">
                <div style="height:1px; background-color:#f3f4f6; font-size:0; line-height:0;">&nbsp;</div>
            </td>
        </tr>
        </table>

        <!-- Info Section: 보조 정보 -->
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:0 32px;">
        <tr><td style="padding-top:16px;">

            <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
                <td style="padding:6px 0; width:72px;" valign="middle">
                    <p style="margin:0; font-size:12px; color:#d1d5db; letter-spacing:-0.41px;">센터</p>
                </td>
                <td style="padding:6px 0;" valign="middle">
                    <p style="margin:0; font-size:12px; color:#9ca3af; letter-spacing:-0.41px;">{center_name}</p>
                </td>
            </tr>
            <tr>
                <td style="padding:6px 0;" valign="middle">
                    <p style="margin:0; font-size:12px; color:#d1d5db; letter-spacing:-0.41px;">역할</p>
                </td>
                <td style="padding:6px 0;" valign="middle">
                    <p style="margin:0; font-size:12px; color:#9ca3af; letter-spacing:-0.41px;">{role_name}</p>
                </td>
            </tr>
            <tr>
                <td style="padding:6px 0;" valign="middle">
                    <p style="margin:0; font-size:12px; color:#d1d5db; letter-spacing:-0.41px;">초대자</p>
                </td>
                <td style="padding:6px 0;" valign="middle">
                    <p style="margin:0; font-size:12px; color:#9ca3af; letter-spacing:-0.41px;">{inviter_name}</p>
                </td>
            </tr>
            <tr>
                <td style="padding:6px 0;" valign="middle">
                    <p style="margin:0; font-size:12px; color:#d1d5db; letter-spacing:-0.41px;">만료 일시</p>
                </td>
                <td style="padding:6px 0;" valign="middle">
                    <p style="margin:0; font-size:12px; color:#9ca3af; letter-spacing:-0.41px;">{expires_str}</p>
                </td>
            </tr>
            <tr>
                <td style="padding:6px 0;" valign="middle">
                    <p style="margin:0; font-size:12px; color:#d1d5db; letter-spacing:-0.41px;">초대 이메일</p>
                </td>
                <td style="padding:6px 0;" valign="middle">
                    <p style="margin:0; font-size:12px; color:#9ca3af; letter-spacing:-0.41px;">{invitee_email}</p>
                </td>
            </tr>
            </table>

        </td></tr>
        </table>

    </td></tr>
    </table>

    <!-- Footer -->
    <table width="560" cellpadding="0" cellspacing="0" style="padding:20px 0 40px;">
    <tr>
        <td align="center">
            <p style="margin:0; font-size:12px; color:#9ca3af; line-height:1.6; letter-spacing:-0.41px;">
                본 메일은 발신 전용으로 회신되지 않습니다.<br>
                &copy; insighter Inc. All rights reserved.
            </p>
        </td>
    </tr>
    </table>

</td></tr>
</table>

</body>
</html>"""

    text_content = f"""[mind scope] {center_name} 구성원 초대

{invitee_name}님,
{inviter_name}님이 {center_name}의 {role_name} 역할로 당신을 초대했습니다.

━━━━━━━━━━━━━━━━━━━━
센터        {center_name}
역할        {role_name}
초대자      {inviter_name}
만료 일시   {expires_str}
초대 이메일 {invitee_email}
━━━━━━━━━━━━━━━━━━━━

초대 수락: {invitation_link}

본 메일은 발신 전용입니다. © insighter Inc."""

    return html_content, text_content


