"""내담자 관계(ClientRelation, SiblingRelation) 픽스처."""
from sqlalchemy import select

from app.modules.client.client_relation.models import ClientRelation
from app.modules.client.sibling_relation.models import SiblingRelation

from scripts.seed.develop import gen_id

# 보호자-아동 관계 (양방향 자동 생성)
GUARDIAN_RELATIONS = [
    # (아동 key, 보호자 key, relation_detail, is_primary)
    ("김민준", "김영희", "mother", True),
    ("김민준", "김철수", "father", False),
    ("김서연", "김영희", "mother", True),
    ("김서연", "김철수", "father", False),
    ("이하준", "이수진", "mother", True),
]

# 형제 관계 (양방향 자동 생성)
SIBLING_RELATIONS = [
    # (client_key, sibling_key, detail_A→B, detail_B→A)
    ("김민준", "김서연", "younger_sister", "older_brother"),
]


async def seed_relations(session, center_id: str, client_map: dict[str, str]):
    """보호자-아동 관계 + 형제 관계 생성"""
    print("\n🔗 관계 생성 중...")

    # 보호자-아동 관계
    for child_key, guardian_key, detail, is_primary in GUARDIAN_RELATIONS:
        child_id = client_map.get(child_key)
        guardian_id = client_map.get(guardian_key)
        if not child_id or not guardian_id:
            print(f"  ⚠️  {child_key}↔{guardian_key} 클라이언트 없음 - 스킵")
            continue

        # 중복 확인
        existing = await session.execute(
            select(ClientRelation).where(
                ClientRelation.center_id == center_id,
                ClientRelation.client_id == child_id,
                ClientRelation.related_client_id == guardian_id,
                ClientRelation.deleted_at.is_(None),
            )
        )
        if existing.scalar_one_or_none():
            print(f"  ⏭️  {child_key} → {guardian_key} (guardian) 이미 존재")
            continue

        # 양방향 생성: child→guardian + guardian→child
        session.add(ClientRelation(
            id=gen_id(),
            center_id=center_id,
            client_id=child_id,
            related_client_id=guardian_id,
            relation_type="guardian",
            relation_detail=detail,
            is_primary=is_primary,
        ))
        session.add(ClientRelation(
            id=gen_id(),
            center_id=center_id,
            client_id=guardian_id,
            related_client_id=child_id,
            relation_type="child",
            relation_detail=detail,
            is_primary=False,
        ))
        primary_mark = " (주양육자)" if is_primary else ""
        print(f"  ✅ {child_key} ↔ {guardian_key} [{detail}{primary_mark}]")

    # 형제 관계
    for client_key, sibling_key, detail_ab, detail_ba in SIBLING_RELATIONS:
        client_id = client_map.get(client_key)
        sibling_id = client_map.get(sibling_key)
        if not client_id or not sibling_id:
            print(f"  ⚠️  {client_key}↔{sibling_key} 클라이언트 없음 - 스킵")
            continue

        # 중복 확인
        existing = await session.execute(
            select(SiblingRelation).where(
                SiblingRelation.center_id == center_id,
                SiblingRelation.client_id == client_id,
                SiblingRelation.sibling_id == sibling_id,
                SiblingRelation.deleted_at.is_(None),
            )
        )
        if existing.scalar_one_or_none():
            print(f"  ⏭️  {client_key} ↔ {sibling_key} (sibling) 이미 존재")
            continue

        # 양방향 생성
        session.add(SiblingRelation(
            id=gen_id(),
            center_id=center_id,
            client_id=client_id,
            sibling_id=sibling_id,
            relation_detail=detail_ab,
        ))
        session.add(SiblingRelation(
            id=gen_id(),
            center_id=center_id,
            client_id=sibling_id,
            sibling_id=client_id,
            relation_detail=detail_ba,
        ))
        print(f"  ✅ {client_key} ↔ {sibling_key} [형제]")

    await session.flush()
