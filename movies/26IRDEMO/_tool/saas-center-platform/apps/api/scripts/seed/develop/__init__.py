"""develop 시드 — common 베이스라인 + 개발 픽스처(가짜 계정/센터/내담자/상담).

각 step 파일 이름은 데이터가 생성되는 (서브)모듈이다. 픽스처는 강결합이라
한 트랜잭션 안에서 컨텍스트(center_id·accounts·role_map·client_map·programs·room_id)를
엮어 순서대로 실행한다. step 파일들은 아래 공유 헬퍼를 import 한다.

일괄 실행: uv run python -m scripts.seed.develop
"""
import secrets
from datetime import datetime, timezone
from uuid import uuid4

from app.infrastructure.persistence.database import AsyncSessionLocal

# ==================== 공유 헬퍼/상수 (step 파일들이 import) ====================
DEFAULT_PASSWORD = "test1234"
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def gen_id() -> str:
    return str(uuid4())


def gen_code(length: int = 6) -> str:
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(length))


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def seed_fixtures() -> None:
    """개발 픽스처만 생성 (common 선행 가정). 단일 트랜잭션, 컨텍스트 threading."""
    from scripts.seed.develop import (
        account, center, center_assessment, role, member,
        client, relation, subscription, credit, room, program, counseling,
        assessment, field_note,
        operating_time, working_time, program_member, voucher, price_list, billing,
    )

    print("=" * 70)
    print("개발용 통합 시드 데이터 생성")
    print("=" * 70)

    async with AsyncSessionLocal() as session:
        try:
            accounts = await account.seed_accounts(session)
            center_id = await center.seed_center(session)
            await center_assessment.seed_center_assessments(session, center_id)
            role_map = await role.seed_center_roles(session, center_id)
            members = await member.seed_members(session, center_id, accounts, role_map)
            client_map = await client.seed_clients(session, center_id)
            await relation.seed_relations(session, center_id, client_map)
            await subscription.seed_subscription_pro(session, center_id)
            await credit.seed_credit_balance(session, center_id)
            room_id = await room.seed_room(session, center_id)
            programs = await program.seed_programs(session, center_id)
            await operating_time.seed_operating_times(session, center_id, accounts)
            await working_time.seed_member_working_times(session, center_id, members)
            await program_member.seed_program_members(
                session, center_id, programs, members,
            )
            await counseling.seed_counseling_data(
                session, center_id, members, client_map, programs, room_id,
            )
            await assessment.seed_assessment_data(
                session, center_id, members, client_map, room_id,
            )
            await field_note.seed_field_notes(session, center_id, members)
            client_vouchers = await voucher.seed_vouchers(
                session, center_id, accounts, client_map,
            )
            price_lists = await price_list.seed_price_lists(
                session, center_id, accounts, programs,
            )
            await billing.seed_billing(
                session, center_id, accounts, client_map, programs,
                price_lists, client_vouchers,
            )
            await session.commit()
            _print_summary()
        except Exception as e:
            print(f"\n❌ 오류 발생: {e}")
            import traceback
            traceback.print_exc()
            await session.rollback()
            raise


async def main() -> None:
    # common 베이스라인(Role/Permission/Assessment/FormTemplate ...) 먼저, 이후 픽스처
    from scripts.seed import common
    from scripts.seed.common import form

    await common.main()
    await seed_fixtures()

    # 센터 소유 데모 양식은 센터가 있어야 붙는다 — common 단계에선 아직 없어 건너뛴다.
    # 픽스처가 센터를 만든 뒤 한 번 더 태워야 빈 DB 한 번의 실행으로 완결된다(멱등).
    print("🔄 센터 데모 양식 (센터 생성 후) ...")
    async with AsyncSessionLocal() as session:
        await form.seed_center_form_templates(session)


def _print_summary() -> None:
    from scripts.seed.develop.account import ACCOUNTS
    from scripts.seed.develop.center import CENTER_DATA
    from scripts.seed.develop.client import CLIENTS
    from scripts.seed.develop.relation import GUARDIAN_RELATIONS, SIBLING_RELATIONS

    print("\n" + "=" * 70)
    print("✅ 개발용 시드 데이터 생성 완료!")
    print("=" * 70)
    print(f"\n📌 로그인 정보 (공통 비밀번호: {DEFAULT_PASSWORD})")
    for acc in ACCOUNTS:
        print(f"  - {acc['email']:25s} → {acc['role_code']:10s} ({acc['name']})")
    print(f"\n📌 센터: {CENTER_DATA['name']}")
    print(
        f"📌 내담자 {len(CLIENTS)}명, 보호자-아동 관계 {len(GUARDIAN_RELATIONS)}쌍, "
        f"형제 관계 {len(SIBLING_RELATIONS)}쌍"
    )
    print("=" * 70)
