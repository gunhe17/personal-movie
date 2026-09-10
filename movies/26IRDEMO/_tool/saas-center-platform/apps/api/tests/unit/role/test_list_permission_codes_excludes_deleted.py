"""회귀: list_permission_codes_by_role 가 soft-deleted Permission 을 제외한다.
이전엔 RolePermission.deleted_at 만 거르고 조인된 Permission.deleted_at 을
검사하지 않아, 삭제된 권한이 역할의 권한 코드 목록에 계속 노출됐다."""
from datetime import datetime

from app.modules.role.permission.models import Permission
from app.modules.role.role_permission.models import RolePermission
from app.modules.role.role_permission.repository import RolePermissionRepository


async def _add_permission(session, *, code: str, deleted: bool) -> int:
    permission = Permission(
        code=code,
        name=code,
        category="test",
        added_at=datetime(2026, 1, 1),
    )
    if deleted:
        permission.deleted_at = datetime(2026, 1, 1)
    session.add(permission)
    await session.flush()
    return permission.id


async def test_list_permission_codes_excludes_soft_deleted_permission(test_session):
    role_id = "role-1"
    active_id = await _add_permission(test_session, code="ACTIVE_PERM", deleted=False)
    deleted_id = await _add_permission(test_session, code="DELETED_PERM", deleted=True)

    test_session.add(RolePermission(role_id=role_id, permission_id=active_id))
    test_session.add(RolePermission(role_id=role_id, permission_id=deleted_id))
    await test_session.commit()

    repo = RolePermissionRepository(test_session)
    codes = await repo.list_permission_codes_by_role(role_id=role_id)

    assert codes == ["ACTIVE_PERM"]
