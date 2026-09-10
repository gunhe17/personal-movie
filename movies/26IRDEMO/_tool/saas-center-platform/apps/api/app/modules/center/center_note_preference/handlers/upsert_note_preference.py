from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..repository import CenterNotePreferenceRepository
from ..schemas import CenterNotePreferenceUpdate, CenterNotePreferenceResponse
from ..services import UpsertNotePreferenceService


async def upsert_note_preference_handler(
    center_id: str,
    data: CenterNotePreferenceUpdate,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
) -> CenterNotePreferenceResponse:
    repo = uow.repo(CenterNotePreferenceRepository)
    service = UpsertNotePreferenceService(repo)
    atomic, result = await service.execute(center_id, data.default_template_type)
    await emit(
        uow,
        "center_note_preference_upserted",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return CenterNotePreferenceResponse.model_validate(result)


TOOL = {
    "name": 'upsert_note_preference_handler',
    "permission": "write:center",
    "purpose": '센터의 노트 환경설정을 저장(없으면 생성)한다.',
    "keywords": ['upsert note preference', '노트 설정 변경', '기록 환경설정 저장', 'note preference 저장'],
    "boundaries": '센터 노트 환경설정 생성/수정. 조회는 get_note_preference_handler.',
    "output": '저장된 노트 환경설정 (CenterNotePreferenceResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'default_template_type': {'description': '기본 상담 일지 서식: default/soap/dap/birp/family_center.', 'enum': ['default', 'soap', 'dap', 'birp', 'family_center'], 'title': '기본 일지 서식', 'type': 'string'},
        },
        "required": ['default_template_type'],
    },
}
