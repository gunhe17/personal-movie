from app.core.exceptions import EntityNotFoundException, InvalidOperationException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.role.role.schemas import RoleCode


async def withdraw_handler(
    account_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
) -> None:
    from app.modules.auth.facade import AuthFacade
    from app.modules.person.facade import PersonFacade
    from app.modules.center.facade import MemberFacade
    from app.modules.role.facade import RoleFacade

    person_facade = PersonFacade(uow)
    person = await person_facade.find_person_by_account(account_id)
    if not person:
        raise EntityNotFoundException("Person을 찾을 수 없습니다.")

    member_facade = MemberFacade(uow)
    members = await member_facade.list_by_person(person.id)

    if members:
        role_facade = RoleFacade(uow)
        for member in members:
            role = await role_facade.find_role_with_version(member.role_id)
            if role and role.code == RoleCode.ADMIN.value:
                raise InvalidOperationException(
                    "센터 소유주(ADMIN)는 회원 탈퇴를 할 수 없습니다. "
                    "센터의 소유권을 이전하거나 센터를 삭제한 후 탈퇴해주세요."
                )

    member_atomics, _count = await member_facade.delete_members_by_person(person.id)

    person_atomic, _ = await person_facade.delete_person(person.id)

    auth_facade = AuthFacade(uow)
    revoke_atomics, atomic = await auth_facade.withdraw(
        account_id=account_id,
        person_id=person.id,
    )
    await emit(
        uow,
        "account_deleted",
        event_group_id=event_group_id,
        atomics=[*member_atomics, person_atomic, *revoke_atomics, atomic],
        actor_id=person.id,
    )


TOOL = {
    "name": "withdraw_handler",
    "agent_exposed": False,
    "permission": None,
    "purpose": "현재 로그인한 사용자 본인의 회원 탈퇴를 처리해 계정과 개인정보를 삭제한다.",
    "keywords": [
        "회원 탈퇴",
        "탈퇴",
        "탈퇴하기",
        "계정 삭제",
        "회원 해지",
        "계정 없애기",
        "withdraw",
        "서비스 탈퇴",
    ],
    "boundaries": (
        "인증된 '본인'을 자발적으로 탈퇴시키는 도구다 — 입력 인자 없이 토큰의 주인 기준으로 동작한다. "
        "센터 소유주(ADMIN)는 소유권 이전이나 센터 삭제 전에는 탈퇴할 수 없다. "
        "운영자가 남의 계정을 잠그는 lock_admin_account_handler와는 다르며, 삭제는 복구할 수 없다."
    ),
    "output": "없음 (탈퇴 처리, 복구 불가).",
    "input_schema": {"type": "object", "properties": {}, "required": []},
}
