from datetime import date
from app.modules.assessment.assessment_session.models import SessionStatus
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.exceptions import EntityNotFoundException
from app.application.schemas import (
    AssessmentCaseDetailResponse,
    AssessmentSessionSummary,
    ClientDetailForCase,
    CounselorDetailForCase,
    MemberSummary,
    ScheduleSummary,
    InstitutionSummary,
    AssessmentTaskSummary,
)
from app.modules.auth.facade import AccountFacade
from app.modules.assessment.facade import (
    AssessmentCaseFacade,
    AssessmentCaseParticipantFacade,
    AssessmentSessionFacade,
    AssessmentSetFacade,
    AssessmentTaskFacade,
)
from app.modules.client.facade import ClientFacade
from app.modules.schedule.facade import ScheduleFacade
from app.modules.center.facade import MemberFacade, RoomFacade
from app.modules.person.facade import PersonFacade


def calculate_age(birth_date: date | None) -> int | None:
    if not birth_date:
        return None

    today = date.today()
    age = today.year - birth_date.year

    if (today.month, today.day) < (birth_date.month, birth_date.day):
        age -= 1

    return age


async def get_case_handler(
    center_id: str,
    case_id: str,
    uow: UnitOfWork,
    owner_scope: str | None = None,
    actor_membership_id: str | None = None,
) -> AssessmentCaseDetailResponse:
    case_facade = AssessmentCaseFacade(uow)
    participant_facade = AssessmentCaseParticipantFacade(uow)
    session_facade = AssessmentSessionFacade(uow)
    set_facade = AssessmentSetFacade(uow)
    task_facade = AssessmentTaskFacade(uow)
    client_facade = ClientFacade(uow)
    member_facade = MemberFacade(uow)
    person_facade = PersonFacade(uow)
    account_facade = AccountFacade(uow)
    schedule_facade = ScheduleFacade(uow)
    room_facade = RoomFacade(uow)

    await case_facade.verify_case_readable(center_id, case_id, owner_scope)

    case = await case_facade.get_case_by_id(center_id, case_id)

    participants = await participant_facade.get_participants_by_case_ids([case_id])

    client_ids = []
    assistant_ids = []
    for p in participants:
        if p.participant_type == "client" and p.unassigned_at is None:
            client_ids.append(p.participant_id)
        elif p.participant_type == "assistant" and p.unassigned_at is None:
            # counselor_id는 Case에 직접 저장되므로, assistant만 Participant에 저장됨
            assistant_ids.append(p.participant_id)

    clients = await client_facade.list_clients_by_ids(client_ids)
    client_summaries = [
        ClientDetailForCase(
            client_id=c.id,
            name=c.name,
            client_code=c.code,
            birth_date=c.birth_date,
            age=calculate_age(c.birth_date),
            gender=c.gender,
            email=c.email,
            phone=c.phone,
            address=c.address,
            memo=c.memo,
            profile_image_url=c.profile_image_url,
        )
        for c in clients
    ]

    all_member_ids = [case.counselor_id] + assistant_ids
    member_map = await member_facade.get_members_by_ids(all_member_ids)

    person_ids = [m.person_id for m in member_map.values()]
    person_map = await person_facade.get_persons_by_ids(person_ids)

    counselor_member = member_map.get(case.counselor_id)
    if not counselor_member:
        raise EntityNotFoundException(
            f"담당 검사자를 찾을 수 없습니다: {case.counselor_id}"
        )

    counselor_person = person_map.get(counselor_member.person_id)
    counselor_name = counselor_person.name if counselor_person else "Unknown"

    counselor_email = None
    if counselor_person and counselor_person.account_id:
        account_map = await account_facade.get_accounts_by_ids(
            [counselor_person.account_id]
        )
        account = account_map.get(counselor_person.account_id)
        if account:
            counselor_email = account.email

    counselor = CounselorDetailForCase(
        member_id=counselor_member.id,
        name=counselor_name,
        birth_date=counselor_person.birth if counselor_person else None,
        email=counselor_email,
        phone=counselor_person.phone if counselor_person else None,
        employment_type=counselor_member.employment_type,
        hire_date=counselor_member.created_at,
        memo=counselor_member.memo,
    )

    assistants = []
    for aid in assistant_ids:
        m = member_map.get(aid)
        if m is not None:
            p = person_map.get(m.person_id)
            assistants.append(
                MemberSummary(
                    member_id=m.id,
                    name=p.name if p else "Unknown",
                )
            )

    tasks = await task_facade.get_tasks_by_case_id(case_id)

    assessment_map = {a["id"]: a for a in case.assessment_summary}

    # 세트에 속한 검사 ID 집합 (belongs_to_set 판단용)
    # NOTE: case.assessment_summary가 비어있는 task가 있을 수 있어 id 기준으로 매칭
    set_assessment_ids: set[str] = set()
    set_id_for_codes = case.set_summary.get("set_id") if case.set_summary else None
    if set_id_for_codes:
        try:
            assessment_set = await set_facade.get_set_with_response(
                center_id=center_id,
                set_id=set_id_for_codes,
            )
            set_assessment_ids = {a.id for a in assessment_set.assessment_summary}
        except EntityNotFoundException:
            set_assessment_ids = set()

    task_summaries = []
    for task in tasks:
        assessment_info = assessment_map.get(task.assessment_id, {})
        task_summaries.append(
            AssessmentTaskSummary(
                id=task.id,
                assessment_id=task.assessment_id,
                assessment_code=assessment_info.get("code", ""),
                assessment_name=assessment_info.get("kor_name", ""),
                status=task.status,
                execution_method=task.execution_method,
                progress=task.process,
                completed_at=task.completed_at,
                created_at=task.created_at,
                belongs_to_set=task.assessment_id in set_assessment_ids,
            )
        )

    sessions = await session_facade.get_sessions_by_case_ids([case_id])

    # 삭제된 일정은 제외 → null로 반환되어 프론트에 "일정 추가" UI가 뜬다
    schedule_map: dict = {}
    room_map: dict = {}
    if sessions:
        schedule_ids = list({s.schedule_id for s in sessions if s.schedule_id})
        if schedule_ids:
            fetched = await schedule_facade.list_schedules_by_ids(schedule_ids)
            schedule_map = {s.id: s for s in fetched}
            room_ids = list({s.room_id for s in fetched if s.room_id})
            if room_ids:
                room_map = await room_facade.get_rooms_by_ids(room_ids)

    def _room_name(rid: str | None) -> str | None:
        if not rid:
            return None
        r = room_map.get(rid)
        return r.name if r else None

    session_summaries = []
    for s in sessions:
        sched = schedule_map.get(s.schedule_id) if s.schedule_id else None
        sched_summary = (
            ScheduleSummary(
                schedule_id=sched.id,
                start=sched.start,
                end=sched.end,
                room_id=sched.room_id,
                room_name=_room_name(sched.room_id),
                memo=sched.memo,
                is_cancelled=s.status == SessionStatus.CANCELLED,
                cancel_reason=s.cancel_reason,
                session_id=s.id,
            )
            if sched
            else None
        )
        session_summaries.append(
            AssessmentSessionSummary(
                session_id=s.id,
                status=s.status,
                schedule=sched_summary,
            )
        )

    # 첫 번째 세션 기준 일정 요약 (하위 호환)
    schedule_summary = None
    first_session = sessions[0] if sessions else None
    first_schedule_id = first_session.schedule_id if first_session else None
    if first_schedule_id:
        sched = schedule_map.get(first_schedule_id)
        if sched:
            schedule_summary = ScheduleSummary(
                schedule_id=sched.id,
                start=sched.start,
                end=sched.end,
                room_id=sched.room_id,
                room_name=_room_name(sched.room_id),
                memo=sched.memo,
                is_cancelled=first_session.status == SessionStatus.CANCELLED,
                cancel_reason=first_session.cancel_reason,
                session_id=first_session.id,
            )

    institution = None
    if case.institution_summary:
        institution = InstitutionSummary(
            institution_id=case.institution_summary["institution_id"],
            name=case.institution_summary["name"],
            phone=case.institution_summary.get("phone"),
        )

    case_type = "group" if case.institution_summary else "individual"

    set_id = None
    set_name = None
    if case.set_summary:
        set_id = case.set_summary.get("set_id")
        set_name = case.set_summary.get("name")

    # 수정 권한은 주담당 전용 — 참여 검사자는 열람만 가능하므로 화면이 편집 UI를 접는다
    my_role = None
    if actor_membership_id:
        if case.counselor_id == actor_membership_id:
            my_role = "primary"
        elif actor_membership_id in assistant_ids:
            my_role = "assistant"

    return AssessmentCaseDetailResponse(
        my_role=my_role,
        case_id=case.id,
        case_code=case.case_code,
        status=case.status,
        case_type=case_type,
        created_at=case.created_at,
        completed_at=case.completed_at,
        tags=case.tags,
        is_final_report_required=case.is_final_report_required,
        counselor=counselor,
        assistants=assistants,
        clients=client_summaries,
        institution=institution,
        tasks=task_summaries,
        sessions=session_summaries,
        schedule=schedule_summary,
        set_id=set_id,
        set_name=set_name,
    )


TOOL = {
    "name": "get_case_handler",
    "permission": "read:assessment_case",
    "purpose": "검사 케이스 한 건의 상세 정보를 조회한다.",
    "keywords": [
        "get case",
        "검사 케이스 조회",
        "검사 상세",
        "케이스 상세",
        "평가 상세",
        "검사 정보 보기",
    ],
    "boundaries": "단건 상세 조회(읽기 전용). 목록은 list_cases_handler, 내담자별 이력은 list_cases_by_client_handler.",
    "output": "검사 케이스 상세 (AssessmentCaseDetailResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 케이스",
                "description": "조회할 검사 케이스의 UUID.",
            },
        },
        "required": ["case_id"],
    },
}
