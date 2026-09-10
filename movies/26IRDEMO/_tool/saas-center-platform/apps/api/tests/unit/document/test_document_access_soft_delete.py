"""DocumentAccessRepository soft-delete filter regression tests"""

from app.modules.document.document.repository import DocumentRepository
from app.modules.document.document_access.repository import DocumentAccessRepository


async def test_list_by_account_excludes_soft_deleted_document(test_session):
    """Document이 soft-delete되면 그 access 로그는 list_by_account_with_page에서 제외된다."""
    # Given: 같은 센터·계정의 문서 2건과 각 access 로그 1건
    doc_repo = DocumentRepository(test_session)
    access_repo = DocumentAccessRepository(test_session)

    alive_doc = await doc_repo.add(
        center_id="center-1",
        uploader_id="uploader-1",
        name="alive.pdf",
        original_name=None,
        description=None,
        storage_path="s3://bucket/alive.pdf",
        file_type="application/pdf",
        file_size=10,
        checksum="a" * 64,
        access_level="center",
    )
    deleted_doc = await doc_repo.add(
        center_id="center-1",
        uploader_id="uploader-1",
        name="deleted.pdf",
        original_name=None,
        description=None,
        storage_path="s3://bucket/deleted.pdf",
        file_type="application/pdf",
        file_size=10,
        checksum="b" * 64,
        access_level="center",
    )
    await access_repo.add(
        document_id=alive_doc.id,
        s3_version_id=None,
        account_id="account-1",
        action="download",
        ip_address=None,
        user_agent=None,
    )
    await access_repo.add(
        document_id=deleted_doc.id,
        s3_version_id=None,
        account_id="account-1",
        action="download",
        ip_address=None,
        user_agent=None,
    )

    # When: 한 문서를 soft-delete
    await doc_repo.remove_by_id(deleted_doc.id)

    items, page = await access_repo.list_by_account_with_page(
        account_id="account-1",
        center_id="center-1",
    )

    # Then: 살아있는 문서의 로그만 남는다
    assert page["total"] == 1
    assert [a.document_id for a in items] == [alive_doc.id]
