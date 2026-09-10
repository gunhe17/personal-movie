"""기존 검사들의 상태를 다양화하는 스크립트

타임라인의 기본 뷰(현재 시각 ± 며칠)에 다양한 상태가 노출되도록
created 상태인 검사 일부를 다른 상태로 업데이트합니다.

Usage: cd apps/api && uv run python -m scripts.seed_status_diversity
"""
import asyncio
import random
from datetime import datetime, timedelta

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.modules.examination.common.models import Examination
from app.modules.institution.models import Institution
from app.modules.member.models import Member


from scripts import cast

INSTITUTION_NAME = cast.INSTITUTION_NAME
RNG_SEED = 7


async def seed_diversity():
    rng = random.Random(RNG_SEED)
    now = datetime.now().replace(microsecond=0)

    async with AsyncSessionLocal() as session:
        inst_res = await session.execute(
            select(Institution).where(Institution.name == INSTITUTION_NAME)
        )
        institution = inst_res.scalar_one_or_none()
        if institution is None:
            print(f"기관 '{INSTITUTION_NAME}' 없음. 먼저 seed.py 실행.")
            return

        member_res = await session.execute(
            select(Member).where(
                Member.institution_id == institution.id,
                Member.role == "clinician",
            )
        )
        clinician = member_res.scalars().first()
        if clinician is None:
            print("clinician 멤버 없음.")
            return

        # 가까운 미래의 created 검사들 (가시 범위)
        upper = now + timedelta(days=7)
        exam_res = await session.execute(
            select(Examination)
            .where(
                Examination.examiner_id == clinician.id,
                Examination.status == "created",
                Examination.scheduled_at >= now,
                Examination.scheduled_at <= upper,
            )
            .order_by(Examination.scheduled_at)
        )
        candidates = list(exam_res.scalars().all())

        if len(candidates) < 8:
            # 가까운 과거의 created 검사도 후보에 포함
            past_res = await session.execute(
                select(Examination)
                .where(
                    Examination.examiner_id == clinician.id,
                    Examination.status == "created",
                    Examination.scheduled_at >= now - timedelta(days=2),
                    Examination.scheduled_at < now,
                )
            )
            candidates.extend(past_res.scalars().all())

        if not candidates:
            print("업데이트할 created 검사 후보가 없습니다.")
            return

        rng.shuffle(candidates)

        # 분배 계획 (가용 후보 수만큼만 적용)
        plan = [
            ("in_progress", 2),
            ("ai_analyzing", 2),
            ("confirmed", 2),
            ("report_generated", 2),
            ("completed", 2),
            ("ai_draft_ready", 2),
            ("under_review", 2),
        ]

        applied: dict[str, int] = {}
        idx = 0
        for status, count in plan:
            for _ in range(count):
                if idx >= len(candidates):
                    break
                exam = candidates[idx]
                idx += 1
                _apply_status(exam, status, now, rng)
                applied[status] = applied.get(status, 0) + 1
            if idx >= len(candidates):
                break

        await session.commit()

        print("=== 상태 다양화 업데이트 완료 ===")
        print(f"업데이트된 검사: {sum(applied.values())}건 (담당: {clinician.name})")
        for status, count in applied.items():
            print(f"  {status:18s}: {count}건")
        print()
        print(f"미적용 후보: {len(candidates) - idx}건은 created 상태 유지")


def _apply_status(
    exam: Examination, status: str, now: datetime, rng: random.Random
) -> None:
    """status에 맞게 exam의 시간 필드를 갱신."""
    exam.status = status

    if status == "in_progress":
        # 방금 시작
        started = now - timedelta(minutes=rng.randint(5, 25))
        exam.scheduled_at = started
        exam.started_at = started
        exam.completed_at = None

    elif status == "ai_analyzing":
        # 막 끝나서 AI 분석중
        started = now - timedelta(minutes=rng.randint(15, 45))
        exam.scheduled_at = started
        exam.started_at = started
        exam.completed_at = None

    elif status == "ai_draft_ready":
        # 검토 트레이로 — 시간 모호. 최근 완료된 것
        started = now - timedelta(hours=rng.randint(2, 18))
        exam.scheduled_at = started
        exam.started_at = started
        exam.completed_at = started + timedelta(minutes=45)
        exam.created_at = started - timedelta(minutes=10)

    elif status == "under_review":
        # 검토중 — 며칠 경과
        started = now - timedelta(days=rng.randint(1, 4))
        exam.scheduled_at = started
        exam.started_at = started
        exam.completed_at = started + timedelta(minutes=60)
        exam.created_at = started - timedelta(minutes=10)

    elif status == "confirmed":
        # 최근 확인 완료
        started = now - timedelta(hours=rng.randint(2, 24))
        duration = timedelta(minutes=rng.choice([45, 60, 75]))
        exam.scheduled_at = started
        exam.started_at = started
        exam.completed_at = started + duration

    elif status == "report_generated":
        started = now - timedelta(days=rng.randint(1, 3))
        duration = timedelta(minutes=rng.choice([45, 60, 75]))
        exam.scheduled_at = started
        exam.started_at = started
        exam.completed_at = started + duration

    elif status == "completed":
        started = now - timedelta(days=rng.randint(1, 5))
        duration = timedelta(minutes=rng.choice([30, 45, 60, 90]))
        exam.scheduled_at = started
        exam.started_at = started
        exam.completed_at = started + duration


if __name__ == "__main__":
    asyncio.run(seed_diversity())
