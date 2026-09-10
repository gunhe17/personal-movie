"""C-H2 회귀: resource link(form-instance/document)는 client 가 호출자 center 소유여야 한다.
이전엔 client_id 가 URL→repo.add 로 직결돼 타 센터 client 에 폼/문서를 링크할 수 있었다."""
import pytest

from app.core.exceptions import EntityNotFoundException
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.client.facade.resource_facade import ResourceFacade
from app.modules.client.profile.repository import ClientRepository


async def test_link_form_instance_rejects_foreign_center_client(test_session):
    client_repo = ClientRepository(test_session)
    client = await client_repo.add(
        center_id="center-B", code="C-1", role="guardian", name="홍길동"
    )

    uow = UnitOfWork(test_session)
    with pytest.raises(EntityNotFoundException):
        await ResourceFacade(uow).link_form_instance(
            center_id="center-A", client_id=client.id, instance_id="inst-1"
        )


async def test_link_document_rejects_unknown_client(test_session):
    uow = UnitOfWork(test_session)
    with pytest.raises(EntityNotFoundException):
        await ResourceFacade(uow).link_document(
            center_id="center-A",
            client_id="nonexistent",
            document_id="doc-1",
            resource_type="consent",
        )
