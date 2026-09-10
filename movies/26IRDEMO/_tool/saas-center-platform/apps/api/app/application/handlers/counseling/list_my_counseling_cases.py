from datetime import date

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.application.schemas import (
    CounselingCaseListItem,
    ClientSummaryForCase,
    MyCounselingSummary,
    MyCounselingResponse,
)
from app.modules.counseling.facade import CounselingCaseFacade, CounselingSessionFacade
from app.modules.center.facade import ProgramFacade, MemberFacade
from app.modules.person.facade import PersonFacade
from app.modules.client.facade import ClientFacade
from app.modules.counseling.counseling_case_participant.schemas import (
    CaseParticipantType,
)


async def _build_member_persons_map(
    uow: UnitOfWork,
    member_facade: MemberFacade,
    member_ids: list[str],
) -> dict[str, tuple[object, object | None]]:
    # facade-to-facade 금지: MemberFacade(member) + PersonFacade(이름) 조합을 handler 본문이 수행
    if not member_ids:
        return {}

    member_map = await member_facade.get_members_by_ids(member_ids)
    if not member_map:
        return {}

    person_map = await PersonFacade(uow).get_persons_by_ids(
        [m.person_id for m in member_map.values()]
    )
    return {
        member_id: (member, person_map.get(member.person_id))
        for member_id, member in member_map.items()
    }


def _calculate_age(birth_date: date | None) -> int | None:
    if not birth_date:
        return None
    today = date.today()
    age = today.year - birth_date.year
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        age -= 1
    return age


async def list_my_counseling_cases_handler(
    center_id: str,
    counselor_id: str,
    status: str | None,
    page: int,
    size: int,
    uow: UnitOfWork,
    sort: str = "desc",
) -> MyCounselingResponse:
    _empty_summary = MyCounselingSummary(
        total_completed=0,
        individual_completed=0,
        group_completed=0,
        last_session_date=None,
    )

    case_facade = CounselingCaseFacade(uow)
    session_facade = CounselingSessionFacade(uow)
    program_facade = ProgramFacade(uow)
    member_facade = MemberFacade(uow)
    client_facade = ClientFacade(uow)

    # Summary 집계는 전체 데이터 기준 (페이지네이션 무관)
    all_cases_summary = await case_facade.list_all_cases_summary_by_counselor(
        center_id, counselor_id
    )

    summary = _empty_summary
    if all_cases_summary:
        all_case_ids = [c[0] for c in all_cases_summary]
        all_program_ids = list(set(c[1] for c in all_cases_summary))

        program_map = await program_facade.get_programs_by_ids(all_program_ids)

        individual_case_ids = []
        group_case_ids = []
        for case_id, program_id in all_cases_summary:
            program = program_map.get(program_id)
            if program and program.program_type == "GROUP":
                group_case_ids.append(case_id)
            else:
                individual_case_ids.append(case_id)

        total_count, last_date = await session_facade.count_completed_sessions(
            all_case_ids
        )
        ind_count, _ = (
            await session_facade.count_completed_sessions(individual_case_ids)
            if individual_case_ids
            else (0, None)
        )
        grp_count, _ = (
            await session_facade.count_completed_sessions(group_case_ids)
            if group_case_ids
            else (0, None)
        )

        summary = MyCounselingSummary(
            total_completed=total_count,
            individual_completed=ind_count,
            group_completed=grp_count,
            last_session_date=last_date.date() if last_date else None,
        )

    cases, total = await case_facade.list_cases(
        center_id=center_id,
        status=status,
        counselor_id=counselor_id,
        offset=(page - 1) * size,
        limit=size,
        sort=sort,
    )

    if not cases:
        return MyCounselingResponse(
            summary=summary,
            items=[],
            total=total,
            page=page,
            size=size,
            pages=0,
        )

    list_program_ids = list(set(case.program_id for case in cases))
    if not all_cases_summary:
        program_map = await program_facade.get_programs_by_ids(list_program_ids)
    else:
        # summary에서 이미 조회한 경우, 누락 program만 추가 조회
        missing = [pid for pid in list_program_ids if pid not in program_map]
        if missing:
            extra = await program_facade.get_programs_by_ids(missing)
            program_map.update(extra)

    case_ids = [case.id for case in cases]
    participants_map = await case_facade.get_participants_by_case_ids(
        case_ids, center_id
    )

    client_ids = []
    counselor_ids = []
    for cid, participants in participants_map.items():
        for p in participants:
            if p.participant_type == CaseParticipantType.CLIENT.value and p.is_active:
                client_ids.append(p.participant_id)
            elif (
                p.participant_type == CaseParticipantType.COUNSELOR.value
                and p.is_active
            ):
                counselor_ids.append(p.participant_id)

    clients = await client_facade.list_clients_by_ids(client_ids) if client_ids else []
    client_map = {c.id: c for c in clients}

    # facade-to-facade 금지: handler가 member+person 조립
    member_persons_map = await _build_member_persons_map(
        uow, member_facade, counselor_ids
    )

    sessions_list = await session_facade.get_sessions_by_case_ids(case_ids)
    sessions_by_case: dict[str, list] = {}
    for session in sessions_list:
        if session.counseling_case_id not in sessions_by_case:
            sessions_by_case[session.counseling_case_id] = []
        sessions_by_case[session.counseling_case_id].append(session)

    # 진행(열린) 회기 = 내담자가 예정(scheduled)이 아닌 회기(참석·지각·불참·노쇼). 상담 상세와 동일 정의.
    session_participants = await session_facade.get_participants_by_session_ids(
        [s.id for s in sessions_list]
    )
    occurred_session_ids: set[str] = {
        p.session_id
        for p in session_participants
        if p.participant_type == "client" and p.attendance_status != "scheduled"
    }

    pages = (total + size - 1) // size
    items = []

    for case in cases:
        program = program_map.get(case.program_id)
        program_name = program.name if program else "Unknown"
        case_type_map = {"INDIVIDUAL": "individual", "GROUP": "group"}
        case_type = (
            case_type_map.get(program.program_type, "individual")
            if program
            else "individual"
        )

        participants = participants_map.get(case.id, [])
        case_client_ids = [
            p.participant_id
            for p in participants
            if p.participant_type == CaseParticipantType.CLIENT.value and p.is_active
        ]
        clients_data = [
            ClientSummaryForCase(
                client_id=client.id,
                name=client.name,
                client_code=client.code,
                birth_date=client.birth_date,
                age=_calculate_age(client.birth_date),
                gender=client.gender if client.gender else None,
            )
            for client_id in case_client_ids
            if (client := client_map.get(client_id))
        ]

        # 대표(case.counselor_id) 이름 + 전체 활성 상담사 수
        active_counselors = [
            p
            for p in participants
            if p.participant_type == CaseParticipantType.COUNSELOR.value and p.is_active
        ]
        counselor_count = len(active_counselors)
        counselor_name = "Unknown"
        primary_cp = next(
            (p for p in active_counselors if p.participant_id == case.counselor_id),
            None,
        )
        if primary_cp is None and active_counselors:
            primary_cp = active_counselors[0]
        if primary_cp:
            member, person = member_persons_map.get(
                primary_cp.participant_id, (None, None)
            )
            if person:
                counselor_name = person.name

        case_sessions = sessions_by_case.get(case.id, [])
        completed_sessions = sum(
            1
            for s in case_sessions
            if s.status != "cancelled"
            and (s.status in ("completed", "no_show") or s.id in occurred_session_ids)
        )

        items.append(
            CounselingCaseListItem(
                case_id=case.id,
                case_code=case.case_code,
                status=case.status,
                case_type=case_type,
                program_name=program_name,
                clients=clients_data,
                counselor_name=counselor_name,
                counselor_count=counselor_count,
                completed_sessions=completed_sessions,
                total_sessions=case.total_sessions,
                created_at=case.created_at,
            )
        )

    return MyCounselingResponse(
        summary=summary,
        items=items,
        total=total,
        page=page,
        size=size,
        pages=pages,
    )


