"""계정(Account) + Person 픽스처."""
from datetime import date

from sqlalchemy import select

from app.infrastructure.hash.factory import get_password_hasher
from app.modules.auth.account.models import Account
from app.modules.person.person.models import Person

from scripts.seed.develop import DEFAULT_PASSWORD, gen_id

ACCOUNTS = [
    {
        "key": "admin",
        "email": "admin@mindscope.com",
        "name": "김원장",
        "phone": "010-9000-0001",
        "gender": "female",
        "birth": date(1975, 3, 15),
        "role_code": "ADMIN",
        "employment_type": "FULLTIME",
    },
    {
        "key": "manager",
        "email": "manager@mindscope.com",
        "name": "이사무",
        "phone": "010-9000-0002",
        "gender": "male",
        "birth": date(1982, 7, 20),
        "role_code": "MANAGER",
        "employment_type": "FULLTIME",
    },
    {
        "key": "staff",
        "email": "staff@mindscope.com",
        "name": "박접수",
        "phone": "010-9000-0003",
        "gender": "female",
        "birth": date(1995, 11, 5),
        "role_code": "STAFF",
        "employment_type": "CONTRACT",
    },
    {
        "key": "counselor1",
        "email": "counselor1@mindscope.com",
        "name": "정상담",
        "phone": "010-9000-0004",
        "gender": "female",
        "birth": date(1988, 1, 12),
        "role_code": "COUNSELOR",
        "employment_type": "FULLTIME",
    },
    {
        "key": "counselor2",
        "email": "counselor2@mindscope.com",
        "name": "최치료",
        "phone": "010-9000-0005",
        "gender": "male",
        "birth": date(1990, 6, 30),
        "role_code": "COUNSELOR",
        "employment_type": "FREELANCER",
    },
]


async def seed_accounts(session) -> dict[str, tuple[str, str]]:
    """계정 + Person 생성. Returns: {key: (account_id, person_id)}"""
    print("\n👤 계정/Person 생성 중...")
    result = {}

    hashed_pw = get_password_hasher().hash(value=DEFAULT_PASSWORD)

    for acc in ACCOUNTS:
        # 이메일 중복 확인
        existing = await session.execute(
            select(Account).where(Account.email == acc["email"])
        )
        if existing.scalar_one_or_none():
            # 이미 존재하면 조회
            existing_acc = (await session.execute(
                select(Account).where(Account.email == acc["email"])
            )).scalar_one()
            existing_person = (await session.execute(
                select(Person).where(Person.account_id == existing_acc.id)
            )).scalar_one()
            result[acc["key"]] = (existing_acc.id, existing_person.id)
            print(f"  ⏭️  {acc['name']} ({acc['email']}) 이미 존재")
            continue

        account_id = gen_id()
        person_id = gen_id()

        account = Account(
            id=account_id,
            email=acc["email"],
            password=hashed_pw,
            provider="email",
            is_active=True,
            is_verified=True,
            token_version=0,
        )
        session.add(account)

        person = Person(
            id=person_id,
            account_id=account_id,
            name=acc["name"],
            phone=acc["phone"],
            birth=acc.get("birth"),
            gender=acc.get("gender"),
        )
        session.add(person)

        result[acc["key"]] = (account_id, person_id)
        print(f"  ✅ {acc['name']} ({acc['email']})")

    await session.flush()
    return result
