from datetime import date

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.notice.facade import NoticeFacade
from app.modules.notice.notice.schemas import (
    NoticeListResponse,
    NoticeSummary,
)



async def _resolve_member_id(
    uow: UnitOfWork, center_id: str, person_id: str
) -> str | None:
    # 읽음 상태는 (center_id, person_id) → member_id 해소 필요. member_id는 Center 모듈
    # 소유라 handler 본문이 MemberFacade로 cross-module 조합 후 Notice Service에 넘긴다.
    from app.modules.center.facade import MemberFacade

    members = await MemberFacade(uow).list_by_person(person_id)
    for member in members:
        if member.center_id == center_id:
            return member.id
    return None

async def list_notices_handler(
    uow: UnitOfWork,
    *,
    person_id: str,
    center_id: str | None = None,
    search: str | None = None,
    category: str | None = None,
    date_from: date | None = None,
    page: int = 1,
    size: int = 20,
) -> NoticeListResponse:
    member_id = None
    if center_id and person_id:
        member_id = await _resolve_member_id(uow, center_id, person_id)

    rows, read_notice_ids, meta = await NoticeFacade(uow).list_notices(
        member_id,
        search=search,
        category=category,
        date_from=date_from,
        page=page,
        size=size,
    )

    items = []
    for row in rows:
        item = NoticeSummary.model_validate(row)
        item.is_read = row.id in read_notice_ids
        items.append(item)

    return NoticeListResponse(items=items, **meta)


TOOL = {
    "name": 'list_notices_handler',
    "agent_exposed": False,
    "permission": None,
    "purpose": '공지 목록을 검색·분류·기간으로 거르고 페이지 단위로 조회한다.',
    "keywords": ['list notices', '공지 목록', '공지사항 조회', '알림 목록', '공지 검색', 'notice 목록'],
    "boundaries": '공지 목록을 조회(읽기 전용). 단건 상세는 get_notice_handler. 미열람 알림 발송은 remind_unread_members_handler.',
    "output": '공지 목록 (NoticeListResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'search': {'type': 'string', 'title': '검색어', 'description': '검색어(선택).'},
            'category': {'type': 'string', 'title': '분류 필터', 'description': '분류 필터(선택).', 'enum': ['maintenance', 'update', 'announcement']},
            'date_from': {'type': 'string', 'format': 'date', 'title': '시작일', 'description': '시작일(선택).'},
            'page': {'type': 'integer', 'title': '페이지', 'description': '페이지 번호(1부터).'},
            'size': {'type': 'integer', 'title': '페이지 크기', 'description': '페이지당 개수.'},
        },
        "required": [],
    },
}
