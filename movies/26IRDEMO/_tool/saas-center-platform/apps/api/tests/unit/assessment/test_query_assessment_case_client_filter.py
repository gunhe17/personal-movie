"""query_assessment_case facade — client_id 참여자 역조인 검증."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.modules.assessment.facade.assessment_agent_facade import AssessmentAgentFacade


@pytest.mark.asyncio
async def test_client_id_empty_participant_skips_list_service():
    facade = AssessmentAgentFacade(MagicMock())
    facade.query_participant = AsyncMock(return_value=([], 0))
    with patch(
        "app.modules.assessment.facade.assessment_agent_facade.ListAssessmentCasesByAgentFiltersService"
    ) as svc_cls:
        rows, total = await facade.query_case(center_id="C1", client_id="CL1")
        assert rows == []
        assert total == 0
        svc_cls.assert_not_called()


@pytest.mark.asyncio
async def test_client_id_narrows_ids_via_participant():
    facade = AssessmentAgentFacade(MagicMock())
    facade.query_participant = AsyncMock(
        return_value=([{"assessment_participant.case_id": "AC1"}], 1)
    )
    execute = AsyncMock(return_value=([], 0))
    service = MagicMock()
    service.execute = execute
    with patch(
        "app.modules.assessment.facade.assessment_agent_facade.ListAssessmentCasesByAgentFiltersService",
        return_value=service,
    ):
        await facade.query_case(center_id="C1", client_id="CL1", fields=["id"])
    assert execute.await_args.kwargs["ids"] == ["AC1"]
