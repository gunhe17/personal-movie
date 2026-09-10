from datetime import date, datetime

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.persistence.new_repository import offset_page
from app.application.schemas import (
    CounselingNoteListItem,
    CounselingNoteListResponse,
)
from app.modules.counseling.facade import (
    CounselingNoteFacade,
    CounselingSessionFacade,
    CounselingCaseFacade,
)
from app.modules.center.facade import ProgramFacade, RoomFacade
from app.modules.client.facade import ClientFacade
from app.modules.schedule.facade import ScheduleFacade
from app.modules.counseling.counseling_session_participant.schemas import (
    ParticipantType,
)


# 목록 카드 미리보기에 쓸 본문 필드 — 일지를 읽는 순서(모달 배치 순서) 그대로.
# 하나만 고르지 않고 이어붙인다: 카드는 "무슨 일지인가"를 위에서부터 훑는 자리라
# 중간 필드부터 보여주면 문서 중간을 펼친 것처럼 읽힌다.
# private_notes(개인 메모)는 본인 기록용이라 목록에 싣지 않는다.
_PREVIEW_KEYS = ("main_topic", "progress", "next_goal", "raw_notes")
_PREVIEW_JOINER = " · "
_PREVIEW_MAX = 500


def _build_preview(note) -> str | None:
    content = getattr(note, "content", None)
    if not isinstance(content, dict):
        return None
    parts: list[str] = []
    for key in _PREVIEW_KEYS:
        value = content.get(key)
        if isinstance(value, str) and value.strip():
            parts.append(value.strip())
    if not parts:
        return None
    return _PREVIEW_JOINER.join(parts)[:_PREVIEW_MAX]


def _calculate_age(birth_date: date | None) -> int | None:
    if not birth_date:
        return None
    today = date.today()
    age = today.year - birth_date.year
    if (today.month, today.day) < (birth_date.month, birth_date.day):
        age -= 1
    return age


