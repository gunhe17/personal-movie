from app.core.exceptions import EntityNotFoundException, PermissionDeniedException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.storage.common.base import StorageClient
from app.modules.assessment.facade.assessment_case_facade import AssessmentCaseFacade
from app.modules.assessment.facade.task_facade import AssessmentTaskFacade
from app.modules.center_link.facade import CenterLinkFacade
from app.modules.client_app.schemas import AppAssessmentReportResponse
from app.modules.document.facade import DocumentFacade
from app.modules.family.facade import FamilyFacade

PRESIGNED_URL_EXPIRES = 3600


async def get_app_assessment_report_handler(
    *,
    person_id: uuid_str,
    task_id: uuid_str,
    uow: UnitOfWork,
    storage: StorageClient,
) -> AppAssessmentReportResponse:
    async with uow:
        family_id = await FamilyFacade(uow).find_family_id(person_id=person_id)
        if family_id is None:
            raise PermissionDeniedException("연결된 센터가 없습니다.")

        links = await CenterLinkFacade(uow).list_links_by_family(
            family_id=family_id, alive_only=True
        )
        links = [link for link in links if link.status == "active"]
        if not links:
            raise PermissionDeniedException("연결된 센터가 없습니다.")

        task_facade = AssessmentTaskFacade(uow)
        case_facade = AssessmentCaseFacade(uow)

        # G2 — 이 task 의 case 가 우리 가족의 client 것인지 확인(요청 파라미터를 신뢰하지 않는다)
        task = None
        owner_cases = []
        for link in links:
            try:
                candidate = await task_facade.get_task(task_id, link.center_id)
            except (EntityNotFoundException, PermissionDeniedException):
                continue
            cases = await case_facade.get_cases_by_client(link.center_id, link.client_id)
            if any(case.id == candidate.case_id for case in cases):
                task = candidate
                owner_cases = cases
                break
        if task is None:
            raise PermissionDeniedException("열람 권한이 없습니다.")

        # G3 — 센터가 결과를 전송(공개)했을 때만
        if not task.is_report_visible_to_guardian or not task.report_document_id:
            raise PermissionDeniedException("아직 공개된 결과지가 없습니다.")

        documents = await DocumentFacade(uow).get_documents_by_ids(
            [task.report_document_id], task.center_id
        )
        document = documents[0] if documents else None
        if document is None:
            raise EntityNotFoundException("결과지를 찾을 수 없습니다.")

        name = _task_display_name(owner_cases, task)

        download_url = await storage.get_presigned_url(
            path=document.storage_path,
            expires_in=PRESIGNED_URL_EXPIRES,
        )

    return AppAssessmentReportResponse(
        task_id=task.id,
        name=name,
        download_url=download_url,
        expires_in=PRESIGNED_URL_EXPIRES,
    )


def _task_display_name(cases, task) -> str:
    for case in cases:
        if case.id != task.case_id:
            continue
        for item in case.assessment_summary or []:
            if item.get("id") == task.assessment_id:
                return item.get("kor_name") or item.get("eng_name") or "검사 결과지"
    return "검사 결과지"
