from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.schedule.facade import ScheduleFacade
from app.modules.counseling.facade import (
    CounselingSessionFacade,
    CounselingNoteFacade,
)
from app.modules.assessment.facade import (
    AssessmentCaseFacade,
    AssessmentSessionFacade,
    AssessmentTaskFacade,
)
from app.modules.client.facade import ClientFacade
from app.modules.field_note.facade import FieldNoteFacade
from .schemas import PrepSignalItem, PrepSignalType, PrepSignalsResponse

MAX_SIGNALS = 5


async def get_prep_signals_handler(
    center_id: str,
    schedule_id: str,
    member_id: str,
    uow: UnitOfWork,
) -> PrepSignalsResponse:
    schedule_facade = ScheduleFacade(uow)
    schedule = await schedule_facade.get_schedule(schedule_id, center_id)

    if schedule.schedule_type in ("meeting", "block"):
        return PrepSignalsResponse(schedule_id=schedule_id, signals=[])

    counseling_session_facade = CounselingSessionFacade(uow)
    assessment_session_facade = AssessmentSessionFacade(uow)

    counseling_sessions = await counseling_session_facade.get_sessions_by_schedule_ids(
        [schedule_id]
    )
    assessment_sessions = await assessment_session_facade.get_sessions_by_schedule_ids(
        [schedule_id]
    )

    all_sessions = counseling_sessions + assessment_sessions
    if not all_sessions:
        return PrepSignalsResponse(schedule_id=schedule_id, signals=[])

    session_info = all_sessions[0]
    case_id = session_info.case_id

    client_ids: list[str] = [
        p["participant_id"] for p in session_info.client_participants
    ]
    if not client_ids:
        return PrepSignalsResponse(schedule_id=schedule_id, signals=[])

    client_facade = ClientFacade(uow)
    client_map = await client_facade.get_clients_by_ids(client_ids)
    client_names = [client_map[cid].name for cid in client_ids if cid in client_map]
    client_label = client_names[0] if client_names else "내담자"

    signals: list[PrepSignalItem] = []

    if schedule.schedule_type == "counseling":
        await _compute_counseling_signals(
            signals,
            center_id,
            member_id,
            case_id,
            client_ids,
            client_label,
            counseling_session_facade,
            uow,
        )

    if schedule.schedule_type == "assessment":
        await _compute_assessment_signals(
            signals,
            center_id,
            case_id,
            client_ids,
            client_label,
            uow,
        )

    # 검사 결과 미확인 — counseling/assessment 공통
    await _check_unreviewed_assessment(
        signals,
        center_id,
        client_ids,
        client_label,
        uow,
    )

    # 출석 주의 내담자 — counseling 공통
    if schedule.schedule_type == "counseling":
        await _check_attendance_warning(
            signals,
            center_id,
            client_ids,
            client_names,
            counseling_session_facade,
        )

        # 필드노트 요약 — 이전 회기에 필드노트 요약이 있으면 표시
        await _check_field_note_summary(
            signals,
            center_id,
            member_id,
            case_id,
            counseling_session_facade,
            uow,
        )

        # 그룹 인원 변동 — 그룹 상담에서 참여 인원이 이전과 다르면 표시
        if len(client_ids) > 1:
            await _check_group_member_change(
                signals,
                center_id,
                member_id,
                case_id,
                client_ids,
                client_names,
                counseling_session_facade,
            )

    signals.sort(key=lambda s: s.priority)
    return PrepSignalsResponse(
        schedule_id=schedule_id,
        signals=signals[:MAX_SIGNALS],
    )


