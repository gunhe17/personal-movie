# 라우터가 링크 토큰(aud=assessment_link)을 검증해 send_link_id를 신뢰 — 여기선 링크 유효성·task 소속만 재검증
from app.core.exceptions import PermissionDeniedException
from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.infrastructure.storage.common.base import StorageClient
from app.modules.assessment.assessment_task.schemas import (
    TaskResponse,
    TaskSubmitData,
)

from .submit_task import submit_task_handler


async def _validate_link_task(
    send_link_id: str,
    task_id: str,
    uow: UnitOfWork,
) -> str:
    from app.modules.assessment.facade import AssessmentTaskFacade, SendLinkFacade

    link = await SendLinkFacade(uow).get_active_link_public(send_link_id)
    task = await AssessmentTaskFacade(uow).get_task(task_id, link.center_id)
    if task.case_id != link.case_id or task.assessment_id not in set(
        link.assessment_ids
    ):
        raise PermissionDeniedException("이 링크로 접근할 수 없는 검사입니다")
    return link.center_id


async def submit_link_task_handler(
    send_link_id: str,
    task_id: str,
    data: TaskSubmitData,
    storage: StorageClient,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
) -> TaskResponse:
    center_id = await _validate_link_task(send_link_id, task_id, uow)

    # 익명 수행 경로 — actor 없음(emit actor_id nullable). 자동 채점·보고서 파이프라인 포함 재사용
    return await submit_task_handler(
        task_id,
        center_id,
        data,
        storage,
        uow,
        event_group_id=event_group_id,
        actor_id=None,
    )
