from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.auth.facade.auth_facade import AuthFacade
from app.modules.event import emit
from ..schemas import ChangePasswordRequest, ChangePasswordResponse


async def change_password_handler(
    account_id: str,
    data: ChangePasswordRequest,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str | None,
) -> ChangePasswordResponse:
    facade = AuthFacade(uow)
    atomic, revoke_atomics, revoked_count = await facade.change_password(
        account_id=account_id,
        current_password=data.current_password,
        new_password=data.new_password,
    )
    await emit(
        uow,
        "account_password_changed",
        event_group_id=event_group_id,
        atomics=[atomic, *revoke_atomics],
        actor_id=actor_id,
    )

    return ChangePasswordResponse(
        message="Password changed successfully. Please login again.",
        sessions_revoked=revoked_count,
    )


TOOL = {
    "name": "change_password_handler",
    "permission": None,
    "purpose": "로그인한 사용자의 비밀번호를 변경한다.",
    "keywords": ["비밀번호 변경", "패스워드 변경", "비번 바꾸기", "change password"],
    "boundaries": "본인 비밀번호 변경. 기기/세션 관리는 auth/token 쪽.",
    "output": "비밀번호 변경 결과 (ChangePasswordResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "current_password": {
                "minLength": 1,
                "title": "현재 비밀번호",
                "type": "string",
                "description": "본인 확인용 현재 비밀번호.",
            },
            "new_password": {
                "description": "새 비밀번호(8~72자, 영문자+숫자 조합).",
                "maxLength": 72,
                "minLength": 8,
                "title": "새 비밀번호",
                "type": "string",
            },
        },
        "required": ["current_password", "new_password"],
    },
}