TOOL = {
    "name": "list_my_counseling_cases_handler",
    "agent_exposed": False,
    "permission": None,
    "purpose": "로그인한 상담사 본인이 담당하는 상담 케이스 목록과 완료 회기 통계 요약을 함께 조회한다.",
    "keywords": [
        "my counseling cases",
        "내 상담",
        "내 케이스",
        "내 담당 상담",
        "나의 상담 목록",
        "내 회기 통계",
        "담당 케이스",
        "내 상담 현황",
        "마이 페이지 상담",
    ],
    "boundaries": "특정 상담사 '본인' 담당 케이스만 모아 보여주고, 완료 회기 수(개인/집단)와 마지막 회기일 같은 통계 요약을 덤으로 주는 도구다. 센터 전체 케이스를 필터 검색하려면 list_counseling_cases_enriched_handler를, 내 작성/미작성 노트 목록이 필요하면 list_my_counseling_notes_handler를 쓴다. counselor_id는 필수(본인 식별).",
    "output": "내 담당 케이스 목록과 완료 회기 통계 (MyCounselingResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "title": "상태 필터",
                "description": "케이스 상태(예: in_progress | completed). 없으면 전체.",
            },
            "page": {
                "type": "integer",
                "title": "페이지",
                "minimum": 1,
                "description": "페이지 번호(1부터).",
            },
            "size": {
                "type": "integer",
                "title": "페이지 크기",
                "description": "페이지당 케이스 수.",
            },
            "sort": {
                "type": "string",
                "title": "정렬",
                "description": "desc(최신순) 또는 asc(오래된순).",
            },
        },
        "required": ["page", "size"],
    },
}
