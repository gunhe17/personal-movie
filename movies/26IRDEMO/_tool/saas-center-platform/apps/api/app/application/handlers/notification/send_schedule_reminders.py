# 스케줄러 잡에서 호출되는 비-HTTP Handler (상담사 전용). 예외 격리는 상위 job 래퍼 담당.
# 중복 방지: event_ref="schedule_reminder:{schedule_id}:{counselor_id}:{lead_label}" 으로
# schedule/counselor 쌍 unique → 재실행/동시실행 시 DB unique 로 자동 skip.
#
# in_app=False — 리마인드는 시간이 지나면 무의미해지는 고지라 알림 로그로 쌓지 않는다.
# 웹은 "내일 일정"을 일정 API로 직접 읽어 배너로 띄우고, 여기서는 푸시/알림톡만 나간다.
from datetime import datetime, timezone

from app.core.datetime_utils import KST
from app.core.logger import get_logger
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.facade.assessment_case_facade import AssessmentCaseFacade
from app.modules.counseling.facade.counseling_case_facade import CounselingCaseFacade
from app.modules.notification.helpers import (
    MemberDispatchTarget,
    notify_single_member,
)
from app.modules.schedule.facade.schedule_facade import ScheduleFacade

logger = get_logger(__name__)


async def send_schedule_reminders_handler(
    uow: UnitOfWork,
    start_utc: datetime,
    end_utc: datetime,
    lead_label: str = "24h",
) -> list[MemberDispatchTarget]:
    # 반환된 대상은 호출자가 트랜잭션 외부에서 dispatch_single_notification 으로 발송.
    dispatch_targets: list[MemberDispatchTarget] = []

    schedule_facade = ScheduleFacade(uow)
    counseling_facade = CounselingCaseFacade(uow)
    assessment_facade = AssessmentCaseFacade(uow)

    # load — 범위 내 시작하는 상담/검사 일정 (모든 센터)
    schedules = await schedule_facade.list_schedules_starting_in_range(
        start_utc=start_utc,
        end_utc=end_utc,
        schedule_types=["counseling", "assessment"],
    )
    if not schedules:
        logger.info(
            f"schedule_reminders: no schedules in range "
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

    # 그룹 상담 공동 상담사 매핑 (counseling만)
    counseling_case_ids = list({c.id for c in counseling_cases_by_schedule.values()})
    group_counselors_by_case = await counseling_facade.aggregate_active_counselor_ids_by_case_ids(
        counseling_case_ids
    )

    # notify
    notified_count = 0
    skipped_count = 0

    for schedule in schedules:
        if schedule.schedule_type == "counseling":
            case = counseling_cases_by_schedule.get(schedule.id)
            if case is None:
                skipped_count += 1
                continue
            # 그룹 상담: participant 테이블의 활성 상담사 전부,
            # 개인 상담 또는 participant가 없는 경우: case.counselor_id fallback
            counselor_ids = group_counselors_by_case.get(case.id) or [case.counselor_id]
        elif schedule.schedule_type == "assessment":
            case = assessment_cases_by_schedule.get(schedule.id)
            if case is None:
                skipped_count += 1
                continue
            counselor_ids = [case.counselor_id]
        else:
            skipped_count += 1
            continue

        # 중복 제거 (같은 케이스에 같은 상담사가 중복 등록된 경우 방어)
        counselor_ids = list(dict.fromkeys(cid for cid in counselor_ids if cid))
        if not counselor_ids:
            skipped_count += 1
            continue

        # 알림 제목/본문 (KST 기준 표시)
        start_kst = schedule.start.replace(tzinfo=timezone.utc).astimezone(KST)
        time_label = start_kst.strftime("%m/%d %H:%M")
        type_label = "상담" if schedule.schedule_type == "counseling" else "검사"
        title = f"내일 {type_label} 일정 안내"
        body = f"{time_label} · {case.case_code}"

        event_data = {
            "schedule_id": schedule.id,
            "case_id": case.id,
            "case_code": case.case_code,
            "schedule_type": schedule.schedule_type,
            "start": schedule.start.isoformat(),
        }

        for counselor_id in counselor_ids:
            targets = await notify_single_member(
                uow=uow,
                center_id=schedule.center_id,
                member_id=counselor_id,
                category=schedule.schedule_type,
                event_type="schedule_reminder",
                priority="normal",
                title=title,
                body=body,
                data=event_data,
                event_ref=f"schedule_reminder:{schedule.id}:{counselor_id}:{lead_label}",
                in_app=False,
            )
            dispatch_targets.extend(targets)
            notified_count += 1


    logger.info(
        f"schedule_reminders: notified={notified_count} skipped={skipped_count} "
        f"dispatch_targets={len(dispatch_targets)} "
        f"range=[{start_utc.isoformat()} ~ {end_utc.isoformat()})"
    )

    return dispatch_targets
