"""add read permissions for center management resources

센터 관리 리소스(center, program, room, member, role, center_assessment, form_template)에
read 권한을 추가하고, 모든 역할에 기본 할당합니다.

- Data: 7개 read permission 레코드 추가
- Data: 모든 역할(global + center-specific)에 read 권한 매핑 추가

Revision ID: a1b2c3d4e5f6
Revises: 3becd412c584
Create Date: 2026-03-11 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '3becd412c584'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# 추가할 read permission (code, name, description, category)
NEW_READ_PERMISSIONS = [
    ("read:center", "센터 조회", "센터 정보를 조회할 수 있습니다.", "CENTER"),
    ("read:program", "프로그램 조회", "프로그램 목록을 조회할 수 있습니다.", "PROGRAM"),
    ("read:room", "장소 조회", "장소(상담실) 목록을 조회할 수 있습니다.", "ROOM"),
    ("read:member", "구성원 조회", "구성원 목록 및 상세 정보를 조회할 수 있습니다.", "MEMBER"),
    ("read:role", "역할 조회", "역할 목록 및 상세 정보를 조회할 수 있습니다.", "ROLE"),
    ("read:center_assessment", "센터 검사 조회", "센터 검사 카탈로그를 조회할 수 있습니다.", "CENTER_ASSESSMENT"),
    ("read:form_template", "양식 템플릿 조회", "양식 템플릿 목록을 조회할 수 있습니다.", "FORM_TEMPLATE"),
]

# 모든 역할에 read 권한 부여 (기존에 공통 조회로 전부 접근 가능했으므로)
ROLES_TO_UPDATE = ["ADMIN", "MANAGER", "STAFF", "COUNSELOR"]


def upgrade() -> None:
    conn = op.get_bind()

    # ── 1. 새 read permission 레코드 추가 ──
    for code, name, desc, category in NEW_READ_PERMISSIONS:
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

    # ── 2. permission code → id 매핑 조회 ──
    new_perm_codes = [p[0] for p in NEW_READ_PERMISSIONS]
    rows = conn.execute(
        text("SELECT id, code FROM permissions WHERE code = ANY(:codes)"),
        {"codes": new_perm_codes},
    ).fetchall()
    perm_code_to_id = {row[1]: row[0] for row in rows}

    # ── 3. 모든 역할(global + center-specific)에 read 권한 매핑 추가 ──
    for role_code in ROLES_TO_UPDATE:
        role_rows = conn.execute(
            text("SELECT id FROM roles WHERE code = :code"),
            {"code": role_code},
        ).fetchall()

        for (role_id,) in role_rows:
            for perm_code in new_perm_codes:
                perm_id = perm_code_to_id.get(perm_code)
                if not perm_id:
                    continue

                # 이미 매핑이 있으면 스킵
                exists = conn.execute(
                    text("""
                        SELECT 1 FROM role_permissions
                        WHERE role_id = :role_id AND permission_id = :perm_id
                    """),
                    {"role_id": role_id, "perm_id": perm_id},
                ).fetchone()
                if exists:
                    continue

                conn.execute(
                    text("""
                        INSERT INTO role_permissions (id, role_id, permission_id, created_at, updated_at)
                        VALUES (gen_random_uuid()::text, :role_id, :perm_id, now(), now())
                    """),
                    {"role_id": role_id, "perm_id": perm_id},
                )

    # ── 4. 시퀀스 정합성 ──
    conn.execute(
        text("SELECT setval('permissions_id_seq', COALESCE((SELECT MAX(id) FROM permissions), 1))")
    )

    # ── 5. Role.version 증가 (프론트엔드 권한 캐시 무효화) ──
    conn.execute(
        text("""
            UPDATE roles
            SET version = version + 1, updated_at = now()
            WHERE code = ANY(:codes)
        """),
        {"codes": list(ROLES_TO_UPDATE)},
    )


def downgrade() -> None:
    """Downgrade — read 권한 및 매핑 제거"""
    conn = op.get_bind()

    perm_codes = [p[0] for p in NEW_READ_PERMISSIONS]

    for perm_code in perm_codes:
        perm_row = conn.execute(
            text("SELECT id FROM permissions WHERE code = :code"),
            {"code": perm_code},
        ).fetchone()
        if not perm_row:
            continue
        perm_id = perm_row[0]
        conn.execute(
            text("DELETE FROM role_permissions WHERE permission_id = :perm_id"),
            {"perm_id": perm_id},
        )
        conn.execute(
            text("DELETE FROM permissions WHERE id = :perm_id"),
            {"perm_id": perm_id},
        )
