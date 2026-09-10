"""add billing permissions to all roles

Revision ID: b7d8e9f01234
Revises: f3c2f416b546
Create Date: 2026-03-18 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b7d8e9f01234'
down_revision: Union[str, Sequence[str], None] = 'f3c2f416b546'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# 추가할 billing 권한 정의
BILLING_PERMISSIONS = [
    {"code": "read:billing", "name": "청구 조회", "description": "청구 내역을 조회할 수 있습니다.", "category": "BILLING"},
    {"code": "write:billing", "name": "청구 생성/완료", "description": "청구를 생성하거나 완료 처리할 수 있습니다.", "category": "BILLING"},
    {"code": "delete:billing", "name": "청구 삭제", "description": "청구를 삭제할 수 있습니다.", "category": "BILLING"},
]

# 역할별 billing 권한 매핑
ROLE_BILLING_PERMISSIONS = {
    "ADMIN": ["read:billing", "write:billing", "delete:billing"],
    "MANAGER": ["read:billing", "write:billing", "delete:billing"],
    "COUNSELOR": ["read:billing", "write:billing"],
}


def upgrade() -> None:
    conn = op.get_bind()

    # 1. permissions 테이블에 billing 권한 추가 (없으면)
    for perm in BILLING_PERMISSIONS:
        exists = conn.execute(
            sa.text("SELECT id FROM permissions WHERE code = :code"),
            {"code": perm["code"]},
        ).scalar()

        if not exists:
            conn.execute(
                sa.text(
                    "INSERT INTO permissions (code, name, description, category, is_new, added_at) "
                    "VALUES (:code, :name, :description, :category, false, NOW())"
                ),
                perm,
            )

    # 2. 모든 역할(Global + 센터별)에 billing 권한 매핑 추가
    for role_code, perm_codes in ROLE_BILLING_PERMISSIONS.items():
        # 해당 code의 모든 Role 조회 (Global + 센터별)
        roles = conn.execute(
            sa.text("SELECT id FROM roles WHERE code = :code AND deleted_at IS NULL"),
            {"code": role_code},
        ).fetchall()

        for (role_id,) in roles:
            for perm_code in perm_codes:
                perm_id = conn.execute(
                    sa.text("SELECT id FROM permissions WHERE code = :code"),
                    {"code": perm_code},
                ).scalar()

                if not perm_id:
                    continue

                # 이미 매핑 존재 여부 확인
                exists = conn.execute(
                    sa.text(
                        "SELECT 1 FROM role_permissions "
                        "WHERE role_id = :role_id AND permission_id = :perm_id"
                    ),
                    {"role_id": role_id, "perm_id": perm_id},
                ).scalar()

                if not exists:
                    conn.execute(
                        sa.text(
                            "INSERT INTO role_permissions (id, role_id, permission_id) "
                            "VALUES (gen_random_uuid(), :role_id, :perm_id)"
                        ),
                        {"role_id": role_id, "perm_id": perm_id},
                    )

        # 3. 센터별 Role의 version 증가 (프론트 권한 캐시 무효화)
        conn.execute(
            sa.text(
                "UPDATE roles SET version = version + 1 "
                "WHERE code = :code AND center_id IS NOT NULL AND deleted_at IS NULL"
            ),
            {"code": role_code},
        )

    # 4. permissions 시퀀스 업데이트
    conn.execute(
        sa.text("SELECT setval('permissions_id_seq', COALESCE((SELECT MAX(id) FROM permissions), 1))")
    )


def downgrade() -> None:
    conn = op.get_bind()

    # billing 권한 매핑 제거
    for perm_code in ["read:billing", "write:billing", "delete:billing"]:
        perm_id = conn.execute(
            sa.text("SELECT id FROM permissions WHERE code = :code"),
            {"code": perm_code},
        ).scalar()

        if perm_id:
            conn.execute(
                sa.text("DELETE FROM role_permissions WHERE permission_id = :perm_id"),
                {"perm_id": perm_id},
            )

    # billing 권한 레코드 제거
    conn.execute(
        sa.text("DELETE FROM permissions WHERE code IN ('read:billing', 'write:billing', 'delete:billing')")
    )
