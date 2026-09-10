# 검사(task) 연결 노트에 한해 case_id 등 검사 brief를 cross-module 조립.
# 목록(list_field_notes_with_brief)과 동일 정책 — 모듈 핸들러 대신 여기서 처리.
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.field_note.field_note.schemas import FieldNoteDetailResponse

from .get_field_note_detail import get_field_note_detail_handler
from .list_field_notes_with_brief import _build_task_briefs


async def get_field_note_with_brief_handler(
    field_note_id: str,
    center_id: str,
    uow: UnitOfWork,
) -> FieldNoteDetailResponse:
    response = await get_field_note_detail_handler(
        field_note_id=field_note_id, center_id=center_id, uow=uow
    )
    if response.task_id:
        briefs = await _build_task_briefs([response.task_id], uow)
        response.task = briefs.get(response.task_id)
    return response


TOOL = {
    "name": "get_field_note_with_brief_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "필드노트 상세를 간단 브리핑과 함께 조회한다.",
    "keywords": [
        "get field note with brief",
        "필드노트 브리프",
        "노트 요약 조회",
        "브리핑 포함 조회",
        "필드노트 상세 요약",
    ],
    "boundaries": "필드노트 상세에 '브리프(요약)'를 더해 조회(읽기 전용). 순수 상세는 get_field_note_detail_handler.",
    "output": "필드노트 상세 + 브리프 (FieldNoteDetailResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "field_note_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 필드노트",
                "description": "조회할 필드노트의 UUID.",
            },
        },
        "required": ["field_note_id"],
    },
}
