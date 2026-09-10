from datetime import timedelta

from app.core.datetime_utils import utc_now
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..repository import CounselingCaseAnalysisRepository
from ..schemas import CaseAnalysisResponse
from ..services import FindLatestAnalysisService

# 워커가 죽으면 processing 행이 영원히 남는다 — 그 행을 그대로 돌려주면 화면이
# 끝나지 않는 "분석 중"에 갇힌다. 이 시간을 넘긴 processing은 없는 셈 치고
# 직전 완료본을 보여준다(LLM 호출은 길어야 수 분).
STALE_PROCESSING = timedelta(minutes=15)


async def get_latest_case_analysis_handler(
    case_id: str,
    center_id: str,
    uow: UnitOfWork,
) -> CaseAnalysisResponse | None:
    repo = uow.repo(CounselingCaseAnalysisRepository)
    service = FindLatestAnalysisService(repo)
    analysis = await service.execute(case_id, center_id)

    if (
        analysis
        and analysis.status == "processing"
        and analysis.created_at < utc_now() - STALE_PROCESSING
    ):
        analysis = await service.execute(case_id, center_id, completed_only=True)

    # 분석 부재는 정상 상태 — 404 대신 200 null (케이스 진입마다 뜨는 콘솔 노이즈 방지)
    if not analysis:
        return None
    return CaseAnalysisResponse.model_validate(analysis)


TOOL = {
    "name": "get_latest_case_analysis_handler",
    "permission": "read:counseling",
    "purpose": "상담 케이스의 가장 최근 종단 분석 결과를 조회한다.",
    "keywords": ["최신 분석", "케이스 분석 결과", "종단 분석 조회", "latest analysis"],
    "boundaries": "가장 최근 케이스 분석 1건(읽기). 전체 이력은 list_case_analyses_handler, 분석 시작은 create_case_analysis_handler.",
    "output": "가장 최근 종단 분석 (CaseAnalysisResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 케이스",
                "description": "최근 분석을 조회할 상담 케이스의 UUID.",
            },
        },
        "required": ["case_id"],
    },
}
