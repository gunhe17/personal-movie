# 어드민 계정 상세 '자격 정보' 탭 — 검증 상태별 우선 정렬(pending→unverified→rejected→verified).

from app.core.exceptions import EntityNotFoundException
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.auth.account.repository import AccountRepository
from app.modules.person.credential.presigned import attach_presigned_urls
from app.modules.person.credential.repository import PersonCredentialRepository
from app.modules.person.credential.schemas import CredentialResponse
from app.modules.person.person.repository import PersonRepository

from ..schemas import AdminCredentialResponse


# 검증 상태 표시 우선순위 (어드민 화면 정렬용)
_STATUS_ORDER = {
    "pending": 0,
    "unverified": 1,
    "rejected": 2,
    "verified": 3,
}


async def list_account_credentials_handler(
    account_id: str,
    uow: UnitOfWork,
) -> list[AdminCredentialResponse]:
    account_repo = uow.repo(AccountRepository)
    person_repo = uow.repo(PersonRepository)
    credential_repo = uow.repo(PersonCredentialRepository)

    account = await account_repo.find_by_id(account_id)
    if not account:
        raise EntityNotFoundException(f"Account not found: {account_id}")

    person = await person_repo.find_by_account_id(account_id)
    if not person:
        # account는 있지만 person이 없는 경우 → 빈 목록 (정상 케이스)
        return []

    credentials = await credential_repo.list_by_person(person.id)

    # 검증 상태 우선 정렬 + 같은 상태 내에서는 신청일(요청 → 생성) 최신순
    credentials_sorted = sorted(
        credentials,
        key=lambda c: (
            _STATUS_ORDER.get(c.status, 99),
            -(
                c.requested_at.timestamp()
                if c.requested_at
                else c.created_at.timestamp()
            ),
        ),
    )

    items: list[AdminCredentialResponse] = []
    for c in credentials_sorted:
        base = CredentialResponse.from_orm_model(c).model_dump()
        items.append(
            AdminCredentialResponse(
                **base,
                person_name=person.name,
                person_email=account.email,
            )
        )
    return await attach_presigned_urls(items)


TOOL = {
    "name": "list_account_credentials_handler",
    "permission": None,
    "purpose": "특정 계정의 자격 목록을 운영자가 조회한다.",
    "keywords": ["계정 자격 목록", "어드민 자격 조회", "account credentials"],
    "boundaries": "운영자 전용 — 한 계정의 자격 목록(읽기). 검증 대기는 list_pending_credentials_handler.",
    "output": "계정 자격 목록 (AdminCredentialResponse 배열).",
    "input_schema": {
        "type": "object",
        "properties": {
            "account_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 계정",
                "description": "자격을 조회할 계정의 UUID.",
            },
        },
        "required": ["account_id"],
    },
}
