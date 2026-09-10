from app.infrastructure.persistence.unit_of_work import UnitOfWork

from ..repository import PersonCredentialRepository
from ..schemas import CredentialListResponse, CredentialResponse
from ..services import ListCredentialsService
from ..stats import compute_stats


async def list_credentials_handler(
    person_id: str,
    uow: UnitOfWork,
    *,
    credential_type: str | None = None,
) -> CredentialListResponse:
    # stats는 credential_type 필터 무관하게 person 전체로 계산 — 인증 정책 판정은 백엔드 stats 한 곳.
    repo = uow.repo(PersonCredentialRepository)
    service = ListCredentialsService(repo)

    # 화면 표시용: credential_type 필터 적용
    filtered = await service.execute(person_id, credential_type=credential_type)

    # stats용: 항상 전체 (필터 없음)
    all_credentials = (
        filtered if credential_type is None else await service.execute(person_id)
    )

    items = [CredentialResponse.from_orm_model(c) for c in filtered]
    stats = compute_stats(all_credentials)
    return CredentialListResponse(items=items, stats=stats)


TOOL = {
    "name": "list_credentials_handler",
    "permission": None,
    "purpose": "개인의 자격 목록을 종류로 거르고 조회한다.",
    "keywords": ["자격 목록", "자격증 조회", "credential 목록"],
    "boundaries": "개인 자격 목록(읽기). 단건 등록은 create_credential_handler.",
    "output": "개인 자격 목록 (CredentialListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "credential_type": {
                "type": "string",
                "title": "종류 필터",
                "enum": ["education", "career", "certification"],
                "description": "자격 종류 필터(선택): education/career/certification.",
            },
        },
        "required": [],
    },
}
