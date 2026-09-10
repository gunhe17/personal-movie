from io import BytesIO
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

from fastapi import UploadFile
from starlette.datastructures import Headers

from app.modules.document.document.repository import DocumentRepository
from app.modules.document.document_access.repository import DocumentAccessRepository
from app.modules.document.facade import document_facade as module
from app.modules.document.facade.document_facade import DocumentFacade


class FakeDocumentRepository:
    def __init__(self):
        self.document = None

    async def add(self, **fields):
        self.document = SimpleNamespace(id="document-1", **fields)
        return self.document

    async def get_in_center(
        self,
        *,
        document_id,
        center_id,
    ):
        return self.document

    async def update_in_center(
        self,
        *,
        id,
        center_id,
        **fields,
    ):
        for key, value in fields.items():
            setattr(self.document, key, value)
        return self.document


class FakeAccessRepository:
    def __init__(self):
        self.inserts = []

    async def add(self, **fields):
        self.inserts.append(fields)
        return SimpleNamespace(**fields)


class FakeUow:
    def __init__(self):
        self.document_repo = FakeDocumentRepository()
        self.access_repo = FakeAccessRepository()

    def repo(
        self,
        repo_type,
    ):
        return {
            DocumentRepository: self.document_repo,
            DocumentAccessRepository: self.access_repo,
        }[repo_type]


class FakeStorage:
    def __init__(
        self,
        *,
        fail_final=False,
    ):
        self.fail_final = fail_final
        self.uploads = []
        self.deletes = []

    async def upload_file(
        self,
        file_data,
        path,
        content_type,
    ):
        self.uploads.append((file_data, path, content_type))
        if self.fail_final and len(self.uploads) == 2:
            raise RuntimeError("final upload failed")
        return {"size": len(file_data)}

    async def delete_file(
        self,
        path,
    ):
        self.deletes.append(path)


def make_upload() -> UploadFile:
    return UploadFile(
        BytesIO(b"pdf-data"),
        filename="report.pdf",
        headers=Headers({"content-type": "application/pdf"}),
    )


async def test_upload_new_document_moves_to_final_and_preserves_atomics(monkeypatch):
    monkeypatch.setattr(
        module.DocumentPathProvider,
        "generate_temp_path",
        lambda center_id, filename: ("temp/report.pdf", "upload-id"),
    )
    monkeypatch.setattr(
        module.DocumentPathProvider,
        "generate_final_path",
        lambda center_id, document_id, temp_uuid, filename: "final/report.pdf",
    )
    uow = FakeUow()
    storage = FakeStorage()

    atomics, document = await DocumentFacade(uow, storage).upload_new_document(
        center_id="center-1",
        uploader_id="member-1",
        account_id="account-1",
        file=make_upload(),
        name=None,
        ip_address="127.0.0.1",
        user_agent="pytest",
    )

    assert [atomic.act() for atomic in atomics] == ["created", "updated"]
    assert document.storage_path == "final/report.pdf"
    assert [path for _, path, _ in storage.uploads] == [
        "temp/report.pdf",
        "final/report.pdf",
    ]
    assert storage.deletes == ["temp/report.pdf"]
    assert uow.access_repo.inserts == [
        {
            "document_id": "document-1",
            "s3_version_id": None,
            "account_id": "account-1",
            "action": "upload",
            "ip_address": "127.0.0.1",
            "user_agent": "pytest",
        }
    ]


async def test_upload_new_document_final_failure_keeps_temp_and_created_atomic(
    monkeypatch,
):
    monkeypatch.setattr(
        module.DocumentPathProvider,
        "generate_temp_path",
        lambda center_id, filename: ("temp/report.pdf", "upload-id"),
    )
    monkeypatch.setattr(
        module.DocumentPathProvider,
        "generate_final_path",
        lambda center_id, document_id, temp_uuid, filename: "final/report.pdf",
    )
    error = Mock()
    monkeypatch.setattr(module.logger, "error", error)
    uow = FakeUow()
    storage = FakeStorage(fail_final=True)

    atomics, document = await DocumentFacade(uow, storage).upload_new_document(
        center_id="center-1",
        uploader_id="member-1",
        account_id="account-1",
        file=make_upload(),
        name=None,
        ip_address=None,
        user_agent=None,
    )

    assert [atomic.act() for atomic in atomics] == ["created"]
    assert document.storage_path == "temp/report.pdf"
    assert storage.deletes == []
    assert uow.access_repo.inserts[0]["action"] == "upload"
    message = error.call_args.args[0]
    assert "document_id=document-1" in message
    assert "temp_path=temp/report.pdf" in message
    assert "final_path=final/report.pdf" in message
    assert "error=final upload failed" in message
    assert error.call_args.kwargs == {"exc_info": True}


async def test_register_existing_document_passes_through_service_tuple(monkeypatch):
    atomic = object()
    document = SimpleNamespace(id="document-1")
    execute = AsyncMock(return_value=(atomic, document))
    monkeypatch.setattr(
        module,
        "UploadDocumentService",
        lambda repo: SimpleNamespace(execute=execute),
    )
    uow = FakeUow()

    result = await DocumentFacade(uow).register_existing_document(
        center_id="center-1",
        uploader_id="system",
        name="report.pdf",
        description="report",
        storage_path="reports/report.pdf",
        file_type="application/pdf",
        file_size=8,
        checksum="a" * 64,
    )

    assert result == (atomic, document)
    assert execute.await_args.args[1] == "reports/report.pdf"
