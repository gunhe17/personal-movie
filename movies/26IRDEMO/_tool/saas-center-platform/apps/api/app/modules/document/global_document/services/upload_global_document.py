# GlobalDocument 업로드 서비스 — 파일 N개 스토리지 저장 + row 생성.
#
# 같은 논리 파일의 여러 확장자(pdf/hwpx/md)를 묶는 책임은 사용처
# (voucher 는 voucher_extractions 의 source/artifact id 리스트)에 있다 — 이 서비스는 변형을 묶지 않고
# 파일별 row 만 만든다.
from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass
from typing import Protocol

from app.core.exceptions import InvalidOperationException

from ..models import GlobalDocument
from ..repository import GlobalDocumentRepository


@dataclass
class GlobalFileInput:
    data: bytes
    file_type: str  # 확장자 (pdf, hwpx, md ...)
    original_name: str | None = None
    content_type: str | None = None


class _StorageClient(Protocol):
    async def upload_file(
        self, file_data: bytes, path: str, content_type: str
    ) -> dict: ...


class UploadGlobalDocumentService:
    def __init__(
        self,
        repo: GlobalDocumentRepository,
        storage: _StorageClient,
    ):
        self.repo = repo
        self.storage = storage

    async def execute(
        self,
        *,
        name: str,
        files: list[GlobalFileInput],
        uploader_id: str | None = None,
    ) -> list[GlobalDocument]:
        if not files:
            raise InvalidOperationException("업로드할 파일이 없습니다")

        created: list[GlobalDocument] = []
        for f in files:
            storage_path = f"global-documents/{uuid.uuid4()}.{f.file_type}"
            await self.storage.upload_file(
                file_data=f.data,
                path=storage_path,
                content_type=f.content_type or "application/octet-stream",
            )
            doc = await self.repo.add(
                name=name,
                original_name=f.original_name,
                description=None,
                file_type=f.file_type,
                storage_path=storage_path,
                file_size=len(f.data),
                checksum=hashlib.sha256(f.data).hexdigest(),
                uploader_id=uploader_id,
            )
            created.append(doc)
        return created
