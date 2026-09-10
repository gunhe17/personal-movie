from datetime import date

from app.core.exceptions import EntityNotFoundException, InvalidOperationException
from app.core.type import uuid_str

from ..events import ClientVoucherAtomic
from ..repository import ClientVoucherRepository


class ConsumeSessionsService:
    def __init__(
        self,
        repo: ClientVoucherRepository,
    ):
        self.repo = repo

    async def execute(
        self,
        center_id: uuid_str,
        client_id: uuid_str,
        *,
        billable_date: date,
        consumption: dict[str, int],
        amount_consumption: dict[str, int] | None = None,
    ) -> tuple[list[ClientVoucherAtomic], list[str]]:
        amount_consumption = amount_consumption or {}
        atomics: list[ClientVoucherAtomic] = []
        warnings: list[str] = []

        for voucher_id, qty in consumption.items():
            # verify
            try:
                voucher = await self.repo.get_for_update(
                    client_voucher_id=voucher_id,
                    center_id=center_id,
                )
            except EntityNotFoundException:
                raise EntityNotFoundException(f"바우처를 찾을 수 없어요: {voucher_id}")
            if voucher.client_id != client_id:
                raise InvalidOperationException("바우처가 다른 내담자 소유에요")
            if voucher.valid_from is not None and billable_date < voucher.valid_from:
                raise InvalidOperationException(
                    f"바우처 유효기간이 아직 시작되지 않았어요 "
                    f"(시작일 {voucher.valid_from})"
                )
            if voucher.valid_until is not None and billable_date > voucher.valid_until:
                raise InvalidOperationException(
                    f"바우처 유효기간이 지났어요 (만료일 {voucher.valid_until})"
                )
            if voucher.remaining_sessions < qty:
                raise InvalidOperationException(
                    f"바우처 잔여 회기를 초과했어요 "
                    f"(잔여 {voucher.remaining_sessions}회 / 청구 {qty}회)"
                )

            # update (금액 초과는 차단하지 않고 경고 — 차감은 진행)
            amt = amount_consumption.get(voucher_id, 0)
            if amt and voucher.remaining_amount is not None:
                if voucher.remaining_amount < amt:
                    warnings.append(
                        f"바우처 잔여 금액을 초과했어요 "
                        f"(잔여 {voucher.remaining_amount:,}원 / 청구 {amt:,}원). "
                        f"차감은 진행되었으니 보정해주세요."
                    )
                updated = await self.repo.update_in_center(
                    client_voucher_id=voucher_id,
                    center_id=center_id,
                    remaining_sessions=voucher.remaining_sessions - qty,
                    remaining_amount=voucher.remaining_amount - amt,
                )
                changed = {
                    "remaining_sessions": updated.remaining_sessions,
                    "remaining_amount": updated.remaining_amount,
                }
            else:
                updated = await self.repo.update_in_center(
                    client_voucher_id=voucher_id,
                    center_id=center_id,
                    remaining_sessions=voucher.remaining_sessions - qty,
                )
                changed = {"remaining_sessions": updated.remaining_sessions}

            atomic, _ = ClientVoucherAtomic.updated(
                client_voucher=updated, changed=changed
            )
            atomics.append(atomic)

        return atomics, warnings
