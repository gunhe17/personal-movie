from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ... import ListInstitutionsService
from ..repository import InstitutionRepository
from ..schemas import InstitutionListResponse, InstitutionSummary


async def list_institutions_handler(
    keyword: str | None,
    page: int,
    size: int,
    uow: UnitOfWork,
) -> InstitutionListResponse:
    repo = uow.repo(InstitutionRepository)
    service = ListInstitutionsService(repo)
    institutions, page_meta = await service.execute(
        keyword=keyword,
        page=page,
        size=size,
    )

    return InstitutionListResponse(
        items=[InstitutionSummary.model_validate(inst) for inst in institutions],
        **page_meta,
    )


TOOL = {
    "name": "list_institutions_handler",
    "permission": None,
    "purpose": "기관 목록을 이름 키워드로 검색하고 페이지 단위로 조회한다.",
    "keywords": [
        "기관 목록",
        "병원 검색",
        "기관 찾기",
        "거래처 목록",
        "기관 리스트",
        "이름으로 기관 검색",
        "institution 검색",
        "기관 페이지 조회",
    ],
    "boundaries": "여러 기관을 요약(id·이름)으로 훑고 검색하는 도구다. id를 이미 알고 전체 상세를 보려면 get_institution_handler를 쓴다. 생성은 create_institution_handler, 변경은 update_institution_handler, 삭제는 delete_institution_handler. 읽기 전용이며 로그인한 사용자만 호출할 수 있다.",
    "output": "기관 요약 목록 (InstitutionListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "keyword": {
                "type": "string",
                "title": "이름 검색어",
                "description": "기관 이름 부분 일치 검색어(선택, 비우면 전체).",
            },
            "page": {
                "type": "integer",
                "title": "페이지",
                "minimum": 1,
                "description": "페이지 번호(1부터).",
            },
            "size": {
                "type": "integer",
                "title": "페이지 크기",
                "minimum": 1,
                "maximum": 100,
                "description": "한 페이지 기관 수(1~100, 기본 20).",
            },
        },
        "required": ["page", "size"],
    },
}
