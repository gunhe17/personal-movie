from unittest.mock import AsyncMock, MagicMock, patch
from types import SimpleNamespace
from datetime import datetime
import importlib

import pytest

from app.core.exceptions import InvalidOperationException
from app.modules.messaging.facade.message_template_facade import MessageTemplateFacade
from app.modules.messaging.message_template.constants import HARDCODED_TEMPLATE_CODES, TemplateType


@pytest.mark.asyncio
async def test_explicit_builtin_bypasses_invalid_stored_defaults():
    facade = MessageTemplateFacade(MagicMock())
    facade.get_rendered_template = AsyncMock(side_effect=AssertionError("stored default must not be used"))
    message, _ = await facade.get_rendered_send_link_template(
        center_id="center", center_name="센터", recipient_name="수신자",
        assessment_url="https://example.test/link", verification_code="1234",
        template_id="__builtin__",
    )
    assert "바로링크" in message
    assert "https://example.test/link" in message
    assert "1234" in message
    facade.get_rendered_template.assert_not_awaited()


@pytest.mark.asyncio
async def test_default_response_exposes_builtin_copy_without_replacing_effective_content():
    facade = MessageTemplateFacade(MagicMock())
    facade.get_default_template = AsyncMock(return_value=(None, "기존 선택 문구", "hardcoded"))
    response = await facade.get_default_template_with_response("center", "assessment_send_link")
    assert response.fallback_content == "기존 선택 문구"
    assert "바로링크" in response.builtin_content
    assert "{assessment_url}" in response.builtin_content
    assert "{verification_code}" in response.builtin_content
    assert "결과보고서 확인이 가능합니다" not in response.builtin_content


@pytest.mark.asyncio
@pytest.mark.parametrize("source", ["center", "system", "fallback"])
async def test_send_link_uses_managed_template_priority(source):
    finder = MagicMock()
    finder.find_default = AsyncMock(return_value=(
        SimpleNamespace(content="센터 {assessment_url} {verification_code} {recipient_name}")
        if source == "center" else None
    ))
    finder.find_system_default = AsyncMock(return_value=(
        SimpleNamespace(content="시스템 {assessment_url} {verification_code} {recipient_name}")
        if source == "system" else None
    ))
    with patch("app.modules.messaging.facade.message_template_facade.FindMessageTemplateService", return_value=finder):
        message, code = await MessageTemplateFacade(MagicMock()).get_rendered_send_link_template(
            center_id="center-1", center_name="테스트 센터", recipient_name="수신자",
            assessment_url="https://example.test/verify-link?send_link_id=test", verification_code="1234",
        )
    assert "https://example.test/verify-link?send_link_id=test" in message
    assert "1234" in message
    assert "수신자" in message
    assert code == HARDCODED_TEMPLATE_CODES[TemplateType.ASSESSMENT_SEND_LINK]
    finder.find_default.assert_awaited_once_with("center-1", "assessment_send_link")
    if source == "center":
        assert message.startswith("센터 ")
        finder.find_system_default.assert_not_awaited()
    elif source == "system":
        assert message.startswith("시스템 ")
    else:
        assert message.startswith("[테스트 센터]")


@pytest.mark.asyncio
@pytest.mark.parametrize("content", ["결과보고서가 도착했습니다", "{assessment_url}", "{verification_code}"])
async def test_send_link_rejects_templates_without_link_or_code(content):
    finder = MagicMock()
    finder.find_default = AsyncMock(return_value=SimpleNamespace(content=content))
    with patch("app.modules.messaging.facade.message_template_facade.FindMessageTemplateService", return_value=finder):
        with pytest.raises(InvalidOperationException, match="검사 링크와 인증번호"):
            await MessageTemplateFacade(MagicMock()).get_rendered_send_link_template(
                center_id="center-1", center_name="센터", recipient_name="수신자",
                assessment_url="https://example.test/verify-link", verification_code="1234",
            )


