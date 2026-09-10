from datetime import datetime
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.datetime_utils import to_utc_naive
from app.modules.schedule.facade import ScheduleFacade
from app.modules.schedule.schedule.schemas import (
    ScheduleListItem,
    ScheduleType,
    ClientBrief,
)
from app.modules.assessment.facade import AssessmentCaseFacade, AssessmentSessionFacade
from app.modules.counseling.facade import CounselingCaseFacade, CounselingSessionFacade
from app.modules.client.facade import ClientFacade
from app.modules.center.facade import MemberFacade, RoomFacade, ProgramFacade
from app.modules.person.facade import PersonFacade


async def list_schedules_handler(
    center_id: str,
    member_ids: list[str] | None,
    start: datetime,
    end: datetime,
    schedule_types: list[str] | None,
    room_id: str | None,
    title: str | None,
    client_name: str | None,
    client_ids: list[str] | None,
    uow: UnitOfWork,
    owner_scope: str | None = None,
) -> list[ScheduleListItem]:
    schedule_facade = ScheduleFacade(uow)

    # own 스코프는 SQL member 필터가 아니라 창 안에서 판정한다 — 일정 자체엔 참여자 개념이
    # 없고 "공동 담당" 소속은 회기의 case로만 알 수 있는데, 그 회기는 아래 enrichment가
    # 창 범위로 어차피 가져온다. 케이스 전 회기 역산(무기한)을 피하는 구조.
    schedules = await schedule_facade.list_schedules(
        center_id=center_id,
        start=to_utc_naive(start),  # type: ignore[arg-type]
        end=to_utc_naive(end),  # type: ignore[arg-type]
        schedule_types=schedule_types,
        member_ids=None if owner_scope is not None else member_ids,
        title=title,
        room_id=room_id,
    )

    if not schedules:
        return []

    schedule_ids = [s.id for s in schedules]

    assessment_facade = AssessmentSessionFacade(uow)
    counseling_facade = CounselingSessionFacade(uow)

    assessment_sessions = await assessment_facade.get_sessions_by_schedule_ids(
        schedule_ids
    )
    counseling_sessions = await counseling_facade.get_sessions_by_schedule_ids(
        schedule_ids
    )

    all_sessions = assessment_sessions + counseling_sessions

    if owner_scope is not None:
        accessible_case_ids = {
            *(
                await CounselingCaseFacade(uow).list_accessible_case_ids(
                    center_id, owner_scope
                )
            ),
            *(
                await AssessmentCaseFacade(uow).list_accessible_case_ids(
                    center_id, owner_scope
                )
            ),
        }
        shared_schedule_ids = {
            s.schedule_id
            for s in all_sessions
            if s.case_id and s.case_id in accessible_case_ids
        }
        allowed_member_ids = set(member_ids or [])
        schedules = [
            s
            for s in schedules
            if s.member_id in allowed_member_ids or s.id in shared_schedule_ids
        ]
        if not schedules:
            return []
        schedule_ids = [s.id for s in schedules]
        kept = set(schedule_ids)
        all_sessions = [s for s in all_sessions if s.schedule_id in kept]

    schedule_to_sessions: dict[str, list] = {sid: [] for sid in schedule_ids}
    for session in all_sessions:
        schedule_to_sessions[session.schedule_id].append(session)

    all_client_ids = []
    for session in all_sessions:
        all_client_ids.extend(
            [p["participant_id"] for p in session.client_participants]
        )

    client_facade = ClientFacade(uow)
    client_map = await client_facade.get_clients_by_ids(all_client_ids)

    # 대표 담당자는 schedule.member_id(회기 수준 대표, 타일 색상/필터용),
    # 전체 담당자는 counseling session_participants(type='counselor') — 그룹 상담 등 다중 담당자 지원(호버 툴팁 등).
    counseling_session_ids = [s.session_id for s in counseling_sessions if s.session_id]
    session_counselor_map: dict[str, list[str]] = {}
    if counseling_session_ids:
        counseling_facade_for_participants = counseling_facade
        counseling_session_participants = (
            await counseling_facade_for_participants.get_participants_by_session_ids(
                counseling_session_ids
            )
        )
        for p in counseling_session_participants:
            if p.participant_type == "counselor":
                session_counselor_map.setdefault(p.session_id, []).append(
                    p.participant_id
                )

    all_member_ids: set[str] = {sch.member_id for sch in schedules if sch.member_id}
    for mids in session_counselor_map.values():
        all_member_ids.update(mids)

    member_facade = MemberFacade(uow)
    member_map = await member_facade.get_members_by_ids(list(all_member_ids))
    person_map = await PersonFacade(uow).get_persons_by_ids(
        [m.person_id for m in member_map.values()]
    )

    counselor_map = {
        member_id: (
            person_map[member.person_id].name
            if member.person_id in person_map
            else None
        )
        for member_id, member in member_map.items()
    }
    counselor_color_map = {
        member_id: member.color for member_id, member in member_map.items()
    }

    room_ids = list({s.room_id for s in schedules if s.room_id})
    room_facade = RoomFacade(uow)
    room_map_full = await room_facade.get_rooms_by_ids(room_ids)
    room_map = {room_id: room.name for room_id, room in room_map_full.items()}

    program_ids = list(
        {
            session.program_id
            for session in counseling_sessions
            if hasattr(session, "program_id") and session.program_id
        }
    )
    program_map: dict[str, str] = {}
    if program_ids:
        program_facade = ProgramFacade(uow)
        program_map_full = await program_facade.get_programs_by_ids(program_ids)
        program_map = {pid: p.name for pid, p in program_map_full.items()}

    result = []
    for schedule in schedules:
        sessions = schedule_to_sessions[schedule.id]

        client_names = []
        clients = []
        seen_client_ids = set()
        for session in sessions:
            for participant in session.client_participants:
                client_id = participant["participant_id"]
                if client_id not in seen_client_ids:
                    seen_client_ids.add(client_id)
                    client_info = client_map.get(client_id)
                    if client_info:
                        client_names.append(client_info.name)
                        clients.append(
                            ClientBrief(
                                id=client_info.client_id,
                                name=client_info.name,
                                gender=client_info.gender,
                                birth_date=client_info.birth_date,
                            )
                        )

        counselor_name = None
        counselor_color = None
        if schedule.member_id:
            counselor_name = counselor_map.get(schedule.member_id)
            counselor_color = counselor_color_map.get(schedule.member_id)

        # 전체 담당자 이름 리스트 (counseling 만). 대표 포함 + 보조 담당자들.
        # 중복 제거하면서 대표를 맨 앞에 유지.
        counselor_names: list[str] = []
        seen_member_ids: set[str] = set()
        if schedule.member_id and counselor_name:
            counselor_names.append(counselor_name)
            seen_member_ids.add(schedule.member_id)
        for session in sessions:
            session_id = getattr(session, "session_id", None)
            if not session_id:
                continue
            for member_id in session_counselor_map.get(session_id, []):
                if member_id in seen_member_ids:
                    continue
                name = counselor_map.get(member_id)
                if name:
                    counselor_names.append(name)
                    seen_member_ids.add(member_id)

        # 세션 상태는 첫 번째 세션 기준.
        session_status = sessions[0].status if sessions else None

        program_name = None
        if sessions:
            first_session = sessions[0]
            if schedule.schedule_type == "counseling":
                pid = getattr(first_session, "program_id", None)
                if pid:
                    program_name = program_map.get(pid)
            elif schedule.schedule_type == "assessment":
                if first_session.assessment_summary:
                    program_name = first_session.assessment_summary[0].get("kor_name")

        # case_id (검사 세션만 — 필드노트 홈에서 검사 task 지연 로드용)
        case_id = None
        if sessions and schedule.schedule_type == "assessment":
            case_id = getattr(sessions[0], "case_id", None)

        # session_id (상담 회기만 — 홈 카드에서 회기 상세로 경유 없이 직접 이동용)
        session_id = None
        if sessions and schedule.schedule_type == "counseling":
            session_id = getattr(sessions[0], "session_id", None)

        result.append(
            ScheduleListItem(
                id=schedule.id,
                start=schedule.start,
                end=schedule.end,
                title=schedule.title,
                schedule_type=ScheduleType(schedule.schedule_type),
                room_name=room_map.get(schedule.room_id) if schedule.room_id else None,
                counselor_name=counselor_name,
                counselor_color=counselor_color,
                counselor_names=counselor_names,
                client_names=client_names,
                clients=clients,
                program_name=program_name,
                session_status=session_status,
                case_id=case_id,
                session_id=session_id,
            )
        )

    if client_ids:
        target_ids = set(client_ids)
        filtered = []
        for item in result:
            sessions = schedule_to_sessions[item.id]
            schedule_client_ids = {
                p["participant_id"]
                for session in sessions
                for p in session.client_participants
            }
            if schedule_client_ids & target_ids:
                filtered.append(item)
        result = filtered
    elif client_name:
        search = client_name.lower()
        result = [
            item
            for item in result
            if any(search in name.lower() for name in item.client_names)
        ]

    return result


