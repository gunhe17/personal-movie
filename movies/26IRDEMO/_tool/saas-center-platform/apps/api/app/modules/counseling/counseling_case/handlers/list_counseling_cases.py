from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..schemas import CounselingCaseListResponse
from ...facade import CounselingCaseFacade


async def list_counseling_cases_handler(
    center_id: str,
    owner_scope: str | None,
    status: str | None,
    page: int,
    size: int,
    uow: UnitOfWork,
) -> CounselingCaseListResponse:
    facade = CounselingCaseFacade(uow)

    response = await facade.list_cases_with_response(
        center_id, owner_scope, status, page, size
    )

    return response


TOOL = {
    "name": 'list_counseling_cases_handler',
    "permission": None,
    "purpose": '상담 케이스 목록을 상태로 거르고 페이지 단위로 조회한다.',
    "keywords": ['상담 케이스 목록', '상담 사례 목록', 'counseling case 리스트'],
    "boundaries": '상담 케이스 목록(읽기). 단건은 get_counseling_case_handler.',
    "output": '상담 케이스 목록 (CounselingCaseListResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'status': {'type': 'string', 'title': '상태 필터', 'description': '케이스 상태 필터(선택, 예: in_progress | completed | cancelled).'},
            'page': {'type': 'integer', 'title': '페이지', 'minimum': 1, 'description': '페이지 번호(1부터).'},
            'size': {'type': 'integer', 'title': '페이지 크기', 'description': '페이지당 개수.'},
        },
        "required": ['page', 'size'],
    },
}
