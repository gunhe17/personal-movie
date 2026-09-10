# Payment 도메인 엣지 케이스

> 예외 상황, 경계 조건, 에러 처리 가이드

---

## 목차

1. [바우처 관련 엣지 케이스](#바우처-관련-엣지-케이스)
2. [청구서 생성 엣지 케이스](#청구서-생성-엣지-케이스)
3. [수납 처리 엣지 케이스](#수납-처리-엣지-케이스)
4. [동시성 문제](#동시성-문제)
5. [데이터 무결성](#데이터-무결성)
6. [비즈니스 규칙 위반](#비즈니스-규칙-위반)

---

## 바우처 관련 엣지 케이스

### 케이스 1: 바우처 잔여 횟수 부족

**상황**:
- ClientVoucher(remaining_sessions=0)
- 센터가 바우처 청구 시도

**처리**:
```python
async def validate_voucher_availability(
    client_voucher: ClientVoucher
) -> None:
    if client_voucher.remaining_sessions < 1:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "VOUCHER_EXHAUSTED",
                "message": "바우처 잔여 횟수가 부족합니다",
                "remaining_sessions": 0,
                "total_sessions": client_voucher.total_sessions,
                "voucher_id": client_voucher.id
            }
        )
```

**에러 응답**:
```json
{
  "detail": {
    "code": "VOUCHER_EXHAUSTED",
    "message": "바우처 잔여 횟수가 부족합니다",
    "remaining_sessions": 0,
    "total_sessions": 10,
    "voucher_id": 5
  }
}
```

---

### 케이스 2: 월별 사용 한도 초과

**상황**:
- VoucherPolicy(max_sessions_per_month=4)
- 이번 달 이미 4회 사용
- 추가 사용 시도

**처리**:
```python
async def validate_monthly_limit(
    client_id: int,
    voucher_policy_id: int,
    year_month: str,
    policy: VoucherPolicy
) -> None:
    # 이번 달 사용 횟수 조회
    usage = await billable_item_repo.count_voucher_usage_this_month(
        client_id=client_id,
        voucher_policy_id=voucher_policy_id,
        year_month=year_month
    )

    if usage >= policy.max_sessions_per_month:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "MONTHLY_LIMIT_EXCEEDED",
                "message": f"월 사용 한도를 초과했습니다 ({usage}/{policy.max_sessions_per_month})",
                "current_usage": usage,
                "max_sessions_per_month": policy.max_sessions_per_month,
                "year_month": year_month,
                "next_available": f"{year_month[:7]}-01"  # 다음 달 1일
            }
        )
```

**에러 응답**:
```json
{
  "detail": {
    "code": "MONTHLY_LIMIT_EXCEEDED",
    "message": "월 사용 한도를 초과했습니다 (4/4)",
    "current_usage": 4,
    "max_sessions_per_month": 4,
    "year_month": "2026-01",
    "next_available": "2026-02-01"
  }
}
```

---

### 케이스 3: 바우처 유효기간 만료

**상황**:
- ClientVoucher(expires_at="2026-01-31")
- 현재 날짜: 2026-02-01
- 바우처 사용 시도

**처리**:
```python
async def validate_voucher_validity(
    client_voucher: ClientVoucher
) -> None:
    today = date.today()

    # 시작일 체크
    if client_voucher.started_at > today:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "VOUCHER_NOT_STARTED",
                "message": "바우처 사용 기간이 아직 시작되지 않았습니다",
                "started_at": client_voucher.started_at.isoformat(),
                "today": today.isoformat()
            }
        )

    # 종료일 체크
    if client_voucher.expires_at and client_voucher.expires_at < today:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "VOUCHER_EXPIRED",
                "message": "바우처 사용 기간이 만료되었습니다",
                "expires_at": client_voucher.expires_at.isoformat(),
                "today": today.isoformat(),
                "remaining_sessions": client_voucher.remaining_sessions
            }
        )

    # 비활성화 체크
    if not client_voucher.is_active:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "VOUCHER_INACTIVE",
                "message": "비활성화된 바우처입니다"
            }
        )
```

**자동 만료 처리** (배치):
```python
async def deactivate_expired_vouchers():
    """매일 자동 실행: 만료된 바우처 비활성화"""
    today = date.today()

    stmt = (
        select(ClientVoucher)
        .where(ClientVoucher.is_active == True)
        .where(ClientVoucher.expires_at < today)
    )

    result = await session.execute(stmt)
    expired_vouchers = result.scalars().all()

    for voucher in expired_vouchers:
        voucher.is_active = False

    await session.commit()

    return len(expired_vouchers)
```

---

### 케이스 4: 중복 바우처 등록 방지

**상황**:
- ClientVoucher(client_id=10, voucher_policy_id=1, is_active=True) 이미 존재
- 동일 정책으로 재등록 시도

**처리**:
```python
async def create_client_voucher(data: ClientVoucherCreate):
    async with uow:
        # 중복 체크
        existing = await client_voucher_repo.get_active_by_client_and_policy(
            client_id=data.client_id,
            voucher_policy_id=data.voucher_policy_id
        )

        if existing:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "DUPLICATE_VOUCHER",
                    "message": "이미 활성화된 동일 바우처가 있습니다",
                    "existing_voucher_id": existing.id,
                    "remaining_sessions": existing.remaining_sessions,
                    "expires_at": existing.expires_at.isoformat() if existing.expires_at else None
                }
            )

        # 생성
        voucher = await client_voucher_repo.create(data.model_dump())
        await uow.commit()
        return voucher
```

---

### 케이스 5: 바우처 정책이 비활성화된 경우

**상황**:
- VoucherPolicy(id=1, is_active=False) (정부 사업 종료)
- 청구서 생성 시도

**처리**:
```python
async def validate_voucher_policy(voucher_policy_id: int):
    policy = await voucher_policy_repo.get(voucher_policy_id)

    if not policy:
        raise HTTPException(404, "바우처 정책을 찾을 수 없습니다")

    if not policy.is_active:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "VOUCHER_POLICY_INACTIVE",
                "message": "비활성화된 바우처 정책입니다",
                "policy_name": policy.name,
                "valid_until": policy.valid_until.isoformat() if policy.valid_until else None
            }
        )
```

---

## 청구서 생성 엣지 케이스

### 케이스 6: 빈 청구서 생성 방지

**상황**:
- items=[] (청구 항목 없음)
- 청구서 생성 시도

**처리**:
```python
class BillableCreate(BaseModel):
    client_id: int
    billable_date: date
    items: list[BillableItemCreate]

    @field_validator("items")
    @classmethod
    def validate_items_not_empty(cls, v):
        if not v or len(v) == 0:
            raise ValueError("청구 항목이 최소 1개 이상 필요합니다")
        return v
```

**에러 응답**:
```json
{
  "detail": [
    {
      "loc": ["body", "items"],
      "msg": "청구 항목이 최소 1개 이상 필요합니다",
      "type": "value_error"
    }
  ]
}
```

---

### 케이스 7: 음수 금액 처리 (환불/차액)

**상황**:
- 과청구 발생, 차액 환불 필요
- unit_price=-30000 입력

**처리**:
```python
class BillableItemCreate(BaseModel):
    unit_price: int
    quantity: int = 1

    @field_validator("quantity")
    @classmethod
    def validate_quantity_positive(cls, v):
        if v <= 0:
            raise ValueError("수량은 1 이상이어야 합니다")
        return v

    @model_validator(mode="after")
    def validate_amount(self):
        # 음수 금액 허용 (환불/차액)
        # 하지만 경고 로그
        if self.unit_price < 0:
            logger.warning(f"음수 금액 청구 항목 생성: {self.unit_price}")
        return self

# Handler에서 추가 검증
async def create_billable(data: BillableCreate):
    # 음수 항목이 있으면 notes 필수
    has_negative = any(item.unit_price < 0 for item in data.items)

    if has_negative and not data.notes:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "NEGATIVE_AMOUNT_REQUIRES_NOTE",
                "message": "음수 금액 항목이 있는 경우 메모가 필수입니다"
            }
        )
```

**주의사항**:
- 음수 금액 자체는 허용 (환불/차액 조정)
- 하지만 notes 필수 (사유 기록)
- total_amount가 음수가 될 수 있음 (환불 청구서)

---

### 케이스 8: 미래 날짜 청구 방지

**상황**:
- billable_date="2027-01-01" (1년 후)
- 청구서 생성 시도

**처리**:
```python
class BillableCreate(BaseModel):
    billable_date: date

    @field_validator("billable_date")
    @classmethod
    def validate_billable_date_not_future(cls, v):
        today = date.today()
        if v > today:
            raise ValueError(
                f"청구 일자는 미래 날짜일 수 없습니다 (오늘: {today}, 입력: {v})"
            )
        return v
```

**예외**:
- `provided_at`는 미래 날짜 허용 (예약 서비스)
- `billable_date`는 미래 날짜 금지 (청구는 과거/현재만)

---

### 케이스 9: 과거 서비스 청구 (제한 없음)

**상황**:
- provided_at="2025-01-01" (1년 전)
- 청구서 생성 시도

**처리**:
```python
# 과거 서비스 청구는 제한 없음 (유연성)
# 하지만 경고 로그
if provided_at < (datetime.now(timezone.utc) - timedelta(days=90)):
    logger.warning(
        f"90일 이전 서비스 청구: client_id={data.client_id}, "
        f"provided_at={provided_at}"
    )
```

**이유**:
- 센터마다 청구 시점 상이
- 과거 서비스 청구 허용 (유연성)
- 3개월 이상 과거면 경고만 (감사용)

---

## 수납 처리 엣지 케이스

### 케이스 10: 과납부 처리

**상황**:
- Billable(total_amount=100000, paid_amount=50000)
- Payment(amount=80000) 추가 → paid_amount=130000 (과납부)

**처리 방안 A: 에러 (엄격한 정책)**
```python
async def process_payment(data: PaymentCreate):
    async with uow:
        billable = await billable_repo.get(data.billable_id)

        # 과납부 방지
        remaining = billable.total_amount - billable.paid_amount
        if data.amount > remaining:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "OVERPAYMENT",
                    "message": "수납 금액이 미수금을 초과합니다",
                    "remaining_amount": remaining,
                    "attempted_amount": data.amount,
                    "excess_amount": data.amount - remaining
                }
            )

        # 수납 처리
        payment = await payment_repo.create(data.model_dump())
        billable.paid_amount += data.amount

        if billable.paid_amount >= billable.total_amount:
            billable.status = "paid"

        await uow.commit()
```

**처리 방안 B: 허용 (유연한 정책)**
```python
async def process_payment(data: PaymentCreate):
    async with uow:
        billable = await billable_repo.get(data.billable_id)

        # 과납부 허용하되 경고 로그
        remaining = billable.total_amount - billable.paid_amount
        if data.amount > remaining:
            logger.warning(
                f"과납부 발생: billable_id={data.billable_id}, "
                f"remaining={remaining}, payment={data.amount}"
            )

        payment = await payment_repo.create(data.model_dump())
        billable.paid_amount += data.amount
        billable.status = "paid"

        await uow.commit()
```

**권장**: 방안 A (에러) - 회계 정확성

---

### 케이스 11: 음수 수납 금액 방지

**상황**:
- Payment(amount=-50000) 입력 시도

**처리**:
```python
class PaymentCreate(BaseModel):
    amount: int

    @field_validator("amount")
    @classmethod
    def validate_amount_positive(cls, v):
        if v <= 0:
            raise ValueError("수납 금액은 0보다 커야 합니다")
        return v
```

**환불 처리**:
- Payment는 항상 양수
- 환불은 별도 Refund 엔티티 (Phase 2)
- 또는 음수 청구서로 처리

---

### 케이스 12: 발행 전 청구서 수납 시도

**상황**:
- Billable(status="draft")
- Payment 생성 시도

**처리 방안 A: 에러**
```python
if billable.status == "draft":
    raise HTTPException(
        status_code=400,
        detail={
            "code": "BILLABLE_NOT_ISSUED",
            "message": "발행되지 않은 청구서는 수납할 수 없습니다",
            "billable_id": billable.id,
            "current_status": "draft"
        }
    )
```

**처리 방안 B: 자동 발행**
```python
if billable.status == "draft":
    billable.status = "issued"
    billable.issued_at = datetime.now(timezone.utc)
    logger.info(f"청구서 자동 발행: billable_id={billable.id}")
```

**권장**: 방안 B (자동 발행) - 사용자 편의

---

## 동시성 문제

### 케이스 13: 중복 수납 방지

**상황**:
- 두 관리자가 동시에 같은 청구서 수납 처리
- Race condition 발생 가능

**처리**:
```python
async def process_payment(data: PaymentCreate):
    async with uow:
        # 비관적 잠금 (Pessimistic Lock)
        stmt = (
            select(Billable)
            .where(Billable.id == data.billable_id)
            .with_for_update()  # SELECT ... FOR UPDATE
        )
        result = await session.execute(stmt)
        billable = result.scalar_one_or_none()

        if not billable:
            raise HTTPException(404, "청구서를 찾을 수 없습니다")

        # 이미 완납된 경우
        if billable.status == "paid":
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "ALREADY_PAID",
                    "message": "이미 완납된 청구서입니다"
                }
            )

        # 수납 처리
        payment = await payment_repo.create(data.model_dump())
        billable.paid_amount += data.amount

        if billable.paid_amount >= billable.total_amount:
            billable.status = "paid"

        await uow.commit()
```

**특징**:
- `with_for_update()`: 트랜잭션 동안 행 잠금
- 다른 트랜잭션은 대기
- 동시성 문제 해결

---

### 케이스 14: 바우처 동시 사용

**상황**:
- ClientVoucher(remaining_sessions=1)
- 두 관리자가 동시에 바우처 청구 시도

**처리**:
```python
async def create_voucher_billable(data: BillableCreate):
    async with uow:
        # ClientVoucher 비관적 잠금
        stmt = (
            select(ClientVoucher)
            .where(ClientVoucher.id == voucher_id)
            .with_for_update()
        )
        result = await session.execute(stmt)
        client_voucher = result.scalar_one_or_none()

        if not client_voucher:
            raise HTTPException(404, "바우처를 찾을 수 없습니다")

        # 잔여 횟수 재확인 (잠금 후)
        if client_voucher.remaining_sessions < 1:
            raise HTTPException(400, "바우처 잔여 횟수 부족")

        # 청구서 생성
        billable = await billable_repo.create(...)
        item = await billable_item_repo.create(...)

        # 사용 횟수 차감
        client_voucher.used_sessions += 1

        await uow.commit()
```

---

## 데이터 무결성

### 케이스 15: Billable 삭제 시 Payment 존재

**상황**:
- Billable(id=1) 삭제 시도
- Payment(billable_id=1) 존재 (수납 내역)

**처리**:
```python
async def delete_billable(billable_id: int):
    async with uow:
        billable = await billable_repo.get(billable_id)

        # Payment 존재 여부 체크
        has_payments = await payment_repo.exists_by_billable(billable_id)

        if has_payments:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "CANNOT_DELETE_WITH_PAYMENTS",
                    "message": "수납 내역이 있는 청구서는 삭제할 수 없습니다",
                    "billable_id": billable_id,
                    "solution": "청구서를 취소(cancelled) 처리하세요"
                }
            )

        # draft만 삭제 허용
        if billable.status != "draft":
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "CANNOT_DELETE_ISSUED_BILLABLE",
                    "message": "발행된 청구서는 삭제할 수 없습니다"
                }
            )

        await billable_repo.delete(billable_id)
        await uow.commit()
```

**DB Constraint**:
```python
# models.py
class Payment(Base):
    billable_id = Column(
        Integer,
        ForeignKey("billables.id", ondelete="RESTRICT"),  # 삭제 방지
        nullable=False
    )
```

---

### 케이스 16: total_amount 계산 오류

**상황**:
- BillableItem 추가/삭제 후 total_amount 불일치

**처리**:
```python
async def recalculate_billable_total(billable_id: int):
    """청구서 총액 재계산"""
    async with uow:
        billable = await billable_repo.get(billable_id)

        # BillableItem 합계 재계산
        stmt = (
            select(func.sum(BillableItem.amount))
            .where(BillableItem.billable_id == billable_id)
        )
        result = await session.execute(stmt)
        calculated_total = result.scalar() or 0

        # 불일치 체크
        if billable.total_amount != calculated_total:
            logger.error(
                f"total_amount 불일치: billable_id={billable_id}, "
                f"stored={billable.total_amount}, calculated={calculated_total}"
            )

            # 자동 수정
            billable.total_amount = calculated_total
            billable.unpaid_amount = calculated_total - billable.paid_amount

        await uow.commit()
```

**자동 검증** (배치):
```python
async def validate_all_billable_totals():
    """전체 청구서 총액 검증 (야간 배치)"""
    stmt = select(Billable)
    result = await session.execute(stmt)
    billables = result.scalars().all()

    errors = []
    for billable in billables:
        items_total = sum(item.amount for item in billable.items)
        if billable.total_amount != items_total:
            errors.append({
                "billable_id": billable.id,
                "stored": billable.total_amount,
                "calculated": items_total
            })

    if errors:
        logger.error(f"total_amount 불일치 발견: {len(errors)}건")
        # 알림 또는 자동 수정

    return errors
```

---

## 비즈니스 규칙 위반

### 케이스 17: 다른 센터 데이터 접근

**상황**:
- Center A 관리자가 Center B의 청구서 조회 시도

**처리**:
```python
async def get_billable(billable_id: int, auth: AuthContext):
    billable = await billable_repo.get(billable_id)

    if not billable:
        raise HTTPException(404, "청구서를 찾을 수 없습니다")

    # 센터 소유권 체크
    if billable.center_id != auth.center_id:
        raise HTTPException(
            status_code=403,
            detail="접근 권한이 없습니다"
        )

    return billable

# Repository에서 자동 필터링
class BillableRepository:
    async def get_by_center(self, billable_id: int, center_id: int):
        stmt = (
            select(Billable)
            .where(Billable.id == billable_id)
            .where(Billable.center_id == center_id)  # 자동 필터
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
```

---

### 케이스 18: 타 센터 내담자 청구 방지

**상황**:
- Center A가 Center B의 Client로 청구서 생성 시도

**처리**:
```python
async def create_billable(data: BillableCreate, auth: AuthContext):
    async with uow:
        # Client 소유권 체크
        client = await client_repo.get(data.client_id)

        if not client:
            raise HTTPException(404, "내담자를 찾을 수 없습니다")

        if client.center_id != auth.center_id:
            raise HTTPException(
                status_code=403,
                detail="다른 센터의 내담자입니다"
            )

        # 청구서 생성
        billable = await billable_repo.create({
            "center_id": auth.center_id,  # JWT에서 자동
            **data.model_dump()
        })

        await uow.commit()
```

---

## 엣지 케이스 요약

| 케이스 | 문제 | 해결 방법 | 우선순위 |
|--------|------|----------|---------|
| 1. 바우처 부족 | 잔여 횟수 0 | 사전 검증 + 명확한 에러 | 높음 |
| 2. 월별 한도 초과 | 정부 정책 위반 | 월별 사용량 체크 | 높음 |
| 3. 바우처 만료 | 유효기간 초과 | 자동 비활성화 + 검증 | 높음 |
| 4. 중복 바우처 | 동일 정책 중복 | 유니크 제약 + 검증 | 중간 |
| 5. 정책 비활성화 | 사업 종료 | 활성화 정책만 허용 | 중간 |
| 6. 빈 청구서 | 항목 없음 | Pydantic 검증 | 중간 |
| 7. 음수 금액 | 환불/차액 | 허용 + notes 필수 | 낮음 |
| 8. 미래 청구 | 날짜 오류 | 미래 날짜 금지 | 중간 |
| 9. 과거 서비스 | 지연 청구 | 허용 + 경고 로그 | 낮음 |
| 10. 과납부 | 금액 초과 | 에러 (권장) | 높음 |
| 11. 음수 수납 | 입력 오류 | Pydantic 검증 | 높음 |
| 12. draft 수납 | 순서 오류 | 자동 발행 (권장) | 중간 |
| 13. 중복 수납 | 동시성 | 비관적 잠금 | 높음 |
| 14. 바우처 동시 사용 | 동시성 | 비관적 잠금 | 높음 |
| 15. Payment 있는 삭제 | 무결성 위반 | RESTRICT + 검증 | 높음 |
| 16. total 불일치 | 계산 오류 | 자동 재계산 + 검증 | 중간 |
| 17. 다른 센터 접근 | 보안 위반 | 센터 ID 필터링 | 높음 |
| 18. 타 센터 내담자 | 권한 위반 | 소유권 검증 | 높음 |

---

## 구현 우선순위

### P0 (필수)
- 바우처 잔여 횟수/월별 한도 검증
- 과납부 방지
- 동시성 제어 (비관적 잠금)
- 센터 데이터 격리 (보안)

### P1 (중요)
- 바우처 자동 만료
- 청구서 상태별 수정 제한
- total_amount 자동 재계산

### P2 (선택)
- 과거 서비스 청구 경고
- 음수 금액 notes 필수
- 전체 데이터 검증 배치

---

## 참고 문서

- **도메인 설계**: `/docs/payment/domain.md`
- **시나리오**: `/docs/payment/scenarios.md`
- **경쟁사 분석**: `/docs/payment/competitor-analysis.md`
