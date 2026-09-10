from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.facade import CenterFacade, MemberFacade
from app.modules.event import list_recent_interactions
from app.modules.person.facade import PersonFacade
from app.modules.person_profile import PersonProfileFacade

from .schemas import ProfileSnapshot

_ENTITY_LABELS = {
    "client": "내담자",
    "counseling_case": "상담 케이스",
    "counseling_session": "상담 회기",
    "counseling_note": "상담 노트",
    "assessment_case": "검사 케이스",
    "assessment_session": "검사 회기",
    "schedule": "일정",
    "field_note": "필드노트",
    "billable": "청구",
    "form": "양식",
    "member": "직원",
    "room": "상담실",
    "program": "프로그램",
}


def _display_anchor(
    entity_name: str,
    payload: dict,
) -> str | None:
    # atomic payload(엔티티 평문 dump)에서 앵커 표시명 — 못 뽑으면 None(항목 생략).
    data = payload.get("result") or payload.get("data") or {}
    if not isinstance(data, dict):
        return None
    name = data.get("name") or data.get("title") or data.get("case_code")
    if not name or not isinstance(name, str):
        name = _fallback_display(entity_name, data)
    if not name:
        return None
    label = _ENTITY_LABELS.get(entity_name, entity_name)
    # 내담자·직원은 id 동반 — 모델이 이름 재조회 없이 query 필터에 바로 쓴다(zero-hop)
    id_param = {"client": "client_id", "member": "member_id"}.get(entity_name)
    if id_param and data.get("id"):
        return f"{name}({label}, {id_param}: {data['id']})"
    return f"{name}({label})"


def _fallback_display(
    entity_name: str,
    data: dict,
) -> str | None:
    # 무명 엔티티의 고신뢰 표시 — 확신 없는 필드(생성일 등)로 지어내지 않는다.
    if entity_name == "field_note" and data.get("note_number"):
        return f"#{data['note_number']}"
    if entity_name == "schedule" and isinstance(data.get("start"), str):
        # ISO "2026-07-10T01:00:00" → "7/10 01:00"
        try:
            d, t = data["start"].split("T")
            _, month, day = d.split("-")
            return f"{int(month)}/{int(day)} {t[:5]}"
        except (ValueError, IndexError):
            return None
    return None


ANCHOR_LIMIT = 5  # 실측 profile 구성(내담자 2+직원 2+α)이 들어가는 폭 — 예산 600자 내
ANCHOR_CANDIDATES = (
    15  # 무명 엔티티(payload에 name/title 없음)가 많아 넉넉히 스캔 후 추출 성공분만
)


async def build_profile_snapshot_handler(
    *,
    center_id: str,
    member_id: str,
    uow: UnitOfWork,
) -> ProfileSnapshot:
    # identity (live)
    center = await CenterFacade(uow).get_center(center_id)
    member_name = await _resolve_member_name(uow, member_id)

    # anchors (live — event_atomics payload에서 표시명, facade 조회 없음)
    rows = await list_recent_interactions(
        uow, center_id=center_id, actor_id=member_id, limit=ANCHOR_CANDIDATES
    )
    anchors = [
        d for d in (_display_anchor(r["entity_name"], r["payload"]) for r in rows) if d
    ][:ANCHOR_LIMIT]

    # stored long-term (analyze_usage가 쌓은 content v2)
    profile = await PersonProfileFacade(uow).find_person_profile(
        center_id=center_id, member_id=member_id
    )
    content = (profile.content if profile else None) or {}

    # assemble
    return ProfileSnapshot(
        center_id=center_id,
        center_name=center.name,
        member_id=member_id,
        member_name=member_name,
        recent_interactions=anchors,
        narrative=content.get("narrative") or None,
        defaults=content.get("defaults") or None,
        analyzed_at=profile.analyzed_at if profile else None,
    )


async def _resolve_member_name(
    uow: UnitOfWork,
    member_id: str,
) -> str | None:
    members = await MemberFacade(uow).get_members_by_ids([member_id])
    member = members.get(member_id)
    if not member:
        return None
    persons = await PersonFacade(uow).get_persons_by_ids([member.person_id])
    person = persons.get(member.person_id)
    return person.name if person else None
