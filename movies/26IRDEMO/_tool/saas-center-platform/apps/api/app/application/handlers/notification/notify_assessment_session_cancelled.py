from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.assessment.facade import AssessmentCaseFacade
from app.core.permissions import Permission
from app.modules.center.facade import MemberFacade
from app.modules.role.facade import RoleFacade
from app.modules.notification.helpers import (
    dispatch_single_notification,
    notify_members,
    notify_single_member,
)

_MANAGER_PERMISSIONS = (Permission.WRITE_SCHEDULE, "*")


async def notify_assessment_session_cancelled_handler(
    *,
    uow: UnitOfWork,
    center_id: str,
    event_group_id: str,
    session_id: str,
    case_id: str,
) -> None:
    # load
    case = await AssessmentCaseFacade(uow).get_case_by_id(center_id, case_id)

    # notify — event_ref가 재시도 간 안정 키(unique index)라 인앱 행은 중복 생성 안 됨
    atomics = []
    targets = await notify_single_member(
        uow=uow,
        center_id=center_id,
        member_id=case.counselor_id,
        category="assessment",
        event_type="session_cancelled",
        priority="important",
        title="검사 회기가 취소되었습니다",
        body=f"검사 케이스 {case.case_code}의 회기가 취소되었습니다.",
        data={
            "case_id": case.id,
            "case_code": case.case_code,
            "session_id": session_id,
        },
        event_ref=f"assessment_session:{session_id}:cancelled",
        atomics=atomics,
    )

    # 관리자 — 센터 전체 일정 권한(access_level=all + write:schedule) 역할의 멤버.
    # 취소·노쇼는 일정에 구멍이 생기는 사건이라 담당자 밖에서도 봐야 한다.
    # 담당 상담사는 위에서 이미 받았으므로 뺀다(행위자 제외는 notify_members가 소유).
    role_facade = RoleFacade(uow)
    manager_role_ids: list[str] = []
    for role in await role_facade.list_roles_by_center(center_id=center_id):
        if role.access_level != "all":
            continue
        codes = await role_facade.list_permission_codes_by_role(role.id)
        if any(code in _MANAGER_PERMISSIONS for code in codes):
            manager_role_ids.append(role.id)

    member_facade = MemberFacade(uow)
    manager_ids: list[str] = []
    for role_id in manager_role_ids:
        members, _ = await member_facade.list_members_by_center(
            center_id,
            skip=0,
            limit=100,
            role_id=role_id,
        )
        manager_ids.extend(member.id for member in members)
    manager_ids = [
        member_id
        for member_id in dict.fromkeys(manager_ids)
        if member_id != case.counselor_id
    ]

    if manager_ids:
        targets.extend(
            await notify_members(
                uow=uow,
                center_id=center_id,
                member_ids=manager_ids,
                category="assessment",
                event_type="session_cancelled",
                title="검사 회기가 취소되었습니다",
                body=f"{case.case_code} 회기가 취소되었습니다.",
                data={
                    "case_id": case.id,
                    "case_code": case.case_code,
                    "session_id": session_id,
                },
                event_ref_prefix=f"assessment_session:{session_id}:cancelled:manager",
                atomics=atomics,
            )
        )

    # dispatch — 발송 실패는 내부에서 log로 삼켜짐(NotificationLog에 failed 기록)
    # 인앱 행이 새로 생긴 호출만 발송(notification_id 없음 = event_ref 중복 skip) — 반응 재시도 시 외부 중복 발송 방지(in-app event_ref가 send-key).
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
