from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ...facade.member_non_working_time_facade import MemberNonWorkingTimeFacade
from ..schemas import MemberNonWorkingTimeListResponse, MemberNonWorkingTimeReason


async def list_member_non_working_times_handler(
    center_id: str,
    member_id: str,
    year: int | None,
    reason: MemberNonWorkingTimeReason | None,
    page: int,
    size: int,
    uow: UnitOfWork,
) -> MemberNonWorkingTimeListResponse:
    facade = MemberNonWorkingTimeFacade(uow)
    result = await facade.list_with_response(
        member_id, year=year, reason=reason, page=page, size=size
    )
    return result


TOOL = {
    "name": "list_member_non_working_times_handler",
    "permission": None,
    "purpose": "멤버 비근무 시간 목록을 연도·사유로 거르고 조회한다.",
    "keywords": ["휴가 목록", "비근무 시간 목록", "연차 내역"],
    "boundaries": "멤버 비근무 목록(읽기). 단건은 get_member_non_working_time_handler.",
    "output": "멤버 비근무 시간 목록 (MemberNonWorkingTimeListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "member_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 멤버",
                "description": "비근무 시간을 조회할 멤버의 UUID.",
            },
            "year": {
                "type": "integer",
                "title": "연도 필터",
                "description": "연도 필터(선택).",
            },
            "reason": {
                "type": "string",
                "enum": [
                    "ANNUAL_LEAVE",
                    "HALF_DAY_AM",
                    "HALF_DAY_PM",
                    "SICK_LEAVE",
                    "PERSONAL",
                    "TRAINING",
                    "BUSINESS_TRIP",
                    "OTHER",
                ],
                "title": "사유 필터",
                "description": "비근무 사유 필터(선택).",
            },
            "page": {
                "type": "integer",
                "title": "페이지",
                "minimum": 1,
                "description": "페이지 번호(1부터).",
            },
            "size": {
                "type": "integer",
                "title": "페이지 크기",
                "description": "페이지당 개수.",
            },
        },
        "required": ["member_id", "page", "size"],
    },
}
