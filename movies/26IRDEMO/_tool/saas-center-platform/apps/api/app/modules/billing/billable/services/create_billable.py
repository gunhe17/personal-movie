from collections import defaultdict
from datetime import date
from app.core.datetime_utils import utc_now

from app.core.exceptions import (
    ConflictException,
    InvalidOperationException,
)
from app.modules.billing.billable.events import BillableAtomic
from app.modules.billing.billable.models import Billable
from app.modules.billing.billable.repository import BillableRepository
from app.modules.billing.billable_item.models import BillableItem
from app.modules.billing.billable_item.repository import BillableItemRepository
from app.modules.billing.billable.schemas import BillableCreateResult


class CreateBillableService:
    def __init__(
        self,
        billable_repo: BillableRepository,
        item_repo: BillableItemRepository,
    ):
        self.billable_repo = billable_repo
        self.item_repo = item_repo

    async def execute(
        self,
        *,
        center_id: str,
        client_id: str,
        billable_date: date,
        due_date: date | None,
        memo: str | None,
        discount_amount: int,
        subsidy_amount: int,
        item_rows: list[dict],
        account_id: str,
    ) -> tuple[BillableAtomic, BillableCreateResult]:
        if not item_rows:
            raise InvalidOperationException("청구 항목이 최소 1개 이상 필요합니다")

        # 세션 단위 청구 중복 / 패키지 커버 충돌 검사
        # 상담 세션: 한 회기 = 1 청구 → 중복/기존 청구 차단 (참여자별 분리)
        # 검사 세션: 한 회기에 여러 검사 항목 가능 → 항목 단위 중복 검사 안 함
        seen_counseling_session_keys: set[str] = set()
        for item_data in item_rows:
            related_type = item_data["related_type"] or ""
            if related_type.endswith("_session") and item_data["related_session_id"]:
                is_counseling = related_type == "counseling_session"

                if is_counseling:
                    # 1) 같은 요청 내 동일 상담 세션 중복 차단
                    if item_data["related_session_id"] in seen_counseling_session_keys:
                        raise ConflictException(
                            "동일 상담 세션에 대한 항목이 중복되었습니다"
                        )
                    seen_counseling_session_keys.add(item_data["related_session_id"])

                    # 2) 이미 해당 (상담 세션, 내담자) 쌍에 청구가 있으면 차단
                    #    그룹 세션은 참여자별로 개별 Billable 발행되므로 client_id로 함께 필터
                    has_existing = await self.billable_repo.exists_billing_for_session(
                        center_id=center_id,
                        related_session_id=item_data["related_session_id"],
                        related_type=related_type,
                        client_id=client_id,
                    )
                    if has_existing:
                        raise ConflictException(
                            "이미 해당 상담 세션에 대한 청구가 있습니다"
                        )

                # 3) 같은 내담자의 케이스에 패키지 선결제가 있으면 차단 (이중 커버 방지)
                #    상담·검사 공통. 내담자 단위 상호배제: A의 패키지가 B의 세션 청구를 막지 않음.
                if item_data["related_case_id"]:
                    case_type = related_type.replace("_session", "_case")
                    has_package = await self.billable_repo.exists_package_billing_for_case(
                        center_id=center_id,
                        related_case_id=item_data["related_case_id"],
                        case_related_type=case_type,
                        client_id=client_id,
                    )
                    if has_package:
                        raise ConflictException(
                            "패키지 선결제로 이미 커버된 세션이에요"
                        )

        # 케이스 패키지 청구 시도 시: 같은 내담자의 동일 케이스에 세션 개별 청구 또는 기존 패키지가 있으면 차단
        for item_data in item_rows:
            related_type = item_data["related_type"] or ""
            if related_type.endswith("_case") and item_data["related_case_id"]:
                has_session = await self.billable_repo.exists_session_billing_for_case(
                    center_id=center_id,
                    related_case_id=item_data["related_case_id"],
                    case_related_type=related_type,
                    client_id=client_id,
                )
                if has_session:
                    raise ConflictException(
                        "이미 개별 청구가 있어 패키지 선결제를 진행할 수 없습니다"
                    )
                has_package = await self.billable_repo.exists_package_billing_for_case(
                    center_id=center_id,
                    related_case_id=item_data["related_case_id"],
                    case_related_type=related_type,
                    client_id=client_id,
                )
                if has_package:
                    raise ConflictException(
                        "해당 케이스에 이미 패키지 선결제가 있습니다"
                    )
                break  # 케이스 청구는 보통 1개 케이스에 대해서만 발행되므로 한 번만 검사

        discount_amount = discount_amount or 0
        subsidy_amount = subsidy_amount or 0

        # 청구서 생성 (즉시 issued 상태로 발행)
        now_utc = utc_now()
        billable = await self.billable_repo.add(
            center_id=center_id,
            client_id=client_id,
            billable_date=billable_date,
            due_date=due_date,
            memo=memo,
            status="issued",
            issued_at=now_utc,
            total_amount=0,
            discount_amount=discount_amount,
            subsidy_amount=subsidy_amount,
            paid_amount=0,
            unpaid_amount=0,
            created_by=account_id,
        )

        # 사전 단계 1: 정가 합계 + 바우처 연결 item들의 회기 차감량 계산
        #
        # 회기는 "세션(방문) 단위"로 차감한다. 따라서 quantity 합이 아니라
        # 바우처별 고유 (related_session_id ?? related_case_id) 개수로 센다.
        # - 검사 케이스 1건에 검사 item 3개(같은 case, session 없음) → 1회기
        # - 상담 패키지 묶음결제(세션 3개, related_session_id 각기 다름) → 3회기
        subtotal = 0
        voucher_item_indices: list[int] = []  # 바우처 연결 item의 item_rows 내 인덱스
        # 바우처별 차감 단위 키 집합 (고유 세션/케이스)
        voucher_session_keys: dict[str, set[str]] = defaultdict(set)

        for idx, item_data in enumerate(item_rows):
            amount = item_data["quantity"] * item_data["unit_price"]
            subtotal += amount
            if item_data["client_voucher_id"]:
                voucher_item_indices.append(idx)
                # 세션 단위 우선, 없으면 케이스 단위로 묶음
                unit_key = (
                    item_data["related_session_id"]
                    or item_data["related_case_id"]
                    or f"item:{idx}"  # 둘 다 없으면 항목 단위 (폴백)
                )
                voucher_session_keys[item_data["client_voucher_id"]].add(unit_key)

        # 바우처별 차감 회기 = 고유 세션/케이스 개수
        voucher_consumption: dict[str, int] = {
            voucher_id: len(keys)
            for voucher_id, keys in voucher_session_keys.items()
        }

        # 청구서 단위 지원금 > 0인데 바우처 연결 item이 하나도 없으면 차단
        if subsidy_amount > 0 and not voucher_consumption:
            raise InvalidOperationException(
                "지원금은 바우처가 연결된 청구서에만 입력할 수 있어요"
            )

        # 사전 단계 2: 청구서 단위 subsidy를 바우처 연결 item들에 회기 비율로 분배
        # (각 item이 voucher에서 얼마를 끌어다 썼는지 추적 — usage API 정합)
        item_subsidy_map: dict[int, int] = {}
        if subsidy_amount > 0 and voucher_item_indices:
            total_voucher_qty = sum(
                item_rows[i]["quantity"] for i in voucher_item_indices
            )
            allocated = 0
            for idx in voucher_item_indices[:-1]:
                share = (subsidy_amount * item_rows[idx]["quantity"]) // total_voucher_qty
                item_subsidy_map[idx] = share
                allocated += share
            # 마지막 item이 나머지 흡수 (rounding 보정)
            item_subsidy_map[voucher_item_indices[-1]] = subsidy_amount - allocated

        # 항목 생성
        items: list[BillableItem] = []
        # 바우처별 차감할 금액 합계 (item별 분배값을 voucher_id로 묶음)
        voucher_amount_consumption: dict[str, int] = defaultdict(int)

        for idx, item_data in enumerate(item_rows):
            amount = item_data["quantity"] * item_data["unit_price"]
            item_subsidy = item_subsidy_map.get(idx, 0)

            item = await self.item_repo.add(
                billable_id=billable.id,
                item_type=item_data["item_type"],
                item_id=item_data["item_id"],
                related_type=item_data["related_type"],
                related_case_id=item_data["related_case_id"],
                related_session_id=item_data["related_session_id"],
                client_voucher_id=item_data["client_voucher_id"],
                price_list_id=item_data["price_list_id"],
                description=item_data["description"],
                quantity=item_data["quantity"],
                unit_price=item_data["unit_price"],
                amount=amount,
                subsidy_amount=item_subsidy,
                provided_at=item_data["provided_at"],
                memo=item_data["memo"],
            )
            items.append(item)

            if item_data["client_voucher_id"] and item_subsidy:
                voucher_amount_consumption[item_data["client_voucher_id"]] += item_subsidy

        # 할인 + 지원금 검증: 합쳐서 정가 합계를 초과할 수 없음
        deductions = discount_amount + subsidy_amount
        if deductions > subtotal:
            raise InvalidOperationException(
                f"할인액·지원금 합({deductions:,}원)이 "
                f"정가 합계({subtotal:,}원)를 초과할 수 없어요"
            )

        # 최종 총액(본인부담금) = 정가 합계 - 지원금 - 할인액
        total = subtotal - subsidy_amount - discount_amount

        # 총액 반영 (0원 청구는 발행과 동시에 자동 완납 처리)
        is_zero = total == 0
        update_payload: dict = {
            "total_amount": total,
            "unpaid_amount": 0 if is_zero else total,
        }
        if is_zero:
            update_payload["status"] = "paid"

        billable = await self.billable_repo.update_in_center(
            billable_id=billable.id,
            center_id=center_id,
            **update_payload,
        )

        # 바우처 회기·금액 차감은 cross-module(application handler)이 조율한다.
        # 같은 UoW 트랜잭션 — 차감 실패 시 청구서/항목까지 롤백. 직렬화도 handler.
        atomic, _ = BillableAtomic.created(billable=billable)
        return atomic, BillableCreateResult(
            billable=billable,
            items=items,
            client_id=client_id,
            billable_date=billable_date,
            voucher_consumption=voucher_consumption,
            voucher_amount_consumption=dict(voucher_amount_consumption),
        )
