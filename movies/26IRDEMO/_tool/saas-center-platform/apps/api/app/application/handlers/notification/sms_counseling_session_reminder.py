from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.facade import CenterFacade
from app.modules.counseling.facade import CounselingCaseFacade
from app.modules.notification.helpers import (
    build_reminder_sms_message,
    claim_client_sms_send,
    resolve_client_sms_targets,
    send_sms_to_client,
    should_send_immediate_reminder,
)
from app.modules.schedule.facade import ScheduleFacade


async def sms_counseling_session_reminder_handler(
    *,
    uow: UnitOfWork,
    center_id: str,
    event_group_id: str,
    case_id: str,
    schedule_id: str,
) -> None:
    # verify — 내일(KST) 일정 + 오전 9시 이후 접수만 즉시 발송(그 외는 크론잡 담당)
    schedules = await ScheduleFacade(uow).list_schedules_by_ids([schedule_id])
    if not schedules or not should_send_immediate_reminder(schedules[0].start):
        return

    # load
    center = await CenterFacade(uow).get_center(center_id)
    client_ids = (
        await CounselingCaseFacade(uow).aggregate_active_client_ids_by_case_ids(
            [case_id]
        )
    ).get(case_id, [])

    # resolve
    targets = await resolve_client_sms_targets(
        uow=uow,
        client_ids=client_ids,
        message=build_reminder_sms_message(
            center.name, "counseling", schedules[0].start
        ),
    )

    # send — 재트리거·재claim 중복 방지: (schedule, client, reminder)당 send-key 1회
    for target in targets:
        if target.client_id and not await claim_client_sms_send(
            schedule_id=schedule_id,
            client_id=target.client_id,
            sms_type="counseling_reminder",
        ):
            continue
        await send_sms_to_client(target)
