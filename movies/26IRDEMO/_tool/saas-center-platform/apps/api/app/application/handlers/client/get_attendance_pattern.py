# client 컨텍스트지만 출석 데이터는 counseling 도메인 소유라 여기서 조율한다.
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.counseling.facade.counseling_session_facade import (
    CounselingSessionFacade,
)
from app.modules.client.profile.schemas import (
    AttendancePatternItem,
    AttendancePatternResponse,
)
from app.infrastructure.persistence.new_repository import single_page


async def get_attendance_pattern_handler(
    center_id: str,
    client_id: str,
    last: int,
    uow: UnitOfWork,
) -> AttendancePatternResponse:
    # 최근 N회기, 시간순 과거→최신.
    facade = CounselingSessionFacade(uow)
    points = await facade.get_client_attendance_pattern(
        center_id=center_id, client_id=client_id, limit=last
    )

    items = [
        AttendancePatternItem(
            session_id=p.session_id,
            attendance_status=p.attendance_status,
            session_at=p.session_at,
        )
        for p in points
    ]
    return AttendancePatternResponse(items=items, **single_page(points))


TOOL = {
    "name": "get_attendance_pattern_handler",
    "permission": "read:counseling",
    "purpose": "한 내담자의 최근 상담 회기 출석 이력(출석/결석/노쇼)을 시간순으로 조회한다.",
    "keywords": [
        "get attendance pattern",
        "출석 패턴",
        "출석 이력",
        "최근 출석",
        "결석",
        "노쇼",
        "안 왔어",
        "빠진 거",
        "회기 출결",
        "상담 참석 기록",
    ],
    "boundaries": (
        "특정 내담자 한 명의 '출석 여부' 시계열만 본다 — 회기 수·완료율 같은 집계 지표는 "
        "get_client_metrics_handler, 오늘 상담·미작성 일지 같은 실시간 알림 신호는 "
        "get_client_signals_handler를 쓴다. 상담 read 권한이 필요한 읽기 전용 도구다."
    ),
    "output": "출석 이력 시계열 (AttendancePatternResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 내담자",
                "description": "출석 이력을 볼 내담자의 UUID.",
            },
            "last": {
                "type": "integer",
                "title": "최근 회기 수",
                "minimum": 1,
                "maximum": 30,
                "description": "거슬러 볼 최근 회기 개수 (예: 7이면 최근 7회기).",
            },
        },
        "required": ["client_id", "last"],
    },
}
