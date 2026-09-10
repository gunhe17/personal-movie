"""역할 및 권한 시드 데이터 생성 스크립트

Global Role (center_id=NULL)은 템플릿으로 사용됩니다.
센터 생성 시 Global Role + Global RolePermission이 센터별로 복사됩니다.

Role.version 필드로 권한 변경을 추적합니다 (권한 변경 시 +1).
"""
import asyncio
from datetime import datetime, timezone
from sqlalchemy import select
from app.infrastructure.persistence.database import AsyncSessionLocal
from app.modules.role.role.models import Role
from app.modules.role.permission.models import Permission
from app.modules.role.role_permission.models import RolePermission


# ==================== 역할 정의 (4-tier) ====================
# center_id=NULL인 Global Role (템플릿)
# id는 UUID 자동 생성 (BaseModel 상속)
ROLES = [
    {
        "code": "ADMIN",
        "name": "관리자",
        "description": "센터 전체를 관리하는 최고 관리자 역할입니다. 모든 권한을 가집니다.",
    },
    {
        "code": "MANAGER",
        "name": "매니저",
        "description": "센터 운영/행정을 관리하는 매니저 역할입니다. 센터 전체 리소스 접근 가능.",
    },
    {
        "code": "COUNSELOR",
        "name": "전문가",
        "description": "검사/상담을 수행하는 전문가 역할입니다. 본인 담당 건만 접근 가능합니다.",
    },
    {
        "code": "STAFF",
        "name": "직원",
        "description": "접수/행정을 담당하는 직원 역할입니다. 일정·내담자·수납 중심이며 상담 기록은 제외됩니다.",
    },
]


