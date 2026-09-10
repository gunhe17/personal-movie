from __future__ import annotations


def support_inquiry_email(
    sender_name: str,
    sender_email: str,
    subject: str,
    content: str,
) -> tuple[str, str]:
    content_html = content.replace("\n", "<br>")

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
                <p style="margin:0 0 4px; font-size:12px; font-weight:600; color:#256ef4; letter-spacing:0.5px;">고객 문의</p>
                <h1 style="margin:0 0 20px; font-size:18px; font-weight:700; color:#111827; line-height:1.4; letter-spacing:-0.41px;">{subject}</h1>
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

        <!-- Sender Info -->
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:0 32px;">
        <tr><td style="padding-top:16px;">
            <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
                <td style="padding:6px 0; width:72px;" valign="middle">
                    <p style="margin:0; font-size:12px; color:#d1d5db; letter-spacing:-0.41px;">이름</p>
                </td>
                <td style="padding:6px 0;" valign="middle">
                    <p style="margin:0; font-size:12px; color:#9ca3af; letter-spacing:-0.41px;">{sender_name}</p>
                </td>
            </tr>
            <tr>
                <td style="padding:6px 0;" valign="middle">
                    <p style="margin:0; font-size:12px; color:#d1d5db; letter-spacing:-0.41px;">이메일</p>
                </td>
                <td style="padding:6px 0;" valign="middle">
                    <p style="margin:0; font-size:12px; color:#9ca3af; letter-spacing:-0.41px;">{sender_email}</p>
                </td>
            </tr>
            </table>
        </td></tr>
        </table>

        <!-- Divider -->
        <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
            <td style="padding:16px 32px 0;">
                <div style="height:1px; background-color:#f3f4f6; font-size:0; line-height:0;">&nbsp;</div>
            </td>
        </tr>
        </table>

        <!-- Content -->
        <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
            <td style="padding:20px 32px 0;">
                <p style="margin:0; font-size:14px; color:#374151; line-height:1.8; letter-spacing:-0.41px;">
                    {content_html}
                </p>
            </td>
        </tr>
        </table>

    </td></tr>
    </table>

    <!-- Footer -->
    <table width="560" cellpadding="0" cellspacing="0" style="padding:20px 0 40px;">
    <tr>
        <td align="center">
            <p style="margin:0; font-size:12px; color:#9ca3af; line-height:1.6; letter-spacing:-0.41px;">
                이 메일은 mind scope 고객센터를 통해 접수된 문의입니다.<br>
                회신은 발신자 이메일({sender_email})로 보내주세요.<br>
                &copy; insighter Inc. All rights reserved.
            </p>
        </td>
    </tr>
    </table>

</td></tr>
</table>

</body>
</html>"""

    text_content = f"""[mind scope] 고객 문의

제목: {subject}

━━━━━━━━━━━━━━━━━━━━
이름        {sender_name}
이메일      {sender_email}
━━━━━━━━━━━━━━━━━━━━

{content}

━━━━━━━━━━━━━━━━━━━━
이 메일은 mind scope 고객센터를 통해 접수된 문의입니다.
회신은 발신자 이메일({sender_email})로 보내주세요.
© insighter Inc."""

    return html_content, text_content


