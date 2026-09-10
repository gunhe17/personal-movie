"""AuditLogger 단위 테스트 (SaMD V&V)

JSON 직렬화 + ContextVar trace_id 자동 캡처 검증.
DB 의존성 없이 repo mock으로 호출 인자 검증.
"""
import json
from unittest.mock import AsyncMock

import pytest

from app.core.request_context import set_trace_id, trace_id_var
from app.modules.audit.services import AuditLogger, _to_json


class TestJsonSerialization:
    def test_to_json_none(self):
        assert _to_json(None) is None

    def test_to_json_dict(self):
        result = _to_json({"k": "v"})
        assert json.loads(result) == {"k": "v"}

    def test_to_json_korean_not_escaped(self):
        result = _to_json({"name": "김민수"})
        assert "김민수" in result

    def test_to_json_datetime_default_serializer(self):
        from datetime import datetime
        result = _to_json({"at": datetime(2026, 4, 27, 12, 0, 0)})
        assert "2026-04-27" in result


class TestAuditLogger:
    async def test_log_passes_all_fields_to_repo(self):
        repo = AsyncMock()
        repo.create = AsyncMock(return_value="created")
        logger = AuditLogger(repo)

        await logger.log(
            action="create",
            entity_type="examination",
            entity_id="exam-123",
            actor_id="acc-1",
            actor_email="a@b.com",
            actor_role="clinician",
            institution_id="inst-1",
            ip_address="1.1.1.1",
            user_agent="ua",
            old_value=None,
            new_value={"status": "created"},
            metadata={"reason": "init"},
        )

        repo.create.assert_awaited_once()
        payload = repo.create.call_args.args[0]
        assert payload["action"] == "create"
        assert payload["entity_type"] == "examination"
        assert payload["entity_id"] == "exam-123"
        assert payload["actor_id"] == "acc-1"
        assert payload["actor_email"] == "a@b.com"
        assert payload["actor_role"] == "clinician"
        assert payload["institution_id"] == "inst-1"
        assert payload["ip_address"] == "1.1.1.1"
        assert payload["user_agent"] == "ua"
        assert payload["old_value"] is None
        assert json.loads(payload["new_value"]) == {"status": "created"}
        assert json.loads(payload["metadata_json"]) == {"reason": "init"}

    async def test_log_captures_trace_id_from_context(self):
        token = trace_id_var.set("trace-xyz-001")
        try:
            repo = AsyncMock()
            repo.create = AsyncMock(return_value="created")
            logger = AuditLogger(repo)

            await logger.log(
                action="login_success",
                entity_type="account",
                entity_id="acc-1",
                actor_id="acc-1",
                actor_email="a@b.com",
                actor_role=None,
                institution_id=None,
            )

            payload = repo.create.call_args.args[0]
            assert payload["trace_id"] == "trace-xyz-001"
        finally:
            trace_id_var.reset(token)

    async def test_log_trace_id_none_when_unset(self):
        # 이 테스트가 실행되는 시점에 trace_id_var가 없음
        token = trace_id_var.set(None)
        try:
            repo = AsyncMock()
            repo.create = AsyncMock()
            logger = AuditLogger(repo)
            await logger.log(
                action="x", entity_type="x", entity_id="x",
                actor_id=None, actor_email="a@b.com",
                actor_role=None, institution_id=None,
            )
            payload = repo.create.call_args.args[0]
            assert payload["trace_id"] is None
        finally:
            trace_id_var.reset(token)

    async def test_log_accepts_nullable_actor(self):
        """익명 로그인 시도(account_not_found)도 기록 가능"""
        repo = AsyncMock()
        repo.create = AsyncMock()
        logger = AuditLogger(repo)

        await logger.log(
            action="login_failed",
            entity_type="account",
            entity_id="anonymous",
            actor_id=None,
            actor_email="attacker@evil.com",
            actor_role=None,
            institution_id=None,
            metadata={"reason": "account_not_found"},
        )

        payload = repo.create.call_args.args[0]
        assert payload["actor_id"] is None
        assert payload["actor_role"] is None
        assert payload["institution_id"] is None
        assert payload["actor_email"] == "attacker@evil.com"
