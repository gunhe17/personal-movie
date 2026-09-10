from __future__ import annotations

from datetime import datetime


def login_notification_email(
    email: str,
    device_info: str | None,
    ip_address: str | None,
    location: str | None,
    login_at: datetime,
) -> tuple[str, str]:
    login_str = login_at.strftime("%Y년 %m월 %d일 %H:%M")
    device = device_info or "알 수 없는 기기"
    ip = ip_address or "-"
    loc = location or "-"

    html_content = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f4f8ff; font-family:'Pretendard',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; letter-spacing:-0.41px;">
  <div style="max-width:480px; margin:0 auto; padding:40px 24px;">
    <div style="background:#ffffff; border-radius:16px; padding:32px;">
      <h2 style="margin:0 0 16px; font-size:20px; color:#171719;">새 기기에서 로그인되었습니다</h2>
      <p style="margin:0 0 24px; font-size:14px; color:#5a5c63; line-height:1.6;">
        회원님의 계정({email})에 새로운 기기에서 로그인이 감지되었습니다.<br>
        본인이 아닌 경우 즉시 비밀번호를 변경해주세요.
      </p>
      <table style="width:100%; font-size:14px; color:#171719; border-collapse:collapse;">
        <tr><td style="padding:6px 0; color:#8a8c94; width:88px;">시각</td><td>{login_str}</td></tr>
        <tr><td style="padding:6px 0; color:#8a8c94;">기기</td><td>{device}</td></tr>
        <tr><td style="padding:6px 0; color:#8a8c94;">IP</td><td>{ip}</td></tr>
        <tr><td style="padding:6px 0; color:#8a8c94;">위치</td><td>{loc}</td></tr>
      </table>
    </div>
  </div>
</body>
</html>"""

    text_content = (
        f"새 기기에서 로그인되었습니다\n"
        f"계정: {email}\n시각: {login_str}\n기기: {device}\nIP: {ip}\n위치: {loc}\n"
        f"본인이 아닌 경우 즉시 비밀번호를 변경해주세요."
    )
    return html_content, text_content
