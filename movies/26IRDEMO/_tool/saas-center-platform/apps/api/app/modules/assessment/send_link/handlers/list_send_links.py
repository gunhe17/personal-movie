from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ..repository import AssessmentSendLinkRepository
from ..services import ListSendLinksService
from ..schemas import SendLinkSummary


async def list_send_links_handler(
    center_id: str,
    case_id: str,
    uow: UnitOfWork,
) -> list[SendLinkSummary]:
    repo = uow.repo(AssessmentSendLinkRepository)
    service = ListSendLinksService(repo)

    send_links = await service.execute(center_id, case_id)

    return [SendLinkSummary.model_validate(link) for link in send_links]


TOOL = {
    "name": "list_send_links_handler",
    "permission": "read:send_link",
    "purpose": "검사 케이스의 응답 링크 발송 목록을 조회한다.",
    "keywords": ["응답 링크 목록", "검사 링크 발송 목록", "send link 목록"],
    "boundaries": "케이스의 응답 링크 발송 목록(읽기). 결과 발송 목록은 list_send_results_handler.",
    "output": "케이스 응답 링크 발송 목록 (SendLinkSummary 배열).",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 케이스",
                "description": "응답 링크 발송을 조회할 검사 케이스의 UUID.",
            },
        },
        "required": ["case_id"],
    },
}
