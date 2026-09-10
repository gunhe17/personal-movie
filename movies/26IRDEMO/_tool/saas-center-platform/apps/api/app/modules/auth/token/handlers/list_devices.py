from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..repository import RefreshTokenRepository
from ..services import ListDevicesService
from ..schemas import DeviceSessionSummary, DeviceSessionListResponse


async def list_devices_handler(
    account_id: str,
    current_token_hash: str | None,
    uow: UnitOfWork,
) -> DeviceSessionListResponse:
    # Repository 획득
    token_repo = uow.repo(RefreshTokenRepository)

    # Service 실행
    service = ListDevicesService(token_repo)
    sessions = await service.execute(account_id)

    # 응답 생성
    session_summaries = []
    for session in sessions:
        summary = DeviceSessionSummary.model_validate(session)
        # 현재 사용 중인 세션 표시
        if current_token_hash and session.token_hash == current_token_hash:
            summary.is_current = True
        session_summaries.append(summary)

    return DeviceSessionListResponse(
        sessions=session_summaries, total=len(session_summaries)
    )


TOOL = {
    "name": "list_devices_handler",
    "permission": None,
    "purpose": "로그인한 사용자의 로그인 기기(세션) 목록을 조회한다.",
    "keywords": ["기기 목록", "로그인 세션", "디바이스 조회", "내 기기"],
    "boundaries": "본인 로그인 기기/세션 목록(읽기). 특정 기기 해제는 revoke_device_handler.",
    "output": "로그인 기기 세션 목록 (DeviceSessionListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {},
        "required": [],
    },
}
