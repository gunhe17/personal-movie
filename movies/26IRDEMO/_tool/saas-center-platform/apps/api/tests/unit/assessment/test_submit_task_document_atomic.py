import importlib
from types import SimpleNamespace
from unittest.mock import AsyncMock


module = importlib.import_module(
    "app.application.handlers.assessment.submit_task"
)


async def test_submit_task_emits_registered_document_atomic(monkeypatch):
    task_atomic = object()
    document_atomic = object()
    attach_atomic = object()
    emitted = AsyncMock()

    class FakeAssessmentTaskFacade:
        def __init__(
            self,
            uow,
            storage,
        ):
            pass

        async def verify_task_writable(
            self,
            center_id,
            task_id,
            member_id,
        ):
            # 쓰기 가드 — 이 테스트는 관리자(owner_scope=None) 경로라 통과
            return None

        async def get_report_client_info_by_task(
            self,
            task_id,
        ):
            return {}

        async def submit_task(
            self,
            **kwargs,
        ):
            return [task_atomic], {
                "pending_report": {
                    "name": "report.pdf",
                    "description": "report",
                    "storage_path": "reports/report.pdf",
                    "file_size": 8,
                    "checksum": "a" * 64,
                }
            }

        async def attach_report_document(
            self,
            task_id,
            document_id,
        ):
            return attach_atomic, object()

        async def get_task_with_assessment(
            self,
            task_id,
        ):
            return {
                "task": object(),
                "assessment": {
                    "code": "TEST",
                    "kor_name": "테스트",
                    "workflow_type": "self_report",
                    "definition": {},
                },
            }

    class FakeDocumentFacade:
        def __init__(
            self,
            uow,
        ):
            pass

        async def register_existing_document(
            self,
            **kwargs,
        ):
            return document_atomic, SimpleNamespace(id="document-1")

    class FakeTaskResponse:
        @classmethod
        def model_validate(
            cls,
            task,
            *,
            from_attributes,
        ):
            return SimpleNamespace(assessment=None)

    monkeypatch.setattr(module, "AssessmentTaskFacade", FakeAssessmentTaskFacade)
    monkeypatch.setattr(module, "DocumentFacade", FakeDocumentFacade)
    monkeypatch.setattr(module, "TaskResponse", FakeTaskResponse)
    monkeypatch.setattr(module, "AssessmentInfo", lambda **kwargs: kwargs)
    monkeypatch.setattr(module, "emit", emitted)

    await module.submit_task_handler(
        task_id="task-1",
        center_id="center-1",
        data=SimpleNamespace(model_dump=lambda: {"workflow_type": "self_report"}),
        storage=object(),
        uow=object(),
        event_group_id="event-group-1",
        actor_id="member-1",
    )

    assert emitted.await_args.kwargs["atomics"] == [
        task_atomic,
        document_atomic,
        attach_atomic,
    ]
