"""회귀: credential 삭제 시 첨부 S3 객체도 함께 정리한다.
이전엔 soft delete 만 하고 storage 를 건드리지 않아 S3 객체가 영구 orphan 으로 남았다."""
from uuid import uuid4

from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.person.credential.handlers import delete_credential_handler
from app.modules.person.credential.repository import PersonCredentialRepository
from app.modules.person.credential.services import DeleteCredentialService


class FakeStorage:
    def __init__(self):
        self.deleted: list[str] = []

    async def delete_file(self, path: str) -> None:
        self.deleted.append(path)


async def _add_credential(session, *, person_id: str, attachment_url: str | None):
    repo = PersonCredentialRepository(session)
    credential = await repo.add(
        person_id=person_id,
        credential_type="certification",
        title="상담심리사 2급",
        organization="한국상담심리학회",
    )
    if attachment_url is not None:
        await repo.update_in_place(credential.id, attachment_url=attachment_url)
    await session.commit()
    return credential.id


async def test_delete_credential_cleans_up_attachment(test_session):
    s3_path = "credentials/p1/c1/cert.pdf"
    credential_id = await _add_credential(
        test_session, person_id="p1", attachment_url=s3_path
    )

    storage = FakeStorage()
    await delete_credential_handler(
        credential_id,
        "p1",
        storage,
        UnitOfWork(test_session),
        event_group_id=str(uuid4()),
        actor_id="p1",
    )

    assert storage.deleted == [s3_path]


async def test_delete_credential_without_attachment_skips_storage(test_session):
    credential_id = await _add_credential(
        test_session, person_id="p1", attachment_url=None
    )

    storage = FakeStorage()
    await delete_credential_handler(
        credential_id,
        "p1",
        storage,
        UnitOfWork(test_session),
        event_group_id=str(uuid4()),
        actor_id="p1",
    )

    assert storage.deleted == []


async def test_service_returns_credential_with_attachment_url(test_session):
    s3_path = "credentials/p1/c2/diploma.pdf"
    credential_id = await _add_credential(
        test_session, person_id="p1", attachment_url=s3_path
    )

    repo = PersonCredentialRepository(test_session)
    _atomic, deleted = await DeleteCredentialService(repo).execute(credential_id, "p1")

    assert deleted.attachment_url == s3_path
