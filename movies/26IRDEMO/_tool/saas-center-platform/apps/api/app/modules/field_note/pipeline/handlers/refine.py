from dataclasses import asdict

from app.core.type import uuid_str
from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.event import emit
from ..events import FieldNotePipelineDispatchAtomic
from ..schemas import PipelineStepResponse
from ...facade import PipelineFacade


async def refine_handler(
    field_note_id: str,
    center_id: str,
    uow: UnitOfWork,
    *,
    event_group_id: uuid_str,
    member_id: str | None = None,
) -> PipelineStepResponse:
    facade = PipelineFacade(uow)
    note_atomic, result = await facade.prepare_step(
        field_note_id,
        center_id,
        step="refine",
    )
    atomic = (
        FieldNotePipelineDispatchAtomic.requested(
            field_note_id=field_note_id,
            job_type="refine",
            params={"member_id": member_id},
        )[0]
        if result.status == "started"
        else None
    )
    await emit(
        uow,
        "field_note_pipeline_requested",
        event_group_id=event_group_id,
        atomics=[note_atomic, atomic],
        center_id=center_id,
        actor_id=member_id,
    )

    return PipelineStepResponse(**asdict(result))
