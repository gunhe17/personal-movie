from datetime import datetime, timezone

from app.core.datetime_utils import KST
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.facade import MemberFacade
from app.modules.counseling.facade import CounselingCaseFacade
from app.modules.event import emit
from app.modules.notification.helpers import (
    dispatch_single_notification,
    notify_members,
    notify_single_member,
)
from app.core.permissions import Permission
from app.modules.role.facade import RoleFacade

_APPROVE_PERMISSIONS = (Permission.WRITE_SCHEDULE, "*")


def _kst_label(value: datetime) -> str:
    kst = value.replace(tzinfo=timezone.utc).astimezone(KST)
    return kst.strftime("%m월 %d일 %H:%M")


async def notify_schedule_change_requested_handler(
    *,
    uow: UnitOfWork,
    center_id: str,
    event_group_id: str,
    request_id: str,
    schedule_id: str,
    current_start: str,
    requested_start: str,
) -> None:
    # load — 케이스 매핑이 사라졌으면(회기 취소 등) 알릴 담당자가 없다
    case = (
        await CounselingCaseFacade(uow).aggregate_cases_by_schedule_ids([schedule_id])
    ).get(schedule_id)
    if case is None:
        return

    body = (
        f"{_kst_label(datetime.fromisoformat(current_start))}"
        f" → {_kst_label(datetime.fromisoformat(requested_start))}"
    )
    data = {
        "schedule_id": schedule_id,
        "case_id": case.id,
        "request_id": request_id,
    }

    # notify — event_ref가 재시도 간 안정 키(unique index)라 인앱 행은 중복 생성 안 됨
    atomics: list = []
    targets = await notify_single_member(
        uow=uow,
        center_id=center_id,
        member_id=case.counselor_id,
        category="counseling",
        event_type="schedule_change_requested",
        priority="important",
        title="내담자가 일정 변경을 요청했어요",
        body=body,
        data=data,
        event_ref=f"schedule:{schedule_id}:change_requested:{request_id}",
        atomics=atomics,
    )

    # approvers — 센터 전체 일정 권한(access_level=all + write:schedule) 역할의 멤버
    role_facade = RoleFacade(uow)
    approver_role_ids: list[str] = []
    for role in await role_facade.list_roles_by_center(center_id=center_id):
        if role.access_level != "all":
            continue
        codes = await role_facade.list_permission_codes_by_role(role.id)
        if any(code in _APPROVE_PERMISSIONS for code in codes):
            approver_role_ids.append(role.id)

    member_facade = MemberFacade(uow)
    approver_ids: list[str] = []
    for role_id in approver_role_ids:
        members, _ = await member_facade.list_members_by_center(
            center_id,
            skip=0,
            limit=100,
            role_id=role_id,
        )
        approver_ids.extend(member.id for member in members)
    approver_ids = [
        member_id
        for member_id in dict.fromkeys(approver_ids)
        if member_id != case.counselor_id
    ]

    if approver_ids:
        targets.extend(
            await notify_members(
                uow=uow,
                center_id=center_id,
                member_ids=approver_ids,
                category="counseling",
                event_type="schedule_change_requested",
                title="내담자가 일정 변경을 요청했어요",
                body=body,
                data=data,
                event_ref_prefix=f"schedule:{schedule_id}:change_requested:{request_id}",
                atomics=atomics,
            )
        )

    # dispatch — 인앱 행이 새로 생긴 호출만 발송(반응 재시도 시 외부 중복 발송 방지)
    for target in targets:
        if target.notification_id:
            await dispatch_single_notification(target)
    await emit(
        uow,
        "notifications_created",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_type="machine",
    )
