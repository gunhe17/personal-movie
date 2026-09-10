from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.email.factory import get_smtp_mailer
from app.infrastructure.email.templates.center_approval import center_approval_email
from app.modules.auth.facade import AccountFacade
from app.modules.center.facade import CenterApplicationFacade
from app.modules.person.facade import PersonFacade


async def email_center_application_approved_handler(
    *,
    uow: UnitOfWork,
    center_id: str | None,
    event_group_id: str,
    application_id: str,
) -> None:
    # load — admin 이벤트 payload는 최소(id뿐)라 신청·신청자 email을 재조회
    application = await CenterApplicationFacade(uow).get_application_with_response(
        application_id
    )
    person = await PersonFacade(uow).find_person(application.created_by)
    if not person:
        return
    accounts = await AccountFacade(uow).get_accounts_by_ids([person.account_id])
    account = accounts.get(person.account_id)
    if not account:
        return

    # send — 예외를 삼키지 않는다(반응 실패 → 워커 재시도, 재발송 무해)
    html_content, text_content = center_approval_email(
        applicant_name=person.name,
        center_name=application.name,
    )
    get_smtp_mailer().send_email(
        recipient=account.email,
        subject=f"[{application.name}] 센터 등록이 승인되었습니다",
        html_content=html_content,
        text_content=text_content,
    )
