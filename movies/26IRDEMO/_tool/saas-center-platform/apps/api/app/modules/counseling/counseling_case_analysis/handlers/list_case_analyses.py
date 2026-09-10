from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..repository import CounselingCaseAnalysisRepository
from ..schemas import CaseAnalysisResponse
from ..services import ListAnalysesService


async def list_case_analyses_handler(
    case_id: str,
    center_id: str,
    uow: UnitOfWork,
) -> list[CaseAnalysisResponse]:
    repo = uow.repo(CounselingCaseAnalysisRepository)
    analyses = await ListAnalysesService(repo).execute(case_id, center_id)
    return [CaseAnalysisResponse.model_validate(a) for a in analyses]


TOOL = {
    "name": "list_case_analyses_handler",
    "permission": "read:counseling",
    "purpose": "상담 케이스의 종단 분석 이력 목록을 조회한다.",
    "keywords": ["분석 이력", "케이스 분석 목록", "종단 분석 리스트", "analysis 목록"],
    "boundaries": "한 케이스의 분석 이력 전체(읽기). 최신 1건은 get_latest_case_analysis_handler.",
    "output": "케이스 종단 분석 이력 (CaseAnalysisResponse 배열).",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 케이스",
                "description": "분석 이력을 조회할 상담 케이스의 UUID.",
            },
        },
        "required": ["case_id"],
    },
}
