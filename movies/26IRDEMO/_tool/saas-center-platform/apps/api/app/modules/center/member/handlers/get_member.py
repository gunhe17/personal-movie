from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import MemberResponse


async def get_member_handler(
    center_id: str,
    member_id: str,
    uow: UnitOfWork,
) -> MemberResponse:
    from app.modules.center.facade import MemberFacade

    facade = MemberFacade(uow)
    result = await facade.get_member_with_response(
        member_id=member_id,
        center_id=center_id,
    )
    return result


TOOL = {
    "name": "get_member_handler",
    "permission": None,
    "purpose": "센터 멤버의 기본 정보를 조회한다.",
    "keywords": ["멤버 조회", "직원 정보", "member 조회"],
    "boundaries": "모듈 기본 멤버 조회(읽기). 자격·역할까지 포함한 상세는 application의 get_member_handler.",
    "output": "센터 멤버 기본 정보 (MemberResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "member_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 멤버",
                "description": "조회할 멤버의 UUID.",
            },
        },
        "required": ["member_id"],
    },
}
