from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ...facade.profile_facade import ProfileFacade
from ..schemas import ValidateDuplicateClientsRequest, ValidateDuplicateClientsResponse


async def validate_duplicate_clients_handler(
    center_id: str,
    data: ValidateDuplicateClientsRequest,
    uow: UnitOfWork,
) -> ValidateDuplicateClientsResponse:
    # 엑셀 프리뷰 진입 시 1회 호출 — 이름+생년월일 조합으로 기존 내담자 중복 일괄 확인.
    facade = ProfileFacade(uow)
    result = await facade.validate_duplicates_with_response(center_id, data)
    return result


TOOL = {
    "name": "validate_duplicate_clients_handler",
    "permission": "read:client",
    "purpose": "내담자 등록 전 중복 여부를 확인한다.",
    "keywords": ["중복 확인", "내담자 중복 체크", "duplicate 검사", "중복 검사"],
    "boundaries": "이름·연락처 등으로 내담자 '중복'을 사전 확인(읽기). 검색은 list_clients_by_filters_handler.",
    "output": "중복 확인 결과 (ValidateDuplicateClientsResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "clients": {
                "description": "중복 여부를 확인할 내담자 목록(최소 1건).",
                "items": {"$ref": "#/$defs/DuplicateClientItem"},
                "minItems": 1,
                "title": "확인 대상 목록",
                "type": "array",
            },
        },
        "$defs": {
            "DuplicateClientItem": {
                "properties": {
                    "name": {"description": "이름", "title": "Name", "type": "string"},
                    "birth_date": {
                        "anyOf": [
                            {"format": "date", "type": "string"},
                            {"type": "null"},
                        ],
                        "default": None,
                        "description": "생년월일 (없으면 체크 제외)",
                        "title": "Birth Date",
                    },
                    "guardian_phone": {
                        "anyOf": [{"type": "string"}, {"type": "null"}],
                        "default": None,
                        "description": "보호자 연락처 (high/low 구분용)",
                        "title": "Guardian Phone",
                    },
                    "guardian_birth_date": {
                        "anyOf": [
                            {"format": "date", "type": "string"},
                            {"type": "null"},
                        ],
                        "default": None,
                        "description": "보호자 생년월일 (high/low 구분용)",
                        "title": "Guardian Birth Date",
                    },
                },
                "required": ["name"],
                "title": "DuplicateClientItem",
                "type": "object",
            }
        },
        "required": ["clients"],
    },
}