async def list_my_counseling_notes_handler(
    center_id: str,
    member_id: str,
    status: str,
    keyword: str | None,
    skip: int,
    limit: int,
    uow: UnitOfWork,
    program_type: str | None = None,
) -> CounselingNoteListResponse:
    # member_id(=작성자)는 access_level과 무관하게 본인 작성분만 조회.
    # 미작성 = 완료 회기(status='completed')의 참여 내담자 중 그 (회기, 내담자)에 노트가 없는 페어.
    # 회기 단위가 아닌 회기×내담자 단위 — 그룹 회기 4명 중 2명만 작성 시 나머지 2명이 미작성으로 잡힘.
    note_facade = CounselingNoteFacade(uow)
    session_facade = CounselingSessionFacade(uow)
    case_facade = CounselingCaseFacade(uow)
    program_facade = ProgramFacade(uow)
    client_facade = ClientFacade(uow)
    schedule_facade = ScheduleFacade(uow)
    room_facade = RoomFacade(uow)

    # written: 본인 작성 노트
    notes: list = []
    if status in ("written", "all"):
        notes = await note_facade.list_my_notes(
            author_ids=[member_id], center_id=center_id
        )

    # missing: 완료 회기 × 내담자 중 노트 없는 페어
    missing_pairs: list[tuple[str, str]] = []
    completed_session_ids: list[str] = []
    if status in ("missing", "all"):
        completed = await session_facade.list_completed_sessions_by_counselor(
            center_id, member_id
        )
        completed_session_ids = [s.id for s in completed]
        if completed_session_ids:
            # 완료 회기의 모든 노트(작성자 무관) → 작성된 (회기, 내담자) 쌍
            notes_on_completed = await note_facade.list_notes_by_sessions(
                completed_session_ids, center_id
            )
            written_pairs = {
                (n.counseling_session_id, n.client_id)
                for n in notes_on_completed
                if getattr(n, "deleted_at", None) is None
            }
            participants = await session_facade.get_participants_by_session_ids(
                completed_session_ids
            )
            for p in participants:
                if getattr(p, "participant_type", None) != ParticipantType.CLIENT.value:
                    continue
                pair = (p.session_id, p.participant_id)
                if pair not in written_pairs:
                    missing_pairs.append(pair)

    if not notes and not missing_pairs:
        return CounselingNoteListResponse(items=[], **offset_page(0, skip, limit))

    all_session_ids = list(
        {n.counseling_session_id for n in notes} | set(completed_session_ids)
    )
    sessions = await session_facade.get_sessions_by_ids(all_session_ids, center_id)
    session_map = {s.id: s for s in sessions}

    case_ids = list({s.counseling_case_id for s in sessions})
    cases = await case_facade.get_cases_by_ids(case_ids)
    case_map = {c.id: c for c in cases}
    program_ids = list({c.program_id for c in cases})
    program_map = await program_facade.get_programs_by_ids(program_ids)

    schedule_ids = [s.schedule_id for s in sessions if s.schedule_id]
    schedules = (
        await schedule_facade.list_schedules_by_ids(schedule_ids)
        if schedule_ids
        else []
    )
    schedule_map = {s.id: s for s in schedules}

    room_ids = list({s.room_id for s in schedules if s.room_id})
    room_map = await room_facade.get_rooms_by_ids(room_ids) if room_ids else {}

    client_ids = list({n.client_id for n in notes} | {cid for _, cid in missing_pairs})
    client_map = (
        await client_facade.get_clients_by_ids(client_ids) if client_ids else {}
    )

    def _enrich(session_id: str, client_id: str):
        session = session_map.get(session_id)
        program_name = None
        program_type_value = None
        session_start = None
        session_end = None
        schedule_id = None
        room_name = None
        case_id = None
        if session:
            schedule_id = session.schedule_id
            case_id = session.counseling_case_id
            case = case_map.get(session.counseling_case_id)
            if case:
                program = program_map.get(case.program_id)
                program_name = program.name if program else None
                program_type_value = program.program_type if program else None
            if session.schedule_id:
                sched = schedule_map.get(session.schedule_id)
                session_start = sched.start if sched else None
                session_end = sched.end if sched else None
                if sched and sched.room_id:
                    room = room_map.get(sched.room_id)
                    room_name = room.name if room else None
        client = client_map.get(client_id)
        client_name = client.name if client else None
        client_gender = client.gender if client else None
        client_birth_date = client.birth_date if client else None
        client_profile_image_url = client.profile_image_url if client else None
        client_age = _calculate_age(client.birth_date) if client else None
        return (
            program_name,
            program_type_value,
            session_start,
            session_end,
            client_name,
            client_gender,
            client_birth_date,
            client_profile_image_url,
            client_age,
            schedule_id,
            room_name,
            case_id,
        )

    items: list[CounselingNoteListItem] = []

    for n in notes:
        (
            program_name,
            program_type_value,
            session_start,
            session_end,
            client_name,
            client_gender,
            client_birth_date,
            client_profile_image_url,
            client_age,
            schedule_id,
            room_name,
            case_id,
        ) = _enrich(n.counseling_session_id, n.client_id)
        items.append(
            CounselingNoteListItem(
                note_id=n.id,
                counseling_session_id=n.counseling_session_id,
                counseling_case_id=case_id,
                client_id=n.client_id,
                client_name=client_name,
                client_gender=client_gender,
                client_birth_date=client_birth_date,
                client_profile_image_url=client_profile_image_url,
                client_age=client_age,
                program_name=program_name,
                program_type=program_type_value,
                session_start=session_start,
                session_end=session_end,
                schedule_id=schedule_id,
                room_name=room_name,
                summary=n.summary,
                preview=_build_preview(n),
                is_written=True,
                created_at=n.created_at,
            )
        )

    for session_id, client_id in missing_pairs:
        (
            program_name,
            program_type_value,
            session_start,
            session_end,
            client_name,
            client_gender,
            client_birth_date,
            client_profile_image_url,
            client_age,
            schedule_id,
            room_name,
            case_id,
        ) = _enrich(session_id, client_id)
        items.append(
            CounselingNoteListItem(
                note_id=None,
                counseling_session_id=session_id,
                counseling_case_id=case_id,
                client_id=client_id,
                client_name=client_name,
                client_gender=client_gender,
                client_birth_date=client_birth_date,
                client_profile_image_url=client_profile_image_url,
                client_age=client_age,
                program_name=program_name,
                program_type=program_type_value,
                session_start=session_start,
                session_end=session_end,
                schedule_id=schedule_id,
                room_name=room_name,
                summary=None,
                is_written=False,
                created_at=None,
            )
        )

    if keyword:
        kw = keyword.strip().lower()
        if kw:
            items = [it for it in items if kw in (it.client_name or "").lower()]

    # 프로그램 유형(개별/그룹) 필터 — 미지정(None)이면 전체. keyword와 같은 자리에서
    # 걸러야 아래 total이 필터 통과 건수와 일치한다(절삭-선행 금지).
    if program_type:
        pt = program_type.strip().upper()
        if pt in ("INDIVIDUAL", "GROUP"):
            items = [it for it in items if (it.program_type or "") == pt]

    # 정렬: 회기 날짜, 없으면 작성일 최신순 — 그 후 페이지 슬라이스
    def _sort_key(item: CounselingNoteListItem) -> datetime:
        return item.session_start or item.created_at or datetime.min

    items.sort(key=_sort_key, reverse=True)

    total = len(items)
    paged = items[skip : skip + limit] if limit > 0 else items
    return CounselingNoteListResponse(items=paged, **offset_page(total, skip, limit))


