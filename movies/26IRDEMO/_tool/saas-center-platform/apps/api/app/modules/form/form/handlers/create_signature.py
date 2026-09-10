from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.form.facade.form_facade import FormFacade
from app.modules.form.signature.schemas import SignatureCreate, SignatureResponse


async def create_signature_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    data: SignatureCreate,
    uow: UnitOfWork,
    ip_address: str | None,
    actor_id: str,
) -> SignatureResponse:
    facade = FormFacade(uow)
    atomic, signature = await facade.create_signature(
        center_id=center_id,
        instance_id=data.instance_id,
        field_id=data.field_id,
        signature_data=data.signature_data,
        signer_name=data.signer_name,
        signer_ip=ip_address,
    )
    await emit(
        uow,
        "form_signature_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return SignatureResponse.model_validate(signature)


TOOL = {
    "name": 'create_signature_handler',
    "permission": "write:form_instance",
    "purpose": '폼에 서명을 등록한다.',
    "keywords": ['create signature', '서명 등록', '사인 추가', 'signature', '전자서명'],
    "boundaries": '폼 서명 생성. 서명 조회는 get_signature_handler.',
    "output": '등록된 서명 (SignatureResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'instance_id': {'description': '서명을 추가할 폼 인스턴스의 UUID.', 'title': '대상 폼', 'type': 'string'},
            'field_id': {'description': '서명 필드의 키/ID.', 'maxLength': 100, 'title': '서명 필드', 'type': 'string'},
            'signature_data': {'description': 'Base64 인코딩된 서명 이미지 데이터.', 'title': '서명 이미지', 'type': 'string'},
            'signer_name': {'description': '서명자 이름.', 'maxLength': 100, 'title': '서명자', 'type': 'string'},
        },
        "required": ['instance_id', 'field_id', 'signature_data', 'signer_name'],
    },
}