@pytest.mark.asyncio
@pytest.mark.parametrize("operation", ["create_send_link", "resend_send_link", "bulk_create_send_link"])
@pytest.mark.parametrize("invalid_template", [False, True])
async def test_all_send_paths_render_managed_template(monkeypatch, operation, invalid_template):
    from app.modules.assessment.send_link.schemas import SendLinkCreate, SendLinkResendRequest, BulkSendLinkCreate

    module = importlib.import_module("app.application.handlers.assessment." + operation)
    recipient = {"name": "수신자", "phone": "01000000000"}
    link = SimpleNamespace(
        id="link", center_id="center", case_id="case", verification_code="1234",
        recipients=[recipient], assessment_ids=["assessment"], channel="alarmtalk",
        expires_at=None, revoked_at=None, created_at=datetime(2026, 9, 7), updated_at=datetime(2026, 9, 7),
    )
    links = MagicMock()
    links.create_send_link = AsyncMock(return_value=(MagicMock(), link))
    links.get_send_link = AsyncMock(return_value=link)
    constructor = MagicMock(return_value=links)
    constructor.build_url.return_value = "https://example.test/verify-link"
    monkeypatch.setattr(module, "SendLinkFacade", constructor)
    monkeypatch.setattr(module, "AssessmentCaseFacade", MagicMock(return_value=SimpleNamespace(verify_case_writable=AsyncMock())))
    monkeypatch.setattr(module, "CenterFacade", MagicMock(return_value=SimpleNamespace(get_center=AsyncMock(return_value=SimpleNamespace(name="센터")))))
    renderer = AsyncMock(return_value=("관리 양식", "managed-code"))
    if invalid_template:
        renderer.side_effect = InvalidOperationException("검사 링크와 인증번호가 필요합니다")
    monkeypatch.setattr(module, "MessageTemplateFacade", MagicMock(return_value=SimpleNamespace(get_rendered_send_link_template=renderer)))
    sender = AsyncMock(return_value=SimpleNamespace(id="message", status=SimpleNamespace(value="sent"), error_message=None))
    monkeypatch.setattr(module, "MessagingFacade", MagicMock(return_value=SimpleNamespace(send=sender)))
    monkeypatch.setattr(module, "emit", AsyncMock())
    if operation == "resend_send_link":
        monkeypatch.setattr(module, "SendLinkAtomic", SimpleNamespace(resent=MagicMock(return_value=(MagicMock(), None))))
        data = SendLinkResendRequest()
    else:
        fields = dict(recipients=[recipient], assessment_ids=["assessment"])
        data = BulkSendLinkCreate(case_ids=["case"], **fields) if operation.startswith("bulk") else SendLinkCreate(**fields)
    data.template_id = "chosen"
    arguments = dict(center_id="center", data=data, uow=MagicMock(), event_group_id="event", actor_id="actor")
    if not operation.startswith("bulk"):
        arguments["case_id"] = "case"
    if operation == "resend_send_link":
        arguments["send_link_id"] = "link"
    result = await getattr(module, operation + "_handler")(**arguments)
    renderer.assert_awaited_once_with(center_id="center", center_name="센터", recipient_name="수신자", assessment_url="https://example.test/verify-link", verification_code="1234", template_id="chosen")

    deliveries = result.results[0].delivery_results if operation.startswith("bulk") else result.delivery_results
    if invalid_template:
        sender.assert_not_awaited()
        assert deliveries[0].status == "failed"
        assert "검사 링크와 인증번호" in deliveries[0].error
    else:
        assert sender.await_args.kwargs["message"] == "관리 양식"
        assert sender.await_args.kwargs["template_code"] == "managed-code"
        assert deliveries[0].status == "sent"


@pytest.mark.asyncio
@pytest.mark.parametrize("template_type", ["assessment_send_link", "assessment_result_send", None])
async def test_selected_template_is_accessible_and_has_correct_type(template_type):
    finder = MagicMock()
    finder.execute_accessible = AsyncMock(return_value=(
        SimpleNamespace(template_type=template_type, content="선택 양식 {assessment_url} {verification_code}")
        if template_type else None
    ))
    arguments = dict(center_id="center", center_name="센터", recipient_name="수신자", assessment_url="https://example.test/link", verification_code="1234", template_id="chosen")
    with patch("app.modules.messaging.facade.message_template_facade.FindMessageTemplateService", return_value=finder):
        facade = MessageTemplateFacade(MagicMock())
        if template_type == "assessment_send_link":
            message, _ = await facade.get_rendered_send_link_template(**arguments)
            assert message == "선택 양식 https://example.test/link 1234"
        else:
            with pytest.raises(InvalidOperationException, match="다시 선택"):
                await facade.get_rendered_send_link_template(**arguments)
    finder.execute_accessible.assert_awaited_once_with("center", "chosen")
    finder.find_default.assert_not_called()
