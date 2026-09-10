from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.notice.facade import NoticeFacade
from app.modules.notice.notice.schemas import (
    NoticeDetailResponse,
    NoticeSiblingItem,
    NoticeSiblings,
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

async def get_notice_handler(
    notice_id: str,
    uow: UnitOfWork,
    *,
    person_id: str,
    center_id: str | None = None,
) -> NoticeDetailResponse:
    member_id = None
    if center_id and person_id:
        member_id = await _resolve_member_id(uow, center_id, person_id)

    notice, prev_notice, next_notice = await NoticeFacade(uow).get_notice_detail(
        notice_id, member_id, center_id
    )

    response = NoticeDetailResponse.model_validate(notice)
    response.siblings = NoticeSiblings(
        prev=NoticeSiblingItem.model_validate(prev_notice) if prev_notice else None,
        next=NoticeSiblingItem.model_validate(next_notice) if next_notice else None,
    )
    return response


TOOL = {
    "name": 'get_notice_handler',
    "permission": None,
    "purpose": '공지 한 건의 상세를 이전·다음 공지와 함께 조회한다.',
    "keywords": ['get notice', '공지 조회', '공지사항 상세', '공지 보기', 'notice 상세'],
    "boundaries": '단건 공지 상세(읽기, 이전/다음 공지 포함). 목록은 list_notices_handler.',
    "output": '공지 상세, 이전·다음 공지 포함 (NoticeDetailResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'notice_id': {'type': 'string', 'format': 'uuid', 'title': '대상 공지', 'description': '조회할 공지의 고유 식별 번호.'},
        },
        "required": ['notice_id'],
    },
}
