"""Examination Handlers — UoW 트랜잭션 경계 + Facade 호출"""
from datetime import datetime

from app.core.dependencies import ClientInfo
from app.modules.auth.dependencies import InstitutionContext
from app.core.unit_of_work import UnitOfWork
from app.modules.examination.common.schemas import (
    DashboardStats,
    ExaminationBatteryCreate,
    ExaminationBatteryResponse,
    ExaminationCreate,
    ExaminationListWithNamesResponse,
    ExaminationResponse,
    ExaminationUpdate,
)
from app.modules.examination.facade import ExaminationFacade


async def handle_list_examinations(
    ctx: InstitutionContext,
    uow: UnitOfWork,
    *,
    page: int = 1,
    size: int = 20,
    status: str | None = None,
    exam_type: str | None = None,
    client_id: str | None = None,
    examiner_id: str | None = None,
    mine: bool = False,
    search: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> ExaminationListWithNamesResponse:
    async with uow:
        return await ExaminationFacade(uow).list_examinations(
            ctx, page=page, size=size,
            status=status, exam_type=exam_type,
            client_id=client_id, examiner_id=examiner_id,
            mine=mine, search=search,
            date_from=date_from, date_to=date_to,
        )


async def handle_get_examination(
    ctx: InstitutionContext,
    exam_id: str,
    uow: UnitOfWork,
) -> ExaminationResponse:
    async with uow:
        return await ExaminationFacade(uow).get_examination(ctx, exam_id)


async def handle_create_examination(
    ctx: InstitutionContext,
    data: ExaminationCreate,
    client_info: ClientInfo,
    uow: UnitOfWork,
) -> ExaminationResponse:
    async with uow:
        result = await ExaminationFacade(uow).create_examination(ctx, data, client_info)
        await uow.commit()
        return result


async def handle_create_battery(
    ctx: InstitutionContext,
    data: ExaminationBatteryCreate,
    client_info: ClientInfo,
    uow: UnitOfWork,
) -> ExaminationBatteryResponse:
    async with uow:
        result = await ExaminationFacade(uow).create_battery(ctx, data, client_info)
        await uow.commit()
        return result


async def handle_update_examination(
    ctx: InstitutionContext,
    exam_id: str,
    data: ExaminationUpdate,
    client_info: ClientInfo,
    uow: UnitOfWork,
) -> ExaminationResponse:
    async with uow:
        result = await ExaminationFacade(uow).update_examination(
            ctx, exam_id, data, client_info
        )
        await uow.commit()
        return result


async def handle_dashboard_stats(
    ctx: InstitutionContext,
    uow: UnitOfWork,
) -> DashboardStats:
    async with uow:
        return await ExaminationFacade(uow).get_dashboard_stats(ctx)
