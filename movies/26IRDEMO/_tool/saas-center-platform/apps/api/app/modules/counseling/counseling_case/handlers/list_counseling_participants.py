from app.infrastructure.persistence.unit_of_work import UnitOfWork
from ...counseling_case_participant.schemas import CounselingCaseParticipantListResponse
from ...facade import CounselingCaseFacade


async def list_counseling_participants_handler(
    case_id: str,
    center_id: str,
    owner_scope: str | None,
    active_only: bool,
    uow: UnitOfWork,
) -> CounselingCaseParticipantListResponse:
    facade = CounselingCaseFacade(uow)

    await facade.verify_case_readable(case_id, center_id, owner_scope)

    response = await facade.list_participants_with_response(
        case_id=case_id,
        center_id=center_id,
        counselor_id=None,
        active_only=active_only,
    )

    return response


TOOL = {
    "name": "list_counseling_participants_handler",
    "permission": "read:counseling",
    "purpose": "상담 케이스의 참여자 목록을 조회한다.",
    "keywords": ["케이스 참여자 목록", "상담 대상 조회", "participant 목록"],
    "boundaries": "케이스 참여자 목록(읽기). 추가는 add_counseling_participant_handler.",
    "output": "케이스 참여자 목록 (CounselingCaseParticipantListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "case_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 케이스",
                "description": "참여자를 조회할 상담 케이스의 UUID.",
            },
            "active_only": {
                "type": "boolean",
                "title": "활성만",
                "description": "true면 현재 참여 중인 참여자만.",
            },
        },
        "required": ["case_id", "active_only"],
    },
}
