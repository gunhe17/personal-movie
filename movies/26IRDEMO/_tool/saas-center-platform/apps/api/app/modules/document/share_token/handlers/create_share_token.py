from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.datetime_utils import to_utc_naive
from app.modules.event import emit
from ..schemas import ShareTokenCreate, ShareTokenResponse
from ..schemas import CreateShareTokenCommand
from ..repository import ShareTokenRepository
from ..services import CreateShareTokenService
from ...document.repository import DocumentRepository
from ...document.services import GetDocumentService


async def create_share_token_handler(
    *,
    event_group_id: uuid_str,
    data: ShareTokenCreate,
    center_id: str,
    member_id: str,
    account_id: str,
    uow: UnitOfWork,
) -> ShareTokenResponse:
    document_repo = uow.repo(DocumentRepository)
    share_token_repo = uow.repo(ShareTokenRepository)

    # 문서 조회 + 권한 검증
    get_document_service = GetDocumentService(document_repo)
    await get_document_service.execute(
        document_id=data.document_id,
        center_id=center_id
    )

    command = CreateShareTokenCommand(
        document_id=data.document_id,
        created_by=account_id,
        expires_at=to_utc_naive(data.expires_at),
        max_downloads=data.max_downloads,
        password=data.password,
    )

    create_service = CreateShareTokenService(share_token_repo)
    atomic, share_token = await create_service.execute(command)
    await emit(
        uow,
        "share_token_created",
        event_group_id=event_group_id,
        atomics=[atomic],
        center_id=center_id,
        actor_id=member_id,
    )


    return ShareTokenResponse.model_validate(share_token)


TOOL = {
    "name": 'create_share_token_handler',
    "permission": None,
    "purpose": '문서 공유 토큰(링크)을 생성한다.',
    "keywords": ['공유 링크 생성', '공유 토큰', '문서 공유', 'share token 생성'],
    "boundaries": '문서 공유 토큰 생성. 토큰 다운로드는 download_with_share_token_handler, 검증은 validate_share_token_handler.',
    "output": '생성된 문서 공유 토큰 (ShareTokenResponse).',
    "input_schema": {
        "type": "object",
        "properties": {
            'document_id': {'type': 'string', 'format': 'uuid', 'title': '대상 문서', 'description': '공유 토큰을 만들 문서의 UUID.'},
            'expires_at': {'format': 'date-time', 'title': '만료 시각', 'type': 'string', 'description': '공유 링크 만료 시각.'},
            'max_downloads': {'anyOf': [{'type': 'integer'}, {'type': 'null'}], 'default': None, 'title': '최대 다운로드 수'},
            'password': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'default': None, 'title': '비밀번호'},
        },
        "required": ['document_id', 'expires_at'],
    },
}
