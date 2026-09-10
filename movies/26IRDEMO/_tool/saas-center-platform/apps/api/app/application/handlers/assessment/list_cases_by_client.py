# 내담자 상세 '담당이력' 탭용. list_cases_handler와 같은 AssessmentCaseListItem를 반환하되
# 타임라인에 필요한 필드만 채우고 일정/룸/상담사/청구 enrichment는 생략한다.

from datetime import date

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.application.schemas import (
    AssessmentCaseListItem,
    ClientSummaryForCase,
    AssessmentSummaryForCase,
)
from app.modules.assessment.facade import (
    AssessmentFacade,
    AssessmentCaseFacade,
    AssessmentCaseParticipantFacade,
    AssessmentTaskFacade,
)
from app.modules.center.facade import MemberFacade
from app.modules.client.facade import ClientFacade
from app.modules.person.facade import PersonFacade


def _calculate_age(birth_date: date | None) -> int | None:
    if not birth_date:
        return None
    today = date.today()
    age = today.year - birth_date.year
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        age -= 1
    return age


async def list_cases_by_client_handler(
    center_id: str,
    client_id: str,
    uow: UnitOfWork,
    status: list[str] | None = None,
    counselor_id: str | None = None,
    owner_scope: str | None = None,
) -> list[AssessmentCaseListItem]:
    # counselor_id 지정 시 그 검사자 담당 케이스만, owner_scope 지정 시 열람 범위(주담당+참여 검사자)만
    case_facade = AssessmentCaseFacade(uow)
    assessment_facade = AssessmentFacade(uow)
    participant_facade = AssessmentCaseParticipantFacade(uow)
    task_facade = AssessmentTaskFacade(uow)
    client_facade = ClientFacade(uow)
    member_facade = MemberFacade(uow)
    person_facade = PersonFacade(uow)

    cases = await case_facade.get_cases_by_client(
        center_id=center_id,
        client_id=client_id,
        status=status,
    )
    if counselor_id is not None:
        cases = [c for c in cases if c.counselor_id == counselor_id]
    if owner_scope is not None and cases:
        accessible_case_ids = set(
            await case_facade.list_accessible_case_ids(center_id, owner_scope)
        )
        cases = [c for c in cases if c.id in accessible_case_ids]
    if not cases:
        return []

    case_ids = [c.id for c in cases]

    all_assessment_ids: set[str] = set()
    for case in cases:
        for summary in case.assessment_summary:
            all_assessment_ids.add(summary["id"])
    assessments = await assessment_facade.get_assessments_by_ids(
        list(all_assessment_ids)
    )
    assessment_map = {a.id: a for a in assessments}

    participants = await participant_facade.get_participants_by_case_ids(case_ids)
    case_to_client_ids: dict[str, list[str]] = {cid: [] for cid in case_ids}
    for p in participants:
        if p.participant_type == "client" and p.unassigned_at is None:
            case_to_client_ids[p.case_id].append(p.participant_id)

    all_client_ids: list[str] = []
    for ids in case_to_client_ids.values():
        all_client_ids.extend(ids)
    clients = (
        await client_facade.list_clients_by_ids(all_client_ids)
        if all_client_ids
        else []
    )
    client_map = {c.id: c for c in clients}

    progress_map = await task_facade.get_task_progress_for_cases(case_ids)

    counselor_ids = list({c.counselor_id for c in cases})
    member_map = await member_facade.get_members_by_ids(counselor_ids)
    person_ids = [m.person_id for m in member_map.values()]
    person_map = await person_facade.get_persons_by_ids(person_ids)

    items: list[AssessmentCaseListItem] = []
    for case in sorted(cases, key=lambda c: c.created_at, reverse=True):
        client_summaries = []
        for cid in case_to_client_ids.get(case.id, []):
            client = client_map.get(cid)
            if not client:
                continue
            client_summaries.append(
                ClientSummaryForCase(
                    client_id=client.id,
                    name=client.name,
                    client_code=client.code,
                    birth_date=client.birth_date,
                    age=_calculate_age(client.birth_date),
                    gender=client.gender,
                    profile_image_url=client.profile_image_url,
                )
            )

        assessment_summaries = []
        for summary in case.assessment_summary:
            assessment = assessment_map.get(summary["id"])
            if not assessment:
                continue
            assessment_summaries.append(
                AssessmentSummaryForCase(
                    id=assessment.id,
                    code=assessment.code,
                    kor_name=assessment.kor_name,
                    eng_name=assessment.eng_name,
                    assessment_type=assessment.assessment_type,
                    duration=assessment.duration,
                )
            )
        assessment_names = [a.kor_name for a in assessment_summaries]

        set_name = case.set_summary.get("name") if case.set_summary else None
        case_type = "group" if case.institution_summary else "individual"
        institution_name = (
            case.institution_summary.get("name") if case.institution_summary else None
        )

        progress = progress_map.get(case.id)
        completed_count = progress.completed_count if progress else 0
        total_count_val = progress.total_count if progress else 0

        member = member_map.get(case.counselor_id)
        person = person_map.get(member.person_id) if member else None
        counselor_name = person.name if person else None

        items.append(
            AssessmentCaseListItem(
                case_id=case.id,
                case_code=case.case_code,
                status=case.status,
                case_type=case_type,
                created_at=case.created_at,
                counselor_id=case.counselor_id,
                counselor_name=counselor_name,
                clients=client_summaries,
                assessments=assessment_summaries,
                assessment_names=assessment_names,
                institution_name=institution_name,
                set_name=set_name,
                scheduled_start=None,
                scheduled_end=None,
                room_id=None,
                room_name=None,
                completed_count=completed_count,
                total_count=total_count_val,
                is_final_report_required=bool(case.is_final_report_required),
                has_comprehensive_report=(
                    bool(case.is_final_report_required) and bool(case.documents)
                ),
                has_uninvoiced_sessions=False,
            )
        )

    return items


TOOL = {
    "name": "list_cases_by_client_handler",
    "permission": "read:assessment_case",
    "purpose": "특정 내담자의 검사 케이스 이력을 타임라인용으로 조회한다.",
    "keywords": [
        "list cases by client",
        "내담자 검사 이력",
        "고객 검사 목록",
        "내담자별 검사",
        "담당이력 검사",
        "검사 타임라인",
    ],
    "boundaries": "한 내담자의 검사 이력만 간략히(타임라인용) 조회. 전체 목록·필터 검색은 list_cases_handler.",
    "output": "내담자 검사 케이스 이력, 타임라인용 (AssessmentCaseListItem 배열).",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 내담자",
                "description": "검사 이력을 볼 내담자의 UUID.",
            },
            "status": {
                "type": "array",
                "items": {"type": "string"},
                "title": "상태 필터",
                "description": "상태 필터 목록(선택).",
            },
            "counselor_id": {
                "type": "string",
                "format": "uuid",
                "title": "상담사 필터",
                "description": "담당 상담사로 한정(선택).",
            },
        },
        "required": ["client_id"],
    },
}
