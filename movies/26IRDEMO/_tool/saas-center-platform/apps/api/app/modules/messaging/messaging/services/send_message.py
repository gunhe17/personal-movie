from app.core.datetime_utils import utc_now
from app.core.logger import get_logger
from app.infrastructure.messaging.common.base import MessagingClient

from ..models import MessageLog, MessageStatus, MessageType
from ..repository import MessageLogRepository

logger = get_logger(__name__)


class SendMessageService:
    def __init__(
        self,
        repo: MessageLogRepository,
        messaging_client: MessagingClient,
    ):
        self.repo = repo
        self.messaging_client = messaging_client

    async def execute(
        self,
        center_id: str,
        channel: str,
        recipient: str,
        message: str,
        template_code: str | None = None,
        title: str | None = None,
        send_link_id: str | None = None,
        send_result_id: str | None = None,
        form_send_id: str | None = None,
    ) -> MessageLog:
        # resolve
        if channel == "alarmtalk":
            message_type = MessageType.ALARMTALK
            log_template_code = template_code
        else:
            # SMS/LMS: 90자 초과면 LMS
            message_type = MessageType.LMS if len(message) > 90 else MessageType.SMS
            log_template_code = None

        # create
        message_log = await self.repo.add(
            center_id=center_id,
            message_type=message_type,
            recipient=recipient,
            message=message,
            template_code=log_template_code,
            status=MessageStatus.PENDING,
            attempts=1,
            send_link_id=send_link_id,
            send_result_id=send_result_id,
            form_send_id=form_send_id,
        )

        # send
        try:
            result = await self.messaging_client.send_message(
                channel=channel,
                recipient=recipient,
                message=message,
                template_code=template_code,
                title=title,
            )

            message_log = await self.repo.update_in_place(
                message_log.id,
                lgu_message_id=result["message_id"],
                status=MessageStatus.SENT,
                sent_at=result["sent_at"],
            )

            logger.info(
                f"{message_type.value.upper()} sent: recipient={recipient}, "
                f"msg_id={result['message_id']}"
            )

        except Exception as e:
            message_log = await self.repo.update_in_place(
                message_log.id,
                status=MessageStatus.FAILED,
                failed_at=utc_now(),
                error_message=str(e),
            )

            logger.error(
                f"{message_type.value.upper()} send failed: recipient={recipient}, error={e}",
                exc_info=True,
            )

        return message_log
