"""query_case facade — client_id 참여자 역조인 검증."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.modules.counseling.facade.counseling_agent_facade import CounselingAgentFacade


@pytest.mark.asyncio
async def test_client_id_empty_participant_skips_list_service():
    facade = CounselingAgentFacade(MagicMock())
    facade.query_participant = AsyncMock(return_value=([], 0))
    with patch(
        "app.modules.counseling.facade.counseling_agent_facade.ListCounselingCasesByAgentFiltersService"
    ) as svc_cls:
        rows, total = await facade.query_case(center_id="C1", client_id="CL1")
        assert rows == []
        assert total == 0
        svc_cls.assert_not_called()


@pytest.mark.asyncio
async def test_client_id_narrows_ids_via_participant():
    facade = CounselingAgentFacade(MagicMock())
    facade.query_participant = AsyncMock(
        return_value=([{"participant.counseling_case_id": "CASE1"}], 1)
    )
    execute = AsyncMock(return_value=([], 0))
    service = MagicMock()
    service.execute = execute
    with patch(
        "app.modules.counseling.facade.counseling_agent_facade.ListCounselingCasesByAgentFiltersService",
        return_value=service,
    ):
        await facade.query_case(center_id="C1", client_id="CL1", fields=["id"])
    assert execute.await_args.kwargs["ids"] == ["CASE1"]


@pytest.mark.asyncio
async def test_client_id_intersects_existing_ids():
    facade = CounselingAgentFacade(MagicMock())
    facade.query_participant = AsyncMock(
        return_value=(
            [
                {"participant.counseling_case_id": "CASE1"},
                {"participant.counseling_case_id": "CASE2"},
            ],
            2,
        )
    )
    execute = AsyncMock(return_value=([], 0))
    service = MagicMock()
    service.execute = execute
    with patch(
        "app.modules.counseling.facade.counseling_agent_facade.ListCounselingCasesByAgentFiltersService",
        return_value=service,
    ):
        await facade.query_case(
            center_id="C1", client_id="CL1", ids=["CASE2", "CASE9"], fields=["id"]
        )
    assert execute.await_args.kwargs["ids"] == ["CASE2"]
