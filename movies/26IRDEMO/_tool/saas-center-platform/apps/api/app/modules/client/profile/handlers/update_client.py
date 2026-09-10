from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..schemas import ClientUpdate, ClientResponse
from ...facade.profile_facade import ProfileFacade


async def update_client_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    client_id: str,
    data: ClientUpdate,
    uow: UnitOfWork,
    actor_id: str,
) -> ClientResponse:
    fields = {key: getattr(data, key) for key in data.model_fields_set}
    for key in ("role", "gender", "status"):
        if key in fields and fields[key] is not None:
            fields[key] = fields[key].value
    client_atomic, client = await ProfileFacade(uow).update_client(
        center_id=center_id,
        client_id=client_id,
        changed=data.model_dump(mode="json", exclude_unset=True),
        **fields,
    )
    await emit(
        uow,
        "client_updated",
        event_group_id=event_group_id,
        atomics=[client_atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return ClientResponse.model_validate(client)


TOOL = {
    "name": "update_client_handler",
    "permission": "write:client",
    "purpose": "내담자 정보를 수정한다.",
    "keywords": ["update client", "내담자 수정", "고객 정보 변경", "client 수정"],
    "boundaries": "내담자 정보 수정. 상태 전환은 activate/deactivate/archive_client_handler.",
    "output": "수정된 내담자 (ClientResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 내담자",
                "description": "수정할 내담자의 UUID.",
            },
            "role": {
                "anyOf": [{"$ref": "#/$defs/ClientRole"}, {"type": "null"}],
                "default": None,
            },
            "name": {
                "anyOf": [
                    {"maxLength": 100, "minLength": 1, "type": "string"},
                    {"type": "null"},
                ],
                "default": None,
                "title": "이름",
                "description": "이름(미지정 시 유지).",
            },
            "birth_date": {
                "anyOf": [{"format": "date", "type": "string"}, {"type": "null"}],
                "default": None,
                "title": "생년월일",
                "description": "생년월일(미지정 시 유지).",
            },
            "gender": {
                "anyOf": [{"$ref": "#/$defs/Gender"}, {"type": "null"}],
                "default": None,
                "description": "성별 male/female(미지정 시 유지).",
            },
            "phone": {
                "anyOf": [
                    {"maxLength": 20, "minLength": 1, "type": "string"},
                    {"type": "null"},
                ],
                "default": None,
                "title": "전화번호",
                "description": "전화번호(미지정 시 유지).",
            },
            "email": {
                "anyOf": [{"maxLength": 100, "type": "string"}, {"type": "null"}],
                "default": None,
                "title": "이메일",
                "description": "이메일(미지정 시 유지).",
            },
            "address": {
                "anyOf": [{"maxLength": 500, "type": "string"}, {"type": "null"}],
                "default": None,
                "title": "주소",
                "description": "주소(미지정 시 유지).",
            },
            "profile_image_url": {
                "anyOf": [{"maxLength": 500, "type": "string"}, {"type": "null"}],
                "default": None,
                "description": "프로필 이미지 URL(미지정 시 유지).",
                "title": "프로필 이미지",
            },
            "status": {
                "anyOf": [{"$ref": "#/$defs/ClientStatus"}, {"type": "null"}],
                "default": None,
                "description": "상태 active/inactive/archived(미지정 시 유지).",
            },
            "memo": {
                "anyOf": [{"maxLength": 2000, "type": "string"}, {"type": "null"}],
                "default": None,
                "title": "메모",
                "description": "메모(미지정 시 유지).",
            },
        },
        "$defs": {
            "ClientRole": {
                "enum": ["client", "guardian", "both"],
                "title": "ClientRole",
                "type": "string",
            },
            "ClientStatus": {
                "enum": ["active", "inactive", "archived"],
                "title": "ClientStatus",
                "type": "string",
            },
            "Gender": {"enum": ["male", "female"], "title": "Gender", "type": "string"},
        },
        "required": ["client_id"],
    },
}