TOOL = {
    "name": "list_schedules_handler",
    "permission": "read:schedule",
    "purpose": "기간·멤버·룸·유형 등으로 일정 목록을 조회한다.",
    "keywords": [
        "list schedules",
        "일정 목록",
        "스케줄 조회",
        "캘린더 일정",
        "예약 목록",
        "일정 리스트",
    ],
    "boundaries": "여러 일정을 기간·필터로 조회(읽기 전용, 캘린더용). 단건은 get_schedule_detail_handler.",
    "output": "일정 목록 (ScheduleListItem 배열).",
    "input_schema": {
        "type": "object",
        "properties": {
            "start": {
                "type": "string",
                "format": "date-time",
                "title": "조회 시작",
                "description": "조회 시작 일시.",
            },
            "end": {
                "type": "string",
                "format": "date-time",
                "title": "조회 종료",
                "description": "조회 종료 일시.",
            },
            "member_ids": {
                "type": "array",
                "items": {"type": "string", "format": "uuid"},
                "title": "담당 멤버 필터",
                "description": "담당 멤버 필터 목록(선택).",
            },
            "schedule_types": {
                "type": "array",
                "items": {"type": "string"},
                "title": "유형 필터",
                "description": "유형 필터 목록(선택).",
            },
            "room_id": {
                "type": "string",
                "format": "uuid",
                "title": "룸 필터",
                "description": "룸 필터(선택).",
            },
            "title": {
                "type": "string",
                "title": "제목 검색",
                "description": "제목 검색(선택).",
            },
            "client_name": {
                "type": "string",
                "title": "내담자명 검색",
                "description": "내담자명 검색(선택).",
            },
            "client_ids": {
                "type": "array",
                "items": {"type": "string", "format": "uuid"},
                "title": "내담자 필터",
                "description": "내담자 필터 목록(선택).",
            },
        },
        "required": ["start", "end"],
    },
}
