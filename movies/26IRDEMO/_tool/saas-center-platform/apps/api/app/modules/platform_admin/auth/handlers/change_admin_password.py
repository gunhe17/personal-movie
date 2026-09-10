from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.exceptions import InvalidOperationException
from app.modules.event import emit
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic
from app.modules.platform_admin.admin_account.repository import AdminAccountRepository
from app.modules.platform_admin.admin_account.services.change_password import (
    ChangePasswordService,
)
from app.modules.platform_admin.auth.schemas import (
    ChangePasswordRequest,
    ChangePasswordResponse,
)


async def change_admin_password_handler(
    data: ChangePasswordRequest,
    actor_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: str,
    ip: str | None = None,
) -> ChangePasswordResponse:
    # 확인 비밀번호 일치 검증
    if data.new_password != data.new_password_confirm:
        raise InvalidOperationException("새 비밀번호가 일치하지 않습니다")

    admin_repo = uow.repo(AdminAccountRepository)
    service = ChangePasswordService(admin_repo)
    await service.execute(
        admin_account_id=actor_id,
        current_password=data.current_password,
        new_password=data.new_password,
    )

    await emit(
        uow,
        "admin_account_password_changed",
        event_group_id=event_group_id,
        atomics=[AdminAuditAtomic(
            _act="changed",
            _entity_name="admin_account",
            _entity_id=actor_id,
            _payload={"input": {"field": "password"}},
        )],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )

    return ChangePasswordResponse()


TOOL = {
    "name": 'change_admin_password_handler',
    "permission": None,
    "purpose": '운영자 본인의 비밀번호를 변경한다.',
    "keywords": ['어드민 비밀번호 변경', '관리자 비번 변경', 'admin change password'],
    "boundaries": "운영자 '본인' 비밀번호 변경. 로그인은 admin_login_handler.",
    "output": '비밀번호 변경 결과 (ChangePasswordResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'current_password': {'minLength': 1, 'title': '현재 비밀번호', 'type': 'string', 'description': '본인 확인용 현재 비밀번호.'},
            'new_password': {'minLength': 1, 'title': '새 비밀번호', 'type': 'string', 'description': '새로 설정할 비밀번호.'},
            'new_password_confirm': {'minLength': 1, 'title': '새 비밀번호 확인', 'type': 'string', 'description': '새 비밀번호 재입력(일치 확인).'},
        },
        "required": ['current_password', 'new_password', 'new_password_confirm'],
    },
}
