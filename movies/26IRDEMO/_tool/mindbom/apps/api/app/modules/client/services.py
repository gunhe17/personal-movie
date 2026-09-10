"""Client Services"""
import math

from app.core.exceptions import EntityNotFoundException, PermissionDeniedException
from app.modules.client.repository import ClientRepository
from app.modules.client.schemas import (
    ClientCreate,
    ClientListResponse,
    ClientResponse,
    ClientSummary,
    ClientUpdate,
)


class ListClientsService:
    """내담자 목록 조회"""
    def __init__(self, repo: ClientRepository):
        self.repo = repo

    async def execute(
        self,
        institution_id: str,
        *,
        page: int = 1,
        size: int = 20,
        search: str | None = None,
        status: str | None = None,
        gender: str | None = None,
    ) -> ClientListResponse:
        skip = (page - 1) * size
        filter_kwargs = dict(search=search, status=status, gender=gender)

        items = await self.repo.list_by_institution(
            institution_id, skip=skip, limit=size, **filter_kwargs
        )
        total = await self.repo.count_by_institution(
            institution_id, **filter_kwargs
        )

        return ClientListResponse(
            items=[ClientSummary.model_validate(c) for c in items],
            total=total,
            page=page,
            size=size,
            pages=math.ceil(total / size) if total > 0 else 1,
        )


class GetClientService:
    """내담자 상세 조회"""
    def __init__(self, repo: ClientRepository):
        self.repo = repo

    async def execute(self, client_id: str, institution_id: str) -> ClientResponse:
        client = await self.repo.get(client_id)
        if not client:
            raise EntityNotFoundException(f"내담자를 찾을 수 없습니다: {client_id}")
        if client.institution_id != institution_id:
            raise PermissionDeniedException("해당 기관의 내담자가 아닙니다.")
        return ClientResponse.model_validate(client)


class CreateClientService:
    """내담자 생성"""
    def __init__(self, repo: ClientRepository):
        self.repo = repo

    async def execute(self, institution_id: str, data: ClientCreate) -> ClientResponse:
        client = await self.repo.create({
            "institution_id": institution_id,
            **data.model_dump(exclude_unset=True),
        })
        return ClientResponse.model_validate(client)


class UpdateClientService:
    """내담자 수정"""
    def __init__(self, repo: ClientRepository):
        self.repo = repo

    async def execute(
        self, client_id: str, institution_id: str, data: ClientUpdate
    ) -> ClientResponse:
        client = await self.repo.get(client_id)
        if not client:
            raise EntityNotFoundException(f"내담자를 찾을 수 없습니다: {client_id}")
        if client.institution_id != institution_id:
            raise PermissionDeniedException("해당 기관의 내담자가 아닙니다.")

        update_data = data.model_dump(exclude_unset=True)
        if update_data:
            for key, value in update_data.items():
                setattr(client, key, value)
            await self.repo.flush()
            await self.repo.refresh(client)

        return ClientResponse.model_validate(client)


class DeleteClientService:
    """내담자 삭제 (Soft Delete)"""
    def __init__(self, repo: ClientRepository):
        self.repo = repo

    async def execute(self, client_id: str, institution_id: str) -> bool:
        client = await self.repo.get(client_id)
        if not client:
            raise EntityNotFoundException(f"내담자를 찾을 수 없습니다: {client_id}")
        if client.institution_id != institution_id:
            raise PermissionDeniedException("해당 기관의 내담자가 아닙니다.")
        return await self.repo.delete(client_id)
