from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.notice.notice.schemas import NoticeUpdate, NoticeDetailResponse
from app.modules.notice.facade import NoticeFacade
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic


async def update_admin_notice_handler(
    *,
    notice_id: str,
    data: NoticeUpdate,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> NoticeDetailResponse:
    notice, is_publishing = await NoticeFacade(uow).update_notice(notice_id, data)
    response = NoticeDetailResponse.model_validate(notice)

    # 발송은 reaction(routes.py "notice_updated" → notify_notice_published_handler)이 수행 —
    # published atomic이 있을 때만 fan-out, event_ref 멱등이 중복 발송 차단.
    await emit(
        uow,
        "notice_updated",
        event_group_id=event_group_id,
        atomics=[
            AdminAuditAtomic(
                _act="updated",
                _entity_name="notice",
                _entity_id=notice_id,
                _payload={"data": {"id": notice_id, "title": response.title}},
            ),
            AdminAuditAtomic(
                _act="published",
                _entity_name="notice",
                _entity_id=notice_id,
                _payload={"data": {"id": notice_id, "title": response.title}},
            ) if is_publishing else None,
        ],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return response


TOOL = {
    "name": 'update_admin_notice_handler',
    "permission": None,
    "agent_exposed": False,
    "purpose": '운영자가 기존 공지를 수정한다.',
    "keywords": ['update admin notice', '공지 수정', '공지사항 편집', '공지 변경', 'notice 수정'],
    "boundaries": "운영자 전용 공지 '수정'. 미열람 알림 발송은 remind_unread_members_handler.",
    "output": '수정된 공지 (NoticeDetailResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'notice_id': {'type': 'string', 'format': 'uuid', 'title': '대상 공지', 'description': '수정할 공지의 고유 식별 번호.'},
            'title': {'anyOf': [{'maxLength': 200, 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '제목(미지정 시 유지).', 'title': '제목'},
            'content': {'anyOf': [{'minLength': 1, 'type': 'string'}, {'type': 'null'}], 'default': None, 'description': '내용(미지정 시 유지).', 'title': '내용'},
            'category': {'anyOf': [{'$ref': '#/$defs/NoticeCategory'}, {'type': 'null'}], 'default': None, 'description': '유형 maintenance/update/announcement(미지정 시 유지).'},
            'is_published': {'anyOf': [{'type': 'boolean'}, {'type': 'null'}], 'default': None, 'description': '게시 여부(미지정 시 유지).', 'title': '게시 여부'},
            'is_pinned': {'anyOf': [{'type': 'boolean'}, {'type': 'null'}], 'default': None, 'description': '상단 고정 여부(미지정 시 유지).', 'title': '상단 고정'},
            'attachments': {'anyOf': [{'items': {'$ref': '#/$defs/AttachmentItem'}, 'maxItems': 5, 'type': 'array'}, {'type': 'null'}], 'default': None, 'description': '첨부파일 목록(최대 5개, 미지정 시 유지).', 'title': '첨부파일'},
        },
        "$defs": {'AttachmentItem': {'properties': {'url': {'description': '공개 URL', 'title': 'Url', 'type': 'string'}, 'path': {'description': '저장소 경로', 'title': 'Path', 'type': 'string'}, 'name': {'description': '원본 파일명', 'title': 'Name', 'type': 'string'}, 'size': {'description': '파일 크기 (bytes)', 'title': 'Size', 'type': 'integer'}, 'content_type': {'description': 'MIME 타입', 'title': 'Content Type', 'type': 'string'}}, 'required': ['url', 'path', 'name', 'size', 'content_type'], 'title': 'AttachmentItem', 'type': 'object'}, 'NoticeCategory': {'enum': ['maintenance', 'update', 'announcement'], 'title': 'NoticeCategory', 'type': 'string'}},
        "required": ['notice_id'],
    },
}
