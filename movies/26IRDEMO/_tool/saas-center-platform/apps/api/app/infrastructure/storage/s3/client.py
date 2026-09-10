from __future__ import annotations


import aioboto3
from botocore.exceptions import ClientError

from app.infrastructure.storage.common.exception import (
    StorageNotFoundError,
    StorageOperationError,
    StorageProviderError,
)


class S3StorageClient:
    def __init__(self, bucket_name: str, region: str, access_key: str, secret_key: str):
        self.bucket_name = bucket_name
        self.region = region
        self.session = aioboto3.Session(
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region,
        )

    async def upload_file(self, file_data: bytes, path: str, content_type: str) -> dict:
        async with self.session.client("s3") as s3:
            try:
                response = await s3.put_object(
                    Bucket=self.bucket_name,
                    Key=path,
                    Body=file_data,
                    ContentType=content_type,
                )
            except ClientError as e:
                raise StorageProviderError(f"Failed to upload file: {path}") from e

            return {
                "version_id": response.get("VersionId"),
                "size": len(file_data),
                "checksum": response.get("ETag", "").strip('"'),
            }

    async def download_file(self, path: str, version_id: str | None = None) -> bytes:
        async with self.session.client("s3") as s3:
            params = {
                "Bucket": self.bucket_name,
                "Key": path,
            }

            if version_id:
                params["VersionId"] = version_id

            try:
                response = await s3.get_object(**params)
                return await response["Body"].read()
            except ClientError as e:
                error_code = e.response.get("Error", {}).get("Code", "")
                if error_code == "NoSuchKey":
                    raise StorageNotFoundError(f"File not found in storage: {path}") from e
                raise StorageOperationError(f"Failed to download file: {e}") from e

    async def delete_file(self, path: str) -> None:
        async with self.session.client("s3") as s3:
            try:
                await s3.delete_object(
                    Bucket=self.bucket_name,
                    Key=path,
                )
            except ClientError as e:
                raise StorageProviderError(f"Failed to delete file: {path}") from e

    async def list_versions(self, path: str) -> list[dict]:
        async with self.session.client("s3") as s3:
            try:
                response = await s3.list_object_versions(
                    Bucket=self.bucket_name,
                    Prefix=path,
                )
            except ClientError as e:
                raise StorageProviderError(f"Failed to list versions: {path}") from e

            versions = []
            for version in response.get("Versions", []):
                if version["Key"] == path:  # Prefix 검색이라 정확히 일치하는 키만
                    versions.append(
                        {
                            "version_id": version["VersionId"],
                            "size": version["Size"],
                            "last_modified": version["LastModified"],
                            "is_latest": version["IsLatest"],
                        }
                    )

            return versions

    async def restore_version(self, path: str, version_id: str) -> dict:
        file_data = await self.download_file(path, version_id)

        async with self.session.client("s3") as s3:
            head_response = await s3.head_object(
                Bucket=self.bucket_name,
                Key=path,
                VersionId=version_id,
            )
            content_type = head_response.get("ContentType", "application/octet-stream")

        return await self.upload_file(file_data, path, content_type)

    async def get_presigned_url(
        self, path: str, version_id: str | None = None, expires_in: int = 3600,
    ) -> str:
        async with self.session.client("s3") as s3:
            params = {
                "Bucket": self.bucket_name,
                "Key": path,
            }

            if version_id:
                params["VersionId"] = version_id

            try:
                url = await s3.generate_presigned_url(
                    ClientMethod="get_object",
                    Params=params,
                    ExpiresIn=expires_in,
                )
                return url
            except Exception as e:
                raise StorageOperationError(f"Failed to generate download URL: {e}") from e

    async def head_file(self, path: str) -> dict | None:
        async with self.session.client("s3") as s3:
            try:
                r = await s3.head_object(Bucket=self.bucket_name, Key=path)
            except ClientError:
                return None
            return {"size": r["ContentLength"], "content_type": r.get("ContentType")}

    async def get_presigned_upload_url(
        self, path: str, content_type: str, expires_in: int = 900,
    ) -> str:
        async with self.session.client("s3") as s3:
            try:
                return await s3.generate_presigned_url(
                    ClientMethod="put_object",
                    Params={
                        "Bucket": self.bucket_name,
                        "Key": path,
                        "ContentType": content_type,
                    },
                    ExpiresIn=expires_in,
                )
            except Exception as e:
                raise StorageOperationError(f"Failed to generate upload URL: {e}") from e

    def get_public_url(self, path: str) -> str:
        return f"https://s3.{self.region}.amazonaws.com/{self.bucket_name}/{path}"
