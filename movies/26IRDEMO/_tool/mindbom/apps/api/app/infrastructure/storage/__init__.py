"""File Storage Infrastructure

스토리지 추상화 레이어.
환경변수 STORAGE_BACKEND으로 Local/S3 전환.
"""
from __future__ import annotations

import mimetypes
from typing import Protocol


class StorageBackend(Protocol):
    """스토리지 백엔드 인터페이스"""

    async def upload(self, path: str, data: bytes, content_type: str) -> str:
        """파일 업로드 → 저장 경로(key) 반환"""
        ...

    async def download(self, path: str) -> tuple[bytes, str]:
        """파일 다운로드 → (바이너리, content_type)"""
        ...

    async def delete(self, path: str) -> None:
        """파일 삭제"""
        ...


class LocalStorage:
    """로컬 파일 시스템 스토리지 (개발용)"""

    def __init__(self, base_path: str):
        from pathlib import Path
        self._base = Path(base_path)

    async def upload(self, path: str, data: bytes, content_type: str) -> str:
        full_path = self._base / path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_bytes(data)
        return path

    async def download(self, path: str) -> tuple[bytes, str]:
        from app.core.exceptions import EntityNotFoundException

        full_path = self._base / path
        if not full_path.exists():
            raise EntityNotFoundException(f"파일을 찾을 수 없습니다: {path}")
        ct = mimetypes.guess_type(path)[0] or "application/octet-stream"
        return full_path.read_bytes(), ct

    async def delete(self, path: str) -> None:
        full_path = self._base / path
        if full_path.exists():
            full_path.unlink()


class S3Storage:
    """AWS S3 스토리지"""

    def __init__(self, bucket: str, region: str, access_key: str, secret_key: str):
        from app.infrastructure.storage.s3 import S3StorageClient
        self._client = S3StorageClient(bucket, region, access_key, secret_key)

    async def upload(self, path: str, data: bytes, content_type: str) -> str:
        await self._client.upload_file(data, path, content_type)
        return path

    async def download(self, path: str) -> tuple[bytes, str]:
        return await self._client.download_file(path)

    async def delete(self, path: str) -> None:
        await self._client.delete_file(path)


_storage_instance: StorageBackend | None = None


def get_storage() -> StorageBackend:
    """스토리지 싱글톤 반환 (STORAGE_BACKEND 환경변수로 전환)"""
    global _storage_instance
    if _storage_instance is not None:
        return _storage_instance

    from app.core.config import settings

    if settings.STORAGE_BACKEND == "s3":
        _storage_instance = S3Storage(
            bucket=settings.S3_BUCKET,
            region=settings.S3_REGION,
            access_key=settings.S3_ACCESS_KEY,
            secret_key=settings.S3_SECRET_KEY,
        )
    else:
        _storage_instance = LocalStorage(settings.STORAGE_PATH)

    return _storage_instance
