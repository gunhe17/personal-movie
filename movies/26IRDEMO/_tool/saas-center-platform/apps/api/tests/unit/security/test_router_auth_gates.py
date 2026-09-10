"""계약확인형 클러스터 회귀: 익명 접근이 차단되어야 하는 라우터.
institution(전역 참조표)·messaging admin_router 는 이전엔 인증 의존성이 전무했다."""
import httpx
import pytest
from httpx import ASGITransport

from app.main import app


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/api/v1/institutions/"),
        ("post", "/api/v1/institutions/"),
        ("get", "/api/v1/admin/message-templates/system"),
        ("post", "/api/v1/admin/message-templates/system"),
    ],
)
async def test_anonymous_blocked(method, path):
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        kwargs = {"json": {}} if method == "post" else {}
        resp = await getattr(c, method)(path, **kwargs)
    assert resp.status_code in (401, 403), (
        f"{method.upper()} {path} should reject anonymous, got {resp.status_code}"
    )
