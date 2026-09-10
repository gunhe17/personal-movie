from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.platform_admin.notice.schemas import NotifyNoticeResponse
from app.modules.event import emit
from app.modules.platform_admin.notice.facade import REMIND_ACTS, AdminNoticeFacade
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.platform_admin.audit_log.facade import AdminAuditFacade


async def remind_unread_members_handler(
    *,
    notice_id: str,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> NotifyNoticeResponse:
    # 쿨다운 판정 데이터 — 마지막 리마인드 발송 시각(event outbox 기반: 아래 emit이 곧 쿨다운 마커)
    last_remind_at = await AdminAuditFacade(uow).find_last_admin_act_at(
        notice_id,
        entity_name="notice",
        acts=REMIND_ACTS,
    )

    _notice_title, unread_count = await AdminNoticeFacade(uow).prepare_remind(
        notice_id,
        last_remind_at=last_remind_at,
    )

    # 아래 emit의 atomic(notice.reminded)이 곧 쿨다운 마커 — 구 admin_audit_logs add는 제거(이원 기록 해소)
    await emit(
        uow,
        "notice_reminded",
        event_group_id=event_group_id,
        atomics=[AdminAuditAtomic(
            _act="reminded",
            _entity_name="notice",
            _entity_id=notice_id,
            _payload={"data": {"id": notice_id, "unread_count": unread_count}},
        )],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    # 발송은 reaction(routes.py "notice_reminded" → notify_notice_remind_handler)이 수행 —
    # outbox 재시도가 "쿨다운 마커만 남고 발송 실패" 유령 상태를 해소, event_ref 멱등이 중복 발송 차단.
    return {
        "success": True,
        "data": NotifyNoticeResponse(
            message="알림 발송이 시작되었습니다.",
            target_member_count=unread_count,
        ),
    }


TOOL = {
    "name": 'remind_unread_members_handler',
    "permission": None,
    "agent_exposed": False,
    "purpose": '공지를 아직 안 읽은 모든 대상에게 알림을 보낸다.',
    "keywords": ['notify unread all', '공지 알림 발송', '미열람 알림', '공지 푸시', '안읽은 사람 알림', '공지 재알림'],
    "boundaries": "한 공지의 '미열람자 전체'에게 알림 발송(운영자). 공지 수정은 update_admin_notice_handler.",
    "output": '미열람자 알림 발송 결과 (NotifyNoticeResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'notice_id': {'type': 'string', 'format': 'uuid', 'title': '대상 공지', 'description': '알림을 보낼 공지의 고유 식별 번호.'},
        },
        "required": ['notice_id'],
    },
}
