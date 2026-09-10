# 청구서 생성(BillableFacade)과 바우처 차감(VoucherFacade)이 같은 UoW — 차감 실패 시 청구서까지 롤백
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.billing.facade import BillableFacade
from app.modules.billing.billable.schemas import (
    BillableCreate,
    BillableResponse,
    BillableItemResponse,
)
from app.modules.voucher.facade.voucher_facade import VoucherFacade


async def create_billable_handler(
    *,
    event_group_id: uuid_str,
    center_id: str,
    account_id: str,
    data: BillableCreate,
    uow: UnitOfWork,
    actor_id: str | None,
) -> BillableResponse:
    atomic, result = await BillableFacade(uow).create_billable(
        center_id=center_id,
        data=data,
        account_id=account_id,
    )

    voucher_atomics, warnings = await VoucherFacade(uow).consume_sessions(
        center_id=center_id,
        client_id=result.client_id,
        billable_date=result.billable_date,
        consumption=result.voucher_consumption,
        amount_consumption=result.voucher_amount_consumption,
    )

    response = BillableResponse.model_validate(result.billable)
    response.items = [BillableItemResponse.model_validate(i) for i in result.items]

    await emit(
        uow,
        "billable_created",
        event_group_id=event_group_id,
        atomics=[atomic, *voucher_atomics],
        center_id=center_id,
        actor_id=actor_id,
    )

    response.warnings = warnings
    return response


TOOL = {
    "name": "create_billable_handler",
    "permission": "write:billing",
    "purpose": "내담자에게 청구할 항목들을 묶어 새 청구서를 발행하고, 연결된 바우처가 있으면 회차/금액을 차감한다.",
    "keywords": [
        "create billable",
        "청구서 생성",
        "청구서 발행",
        "청구하기",
        "비용 청구",
        "결제 청구서",
        "인보이스",
        "청구 등록",
        "바우처 차감",
        "정산 항목 추가",
    ],
    "boundaries": "내담자 단위로 '청구서(billable)'를 새로 만드는 도구다. 이미 만든 청구서의 내용을 고치려면 update_billable_handler, 완납 처리는 complete_billable_handler를 쓴다. 청구서를 만들기 전 자동 채움 후보가 필요하면 build_billable_prefill_for_case_handler를 먼저 호출한다. 청구 권한이 필요하다.",
    "output": "발행된 청구서 (BillableResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "client_id": {
                "description": "내담자 ID",
                "title": "내담자",
                "type": "string",
            },
            "billable_date": {
                "description": "청구 일자",
                "format": "date",
                "title": "청구 일자",
                "type": "string",
            },
            "due_date": {
                "anyOf": [{"format": "date", "type": "string"}, {"type": "null"}],
                "default": None,
                "description": "납부 기한",
                "title": "납부 기한",
            },
            "memo": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "description": "메모",
                "title": "메모",
            },
            "discount_amount": {
                "default": 0,
                "description": "청구서 전체 할인액 (묶음 할인 등)",
                "minimum": 0,
                "title": "할인액",
                "type": "integer",
            },
            "subsidy_amount": {
                "default": 0,
                "description": "청구서 전체 바우처 지원금. > 0이면 items 중 최소 1개에 client_voucher_id가 있어야 하며, 사용된 바우처(들)의 remaining_amount에서 차감된다.",
                "minimum": 0,
                "title": "바우처 지원금",
                "type": "integer",
            },
            "items": {
                "description": "청구 항목 (최소 1개)",
                "items": {"$ref": "#/$defs/BillableItemCreate"},
                "minItems": 1,
                "title": "청구 항목",
                "type": "array",
            },
        },
        "required": ["client_id", "billable_date", "items"],
        "$defs": {
            "BillableItemCreate": {
                "properties": {
                    "item_type": {
                        "$ref": "#/$defs/BillableItemType",
                        "description": "항목 유형",
                    },
                    "item_id": {
                        "anyOf": [{"type": "string"}, {"type": "null"}],
                        "default": None,
                        "description": "서비스/상품 참조 ID",
                        "title": "Item Id",
                    },
                    "related_type": {
                        "anyOf": [{"type": "string"}, {"type": "null"}],
                        "default": None,
                        "description": "연관 유형: counseling_session, assessment_session",
                        "title": "Related Type",
                    },
                    "related_case_id": {
                        "anyOf": [{"type": "string"}, {"type": "null"}],
                        "default": None,
                        "description": "연관 케이스 ID",
                        "title": "Related Case Id",
                    },
                    "related_session_id": {
                        "anyOf": [{"type": "string"}, {"type": "null"}],
                        "default": None,
                        "description": "연관 세션 ID (회차별 추적)",
                        "title": "Related Session Id",
                    },
                    "client_voucher_id": {
                        "anyOf": [{"type": "string"}, {"type": "null"}],
                        "default": None,
                        "description": "연결된 내담자 바우처 ID — set 시 생성 단계에서 remaining_sessions를 quantity만큼 차감",
                        "title": "Client Voucher Id",
                    },
                    "price_list_id": {
                        "anyOf": [{"type": "string"}, {"type": "null"}],
                        "default": None,
                        "description": "단가표 참조 ID",
                        "title": "Price List Id",
                    },
                    "description": {
                        "description": "항목 설명",
                        "maxLength": 200,
                        "minLength": 1,
                        "title": "Description",
                        "type": "string",
                    },
                    "quantity": {
                        "default": 1,
                        "description": "수량",
                        "minimum": 1,
                        "title": "Quantity",
                        "type": "integer",
                    },
                    "unit_price": {
                        "description": "단가",
                        "title": "Unit Price",
                        "type": "integer",
                    },
                    "provided_at": {
                        "anyOf": [
                            {"format": "date-time", "type": "string"},
                            {"type": "null"},
                        ],
                        "default": None,
                        "description": "서비스 제공 일시",
                        "title": "Provided At",
                    },
                    "memo": {
                        "anyOf": [{"type": "string"}, {"type": "null"}],
                        "default": None,
                        "description": "메모",
                        "title": "Notes",
                    },
                },
                "required": ["item_type", "description", "unit_price"],
                "title": "BillableItemCreate",
                "type": "object",
            },
            "BillableItemType": {
                "enum": ["service", "product", "package"],
                "title": "BillableItemType",
                "type": "string",
            },
        },
    },
}
