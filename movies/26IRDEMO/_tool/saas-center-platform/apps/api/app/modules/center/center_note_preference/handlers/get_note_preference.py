from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..repository import CenterNotePreferenceRepository
from ..schemas import CenterNotePreferenceResponse
from ..services import FindNotePreferenceService


async def get_note_preference_handler(
    center_id: str,
    uow: UnitOfWork,
) -> CenterNotePreferenceResponse:
    repo = uow.repo(CenterNotePreferenceRepository)
    service = FindNotePreferenceService(repo)
    pref = await service.execute(center_id)

    # 부재 = 기본 환경설정 반환
    if pref:
        return CenterNotePreferenceResponse.model_validate(pref)
    return CenterNotePreferenceResponse(center_id=center_id)


TOOL = {
    "name": "get_note_preference_handler",
    "permission": "read:center",
    "purpose": "센터의 노트(기록) 환경설정을 조회한다.",
    "keywords": ["노트 설정 조회", "기록 환경설정", "note preference 조회"],
    "boundaries": "센터 노트 환경설정 조회(읽기). 변경은 upsert_note_preference_handler.",
    "output": "센터 노트 환경설정 (CenterNotePreferenceResponse).",
    "input_schema": {
        "type": "object",
        "properties": {},
        "required": [],
    },
}
