from app.core.config import settings
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.facade import AssessmentCaseFacade
from app.modules.notification.helpers import (
    claim_client_sms_send,
    resolve_client_sms_targets,
    send_sms_to_client,
)


async def sms_assessment_case_created_handler(
    *,
    uow: UnitOfWork,
    center_id: str,
    event_group_id: str,
    case_id: str,
    case_code: str,
) -> None:
    # ENABLE_CLIENT_AUTO_SMS=False면 자동 발송 비활성화 (기본값)
    if not settings.ENABLE_CLIENT_AUTO_SMS:
        return

    # load
    client_ids = (
        await AssessmentCaseFacade(uow).aggregate_client_ids_by_case_ids([case_id])
    ).get(case_id, [])

    # resolve
    targets = await resolve_client_sms_targets(
        uow=uow,
        client_ids=client_ids,
        message=f"[검사 안내] 심리검사가 접수되었습니다. (케이스: {case_code})",
    )

    # send — 반응 재시도 중복 방지: (case, client)당 send-key 1회 (schedule 슬롯에 case_id)
    for target in targets:
        if target.client_id and not await claim_client_sms_send(
            schedule_id=case_id,
            client_id=target.client_id,
            sms_type="assessment_receipt",
        ):
            continue
        await send_sms_to_client(target)
