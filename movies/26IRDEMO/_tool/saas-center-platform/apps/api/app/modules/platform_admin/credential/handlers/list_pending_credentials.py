from app.infrastructure.persistence.new_repository import offset_page
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.auth.account.repository import AccountRepository
from app.modules.person.credential.presigned import attach_presigned_urls
from app.modules.person.credential.repository import PersonCredentialRepository
from app.modules.person.credential.schemas import CredentialResponse
from app.modules.person.person.repository import PersonRepository

from ..schemas import AdminCredentialListResponse, AdminCredentialResponse


async def list_pending_credentials_handler(
    uow: UnitOfWork,
    *,
    credential_type: str | None = None,
    page: int = 1,
    limit: int = 50,
) -> AdminCredentialListResponse:
    # Person/Account 정보를 머지해 어드민이 한 화면에서 처리.
    credential_repo = uow.repo(PersonCredentialRepository)
    person_repo = uow.repo(PersonRepository)
    account_repo = uow.repo(AccountRepository)

    credentials, page_meta = await credential_repo.list_pending_with_page(
        credential_type=credential_type,
        page=page,
        size=limit,
    )
    total = page_meta["total"]

    # Person + Account 정보 일괄 조회 (N+1 방지)
    person_ids = list({c.person_id for c in credentials})
    persons = await person_repo.list_by_ids(person_ids) if person_ids else []
    person_by_id = {p.id: p for p in persons}

    account_ids = [p.account_id for p in persons if p.account_id]
    accounts = await _fetch_accounts(account_repo, account_ids) if account_ids else []
    account_by_id = {a.id: a for a in accounts}

    # 응답 조립
    items: list[AdminCredentialResponse] = []
    for c in credentials:
        base = CredentialResponse.from_orm_model(c).model_dump()
        person = person_by_id.get(c.person_id)
        account = account_by_id.get(person.account_id) if person else None
        items.append(
            AdminCredentialResponse(
                **base,
                person_name=person.name if person else None,
                person_email=account.email if account else None,
            )
        )

    await attach_presigned_urls(items)

    return AdminCredentialListResponse(
        items=items,
        **offset_page(total, (page - 1) * limit, limit),
    )


async def _fetch_accounts(
    account_repo: AccountRepository,
    account_ids: list[str],
):
    # AccountRepository에 list_by_ids 없어 개별 조회 — 추가되면 배치로. ponytail: N+1, list_by_ids 추가 시 교체
    accounts = []
    for aid in account_ids:
        account = await account_repo.find_by_id(aid)
        if account:
            accounts.append(account)
    return accounts


TOOL = {
    "name": "list_pending_credentials_handler",
    "permission": None,
    "purpose": "검증 대기 중인 자격 목록을 조회한다.",
    "keywords": ["검증 대기 자격", "승인 대기 자격", "pending credentials"],
    "boundaries": "운영자 전용 — '검증 대기' 자격 목록(읽기). 승인/반려는 application의 approve·reject_credential_handler.",
    "output": "검증 대기 자격 목록 (AdminCredentialListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "credential_type": {
                "type": "string",
                "title": "자격 종류 필터",
                "description": "자격 종류 필터(certification/education 등, 선택).",
            },
            "page": {
                "type": "integer",
                "title": "페이지",
                "minimum": 1,
                "description": "페이지 번호(1부터).",
            },
            "limit": {
                "type": "integer",
                "title": "개수",
                "description": "가져올 개수(기본 50).",
            },
        },
        "required": [],
    },
}
