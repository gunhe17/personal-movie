from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.client_app.schemas import AppVoucherItem
from app.modules.voucher.facade.voucher_facade import VoucherFacade
from app.modules.voucher.voucher.support_amount import format_support_amount


async def list_app_vouchers_handler(*, uow: UnitOfWork) -> list[AppVoucherItem]:
    # load
    vouchers = await VoucherFacade(uow).list_catalog()

    # return
    return [
        AppVoucherItem(
            id=voucher.id,
            name=voucher.name,
            program_name=voucher.program_name,
            program_organization=voucher.program_organization,
            program_year=voucher.program_year,
            application_method=voucher.application_method,
            application_start_date=voucher.application_start_date,
            application_end_date=voucher.application_end_date,
            support_amount_text=format_support_amount(voucher.support_amount),
            support_scope=voucher.support_scope,
            support_target=voucher.support_target,
            contact=voucher.contact,
            eligibility=voucher.eligibility,
        )
        for voucher in vouchers
    ]
