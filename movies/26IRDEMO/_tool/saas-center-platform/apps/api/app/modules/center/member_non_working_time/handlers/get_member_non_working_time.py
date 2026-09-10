from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ...facade.member_non_working_time_facade import MemberNonWorkingTimeFacade
from ..schemas import MemberNonWorkingTimeResponse


async def get_member_non_working_time_handler(
    center_id: str,
    member_id: str,
    non_working_time_id: str,
    uow: UnitOfWork,
) -> MemberNonWorkingTimeResponse:
    facade = MemberNonWorkingTimeFacade(uow)
    result = await facade.get_with_response(member_id, non_working_time_id)
    return result


TOOL = {
    "name": "get_member_non_working_time_handler",
    "permission": None,
    "purpose": "멤버 비근무 시간 한 건을 조회한다.",
    "keywords": ["휴가 조회", "비근무 시간 상세"],
    "boundaries": "단건 조회(읽기). 목록은 list_member_non_working_times_handler.",
    "output": "멤버 비근무 시간 상세 (MemberNonWorkingTimeResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "member_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 멤버",
                "description": "대상 멤버의 UUID.",
            },
            "non_working_time_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 비근무 시간",
                "description": "조회할 비근무 시간의 UUID.",
            },
        },
        "required": ["member_id", "non_working_time_id"],
    },
}
