"""상담 케이스/세션/일지(Counseling*) + 스케줄 픽스처 (사례 분석 테스트용)."""
from datetime import timedelta

from sqlalchemy import select

from app.modules.schedule.schedule.models import Schedule
from app.modules.counseling.counseling_case.models import CounselingCase
from app.modules.counseling.counseling_case_participant.models import (
    CounselingCaseParticipant,
)
from app.modules.counseling.counseling_session.models import CounselingSession
from app.modules.counseling.counseling_session_participant.models import (
    CounselingSessionParticipant,
)
from app.modules.counseling.counseling_note.models import CounselingNote

from scripts.seed.develop import gen_id, utc_now


async def seed_counseling_data(
    session,
    center_id: str,
    members: dict[str, str],
    client_map: dict[str, str],
    programs: dict[str, str],
    room_id: str,
):
    """상담 케이스 + 세션(완료) + 상담일지 생성 (사례 분석 테스트용)."""
    print("\n📝 상담 케이스/세션/일지 생성 중...")

    counselor_id = members["counselor1"]
    now = utc_now()

    # ── 케이스 1: 박지우 (성인 우울/스트레스, 4회기 완료) ──
    case1_id = await _seed_case(
        session, center_id, counselor_id, programs["개인상담"],
        case_code="C00001",
        chief_complaint="직장 스트레스 및 우울감으로 일상생활 어려움 호소",
        total_sessions=10,
        client_key="박지우", client_map=client_map, room_id=room_id,
        notes_data=[
            {
                "session_number": 1,
                "days_ago": 28,
                "summary": "초기 면접. 직장 내 과도한 업무량과 상사와의 갈등으로 인한 우울감 호소. 수면 장애와 식욕 저하 동반.",
                "content": {
                    "mood": "우울, 불안",
                    "main_topic": "직장 스트레스, 상사와의 갈등",
                    "intervention": "경청 및 공감, 문제 탐색",
                    "progress": "문제 인식 단계. 자신의 감정을 표현하기 시작함",
                    "homework": "감정일기 작성 (하루 3회)",
                    "next_goal": "스트레스 상황에서의 자동적 사고 탐색",
                },
            },
            {
                "session_number": 2,
                "days_ago": 21,
                "summary": "감정일기 검토. '나는 무능하다'는 자동적 사고 패턴 발견. 인지 왜곡(과잉일반화, 독심술) 심리교육 실시.",
                "content": {
                    "mood": "우울하지만 약간 안정됨",
                    "main_topic": "자동적 사고 패턴, 인지 왜곡",
                    "intervention": "CBT 심리교육, 사고기록지 소개",
                    "progress": "자동적 사고를 인식하기 시작. 감정일기 성실히 작성함",
                    "homework": "사고기록지 작성 (스트레스 상황 3건 이상)",
                    "next_goal": "대안적 사고 연습",
                },
            },
            {
                "session_number": 3,
                "days_ago": 14,
                "summary": "사고기록지 분석. 대안적 사고 연습 진행. 상사와의 갈등 상황을 재구조화하여 감정 강도 감소 보고.",
                "content": {
                    "mood": "보통, 간헐적 불안",
                    "main_topic": "인지 재구조화, 대안적 사고",
                    "intervention": "CBT 인지 재구조화, 역할극",
                    "progress": "대안적 사고를 시도하며 감정 조절 향상. 수면 개선 보고",
                    "homework": "일상에서 대안적 사고 적용 (최소 1일 1회)",
                    "next_goal": "행동 활성화 계획 수립",
                },
            },
            {
                "session_number": 4,
                "days_ago": 7,
                "summary": "행동 활성화 기법 도입. 즐거운 활동 목록 작성. 주 3회 운동 시작. 전반적 기분 개선 보고.",
                "content": {
                    "mood": "양호, 에너지 회복 중",
                    "main_topic": "행동 활성화, 즐거운 활동 재개",
                    "intervention": "행동 활성화, 활동 스케줄링",
                    "progress": "능동적으로 활동 계획 수립. 우울 증상 경감. 직장 적응도 향상",
                    "homework": "활동 기록표 작성, 주 3회 운동 유지",
                    "next_goal": "대인관계 기술 향상, 자기주장 훈련",
                },
            },
        ],
    )

    # ── 케이스 2: 이하준 (아동 학교적응, 3회기 완료) ──
    case2_id = await _seed_case(
        session, center_id, counselor_id, programs["놀이치료"],
        case_code="C00002",
        chief_complaint="학교에서 친구들과 어울리지 못하고 혼자 있는 시간이 많음. 교사로부터 또래관계 어려움 보고",
        total_sessions=8,
        client_key="이하준", client_map=client_map, room_id=room_id,
        notes_data=[
            {
                "session_number": 1,
                "days_ago": 21,
                "summary": "초기 면접. 놀이 관찰 통해 위축된 행동 패턴 확인. 또래 거부 경험에 대한 불안 표현.",
                "content": {
                    "mood": "위축, 경계",
                    "main_topic": "또래관계 어려움, 사회적 위축",
                    "intervention": "자유놀이 관찰, 라포 형성",
                    "progress": "치료사와 기본적 신뢰 형성. 놀이에서 점차 자기표현 시작",
                    "homework": "좋아하는 놀이 그림 그려오기",
                    "next_goal": "감정 인식 및 표현 연습",
                },
            },
            {
                "session_number": 2,
                "days_ago": 14,
                "summary": "감정카드 활용한 감정 인식 놀이. 분노와 슬픔 구분 가능. 학교에서 친구가 놀려서 화났던 경험 표현.",
                "content": {
                    "mood": "조금 편안해짐",
                    "main_topic": "감정 인식, 또래 갈등 경험",
                    "intervention": "감정카드 놀이, 감정 명명",
                    "progress": "기본 감정 4가지 인식 가능. 자신의 경험을 언어로 표현하기 시작",
                    "homework": "감정 스티커 일기 (매일 감정 하나 고르기)",
                    "next_goal": "사회기술 훈련 시작",
                },
            },
            {
                "session_number": 3,
                "days_ago": 7,
                "summary": "역할놀이를 통한 사회기술 연습. 인사하기, 함께 놀자고 말하기 연습. 모의 상황에서 적절한 반응 보임.",
                "content": {
                    "mood": "밝아짐, 적극적",
                    "main_topic": "사회기술 훈련, 또래 접근 방법",
                    "intervention": "역할놀이, 모델링, 사회기술 훈련",
                    "progress": "역할놀이에서 자신감 있게 참여. 학교에서 친구에게 먼저 말 건 경험 보고 (보호자)",
                    "homework": "학교에서 친구에게 하루 1번 인사하기",
                    "next_goal": "또래 갈등 해결 기술",
                },
            },
        ],
    )

    await _backfill_schedule_titles(session, center_id)

    await session.flush()
    print(f"\n  📊 케이스 2건 생성 완료:")
    print(f"    - C00001 박지우: 개인상담 4회기 (우울/스트레스)")
    print(f"    - C00002 이하준: 놀이치료 3회기 (또래관계)")


