from datetime import date

from app.core.datetime_utils import utc_now
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.application.schemas import TransmissionItem, TransmissionListResponse
from app.modules.assessment.facade import (
    AssessmentFacade,
    AssessmentCaseFacade,
    AssessmentCaseParticipantFacade,
    SendLinkFacade,
    SendResultFacade,
)
from app.modules.client.facade import ClientFacade


def _calculate_age(birth: date | None) -> int | None:
    if not birth:
        return None
    today = date.today()
    age = today.year - birth.year
    if (today.month, today.day) < (birth.month, birth.day):
        age -= 1
    return age


def _status(row) -> str:
    if getattr(row, "revoked_at", None):
        return "expired"
    exp = getattr(row, "expires_at", None)
    if exp and exp < utc_now():
        return "expired"
    return "completed"


async def list_transmission_history_handler(
    center_id: str,
    transmission_type: str,
    page: int,
    size: int,
    uow: UnitOfWork,
) -> TransmissionListResponse:
    case_facade = AssessmentCaseFacade(uow)
    assessment_facade = AssessmentFacade(uow)
    participant_facade = AssessmentCaseParticipantFacade(uow)
    client_facade = ClientFacade(uow)

    if transmission_type == "direct-link":
        rows, page_meta = await SendLinkFacade(uow).list_by_center(
            center_id, page, size
        )
    else:
        rows, page_meta = await SendResultFacade(uow).list_by_center(
            center_id, page, size
        )

    if not rows:
        return TransmissionListResponse(
            items=[], total=0, page=page, size=size, pages=0
        )

    case_ids = list({r.case_id for r in rows})
    cases = await case_facade.get_cases_by_ids(case_ids)
    case_map = {c.id: c for c in cases}

    assessment_ids: set[str] = set()
    for c in cases:
        for s in c.assessment_summary:
            assessment_ids.add(s["id"])
    for r in rows:
        for aid in getattr(r, "assessment_ids", []) or []:
            assessment_ids.add(aid)
    assessments = await assessment_facade.get_assessments_by_ids(list(assessment_ids))
    assessment_map = {a.id: a for a in assessments}

    participants = await participant_facade.get_participants_by_case_ids(case_ids)
    case_to_client: dict[str, list[str]] = {cid: [] for cid in case_ids}
    for p in participants:
        if p.participant_type == "client" and p.unassigned_at is None:
            case_to_client[p.case_id].append(p.participant_id)
    all_client_ids = [cid for ids in case_to_client.values() for cid in ids]
    clients = await client_facade.list_clients_by_ids(all_client_ids)
    client_map = {c.id: c for c in clients}

    items: list[TransmissionItem] = []
    for r in rows:
        case = case_map.get(r.case_id)
        client = next(
            (
                client_map[cid]
                for cid in case_to_client.get(r.case_id, [])
                if cid in client_map
            ),
            None,
        )
        if transmission_type == "direct-link":
            aid_list = getattr(r, "assessment_ids", []) or []
        else:
            aid_list = [s["id"] for s in (case.assessment_summary if case else [])]
        a_names = [assessment_map[a].kor_name for a in aid_list if a in assessment_map]
        rec = (r.recipients[0] if r.recipients else {}) or {}
        items.append(
            TransmissionItem(
                uid=r.id,
                type=transmission_type,
                method="kakao" if r.channel == "alarmtalk" else r.channel,
                sent_at=r.created_at,
                client_name=client.name if client else None,
                client_code=client.code if client else None,
                client_birth_date=client.birth_date if client else None,
                client_age=_calculate_age(client.birth_date) if client else None,
                recipient_relation=rec.get("relation"),
                recipient_name=rec.get("name"),
                recipient_phone=rec.get("phone"),
                assessment_name=", ".join(a_names),
                status=_status(r),
            )
        )
    return TransmissionListResponse(items=items, **page_meta)


TOOL = {
    "name": "list_transmission_history_handler",
    "permission": "read:send_link",
    "purpose": "센터의 검사 링크·결과 전송 이력을 유형별로 페이지 단위 조회한다.",
    "keywords": [
        "list transmission history",
        "전송 이력",
        "발송 내역",
        "전송 목록",
        "검사 전송 기록",
        "링크/결과 전송 이력",
    ],
    "boundaries": "센터 전체의 전송(링크/결과) 이력 목록(읽기 전용). 특정 케이스의 발송 이력은 get_send_link/result_delivery_history_handler.",
    "output": "센터 전송(링크/결과) 이력 목록 (TransmissionListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "transmission_type": {
                "type": "string",
                "title": "전송 유형",
                "description": "전송 유형(예: link | result).",
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
                "description": "페이지당 개수.",
            },
        },
        "required": ["transmission_type", "page", "size"],
    },
}
