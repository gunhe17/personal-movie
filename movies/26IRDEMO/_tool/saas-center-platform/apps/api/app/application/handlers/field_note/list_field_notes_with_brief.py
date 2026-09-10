from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.field_note.facade import FieldNoteFacade
from app.modules.assessment.facade import AssessmentSessionFacade, AssessmentTaskFacade
from app.modules.center.facade import ProgramFacade
from app.modules.client.facade import ClientFacade
from app.modules.counseling.facade import CounselingSessionFacade
from app.modules.field_note.field_note.schemas import (
    FieldNoteListResponse,
    FieldNoteResponse,
    FieldNoteScheduleBrief,
    FieldNoteTaskBrief,
)
from app.modules.schedule.facade import ScheduleFacade


async def list_field_notes_with_brief_handler(
    center_id: str,
    uow: UnitOfWork,
    *,
    status: str | None = None,
    processing_status: str | None = None,
    analysis_state: str | None = None,
    linked: bool | None = None,
    link_type: str | None = None,
    author_id: str | None = None,
    page: int = 1,
    size: int = 20,
) -> FieldNoteListResponse:
    items, page_meta = await FieldNoteFacade(uow).list_field_notes(
        center_id,
        status=status,
        processing_status=processing_status,
        analysis_state=analysis_state,
        linked=linked,
        link_type=link_type,
        author_id=author_id,
        page=page,
        size=size,
    )

    schedule_ids = list({fn.schedule_id for fn in items if fn.schedule_id})
    brief_map = await _build_schedule_briefs(schedule_ids, uow) if schedule_ids else {}

    task_ids = list({fn.task_id for fn in items if fn.task_id})
    task_brief_map = await _build_task_briefs(task_ids, uow) if task_ids else {}

    responses: list[FieldNoteResponse] = []
    for fn in items:
        response = FieldNoteResponse.model_validate(fn)
        if fn.schedule_id:
            response.schedule = brief_map.get(fn.schedule_id)
        if fn.task_id:
            response.task = task_brief_map.get(fn.task_id)
        responses.append(response)

    return FieldNoteListResponse(
        items=responses,
        total=page_meta["total"],
        page=page,
        size=size,
        pages=page_meta["pages"],
    )


async def _build_task_briefs(
    task_ids: list[str],
    uow: UnitOfWork,
) -> dict[str, FieldNoteTaskBrief]:
    info_map = await AssessmentTaskFacade(uow).get_tasks_display_info_by_ids(task_ids)

    client_ids = list(
        {info["client_id"] for info in info_map.values() if info.get("client_id")}
    )
    name_by_client: dict[str, str] = {}
    if client_ids:
        clients = await ClientFacade(uow).list_clients_by_ids(client_ids)
        name_by_client = {c.id: (c.name or "") for c in clients}

    # room 해소(schedule→room)는 크로스모듈 — assessment facade가 schedule_ids만 주고 여기서 조립
    all_schedule_ids = list(
        {sid for info in info_map.values() for sid in info.get("schedule_ids", [])}
    )
    schedule_by_id: dict[str, object] = {}
    room_name_by_id: dict[str, str | None] = {}
    if all_schedule_ids:
        schedules = await ScheduleFacade(uow).list_schedules_by_ids(all_schedule_ids)
        schedule_by_id = {sc.id: sc for sc in schedules}
        room_ids = list(
            {sc.room_id for sc in schedules if getattr(sc, "room_id", None)}
        )
        if room_ids:
            from app.modules.center.facade import RoomFacade

            room_map = await RoomFacade(uow).get_rooms_by_ids(room_ids)
            room_name_by_id = {
                rid: getattr(r, "name", None) for rid, r in room_map.items()
            }

    def _room_name(info: dict) -> str | None:
        for sid in info.get("schedule_ids", []):
            sc = schedule_by_id.get(sid)
            if sc and getattr(sc, "room_id", None):
                return room_name_by_id.get(sc.room_id)
        return None

    return {
        tid: FieldNoteTaskBrief(
            task_id=tid,
            client_name=(name_by_client.get(info.get("client_id") or "") or None),
            assessment_kor_name=info.get("assessment_kor_name"),
            assessment_code=info.get("assessment_code"),
            case_id=info.get("case_id"),
            case_code=info.get("case_code"),
            room_name=_room_name(info),
            task_status=info.get("task_status"),
        )
        for tid, info in info_map.items()
    }


