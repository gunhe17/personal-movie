"""로르샤하 관계 역전 — Response가 주인, Region은 0..N개

docs/로르샤하-프로세스-재설계.md §4-1.

예전 구조는 Response가 Region에 매달려 있었다(region_id: unique NOT NULL).
그래서 자유반응 단계에서 영역을 억지로 그리게 만들었고, 아날로그 절차
(자유반응 전체 → 질문 전체)를 표현할 수 없었다. 실 DB가 증거다 —
inquiry_text 0건인데 confirmed 56건.

또한 영역 0개인 반응(거부·미완성)을 표현할 수 없어 미완성 프로토콜이
완성된 것처럼 구조요약을 냈다. R은 거의 모든 비율의 분모다.

**데이터 보존이 이 마이그레이션의 핵심이다.** 실 DB에 진짜 검사 기록이
있다(§8 — "스타크래프트의 가디언이..." 같은 응답). 세 갈래를 모두 옮긴다:

  1. response가 있는 region  → response에 session_id/card_no를 채우고 관계를 뒤집는다
  2. response가 없는 region  → 반응을 새로 만들어 붙인다(75건). 그리지 않으면
                              그 영역들이 어디에도 안 달린 고아가 된다.
  3. card_administration      → 반응이 있는 카드를 responded로 채운다. 없으면
                              모든 카드가 pending이라 기존 검사가 전부 게이트에 막힌다.

Revision ID: r3v3rs31
Revises: d40p1nterp01
Create Date: 2026-08-20
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "r3v3rs31"
down_revision: Union[str, None] = "d40p1nterp01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. 새 테이블 ────────────────────────────────────────────
    op.create_table(
        "rorschach_card_administrations",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("session_id", sa.String(length=36), nullable=False),
        sa.Column("card_no", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("presented_at", sa.DateTime(timezone=False), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=False), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=False), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=False), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=False), nullable=True),
    )
    op.create_index("ix_rorschach_card_admin_session", "rorschach_card_administrations",
                    ["session_id"])
    op.create_index("ix_rorschach_card_admin_card", "rorschach_card_administrations",
                    ["card_no"])

    op.create_table(
        "rorschach_interventions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("session_id", sa.String(length=36), nullable=False),
        sa.Column("response_id", sa.String(length=36), nullable=True),
        sa.Column("card_no", sa.Integer(), nullable=False),
        sa.Column("phase", sa.String(length=30), nullable=False,
                  server_default="free_association"),
        sa.Column("kind", sa.String(length=20), nullable=False, server_default="prompt"),
        sa.Column("text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=False), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=False), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=False), nullable=True),
    )
    op.create_index("ix_rorschach_interv_session", "rorschach_interventions", ["session_id"])
    op.create_index("ix_rorschach_interv_response", "rorschach_interventions", ["response_id"])
    op.create_index("ix_rorschach_interv_card", "rorschach_interventions", ["card_no"])

    # ── 2. Response에 새 컬럼 (일단 nullable — 데이터를 채운 뒤 조인다) ──
    op.add_column("rorschach_responses",
                  sa.Column("session_id", sa.String(length=36), nullable=True))
    op.add_column("rorschach_responses",
                  sa.Column("card_no", sa.Integer(), nullable=True))
    op.add_column("rorschach_responses",
                  sa.Column("phase", sa.String(length=30), nullable=False,
                            server_default="free_association"))
    op.add_column("rorschach_responses",
                  sa.Column("is_formal", sa.Boolean(), nullable=False,
                            server_default=sa.true()))
    op.add_column("rorschach_responses",
                  sa.Column("free_association_stt_raw", sa.Text(), nullable=True))
    op.add_column("rorschach_responses",
                  sa.Column("inquiry_stt_raw", sa.Text(), nullable=True))
    op.add_column("rorschach_responses",
                  sa.Column("stt_edited", sa.Boolean(), nullable=False,
                            server_default=sa.false()))
    op.add_column("rorschach_responses",
                  sa.Column("card_orientation", sa.String(length=10), nullable=True))
    op.add_column("rorschach_responses",
                  sa.Column("first_utterance_at", sa.DateTime(timezone=False), nullable=True))
    op.add_column("rorschach_responses",
                  sa.Column("latency_source", sa.String(length=20), nullable=True))

    # ── 3. Region에 새 컬럼 ─────────────────────────────────────
    op.add_column("rorschach_regions",
                  sa.Column("response_id", sa.String(length=36), nullable=True))
    op.add_column("rorschach_regions",
                  sa.Column("area_match_score", sa.Float(), nullable=True))
    op.add_column("rorschach_regions",
                  sa.Column("drawn_orientation", sa.String(length=10), nullable=True))
    op.create_index("ix_rorschach_regions_response", "rorschach_regions", ["response_id"])

    # ── 4. 데이터 이관 ──────────────────────────────────────────
    # (1) response가 있는 region — 관계를 뒤집는다.
    #     session_id/card_no를 region에서 response로 옮기고, region은 반대로 response를 가리킨다.
    op.execute("""
        UPDATE rorschach_responses r
        SET session_id = g.session_id,
            card_no    = g.card_no
        FROM rorschach_regions g
        WHERE g.id = r.region_id
    """)
    op.execute("""
        UPDATE rorschach_regions g
        SET response_id = r.id
        FROM rorschach_responses r
        WHERE r.region_id = g.id
    """)

    # (2) response가 없는 region(고아 75건) — 반응을 만들어 붙인다.
    #     그냥 두면 어디에도 안 달린 조각이 되어 위치도에서 사라진다.
    #     response_no는 카드 내 label 순서를 따른다(실 DB에서 label과
    #     response_no가 완전히 일치함을 확인했다).
    op.execute("""
        INSERT INTO rorschach_responses
            (id, session_id, card_no, response_no, phase, is_formal,
             region_id, stt_edited, created_at, updated_at)
        SELECT
            gen_random_uuid()::text,
            g.session_id,
            g.card_no,
            ROW_NUMBER() OVER (PARTITION BY g.session_id, g.card_no ORDER BY g.label, g.id),
            'free_association',
            true,
            g.id,
            false,
            now(),
            now()
        FROM rorschach_regions g
        WHERE g.response_id IS NULL
    """)
    op.execute("""
        UPDATE rorschach_regions g
        SET response_id = r.id
        FROM rorschach_responses r
        WHERE r.region_id = g.id AND g.response_id IS NULL
    """)

    # (3) 카드 실시 기록 — 반응이 있는 카드를 responded로 채운다.
    #     이걸 안 하면 기존 검사 전부가 "미표시 카드 있음"으로 게이트에 막힌다.
    #
    # ⚠️ 카드 하나당 한 행이어야 한다(반응 하나당이 아니라).
    #    `SELECT DISTINCT gen_random_uuid(), ...`는 절대 중복을 못 지운다 —
    #    uuid가 행마다 달라 모든 행이 서로 distinct해지기 때문이다.
    #    그래서 GROUP BY로 (session, card)를 먼저 접고 uuid는 그 뒤에 붙인다.
    op.execute("""
        INSERT INTO rorschach_card_administrations
            (id, session_id, card_no, status, created_at, updated_at)
        SELECT gen_random_uuid()::text, s.session_id, s.card_no, 'responded', now(), now()
        FROM (
            SELECT session_id, card_no
            FROM rorschach_responses
            WHERE session_id IS NOT NULL
            GROUP BY session_id, card_no
        ) s
    """)

    # ── 5. 제약 조이기 ──────────────────────────────────────────
    # 여기까지 왔으면 모든 response가 session_id/card_no를 갖는다.
    op.alter_column("rorschach_responses", "session_id", nullable=False)
    op.alter_column("rorschach_responses", "card_no", nullable=False)
    op.create_index("ix_rorschach_responses_session", "rorschach_responses", ["session_id"])
    op.create_index("ix_rorschach_responses_card", "rorschach_responses", ["card_no"])

    # region_id는 이제 쓰지 않는다 — 관계가 반대 방향이다.
    # 되돌릴 수 있도록 컬럼은 남기되 unique만 푼다(반응 하나에 조각 N개가
    # 붙어야 하는데 unique가 남아 있으면 그 자체가 불가능하다).
    #
    # ⚠️ 이건 table constraint가 아니라 **unique index**다
    #    (모델이 `unique=True, index=True`로 선언해 SQLAlchemy가 인덱스로 만든다).
    #    drop_constraint로는 안 떨어진다 — 실제 스키마를 보고 확인했다.
    op.drop_index("ix_rorschach_responses_region_id", "rorschach_responses")
    op.create_index("ix_rorschach_responses_region_id", "rorschach_responses", ["region_id"])
    op.alter_column("rorschach_responses", "region_id", nullable=True)

    # Region.card_no 삭제 — 정본은 Response.card_no다(§4-5).
    # 남겨두면 한 반응의 카드번호와 그 조각의 카드번호가 달라질 수 있다.
    op.drop_column("rorschach_regions", "card_no")


def downgrade() -> None:
    op.add_column("rorschach_regions", sa.Column("card_no", sa.Integer(), nullable=True))
    op.execute("""
        UPDATE rorschach_regions g
        SET card_no = r.card_no
        FROM rorschach_responses r
        WHERE r.id = g.response_id
    """)
    # 반응만 있고 조각이 없던 것들은 되돌릴 자리가 없다 — 그 반응은 사라진다.
    op.execute("DELETE FROM rorschach_responses WHERE region_id IS NULL")
    op.alter_column("rorschach_regions", "card_no", nullable=False)
    op.alter_column("rorschach_responses", "region_id", nullable=False)
    op.create_unique_constraint("rorschach_responses_region_id_key", "rorschach_responses",
                                ["region_id"])

    op.drop_index("ix_rorschach_responses_card", "rorschach_responses")
    op.drop_index("ix_rorschach_responses_session", "rorschach_responses")
    op.drop_index("ix_rorschach_regions_response", "rorschach_regions")
    op.drop_column("rorschach_regions", "drawn_orientation")
    op.drop_column("rorschach_regions", "area_match_score")
    op.drop_column("rorschach_regions", "response_id")

    for col in (
        "latency_source", "first_utterance_at", "card_orientation", "stt_edited",
        "inquiry_stt_raw", "free_association_stt_raw", "is_formal", "phase",
        "card_no", "session_id",
    ):
        op.drop_column("rorschach_responses", col)

    op.drop_table("rorschach_interventions")
    op.drop_table("rorschach_card_administrations")
