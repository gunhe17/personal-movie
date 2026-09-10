# 매일 오전 9시(KST) 크론잡에서 호출되는 비-HTTP Handler — 내일(KST) 예정 일정 내담자에게
# 리마인드 SMS. SmsTarget 반환 후 호출자가 트랜잭션 외부에서 send_sms_to_client 실행.
from datetime import datetime

from app.core.logger import get_logger
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.facade.assessment_case_facade import AssessmentCaseFacade
from app.modules.center.facade import CenterFacade
from app.modules.counseling.facade.counseling_case_facade import CounselingCaseFacade
from app.modules.notification.helpers import (
    SmsTarget,
    resolve_client_sms_targets,
    build_reminder_sms_message,
)
from app.modules.schedule.facade.schedule_facade import ScheduleFacade

logger = get_logger(__name__)


async def send_client_schedule_reminders_handler(
    uow: UnitOfWork,
    start_utc: datetime,
    end_utc: datetime,
) -> list[SmsTarget]:
    # start_utc/end_utc: 내일 00:00~23:59:59 KST 를 UTC naive 로 변환한 범위.
    sms_targets: list[SmsTarget] = []

    schedule_facade = ScheduleFacade(uow)
    counseling_facade = CounselingCaseFacade(uow)
    assessment_facade = AssessmentCaseFacade(uow)
    center_facade = CenterFacade(uow)

    # load — 범위 내 시작하는 상담/검사 일정 (모든 센터)
    schedules = await schedule_facade.list_schedules_starting_in_range(
        start_utc=start_utc,
        end_utc=end_utc,
        schedule_types=["counseling", "assessment"],
    )
    if not schedules:
        logger.info(
            f"client_schedule_reminders: no schedules in range "
            f"[{start_utc.isoformat()} ~ {end_utc.isoformat()})"
        )
        return []

    counseling_schedule_ids = [s.id for s in schedules if s.schedule_type == "counseling"]
    assessment_schedule_ids = [s.id for s in schedules if s.schedule_type == "assessment"]

    counseling_cases_by_schedule = await counseling_facade.aggregate_cases_by_schedule_ids(
        counseling_schedule_ids
    )
    assessment_cases_by_schedule = await assessment_facade.aggregate_cases_by_schedule_ids(
        assessment_schedule_ids
    )

    counseling_case_ids = list({c.id for c in counseling_cases_by_schedule.values()})
    assessment_case_ids = list({c.id for c in assessment_cases_by_schedule.values()})

    counseling_clients_by_case = await counseling_facade.aggregate_active_client_ids_by_case_ids(
        counseling_case_ids
    )
    assessment_clients_by_case = await assessment_facade.aggregate_client_ids_by_case_ids(
        assessment_case_ids
    )

    center_ids = list({s.center_id for s in schedules})
    centers_by_id = await center_facade.get_active_by_ids(center_ids)

    # resolve — 내담자 SMS 대상 수집
    sms_count = 0
    skipped_count = 0

    for schedule in schedules:
        if schedule.schedule_type == "counseling":
            case = counseling_cases_by_schedule.get(schedule.id)
            if case is None:
                skipped_count += 1
                continue
            client_ids = counseling_clients_by_case.get(case.id, [])
        elif schedule.schedule_type == "assessment":
            case = assessment_cases_by_schedule.get(schedule.id)
            if case is None:
                skipped_count += 1
                continue
            client_ids = assessment_clients_by_case.get(case.id, [])
        else:
            skipped_count += 1
            continue

        if not client_ids:
            skipped_count += 1
            continue

        center = centers_by_id.get(schedule.center_id)
        center_name = center.name if center else ""

        # 검사: 세트명 또는 개별 검사명 포함 / 상담: "상담"
        if schedule.schedule_type == "assessment":
            sms_message = build_reminder_sms_message(
                center_name, "assessment", schedule.start,
                set_summary=getattr(case, "set_summary", None),
                assessment_summary=getattr(case, "assessment_summary", None),
            )
        else:
            sms_message = build_reminder_sms_message(
                center_name, "counseling", schedule.start,
            )

        targets = await resolve_client_sms_targets(
            uow=uow,
            client_ids=client_ids,
            message=sms_message,
        )
        sms_targets.extend(targets)
        sms_count += 1


    logger.info(
        f"client_schedule_reminders: schedules_processed={sms_count} "
        f"skipped={skipped_count} sms_targets={len(sms_targets)} "
        f"range=[{start_utc.isoformat()} ~ {end_utc.isoformat()})"
    )

    return sms_targets
