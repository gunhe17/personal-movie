from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit

from ... import CreateInstitutionService
from ..repository import InstitutionRepository
from ..schemas import InstitutionCreate, InstitutionResponse


async def create_institution_handler(
    data: InstitutionCreate,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str | None,
) -> InstitutionResponse:
    repo = uow.repo(InstitutionRepository)
    service = CreateInstitutionService(repo)
    atomic, institution = await service.execute(
        name=data.name,
        phone=data.phone,
        address=data.address.model_dump() if data.address else None,
    )
    await emit(
        uow,
        "institution_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        actor_id=actor_id,
    )

    return InstitutionResponse.model_validate(institution)


TOOL = {
    "name": "create_institution_handler",
    "permission": None,
    "purpose": "새 의료·돌봄 기관(병원·센터 등) 한 곳을 전역 참조 테이블에 등록한다.",
    "keywords": ["기관 등록", "병원 추가", "기관 생성", "새 기관 만들기", "거래처 등록", "협력기관 추가", "institution 생성", "기관 마스터 등록"],
    "boundaries": "기관을 '새로 만드는' 전용 도구다. 기존 기관 정보를 바꾸려면 update_institution_handler, 한 곳을 자세히 보려면 get_institution_handler, 목록·검색은 list_institutions_handler를 쓴다. 기관은 센터 스코프가 없는 전역 참조 데이터이며 로그인한 사용자만 생성할 수 있다.",
    "output": "등록된 기관 (InstitutionResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {"maxLength": 100, "minLength": 1, "title": "기관 이름", "type": "string", "description": "기관 이름."},
            "phone": {"anyOf": [{"pattern": "^\\d{2,3}-\\d{3,4}-\\d{4}$", "type": "string"}, {"type": "null"}], "default": None, "title": "전화번호", "description": "전화번호(선택, 예: 02-1234-5678)."},
            "address": {"anyOf": [{"$ref": "#/$defs/AddressInfo"}, {"type": "null"}], "default": None, "title": "주소"},
        },
        "$defs": {"AddressInfo": {"properties": {"zip_code": {"anyOf": [{"pattern": "^\\d{5}$", "type": "string"}, {"type": "null"}], "default": None, "title": "우편번호"}, "address": {"anyOf": [{"maxLength": 300, "type": "string"}, {"type": "null"}], "default": None, "title": "주소"}, "detail": {"anyOf": [{"maxLength": 200, "type": "string"}, {"type": "null"}], "default": None, "title": "상세주소"}}, "title": "AddressInfo", "type": "object"}},
        "required": ["name"],
    },
}
