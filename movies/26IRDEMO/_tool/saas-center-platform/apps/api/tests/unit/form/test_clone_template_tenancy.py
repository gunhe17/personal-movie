"""F-CLONE 회귀: clone_template 은 source 를 center 스코프로 로드 — 타 센터 템플릿은 404.
이전엔 get_by_id(전역)라 타 센터의 폼 템플릿 schema 를 복제할 수 있었다(시스템 템플릿 center_id IS NULL 은 허용)."""
import pytest

from app.core.exceptions import EntityNotFoundException
from app.modules.form.template.repository import FormTemplateRepository
from app.modules.form.template.services.clone_template import CloneTemplateService

_SCHEMA = {"pages": []}


async def test_clone_rejects_foreign_center_template(test_session):
    repo = FormTemplateRepository(test_session)
    source = await repo.add(
        center_id="center-B",
        name="B의 템플릿",
        version=1,
        schema=_SCHEMA,
        is_active=True,
        status="draft",
    )

    svc = CloneTemplateService(repo)

    # 타 센터(center-A)가 center-B 템플릿 복제 시도 → 404
    with pytest.raises(EntityNotFoundException):
        await svc.execute(
            source_template_id=source.id,
            center_id="center-A",
            name="훔친 사본",
        )


async def test_clone_allows_system_template(test_session):
    repo = FormTemplateRepository(test_session)
    system = await repo.add(
        center_id=None,
        name="시스템 기본 템플릿",
        version=1,
        schema=_SCHEMA,
        is_active=True,
        status="draft",
    )

    svc = CloneTemplateService(repo)
    _atomic, cloned = await svc.execute(
        source_template_id=system.id,
        center_id="center-A",
        name="center-A 사본",
    )
    assert cloned.center_id == "center-A"
    assert cloned.id != system.id
