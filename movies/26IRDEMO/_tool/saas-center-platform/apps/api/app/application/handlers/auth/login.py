from fastapi import Request

from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.token.factory import get_token
from app.infrastructure.rate_limit.factory import get_rate_limiter
from app.core.exceptions import PermissionDeniedException
from app.modules.event import emit
from app.modules.auth.facade import AuthFacade
from app.modules.auth.schemas import (
    LoginRequest,
    LoginResponse,
    AccountSummary,
    PersonSummary,
)
from app.modules.auth.schemas import UserCenterSummary


async def _build_center_summaries(
    person_id: str,
    uow: UnitOfWork,
) -> list[UserCenterSummary]:
    # 호출자는 활성 uow 컨텍스트(async with uow) 안에서 호출해야 한다.
    # facade-to-facade 금지: member+center+role 조합을 handler 본문이 수행
    from app.modules.center.facade import MemberFacade
    from app.modules.center.facade.center_facade import CenterFacade
    from app.modules.role.facade import RoleFacade

    member_facade = MemberFacade(uow)
    members = await member_facade.list_by_person(person_id)
    if not members:
        return []

    center_ids = [m.center_id for m in members]
    center_facade = CenterFacade(uow)
    center_map = await center_facade.get_active_by_ids(center_ids)

    role_ids = list({m.role_id for m in members})
    role_facade = RoleFacade(uow)
    role_map = await role_facade.get_roles_by_ids(role_ids)

    centers: list[UserCenterSummary] = []
    for member in members:
        center = center_map.get(member.center_id)
        if not center:
            continue
        role = role_map.get(member.role_id)
        centers.append(
            UserCenterSummary(
                id=center.id,
                name=center.name,
                code=center.code,
                logo_url=center.logo_url,
                role_code=role.code if role else None,
                role_name=role.name if role else None,
                color=member.color,
                joined_at=member.created_at,
            )
        )

    return centers


async def login_handler(
    data: LoginRequest,
    request: Request,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
) -> LoginResponse:
    ip_address = request.client.host if request.client else "unknown"
    device_info = request.headers.get("User-Agent")

    # IP 기반 제한: 5회/15분
    get_rate_limiter().check_and_record(f"ip:{ip_address}", limit=5)
    # Email 기반 제한: 10회/15분
    get_rate_limiter().check_and_record(f"email:{data.email}", limit=10)

    auth_facade = AuthFacade(uow)
    result = await auth_facade.login(
        email=data.email,
        password=data.password,
        device_info=device_info,
        ip_address=ip_address,
    )

    if result.locked_reasons:
        await emit(
            uow,
            "account_suspicious_login_locked",
            event_group_id=event_group_id,
            atomics=result.atomics,
            actor_id=result.account.id,
            actor_type="account",
        )
        # locked 이벤트는 반응 0(audit-only) — dispatch는 sweeper에 맡긴다
        await uow.reject(
            PermissionDeniedException(
                f"Account locked due to suspicious activity. "
                f"Reasons: {', '.join(result.locked_reasons)}"
            )
        )

    from app.modules.person.facade import PersonFacade

    person = await PersonFacade(uow).find_person_by_account(result.account.id)

    # emit
    await emit(
        uow,
        "account_logged_in",
        event_group_id=event_group_id,
        atomics=result.atomics,
        actor_id=person.id if person else result.account.id,
    )

    centers = await _build_center_summaries(person.id, uow) if person else []

    access_token = get_token().create_access_token(
        data={
            "account_id": result.account.id,
            "person_id": person.id if person else None,
            "email": result.account.email,
        },
        account_token_version=result.account.token_version,
    )

    response = LoginResponse(
        account=AccountSummary.model_validate(result.account),
        person=PersonSummary.model_validate(person) if person else None,
        access_token=access_token,
        refresh_token=result.refresh_token,
        token_type="Bearer",
        expires_in=1800,  # 30분
        centers=centers,
    )

    get_rate_limiter().reset(f"ip:{ip_address}")
    get_rate_limiter().reset(f"email:{data.email}")

    return response


TOOL = {
    "name": "login_handler",
    "agent_exposed": False,
    "permission": None,
    "purpose": "이메일과 비밀번호로 로그인해 액세스·리프레시 토큰과 사용자·소속센터 정보를 발급한다.",
    "keywords": [
        "로그인",
        "로그인하기",
        "인증",
        "접속",
        "사인인",
        "login",
        "로그인 시도",
        "토큰 발급",
    ],
    "boundaries": "이미 가입된 계정의 인증 전용 도구다. 신규 계정 생성은 signup_handler, 이미 받은 토큰의 재발급만 필요하면 refresh_token_handler, 로그인된 본인 정보 조회는 get_me_handler를 쓴다. IP·이메일 기준으로 로그인 시도 횟수가 제한되며, 잠긴 계정은 토큰 없이 거부된다.",
    "output": "발급된 액세스·리프레시 토큰과 사용자·소속센터 정보 (LoginResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "email": {
                "format": "email",
                "title": "이메일",
                "type": "string",
                "description": "로그인 이메일.",
            },
            "password": {
                "minLength": 1,
                "title": "비밀번호",
                "type": "string",
                "description": "로그인 비밀번호.",
            },
        },
        "required": ["email", "password"],
    },
}
