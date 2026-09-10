"""SubmitTaskPipelineService characterization tests."""
from unittest.mock import AsyncMock

import app.modules.assessment.assessment_task.workflows  # noqa: F401
from app.modules.assessment.assessment_case.repository import AssessmentCaseRepository
from app.modules.assessment.assessment_case_participant.repository import (
    AssessmentCaseParticipantRepository,
)
from app.modules.assessment.assessment_task.repository import AssessmentTaskRepository
from app.modules.assessment.assessment_task.services import submit_task_pipeline as pipeline_module
from app.modules.assessment.assessment_task.services.submit_task_pipeline import (
    SubmitTaskPipelineService,
)


async def test_external_service_pipeline_auto_completes_submitted_task(
    test_session,
    monkeypatch,
):
    task_repo = AssessmentTaskRepository(test_session)
    case_repo = AssessmentCaseRepository(test_session)
    participant_repo = AssessmentCaseParticipantRepository(test_session)

    task = await task_repo.add(
        center_id="center-1",
        case_id="case-1",
        assessment_id="assessment-1",
        execution_method="online",
        status="in_progress",
    )

    monkeypatch.setattr(
        SubmitTaskPipelineService,
        "_sync_case_status",
        AsyncMock(return_value=None),
    )

    pipeline = SubmitTaskPipelineService(
        task_repo,
        case_repo,
        participant_repo,
        storage=None,
    )
    atomics, result = await pipeline.execute(
        task=task,
        workflow_type="external_service",
        assessment_code="EXT",
        assessment_kor_name="외부 검사",
        center_id="center-1",
        data={"report_document_id": "doc-1"},
        client_info=None,
    )

    assert [atomic.act() for atomic in atomics] == ["submitted", "completed"]
    assert result["status"] == "completed"
    assert result["report_document_id"] == "doc-1"
    assert result["pending_report"] is None


async def test_self_report_pipeline_skips_pending_report_when_document_exists(
    test_session,
    monkeypatch,
):
    task_repo = AssessmentTaskRepository(test_session)
    case_repo = AssessmentCaseRepository(test_session)
    participant_repo = AssessmentCaseParticipantRepository(test_session)

    task = await task_repo.add(
        center_id="center-1",
        case_id="case-1",
        assessment_id="assessment-1",
        execution_method="onsite",
        status="in_progress",
    )
    task = await task_repo.update_task(
        task_id=task.id,
        report_document_id="existing-doc",
    )

    monkeypatch.setattr(
        pipeline_module.CalculateScoresService,
        "execute",
        AsyncMock(return_value=({"total": 1}, {"level": "low"})),
    )
    monkeypatch.setattr(
        pipeline_module.GenerateReportPdfService,
        "execute",
        AsyncMock(
            return_value={
                "storage_path": "reports/new.pdf",
                "file_size": 10,
                "checksum": "a" * 64,
            }
        ),
    )
    monkeypatch.setattr(
        SubmitTaskPipelineService,
        "_sync_case_status",
        AsyncMock(return_value=None),
    )

    pipeline = SubmitTaskPipelineService(
        task_repo,
        case_repo,
        participant_repo,
        storage=object(),
    )
    atomics, result = await pipeline.execute(
        task=task,
        workflow_type="self_report",
        assessment_code="SELF",
        assessment_kor_name="자가 검사",
        center_id="center-1",
        data={"responses": []},
        client_info={"student_name": "홍길동"},
    )

    assert result["pending_report"] is None
    assert "submitted" in [atomic.act() for atomic in atomics]
    assert "updated" in [atomic.act() for atomic in atomics]
