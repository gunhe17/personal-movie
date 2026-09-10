from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.storage import StorageClient
from app.modules.event import emit
from app.modules.assessment.facade import AssessmentTaskFacade
from app.modules.client.facade import ClientFacade
from app.modules.document.facade import DocumentFacade
from app.modules.assessment.assessment_task.schemas import (
    TaskSubmitData,
    TaskResponse,
    AssessmentInfo,
)


async def submit_task_handler(
    task_id: str,
    center_id: str,
    data: TaskSubmitData,
    storage: StorageClient,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    actor_id: str | None,
    owner_scope: str | None = None,
) -> TaskResponse:
    facade = AssessmentTaskFacade(uow, storage)

    # 수정은 케이스 주담당 전용 — 참여 검사자는 열람만
    await facade.verify_task_writable(center_id, task_id, owner_scope)

    client_info = await _resolve_client_info(facade, uow, task_id)

    atomics, result = await facade.submit_task(
        task_id=task_id,
        center_id=center_id,
        data=data.model_dump(),
        client_info=client_info,
    )
    # 보고서 PDF: Document 등록 후 Task에 연결
    pending = result.get("pending_report")
    if pending:
        document_atomic, document = await DocumentFacade(
            uow
        ).register_existing_document(
            center_id=center_id,
            uploader_id="system",
            name=pending["name"],
            description=pending["description"],
            storage_path=pending["storage_path"],
            file_type="application/pdf",
            file_size=pending["file_size"],
            checksum=pending["checksum"],
            access_level="center",
        )
        atomics.append(document_atomic)
        attach_atomic, _ = await facade.attach_report_document(task_id, document.id)
        atomics.append(attach_atomic)

    # notify
    await emit(
        uow,
        "assessment_task_submitted",
        event_group_id=event_group_id,
        atomics=atomics,
        center_id=center_id,
        actor_id=actor_id,
    )

    # Response 조립은 lazy-load 위해 세션 안에서 수행
    task_result = await facade.get_task_with_assessment(task_id)
    task = task_result["task"]
    assessment_data = task_result["assessment"]

    task_response = TaskResponse.model_validate(task, from_attributes=True)
    task_response.assessment = AssessmentInfo(**assessment_data)

    return task_response


async def _resolve_client_info(
    facade: AssessmentTaskFacade,
    uow: UnitOfWork,
    task_id: str,
) -> dict:
    info = await facade.get_report_client_info_by_task(task_id)

    client_id = info.get("client_id")
    if client_id:
        clients = await ClientFacade(uow).list_clients_by_ids([client_id])
        if clients:
            client = clients[0]
            info["student_name"] = client.name or ""
            info["birth_date"] = str(client.birth_date) if client.birth_date else ""
            gender_map = {"male": "남", "female": "여"}
            info["gender"] = (
                gender_map.get(client.gender, client.gender or "")
                if client.gender
                else ""
            )
    return info


TOOL = {
    "name": "submit_task_handler",
    "permission": "write:assessment_case",
    "purpose": "검사 작업(task)의 응답·결과 파일을 제출한다.",
    "keywords": [
        "submit task",
        "검사 제출",
        "응답 제출",
        "결과 업로드",
        "task 제출",
        "검사 답안 제출",
    ],
    "boundaries": "케이스 내 'task' 제출(첨부 문서 등록 포함). 케이스 정보 수정은 update_assessment_case_handler.",
    "output": "제출된 검사 작업 (TaskResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "task_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 검사 작업",
                "description": "제출할 검사 작업(task)의 UUID.",
            },
            "workflow_type": {
                "const": "self_report",
                "title": "워크플로 유형",
                "type": "string",
                "description": "워크플로 유형(자가응답 제출: 'self_report' 고정).",
            },
            "responses": {
                "items": {"additionalProperties": True, "type": "object"},
                "title": "응답 목록",
                "type": "array",
                "description": "문항별 응답 데이터 목록.",
            },
            "current_item": {
                "anyOf": [{"type": "integer"}, {"type": "null"}],
                "default": None,
                "title": "현재 문항",
                "description": "진행 중 문항 인덱스(중간 저장용, 선택).",
            },
        },
        "required": ["task_id", "workflow_type", "responses"],
    },
}
