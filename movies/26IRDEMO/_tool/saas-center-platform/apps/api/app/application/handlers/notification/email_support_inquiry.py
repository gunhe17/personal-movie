from app.core.logger import get_logger
from app.infrastructure.email.factory import get_smtp_mailer
from app.infrastructure.email.templates.support_inquiry import support_inquiry_email
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.platform_admin.inquiry.facade import InquiryFacade

logger = get_logger(__name__)

SUPPORT_EMAIL = "contacts@insighter.co.kr"


async def email_support_inquiry_handler(
    *,
    uow: UnitOfWork,
    center_id: str | None,
    event_group_id: str,
    inquiry_id: str,
) -> None:
    # load
    inquiry = await InquiryFacade(uow).get_inquiry(inquiry_id)

    # send — 예외를 삼키지 않는다(반응 실패 → 워커 재시도). event_reactions 체크포인트가 재발송을 막는다
    html_content, text_content = support_inquiry_email(
        sender_name=inquiry.sender_name,
        sender_email=inquiry.sender_email,
        subject=inquiry.subject,
        content=inquiry.content,
    )
    get_smtp_mailer().send_email(
        recipient=SUPPORT_EMAIL,
        subject=f"[고객 문의] {inquiry.subject}",
        html_content=html_content,
        text_content=text_content,
        reply_to=inquiry.sender_email,
    )
    logger.info(f"문의 이메일 발송 성공 (inquiry_id={inquiry_id})")
