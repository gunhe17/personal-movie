from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.application.handlers.assessment.get_link_report import get_link_report_handler
from app.core.exceptions import PermissionDeniedException


@pytest.mark.asyncio
@pytest.mark.parametrize("status,visible,document", [("submitted", True, "doc"), ("completed", False, "doc"), ("completed", True, None)])
async def test_private_or_unready_report_cannot_be_opened(status, visible, document):
    storage = SimpleNamespace(get_presigned_url=AsyncMock())
    with patch("app.application.handlers.assessment.get_link_report._validate_link_task", AsyncMock(return_value="center")), patch("app.application.handlers.assessment.get_link_report.AssessmentTaskFacade") as facade:
        facade.return_value.get_task = AsyncMock(return_value=SimpleNamespace(status=status, is_report_visible_to_guardian=visible, report_document_id=document))
        with pytest.raises(PermissionDeniedException):
            await get_link_report_handler("link", "task", object(), storage, event_group_id="event")
    storage.get_presigned_url.assert_not_awaited()


@pytest.mark.asyncio
async def test_report_is_center_scoped_short_lived_and_audited():
    storage = SimpleNamespace(get_presigned_url=AsyncMock(return_value="https://signed.test/file"))
    with patch("app.application.handlers.assessment.get_link_report._validate_link_task", AsyncMock(return_value="center")), patch("app.application.handlers.assessment.get_link_report.AssessmentTaskFacade") as tasks, patch("app.application.handlers.assessment.get_link_report.DocumentFacade") as documents, patch("app.application.handlers.assessment.get_link_report.emit", AsyncMock()) as emit:
        tasks.return_value.get_task = AsyncMock(return_value=SimpleNamespace(status="completed", is_report_visible_to_guardian=True, report_document_id="doc"))
        documents.return_value.get_documents_by_ids = AsyncMock(return_value=[SimpleNamespace(id="doc", storage_path="private/file.pdf")])
        result = await get_link_report_handler("link", "task", object(), storage, event_group_id="event")
        documents.return_value.get_documents_by_ids.assert_awaited_once_with(["doc"], "center")
        storage.get_presigned_url.assert_awaited_once_with(path="private/file.pdf", expires_in=60)
        assert result["expires_in"] == 60
        assert emit.await_args.kwargs["actor_type"] == "guest"


@pytest.mark.asyncio
async def test_foreign_task_is_rejected_before_loading_report():
    with patch("app.application.handlers.assessment.get_link_report._validate_link_task", AsyncMock(side_effect=PermissionDeniedException("denied"))), patch("app.application.handlers.assessment.get_link_report.AssessmentTaskFacade") as tasks:
        with pytest.raises(PermissionDeniedException):
            await get_link_report_handler("link", "foreign", object(), object(), event_group_id="event")
        tasks.assert_not_called()
