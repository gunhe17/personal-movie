"""필드노트(FieldNote) 픽스처 — 상담 일정 연결 포함."""
from sqlalchemy import func, select

from app.modules.field_note.field_note.models import FieldNote
from app.modules.schedule.schedule.models import Schedule

from scripts.seed.develop import gen_id

LINK_TARGET = 5  # schedule 연결 필드노트 최소 확보 수 (백필 상한)

NOTES = [
    "직장 스트레스 상황에서의 자동적 사고를 다룸. 감정일기 과제 점검.",
    "또래관계 역할놀이 진행. 인사하기 연습에 적극 참여함.",
    "행동 활성화 계획 수립. 주 3회 운동 시작 합의.",
]


async def seed_field_notes(
    session,
    center_id: str,
    members: dict[str, str],
):
    print("\n🎙️ 필드노트 생성/일정 연결 중...")

    author_id = members["counselor1"]

    schedules = (
        await session.execute(
            select(Schedule)
            .where(
                Schedule.center_id == center_id,
                Schedule.schedule_type == "counseling",
                Schedule.deleted_at.is_(None),
            )
            .order_by(Schedule.start)
        )
    ).scalars().all()
    if not schedules:
        print("  ⏭️  상담 일정 없음 — 스킵")
        return

    # idx_field_note_schedule: 살아있는 노트 기준 schedule당 1개 — 미사용 일정만 배정
    used_schedule_ids = set(
        (
            await session.execute(
                select(FieldNote.schedule_id).where(
                    FieldNote.schedule_id.is_not(None),
                    FieldNote.deleted_at.is_(None),
                )
            )
        ).scalars().all()
    )
    available = [s.id for s in schedules if s.id not in used_schedule_ids]

    # 백필: 미연결 기존 노트를 상담 일정에 연결 (센터 내 연결 노트 LINK_TARGET건까지)
    linked = (
        await session.execute(
            select(func.count())
            .select_from(FieldNote)
            .where(
                FieldNote.center_id == center_id,
                FieldNote.deleted_at.is_(None),
                FieldNote.schedule_id.is_not(None),
            )
        )
    ).scalar()
    need = max(0, LINK_TARGET - linked)
    if need:
        unlinked = (
            await session.execute(
                select(FieldNote)
                .where(
                    FieldNote.center_id == center_id,
                    FieldNote.deleted_at.is_(None),
                    FieldNote.schedule_id.is_(None),
                )
                .order_by(FieldNote.created_at)
                .limit(need)
            )
        ).scalars().all()
        backfilled = 0
        for note in unlinked:
            if not available:
                break
            note.schedule_id = available.pop(0)
            backfilled += 1
        if backfilled:
            print(f"  🔧 기존 필드노트 일정 연결 백필: {backfilled}건")

    # 신규 생성: summary 자연키 멱등 — 처음부터 상담 일정에 연결해 생성
    existing_summaries = set(
        (
            await session.execute(
                select(FieldNote.summary).where(
                    FieldNote.center_id == center_id,
                    FieldNote.deleted_at.is_(None),
                    FieldNote.summary.is_not(None),
                )
            )
        ).scalars().all()
    )
    created = 0
    for summary in NOTES:
        if summary in existing_summaries:
            continue
        if not available:
            print("  ⚠️  미사용 상담 일정 소진 — 신규 생성 중단")
            break
        session.add(
            FieldNote(
                id=gen_id(),
                center_id=center_id,
                schedule_id=available.pop(0),
                author_id=author_id,
                status="completed",
                total_duration=1800.0,
                processing_status="completed",
                transcribe_status="completed",
                summary=summary,
                summary_status="completed",
            )
        )
        created += 1

    await session.flush()
    if created:
        print(f"  ✅ 필드노트 {created}건 생성 (상담 일정 연결)")
    else:
        print("  ⏭️  필드노트 이미 존재")
