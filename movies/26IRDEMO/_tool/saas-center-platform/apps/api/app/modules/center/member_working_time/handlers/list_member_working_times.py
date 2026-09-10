from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ...facade.member_working_time_facade import MemberWorkingTimeFacade
from ..schemas import MemberWorkingTimeResponse


async def list_member_working_times_handler(
    center_id: str,
    member_id: str,
    uow: UnitOfWork,
) -> list[MemberWorkingTimeResponse]:
    facade = MemberWorkingTimeFacade(uow)
    result = await facade.list_with_response(center_id, member_id)
    return result


TOOL = {
    "name": "list_member_working_times_handler",
    "permission": None,
    "purpose": "멤버 근무시간 목록(요일별)을 조회한다.",
    "keywords": ["근무시간 목록", "멤버 스케줄 조회", "working time 목록"],
    "boundaries": "멤버 근무시간 목록(읽기). 설정은 bulk_update_member_working_times_handler.",
    "output": "요일별 멤버 근무시간 목록 (MemberWorkingTimeResponse 배열).",
    "input_schema": {
        "type": "object",
        "properties": {
            "member_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 멤버",
                "description": "근무시간을 조회할 멤버의 UUID.",
            },
        },
        "required": ["member_id"],
    },
}
