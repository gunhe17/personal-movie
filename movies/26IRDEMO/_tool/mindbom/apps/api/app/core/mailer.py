"""이메일 발송 유틸리티 (SMTP)

비밀번호 재설정 등 사용자 대상 트랜잭션 메일 발송에 사용.
SMTP 설정 부재 시 발송을 시도하지 않고 경고 로그만 남긴다 (개발/테스트 환경 호환).
"""
from email.message import EmailMessage

import aiosmtplib

from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger(__name__)


async def send_email(to: str, subject: str, html_body: str) -> None:
    """STARTTLS로 SMTP 발송.

    SMTP 자격증명이 설정되지 않은 경우 발송을 건너뛰고 경고 로그만 남긴다.
    발송 실패 시 예외를 다시 던지므로 호출자가 enumeration 방지 등의 정책에 따라
    swallow 여부를 결정해야 한다.
    """
    if not (settings.SMTP_SERVER and settings.HOST_EMAIL and settings.HOST_PASSWORD):
        logger.warning(
            "SMTP not configured — skipping email send to %s (subject=%r)",
            to, subject,
        )
        return

    message = EmailMessage()
    message["From"] = settings.HOST_EMAIL
    message["To"] = to
    message["Subject"] = subject
    message.set_content("HTML 메일 클라이언트가 필요합니다.")
    message.add_alternative(html_body, subtype="html")

    await aiosmtplib.send(
        message,
        hostname=settings.SMTP_SERVER,
        port=settings.SMTP_PORT,
        username=settings.HOST_EMAIL,
        password=settings.HOST_PASSWORD,
        start_tls=True,
    )
