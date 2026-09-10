"""센터별 역할(Role) + 역할-권한 매핑(RolePermission) 픽스처."""
from sqlalchemy import select

from app.modules.role.role.models import Role
from app.modules.role.permission.models import Permission
from app.modules.role.role_permission.models import RolePermission
from app.modules.role.role_permission.config import DEFAULT_ROLE_PERMISSIONS

from scripts.seed.develop import gen_id


async def seed_center_roles(session, center_id: str) -> dict[str, str]:
    """센터별 Role 생성 (Global Role 복사). Returns: {role_code: role_id}"""
    print("\n🎭 센터별 역할 생성 중...")

    # 이미 센터별 Role이 있는지 확인
    existing = await session.execute(
        select(Role).where(
            Role.center_id == center_id,
            Role.deleted_at.is_(None),
        )
    )
    existing_roles = {r.code: r for r in existing.scalars().all()}
    if existing_roles:
        print(f"  ⏭️  센터별 역할 이미 존재 ({len(existing_roles)}개)")
        return {code: r.id for code, r in existing_roles.items()}

    # Global Role 조회
    global_result = await session.execute(
        select(Role).where(
            Role.center_id.is_(None),
            Role.deleted_at.is_(None),
        )
    )
    global_roles = {r.code: r for r in global_result.scalars().all()}

    if not global_roles:
        raise RuntimeError("Global Role이 없습니다. scripts.seed.common 를 먼저 실행하세요.")

    role_map = {}
    for code, global_role in global_roles.items():
        new_role_id = gen_id()
        role = Role(
            id=new_role_id,
            center_id=center_id,
            code=code,
            name=global_role.name,
            description=global_role.description,
            access_level=global_role.access_level,
            version=1,
        )
        session.add(role)
        role_map[code] = new_role_id
        print(f"  ✅ {global_role.name} ({code})")

    await session.flush()

    # 권한 매핑 복사
    print("\n🔗 센터별 역할-권한 매핑 생성 중...")
    perm_result = await session.execute(select(Permission))
    perm_map = {p.code: p.id for p in perm_result.scalars().all()}

    count = 0
    for role_code, role_config in DEFAULT_ROLE_PERMISSIONS.items():
        role_id = role_map.get(role_code)
        if not role_id:
            continue
        for perm_code in role_config["permissions"]:
            perm_id = perm_map.get(perm_code)
            if not perm_id:
                continue
            rp = RolePermission(role_id=role_id, permission_id=perm_id)
            session.add(rp)
            count += 1
    await session.flush()
    print(f"  ✅ 권한 매핑 {count}개 생성 완료")

    return role_map
