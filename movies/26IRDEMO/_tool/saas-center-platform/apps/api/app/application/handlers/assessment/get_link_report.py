from dataclasses import dataclass

from app.core.exceptions import PermissionDeniedException
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.storage.common.base import StorageClient
from app.modules.assessment.facade import AssessmentTaskFacade
from app.modules.document.facade import DocumentFacade
from app.modules.event import emit

from .get_link_task import _validate_link_task


@dataclass(frozen=True)
class LinkReportAccess:
    link_id: str
    task_id: str

    def act(self):
        return "report_viewed"

    def act_entity_name(self):
        return "assessment_send_link"

    def act_entity_id(self):
        return self.link_id

    def payload(self):
        return {"data": {"task_id": self.task_id}}


async def get_link_report_handler(send_link_id: str, task_id: str, uow: UnitOfWork, storage: StorageClient, *, event_group_id: str) -> dict:
    center_id = await _validate_link_task(send_link_id, task_id, uow)
    task = await AssessmentTaskFacade(uow).get_task(task_id, center_id)
    if task.status != "completed" or not task.is_report_visible_to_guardian or not task.report_document_id:
        raise PermissionDeniedException("아직 공개되지 않은 결과입니다.")
    documents = await DocumentFacade(uow).get_documents_by_ids([task.report_document_id], center_id)
    document = next((item for item in documents if item.id == task.report_document_id), None)
    if document is None:
        raise PermissionDeniedException("결과 파일을 확인할 수 없습니다.")
    url = await storage.get_presigned_url(path=document.storage_path, expires_in=60)
    await emit(uow, "assessment_send_link_report_viewed", event_group_id=event_group_id,
               atomics=[LinkReportAccess(send_link_id, task_id)], center_id=center_id, actor_type="guest")
    return {"download_url": url, "expires_in": 60}
