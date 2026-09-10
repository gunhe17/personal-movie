"""add voucher permissions and backfill role mappings

바우처 도메인 권한(read/write/delete:voucher)을 기존 DB에 백필합니다.

- Data: 3개 voucher permission 레코드 추가 (이미 있으면 skip)
- Data: 모든 역할(global + center-specific)에 voucher 권한 매핑 추가
    - ADMIN, MANAGER → read/write/delete 전부
    - COUNSELOR → read만
- Role.version 증가 (프론트엔드 권한 캐시 무효화)

Revision ID: c3e7b1d9f4a2
Revises: b2d4f9a8c6e1
Create Date: 2026-05-20 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = 'c3e7b1d9f4a2'
down_revision: Union[str, Sequence[str], None] = 'b2d4f9a8c6e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# 추가할 voucher permission (code, name, description, category)
NEW_VOUCHER_PERMISSIONS = [
    (
        "read:voucher",
        "바우처 조회",
        "센터 취급 바우처 및 내담자 바우처를 조회할 수 있습니다.",
        "VOUCHER",
    ),
    (
        "write:voucher",
        "바우처 등록/수정",
        "센터 취급 바우처를 등록하거나 수정할 수 있습니다.",
        "VOUCHER",
    ),
    (
        "delete:voucher",
        "바우처 삭제",
        "센터 취급 바우처를 삭제(취소)할 수 있습니다.",
        "VOUCHER",
    ),
]

# 역할별 부여할 voucher 권한 매핑
ROLE_VOUCHER_PERMISSIONS = {
    "ADMIN": ["read:voucher", "write:voucher", "delete:voucher"],
    "MANAGER": ["read:voucher", "write:voucher", "delete:voucher"],
    "COUNSELOR": ["read:voucher"],
}


def upgrade() -> None:
    conn = op.get_bind()

    # ── 1. 새 voucher permission 레코드 추가 ──
    for code, name, desc, category in NEW_VOUCHER_PERMISSIONS:
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
    new_perm_codes = [p[0] for p in NEW_VOUCHER_PERMISSIONS]
    rows = conn.execute(
        text("SELECT id, code FROM permissions WHERE code = ANY(:codes)"),
        {"codes": new_perm_codes},
    ).fetchall()
    perm_code_to_id = {row[1]: row[0] for row in rows}

    # ── 3. 역할별로 매핑 추가 (global + center-specific 모두) ──
    for role_code, perm_codes in ROLE_VOUCHER_PERMISSIONS.items():
        role_rows = conn.execute(
            text("SELECT id FROM roles WHERE code = :code"),
            {"code": role_code},
        ).fetchall()

        for (role_id,) in role_rows:
            for perm_code in perm_codes:
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
        {"codes": list(ROLE_VOUCHER_PERMISSIONS.keys())},
    )


def downgrade() -> None:
    """Downgrade — voucher 권한 및 매핑 제거"""
    conn = op.get_bind()

    perm_codes = [p[0] for p in NEW_VOUCHER_PERMISSIONS]

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