TOOL = {
    "name": "list_my_counseling_notes_handler",
    "permission": "read:counseling_note",
    "purpose": "로그인한 상담사 본인이 작성한 상담 노트와 아직 작성하지 않은 완료 회기를 회기×내담자 단위로 조회한다.",
    "keywords": [
        "my counseling notes",
        "내 상담 노트",
        "작성한 노트",
        "미작성 노트",
        "상담 일지",
        "회기 노트",
        "노트 목록",
        "안 쓴 기록",
        "내 기록",
    ],
    "boundaries": "본인 작성 노트(written)와 미작성 페어(missing: 완료 회기인데 노트 없는 내담자)를 회기×내담자 단위로 묶어 보여주는 노트 전용 도구다 — 그룹 회기 4명 중 2명만 작성하면 나머지 2명이 미작성으로 잡힌다. 케이스 목록 자체가 필요하면 list_counseling_cases_enriched_handler나 list_my_counseling_cases_handler를, 케이스 상세 안의 노트 작성 여부만 보려면 get_counseling_case_detail_handler를 쓴다.",
    "output": "내 작성/미작성 상담 노트 목록 (CounselingNoteListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "title": "조회 범위",
                "enum": ["written", "missing", "all"],
                "description": "written(작성분) | missing(미작성분) | all(둘 다).",
            },
            "keyword": {
                "type": "string",
                "title": "내담자 이름 검색",
                "description": "내담자 이름 부분 일치(선택).",
            },
            "program_type": {
                "type": "string",
                "title": "프로그램 유형",
                "enum": ["INDIVIDUAL", "GROUP"],
                "description": "개별(INDIVIDUAL) | 그룹(GROUP). 미지정이면 전체 유형.",
            },
            "skip": {
                "type": "integer",
                "title": "오프셋",
                "description": "건너뛸 개수.",
            },
            "limit": {
                "type": "integer",
                "title": "최대 개수",
                "description": "가져올 최대 개수(0이면 전체).",
            },
        },
        "required": ["status", "skip", "limit"],
    },
}
