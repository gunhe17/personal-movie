from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.auth.facade import AuthFacade
from app.modules.auth.schemas import (
    MeResponse,
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


async def get_me_handler(
    account_id: str,
    uow: UnitOfWork,
) -> MeResponse:
    account = await AuthFacade(uow).get_account(account_id)

    from app.modules.person.facade import PersonFacade

    person = await PersonFacade(uow).find_person_by_account(account.id)

    centers = await _build_center_summaries(person.id, uow) if person else []

    return MeResponse(
        account=AccountSummary.model_validate(account),
        person=PersonSummary.model_validate(person) if person else None,
        centers=centers,
    )


TOOL = {
    "name": "get_me_handler",
    "permission": None,
    "purpose": "현재 로그인한 사용자 본인의 계정·개인정보·소속 센터 요약을 조회한다.",
    "keywords": [
        "get me",
        "내 정보",
        "내 프로필",
        "본인 정보",
        "내 계정",
        "로그인 정보",
        "내 소속 센터",
        "me",
        "사용자 정보",
    ],
    "boundaries": (
        "인증된 '본인' 정보 전용 — 입력 인자 없이 토큰의 주인을 기준으로 동작한다. "
        "로그인 자체는 login_handler, 신규 가입은 signup_handler. 다른 사람의 계정은 이 도구로 조회할 수 없다."
    ),
    "output": "본인 계정·개인정보·소속 센터 요약 (MeResponse).",
    "input_schema": {"type": "object", "properties": {}, "required": []},
}
