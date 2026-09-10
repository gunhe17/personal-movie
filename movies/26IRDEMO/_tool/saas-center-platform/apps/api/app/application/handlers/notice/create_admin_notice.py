from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.notice.notice.schemas import NoticeCreate, NoticeDetailResponse
from app.modules.notice.facade import NoticeFacade
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic


async def create_admin_notice_handler(
    *,
    data: NoticeCreate,
    actor_id: str,
    ip: str | None,
    event_group_id: str,
    uow: UnitOfWork,
) -> NoticeDetailResponse:
    notice = await NoticeFacade(uow).create_notice(data, actor_id)
    response = NoticeDetailResponse.model_validate(notice)

    await emit(
        uow,
        "notice_created",
        event_group_id=event_group_id,
        atomics=[AdminAuditAtomic(
            _act="created",
            _entity_name="notice",
            _entity_id=notice.id,
            _payload={"data": {"id": notice.id, "title": notice.title}},
        )],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return response


TOOL = {
    "name": 'create_admin_notice_handler',
    "permission": None,
    "agent_exposed": False,
    "purpose": '운영자가 공지를 작성한다.',
    "keywords": ['공지 작성', '공지사항 생성', 'admin notice 생성'],
    "boundaries": '운영자 전용 — 공지 생성. 수정은 application의 update_admin_notice_handler, 삭제는 delete_admin_notice_handler.',
    "output": '생성된 공지 상세 (NoticeDetailResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'title': {'description': '공지 제목.', 'maxLength': 200, 'title': '제목', 'type': 'string'},
            'content': {'description': '공지 본문.', 'minLength': 1, 'title': '내용', 'type': 'string'},
            'category': {'$ref': '#/$defs/NoticeCategory', 'description': '유형: maintenance(점검)/update(업데이트)/announcement(공지).'},
            'is_published': {'default': False, 'description': 'true면 즉시 게시.', 'title': '즉시 게시', 'type': 'boolean'},
            'is_pinned': {'default': False, 'description': 'true면 목록 상단 고정.', 'title': '상단 고정', 'type': 'boolean'},
            'attachments': {'anyOf': [{'items': {'$ref': '#/$defs/AttachmentItem'}, 'maxItems': 5, 'type': 'array'}, {'type': 'null'}], 'default': None, 'description': '첨부파일 목록(최대 5개).', 'title': '첨부파일'},
        },
        "$defs": {'AttachmentItem': {'properties': {'url': {'description': '공개 URL', 'title': 'Url', 'type': 'string'}, 'path': {'description': '저장소 경로', 'title': 'Path', 'type': 'string'}, 'name': {'description': '원본 파일명', 'title': 'Name', 'type': 'string'}, 'size': {'description': '파일 크기 (bytes)', 'title': 'Size', 'type': 'integer'}, 'content_type': {'description': 'MIME 타입', 'title': 'Content Type', 'type': 'string'}}, 'required': ['url', 'path', 'name', 'size', 'content_type'], 'title': 'AttachmentItem', 'type': 'object'}, 'NoticeCategory': {'enum': ['maintenance', 'update', 'announcement'], 'title': 'NoticeCategory', 'type': 'string'}},
        "required": ['title', 'content', 'category'],
    },
}
