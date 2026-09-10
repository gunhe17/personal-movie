from datetime import date

from app.core.exceptions import InvalidOperationException
from app.core.type import unset

from ..models import Voucher
from ..repository import VoucherRepository
from .confirm_extraction import derive_eligibility


class UpdateVoucherService:
    def __init__(
        self,
        repo: VoucherRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        voucher_id: str,
        *,
        name: str = unset,
        program_name: str = unset,
        program_organization: str = unset,
        program_year: int = unset,
        usage_start_date: date | None = unset,
        usage_end_date: date | None = unset,
        application_method: str | None = unset,
        application_start_date: date | None = unset,
        application_end_date: date | None = unset,
        support_amount: dict | None = unset,
        support_scope: str | None = unset,
        support_target: str | None = unset,
        contact: str | None = unset,
        eligibility: dict | None = unset,
        record: dict | None = unset,
    ) -> Voucher:
        # load (삭제 포함)
        voucher = await self.repo.get_by_id_all_states(id=voucher_id)

        # record 갱신 시 eligibility 는 record 에서 재유도(명시 전달 없으면) — confirm 과 동일 규약
        if record is not unset and eligibility is unset:
            eligibility = derive_eligibility(record)

        fields = {
            k: v
            for k, v in {
                "name": name,
                "program_name": program_name,
                "program_organization": program_organization,
                "program_year": program_year,
                "usage_start_date": usage_start_date,
                "usage_end_date": usage_end_date,
                "application_method": application_method,
                "application_start_date": application_start_date,
                "application_end_date": application_end_date,
                "support_amount": support_amount,
                "support_scope": support_scope,
                "support_target": support_target,
                "contact": contact,
                "eligibility": eligibility,
                "record": record,
            }.items()
            if v is not unset
        }
        if not fields:
            return voucher

        # verify (patch 적용 후 값으로 날짜 검증)
        _validate_dates(_merge(voucher, fields))

        # update
        updated = await self.repo.update_in_place(id=voucher_id, **fields)
        assert updated is not None
        return updated


def _merge(
    voucher: Voucher,
    patch: dict,
) -> dict:
    fields = (
        "usage_start_date",
        "usage_end_date",
        "application_start_date",
        "application_end_date",
    )
    return {f: patch.get(f, getattr(voucher, f)) for f in fields}


def _validate_dates(merged: dict) -> None:
    usage_start = merged["usage_start_date"]
    usage_end = merged["usage_end_date"]
    if usage_start and usage_end and usage_start > usage_end:
        raise InvalidOperationException("이용 시작일이 종료일보다 늦을 수 없습니다")

    app_start = merged["application_start_date"]
    app_end = merged["application_end_date"]
    if app_start and app_end and app_start > app_end:
        raise InvalidOperationException("신청 시작일이 종료일보다 늦을 수 없습니다")
