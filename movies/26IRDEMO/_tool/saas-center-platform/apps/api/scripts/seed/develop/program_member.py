"""프로그램 담당 상담사(ProgramMember) 픽스처."""
from sqlalchemy import select

from app.modules.center.program_member.models import ProgramMember

from scripts.seed.develop import gen_id

# 프로그램명 → 담당 멤버 key
ASSIGNMENTS = {
    "개인상담": ["counselor1"],
    "놀이치료": ["counselor1", "counselor2"],
}


async def seed_program_members(
    session, center_id: str, programs: dict[str, str], members: dict[str, str]
) -> None:
    print("\n🧑‍🏫 프로그램 담당 상담사 배정 중...")

    for program_name, member_keys in ASSIGNMENTS.items():
        program_id = programs.get(program_name)
        if not program_id:
            print(f"  ⚠️  프로그램 '{program_name}' 없음 - 스킵")
            continue

        for key in member_keys:
            member_id = members.get(key)
            if not member_id:
                continue
            dup = (await session.execute(
                select(ProgramMember).where(
                    ProgramMember.program_id == program_id,
                    ProgramMember.member_id == member_id,
                    ProgramMember.deleted_at.is_(None),
                )
            )).scalars().first()
            if dup:
                print(f"  ⏭️  {program_name} ← {key} 이미 배정")
                continue
            session.add(ProgramMember(
                id=gen_id(),
                center_id=center_id,
                program_id=program_id,
                member_id=member_id,
            ))
            print(f"  ✅ {program_name} ← {key}")

    await session.flush()
