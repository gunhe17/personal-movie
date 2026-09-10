from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ... import GetInstitutionService
from ..repository import InstitutionRepository
from ..schemas import InstitutionResponse


async def get_institution_handler(
    institution_id: str,
    uow: UnitOfWork,
) -> InstitutionResponse:
    repo = uow.repo(InstitutionRepository)
    service = GetInstitutionService(repo)
    institution = await service.execute(institution_id)

    return InstitutionResponse.model_validate(institution)


TOOL = {
    "name": "get_institution_handler",
    "permission": None,
    "purpose": "기관 한 곳의 상세 정보(이름·전화·주소·등록일)를 단건 조회한다.",
    "keywords": [
        "기관 조회",
        "병원 정보",
        "기관 상세",
        "거래처 정보",
        "기관 단건 보기",
        "institution 상세",
        "기관 연락처 확인",
        "기관 주소 확인",
    ],
    "boundaries": "id로 '한 곳'의 전체 상세를 보는 도구다. 여러 곳을 훑거나 이름으로 찾으려면 list_institutions_handler(요약 목록·검색)를 쓴다. 새로 만들기는 create_institution_handler, 내용 변경은 update_institution_handler. 읽기 전용이며 로그인한 사용자만 호출할 수 있다.",
    "output": "기관 상세 (InstitutionResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "institution_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 기관",
                "description": "조회할 기관의 UUID.",
            },
        },
        "required": ["institution_id"],
    },
}
