# 라우터가 링크 토큰(aud=assessment_link)을 검증해 send_link_id를 신뢰 — 여기선 링크 유효성·task 소속만 재검증
from app.core.exceptions import PermissionDeniedException
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.assessment.assessment_task.schemas import (
    AssessmentInfo,
    TaskResponse,
)


async def _validate_link_task(
    send_link_id: str,
    task_id: str,
    uow: UnitOfWork,
) -> str:
    from app.modules.assessment.facade import AssessmentTaskFacade, SendLinkFacade

    link = await SendLinkFacade(uow).get_active_link_public(send_link_id)
    task = await AssessmentTaskFacade(uow).get_task(task_id, link.center_id)
    if task.case_id != link.case_id or task.assessment_id not in set(
        link.assessment_ids
    ):
        raise PermissionDeniedException("이 링크로 접근할 수 없는 검사입니다")
    return link.center_id


async def get_link_task_handler(
    send_link_id: str,
    task_id: str,
    uow: UnitOfWork,
) -> TaskResponse:
    from app.modules.assessment.facade import AssessmentTaskFacade

    await _validate_link_task(send_link_id, task_id, uow)
    result = await AssessmentTaskFacade(uow).get_task_with_assessment(task_id)

    task_response = TaskResponse.model_validate(result["task"], from_attributes=True)
    task_response.assessment = AssessmentInfo(**result["assessment"])
    task_response.report_payload = None
    task_response.report_document_id = None
    task_response.opinion = None
    return task_response


# #
# main

TOOL = {
    "permission": None,  # 멤버십만
    "name": "get_link_task_handler",
    "purpose": "검사 링크 토큰으로 검사 작업을 조회한다 (내담자 공개 수행 경로).",
    "keywords": ["링크 검사 조회", "바로링크 수행", "공개 검사 조회"],
    "boundaries": "링크 토큰 스코프의 task 조회/제출. 직원용 조회는 get_task_handler.",
    "output": "검사 작업 상세 (TaskResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "send_link_id": {'type': 'string', 'format': 'uuid', 'title': '링크 전송', 'description': '검사 링크 전송의 UUID.'},
            "task_id": {'type': 'string', 'format': 'uuid', 'title': '검사 작업', 'description': '조회할 검사 작업의 UUID.'},
        },
        "required": ["send_link_id", "task_id"],
    },
}

def main() -> dict:
    return TOOL
