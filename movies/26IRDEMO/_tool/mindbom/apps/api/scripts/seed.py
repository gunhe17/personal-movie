"""시드 데이터 생성 스크립트 — 촬영용 공통 배역(scripts/cast.py)

Usage: cd apps/api && uv run python -m scripts.seed

자연키로 멱등하다. 다시 돌리면 사람은 그대로 두고(=id가 살아 있고) 검사의
시각만 지금 기준으로 새로 맞춘다 — 시간선 화면이 "지금"을 기준으로 그려지기 때문이다.
"""
import asyncio
from datetime import datetime, timedelta

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.modules.auth.account.models import Account
from app.modules.client.models import Client
from app.modules.examination.common.models import Examination, ExaminationBattery
from app.modules.institution.models import Institution
from app.modules.member.models import Member

from scripts import cast

# 검사 픽스처. note의 `seed:<slug>`가 자연키다 — 이걸로 찾아 갱신하므로
# 재실행해도 검사 id가 바뀌지 않는다(마인드스코프 쪽 시드와 같은 원칙).
# 담당은 전원 정상담이다: clinician은 본인이 examiner인 검사만 보므로
# 나눠 놓으면 촬영 계정에 따라 화면이 빈다.
EXAM_SPECS = [
    # === 과거 (보고서까지 나간 것) ===
    {"slug": "past-rorschach", "client": "박지우", "exam_type": "rorschach", "status": "report_generated",
     "started": timedelta(hours=5), "completed": timedelta(hours=4, minutes=30)},
    {"slug": "past-htp", "client": "이하준", "exam_type": "htp", "status": "report_generated",
     "started": timedelta(hours=3, minutes=30), "completed": timedelta(hours=3)},
    {"slug": "past-sct", "client": "김영희", "exam_type": "sct", "status": "confirmed",
     "started": timedelta(hours=2, minutes=15), "completed": timedelta(hours=2)},

    # === 종합보고서용 배터리 (윤도현) ===
    # 내담자 화면의 '종합보고서 작성' 버튼은 **배터리 단위**로만 열린다
    # (clients/[id]/+page.svelte startBatteryReport): 같은 battery_id로 묶인
    # 확정 이후 검사가 2건 이상이어야 한다. 로샤 혼자로는 못 연다.
    #
    # 배역이 박지우 → 윤도현으로 옮겨졌다(2026-09-10). 영상의 검사 축이
    # s01(접수) → s02(로샤 실시) → s03(보고서) → s04(바로링크)로 **한 사람**으로 이어진다.
    # 배터리의 로샤는 s02가 실시하는 바로 그 검사(yun-rorschach)다 — 따로 두면
    # 한 아이에게 로샤가 둘이 되어 검사 현황이 어긋난다.
    # s02(검사 실시)가 다루는 바로 그 로샤. 촬영 순서는 s02 → s03이므로
    # **s02를 다시 찍을 때는 `_scripts/s02-reset.sh`로 created·반응 0으로 되돌린 뒤** 찍는다.
    # 시드의 기본 상태는 s03 기준(확정)이다 — s02 테이크는 이미 찍혀 있다.
    {"slug": "yun-rorschach", "client": "윤도현", "exam_type": "rorschach", "status": "confirmed",
     "started": timedelta(hours=5), "completed": timedelta(hours=4, minutes=30)},
    {"slug": "battery-htp", "client": "윤도현", "exam_type": "htp", "status": "confirmed",
     "started": timedelta(days=1, hours=6), "completed": timedelta(days=1, hours=5)},
    {"slug": "battery-sct", "client": "윤도현", "exam_type": "sct", "status": "confirmed",
     "started": timedelta(days=1, hours=4, minutes=30), "completed": timedelta(days=1, hours=4)},

    # === 지금 (진행중) — ai_analyzing은 쓰지 않는다: 상태가 아니라 작업이다(state_machine.py) ===
    {"slug": "now-htp", "client": "김민준", "exam_type": "htp", "status": "in_progress",
     "started": timedelta(minutes=20)},
    {"slug": "now-sct", "client": "박지우", "exam_type": "sct", "status": "in_progress",
     "started": timedelta(minutes=8)},

    # === 미래 (예정) ===
    {"slug": "next-htp", "client": "김서연", "exam_type": "htp", "status": "created",
     "scheduled": timedelta(minutes=25)},          # 30분 내 — 중앙 후보
    {"slug": "next-sct", "client": "이하준", "exam_type": "sct", "status": "created",
     "scheduled": timedelta(hours=1, minutes=30)},
    {"slug": "next-rorschach", "client": "김영희", "exam_type": "rorschach", "status": "created",
     "scheduled": timedelta(hours=3)},
    {"slug": "jang-rorschach", "client": "장서아", "exam_type": "rorschach", "status": "created",
     "scheduled": timedelta(hours=5)},
    {"slug": "hong-rorschach", "client": "홍시우", "exam_type": "rorschach", "status": "created",
     "scheduled": timedelta(hours=6)},
    {"slug": "next-sct-2", "client": "김민준", "exam_type": "sct", "status": "created",
     "scheduled": timedelta(hours=4, minutes=30)},

    # === 트레이 (시간 없음, 경과일로 색이 갈린다) ===
    {"slug": "tray-htp", "client": "박지우", "exam_type": "htp", "status": "ai_draft_ready",
     "started": timedelta(days=2, hours=4), "aged": timedelta(days=2, hours=4)},
    {"slug": "tray-rorschach", "client": "이하준", "exam_type": "rorschach", "status": "under_review",
     "started": timedelta(days=4), "aged": timedelta(days=4)},          # 4일 경과 — 빨강
    {"slug": "tray-htp-2", "client": "김서연", "exam_type": "htp", "status": "ai_draft_ready",
     "started": timedelta(hours=3), "aged": timedelta(hours=3)},        # 회색
]

