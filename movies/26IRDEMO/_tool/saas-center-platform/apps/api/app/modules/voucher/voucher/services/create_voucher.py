from datetime import date

from app.core.exceptions import InvalidOperationException
from app.modules.voucher.voucher.models import Voucher
from app.modules.voucher.voucher.repository import VoucherRepository

_CATALOG_FIELDS = (
    "name",
    "program_name",
    "program_organization",
    "program_year",
    "usage_start_date",
    "usage_end_date",
    "application_method",
    "application_start_date",
    "application_end_date",
    "support_amount",
    "support_scope",
    "support_target",
    "contact",
    "eligibility",
)


class CreateVoucherService:
    def __init__(
        self,
        repo: VoucherRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        *,
        name: str,
        program_name: str,
        program_organization: str,
        program_year: int,
        usage_start_date: date | None = None,
        usage_end_date: date | None = None,
        application_method: str | None = None,
        application_start_date: date | None = None,
        application_end_date: date | None = None,
        support_amount: dict | None = None,
        support_scope: str | None = None,
        support_target: str | None = None,
        contact: str | None = None,
        eligibility: dict | None = None,
    ) -> Voucher:
        # verify
        _validate_dates(
            usage_start=usage_start_date,
            usage_end=usage_end_date,
            app_start=application_start_date,
            app_end=application_end_date,
        )

        # return
        return await self.repo.add(
            name=name,
            program_name=program_name,
            program_organization=program_organization,
            program_year=program_year,
            usage_start_date=usage_start_date,
            usage_end_date=usage_end_date,
            application_method=application_method,
            application_start_date=application_start_date,
            application_end_date=application_end_date,
            support_amount=support_amount,
            support_scope=support_scope,
            support_target=support_target,
            contact=contact,
            eligibility=eligibility,
        )


def _validate_dates(
    *,
    usage_start: date | None,
    usage_end: date | None,
    app_start: date | None,
    app_end: date | None,
) -> None:
    if usage_start and usage_end and usage_start > usage_end:
        raise InvalidOperationException(
            "이용 시작일이 종료일보다 늦을 수 없습니다"
        )
    if app_start and app_end and app_start > app_end:
        raise InvalidOperationException(
            "신청 시작일이 종료일보다 늦을 수 없습니다"
        )
