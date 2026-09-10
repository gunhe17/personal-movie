import hashlib

from fastapi import UploadFile

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.core.exceptions import InvalidOperationException
from app.core.logger import get_logger
from app.infrastructure.storage import StorageClient
from ..document.repository import DocumentRepository
from ..document.services import (
    GetDocumentService,
    GetDocumentByIdService,
    GetDocumentsByIdsService,
    DeleteDocumentService,
    RestoreDocumentService,
    UploadDocumentService,
    UpdateDocumentService,
)
from ..document.models import Document
from ..document.events import DocumentAtomic
from ..document.schemas import UploadDocumentCommand
from ..document.schemas import AccessLevel
from ..document.utils import DocumentPathProvider
from ..document_access.repository import DocumentAccessRepository
from ..document_access.services import CreateAccessLogService
from ..document_access.schemas import CreateAccessLogCommand
from ..share_token.repository import ShareTokenRepository
from ..share_token.services import ValidateShareTokenService, RecordDownloadService
from ..share_token.events import ShareTokenAtomic

logger = get_logger(__name__)


class DocumentFacade:
    def __init__(self, uow: UnitOfWork, storage: StorageClient | None = None):
        self._uow = uow
        self._storage = storage

    async def get_document(self, document_id: str, center_id: str) -> Document:
        doc_repo = self._uow.repo(DocumentRepository)
        service = GetDocumentService(doc_repo)
        return await service.execute(document_id, center_id)

    async def get_documents_by_ids(
        self, document_ids: list[str], center_id: str
    ) -> list[Document]:
        doc_repo = self._uow.repo(DocumentRepository)
        service = GetDocumentsByIdsService(doc_repo)
        return await service.execute(document_ids, center_id)

    async def upload_new_document(
        self,
        center_id: str,
        uploader_id: str,
        account_id: str,
        file: UploadFile,
        name: str | None,
        ip_address: str | None,
        user_agent: str | None,
    ) -> tuple[list[DocumentAtomic], Document]:
        if self._storage is None:
            raise RuntimeError("StorageClient가 주입되지 않았습니다")

        file_data = await file.read()
        if not file_data:
            raise InvalidOperationException("Empty file")

        checksum = hashlib.sha256(file_data).hexdigest()

        temp_path, temp_uuid = DocumentPathProvider.generate_temp_path(
            center_id, file.filename
        )

        try:
            upload_result = await self._storage.upload_file(
                file_data=file_data,
                path=temp_path,
                content_type=file.content_type or "application/octet-stream",
            )
        except Exception as e:
            raise InvalidOperationException(f"S3 upload failed: {str(e)}") from e

        command = UploadDocumentCommand(
            center_id=center_id,
            uploader_id=uploader_id,
            name=name if name else file.filename,
            original_name=file.filename,
            description=None,
            file_type=file.content_type or "application/octet-stream",
            file_size=upload_result["size"],
            checksum=checksum,
            access_level=AccessLevel.CENTER.value,
        )

        doc_repo = self._uow.repo(DocumentRepository)
        upload_service = UploadDocumentService(doc_repo)
        atomic, document = await upload_service.execute(command, temp_path)
        atomics = [atomic]

        final_path = DocumentPathProvider.generate_final_path(
            center_id, document.id, temp_uuid, file.filename
        )

        try:
            await self._storage.upload_file(
                file_data=file_data,
                path=final_path,
                content_type=file.content_type or "application/octet-stream",
            )

            await self._storage.delete_file(temp_path)

            path_atomic, document = await UpdateDocumentService(doc_repo).execute(
                document.id,
                center_id,
                changed={"storage_path": final_path},
                storage_path=final_path,
            )
            atomics.append(path_atomic)

        except Exception as e:
            logger.error(
                f"Failed to move document to final path: document_id={document.id}, "
                f"temp_path={temp_path}, final_path={final_path}, error={str(e)}",
                exc_info=True,
            )
            # TODO: 재시도 큐에 추가하여 백그라운드 작업으로 정리

        access_log_command = CreateAccessLogCommand(
            document_id=document.id,
            s3_version_id=None,
            account_id=account_id,
            action="upload",
            ip_address=ip_address,
            user_agent=user_agent,
        )
        access_repo = self._uow.repo(DocumentAccessRepository)
        log_service = CreateAccessLogService(access_repo)
        await log_service.execute(access_log_command)

        return atomics, document

    async def download_document_with_log(
        self,
        document_id: str,
        center_id: str,
        account_id: str,
        version_id: str | None,
        action: str,
        ip_address: str | None,
        user_agent: str | None,
    ) -> Document:
        doc_repo = self._uow.repo(DocumentRepository)
        get_service = GetDocumentService(doc_repo)
        document = await get_service.execute(document_id, center_id)

        access_log_command = CreateAccessLogCommand(
            document_id=document_id,
            s3_version_id=version_id,
            account_id=account_id,
            action=action,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        access_repo = self._uow.repo(DocumentAccessRepository)
        log_service = CreateAccessLogService(access_repo)
        await log_service.execute(access_log_command)

        return document

    async def update_document_with_log(
        self,
        document_id: str,
        center_id: str,
        *,
        changed: dict,
        account_id: str,
        action: str,
        ip_address: str | None,
        user_agent: str | None,
        **fields,
    ) -> tuple[DocumentAtomic, Document]:
        doc_repo = self._uow.repo(DocumentRepository)
        update_service = UpdateDocumentService(doc_repo)
        atomic, document = await update_service.execute(
            document_id,
            center_id,
            changed=changed,
            **fields,
        )

        access_log_command = CreateAccessLogCommand(
            document_id=document_id,
            s3_version_id=None,
            account_id=account_id,
            action=action,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        access_repo = self._uow.repo(DocumentAccessRepository)
        log_service = CreateAccessLogService(access_repo)
        await log_service.execute(access_log_command)

        return atomic, document

    async def delete_document_with_log(
        self,
        document_id: str,
        center_id: str,
        account_id: str,
        action: str,
        ip_address: str | None,
        user_agent: str | None,
    ) -> tuple[DocumentAtomic, Document]:
        doc_repo = self._uow.repo(DocumentRepository)
        delete_service = DeleteDocumentService(doc_repo)
        atomic, document = await delete_service.execute(document_id, center_id)

        access_log_command = CreateAccessLogCommand(
            document_id=document_id,
            s3_version_id=None,
            account_id=account_id,
            action=action,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        access_repo = self._uow.repo(DocumentAccessRepository)
        log_service = CreateAccessLogService(access_repo)
        await log_service.execute(access_log_command)

        return atomic, document

    async def restore_document_with_log(
        self,
        document_id: str,
        center_id: str,
        account_id: str,
        action: str,
        ip_address: str | None,
        user_agent: str | None,
    ) -> tuple[DocumentAtomic, Document]:
        doc_repo = self._uow.repo(DocumentRepository)
        restore_service = RestoreDocumentService(doc_repo)
        atomic, document = await restore_service.execute(document_id, center_id)

        access_log_command = CreateAccessLogCommand(
            document_id=document_id,
            s3_version_id=None,
            account_id=account_id,
            action=action,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        access_repo = self._uow.repo(DocumentAccessRepository)
        log_service = CreateAccessLogService(access_repo)
        await log_service.execute(access_log_command)

        return atomic, document

    async def download_with_token_and_log(
        self,
        token: str,
        password: str | None,
        ip_address: str | None,
        user_agent: str | None,
    ) -> tuple[ShareTokenAtomic, Document]:
        token_repo = self._uow.repo(ShareTokenRepository)
        validate_service = ValidateShareTokenService(token_repo)
        share_token = await validate_service.execute(token, password)

        # 토큰이 이미 검증됐으므로 center 권한 재검증 없이 ById 로 조회
        doc_repo = self._uow.repo(DocumentRepository)
        get_service = GetDocumentByIdService(doc_repo)
        document = await get_service.execute(share_token.document_id)

        atomic, share_token = await RecordDownloadService(token_repo).execute(
            share_token.id
        )

        access_log_command = CreateAccessLogCommand(
            document_id=document.id,
            s3_version_id=None,
            account_id=None,  # 외부 사용자는 account_id 없음
            action="download",
            ip_address=ip_address,
            user_agent=user_agent,
        )
        access_repo = self._uow.repo(DocumentAccessRepository)
        log_service = CreateAccessLogService(access_repo)
        await log_service.execute(access_log_command)

        return atomic, document

    async def register_existing_document(
        self,
        center_id: str,
        uploader_id: str,
        name: str,
        description: str | None,
        storage_path: str,
        file_type: str,
        file_size: int,
        checksum: str,
        access_level: str = "center",
        original_name: str | None = None,
    ) -> tuple[DocumentAtomic, Document]:
        command = UploadDocumentCommand(
            center_id=center_id,
            uploader_id=uploader_id,
            name=name,
            original_name=original_name,
            description=description,
            file_type=file_type,
            file_size=file_size,
            checksum=checksum,
            access_level=access_level,
        )

        doc_repo = self._uow.repo(DocumentRepository)
        upload_service = UploadDocumentService(doc_repo)
        return await upload_service.execute(command, storage_path)
