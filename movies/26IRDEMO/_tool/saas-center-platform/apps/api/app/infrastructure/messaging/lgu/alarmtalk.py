"""AlarmTalkService — LGU+ Message Hub 기반 KakaoTalk 알림톡 발송."""
from __future__ import annotations

import uuid
from datetime import datetime

from app.core.datetime_utils import utc_now
from app.core.logger import get_logger
from app.infrastructure.messaging.common.exception import MessageSendException
from app.infrastructure.messaging.lgu.transport import LGUBaseClient

logger = get_logger(__name__)


class AlarmTalkService:
    def __init__(
        self,
        lgu_client: LGUBaseClient,
        sender_key: str,
        callback: str,
    ):
        self.lgu_client = lgu_client
        self.sender_key = sender_key
        self.callback = callback

    async def send_message(
        self,
        recipient: str,
        message: str,
        template_code: str,
        variables: dict | None = None,
        scheduled_at: datetime | None = None,
    ) -> dict:
        # cliKey: 고유 메시지 식별자 (UUID 하이픈 제거, 최대 30자)
        cli_key = str(uuid.uuid4()).replace('-', '')[:30]

        payload = {
            "callback": self.callback,
            "senderKey": self.sender_key,
            "tmpltKey": template_code,
            "msg": message,
            "recvInfoLst": [
                {
                    "cliKey": cli_key,
                    "phone": recipient,
                }
            ],
        }

        if variables:
            payload["variables"] = variables

        if scheduled_at:
            payload["resvYn"] = "Y"
            payload["resvReqDt"] = scheduled_at.strftime("%Y-%m-%d %H:%M")
        else:
            payload["resvYn"] = "N"

        try:
            response = await self.lgu_client._request(
                "POST",
                "/msg/v1/alimtalk",
                json_data=payload,
            )

            logger.info(f"LGU+ AlarmTalk API Response: {response}")

            # 응답 data는 list, msgKey 사용
            data_list = response.get('data', [])
            if data_list:
                msg_key = data_list[0].get('msgKey')
                result_code = data_list[0].get('code')
                result_message = data_list[0].get('message')

                if result_code != "10000":
                    logger.warning(
                        f"AlarmTalk send warning: recipient={recipient}, "
                        f"template={template_code}, code={result_code}, message={result_message}"
                    )
            else:
                msg_key = None

            logger.info(
                f"AlarmTalk sent: recipient={recipient}, "
                f"template={template_code}, msg_key={msg_key}"
            )

            return {
                "message_id": msg_key,
                "status": "pending" if scheduled_at else "sent",
                "sent_at": utc_now(),
                "scheduled_at": scheduled_at,
            }

        except MessageSendException:
            raise
        except Exception as e:
            error_msg = f"AlarmTalk send failed: {str(e)}"
            logger.error(error_msg, exc_info=True)
            raise MessageSendException(error_msg) from e

    async def send_bulk_messages(
        self,
        recipients: list[str],
        message: str,
        template_code: str,
        variables: dict | None = None,
    ) -> list[dict]:
        results = []

        for recipient in recipients:
            try:
                result = await self.send_message(
                    recipient=recipient,
                    message=message,
                    template_code=template_code,
                    variables=variables,
                )
                results.append(result)
            except MessageSendException as e:
                logger.error(f"Bulk send failed for {recipient}: {e}")
                results.append({
                    "message_id": None,
                    "status": "failed",
                    "error": str(e),
                    "recipient": recipient,
                })

        logger.info(f"AlarmTalk bulk send completed: {len(results)} messages")
        return results

    async def cancel_scheduled_message(self, message_key: str) -> bool:
        try:
            response = await self.lgu_client._request(
                "POST",
                "/msg/v1/alimtalk/cancel",
                json_data={"msgKey": message_key},
            )

            data_list = response.get("data", [])
            success = data_list[0].get("success", False) if data_list else False

            if success:
                logger.info(f"AlarmTalk cancelled: message_key={message_key}")
            else:
                logger.warning(f"AlarmTalk cancel failed: message_key={message_key}")

            return success

        except MessageSendException as e:
            logger.error(f"AlarmTalk cancel error: {e}")
            return False