async def _build_schedule_briefs(
    schedule_ids: list[str],
    uow: UnitOfWork,
) -> dict[str, FieldNoteScheduleBrief]:
    schedule_facade = ScheduleFacade(uow)
    counseling_facade = CounselingSessionFacade(uow)
    assessment_facade = AssessmentSessionFacade(uow)
    client_facade = ClientFacade(uow)

    schedules = await schedule_facade.list_schedules_by_ids(schedule_ids)
    counseling_sessions = await counseling_facade.get_sessions_by_schedule_ids(
        schedule_ids
    )
    assessment_sessions = await assessment_facade.get_sessions_by_schedule_ids(
        schedule_ids
    )

    all_sessions = counseling_sessions + assessment_sessions
    schedule_to_sessions: dict[str, list] = {sid: [] for sid in schedule_ids}
    for session in all_sessions:
        schedule_to_sessions[session.schedule_id].append(session)

    all_client_ids = [
        p["participant_id"]
        for session in all_sessions
        for p in session.client_participants
    ]
    client_map = (
        await client_facade.get_clients_by_ids(all_client_ids) if all_client_ids else {}
    )

    program_ids = list(
        {s.program_id for s in counseling_sessions if getattr(s, "program_id", None)}
    )
    program_name_map: dict[str, str] = {}
    if program_ids:
        program_facade = ProgramFacade(uow)
        program_map_full = await program_facade.get_programs_by_ids(program_ids)
        program_name_map = {pid: p.name for pid, p in program_map_full.items()}

    # 상담실명 — 카드에 "프로그램 | 상담실" 표기용 (room_id → name)
    room_ids = list({s.room_id for s in schedules if getattr(s, "room_id", None)})
    room_name_map: dict[str, str | None] = {}
    if room_ids:
        from app.modules.center.facade import RoomFacade

        room_map = await RoomFacade(uow).get_rooms_by_ids(room_ids)
        room_name_map = {rid: getattr(r, "name", None) for rid, r in room_map.items()}

    result: dict[str, FieldNoteScheduleBrief] = {}
    for schedule in schedules:
        sessions = schedule_to_sessions.get(schedule.id, [])

        client_names: list[str] = []
        seen: set[str] = set()
        for session in sessions:
            for participant in session.client_participants:
                cid = participant["participant_id"]
                if cid in seen:
                    continue
                seen.add(cid)
                info = client_map.get(cid)
                if info:
                    client_names.append(info.name)

        program_name: str | None = None
        if sessions:
            first = sessions[0]
            if schedule.schedule_type == "counseling":
                pid = getattr(first, "program_id", None)
                if pid:
                    program_name = program_name_map.get(pid)
            elif schedule.schedule_type == "assessment":
                summary = getattr(first, "assessment_summary", None)
                if summary:
                    program_name = summary[0].get("kor_name")

        session_status = sessions[0].status if sessions else None

        result[schedule.id] = FieldNoteScheduleBrief(
            schedule_id=schedule.id,
            start=schedule.start,
            schedule_type=schedule.schedule_type,
            client_names=client_names,
            program_name=program_name,
            room_name=room_name_map.get(schedule.room_id) if schedule.room_id else None,
            session_status=session_status,
        )

    return result


TOOL = {
    "name": "list_field_notes_with_brief_handler",
    "permission": "read:counseling_note",
    "purpose": "필드노트 목록을 상태·처리상태·작성자 등으로 거르고 브리프와 함께 조회한다.",
    "keywords": [
        "list field notes with brief",
        "필드노트 목록",
        "노트 리스트",
        "필드노트 조회",
        "녹음 노트 목록",
        "field note 목록",
    ],
    "boundaries": "여러 필드노트를 브리프 포함 목록으로 조회(읽기 전용). 단건은 get_field_note_detail_handler.",
    "output": "필드노트 목록, 브리프 포함 (FieldNoteListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "title": "상태 필터",
                "description": "상태 필터(선택).",
            },
            "processing_status": {
                "type": "string",
                "title": "처리 상태 필터",
                "description": "처리 상태 필터(선택).",
            },
            "analysis_state": {
                "type": "string",
                "title": "분석 상태 필터",
                "description": "분석 상태 필터(선택).",
            },
            "linked": {
                "type": "boolean",
                "title": "연결 여부 필터",
                "description": "task 연결 여부 필터(선택).",
            },
            "link_type": {
                "type": "string",
                "title": "연결 유형 필터",
                "description": "연결 유형 필터(선택).",
            },
            "author_id": {
                "type": "string",
                "format": "uuid",
                "title": "작성자 필터",
                "description": "특정 작성자로 한정(선택).",
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
        "required": [],
    },
}
