"""Admin 서식 추출 확정 E2E.

confirm 은 편집된 FormSchema(name, schema)를 받아 form_template draft 로 승격한다.
extraction 레코드는 존재 확인(+center_id)용으로만 읽고, 페이로드는 요청 body 를 신뢰한다.
리팩토링(form 모듈로 write 이관) 전 엔드포인트 동작을 고정한다.

extraction 은 워커 없이 DB 에 직접 시드한다(업로드/추출 단계 우회).
"""
import pytest
from httpx import AsyncClient

from tests.e2e.test_06_voucher_admin_flow import admin_headers

_SCHEMA = {
    "pages": [],
    "fields": {"user_name": {"type": "text", "label": "이름", "required": True}},
    "elements": [
        {
            "id": "el1",
            "page": 1,
            "rect": [0.1, 0.1, 0.2, 0.05],
            "z": 0,
            "widget": "text",
            "field_refs": ["user_name"],
        }
    ],
}


async def _seed_extraction() -> str:
    """started 상태 FormExtraction 1건 시드 → extraction_id."""
    from app.infrastructure.persistence.database import AsyncSessionLocal
    from app.modules.form.extraction.models import FormExtraction
    from scripts.seed.develop import gen_id

    async with AsyncSessionLocal() as s:
        extraction_id = gen_id()
        s.add(FormExtraction(
            id=extraction_id,
            name="E2E 서식추출",
            center_id=None,
            source_document_id=gen_id(),
        ))
        await s.commit()
    return extraction_id


@pytest.mark.asyncio
async def test_admin_form_extraction_confirm_flow(api: AsyncClient):
    headers = await admin_headers()
    extraction_id = await _seed_extraction()
    name = "E2E 확정서식"

    # 1. 확정 → 201 + v1 draft 신규 생성
    r = await api.post(
        f"/api/v1/admin/form-extractions/{extraction_id}/confirm",
        headers=headers,
        json={"name": name, "schema": _SCHEMA},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["version"] == 1
    assert body["status"] == "draft"
    assert body["created"] is True
    template_id = body["template_id"]

    # 2. 같은 시리즈 재확정 → draft in-place 덮어쓰기 (created=False, 동일 row)
    r = await api.post(
        f"/api/v1/admin/form-extractions/{extraction_id}/confirm",
        headers=headers,
        json={"name": name, "schema": _SCHEMA},
    )
    assert r.status_code == 201, r.text
    assert r.json()["created"] is False
    assert r.json()["template_id"] == template_id

    # 3. 유효하지 않은 FormSchema → 거부
    r = await api.post(
        f"/api/v1/admin/form-extractions/{extraction_id}/confirm",
        headers=headers,
        json={"name": "깨진서식", "schema": {"elements": [{"id": "x", "field_refs": ["missing"]}]}},
    )
    assert r.status_code in (400, 409, 422), r.text


@pytest.mark.asyncio
async def test_admin_form_confirm_unknown_extraction_404(api: AsyncClient):
    headers = await admin_headers()
    from scripts.seed.develop import gen_id

    r = await api.post(
        f"/api/v1/admin/form-extractions/{gen_id()}/confirm",
        headers=headers,
        json={"name": "x", "schema": _SCHEMA},
    )
    assert r.status_code == 404, r.text