async def _backfill_schedule_titles(session, center_id: str):
    """title 빈 상담 일정을 연결 세션에서 유도해 '{case_code} - {n}회기'로 백필 (멱등)."""
    rows = (
        await session.execute(
            select(Schedule, CounselingSession.session_number, CounselingCase.case_code)
            .join(CounselingSession, CounselingSession.schedule_id == Schedule.id)
            .join(CounselingCase, CounselingCase.id == CounselingSession.counseling_case_id)
            .where(
                Schedule.center_id == center_id,
                Schedule.deleted_at.is_(None),
                CounselingSession.deleted_at.is_(None),
                (Schedule.title.is_(None)) | (Schedule.title == ""),
            )
        )
    ).all()
    for schedule, session_number, case_code in rows:
        schedule.title = f"{case_code} - {session_number}회기"
    if rows:
        print(f"  🔧 상담 일정 title 백필: {len(rows)}건")


async def _seed_case(
    session,
    center_id: str,
    counselor_id: str,
    program_id: str,
    case_code: str,
    chief_complaint: str,
    total_sessions: int,
    client_key: str,
    client_map: dict[str, str],
    room_id: str,
    notes_data: list[dict],
) -> str:
    """단일 케이스 + 세션 + 일지를 생성."""

    # 중복 확인
    existing = await session.execute(
        select(CounselingCase).where(
            CounselingCase.center_id == center_id,
            CounselingCase.case_code == case_code,
            CounselingCase.deleted_at.is_(None),
        )
    )
    if existing.scalar_one_or_none():
        print(f"  ⏭️  케이스 {case_code} 이미 존재")
        return ""

    client_id = client_map[client_key]
    now = utc_now()
    case_id = gen_id()

    case = CounselingCase(
        id=case_id,
        center_id=center_id,
        program_id=program_id,
        counselor_id=counselor_id,
        case_code=case_code,
        chief_complaint=chief_complaint,
        total_sessions=total_sessions,
        status="active",
    )
    session.add(case)
    await session.flush()

    # 케이스 참여자 생성 (상담사 1 + 내담자 1)
    # 누락 시 상세 조회 핸들러가 "No active counselor found"로 404를 반환한다.
    session.add(
        CounselingCaseParticipant(
            id=gen_id(),
            center_id=center_id,
            counseling_case_id=case_id,
            participant_id=counselor_id,
            participant_type="counselor",
            is_active=True,
            joined_at=now,
            created_at=now,
        )
    )
    session.add(
        CounselingCaseParticipant(
            id=gen_id(),
            center_id=center_id,
            counseling_case_id=case_id,
            participant_id=client_id,
            participant_type="client",
            is_active=True,
            joined_at=now,
            created_at=now,
        )
    )
    await session.flush()

    for note_data in notes_data:
        days_ago = note_data["days_ago"]
        session_time = now - timedelta(days=days_ago)
        session_start = session_time.replace(hour=10, minute=0, second=0, microsecond=0)
        session_end = session_start + timedelta(minutes=50)

        # 스케줄 생성
        schedule_id = gen_id()
        schedule = Schedule(
            id=schedule_id,
            center_id=center_id,
            member_id=counselor_id,
            schedule_type="counseling",
            room_id=room_id,
            title=f"{case_code} - {note_data['session_number']}회기",
            start=session_start,
            end=session_end,
        )
        session.add(schedule)

        # 세션 생성 (완료 상태)
        cs_id = gen_id()
        cs = CounselingSession(
            id=cs_id,
            center_id=center_id,
            counseling_case_id=case_id,
            schedule_id=schedule_id,
            session_number=note_data["session_number"],
            status="completed",
            completed_at=session_end,
            created_at=session_start,
            updated_at=session_end,
        )
        session.add(cs)

        # 회기 참여자 (상담사 + 내담자) — 출석 화면·회기 차감·청구 근거가 이 행을 본다
        for participant_id, participant_type in (
            (counselor_id, "counselor"),
            (client_id, "client"),
        ):
            session.add(
                CounselingSessionParticipant(
                    id=gen_id(),
                    center_id=center_id,
                    session_id=cs_id,
                    participant_id=participant_id,
                    participant_type=participant_type,
                    attendance_status="attended",
                    attended_at=session_start,
                    is_consumed=True,
                )
            )

        # 상담일지 생성
        note = CounselingNote(
            id=gen_id(),
            center_id=center_id,
            counseling_session_id=cs_id,
            client_id=client_id,
            content=note_data["content"],
            summary=note_data["summary"],
            author_id=counselor_id,
        )
        session.add(note)

    await session.flush()
    print(f"  ✅ {case_code} ({client_key}): {len(notes_data)}회기 완료")
    return case_id
