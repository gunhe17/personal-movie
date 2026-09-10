from __future__ import annotations

from app.core.config import settings


def center_approval_email(
    applicant_name: str,
    center_name: str,
) -> tuple[str, str]:
    login_link = f"{settings.FRONTEND_URL}/login"

    html_content = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;">
<tr><td align="center" style="padding:60px 24px;">

<table width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:20px; box-shadow:0 4px 24px rgba(0,0,0,0.06);">

    <!-- Green accent bar -->
    <tr><td style="padding:0;">
        <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="height:6px; background:linear-gradient(90deg,#16a34a,#22c55e); border-radius:20px 20px 0 0; font-size:0; line-height:0;">&nbsp;</td></tr>
        </table>
    </td></tr>

    <!-- Icon -->
    <tr><td align="center" style="padding:44px 0 0;">
        <table cellpadding="0" cellspacing="0"><tr>
        <td style="width:56px; height:56px; background-color:#f0fdf4; border-radius:50%; text-align:center; vertical-align:middle; font-size:26px; line-height:56px;">&#10004;</td>
        </tr></table>
    </td></tr>

    <!-- Content -->
    <tr><td style="padding:28px 48px 0; text-align:center;">
        <p style="margin:0 0 6px; font-size:13px; font-weight:600; color:#16a34a; letter-spacing:0.5px;">승인 완료</p>
        <h1 style="margin:0 0 20px; font-size:22px; font-weight:700; color:#0f172a; line-height:1.5;">
            센터 등록이<br>승인되었습니다
        </h1>
    </td></tr>

    <!-- Divider -->
    <tr><td align="center" style="padding:0 48px;">
        <table width="40" cellpadding="0" cellspacing="0"><tr>
        <td style="height:2px; background-color:#e2e8f0; font-size:0; line-height:0;">&nbsp;</td>
        </tr></table>
    </td></tr>

    <!-- Description -->
    <tr><td style="padding:20px 48px 0; text-align:center;">
        <p style="margin:0 0 36px; font-size:15px; color:#475569; line-height:1.8;">
            <strong style="color:#0f172a;">{applicant_name}</strong>님,<br>
            <strong style="color:#16a34a;">{center_name}</strong> 센터 등록 신청이<br>승인 완료되었습니다.
            <br>지금 바로 로그인하여 센터를 시작하세요.
        </p>
    </td></tr>

    <!-- CTA Button -->
    <tr><td align="center" style="padding:0 48px;">
        <table cellpadding="0" cellspacing="0"><tr>
        <td align="center" style="background-color:#16a34a; border-radius:12px;">
            <a href="{login_link}"
               style="display:inline-block; color:#ffffff; text-decoration:none;
                      padding:16px 56px; font-size:15px; font-weight:600; letter-spacing:0.3px;">
                로그인하기
            </a>
        </td>
        </tr></table>
    </td></tr>

    <!-- Footer -->
    <tr><td style="padding:20px 48px 36px; text-align:center;">
        <p style="margin:0; font-size:12px; color:#94a3b8;">
            문의사항이 있으시면 플랫폼 관리자에게 연락해 주세요.
        </p>
    </td></tr>

</table>

</td></tr>
</table>
</body>
</html>"""

    text_content = f"""센터 등록이 승인되었습니다

{applicant_name}님, {center_name} 센터 등록 신청이 승인 완료되었습니다.

지금 바로 로그인하여 센터를 시작하세요.
로그인: {login_link}"""

    return html_content, text_content


