from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ...facade.non_operating_time_facade import NonOperatingTimeFacade
from ..schemas import RegisterCenterHolidaysResponse


async def register_center_holidays_handler(
    center_id: str,
    year: int,
    uow: UnitOfWork,
    *,
    event_group_id: str,
) -> RegisterCenterHolidaysResponse:
    holidays = await _fetch_holidays(year)

    facade = NonOperatingTimeFacade(uow)
    atomics, result = await facade.register_holidays_with_response(
        center_id=center_id,
        year=year,
        holidays=holidays,
    )
    await emit(
        uow,
        "center_holidays_registered",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_type="machine",
    )
    return result


async def _fetch_holidays(year: int) -> list[dict]:
    # TODO: 외부 공휴일 API 연동(공공데이터포털) — 연동 전까지 빈 리스트.
    # format: [{"year": 2026, "month": 1, "day": 1, "reason": "신정"}, ...]
    return []


TOOL = {
    "name": "register_center_holidays_handler",
    "permission": None,
    "agent_exposed": False,  # SYSTEM API(별도 인증 예정)
    "purpose": "해당 연도의 공휴일을 센터 비운영 시간으로 일괄 등록한다.",
    "keywords": ["공휴일 등록", "휴일 일괄 등록", "holiday 등록", "법정공휴일"],
    "boundaries": "연도별 공휴일을 비운영 시간으로 '일괄' 등록. 개별 등록은 create_center_non_operating_time_handler.",
    "output": "일괄 등록된 공휴일 결과 (RegisterCenterHolidaysResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "year": {
                "type": "integer",
                "title": "등록 연도",
                "description": "공휴일을 등록할 연도.",
            },
        },
        "required": ["year"],
    },
}
