# read:member 권한 없이 호출 가능 — get_center_context(멤버십 검증)만 전제. member_id와 name만 반환.

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.exceptions import EntityNotFoundException
from app.modules.center.member.schemas import MeMemberResponse
from app.modules.center.facade import MemberFacade
from app.modules.person.facade import PersonFacade


async def get_my_member_handler(
    center_id: str,
    member_id: str,
    uow: UnitOfWork,
) -> MeMemberResponse:
    member_facade = MemberFacade(uow)
    person_facade = PersonFacade(uow)

    member = await member_facade.get_member_validated(member_id, center_id)

    person_map = await person_facade.get_persons_by_ids([member.person_id])
    person = person_map.get(member.person_id)

    if not person:
        raise EntityNotFoundException(f"Person을 찾을 수 없습니다: {member.person_id}")

    return MeMemberResponse(id=member.id, name=person.name)


TOOL = {
    "name": "get_my_member_handler",
    "permission": None,
    "purpose": "현재 로그인한 사용자의 이 센터에서의 멤버 식별자와 이름을 조회한다.",
    "keywords": [
        "get my member",
        "내 멤버 정보",
        "본인 멤버",
        "내 센터 멤버",
        "내 이름",
        "my member",
        "로그인 멤버",
        "내 구성원 정보",
    ],
    "boundaries": "read:member 권한 없이도 호출되며, 멤버 id와 이름만 가볍게 반환한다 — 입력 인자 없이 본인·현재 센터 기준으로 동작한다. 멤버 전체 상세는 get_member_detail_handler, 계정 차원의 내 정보는 get_me_handler를 쓴다.",
    "output": "내 멤버 정보 (MeMemberResponse).",
    "input_schema": {
        "type": "object",
        "properties": {},
        "required": [],
    },
}
