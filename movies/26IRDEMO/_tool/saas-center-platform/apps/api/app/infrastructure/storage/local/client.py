from __future__ import annotations

import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Any

from app.core.datetime_utils import utc_now


class LocalStorageClient:
    def __init__(self, base_path: str = "/tmp/saas-storage"):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _get_file_path(self, path: str) -> Path:
        return self.base_path / path

    def _get_metadata_path(self, path: str) -> Path:
        return self.base_path / f"{path}.metadata.json"

    def _save_metadata(self, path: str, metadata: dict[str, Any]) -> None:
        meta_path = self._get_metadata_path(path)
        meta_path.parent.mkdir(parents=True, exist_ok=True)

        existing_versions = []
        if meta_path.exists():
            with open(meta_path, "r", encoding="utf-8") as f:
                existing_data = json.load(f)
                existing_versions = existing_data.get("versions", [])

        existing_versions.append(metadata)

        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump({"versions": existing_versions}, f, default=str)

    def _load_metadata(self, path: str) -> list[dict]:
        meta_path = self._get_metadata_path(path)
        if not meta_path.exists():
            return []

        with open(meta_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("versions", [])

    async def upload_file(self, file_data: bytes, path: str, content_type: str) -> dict:
        file_path = self._get_file_path(path)
        file_path.parent.mkdir(parents=True, exist_ok=True)

        with open(file_path, "wb") as f:
            f.write(file_data)

        checksum = hashlib.md5(file_data).hexdigest()
        version_id = utc_now().isoformat()

        metadata = {
            "version_id": version_id,
            "size": len(file_data),
            "checksum": checksum,
            "content_type": content_type,
            "uploaded_at": version_id,
            "is_latest": True,
        }

        versions = self._load_metadata(path)
        for v in versions:
            v["is_latest"] = False

        self._save_metadata(path, metadata)

        return {
            "version_id": version_id,
            "size": len(file_data),
            "checksum": checksum,
        }

    async def download_file(self, path: str, version_id: str | None = None) -> bytes:
        file_path = self._get_file_path(path)

        if not file_path.exists():
            from app.core.exceptions import EntityNotFoundException
            raise EntityNotFoundException(f"File not found in storage: {path}")

        with open(file_path, "rb") as f:
            return f.read()

    async def delete_file(self, path: str) -> None:
        file_path = self._get_file_path(path)

        if file_path.exists():
            file_path.unlink()

        meta_path = self._get_metadata_path(path)
        if meta_path.exists():
            meta_path.unlink()

    async def list_versions(self, path: str) -> list[dict]:
        versions = self._load_metadata(path)

        for v in versions:
            if isinstance(v.get("last_modified"), str):
                v["last_modified"] = datetime.fromisoformat(v["last_modified"])
            elif "uploaded_at" in v:
                v["last_modified"] = datetime.fromisoformat(v["uploaded_at"])

        return versions

    async def restore_version(self, path: str, version_id: str) -> dict:
        raise NotImplementedError(
            "Local storage does not support version restoration. "
            "Use S3StorageClient for version management."
        )

    async def get_presigned_url(
        self, path: str, version_id: str | None = None, expires_in: int = 3600,
    ) -> str:
        # 브라우저가 열 수 있는 주소여야 한다 — `file://`은 바로링크의 결과 열람이 막는다
        # (verify-link/+page.svelte: http(s)만 허용). main.py가 같은 디렉터리를 /local-storage로 내준다.
        from app.core.config import settings

        return f"{settings.LOCAL_STORAGE_BASE_URL.rstrip('/')}/{path.lstrip('/')}"

    async def head_file(self, path: str) -> dict | None:
        file_path = self._get_file_path(path)
        if not file_path.exists():
            return None
        return {"size": file_path.stat().st_size, "content_type": None}

    async def get_presigned_upload_url(
        self, path: str, content_type: str, expires_in: int = 900,
    ) -> str:
        # 로컬은 직행 업로드 대상이 없다 — 개발·테스트에서 예약/완료 흐름만 도는 자리표시자
        file_path = self._get_file_path(path)
        return f"file://{file_path.absolute()}"

    def get_public_url(self, path: str) -> str:
        file_path = self._get_file_path(path)
        return f"file://{file_path.absolute()}"
