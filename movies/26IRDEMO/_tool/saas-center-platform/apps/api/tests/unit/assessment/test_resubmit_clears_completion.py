"""M5 회귀: 재제출 시 상태 desync 수정.
external_service Task 를 완료(doc A, payload A, completed_at 설정)한 뒤
새 report_document_id B(payload 없음)로 재제출하면
- status 가 submitted 로 돌아가며 completed_at 이 클리어돼야 하고
- payload 가 옛 값(A)으로 남으면 안 된다(무조건 덮어쓰기)."""
from app.core.datetime_utils import utc_now
from app.modules.assessment.assessment_task.repository import AssessmentTaskRepository
from app.modules.assessment.assessment_task.services.submit_with_workflow import (
    SubmitWithWorkflowService,
)
# 워크플로우 플러그인 자동 등록
import app.modules.assessment.assessment_task.workflows  # noqa: F401


async def test_resubmit_external_clears_completed_at_and_overwrites_payload(test_session):
    repo = AssessmentTaskRepository(test_session)
    svc = SubmitWithWorkflowService(repo)

    task = await repo.add(
        center_id="center-1",
        case_id="case-1",
        assessment_id="a-1",
        execution_method="online",
    )

    # 완료 상태로 만든다: doc A, payload A, completed_at 설정
    await repo.update_task(
        task_id=task.id,
        status="completed",
        completed_at=utc_now(),
        report_document_id="doc-A",
        report_payload={"score": "A"},
    )
    completed = await repo.get_by_id(task_id=task.id)
    assert completed.completed_at is not None
    assert completed.report_payload == {"score": "A"}

    # 재제출: 새 document_id B, payload 없음
    _atomic, resubmitted = await svc.execute(
        task=completed,
        workflow_type="external_service",
        data={"report_document_id": "doc-B"},
    )

    assert resubmitted.status == "submitted"
    assert resubmitted.completed_at is None
    assert resubmitted.report_document_id == "doc-B"
    # 옛 payload(A)가 그대로 남지 않는다
    assert resubmitted.report_payload != {"score": "A"}
