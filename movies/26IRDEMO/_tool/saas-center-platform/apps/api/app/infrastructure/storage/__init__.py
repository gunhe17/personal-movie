"""Storage Infrastructure.

고팬아웃 public API라 패키지 레벨 재export facade를 유지한다(소비처 50+).
내부 구조: factory(생성) · common/base(계약) · local|s3(provider).
"""
from app.infrastructure.storage.common.base import StorageClient
from app.infrastructure.storage.factory import get_storage_client
from app.infrastructure.storage.local.client import LocalStorageClient
from app.infrastructure.storage.s3.client import S3StorageClient

__all__ = [
    "StorageClient",
    "get_storage_client",
    "LocalStorageClient",
    "S3StorageClient",
]
