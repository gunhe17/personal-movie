from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from app.modules.center.facade import CenterFacade, OperatingTimeFacade
from app.modules.llm.facade import CreditFacade
from app.modules.subscription.facade import SubscriptionFacade
from app.modules.center.center.schemas import CenterCreate, CenterResponse


async def create_center_handler(
    data: CenterCreate,
    uow: UnitOfWork,
    *,
    event_group_id: str,
    actor_id: str,
) -> CenterResponse:
    # 플랫폼 관리자용 직접 생성 (센터 신청 승인 경로가 아님)
    center_facade = CenterFacade(uow)
    center_atomic, center = await center_facade.create_center(data)

    operating_time_facade = OperatingTimeFacade(uow)
    (
        operating_time_atomic,
        _,
    ) = await operating_time_facade.initialize_default_operating_times(
        center_id=center.id
    )

    sub_facade = SubscriptionFacade(uow)
    sub_atomic, sub = await sub_facade.create_trial(center.id)

    credit_facade = CreditFacade(uow)
    credit_atomic, _ = await credit_facade.initialize_credit(
        center_id=center.id,
        plan_type=sub.plan,
        period_start=sub.current_period_start,
        period_end=sub.current_period_end,
    )

    await emit(
        uow,
        "center_created",
        event_group_id=event_group_id,
        atomics=[center_atomic, operating_time_atomic, sub_atomic, credit_atomic],
        center_id=center.id,
        actor_id=actor_id,
        actor_type="admin",
    )
    return CenterResponse.model_validate(center)


TOOL = {
    "name": "create_center_handler",
    "permission": None,
    "agent_exposed": False,
    "purpose": "새 상담 센터를 직접 생성한다.",
    "keywords": [
        "create center",
        "센터 생성",
        "센터 만들기",
        "지점 개설",
        "센터 등록",
        "새 센터",
    ],
    "boundaries": "센터를 '직접' 생성한다. 개설 '신청'을 승인해 만드는 흐름은 approve_center_application_app_handler. 정지/종료/복구는 suspend·terminate·restore_center_handler.",
    "output": "생성된 센터 (CenterResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {
                "description": "센터 이름.",
                "maxLength": 100,
                "minLength": 1,
                "title": "센터명",
                "type": "string",
            },
            "phone": {
                "anyOf": [
                    {"pattern": "^\\d{2,3}-\\d{3,4}-\\d{4}$", "type": "string"},
                    {"type": "null"},
                ],
                "default": None,
                "description": "전화번호(02-1234-5678 형식, 선택).",
                "title": "전화번호",
            },
            "address": {
                "anyOf": [{"$ref": "#/$defs/AddressInfo"}, {"type": "null"}],
                "default": None,
                "description": "주소 정보(우편번호·주소·상세, 선택).",
            },
            "description": {
                "anyOf": [{"type": "string"}, {"type": "null"}],
                "default": None,
                "title": "소개",
                "description": "센터 소개(선택).",
            },
            "logo_url": {
                "anyOf": [{"maxLength": 500, "type": "string"}, {"type": "null"}],
                "default": None,
                "title": "로고 URL",
                "description": "로고 이미지 URL(선택).",
            },
            "image_urls": {
                "anyOf": [
                    {"items": {"type": "string"}, "type": "array"},
                    {"type": "null"},
                ],
                "default": None,
                "description": "센터 이미지 URL 목록(선택).",
                "title": "이미지 목록",
            },
            "business_registration_number": {
                "anyOf": [
                    {"pattern": "^\\d{3}-\\d{2}-\\d{5}$", "type": "string"},
                    {"type": "null"},
                ],
                "default": None,
                "description": "사업자등록번호(000-00-00000 형식, 선택).",
                "title": "사업자등록번호",
            },
            "representative_name": {
                "anyOf": [{"maxLength": 100, "type": "string"}, {"type": "null"}],
                "default": None,
                "description": "대표자 이름(선택).",
                "title": "대표자명",
            },
        },
        "$defs": {
            "AddressInfo": {
                "properties": {
                    "zip_code": {
                        "anyOf": [
                            {"pattern": "^\\d{5}$", "type": "string"},
                            {"type": "null"},
                        ],
                        "default": None,
                        "description": "5자리 우편번호",
                        "title": "Zip Code",
                    },
                    "address": {
                        "anyOf": [
                            {"maxLength": 300, "type": "string"},
                            {"type": "null"},
                        ],
                        "default": None,
                        "description": "주소 (도로명/지번)",
                        "title": "Address",
                    },
                    "detail": {
                        "anyOf": [
                            {"maxLength": 200, "type": "string"},
                            {"type": "null"},
                        ],
                        "default": None,
                        "description": "상세주소",
                        "title": "Detail",
                    },
                },
                "title": "AddressInfo",
                "type": "object",
            }
        },
        "required": ["name"],
    },
}
