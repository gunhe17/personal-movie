import logging

from app.core.datetime_utils import utc_now
from app.core.exceptions import InvalidOperationException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.facade.center_facade import CenterFacade
from app.modules.center_link.facade import CenterLinkFacade
from app.modules.client.facade.client_facade import ClientFacade
from app.modules.client_app.schemas import AppInvitationSmsResponse

logger = logging.getLogger(__name__)


def _mask_phone(phone: str) -> str:
    digits = phone.replace("-", "")
    if len(digits) < 7:
        return phone
    return f"{digits[:3]}-****-{digits[-4:]}"


async def send_app_invitation_sms_handler(
    *,
    center_id: uuid_str,
    client_id: uuid_str,
    uow: UnitOfWork,
) -> AppInvitationSmsResponse:
    from app.infrastructure.messaging.factory import get_sms_service

    now = utc_now()

    client = await ClientFacade(uow).get_client_in_center(
        center_id=center_id, client_id=client_id
    )
    if not client.phone or not client.phone.strip():
        raise InvalidOperationException(
            "전화번호가 등록돼 있어야 문자를 보낼 수 있습니다"
        )

    invitations = await CenterLinkFacade(uow).list_valid_invitations(
        center_id=center_id, guardian_client_id=client_id, now=now
    )
    if not invitations:
        raise InvalidOperationException(
            "유효한 초대 코드가 없습니다. 먼저 코드를 발급해 주세요"
        )
    invitation = invitations[0]

    center = await CenterFacade(uow).get_center(center_id)

    message = (
        f"[마인드스코프] {center.name} 앱 연결 초대 코드: {invitation.code}\n"
        f"앱을 설치한 뒤 코드를 입력하면 연결돼요. (48시간 유효)"
    )

    # 발송이 목적(코드가 문자에 담김) — 동기 직접 호출, 실패는 삼키고 로깅만(계약 불변)
    try:
        await get_sms_service().send_message(
            recipient=client.phone,
            message=message,
            title="마인드스코프 앱 연결",
        )
        logger.info(f"App invitation SMS sent ({_mask_phone(client.phone)})")
    except Exception as e:
        logger.error(f"App invitation SMS failed ({_mask_phone(client.phone)}): {e}")

    return AppInvitationSmsResponse(sent_to=_mask_phone(client.phone))
