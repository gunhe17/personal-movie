"""add access_level to roles and migrate manage permissions to write

- Schema: roles 테이블에 access_level 컬럼 추가
- Data: 기존 역할에 access_level 설정
- Data: permission 코드 리네임 (assessment→assessment_case, form→form_instance)
- Data: 새 permission 레코드 추가 (write:program, write:room 등 14개)
- Data: role_permissions를 새 config에 맞게 동기화 (global + center-specific 모두)
- Data: manage:*, read:member, read:center permission 삭제

Revision ID: c3a7f1b2d4e6
Revises: 4ee1528561d6
Create Date: 2026-03-02 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = 'c3a7f1b2d4e6'
down_revision: Union[str, Sequence[str], None] = '4ee1528561d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ============================================================
# 마이그레이션 설정
# ============================================================

# access_level 설정
ROLE_ACCESS_LEVELS = {
    "ADMIN": "all",
    "MANAGER": "all",
    "STAFF": "all",
    "COUNSELOR": "own",
}

# permission 코드 리네임
PERMISSION_RENAMES = {
    "read:assessment": "read:assessment_case",
    "write:assessment": "write:assessment_case",
    "delete:assessment": "delete:assessment_case",
    "read:form": "read:form_instance",
    "write:form": "write:form_instance",
    "delete:form": "delete:form_instance",
}

# 새로 추가할 permission (code, name, description, category)
NEW_PERMISSIONS = [
    ("write:program", "프로그램 관리", "프로그램을 생성/수정/삭제할 수 있습니다.", "PROGRAM"),
    ("write:room", "장소 관리", "장소(상담실)를 생성/수정/삭제할 수 있습니다.", "ROOM"),
    ("read:member_invitation", "초대 목록 조회", "구성원 초대 목록을 조회할 수 있습니다.", "MEMBER_INVITATION"),
    ("write:member_invitation", "초대 생성/취소", "구성원 초대를 생성하거나 취소할 수 있습니다.", "MEMBER_INVITATION"),
    ("read:counseling_note", "상담 노트 조회", "상담 노트를 조회할 수 있습니다.", "COUNSELING_NOTE"),
    ("write:counseling_note", "상담 노트 생성/수정", "상담 노트를 생성하거나 수정할 수 있습니다.", "COUNSELING_NOTE"),
    ("write:center_assessment", "센터 검사 관리", "센터 검사 카탈로그를 활성화/설정 변경할 수 있습니다.", "CENTER_ASSESSMENT"),
    ("read:send_link", "바로링크 조회", "바로링크 발송이력을 조회할 수 있습니다.", "SEND_LINK"),
    ("write:send_link", "바로링크 발송", "바로링크를 발송/재전송할 수 있습니다.", "SEND_LINK"),
    ("write:form_template", "양식 템플릿 관리", "양식 템플릿을 생성/수정/삭제할 수 있습니다.", "FORM_TEMPLATE"),
    ("write:role", "역할 관리", "역할 및 권한을 관리할 수 있습니다.", "ROLE"),
    ("read:activity_log", "활동 로그 조회", "센터 활동 로그를 조회할 수 있습니다.", "ACTIVITY_LOG"),
    ("read:notice", "공지사항 조회", "공지사항을 조회할 수 있습니다.", "NOTICE"),
    ("write:notice", "공지사항 생성/수정", "공지사항을 생성하거나 수정할 수 있습니다.", "NOTICE"),
]

# 삭제할 permission (manage:* + 공통 조회로 전환된 read)
PERMISSIONS_TO_DELETE = [
    "manage:counseling", "manage:assessment", "manage:client",
    "manage:schedule", "manage:member", "manage:center",
    "manage:document", "manage:role", "manage:form",
    "read:member", "read:center",
]

# 역할별 최종 permission 목표 상태 (리네임 적용 후 코드 기준)
# config.py의 DEFAULT_ROLE_PERMISSIONS와 동일
TARGET_ROLE_PERMISSIONS = {
    "ADMIN": {
        "write:center", "write:program", "write:room",
        "write:member", "write:member_invitation",
        "write:center_assessment", "write:form_template",
        "write:role",
        "write:schedule", "write:client",
        "write:counseling", "write:counseling_note",
        "write:assessment_case", "write:send_link",
        "write:document", "write:form_instance", "write:notice",
        "read:member_invitation",
        "read:schedule", "read:client",
        "read:counseling", "read:counseling_note",
        "read:assessment_case", "read:send_link",
        "read:document", "read:form_instance", "read:notice",
        "delete:member", "delete:schedule", "delete:client",
        "delete:counseling", "delete:assessment_case",
        "delete:document", "delete:form_instance",
        "read:activity_log",
    },
    "MANAGER": {
        "write:center", "write:program", "write:room",
        "write:member", "write:member_invitation",
        "write:center_assessment", "write:form_template",
        "write:schedule", "write:client",
        "write:counseling", "write:counseling_note",
        "write:assessment_case", "write:send_link",
        "write:document", "write:form_instance", "write:notice",
        "read:member_invitation",
        "read:schedule", "read:client",
        "read:counseling", "read:counseling_note",
        "read:assessment_case", "read:send_link",
        "read:document", "read:form_instance", "read:notice",
        "delete:member", "delete:schedule", "delete:client",
        "delete:counseling", "delete:assessment_case",
        "delete:document", "delete:form_instance",
    },
    "STAFF": {
        "write:member",
        "write:schedule", "write:client", "write:send_link",
        "write:document", "write:form_instance",
        "read:schedule", "read:client",
        "read:counseling", "read:assessment_case", "read:send_link",
        "read:document", "read:form_instance",
        "read:notice",
        "delete:schedule",
    },
    "COUNSELOR": {
        "read:schedule", "read:client",
        "read:counseling", "read:counseling_note",
        "read:assessment_case", "read:send_link",
        "read:document", "read:form_instance",
        "read:notice",
        "write:member",
        "write:schedule", "write:client",
        "write:counseling", "write:counseling_note",
        "write:assessment_case", "write:send_link",
        "write:document", "write:form_instance",
        "delete:schedule", "delete:counseling",
        "delete:assessment_case", "delete:document",
    },
}


def upgrade() -> None:
    conn = op.get_bind()

    # ── 1. Schema: roles.access_level 컬럼 추가 ──
    op.add_column(
        "roles",
        sa.Column("access_level", sa.String(20), nullable=False, server_default="own"),
    )

    # ── 2. 기존 역할에 access_level 설정 ──
    for role_code, level in ROLE_ACCESS_LEVELS.items():
        conn.execute(
            text("UPDATE roles SET access_level = :level WHERE code = :code"),
            {"level": level, "code": role_code},
        )

    # ── 3. permission 코드 리네임 ──
    for old_code, new_code in PERMISSION_RENAMES.items():
        conn.execute(
            text("UPDATE permissions SET code = :new_code WHERE code = :old_code"),
            {"old_code": old_code, "new_code": new_code},
        )

    # ── 4. 새 permission 레코드 추가 ──
    for code, name, desc, category in NEW_PERMISSIONS:
        exists = conn.execute(
            text("SELECT id FROM permissions WHERE code = :code"),
            {"code": code},
        ).fetchone()
        if exists:
            continue
        conn.execute(
            text("""
                INSERT INTO permissions (id, code, name, description, category, is_new, added_at, created_at, updated_at)
                VALUES (nextval('permissions_id_seq'), :code, :name, :desc, :category, false, now(), now(), now())
            """),
            {"code": code, "name": name, "desc": desc, "category": category},
        )

    # ── 5. permission code → id 매핑 조회 ──
    rows = conn.execute(text("SELECT id, code FROM permissions")).fetchall()
    perm_code_to_id = {row[1]: row[0] for row in rows}

    # ── 6. role_permissions 동기화 (global + center-specific 모두) ──
    for role_code, target_perms in TARGET_ROLE_PERMISSIONS.items():
        # 해당 code의 모든 role (global + center별)
        role_rows = conn.execute(
            text("SELECT id FROM roles WHERE code = :code"),
            {"code": role_code},
        ).fetchall()

        for (role_id,) in role_rows:
            # 현재 role_permissions 조회
            current_rows = conn.execute(
                text("""
                    SELECT p.code, rp.permission_id
                    FROM role_permissions rp
                    JOIN permissions p ON p.id = rp.permission_id
                    WHERE rp.role_id = :role_id
                """),
                {"role_id": role_id},
            ).fetchall()
            current_perms = {row[0] for row in current_rows}

            # 추가해야 할 permission
            to_add = target_perms - current_perms
            for perm_code in to_add:
                perm_id = perm_code_to_id.get(perm_code)
                if not perm_id:
                    continue
                conn.execute(
                    text("""
                        INSERT INTO role_permissions (id, role_id, permission_id, created_at, updated_at)
                        VALUES (gen_random_uuid()::text, :role_id, :perm_id, now(), now())
                    """),
                    {"role_id": role_id, "perm_id": perm_id},
                )

            # 삭제해야 할 permission (manage:*, read:member, read:center 등)
            to_remove = current_perms - target_perms
            for perm_code in to_remove:
                perm_id = perm_code_to_id.get(perm_code)
                if not perm_id:
                    continue
                conn.execute(
                    text("DELETE FROM role_permissions WHERE role_id = :role_id AND permission_id = :perm_id"),
                    {"role_id": role_id, "perm_id": perm_id},
                )

    # ── 7. 불필요한 permission 레코드 삭제 ──
    for perm_code in PERMISSIONS_TO_DELETE:
        perm_row = conn.execute(
            text("SELECT id FROM permissions WHERE code = :code"),
            {"code": perm_code},
        ).fetchone()
        if not perm_row:
            continue
        perm_id = perm_row[0]
        # 혹시 남은 role_permissions도 정리
        conn.execute(
            text("DELETE FROM role_permissions WHERE permission_id = :perm_id"),
            {"perm_id": perm_id},
        )
        conn.execute(
            text("DELETE FROM permissions WHERE id = :perm_id"),
            {"perm_id": perm_id},
        )

    # ── 8. 시퀀스 정합성 ──
    conn.execute(
        text("SELECT setval('permissions_id_seq', COALESCE((SELECT MAX(id) FROM permissions), 1))")
    )


def downgrade() -> None:
    """Downgrade — schema 롤백만 (데이터 복원은 seed 재실행)"""
    op.drop_column("roles", "access_level")
