from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..repository import AssessmentSendResultRepository
from ..services import ListSendResultsService
from ..schemas import SendResultSummary


async def list_send_results_handler(
    center_id: str,
    case_id: str,
    uow: UnitOfWork,
) -> list[SendResultSummary]:
    repo = uow.repo(AssessmentSendResultRepository)
    service = ListSendResultsService(repo)

    send_results = await service.execute(center_id, case_id)

    return [SendResultSummary.model_validate(r) for r in send_results]


TOOL = {
    "name": "list_send_results_handler",
    "permission": "read:send_link",
    "purpose": "검사 케이스의 결과 발송 목록을 조회한다.",
    "keywords": ["결과 발송 목록", "검사 결과 전송 목록", "send result 목록"],
    "boundaries": "케이스의 결과 발송 목록(읽기). 링크 발송 목록은 list_send_links_handler.",
    "output": "케이스 결과 발송 목록 (SendResultSummary 배열).",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 케이스",
                "description": "결과 발송을 조회할 검사 케이스의 UUID.",
            },
        },
        "required": ["case_id"],
    },
}
