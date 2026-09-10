"""SMSService — LGU+ Message Hub 기반 SMS/LMS 발송 (길이 기반 자동 구분)."""
from __future__ import annotations

import uuid
from datetime import datetime

from app.core.datetime_utils import utc_now
from app.core.logger import get_logger
from app.infrastructure.messaging.common.exception import MessageSendException
from app.infrastructure.messaging.lgu.transport import LGUBaseClient

logger = get_logger(__name__)


class SMSService:
    def __init__(
        self,
        lgu_client: LGUBaseClient,
        callback: str,
    ):
        self.lgu_client = lgu_client
        self.callback = callback

    async def send_message(
        self,
        recipient: str,
        message: str,
        scheduled_at: datetime | None = None,
        title: str | None = None,
    ) -> dict:
        # 90바이트(UTF-8) 초과 시 LMS 전환, title 필수
        msg_bytes = len(message.encode("utf-8"))
        message_type = "LMS" if msg_bytes > 90 else "SMS"

        # cliKey: 고유 메시지 식별자 (UUID 하이픈 제거, 최대 30자)
        cli_key = str(uuid.uuid4()).replace('-', '')[:30]

        recv_info = {
            "cliKey": cli_key,
            "phone": recipient,
        }

        if message_type == "LMS":
            # LMS: /msg/v1/mms (msg 최대 2000 Byte, title 필수)
            payload = {
                "callback": self.callback,
                "recvInfoLst": [recv_info],
                "msg": message,
                "title": title or "알림",
            }
            endpoint = "/msg/v1/mms"
        else:
            # SMS: /msg/v1/sms (msg 최대 90 Byte)
            payload = {
                "callback": self.callback,
                "recvInfoLst": [recv_info],
                "msg": message,
            }
            endpoint = "/msg/v1/sms"

        if scheduled_at:
            payload["resvYn"] = "Y"
            payload["resvReqDt"] = scheduled_at.strftime("%Y-%m-%d %H:%M")
        else:
            payload["resvYn"] = "N"

        try:
            response = await self.lgu_client._request(
                "POST",
                endpoint,
                json_data=payload,
            )

            logger.info(f"LGU+ SMS API Response: {response}")

            # 응답 data는 list, msgKey 사용
            data_list = response.get('data', [])
            if data_list:
                msg_key = data_list[0].get('msgKey')
                result_code = data_list[0].get('code')
                result_message = data_list[0].get('message')

                if result_code != "10000":
                    logger.warning(
                        f"{message_type} send warning: recipient={recipient}, "
                        f"code={result_code}, message={result_message}"
                    )
            else:
                msg_key = None

            logger.info(
                f"{message_type} sent: recipient={recipient}, "
                f"msg_key={msg_key}"
            )

            return {
                "message_id": msg_key,
                "status": "pending" if scheduled_at else "sent",
                "message_type": message_type,
                "sent_at": utc_now(),
                "scheduled_at": scheduled_at,
            }

        except MessageSendException:
            raise
        except Exception as e:
            error_msg = f"SMS send failed: {str(e)}"
            logger.error(error_msg, exc_info=True)
            raise MessageSendException(error_msg) from e

    async def send_bulk_messages(
        self,
        recipients: list[str],
        message: str,
    ) -> list[dict]:
        results = []

        for recipient in recipients:
            try:
                result = await self.send_message(
                    recipient=recipient,
                    message=message,
                )
                results.append(result)
            except MessageSendException as e:
                logger.error(f"Bulk SMS send failed for {recipient}: {e}")
                results.append({
                    "message_id": None,
                    "status": "failed",
                    "error": str(e),
                    "recipient": recipient,
                })

        logger.info(f"SMS bulk send completed: {len(results)} messages")
        return results
