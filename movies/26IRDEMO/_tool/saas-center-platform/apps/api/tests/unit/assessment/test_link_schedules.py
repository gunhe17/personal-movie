from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.application.handlers.assessment.collect_link_schedules import collect_link_schedules


@pytest.mark.asyncio
async def test_only_linked_onsite_schedules_are_public():
    verified = SimpleNamespace(
        send_link=SimpleNamespace(center_id="center", case_id="case"),
        tasks=[
            SimpleNamespace(id="onsite", session_id="session", execution_method="onsite", assessment_id="assessment"),
            SimpleNamespace(id="online", session_id="other", execution_method="online", assessment_id="online"),
            SimpleNamespace(id="foreign", session_id="foreign", execution_method="onsite", assessment_id="foreign"),
        ],
        assessment_names={"assessment": "방문 검사"},
    )
    sessions = [
        SimpleNamespace(id="session", center_id="center", case_id="case", schedule_id="schedule", status="scheduled"),
        SimpleNamespace(id="foreign", center_id="another", case_id="case", schedule_id="private", status="scheduled"),
    ]
    schedule = SimpleNamespace(id="schedule", center_id="center", schedule_type="assessment", start=datetime(2026, 9, 10, 1), end=datetime(2026, 9, 10, 2), memo="비공개 메모")
    with patch("app.application.handlers.assessment.collect_link_schedules.AssessmentSessionFacade") as session_facade, patch("app.application.handlers.assessment.collect_link_schedules.ScheduleFacade") as schedule_facade:
        session_facade.return_value.list_sessions_by_case = AsyncMock(return_value=sessions)
        schedule_facade.return_value.list_schedules_by_ids = AsyncMock(return_value=[schedule])
        items, task_schedules = await collect_link_schedules(verified, object())
        schedule_facade.return_value.list_schedules_by_ids.assert_awaited_once_with(["schedule"])
    assert task_schedules == {"onsite": "schedule"}
    assert len(items) == 1
    assert items[0].start.tzinfo == timezone.utc
    assert "memo" not in items[0].model_dump()


@pytest.mark.asyncio
async def test_unlinked_schedule_is_not_exposed():
    verified = SimpleNamespace(send_link=SimpleNamespace(center_id="center", case_id="case"), tasks=[], assessment_names={})
    with patch("app.application.handlers.assessment.collect_link_schedules.AssessmentSessionFacade") as facade:
        facade.return_value.list_sessions_by_case = AsyncMock(return_value=[])
        assert await collect_link_schedules(verified, object()) == ([], {})
