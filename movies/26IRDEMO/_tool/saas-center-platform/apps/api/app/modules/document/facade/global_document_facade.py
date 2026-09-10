from __future__ import annotations

from app.infrastructure.persistence.new_repository import Page
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.storage import StorageClient

from ..global_document.models import GlobalDocument
from ..global_document.repository import GlobalDocumentRepository
from ..global_document.services import (
    DeleteGlobalDocumentService,
    GlobalFileInput,
    ListGlobalDocumentsByIdsService,
    ListGlobalDocumentsService,
    UploadGlobalDocumentService,
)

__all__ = ["GlobalDocumentFacade", "GlobalFileInput"]


class GlobalDocumentFacade:
    # 확장자 변형 묶음은 호출자(voucher는 voucher_extractions.document_ids)가 관리 — facade는 묶지 않는다
    def __init__(self, uow: UnitOfWork, storage: StorageClient | None = None):
        self._uow = uow
        self._storage = storage

    async def upload(
        self,
        *,
        name: str,
        files: list[GlobalFileInput],
        uploader_id: str | None = None,
    ) -> list[GlobalDocument]:
        repo = self._uow.repo(GlobalDocumentRepository)
        service = UploadGlobalDocumentService(repo, self._storage)
        return await service.execute(
            name=name,
            files=files,
            uploader_id=uploader_id,
        )

    async def add_variant(
        self,
        *,
        name: str,
        data: bytes,
        file_type: str,
        original_name: str | None = None,
        content_type: str | None = None,
        uploader_id: str | None = None,
    ) -> GlobalDocument:
        repo = self._uow.repo(GlobalDocumentRepository)
        service = UploadGlobalDocumentService(repo, self._storage)
        docs = await service.execute(
            name=name,
            files=[
                GlobalFileInput(
                    data=data,
                    file_type=file_type,
                    original_name=original_name,
                    content_type=content_type,
                )
            ],
            uploader_id=uploader_id,
        )
        return docs[0]

    async def get_many(self, ids: list[str]) -> list[GlobalDocument]:
        repo = self._uow.repo(GlobalDocumentRepository)
        return await ListGlobalDocumentsByIdsService(repo).execute(ids)

    async def get_many_including_deleted(
        self, ids: list[str]
    ) -> list[GlobalDocument]:
        repo = self._uow.repo(GlobalDocumentRepository)
        return await ListGlobalDocumentsByIdsService(repo).execute(ids, include_deleted=True)

    async def list(
        self,
        *,
        q: str | None = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[GlobalDocument], Page]:
        repo = self._uow.repo(GlobalDocumentRepository)
        return await ListGlobalDocumentsService(repo).execute(q=q, page=page, size=size)

    async def delete(self, document_id: str) -> bool:
        repo = self._uow.repo(GlobalDocumentRepository)
        return await DeleteGlobalDocumentService(repo).execute(document_id)
