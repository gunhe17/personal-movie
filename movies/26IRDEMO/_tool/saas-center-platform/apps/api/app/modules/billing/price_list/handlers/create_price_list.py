from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.billing.facade import PriceListFacade
from app.modules.billing.price_list.schemas import PriceListCreate, PriceListResponse
from app.modules.event import emit


async def create_price_list_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    account_id: str,
    data: PriceListCreate,
    uow: UnitOfWork,
    actor_id: str,
) -> PriceListResponse:
    facade = PriceListFacade(uow)
    atomic, record = await facade.create_price_list(
        center_id=center_id,
        data=data,
        account_id=account_id,
    )
    await emit(
        uow,
        "price_list_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=actor_id,
    )
    return PriceListResponse.model_validate(record)


TOOL = {
    "name": "create_price_list_handler",
    "permission": "write:billing",
    "purpose": "센터의 가격표(price list) 항목을 생성한다.",
    "keywords": [
        "create price list",
        "가격표 생성",
        "요금표 추가",
        "price list 생성",
        "단가 등록",
    ],
    "boundaries": "가격표 생성. 수정은 update_price_list_handler, 목록은 list_price_lists_handler.",
    "output": "생성된 가격표 항목 (PriceListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "service_type": {
                "$ref": "#/$defs/ServiceType",
                "description": "서비스 유형: counseling(상담)/assessment(검사)/package(패키지).",
            },
            "service_name": {
                "description": "서비스명.",
                "maxLength": 100,
                "minLength": 1,
                "title": "서비스명",
                "type": "string",
            },
            "reference_id": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "description": "연관 리소스 ID(검사/상담/세트, 선택).",
                "title": "연관 리소스",
            },
            "unit_price": {
                "default": 0,
                "description": "단가(원, 기본 0).",
                "minimum": 0,
                "title": "단가",
                "type": "integer",
            },
            "is_active": {
                "default": True,
                "description": "활성화 여부(기본 True).",
                "title": "활성 여부",
                "type": "boolean",
            },
            "memo": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "description": "메모(선택).",
                "title": "메모",
            },
            "source": {
                "default": "manual",
                "description": "등록 출처: manual(수기)/synced(동기화, 기본 manual).",
                "title": "등록 출처",
                "type": "string",
            },
        },
        "$defs": {
            "ServiceType": {
                "enum": ["counseling", "assessment", "package"],
                "title": "ServiceType",
                "type": "string",
            }
        },
        "required": ["service_type", "service_name"],
    },
}
