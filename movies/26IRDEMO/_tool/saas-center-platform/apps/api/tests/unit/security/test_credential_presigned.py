"""L-P2 회귀: presigned URL 발급 실패 시 raw S3 key(내부 경로·person_id 포함)를 응답에 노출하면 안 된다.
이전엔 except: pass 라 실패 시 attachment.url 이 raw key 그대로 남았다 → 빈 문자열로 fail-closed."""
from types import SimpleNamespace

import app.modules.person.credential.presigned as presigned
from app.modules.person.credential.presigned import attach_presigned_url

_RAW = "credentials/person-1/cred-1/abcd_diploma.pdf"


class _FailStorage:
    async def get_presigned_url(self, path, expires_in):
        raise RuntimeError("STS down")


class _OkStorage:
    async def get_presigned_url(self, path, expires_in):
        return "https://signed.example/x"


async def test_failure_hides_raw_key(monkeypatch):
    monkeypatch.setattr(presigned, "get_storage_client", lambda: _FailStorage())
    cred = SimpleNamespace(attachment=SimpleNamespace(url=_RAW))
    out = await attach_presigned_url(cred)
    assert out.attachment.url == ""
    assert "credentials/" not in out.attachment.url


async def test_success_replaces_with_presigned(monkeypatch):
    monkeypatch.setattr(presigned, "get_storage_client", lambda: _OkStorage())
    cred = SimpleNamespace(attachment=SimpleNamespace(url=_RAW))
    out = await attach_presigned_url(cred)
    assert out.attachment.url == "https://signed.example/x"