async def _compute_counseling_signals(
    signals: list[PrepSignalItem],
    center_id: str,
    member_id: str,
    case_id: str | None,
    client_ids: list[str],
    client_label: str,
    session_facade: CounselingSessionFacade,
    uow: UnitOfWork,
) -> None:
    note_facade = CounselingNoteFacade(uow)

    # 완료 회기 (여러 신호에서 공유)
    completed = await session_facade.list_completed_sessions_by_counselor(
        center_id,
        member_id,
    )
    completed_for_case = sorted(
        [s for s in completed if s.counseling_case_id == case_id],
        key=lambda s: s.completed_at or s.created_at,
        reverse=True,
    )

    # 미작성 일지 (priority 1) — find_unlogged_*는 그룹 부분작성을 놓치므로,
    # 완료 회기 전체에서 (session × client) 단위로 노트 존재 여부를 비교한다.
    if completed_for_case:
        completed_session_ids = [s.id for s in completed_for_case]
        existing_notes = await note_facade.list_notes_by_sessions(
            completed_session_ids,
            center_id,
        )
        noted_pairs = {
            (getattr(n, "counseling_session_id", None), getattr(n, "client_id", None))
            for n in existing_notes
        }

        all_participants = await session_facade.get_participants_by_session_ids(
            completed_session_ids,
        )
        client_participants = [
            p for p in all_participants if p.participant_type == "client"
        ]

        missing_count = sum(
            1
            for p in client_participants
            if (p.session_id, p.participant_id) not in noted_pairs
        )

        if missing_count > 0:
            signals.append(
                PrepSignalItem(
                    signal_type=PrepSignalType.UNWRITTEN_JOURNALS,
                    priority=1,
                    label=f"미작성 일지 {missing_count}건",
                    description=f"{client_label}님의 이전 상담 일지를 작성해 주세요",
                    metadata={"count": missing_count},
                )
            )

    # 첫 만남 (priority 2)
    is_first_meeting = len(completed_for_case) == 0
    if is_first_meeting:
        signals.append(
            PrepSignalItem(
                signal_type=PrepSignalType.FIRST_MEETING,
                priority=2,
                label="첫 만남",
                description=f"{client_label}님과 처음 만나요",
            )
        )
    elif completed_for_case:
        # 이전 상담 노트 요약 (priority 4)
        latest = completed_for_case[0]
        notes = await note_facade.list_notes_by_sessions(
            [latest.id],
            center_id,
        )
        # 그룹: summary가 있는 노트 중 첫 번째 사용
        summaries = [
            getattr(n, "summary", None) for n in notes if getattr(n, "summary", None)
        ]
        if summaries:
            signals.append(
                PrepSignalItem(
                    signal_type=PrepSignalType.PREVIOUS_NOTE_SUMMARY,
                    priority=4,
                    label="이전 상담 요약",
                    description=summaries[0][:100],
                    metadata={"session_id": latest.id},
                )
            )


async def _compute_assessment_signals(
    signals: list[PrepSignalItem],
    center_id: str,
    case_id: str | None,
    client_ids: list[str],
    client_label: str,
    uow: UnitOfWork,
) -> None:
    if not case_id:
        return

    assessment_case_facade = AssessmentCaseFacade(uow)

    # 첫 만남 (priority 2) — 이 클라이언트가 이전에 검사를 받은 적 있는지
    for cid in client_ids:
        past_cases = await assessment_case_facade.get_cases_by_client(
            center_id,
            cid,
            status=["completed"],
        )
        has_prior = any(c.id != case_id for c in past_cases)
        if not has_prior:
            signals.append(
                PrepSignalItem(
                    signal_type=PrepSignalType.FIRST_MEETING,
                    priority=2,
                    label="첫 검사",
                    description=f"{client_label}님의 첫 검사예요",
                )
            )
            break

    # 재검사 (priority 5)
    task_facade = AssessmentTaskFacade(uow)
    current_tasks = await task_facade.get_tasks_by_case_id(case_id)
    current_assessment_ids = {t.assessment_id for t in current_tasks if t.assessment_id}

    if current_assessment_ids:
        for cid in client_ids:
            past_cases = await assessment_case_facade.get_cases_by_client(
                center_id,
                cid,
                status=["completed"],
            )
            past_cases = [c for c in past_cases if c.id != case_id]

            for past_case in past_cases:
                past_tasks = await task_facade.get_tasks_by_case_id(past_case.id)
                past_assessment_ids = {
                    t.assessment_id for t in past_tasks if t.assessment_id
                }
                overlap = current_assessment_ids & past_assessment_ids
                if overlap:
                    signals.append(
                        PrepSignalItem(
                            signal_type=PrepSignalType.RETEST,
                            priority=5,
                            label="재검사",
                            description="이전에 같은 검사를 실시했어요",
                            metadata={"overlapping_count": len(overlap)},
                        )
                    )
                    return


async def _check_unreviewed_assessment(
    signals: list[PrepSignalItem],
    center_id: str,
    client_ids: list[str],
    client_label: str,
    uow: UnitOfWork,
) -> None:
    assessment_case_facade = AssessmentCaseFacade(uow)
    unshared = await assessment_case_facade.aggregate_unshared_completed_per_client(
        center_id,
        client_ids,
    )
    if unshared:
        case_ids = [v.case_id for v in unshared.values()]
        signals.append(
            PrepSignalItem(
                signal_type=PrepSignalType.UNREVIEWED_ASSESSMENT,
                priority=3,
                label="검사 결과 확인 필요",
                description=f"{client_label}님의 검사 결과를 확인해 주세요",
                metadata={
                    "client_ids": list(unshared.keys()),
                    "case_ids": case_ids,
                },
            )
        )