# ==================== 권한 정의 ({action}:{resource} 포맷) ====================
# permissions.py의 Permission 클래스와 동일한 포맷
# Actions: read, write, delete (manage 전체 제거 — access_level로 대체)
PERMISSIONS = [
    # 센터 (CENTER)
    {"code": "read:center", "name": "센터 조회", "description": "센터 정보를 조회할 수 있습니다.", "category": "CENTER"},
    {"code": "write:center", "name": "센터 수정", "description": "센터 정보 및 설정을 수정할 수 있습니다.", "category": "CENTER"},
    # 프로그램 (PROGRAM)
    {"code": "read:program", "name": "프로그램 조회", "description": "프로그램 목록을 조회할 수 있습니다.", "category": "PROGRAM"},
    {"code": "write:program", "name": "프로그램 관리", "description": "프로그램을 생성/수정/삭제할 수 있습니다.", "category": "PROGRAM"},
    # 장소 (ROOM)
    {"code": "read:room", "name": "장소 조회", "description": "장소(상담실) 목록을 조회할 수 있습니다.", "category": "ROOM"},
    {"code": "write:room", "name": "장소 관리", "description": "장소(상담실)를 생성/수정/삭제할 수 있습니다.", "category": "ROOM"},
    # 구성원 (MEMBER)
    {"code": "read:member", "name": "구성원 조회", "description": "구성원 목록 및 상세 정보를 조회할 수 있습니다.", "category": "MEMBER"},
    {"code": "write:member", "name": "구성원 수정", "description": "구성원 정보를 수정할 수 있습니다.", "category": "MEMBER"},
    {"code": "delete:member", "name": "구성원 삭제", "description": "구성원을 삭제할 수 있습니다.", "category": "MEMBER"},
    # 구성원 초대 (MEMBER_INVITATION)
    {"code": "read:member_invitation", "name": "초대 목록 조회", "description": "구성원 초대 목록을 조회할 수 있습니다.", "category": "MEMBER_INVITATION"},
    {"code": "write:member_invitation", "name": "초대 생성/취소", "description": "구성원 초대를 생성하거나 취소할 수 있습니다.", "category": "MEMBER_INVITATION"},
    # 일정 (SCHEDULE)
    {"code": "read:schedule", "name": "일정 조회", "description": "일정 정보를 조회할 수 있습니다.", "category": "SCHEDULE"},
    {"code": "write:schedule", "name": "일정 생성/수정", "description": "일정을 생성하거나 수정할 수 있습니다.", "category": "SCHEDULE"},
    {"code": "delete:schedule", "name": "일정 삭제", "description": "일정을 삭제할 수 있습니다.", "category": "SCHEDULE"},
    # 내담자 (CLIENT)
    {"code": "read:client", "name": "내담자 조회", "description": "내담자 정보를 조회할 수 있습니다.", "category": "CLIENT"},
    {"code": "write:client", "name": "내담자 생성/수정", "description": "내담자를 등록하거나 수정할 수 있습니다.", "category": "CLIENT"},
    {"code": "delete:client", "name": "내담자 삭제", "description": "내담자를 삭제할 수 있습니다.", "category": "CLIENT"},
    # 상담 (COUNSELING)
    {"code": "read:counseling", "name": "상담 조회", "description": "상담 정보를 조회할 수 있습니다.", "category": "COUNSELING"},
    {"code": "write:counseling", "name": "상담 생성/수정", "description": "상담을 생성하거나 수정할 수 있습니다.", "category": "COUNSELING"},
    {"code": "delete:counseling", "name": "상담 삭제", "description": "상담을 삭제할 수 있습니다.", "category": "COUNSELING"},
    # 상담 노트 (COUNSELING_NOTE)
    {"code": "read:counseling_note", "name": "상담 노트 조회", "description": "상담 노트를 조회할 수 있습니다.", "category": "COUNSELING_NOTE"},
    {"code": "write:counseling_note", "name": "상담 노트 생성/수정", "description": "상담 노트를 생성하거나 수정할 수 있습니다.", "category": "COUNSELING_NOTE"},
    # 검사 (ASSESSMENT)
    {"code": "read:assessment_case", "name": "검사 케이스 조회", "description": "검사 케이스 정보를 조회할 수 있습니다.", "category": "ASSESSMENT"},
    {"code": "write:assessment_case", "name": "검사 케이스 생성/수정", "description": "검사 케이스를 생성하거나 수정할 수 있습니다.", "category": "ASSESSMENT"},
    {"code": "delete:assessment_case", "name": "검사 케이스 삭제", "description": "검사 케이스를 삭제할 수 있습니다.", "category": "ASSESSMENT"},
    # 검사 설정 (CENTER_ASSESSMENT)
    {"code": "read:center_assessment", "name": "센터 검사 조회", "description": "센터 검사 카탈로그를 조회할 수 있습니다.", "category": "CENTER_ASSESSMENT"},
    {"code": "write:center_assessment", "name": "센터 검사 관리", "description": "센터 검사 카탈로그를 활성화/설정 변경할 수 있습니다.", "category": "CENTER_ASSESSMENT"},
    # 바로링크 (SEND_LINK)
    {"code": "read:send_link", "name": "바로링크 조회", "description": "바로링크 발송이력을 조회할 수 있습니다.", "category": "SEND_LINK"},
    {"code": "write:send_link", "name": "바로링크 발송", "description": "바로링크를 발송/재전송할 수 있습니다.", "category": "SEND_LINK"},
    # 문서 (DOCUMENT)
    {"code": "read:document", "name": "문서 조회", "description": "문서를 조회할 수 있습니다.", "category": "DOCUMENT"},
    {"code": "write:document", "name": "문서 생성/수정", "description": "문서를 생성하거나 수정할 수 있습니다.", "category": "DOCUMENT"},
    {"code": "delete:document", "name": "문서 삭제", "description": "문서를 삭제할 수 있습니다.", "category": "DOCUMENT"},
    # 양식 관리 (FORM_TEMPLATE)
    {"code": "read:form_template", "name": "양식 템플릿 조회", "description": "양식 템플릿 목록을 조회할 수 있습니다.", "category": "FORM_TEMPLATE"},
    {"code": "write:form_template", "name": "양식 템플릿 관리", "description": "양식 템플릿을 생성/수정/삭제할 수 있습니다.", "category": "FORM_TEMPLATE"},
    # 양식 (FORM)
    {"code": "read:form_instance", "name": "양식 인스턴스 조회", "description": "양식 인스턴스를 조회할 수 있습니다.", "category": "FORM"},
    {"code": "write:form_instance", "name": "양식 인스턴스 생성/수정", "description": "양식 인스턴스를 생성하거나 수정할 수 있습니다.", "category": "FORM"},
    {"code": "delete:form_instance", "name": "양식 인스턴스 삭제", "description": "양식 인스턴스를 삭제할 수 있습니다.", "category": "FORM"},
    # 역할 (ROLE)
    {"code": "read:role", "name": "역할 조회", "description": "역할 목록 및 상세 정보를 조회할 수 있습니다.", "category": "ROLE"},
    {"code": "write:role", "name": "역할 관리", "description": "역할 및 권한을 관리할 수 있습니다.", "category": "ROLE"},
    # 활동 로그 (ACTIVITY_LOG)
    {"code": "read:activity_log", "name": "활동 로그 조회", "description": "센터 활동 로그를 조회할 수 있습니다.", "category": "ACTIVITY_LOG"},
    # 공지 (NOTICE)
    {"code": "read:notice", "name": "공지사항 조회", "description": "공지사항을 조회할 수 있습니다.", "category": "NOTICE"},
    {"code": "write:notice", "name": "공지사항 생성/수정", "description": "공지사항을 생성하거나 수정할 수 있습니다.", "category": "NOTICE"},
    # 청구 (BILLING)
    {"code": "read:billing", "name": "청구 조회", "description": "청구 내역을 조회할 수 있습니다.", "category": "BILLING"},
    {"code": "write:billing", "name": "청구 생성/완료", "description": "청구를 생성하거나 완료 처리할 수 있습니다.", "category": "BILLING"},
    {"code": "delete:billing", "name": "청구 삭제", "description": "청구를 삭제할 수 있습니다.", "category": "BILLING"},
    # 바우처 (VOUCHER)
    {"code": "read:voucher", "name": "바우처 조회", "description": "센터 취급 바우처 및 내담자 바우처를 조회할 수 있습니다.", "category": "VOUCHER"},
    {"code": "write:voucher", "name": "바우처 등록/수정", "description": "센터 취급 바우처를 등록하거나 수정할 수 있습니다.", "category": "VOUCHER"},
    {"code": "delete:voucher", "name": "바우처 삭제", "description": "센터 취급 바우처를 삭제(취소)할 수 있습니다.", "category": "VOUCHER"},
]


