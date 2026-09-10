from datetime import datetime
from app.core.datetime_utils import utc_now

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.facade import AssessmentTaskFacade
from app.modules.client.facade import ClientFacade
from app.modules.field_note.facade import FieldNoteFacade
from app.modules.field_note.field_note.schemas import LinkableAssessmentTask
from app.modules.schedule.facade import ScheduleFacade


async def list_linkable_tasks_handler(
    center_id: str,
    uow: UnitOfWork,
) -> list[LinkableAssessmentTask]:
    rows = await AssessmentTaskFacade(uow).list_linkable_tasks(center_id)
    # 필드노트는 task당 1개(1:1) — 이미 연결된 task는 후보에서 제외
    linked = await FieldNoteFacade(uow).list_linked_task_ids(center_id)
    rows = [r for r in rows if r["task_id"] not in linked]
    if not rows:
        return []

    client_ids = list({r["client_id"] for r in rows if r.get("client_id")})
    name_by_client: dict[str, str] = {}
    if client_ids:
        clients = await ClientFacade(uow).list_clients_by_ids(client_ids)
        name_by_client = {c.id: (c.name or "") for c in clients}

    # 예약 일시 (schedule_id → start). 케이스에 여러 세션이면 다가오는(>=now)
    # 가장 빠른 것, 없으면 가장 최근 것을 대표 일시로 본다.
    all_schedule_ids = list({sid for r in rows for sid in r.get("schedule_ids", [])})
    start_by_schedule: dict[str, datetime] = {}
    if all_schedule_ids:
        schedules = await ScheduleFacade(uow).list_schedules_by_ids(all_schedule_ids)
        start_by_schedule = {
            sc.id: sc.start for sc in schedules if sc.start is not None
        }

    now = utc_now()

    def _session_start(schedule_ids: list[str]):
        starts = [
            start_by_schedule[sid] for sid in schedule_ids if sid in start_by_schedule
        ]
        if not starts:
            return None
        upcoming = sorted(d for d in starts if d >= now)
        return upcoming[0] if upcoming else max(starts)

    return [
        LinkableAssessmentTask(
            task_id=r["task_id"],
            case_id=r["case_id"],
            case_code=r["case_code"],
            client_name=name_by_client.get(r.get("client_id") or "", ""),
            assessment_code=r["assessment_code"],
            assessment_kor_name=r["assessment_kor_name"],
            execution_method=r["execution_method"],
            task_status=r["task_status"],
            created_at=r["created_at"],
            session_start=_session_start(r.get("schedule_ids", [])),
        )
        for r in rows
    ]


TOOL = {
    "name": "list_linkable_tasks_handler",
    "permission": "read:counseling_note",
    "purpose": "필드노트에 연결할 수 있는 검사 작업(task) 후보를 조회한다.",
    "keywords": [
        "list linkable tasks",
        "연결 가능 작업",
        "링크 가능 task",
        "연결 후보",
        "필드노트 연결 대상",
    ],
    "boundaries": "필드노트에 연결 가능한 검사 task 후보 조회(읽기 전용). 실제 연결은 link_task_handler.",
    "output": "필드노트에 연결 가능한 검사 작업 후보 목록 (LinkableAssessmentTask 배열).",
    "input_schema": {
        "type": "object",
        "properties": {},
        "required": [],
    },
}
