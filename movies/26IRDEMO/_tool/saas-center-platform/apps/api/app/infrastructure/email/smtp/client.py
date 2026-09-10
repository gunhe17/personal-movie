from __future__ import annotations

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.logger import get_logger
from app.infrastructure.email.common.base import Mailer
from app.infrastructure.email.common.exception import EmailSendException

logger = get_logger(__name__)


class SmtpMailer(Mailer):
    def __init__(
        self,
        *,
        server: str,
        port: int,
        username: str,
        password: str,
    ) -> None:
        self.smtp_server = server
        self.smtp_port = port
        self.smtp_username = username
        self.smtp_password = password

    def send_email(
        self,
        recipient: str,
        subject: str,
        html_content: str,
        text_content: str | None = None,
        cc: list[str] | None = None,
        bcc: list[str] | None = None,
        reply_to: str | None = None,
    ) -> None:
        # 포트 465 = SSL 직접 연결, 그 외(587) = STARTTLS 업그레이드
        try:
            msg = MIMEMultipart("alternative")
            msg["From"] = self.smtp_username
            msg["To"] = recipient
            msg["Subject"] = subject

            if reply_to:
                msg["Reply-To"] = reply_to
            if cc:
                msg["Cc"] = ", ".join(cc)
            if bcc:
                msg["Bcc"] = ", ".join(bcc)

            if text_content:
                msg.attach(MIMEText(text_content, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            recipients = [recipient]
            if cc:
                recipients.extend(cc)
            if bcc:
                recipients.extend(bcc)

            if self.smtp_port == 465:
                with smtplib.SMTP_SSL(self.smtp_server, self.smtp_port) as server:
                    server.set_debuglevel(1)
                    server.login(self.smtp_username, self.smtp_password)
                    server.sendmail(msg["From"], recipients, msg.as_string())
            else:
                with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                    server.set_debuglevel(1)
                    server.ehlo()
                    server.starttls()
                    server.ehlo()
                    server.login(self.smtp_username, self.smtp_password)
                    server.sendmail(msg["From"], recipients, msg.as_string())

            logger.info(f"Email sent successfully to {recipient}")

        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"SMTP authentication failed: {e}")
            raise EmailSendException(f"SMTP 인증 실패: {str(e)}") from e
        except smtplib.SMTPException as e:
            logger.error(f"SMTP error occurred: {e}")
            raise EmailSendException(f"이메일 전송 실패: {str(e)}") from e
        except Exception as e:
            logger.error(f"Unexpected error sending email: {e}", exc_info=True)
            raise EmailSendException(f"이메일 전송 중 오류 발생: {str(e)}") from e

    def send_bulk_email(
        self,
        recipients: list[str],
        subject: str,
        html_content: str,
        text_content: str | None = None,
    ) -> None:
        for recipient in recipients:
            try:
                self.send_email(
                    recipient=recipient,
                    subject=subject,
                    html_content=html_content,
                    text_content=text_content,
                )
            except EmailSendException as e:
                logger.error(f"Failed to send email to {recipient}: {e}")
                continue
