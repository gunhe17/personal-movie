"""F-SIG 회귀: 서명 조회는 center 스코프 — 타 센터 signature_id 는 404.
이전엔 get_by_id(전역)라 어느 센터든 서명 PII(signature_data/signer_name/signer_ip)가 유출됐다."""
from datetime import datetime

import pytest

from app.core.exceptions import EntityNotFoundException
from app.modules.form.signature.repository import FormSignatureRepository
from app.modules.form.signature.services.get_signature import GetSignatureService


async def test_get_signature_rejects_foreign_center(test_session):
    repo = FormSignatureRepository(test_session)
    sig = await repo.add(
        center_id="center-B",
        instance_id="inst-1",
        field_id="sig_field",
        storage_type="base64",
        signature_data="data:image/png;base64,AAAA",
        signer_name="홍길동",
        signed_at=datetime(2026, 6, 24, 0, 0, 0),
        signer_ip="1.2.3.4",
    )

    svc = GetSignatureService(repo)

    # 같은 센터 → 조회됨
    got = await svc.execute(signature_id=sig.id, center_id="center-B")
    assert got.id == sig.id

    # 타 센터 → 404 (PII IDOR 차단)
    with pytest.raises(EntityNotFoundException):
        await svc.execute(signature_id=sig.id, center_id="center-A")
