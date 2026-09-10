from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ...facade import FieldNoteFacade
from ..services.export_transcript import ExportResult


async def export_transcript_handler(
    field_note_id: str,
    center_id: str,
    format: str,
    uow: UnitOfWork,
) -> ExportResult:
    facade = FieldNoteFacade(uow)
    return await facade.export_transcript_with_response(
        field_note_id,
        center_id,
        format=format,
    )


TOOL = {
    "name": "export_transcript_handler",
    "permission": "read:counseling_note",
    "purpose": "필드노트의 전사(transcript)를 파일로 내보낸다.",
    "keywords": ["전사 내보내기", "녹취록 export", "스크립트 다운로드", "transcript"],
    "boundaries": "필드노트 전사를 지정 포맷으로 내보낸다.",
    "output": "내보낸 전사 파일 결과 (ExportResult).",
    "input_schema": {
        "type": "object",
        "properties": {
            "field_note_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 필드노트",
                "description": "전사를 내보낼 필드노트의 UUID.",
            },
            "format": {
                "type": "string",
                "title": "내보내기 포맷",
                "description": "내보내기 포맷(예: txt | docx).",
            },
        },
        "required": ["field_note_id", "format"],
    },
}
