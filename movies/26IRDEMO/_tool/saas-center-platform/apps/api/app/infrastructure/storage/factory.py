from __future__ import annotations

from functools import lru_cache

from app.core.config import settings
from app.core.logger import get_logger
from app.infrastructure.storage.common.base import StorageClient
from app.infrastructure.storage.local.client import LocalStorageClient
from app.infrastructure.storage.s3.client import S3StorageClient

logger = get_logger(__name__)


@lru_cache
def get_storage_client() -> StorageClient:
    if not settings.S3_BUCKET_ENABLED:
        logger.warning("Using LocalStorageClient (development only)")
        return LocalStorageClient(base_path="/tmp/saas-storage")

    if not all(
        [
            settings.AWS_ACCESS_KEY_ID,
            settings.AWS_SECRET_ACCESS_KEY,
            settings.S3_BUCKET_NAME,
        ]
    ):
        raise RuntimeError(
            "S3 configuration incomplete. Check AWS_ACCESS_KEY_ID, "
            "AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME environment variables."
        )

    logger.info("Using S3StorageClient (bucket: %s)", settings.S3_BUCKET_NAME)
    return S3StorageClient(
        bucket_name=settings.S3_BUCKET_NAME,
        region=settings.AWS_REGION,
        access_key=settings.AWS_ACCESS_KEY_ID,
        secret_key=settings.AWS_SECRET_ACCESS_KEY,
    )
