"""타임라인 테스트용 검사 대량 생성 스크립트

기존 시드 데이터(scripts/cast.py의 배역 — 마인드스코프 아동심리상담센터)를 재사용하여
30일 과거 ~ 30일 미래 범위의 다양한 검사를 생성합니다.

Usage: cd apps/api && uv run python -m scripts.seed_timeline
"""
import asyncio
import random
from datetime import datetime, timedelta

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.modules.client.models import Client
from app.modules.examination.common.models import Examination
from app.modules.institution.models import Institution
from app.modules.member.models import Member

from scripts import cast


INSTITUTION_NAME = cast.INSTITUTION_NAME
RNG_SEED = 42


def business_time(rng: random.Random, base: datetime) -> datetime:
    """base 날짜의 09:00~18:00 사이 임의 시각."""
    hour = rng.randint(9, 17)
    minute = rng.choice([0, 15, 30, 45])
    return base.replace(hour=hour, minute=minute, second=0, microsecond=0)


async def seed_timeline():
    rng = random.Random(RNG_SEED)
    now = datetime.now().replace(microsecond=0)

    async with AsyncSessionLocal() as session:
        inst_res = await session.execute(
            select(Institution).where(Institution.name == INSTITUTION_NAME)
        )
        institution = inst_res.scalar_one_or_none()
        if institution is None:
            print(
                f"기관 '{INSTITUTION_NAME}'을 찾을 수 없습니다. 먼저 `uv run python -m scripts.seed`를 실행하세요."
            )
            return

        member_res = await session.execute(
            select(Member).where(
                Member.institution_id == institution.id,
                Member.role == "clinician",
            )
        )
        clinician = member_res.scalars().first()
        if clinician is None:
            print("clinician 멤버를 찾을 수 없습니다.")
            return

        client_res = await session.execute(
            select(Client).where(Client.institution_id == institution.id)
        )
        clients = list(client_res.scalars().all())
        if not clients:
            print("내담자가 없습니다.")
            return

        existing_count_res = await session.execute(
            select(Examination).where(Examination.examiner_id == clinician.id)
        )
        existing_count = len(list(existing_count_res.scalars().all()))
        if existing_count >= 60:
            print(
                f"이미 검사가 {existing_count}건 있습니다. 부풀리지 않기 위해 종료합니다."
            )
            return

        exams: list[Examination] = []
        exam_types = ["htp", "rorschach", "sct"]

        def make(
            *,
            client: Client,
            exam_type: str,
            status: str,
            scheduled_at: datetime | None = None,
            started_at: datetime | None = None,
            completed_at: datetime | None = None,
            created_at: datetime | None = None,
        ) -> Examination:
            exam = Examination(
                institution_id=institution.id,
                client_id=client.id,
                examiner_id=clinician.id,
                exam_type=exam_type,
                status=status,
                scheduled_at=scheduled_at,
                started_at=started_at,
                completed_at=completed_at,
            )
            if created_at is not None:
                exam.created_at = created_at
            return exam

        # === 1) 과거 완료 검사 (지난 30일, 평일 위주) ===
        for d in range(1, 31):
            day_count = rng.choices([0, 1, 2, 3], weights=[2, 4, 3, 1])[0]
            for _ in range(day_count):
                base = (now - timedelta(days=d)).replace(
                    hour=0, minute=0, second=0, microsecond=0
                )
                started = business_time(rng, base)
                duration = timedelta(minutes=rng.choice([30, 45, 60, 75, 90]))
                completed = started + duration
                status = rng.choices(
                    ["completed", "confirmed", "report_generated"],
                    weights=[6, 2, 2],
                )[0]
                exams.append(
                    make(
                        client=rng.choice(clients),
                        exam_type=rng.choice(exam_types),
                        status=status,
                        scheduled_at=started,
                        started_at=started,
                        completed_at=completed,
                        created_at=started - timedelta(days=rng.randint(1, 3)),
                    )
                )

        # === 2) 지금 진행중 / AI 분석중 (몇 분 전 시작) ===
        for _ in range(2):
            started = now - timedelta(minutes=rng.randint(5, 25))
            exams.append(
                make(
                    client=rng.choice(clients),
                    exam_type=rng.choice(exam_types),
                    status="in_progress",
                    scheduled_at=started,
                    started_at=started,
                )
            )
        for _ in range(2):
            started = now - timedelta(minutes=rng.randint(2, 15))
            exams.append(
                make(
                    client=rng.choice(clients),
                    exam_type=rng.choice(exam_types),
                    status="ai_analyzing",
                    scheduled_at=started,
                    started_at=started,
                )
            )

        # === 3) 트레이 (시간 미지정 검토 대기) ===
        for _ in range(4):
            started = now - timedelta(hours=rng.randint(2, 30))
            exams.append(
                make(
                    client=rng.choice(clients),
                    exam_type=rng.choice(exam_types),
                    status="ai_draft_ready",
                    started_at=started,
                    completed_at=started + timedelta(minutes=45),
                    created_at=started - timedelta(minutes=10),
                )
            )
        for _ in range(3):
            started = now - timedelta(days=rng.randint(2, 6))
            exams.append(
                make(
                    client=rng.choice(clients),
                    exam_type=rng.choice(exam_types),
                    status="under_review",
                    started_at=started,
                    completed_at=started + timedelta(minutes=60),
                    created_at=started - timedelta(minutes=10),
                )
            )

        # === 4) 미래 예정 (오늘 후반 ~ 30일 후) ===
        # 4-1) 오늘 남은 시간대
        if now.hour < 17:
            for _ in range(rng.randint(2, 3)):
                hour = rng.randint(now.hour + 1, 18)
                minute = rng.choice([0, 15, 30, 45])
                sched = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
                if sched <= now:
                    continue
                exams.append(
                    make(
                        client=rng.choice(clients),
                        exam_type=rng.choice(exam_types),
                        status="created",
                        scheduled_at=sched,
                        created_at=now - timedelta(days=rng.randint(1, 5)),
                    )
                )

        # 4-2) 임박한 30분 내 (중심 후보)
        sched = now + timedelta(minutes=rng.randint(8, 28))
        exams.append(
            make(
                client=rng.choice(clients),
                exam_type=rng.choice(exam_types),
                status="created",
                scheduled_at=sched,
                created_at=now - timedelta(days=2),
            )
        )

        # 4-3) 다음 30일 (평일 위주)
        for d in range(1, 31):
            day_count = rng.choices([0, 1, 2], weights=[3, 4, 2])[0]
            for _ in range(day_count):
                base = (now + timedelta(days=d)).replace(
                    hour=0, minute=0, second=0, microsecond=0
                )
                sched = business_time(rng, base)
                exams.append(
                    make(
                        client=rng.choice(clients),
                        exam_type=rng.choice(exam_types),
                        status="created",
                        scheduled_at=sched,
                        created_at=now - timedelta(days=rng.randint(1, 5)),
                    )
                )

        # 5) 같은 시간대 겹침 테스트 (트랙 패킹 확인용)
        overlap_base = now + timedelta(days=2)
        overlap_base = overlap_base.replace(hour=10, minute=0, second=0, microsecond=0)
        for offset_min in (0, 15, 30):
            exams.append(
                make(
                    client=rng.choice(clients),
                    exam_type=rng.choice(exam_types),
                    status="created",
                    scheduled_at=overlap_base + timedelta(minutes=offset_min),
                    created_at=now - timedelta(days=1),
                )
            )

        session.add_all(exams)
        await session.commit()

        # 통계
        by_status: dict[str, int] = {}
        for e in exams:
            by_status[e.status] = by_status.get(e.status, 0) + 1

        print("=== 타임라인 테스트 검사 생성 완료 ===")
        print(f"총 {len(exams)}건 추가 (담당: {clinician.name})")
        for status, count in sorted(by_status.items(), key=lambda kv: -kv[1]):
            print(f"  {status:18s}: {count}건")
        print()
        print(f"로그인: {cast.CLINICIAN['email']} / {cast.PASSWORD} → /dashboard")


if __name__ == "__main__":
    asyncio.run(seed_timeline())