async def _check_attendance_warning(
    signals: list[PrepSignalItem],
    center_id: str,
    client_ids: list[str],
    client_names: list[str],
    session_facade: CounselingSessionFacade,
) -> None:
    # 최근 3회기 중 2회 이상 결석(absent/no_show)한 내담자 감지 (§3-3 기준).
    warning_names: list[str] = []
    for i, cid in enumerate(client_ids):
        pattern = await session_facade.get_client_attendance_pattern(
            center_id,
            cid,
            limit=3,
        )
        if len(pattern) < 2:
            continue
        absent_count = sum(
            1 for p in pattern if p.attendance_status in ("absent", "no_show")
        )
        if absent_count >= 2:
            name = client_names[i] if i < len(client_names) else "내담자"
            warning_names.append(name)

    if warning_names:
        label_names = (
            warning_names[0]
            if len(warning_names) == 1
            else f"{warning_names[0]} 외 {len(warning_names) - 1}명"
        )
        warning_client_ids = [
            client_ids[i]
            for i, name in enumerate(client_names)
            if name in warning_names and i < len(client_ids)
        ]
        signals.append(
            PrepSignalItem(
                signal_type=PrepSignalType.ATTENDANCE_WARNING,
                priority=6,
                label=f"출석 주의 {label_names}",
                description="최근 결석이 잦아요",
                metadata={
                    "client_ids": warning_client_ids,
                    "client_names": warning_names,
                },
            )
        )


async def _check_field_note_summary(
    signals: list[PrepSignalItem],
    center_id: str,
    member_id: str,
    case_id: str | None,
    session_facade: CounselingSessionFacade,
    uow: UnitOfWork,
) -> None:
    if not case_id:
        return

    completed = await session_facade.list_completed_sessions_by_counselor(
        center_id,
        member_id,
    )
    prev_for_case = sorted(
        [s for s in completed if s.counseling_case_id == case_id],
        key=lambda s: s.completed_at or s.created_at,
        reverse=True,
    )
    if not prev_for_case:
        return

    prev_schedule_id = prev_for_case[0].schedule_id
    if not prev_schedule_id:
        return

    field_note_facade = FieldNoteFacade(uow)
    summaries = await field_note_facade.get_summaries_by_schedule_ids(
        [prev_schedule_id],
        center_id,
    )
    if summaries:
        summary_text = getattr(summaries[0], "summary", None)
        if summary_text:
            signals.append(
                PrepSignalItem(
                    signal_type=PrepSignalType.FIELD_NOTE_SUMMARY,
                    priority=7,
                    label="필드노트 요약",
                    description=summary_text[:100],
                    metadata={"schedule_id": prev_schedule_id},
                )
            )


async def _check_group_member_change(
    signals: list[PrepSignalItem],
    center_id: str,
    member_id: str,
    case_id: str | None,
    current_client_ids: list[str],
    client_names: list[str],
    session_facade: CounselingSessionFacade,
) -> None:
    if not case_id:
        return

    completed = await session_facade.list_completed_sessions_by_counselor(
        center_id,
        member_id,
    )
    prev_for_case = sorted(
        [s for s in completed if s.counseling_case_id == case_id],
        key=lambda s: s.completed_at or s.created_at,
        reverse=True,
    )
    if not prev_for_case:
        return

    prev_session_id = prev_for_case[0].id
    prev_participants = await session_facade.get_participants_by_session_ids(
        [prev_session_id],
    )
    prev_client_ids = {
        p.participant_id for p in prev_participants if p.participant_type == "client"
    }

    current_set = set(current_client_ids)
    new_members = current_set - prev_client_ids
    left_members = prev_client_ids - current_set

    if not new_members and not left_members:
        return

    parts: list[str] = []
    if new_members:
        parts.append(f"새 참여 {len(new_members)}명")
    if left_members:
        parts.append(f"이탈 {len(left_members)}명")

    signals.append(
        PrepSignalItem(
            signal_type=PrepSignalType.GROUP_MEMBER_CHANGE,
            priority=8,
            label="인원 변동",
            description=" · ".join(parts),
            metadata={
                "new_count": len(new_members),
                "left_count": len(left_members),
            },
        )
    )


TOOL = {
    "name": "get_prep_signals_handler",
    "permission": "read:schedule",
    "purpose": "다가오는 회기(상담·검사) 전에 상담사가 챙길 준비 신호를 우선순위로 모아 조회한다.",
    "keywords": [
        "get prep signals",
        "준비 신호",
        "회기 준비",
        "상담 전 체크",
        "준비사항",
        "다음 회기 브리핑",
        "챙길 것",
        "사전 점검",
        "prep signals",
    ],
    "boundaries": "특정 일정(schedule)에 대한 상담사용 사전 준비 신호(미작성 일지·첫 만남·검사 미확인·출석 주의·이전 요약·인원 변동)를 우선순위로 최대 5개 반환한다. 일정 자체의 상세는 get_schedule_detail_handler를 쓴다. 회의·블록 일정에는 신호가 없으며, 로그인한 상담사 본인 기준으로 동작한다.",
    "output": "준비 신호 목록, 우선순위순 최대 5개 (PrepSignalsResponse). 회의·블록 일정이면 빈 목록.",
    "input_schema": {
        "type": "object",
        "properties": {
            "schedule_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 일정",
                "description": "준비 신호를 뽑을 회기 일정(schedule)의 UUID.",
            },
        },
        "required": ["schedule_id"],
    },
}