# ==================== 역할-권한 매핑 (config.py에서 공유) ====================
from app.modules.role.role_permission.config import DEFAULT_ROLE_PERMISSIONS

ROLE_PERMISSIONS = DEFAULT_ROLE_PERMISSIONS


async def seed_roles(session):
    """Global 역할 시드 데이터 생성 (center_id=NULL)"""
    print("\n📋 Global 역할(Role) 시드 데이터 생성 중...")

    for role_data in ROLES:
        # 기존 Global Role 확인 (center_id IS NULL)
        result = await session.execute(
            select(Role).where(
                Role.code == role_data["code"],
                Role.center_id.is_(None)
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            print(f"  ⏭️  Global 역할 '{role_data['name']}' 이미 존재 (ID: {existing.id})")
            continue

        # 새 Global Role 생성 (center_id=NULL 명시, UUID 자동 생성)
        # access_level은 config에서 가져옴
        role_config = ROLE_PERMISSIONS.get(role_data["code"], {})
        access_level = role_config.get("access_level", "own")
        role = Role(
            center_id=None,  # Global Role (템플릿)
            code=role_data["code"],
            name=role_data["name"],
            description=role_data["description"],
            access_level=access_level,
            version=1,  # 초기 버전
        )
        session.add(role)
        await session.flush()  # UUID 생성을 위한 flush
        print(f"  ✅ Global 역할 '{role_data['name']}' 생성 완료 (ID: {role.id})")

    await session.commit()
    print("✅ Global 역할 시드 데이터 생성 완료\n")


async def seed_permissions(session):
    """권한 시드 데이터 생성"""
    print("🔒 권한(Permission) 시드 데이터 생성 중...")

    added_at = datetime.now(timezone.utc).replace(tzinfo=None)

    for perm_data in PERMISSIONS:
        # 기존 데이터 확인
        result = await session.execute(
            select(Permission).where(Permission.code == perm_data["code"])
        )
        existing = result.scalar_one_or_none()

        if existing:
            print(f"  ⏭️  권한 '{perm_data['name']}' 이미 존재 (ID: {existing.id})")
            continue

        # 새 권한 생성 (ID는 DB 시퀀스 자동 할당)
        permission = Permission(
            code=perm_data["code"],
            name=perm_data["name"],
            description=perm_data["description"],
            category=perm_data["category"],
            is_new=False,
            added_at=added_at,
        )
        session.add(permission)
        await session.flush()
        print(f"  ✅ 권한 '{perm_data['name']}' 생성 완료 (ID: {permission.id})")

    await session.commit()
    print("✅ 권한 시드 데이터 생성 완료\n")


async def seed_role_permissions(session):
    """Global 역할-권한 매핑 시드 데이터 생성

    Global Role (center_id=NULL)의 RolePermission을 생성합니다.
    센터 생성 시 이 매핑이 센터별 Role로 복사됩니다.
    """
    print("🔗 Global 역할-권한 매핑 시드 데이터 생성 중...")

    # 권한 코드 → ID 매핑 조회
    result = await session.execute(select(Permission))
    permissions = result.scalars().all()
    permission_map = {p.code: p.id for p in permissions}

    for role_code, role_config in ROLE_PERMISSIONS.items():
        perm_codes = role_config["permissions"]
        # Global Role 조회
        result = await session.execute(
            select(Role).where(
                Role.code == role_code,
                Role.center_id.is_(None)
            )
        )
        role = result.scalar_one_or_none()

        if not role:
            print(f"  ⚠️  Global 역할 '{role_code}' 없음 - 스킵")
            continue

        for perm_code in perm_codes:
            perm_id = permission_map.get(perm_code)
            if not perm_id:
                print(f"  ⚠️  권한 '{perm_code}' 없음 - 스킵")
                continue

            # 기존 RolePermission 확인
            result = await session.execute(
                select(RolePermission).where(
                    RolePermission.role_id == role.id,
                    RolePermission.permission_id == perm_id
                )
            )
            existing = result.scalar_one_or_none()

            if existing:
                continue  # 이미 존재하면 스킵

            # 새 RolePermission 생성
            role_perm = RolePermission(
                role_id=role.id,
                permission_id=perm_id,
            )
            session.add(role_perm)

        print(f"  ✅ Global 역할 '{role_code}' 권한 매핑 완료 ({len(perm_codes)}개)")

    await session.commit()
    print("✅ Global 역할-권한 매핑 시드 데이터 생성 완료\n")


async def reset_sequences(session):
    """시퀀스 값 업데이트 (명시적 ID 사용 후 필요)

    PostgreSQL의 시퀀스를 각 테이블의 max(id)로 업데이트합니다.
    명시적 ID로 데이터를 삽입한 후, 다음 INSERT 시 충돌을 방지합니다.

    Note: Role은 UUID PK이므로 시퀀스 불필요. Permission만 INT PK 사용.
    """
    from sqlalchemy import text

    print("🔄 시퀀스 값 업데이트 중...")

    sequences = [
        ("permissions_id_seq", "permissions"),
    ]

    for seq_name, table_name in sequences:
        await session.execute(
            text(f"SELECT setval('{seq_name}', COALESCE((SELECT MAX(id) FROM {table_name}), 1))")
        )
        print(f"  ✅ {seq_name} 업데이트 완료")

    await session.commit()
    print("✅ 시퀀스 값 업데이트 완료\n")


async def main():
    """메인 실행 함수"""
    print("=" * 60)
    print("역할 및 권한 시드 데이터 생성 스크립트")
    print("(Global Role + RolePermission)")
    print("=" * 60)

    async with AsyncSessionLocal() as session:
        try:
            # 1. Global 역할 생성 (center_id=NULL)
            await seed_roles(session)

            # 2. 권한 생성
            await seed_permissions(session)

            # 3. Global 역할-권한 매핑 생성
            await seed_role_permissions(session)

            # 4. 시퀀스 값 업데이트 (Permission만 - Role은 UUID)
            await reset_sequences(session)

            print("=" * 60)
            print("✅ 시드 데이터 생성 완료!")
            print("=" * 60)
            print("\n생성된 Global 역할 (템플릿):")
            print("  - ADMIN (관리자) - 모든 권한 + write:role, access_level=all")
            print("  - MANAGER (매니저) - 센터 전체 접근 (write:role 제외), access_level=all")
            print("  - COUNSELOR (전문가) - 본인 담당만, access_level=own")
            print("  - STAFF (직원) - 접수/행정, 상담 기록 제외, access_level=all")
            print(f"\n총 권한 수: {len(PERMISSIONS)}개")
            print("\n📌 센터 승인 시 Global Role이 센터별로 복사됩니다.")
            print("=" * 60)

        except Exception as e:
            print(f"\n❌ 오류 발생: {e}")
            import traceback

            traceback.print_exc()
            await session.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(main())
