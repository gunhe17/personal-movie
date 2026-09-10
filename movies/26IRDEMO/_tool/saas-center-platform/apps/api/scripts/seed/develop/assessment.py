"""검사 케이스/회기(Assessment*) + 검사 일정 픽스처 (agent query 실험용)."""
from datetime import timedelta

from sqlalchemy import select

from app.modules.schedule.schedule.models import Schedule
from app.modules.assessment.assessment_case.models import AssessmentCase
from app.modules.assessment.assessment_case_participant.models import (
    AssessmentCaseParticipant,
)
from app.modules.assessment.assessment.models import Assessment
from app.modules.assessment.assessment_session.models import AssessmentSession
from app.modules.assessment.assessment_session_participant.models import (
    AssessmentSessionParticipant,
)
from app.modules.assessment.assessment_task.models import AssessmentTask

from scripts.seed.develop import gen_id, utc_now

CASE_CODE = "AC0001"

# 케이스에 걸린 검사 종목 (code, 상태, 실시방법)
TASKS = [
    ("MMPI_2", "completed", "onsite"),
    ("SCT", "in_progress", "onsite"),
    ("HTP", "pending", "onsite"),
]

# (오늘 기준 일수 오프셋, 상태) — 지난주 완료 1 + 이번주/다음주 예정 2
SESSIONS = [(-7, "attended"), (1, "scheduled"), (8, "scheduled")]


async def seed_assessment_data(
    session,
    center_id: str,
    members: dict[str, str],
    client_map: dict[str, str],
    room_id: str,
):
    print("\n🧪 검사 케이스/회기 생성 중...")

    counselor_id = members["counselor1"]
    now = utc_now()

    case = (
        await session.execute(
            select(AssessmentCase).where(
                AssessmentCase.center_id == center_id,
                AssessmentCase.case_code == CASE_CODE,
                AssessmentCase.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()

    if case:
        case_id = case.id
        print(f"  ⏭️  검사 케이스 {CASE_CODE} 이미 존재")
    else:
        case_id = gen_id()
        session.add(
            AssessmentCase(
                id=case_id,
                center_id=center_id,
                case_code=CASE_CODE,
                counselor_id=counselor_id,
                status="processing",
            )
        )
        await session.flush()
        print(f"  ✅ 검사 케이스 {CASE_CODE} 생성")

    participant = (
        await session.execute(
            select(AssessmentCaseParticipant).where(
                AssessmentCaseParticipant.case_id == case_id,
                AssessmentCaseParticipant.participant_type == "client",
                AssessmentCaseParticipant.unassigned_at.is_(None),
                AssessmentCaseParticipant.deleted_at.is_(None),
            )
        )
    ).scalars().first()
    if not participant:
        session.add(
            AssessmentCaseParticipant(
                id=gen_id(),
                center_id=center_id,
                case_id=case_id,
                participant_type="client",
                participant_id=client_map["김영희"],
                assigned_at=now,
            )
        )

    existing_sessions = (
        await session.execute(
            select(AssessmentSession).where(
                AssessmentSession.case_id == case_id,
                AssessmentSession.deleted_at.is_(None),
            )
        )
    ).scalars().all()
    if existing_sessions:
        print(f"  ⏭️  검사 회기 {len(existing_sessions)}건 이미 존재")
        await _seed_tasks(session, center_id, case_id, existing_sessions[0].id)
        await session.flush()
        return

    client_id = client_map["김영희"]
    first_session_id = None

    for n, (day_offset, status) in enumerate(SESSIONS, start=1):
        start = (now + timedelta(days=day_offset)).replace(
            hour=14, minute=0, second=0, microsecond=0
        )
        schedule_id = gen_id()
        session.add(
            Schedule(
                id=schedule_id,
                center_id=center_id,
                member_id=counselor_id,
                schedule_type="assessment",
                room_id=room_id,
                title=f"{CASE_CODE} - {n}회기",
                start=start,
                end=start + timedelta(minutes=60),
            )
        )
        session_id = gen_id()
        session.add(
            AssessmentSession(
                id=session_id,
                center_id=center_id,
                case_id=case_id,
                schedule_id=schedule_id,
                status=status,
            )
        )
        if first_session_id is None:
            first_session_id = session_id

        for participant_id, participant_type in (
            (counselor_id, "assistant"),
            (client_id, "client"),
        ):
            session.add(
                AssessmentSessionParticipant(
                    id=gen_id(),
                    center_id=center_id,
                    session_id=session_id,
                    participant_id=participant_id,
                    participant_type=participant_type,
                    attendance_status=status,
                    attended_at=start if status == "attended" else None,
                )
            )

    await _seed_tasks(session, center_id, case_id, first_session_id)

    await session.flush()
    print(f"  ✅ {CASE_CODE}: 검사 회기 {len(SESSIONS)}건(완료 1·예정 2) + 수검자/검사자 참여 + 일정 연결")


async def _seed_tasks(session, center_id: str, case_id: str, session_id: str | None):
    """케이스에 실시할 검사 종목(AssessmentTask) 생성 (case_id+assessment_id 자연키)."""
    for code, status, execution_method in TASKS:
        assessment = (
            await session.execute(
                select(Assessment).where(
                    Assessment.code == code, Assessment.deleted_at.is_(None)
                )
            )
        ).scalars().first()
        if not assessment:
            print(f"  ⚠️  검사 '{code}' 카탈로그 없음 - 스킵")
            continue

        dup = (
            await session.execute(
                select(AssessmentTask).where(
                    AssessmentTask.case_id == case_id,
                    AssessmentTask.assessment_id == assessment.id,
                    AssessmentTask.deleted_at.is_(None),
                )
            )
        ).scalars().first()
        if dup:
            print(f"  ⏭️  검사 종목 {code} 이미 존재")
            continue

        session.add(
            AssessmentTask(
                id=gen_id(),
                center_id=center_id,
                case_id=case_id,
                assessment_id=assessment.id,
                session_id=session_id if status == "completed" else None,
                status=status,
                execution_method=execution_method,
                completed_at=utc_now() if status == "completed" else None,
                is_report_visible_to_guardian=status == "completed",
                process={},
            )
        )
        print(f"  ✅ 검사 종목 {code} ({status})")
