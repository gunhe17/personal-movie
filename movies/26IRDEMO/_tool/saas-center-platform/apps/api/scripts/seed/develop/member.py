"""멤버(Member) 픽스처."""
from sqlalchemy import select

from app.modules.center.member.models import Member
from app.modules.center.member.services.assign_member_color import COLOR_PALETTE

from scripts.seed.develop import gen_id
from scripts.seed.develop.account import ACCOUNTS


async def seed_members(
    session,
    center_id: str,
    accounts: dict[str, tuple[str, str]],
    role_map: dict[str, str],
) -> dict[str, str]:
    """멤버 생성. Returns: {key: member_id}"""
    print("\n👥 멤버 생성 중...")
    result = {}

    used_colors = (await session.execute(
        select(Member.color).where(
            Member.center_id == center_id,
            Member.deleted_at.is_(None),
            Member.color.isnot(None),
        )
    )).scalars().all()
    usage = {c: 0 for c in COLOR_PALETTE}
    for c in used_colors:
        if c in usage:
            usage[c] += 1

    def next_color() -> str:
        color = min(COLOR_PALETTE, key=lambda c: usage[c])
        usage[color] += 1
        return color

    for acc in ACCOUNTS:
        key = acc["key"]
        account_id, person_id = accounts[key]
        role_id = role_map.get(acc["role_code"])
        if not role_id:
            print(f"  ⚠️  역할 '{acc['role_code']}' 없음 - 스킵")
            continue

        # 중복 확인
        existing = await session.execute(
            select(Member).where(
                Member.center_id == center_id,
                Member.person_id == person_id,
                Member.deleted_at.is_(None),
            )
        )
        if existing.scalar_one_or_none():
            member = (await session.execute(
                select(Member).where(
                    Member.center_id == center_id,
                    Member.person_id == person_id,
                    Member.deleted_at.is_(None),
                )
            )).scalar_one()
            if member.color is None:
                member.color = next_color()
                print(f"  🎨 {acc['name']} 색상 백필 → {member.color}")
            result[key] = member.id
            print(f"  ⏭️  {acc['name']} ({acc['role_code']}) 이미 존재")
            continue

        member_id = gen_id()
        member = Member(
            id=member_id,
            center_id=center_id,
            person_id=person_id,
            role_id=role_id,
            employment_type=acc["employment_type"],
            color=next_color(),
        )
        session.add(member)
        result[key] = member_id
        print(f"  ✅ {acc['name']} → {acc['role_code']}")

    await session.flush()
    return result
