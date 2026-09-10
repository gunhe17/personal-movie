from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.billing.facade import PriceListFacade
from app.modules.billing.price_list.schemas import PriceListResponse, PriceListUpdate
from app.modules.event import emit


async def update_price_list_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    price_list_id: str,
    data: PriceListUpdate,
    uow: UnitOfWork,
    actor_id: str,
) -> PriceListResponse:
    facade = PriceListFacade(uow)
    atomic, record = await facade.update_price_list(
        center_id=center_id,
        price_list_id=price_list_id,
        data=data,
    )
    await emit(
        uow,
        "price_list_updated",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return PriceListResponse.model_validate(record)


TOOL = {
    "name": "update_price_list_handler",
    "permission": "write:billing",
    "purpose": "가격표 항목을 수정한다.",
    "keywords": ["update price list", "가격표 수정", "요금표 변경", "price list 수정"],
    "boundaries": "가격표 수정. 생성은 create_price_list_handler.",
    "output": "수정된 가격표 항목 (PriceListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "price_list_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 가격표",
                "description": "수정할 가격표의 UUID.",
            },
            "service_type": {
                "anyOf": [{"$ref": "#/$defs/ServiceType"}, {"type": "null"}],
                "default": None,
                "description": "서비스 유형(미지정 시 유지).",
            },
            "service_name": {
                "anyOf": [
                    {"maxLength": 100, "minLength": 1, "type": "string"},
                    {"type": "null"},
                ],
                "default": None,
                "description": "서비스명(미지정 시 유지).",
                "title": "서비스명",
            },
            "reference_id": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "description": "연관 리소스 ID(미지정 시 유지).",
                "title": "연관 리소스",
            },
            "unit_price": {
                "anyOf": [{"minimum": 0, "type": "integer"}, {"type": "null"}],
                "default": None,
                "description": "단가(원, 미지정 시 유지).",
                "title": "단가",
            },
            "is_active": {
                "anyOf": [{"type": "boolean"}, {"type": "null"}],
                "default": None,
                "description": "활성화 여부(미지정 시 유지).",
                "title": "활성 여부",
            },
            "memo": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "description": "메모(미지정 시 유지).",
                "title": "메모",
            },
        },
        "$defs": {
            "ServiceType": {
                "enum": ["counseling", "assessment", "package"],
                "title": "ServiceType",
                "type": "string",
            }
        },
        "required": ["price_list_id"],
    },
}
