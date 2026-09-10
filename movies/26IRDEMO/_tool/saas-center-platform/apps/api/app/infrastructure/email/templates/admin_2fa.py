from __future__ import annotations


def admin_2fa_code_email(
    name: str,
    code: str,
    expires_minutes: int = 5,
) -> tuple[str, str, str]:
    subject = f"[mind scope] 관리자 로그인 인증코드: {code}"

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

<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f8ff;">
<tr><td align="center" style="padding:40px 24px 20px;">

    <table width="560" cellpadding="0" cellspacing="0" style="padding:0 0 16px 0;">
    <tr>
        <td align="left">
            <span style="font-size:18px; font-weight:700; color:#256ef4; letter-spacing:-0.5px;">mind scope</span>
            <span style="font-size:12px; color:#6b7280; margin-left:8px;">관리자 포털</span>
        </td>
    </tr>
    </table>

    <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; border:1px solid #e5e7eb; box-shadow:0px 4px 12px 0px rgba(200,200,200,0.1);">
    <tr><td style="padding-bottom:28px;">

        <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
            <td style="padding:28px 32px 0;">
                <p style="margin:0 0 4px; font-size:12px; font-weight:600; color:#7c3aed; letter-spacing:0.5px;">로그인 인증</p>
                <h1 style="margin:0 0 12px; font-size:18px; font-weight:700; color:#111827; line-height:1.4; letter-spacing:-0.41px;">로그인 인증코드를 확인해주세요.</h1>
                <p style="margin:0; font-size:13px; color:#6b7280; line-height:1.8; letter-spacing:-0.41px;">
                    <strong style="color:#374151; font-weight:600;">{name}</strong>님,<br>
                    관리자 포털 로그인을 위한 인증코드입니다.<br>
                    아래 코드를 {expires_minutes}분 이내에 입력해주세요.
                </p>
            </td>
        </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
            <td align="center" style="padding:32px 32px 28px;">
                <table border="0" cellpadding="0" cellspacing="0" style="background-color:#f5f3ff; border-radius:12px; border:1px solid #e9e5ff;">
                <tr>
                    <td align="center" style="padding:20px 48px;">
                        <p style="margin:0 0 4px; font-size:11px; font-weight:600; color:#7c3aed; letter-spacing:0.5px;">인증코드</p>
                        <p style="margin:0; font-size:32px; font-weight:700; color:#111827; letter-spacing:8px; font-family:'Courier New',monospace;">{code}</p>
                    </td>
                </tr>
                </table>
            </td>
        </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
            <td style="padding:0 32px;">
                <div style="height:1px; background-color:#f3f4f6; font-size:0; line-height:0;">&nbsp;</div>
            </td>
        </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
            <td style="padding:16px 32px 0;">
                <p style="margin:0; font-size:12px; color:#9ca3af; line-height:1.6; letter-spacing:-0.41px;">
                    이 코드는 {expires_minutes}분간 유효합니다.<br>
                    본인이 요청하지 않았다면 이 이메일을 무시하세요.
                </p>
            </td>
        </tr>
        </table>

    </td></tr>
    </table>

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

    text_content = f"""[mind scope] 관리자 로그인 인증코드

{name}님, 관리자 포털 로그인을 위한 인증코드입니다.

━━━━━━━━━━━━━━━━━━━━
인증코드    {code}
유효시간    {expires_minutes}분
━━━━━━━━━━━━━━━━━━━━

본인이 요청하지 않았다면 이 이메일을 무시하세요.
본 메일은 발신 전용입니다. © insighter Inc."""

    return subject, html_content, text_content


