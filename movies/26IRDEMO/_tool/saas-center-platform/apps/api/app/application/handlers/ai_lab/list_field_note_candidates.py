# field_note 오디오 후보를 FieldNoteFacade에서 받아 SampleFacade에 넘겨 이미 import된 후보를 표시 (크로스 모듈).
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.ai_lab.facade import SampleFacade
from app.modules.ai_lab.sample_dataset.schemas import FieldNoteCandidateListResponse
from app.modules.field_note.facade import FieldNoteFacade


async def list_field_note_candidates_handler(
    limit: int,
    uow: UnitOfWork,
) -> FieldNoteCandidateListResponse:
    candidates = await FieldNoteFacade(uow).list_audio_candidates_for_lab(limit=limit)
    items = await SampleFacade(uow).list_field_note_candidates(candidates)
    return FieldNoteCandidateListResponse(items=items)


TOOL = {
    "name": "list_field_note_candidates_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "AI Lab 실험에 쓸 수 있는 필드노트 오디오 후보 목록을 조회하고, 이미 샘플로 가져온 것은 표시한다.",
    "keywords": [
        "list field note candidates",
        "필드노트 후보",
        "오디오 후보",
        "샘플 후보 목록",
        "실험 데이터 후보",
        "import 가능한 필드노트",
        "lab 후보",
        "녹음 후보",
    ],
    "boundaries": "AI Lab(실험실)에서 샘플 데이터셋으로 가져올 수 있는 필드노트 오디오 후보만 조회하는 운영자용 읽기 도구다. 후보를 실제 샘플로 가져오는 것은 import_field_note_sample_handler를 쓴다.",
    "output": "샘플로 가져올 수 있는 필드노트 오디오 후보 목록 (FieldNoteCandidateListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "limit": {
                "type": "integer",
                "title": "조회 개수",
                "minimum": 1,
                "maximum": 200,
                "description": "가져올 후보 개수 상한 (1~200, 기본 50).",
            },
        },
        "required": ["limit"],
    },
}