# 검사 묶음 — note의 seed:<slug>가 자연키다(검사와 같은 원칙).
BATTERY = {
    "slug": "battery-yundohyun",
    "client": "윤도현",
    "name": "아동 종합 심리평가 배터리 (로르샤하 · HTP · SCT)",
    "exams": ["yun-rorschach", "battery-htp", "battery-sct"],
}


async def seed():
    now = datetime.now().replace(microsecond=0)

    async with AsyncSessionLocal() as session:
        # 1. 기관 — 이름이 자연키
        institution = (await session.execute(
            select(Institution).where(
                Institution.name == cast.INSTITUTION_NAME,
                Institution.deleted_at.is_(None),
            )
        )).scalars().first()
        if institution is None:
            institution = Institution(**cast.INSTITUTION)
            session.add(institution)
            await session.flush()
            print(f"기관 생성: {institution.name}")
        else:
            print(f"기관 재사용: {institution.name}")

        # 2. 계정 + 멤버 — 이메일이 자연키. 이름·역할·비밀번호는 배역표가 정본이라 덮는다
        #    (예전 시드로 만든 DB의 password123을 재실행만으로 통일시킨다)
        members: dict[str, Member] = {}
        for spec in cast.ACCOUNTS:
            account = (await session.execute(
                select(Account).where(Account.email == spec["email"])
            )).scalars().first()
            if account is None:
                account = Account(email=spec["email"], name=spec["name"],
                                  password_hash=get_password_hash(cast.PASSWORD))
                session.add(account)
                await session.flush()
            else:
                account.name = spec["name"]
                account.password_hash = get_password_hash(cast.PASSWORD)

            member = (await session.execute(
                select(Member).where(
                    Member.institution_id == institution.id,
                    Member.account_id == account.id,
                    Member.deleted_at.is_(None),
                )
            )).scalars().first()
            if member is None:
                member = Member(institution_id=institution.id, account_id=account.id,
                                name=spec["name"], role=spec["role"],
                                license_number=spec["license_number"])
                session.add(member)
                await session.flush()
            else:
                member.name, member.role = spec["name"], spec["role"]
                member.license_number = spec["license_number"]
            members[spec["key"]] = member
        print(f"계정·멤버 {len(members)}명")

        # 3. 내담자 — 기관 안에서 이름이 자연키
        clients: dict[str, Client] = {}
        for spec in cast.CLIENTS:
            client = (await session.execute(
                select(Client).where(
                    Client.institution_id == institution.id,
                    Client.name == spec["name"],
                    Client.deleted_at.is_(None),
                )
            )).scalars().first()
            if client is None:
                client = Client(institution_id=institution.id, **spec)
                session.add(client)
                await session.flush()
            clients[spec["name"]] = client
        print(f"내담자 {len(clients)}명")

        # 4. 검사 묶음 — 검사보다 먼저 만들어야 battery_id를 실을 수 있다
        battery_note = f"seed:{BATTERY['slug']}"
        battery = (await session.execute(
            select(ExaminationBattery).where(
                ExaminationBattery.institution_id == institution.id,
                ExaminationBattery.note == battery_note,
                ExaminationBattery.deleted_at.is_(None),
            )
        )).scalars().first()
        if battery is None:
            battery = ExaminationBattery(institution_id=institution.id, note=battery_note)
            session.add(battery)
        battery.client_id = clients[BATTERY["client"]].id
        battery.examiner_id = members[cast.CLINICIAN_KEY].id
        battery.name = BATTERY["name"]
        battery.status = "confirmed"
        await session.flush()

        # 5. 검사 — note의 seed:<slug>가 자연키. 재실행 시 시각만 지금 기준으로 다시 맞춘다
        examiner = members[cast.CLINICIAN_KEY]
        for spec in EXAM_SPECS:
            note = f"seed:{spec['slug']}"
            exam = (await session.execute(
                select(Examination).where(
                    Examination.institution_id == institution.id,
                    Examination.note == note,
                    Examination.deleted_at.is_(None),
                )
            )).scalars().first()
            if exam is None:
                exam = Examination(institution_id=institution.id, note=note)
                session.add(exam)
            exam.client_id = clients[spec["client"]].id
            exam.examiner_id = examiner.id
            exam.exam_type = spec["exam_type"]
            exam.status = spec["status"]
            exam.scheduled_at = now + spec["scheduled"] if "scheduled" in spec else None
            exam.started_at = now - spec["started"] if "started" in spec else None
            exam.completed_at = now - spec["completed"] if "completed" in spec else None
            if "aged" in spec:
                exam.created_at = now - spec["aged"]
            exam.battery_id = battery.id if spec["slug"] in BATTERY["exams"] else None
        print(f"검사 {len(EXAM_SPECS)}건 (담당 {examiner.name})")
        print(f"배터리 1건 · {BATTERY['name']} — {', '.join(BATTERY['exams'])}")

        await session.commit()

        print("\n=== 시드 완료 ===")
        print(f"기관: {institution.name}")
        print(f"로그인 (공통 비번 {cast.PASSWORD}):")
        for spec in cast.ACCOUNTS:
            mark = "  ← 검사 담당" if spec["key"] == cast.CLINICIAN_KEY else ""
            print(f"  {spec['email']:32} {spec['name']} · {spec['role']}{mark}")


if __name__ == "__main__":
    asyncio.run(seed())
