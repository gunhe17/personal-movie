from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit

from ... import UpdateInstitutionService
from ..repository import InstitutionRepository
from ..schemas import InstitutionResponse, InstitutionUpdate


async def update_institution_handler(
    institution_id: str,
    data: InstitutionUpdate,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str | None,
) -> InstitutionResponse:
    repo = uow.repo(InstitutionRepository)
    service = UpdateInstitutionService(repo)

    update_fields = data.model_dump(exclude_unset=True)
    if "address" in update_fields:
        update_fields["address"] = (
            data.address.model_dump() if data.address else None
        )

    atomic, institution = await service.execute(
        institution_id,
        **update_fields,
    )
    await emit(
        uow,
        "institution_updated",
        event_group_id=event_group_id,
        atomics=[atomic],
        actor_id=actor_id,
    )

    return InstitutionResponse.model_validate(institution)


TOOL = {
    "name": "update_institution_handler",
    "permission": None,
    "purpose": "기존 기관의 이름·전화·주소를 부분 수정한다.",
    "keywords": ["기관 수정", "병원 정보 변경", "기관 정보 업데이트", "전화번호 변경", "주소 변경", "거래처 정보 수정", "institution 수정", "기관 이름 변경"],
    "boundaries": "이미 등록된 기관의 일부 필드만 바꾸는 도구다(보낸 필드만 갱신, 생략한 필드는 유지). 새로 만들기는 create_institution_handler, 없애기는 delete_institution_handler, 현재 값 확인은 get_institution_handler를 쓴다. 로그인한 사용자만 호출할 수 있다.",
    "output": "수정된 기관 (InstitutionResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "institution_id": {"type": "string", "format": "uuid", "title": "대상 기관", "description": "수정할 기관의 UUID."},
            "name": {"anyOf": [{"maxLength": 100, "minLength": 1, "type": "string"}, {"type": "null"}], "default": None, "title": "기관 이름"},
            "phone": {"anyOf": [{"pattern": "^\\d{2,3}-\\d{3,4}-\\d{4}$", "type": "string"}, {"type": "null"}], "default": None, "title": "전화번호"},
            "address": {"anyOf": [{"$ref": "#/$defs/AddressInfo"}, {"type": "null"}], "default": None, "title": "주소"},
        },
        "$defs": {"AddressInfo": {"properties": {"zip_code": {"anyOf": [{"pattern": "^\\d{5}$", "type": "string"}, {"type": "null"}], "default": None, "title": "우편번호"}, "address": {"anyOf": [{"maxLength": 300, "type": "string"}, {"type": "null"}], "default": None, "title": "주소"}, "detail": {"anyOf": [{"maxLength": 200, "type": "string"}, {"type": "null"}], "default": None, "title": "상세주소"}}, "title": "AddressInfo", "type": "object"}},
        "required": ["institution_id"],
    },
}
