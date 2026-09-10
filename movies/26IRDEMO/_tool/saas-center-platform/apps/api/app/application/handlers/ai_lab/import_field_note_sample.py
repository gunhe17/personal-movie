# field_note 녹음의 S3 오디오를 FieldNoteFacade에서 조회해 SampleFacade로 샘플 등록 (크로스 모듈).
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.ai_lab.facade import SampleFacade
from app.modules.ai_lab.sample_dataset.schemas import SampleDatasetResponse
from app.modules.event import emit
from app.modules.field_note.facade import FieldNoteFacade
from app.modules.platform_admin.audit_log.events import AdminAuditAtomic


async def import_field_note_sample_handler(
    field_note_id: str,
    name: str | None,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str,
    ip: str | None = None,
) -> SampleDatasetResponse:
    audio = await FieldNoteFacade(uow).get_first_audio_for_lab(field_note_id)
    sample = await SampleFacade(uow).import_field_note_sample(
        field_note_id=field_note_id,
        audio=audio,
        name=name,
    )
    await emit(
        uow,
        "sample_dataset_created",
        event_group_id=event_group_id,
        atomics=[AdminAuditAtomic(
            _act="created",
            _entity_name="sample_dataset",
            _entity_id=sample.id,
            _payload={"data": {
                "source": "field_note",
                "field_note_id": field_note_id,
            }},
        )],
        actor_id=actor_id,
        actor_type="admin",
        ip_address=ip,
    )
    await uow.session.refresh(sample)
    return SampleDatasetResponse.model_validate(sample)


TOOL = {
    "name": "import_field_note_sample_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "기존 필드노트 녹음의 오디오를 AI Lab 샘플 데이터셋으로 가져와 실험용 샘플로 등록한다.",
    "keywords": [
        "import field note sample",
        "필드노트 샘플 등록",
        "녹음 가져오기",
        "샘플 임포트",
        "실험 샘플 추가",
        "오디오 샘플화",
        "필드노트로 샘플 만들기",
        "샘플 데이터셋 생성",
    ],
    "boundaries": "운영자(어드민) 전용 쓰기 도구로, '하나의' 필드노트 녹음을 골라 그 오디오를 실험용 샘플로 실제 등록한다. 아직 등록하지 않고 가져올 수 있는 후보 목록만 둘러보려면 list_field_note_candidates_handler를, 프로덕션 프롬프트를 실험 버전으로 가져오려면 import_production_prompts_handler를 쓴다.",
    "output": "등록된 샘플 데이터셋 (SampleDatasetResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "field_note_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 필드노트",
                "description": "샘플로 가져올 필드노트(녹음)의 UUID. 이 녹음의 첫 오디오가 샘플이 된다.",
            },
            "name": {
                "type": "string",
                "title": "샘플 이름",
                "description": "등록될 샘플 데이터셋 이름. 비우면 필드노트 기준 기본 이름 자동 생성.",
            },
        },
        "required": ["field_note_id"],
    },
}
