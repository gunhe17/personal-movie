"""AWS S3 Storage Client"""
import logging

import aioboto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class S3StorageClient:
    """
    AWS S3 스토리지 클라이언트

    버전 관리(Versioning) 활성화 필수:
    - 모든 파일 수정은 새 버전으로 저장
    - 삭제는 삭제 마커만 생성 (실제 삭제 아님)
    - 이전 버전 조회/복원 가능
    """

    def __init__(
        self,
        bucket_name: str,
        region: str,
        access_key: str,
        secret_key: str,
    ):
        self.bucket_name = bucket_name
        self.region = region
        self.session = aioboto3.Session(
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region,
        )

    async def upload_file(
        self,
        file_data: bytes,
        path: str,
        content_type: str,
    ) -> dict:
        """
        파일 업로드

        Returns:
            {"version_id": str, "size": int, "checksum": str}
        """
        async with self.session.client("s3") as s3:
            response = await s3.put_object(
                Bucket=self.bucket_name,
                Key=path,
                Body=file_data,
                ContentType=content_type,
            )

            logger.info("S3 업로드 완료: %s (%d bytes)", path, len(file_data))
            return {
                "version_id": response.get("VersionId"),
                "size": len(file_data),
                "checksum": response.get("ETag", "").strip('"'),
            }

    async def download_file(
        self,
        path: str,
        version_id: str | None = None,
    ) -> tuple[bytes, str]:
        """
        파일 다운로드

        Returns:
            (파일 바이너리, content_type)
        """
        async with self.session.client("s3") as s3:
            params: dict = {
                "Bucket": self.bucket_name,
                "Key": path,
            }
            if version_id:
                params["VersionId"] = version_id

            try:
                response = await s3.get_object(**params)
                data = await response["Body"].read()
                content_type = response.get("ContentType", "application/octet-stream")
                return data, content_type
            except ClientError as e:
                error_code = e.response.get("Error", {}).get("Code", "")
                if error_code == "NoSuchKey":
                    from app.core.exceptions import EntityNotFoundException
                    raise EntityNotFoundException(
                        f"파일을 찾을 수 없습니다: {path}"
                    ) from e
                raise

    async def delete_file(self, path: str) -> None:
        """파일 삭제 (버전 관리 시 삭제 마커 생성)"""
        async with self.session.client("s3") as s3:
            await s3.delete_object(
                Bucket=self.bucket_name,
                Key=path,
            )

    async def get_presigned_url(
        self,
        path: str,
        version_id: str | None = None,
        expires_in: int = 3600,
    ) -> str:
        """Pre-signed URL 생성 (기본 1시간)"""
        async with self.session.client("s3") as s3:
            params: dict = {
                "Bucket": self.bucket_name,
                "Key": path,
            }
            if version_id:
                params["VersionId"] = version_id

            return await s3.generate_presigned_url(
                ClientMethod="get_object",
                Params=params,
                ExpiresIn=expires_in,
            )

    def get_public_url(self, path: str) -> str:
        """영구 공개 URL (public read 정책 필요)"""
        return f"https://s3.{self.region}.amazonaws.com/{self.bucket_name}/{path}"
