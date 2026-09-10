from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.token.factory import get_token
from app.modules.auth.facade import AuthFacade
from app.modules.auth.schemas import (
    RefreshTokenRequest,
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


async def refresh_token_handler(
    data: RefreshTokenRequest,
    uow: UnitOfWork,
) -> LoginResponse:
    auth_facade = AuthFacade(uow)
    account = await auth_facade.validate_refresh_token(
        refresh_token=data.refresh_token,
    )

    from app.modules.person.facade import PersonFacade

    person = await PersonFacade(uow).find_person_by_account(account.id)

    centers = await _build_center_summaries(person.id, uow) if person else []

    access_token = get_token().create_access_token(
        data={
            "account_id": account.id,
            "person_id": person.id if person else None,
            "email": account.email,
        },
        account_token_version=account.token_version,
    )

    response = LoginResponse(
        account=AccountSummary.model_validate(account),
        person=PersonSummary.model_validate(person) if person else None,
        access_token=access_token,
        refresh_token=data.refresh_token,  # 기존 토큰 그대로
        token_type="Bearer",
        expires_in=1800,  # 30분
        centers=centers,
    )

    return response


TOOL = {
    "name": "refresh_token_handler",
    "agent_exposed": False,
    "permission": None,
    "purpose": "리프레시 토큰으로 만료된 액세스 토큰을 새로 발급한다.",
    "keywords": [
        "refresh token",
        "토큰 갱신",
        "토큰 재발급",
        "리프레시",
        "세션 연장",
        "로그인 유지",
        "refresh",
        "액세스 토큰 갱신",
        "재로그인 없이 연장",
    ],
    "boundaries": "이미 발급받은 리프레시 토큰을 새 액세스 토큰으로 교환할 뿐, 이메일·비밀번호로 새로 로그인하지 않는다(그건 login_handler). 리프레시 토큰 자체는 그대로 유지되며, 본인 정보 조회는 get_me_handler를 쓴다.",
    "output": "갱신된 액세스 토큰 (LoginResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "refresh_token": {
                "minLength": 1,
                "title": "리프레시 토큰",
                "type": "string",
                "description": "액세스 토큰 갱신에 사용할 리프레시 토큰.",
            },
        },
        "required": ["refresh_token"],
    },
}
