# Payment 도메인 주요 시나리오

> Payment 도메인의 실제 사용 시나리오 및 상세 플로우

---

## 목차

1. [시나리오 1: 검사 청구 생성 (단가표 기반)](#시나리오-1-검사-청구-생성-단가표-기반)
2. [시나리오 2: 검사 청구 생성 (수동 입력)](#시나리오-2-검사-청구-생성-수동-입력)
3. [시나리오 3: 바우처 서비스 청구](#시나리오-3-바우처-서비스-청구)
4. [시나리오 4: 부분 납부 처리](#시나리오-4-부분-납부-처리)
5. [시나리오 5: 월말 청구 (여러 서비스 묶음)](#시나리오-5-월말-청구-여러-서비스-묶음)
6. [시나리오 6: 미수금 조회 및 관리](#시나리오-6-미수금-조회-및-관리)
7. [시나리오 7: 청구서 수정 및 삭제](#시나리오-7-청구서-수정-및-삭제)
8. [시나리오 8: 내담자 바우처 등록](#시나리오-8-내담자-바우처-등록)
9. [시나리오 9: 바우처 잔여 횟수 확인](#시나리오-9-바우처-잔여-횟수-확인)
10. [시나리오 10: 청구서 발행 후 수정 시도](#시나리오-10-청구서-발행-후-수정-시도)

---

## 시나리오 1: 검사 청구 생성 (단가표 기반)

### 개요
센터 관리자가 이미 진행한 검사에 대해 청구서를 생성하며, 미리 설정된 단가표를 사용

### 액터
- 센터 관리자

### 전제 조건
- AssessmentCase(id=100) 존재 (2026-01-10 검사 완료)
- 검사 종류: ADHD 검사
- 센터 단가표: ADHD 검사 = 150,000원
- Client(id=50) 존재

---

### 플로우

#### [1단계] 관리자: 청구서 생성 요청

**요청**:
```http
POST /billables
Authorization: Bearer {center_token}
Content-Type: application/json

{
  "client_id": 50,
  "billable_date": "2026-01-15",
  "items": [
    {
      "item_type": "service",
      "item_id": 100,
      "description": "ADHD 검사",
      "quantity": 1,
      "unit_price": 150000,
      "provided_at": "2026-01-10T14:00:00Z"
    }
  ],
  "notes": "1월 검사 건"
}
```

---

#### [2단계] Handler: 청구서 + 항목 생성 (트랜잭션)

**동작**:
```python
async with uow:
    # 1. Billable 생성
    billable = await billable_repo.create({
        "center_id": auth.center_id,  # JWT에서
        "client_id": 50,
        "billable_date": date(2026, 1, 15),
        "total_amount": 0,  # 초기값
        "paid_amount": 0,
        "status": "draft",
        "notes": "1월 검사 건"
    })

    # 2. BillableItem 생성
    item = await billable_item_repo.create({
        "billable_id": billable.id,
        "item_type": "service",
        "item_id": 100,
        "description": "ADHD 검사",
        "quantity": 1,
        "unit_price": 150000,
        "amount": 150000,  # quantity × unit_price
        "voucher_amount": 0,
        "self_pay_amount": 150000,
        "provided_at": datetime(2026, 1, 10, 14, 0, 0, tzinfo=timezone.utc)
    })

    # 3. Billable total_amount 갱신
    billable.total_amount = 150000
    billable.unpaid_amount = 150000

    await uow.commit()
```

---

#### [3단계] 응답

**응답** (201 Created):
```json
{
  "id": 1,
  "center_id": 1,
  "client_id": 50,
  "billable_date": "2026-01-15",
  "total_amount": 150000,
  "paid_amount": 0,
  "unpaid_amount": 150000,
  "status": "draft",
  "issued_at": null,
  "due_date": null,
  "notes": "1월 검사 건",
  "items": [
    {
      "id": 1,
      "item_type": "service",
      "item_id": 100,
      "description": "ADHD 검사",
      "quantity": 1,
      "unit_price": 150000,
      "amount": 150000,
      "voucher_amount": 0,
      "self_pay_amount": 150000,
      "provided_at": "2026-01-10T14:00:00Z"
    }
  ],
  "created_at": "2026-01-15T10:00:00Z"
}
```

---

### 최종 상태

**DB 상태**:
```
Billable(id=1, client_id=50, total_amount=150000, status="draft")
  ↓
BillableItem(id=1, billable_id=1, amount=150000, item_id=100)
```

**특징**:
- `status="draft"`: 아직 발행 전 (수정 가능)
- `provided_at`: 서비스 제공 일시 (과거)
- `billable_date`: 청구 일자 (오늘)
- `item_id=100`: Assessment 참조 (추적 가능)

---

## 시나리오 2: 검사 청구 생성 (수동 입력)

### 개요
센터에서 단가표 없이 협의된 가격으로 청구서를 수동 생성

### 액터
- 센터 관리자

### 전제 조건
- 내담자와 특별 가격 협의 완료 (120,000원)
- 시스템에 검사 기록 없음 (수기 진행)
- Client(id=51) 존재

---

### 플로우

#### [1단계] 관리자: 청구서 생성 요청

**요청**:
```http
POST /billables
Authorization: Bearer {center_token}
Content-Type: application/json

{
  "client_id": 51,
  "billable_date": "2026-01-15",
  "items": [
    {
      "item_type": "service",
      "item_id": null,
      "description": "ADHD 검사 (협의 가격)",
      "quantity": 1,
      "unit_price": 120000,
      "provided_at": "2026-01-15T10:00:00Z"
    }
  ]
}
```

---

#### [2단계] Handler: 수동 청구서 생성

**동작**:
```python
async with uow:
    billable = await billable_repo.create({
        "center_id": auth.center_id,
        "client_id": 51,
        "billable_date": date(2026, 1, 15),
        "total_amount": 0,
        "paid_amount": 0,
        "status": "draft"
    })

    # item_id = null (시스템 기록 없음)
    item = await billable_item_repo.create({
        "billable_id": billable.id,
        "item_type": "service",
        "item_id": None,  # null
        "description": "ADHD 검사 (협의 가격)",
        "quantity": 1,
        "unit_price": 120000,
        "amount": 120000,
        "provided_at": datetime(2026, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
    })

    billable.total_amount = 120000
    billable.unpaid_amount = 120000

    await uow.commit()
```

---

#### [3단계] 응답

**응답** (201 Created):
```json
{
  "id": 2,
  "center_id": 1,
  "client_id": 51,
  "total_amount": 120000,
  "items": [
    {
      "id": 2,
      "item_id": null,
      "description": "ADHD 검사 (협의 가격)",
      "amount": 120000
    }
  ]
}
```

---

### 최종 상태

**DB 상태**:
```
BillableItem(id=2, item_id=null, description="ADHD 검사 (협의 가격)")
```

**특징**:
- `item_id=null`: 시스템 기록 참조 없음 (수동 입력)
- `description`: 자유 텍스트로 설명
- 가격 협의 가능 (유연성)

**장점**:
- 시스템에 기록 없어도 청구 가능
- 특별 가격 협의 지원
- 외부 서비스도 청구 가능 (예: 외부 검사 대행)

---

## 시나리오 3: 바우처 서비스 청구

### 개요
정부 바우처를 사용하는 내담자의 상담 회기 청구 (80% 지원)

### 액터
- 센터 관리자

### 전제 조건
- Client(id=52) 존재
- ClientVoucher(id=1) 존재:
  - voucher_policy_id=1 (아동청소년심리지원, 80% 지원)
  - total_sessions=10
  - used_sessions=2
  - remaining_sessions=8
- VoucherPolicy(id=1):
  - support_ratio=0.8
  - max_sessions_per_month=4

---

### 플로우

#### [1단계] 관리자: 바우처 청구 생성 요청

**요청**:
```http
POST /billables
Authorization: Bearer {center_token}
Content-Type: application/json

{
  "client_id": 52,
  "billable_date": "2026-01-15",
  "items": [
    {
      "item_type": "voucher",
      "description": "아동청소년심리지원 상담 (1회기)",
      "quantity": 1,
      "unit_price": 100000,
      "voucher_policy_id": 1
    }
  ]
}
```

---

#### [2단계] Handler: 바우처 자동 계산 + 차감

**동작**:
```python
async with uow:
    # 1. ClientVoucher 조회 및 검증
    client_voucher = await client_voucher_repo.get_by_client_and_policy(
        client_id=52,
        voucher_policy_id=1
    )

    if client_voucher.remaining_sessions < 1:
        raise HTTPException(400, "바우처 잔여 횟수 부족")

    # 2. 월별 사용 한도 체크
    voucher_policy = await voucher_policy_repo.get(1)
    this_month_usage = await billable_item_repo.count_voucher_usage_this_month(
        client_id=52,
        voucher_policy_id=1,
        year_month="2026-01"
    )

    if this_month_usage >= voucher_policy.max_sessions_per_month:
        raise HTTPException(400, f"월 사용 한도 초과 ({voucher_policy.max_sessions_per_month}회)")

    # 3. Billable 생성
    billable = await billable_repo.create({
        "center_id": auth.center_id,
        "client_id": 52,
        "billable_date": date(2026, 1, 15),
        "status": "draft"
    })

    # 4. 바우처 금액 자동 계산
    total_amount = 100000
    voucher_amount = int(total_amount * voucher_policy.support_ratio)  # 80,000원
    self_pay_amount = total_amount - voucher_amount  # 20,000원

    # 5. BillableItem 생성
    item = await billable_item_repo.create({
        "billable_id": billable.id,
        "item_type": "voucher",
        "description": "아동청소년심리지원 상담 (1회기)",
        "quantity": 1,
        "unit_price": 100000,
        "amount": 100000,
        "voucher_policy_id": 1,
        "voucher_amount": 80000,  # 자동 계산
        "self_pay_amount": 20000,  # 자동 계산
        "provided_at": datetime.now(timezone.utc)
    })

    # 6. ClientVoucher 사용 횟수 차감
    client_voucher.used_sessions += 1
    # remaining_sessions는 계산 필드 (total_sessions - used_sessions)

    # 7. Billable total_amount 갱신
    billable.total_amount = 100000
    billable.unpaid_amount = 100000  # 아직 수납 전

    await uow.commit()
```

---

#### [3단계] 응답

**응답** (201 Created):
```json
{
  "id": 3,
  "center_id": 1,
  "client_id": 52,
  "total_amount": 100000,
  "paid_amount": 0,
  "unpaid_amount": 100000,
  "status": "draft",
  "items": [
    {
      "id": 3,
      "item_type": "voucher",
      "description": "아동청소년심리지원 상담 (1회기)",
      "unit_price": 100000,
      "amount": 100000,
      "voucher_policy_id": 1,
      "voucher_amount": 80000,
      "self_pay_amount": 20000
    }
  ]
}
```

---

### 최종 상태

**DB 상태**:
```
ClientVoucher(id=1, used_sessions=3, remaining_sessions=7)
  ↓
BillableItem(id=3, voucher_policy_id=1, voucher_amount=80000, self_pay_amount=20000)
```

**특징**:
- 바우처 금액 자동 계산 (80%)
- 사용 횟수 자동 차감
- 월별 한도 체크
- 잔여 횟수 실시간 반영

**청구 후 처리**:
- 정부 지원금 (80,000원): 월말 일괄 정산
- 자기부담금 (20,000원): 즉시 수납 OR 월말 청구

---

## 시나리오 4: 부분 납부 처리

### 개요
청구 금액 150,000원 중 일부만 납부하고, 나머지는 미수금으로 관리

### 액터
- 센터 관리자

### 전제 조건
- Billable(id=1) 존재:
  - total_amount=150,000원
  - paid_amount=0원
  - status="issued" (발행 완료)

---

### 플로우

#### [1단계] 관리자: 부분 납부 (50,000원)

**요청**:
```http
POST /payments
Authorization: Bearer {center_token}
Content-Type: application/json

{
  "billable_id": 1,
  "amount": 50000,
  "payment_method": "cash",
  "paid_at": "2026-01-15T14:00:00Z",
  "notes": "일부 납부"
}
```

---

#### [2단계] Handler: 수납 처리 + Billable 업데이트

**동작**:
```python
async with uow:
    # 1. Payment 생성
    payment = await payment_repo.create({
        "billable_id": 1,
        "amount": 50000,
        "payment_method": "cash",
        "paid_at": datetime(2026, 1, 15, 14, 0, 0, tzinfo=timezone.utc),
        "notes": "일부 납부"
    })

    # 2. Billable.paid_amount 갱신
    billable = await billable_repo.get(1)
    billable.paid_amount += 50000  # 0 → 50,000

    # 3. unpaid_amount 재계산
    billable.unpaid_amount = billable.total_amount - billable.paid_amount  # 100,000

    # 4. 상태 판단
    if billable.paid_amount >= billable.total_amount:
        billable.status = "paid"
    elif billable.due_date and date.today() > billable.due_date:
        billable.status = "overdue"
    else:
        billable.status = "issued"  # 유지

    await uow.commit()
```

---

#### [3단계] 응답

**응답** (201 Created):
```json
{
  "id": 1,
  "billable_id": 1,
  "amount": 50000,
  "payment_method": "cash",
  "paid_at": "2026-01-15T14:00:00Z",
  "notes": "일부 납부"
}
```

**Billable 상태 조회**:
```http
GET /billables/1
```

```json
{
  "id": 1,
  "total_amount": 150000,
  "paid_amount": 50000,
  "unpaid_amount": 100000,
  "status": "issued"
}
```

---

#### [4단계] 관리자: 추가 납부 (100,000원)

**요청**:
```http
POST /payments
Authorization: Bearer {center_token}
Content-Type: application/json

{
  "billable_id": 1,
  "amount": 100000,
  "payment_method": "transfer",
  "paid_at": "2026-01-20T10:00:00Z",
  "notes": "잔액 완납"
}
```

---

#### [5단계] Handler: 완납 처리

**동작**:
```python
async with uow:
    payment = await payment_repo.create({
        "billable_id": 1,
        "amount": 100000,
        "payment_method": "transfer",
        "paid_at": datetime(2026, 1, 20, 10, 0, 0, tzinfo=timezone.utc),
        "notes": "잔액 완납"
    })

    billable = await billable_repo.get(1)
    billable.paid_amount += 100000  # 50,000 → 150,000
    billable.unpaid_amount = 0
    billable.status = "paid"  # 완납

    await uow.commit()
```

---

#### [6단계] 응답

**Billable 상태**:
```json
{
  "id": 1,
  "total_amount": 150000,
  "paid_amount": 150000,
  "unpaid_amount": 0,
  "status": "paid",
  "payments": [
    {
      "id": 1,
      "amount": 50000,
      "payment_method": "cash",
      "paid_at": "2026-01-15T14:00:00Z"
    },
    {
      "id": 2,
      "amount": 100000,
      "payment_method": "transfer",
      "paid_at": "2026-01-20T10:00:00Z"
    }
  ]
}
```

---

### 최종 상태

**DB 상태**:
```
Billable(id=1, paid_amount=150000, unpaid_amount=0, status="paid")
  ↓
Payment(id=1, amount=50000, payment_method="cash")
Payment(id=2, amount=100000, payment_method="transfer")
```

**특징**:
- 여러 Payment → 1 Billable (부분 납부)
- 다양한 결제 수단 혼용 가능
- paid_amount 자동 갱신
- 완납 시 자동 상태 전환

---

## 시나리오 5: 월말 청구 (여러 서비스 묶음)

### 개요
한 달간 제공한 여러 서비스를 월말에 한번에 청구

### 액터
- 센터 관리자

### 전제 조건
- Client(id=50) 존재
- 1월에 제공한 서비스:
  - 1월 5일: 상담 1회기 (100,000원)
  - 1월 12일: 상담 2회기 (100,000원)
  - 1월 20일: ADHD 검사 (150,000원)

---

### 플로우

#### [1단계] 관리자: 월말 청구서 생성

**요청**:
```http
POST /billables
Authorization: Bearer {center_token}
Content-Type: application/json

{
  "client_id": 50,
  "billable_date": "2026-01-31",
  "due_date": "2026-02-10",
  "items": [
    {
      "item_type": "service",
      "description": "1회기 상담",
      "unit_price": 100000,
      "provided_at": "2026-01-05T14:00:00Z"
    },
    {
      "item_type": "service",
      "description": "2회기 상담",
      "unit_price": 100000,
      "provided_at": "2026-01-12T14:00:00Z"
    },
    {
      "item_type": "service",
      "item_id": 100,
      "description": "ADHD 검사",
      "unit_price": 150000,
      "provided_at": "2026-01-20T10:00:00Z"
    }
  ],
  "notes": "1월 서비스 월말 청구"
}
```

---

#### [2단계] Handler: 청구서 + 여러 항목 생성

**동작**:
```python
async with uow:
    # 1. Billable 생성
    billable = await billable_repo.create({
        "center_id": auth.center_id,
        "client_id": 50,
        "billable_date": date(2026, 1, 31),
        "due_date": date(2026, 2, 10),  # 납부 기한
        "status": "draft",
        "notes": "1월 서비스 월말 청구"
    })

    # 2. 여러 BillableItem 생성
    items_data = [
        {
            "description": "1회기 상담",
            "unit_price": 100000,
            "provided_at": datetime(2026, 1, 5, 14, 0, 0, tzinfo=timezone.utc)
        },
        {
            "description": "2회기 상담",
            "unit_price": 100000,
            "provided_at": datetime(2026, 1, 12, 14, 0, 0, tzinfo=timezone.utc)
        },
        {
            "item_id": 100,
            "description": "ADHD 검사",
            "unit_price": 150000,
            "provided_at": datetime(2026, 1, 20, 10, 0, 0, tzinfo=timezone.utc)
        }
    ]

    total = 0
    for item_data in items_data:
        item = await billable_item_repo.create({
            "billable_id": billable.id,
            "item_type": "service",
            "quantity": 1,
            "amount": item_data["unit_price"],
            **item_data
        })
        total += item.amount

    # 3. Billable total_amount 갱신
    billable.total_amount = total  # 350,000
    billable.unpaid_amount = total

    await uow.commit()
```

---

#### [3단계] 응답

**응답** (201 Created):
```json
{
  "id": 4,
  "center_id": 1,
  "client_id": 50,
  "billable_date": "2026-01-31",
  "due_date": "2026-02-10",
  "total_amount": 350000,
  "paid_amount": 0,
  "unpaid_amount": 350000,
  "status": "draft",
  "notes": "1월 서비스 월말 청구",
  "items": [
    {
      "id": 10,
      "description": "1회기 상담",
      "amount": 100000,
      "provided_at": "2026-01-05T14:00:00Z"
    },
    {
      "id": 11,
      "description": "2회기 상담",
      "amount": 100000,
      "provided_at": "2026-01-12T14:00:00Z"
    },
    {
      "id": 12,
      "description": "ADHD 검사",
      "amount": 150000,
      "provided_at": "2026-01-20T10:00:00Z"
    }
  ]
}
```

---

### 최종 상태

**DB 상태**:
```
Billable(id=4, total_amount=350000, due_date="2026-02-10")
  ↓
BillableItem(id=10, amount=100000, provided_at="2026-01-05")
BillableItem(id=11, amount=100000, provided_at="2026-01-12")
BillableItem(id=12, amount=150000, provided_at="2026-01-20")
```

**특징**:
- 여러 서비스를 하나의 청구서로 묶음
- `provided_at`: 각 서비스의 실제 제공 일시 (과거)
- `billable_date`: 청구 일자 (월말)
- `due_date`: 납부 기한 설정 (선택)

**장점**:
- 월말 일괄 청구 가능
- 서비스별 제공 일시 추적
- 내담자별 청구서 관리 용이

---

## 시나리오 6: 미수금 조회 및 관리

### 개요
센터 관리자가 미수금 목록을 조회하고 관리

### 액터
- 센터 관리자

### 전제 조건
- 여러 청구서 존재:
  - Billable(id=1): unpaid_amount=100,000원
  - Billable(id=4): unpaid_amount=350,000원
  - Billable(id=5): unpaid_amount=0원 (완납)

---

### 플로우

#### [1단계] 관리자: 미수금 목록 조회

**요청**:
```http
GET /billables/unpaid?page=1&size=20
Authorization: Bearer {center_token}
```

---

#### [2단계] Handler: 미수금 필터링 조회

**동작**:
```python
async def get_unpaid_billables(page: int, size: int, session: AsyncSession):
    # unpaid_amount > 0인 청구서만 조회
    stmt = (
        select(Billable)
        .where(Billable.center_id == auth.center_id)
        .where(Billable.unpaid_amount > 0)
        .order_by(Billable.billable_date.desc())
        .offset((page - 1) * size)
        .limit(size)
    )

    result = await session.execute(stmt)
    billables = result.scalars().all()

    # 총 미수금 계산
    total_unpaid_stmt = (
        select(func.sum(Billable.unpaid_amount))
        .where(Billable.center_id == auth.center_id)
        .where(Billable.unpaid_amount > 0)
    )
    total_unpaid_result = await session.execute(total_unpaid_stmt)
    total_unpaid = total_unpaid_result.scalar() or 0

    return {
        "items": billables,
        "total_unpaid": total_unpaid,
        "page": page,
        "size": size
    }
```

---

#### [3단계] 응답

**응답** (200 OK):
```json
{
  "items": [
    {
      "id": 4,
      "client_id": 50,
      "client_name": "김철수",
      "billable_date": "2026-01-31",
      "due_date": "2026-02-10",
      "total_amount": 350000,
      "paid_amount": 0,
      "unpaid_amount": 350000,
      "status": "issued",
      "overdue_days": 0
    },
    {
      "id": 1,
      "client_id": 50,
      "client_name": "김철수",
      "billable_date": "2026-01-15",
      "due_date": null,
      "total_amount": 150000,
      "paid_amount": 50000,
      "unpaid_amount": 100000,
      "status": "issued",
      "overdue_days": null
    }
  ],
  "total_unpaid": 450000,
  "total": 2,
  "page": 1,
  "size": 20
}
```

---

### 추가: 연체 자동 표시

**배치 작업** (매일 자동 실행):
```python
async def mark_overdue_billables():
    """납부 기한 초과 청구서 자동 연체 처리"""
    today = date.today()

    stmt = (
        select(Billable)
        .where(Billable.status == "issued")
        .where(Billable.unpaid_amount > 0)
        .where(Billable.due_date < today)
    )

    result = await session.execute(stmt)
    overdue_billables = result.scalars().all()

    for billable in overdue_billables:
        billable.status = "overdue"

    await session.commit()

    return len(overdue_billables)
```

---

### 최종 상태

**특징**:
- 미수금 실시간 조회
- 총 미수금 자동 집계
- 연체 자동 표시
- 내담자별 미수금 추적

**활용**:
- 월말 미수금 리포트
- 내담자별 미수금 독촉
- 연체 관리

---

## 시나리오 7: 청구서 수정 및 삭제

### 개요
draft 상태 청구서는 수정/삭제 가능, issued 이후는 불가

### 액터
- 센터 관리자

### 전제 조건
- Billable(id=10, status="draft") 존재
- Billable(id=11, status="issued") 존재

---

### 플로우 A: draft 청구서 항목 추가

#### [1단계] 관리자: 항목 추가 요청

**요청**:
```http
POST /billables/10/items
Authorization: Bearer {center_token}
Content-Type: application/json

{
  "item_type": "service",
  "description": "추가 검사",
  "unit_price": 80000
}
```

---

#### [2단계] Handler: 항목 추가 + total 갱신

**동작**:
```python
async with uow:
    # 1. Billable 조회 및 검증
    billable = await billable_repo.get(10)

    if billable.status != "draft":
        raise HTTPException(400, "발행된 청구서는 수정 불가")

    # 2. BillableItem 추가
    item = await billable_item_repo.create({
        "billable_id": 10,
        "item_type": "service",
        "description": "추가 검사",
        "unit_price": 80000,
        "amount": 80000
    })

    # 3. Billable.total_amount 재계산
    total = await billable_item_repo.sum_amount(billable_id=10)
    billable.total_amount = total
    billable.unpaid_amount = total - billable.paid_amount

    await uow.commit()
```

---

#### [3단계] 응답

**응답** (201 Created):
```json
{
  "id": 20,
  "billable_id": 10,
  "description": "추가 검사",
  "amount": 80000
}
```

---

### 플로우 B: draft 청구서 항목 삭제

#### [1단계] 관리자: 항목 삭제 요청

**요청**:
```http
DELETE /billables/10/items/20
Authorization: Bearer {center_token}
```

---

#### [2단계] Handler: 항목 삭제 + total 갱신

**동작**:
```python
async with uow:
    billable = await billable_repo.get(10)

    if billable.status != "draft":
        raise HTTPException(400, "발행된 청구서 항목 삭제 불가")

    # 항목 삭제
    await billable_item_repo.delete(20)

    # total_amount 재계산
    total = await billable_item_repo.sum_amount(billable_id=10)
    billable.total_amount = total
    billable.unpaid_amount = total

    await uow.commit()
```

---

#### [3단계] 응답

**응답** (204 No Content)

---

### 플로우 C: issued 청구서 수정 시도 (실패)

#### [1단계] 관리자: 발행된 청구서 항목 추가 시도

**요청**:
```http
POST /billables/11/items
Authorization: Bearer {center_token}
Content-Type: application/json

{
  "description": "추가 항목",
  "unit_price": 50000
}
```

---

#### [2단계] Handler: 상태 검증 실패

**동작**:
```python
billable = await billable_repo.get(11)

if billable.status != "draft":
    raise HTTPException(
        status_code=400,
        detail="발행된 청구서는 수정할 수 없습니다. 새 청구서를 생성해주세요."
    )
```

---

#### [3단계] 응답

**응답** (400 Bad Request):
```json
{
  "detail": "발행된 청구서는 수정할 수 없습니다. 새 청구서를 생성해주세요."
}
```

---

### 최종 상태

**수정 가능 여부**:

| 상태 | 항목 추가 | 항목 삭제 | 청구서 삭제 |
|------|----------|----------|------------|
| draft | ✅ | ✅ | ✅ |
| issued | ❌ | ❌ | ❌ |
| paid | ❌ | ❌ | ❌ |
| overdue | ❌ | ❌ | ❌ |

**이유**:
- 발행 후 수정 불가: 감사 추적 (audit trail)
- 수정 필요 시: 새 청구서 생성 권장

---

## 시나리오 8: 내담자 바우처 등록

### 개요
센터 관리자가 정부 바우처 대상 내담자를 등록

### 액터
- 센터 관리자

### 전제 조건
- Client(id=60) 존재
- VoucherPolicy(id=1, name="아동청소년심리지원") 활성화됨

---

### 플로우

#### [1단계] 관리자: 바우처 정책 조회

**요청**:
```http
GET /vouchers/policies?is_active=true
Authorization: Bearer {center_token}
```

**응답**:
```json
{
  "items": [
    {
      "id": 1,
      "name": "아동청소년심리지원 서비스",
      "code": "CHILD_PSYCH_2024",
      "support_ratio": 0.8,
      "max_sessions_per_month": 4,
      "valid_from": "2024-01-01",
      "valid_until": null
    },
    {
      "id": 2,
      "name": "발달재활서비스",
      "code": "DEV_REHAB_2024",
      "support_ratio": 0.8,
      "max_sessions_per_month": 4,
      "valid_from": "2024-01-01"
    }
  ]
}
```

---

#### [2단계] 관리자: 내담자 바우처 등록

**요청**:
```http
POST /vouchers/clients
Authorization: Bearer {center_token}
Content-Type: application/json

{
  "client_id": 60,
  "voucher_policy_id": 1,
  "total_sessions": 10,
  "started_at": "2026-01-01",
  "expires_at": "2026-06-30",
  "notes": "2026년 상반기 지원"
}
```

---

#### [3단계] Handler: ClientVoucher 생성

**동작**:
```python
async with uow:
    # 1. 중복 체크
    existing = await client_voucher_repo.get_active_by_client_and_policy(
        client_id=60,
        voucher_policy_id=1
    )

    if existing:
        raise HTTPException(400, "이미 활성화된 바우처가 있습니다")

    # 2. ClientVoucher 생성
    client_voucher = await client_voucher_repo.create({
        "center_id": auth.center_id,
        "client_id": 60,
        "voucher_policy_id": 1,
        "total_sessions": 10,
        "used_sessions": 0,  # 초기값
        "started_at": date(2026, 1, 1),
        "expires_at": date(2026, 6, 30),
        "is_active": True,
        "notes": "2026년 상반기 지원"
    })

    await uow.commit()
```

---

#### [4단계] 응답

**응답** (201 Created):
```json
{
  "id": 10,
  "center_id": 1,
  "client_id": 60,
  "voucher_policy_id": 1,
  "voucher_policy_name": "아동청소년심리지원 서비스",
  "total_sessions": 10,
  "used_sessions": 0,
  "remaining_sessions": 10,
  "started_at": "2026-01-01",
  "expires_at": "2026-06-30",
  "is_active": true,
  "notes": "2026년 상반기 지원"
}
```

---

### 최종 상태

**DB 상태**:
```
ClientVoucher(id=10, client_id=60, voucher_policy_id=1, total_sessions=10, used_sessions=0)
```

**특징**:
- 내담자별 바우처 관리
- 유효기간 설정
- 잔여 횟수 자동 계산
- 한 내담자가 여러 바우처 보유 가능

---

## 시나리오 9: 바우처 잔여 횟수 확인

### 개요
청구서 생성 전 내담자의 바우처 잔여 횟수 확인

### 액터
- 센터 관리자

### 전제 조건
- ClientVoucher(id=10, client_id=60) 존재

---

### 플로우

#### [1단계] 관리자: 내담자 바우처 조회

**요청**:
```http
GET /vouchers/clients/60
Authorization: Bearer {center_token}
```

---

#### [2단계] Handler: 바우처 목록 + 사용 내역 조회

**동작**:
```python
async def get_client_vouchers(client_id: int, session: AsyncSession):
    # 1. ClientVoucher 조회
    stmt = (
        select(ClientVoucher)
        .where(ClientVoucher.client_id == client_id)
        .where(ClientVoucher.center_id == auth.center_id)
        .where(ClientVoucher.is_active == True)
    )
    result = await session.execute(stmt)
    vouchers = result.scalars().all()

    # 2. 각 바우처별 이번 달 사용 횟수 조회
    for voucher in vouchers:
        # 이번 달 사용 횟수
        this_month_usage = await billable_item_repo.count_voucher_usage_this_month(
            client_id=client_id,
            voucher_policy_id=voucher.voucher_policy_id,
            year_month=date.today().strftime("%Y-%m")
        )
        voucher.this_month_usage = this_month_usage

        # VoucherPolicy 정보 join
        voucher.policy = await voucher_policy_repo.get(voucher.voucher_policy_id)

    return vouchers
```

---

#### [3단계] 응답

**응답** (200 OK):
```json
{
  "items": [
    {
      "id": 10,
      "voucher_policy_id": 1,
      "voucher_policy_name": "아동청소년심리지원 서비스",
      "support_ratio": 0.8,
      "total_sessions": 10,
      "used_sessions": 3,
      "remaining_sessions": 7,
      "this_month_usage": 2,
      "max_sessions_per_month": 4,
      "monthly_remaining": 2,
      "started_at": "2026-01-01",
      "expires_at": "2026-06-30",
      "is_active": true
    }
  ]
}
```

---

### 최종 상태

**표시 정보**:
- `remaining_sessions`: 전체 잔여 횟수 (7회)
- `this_month_usage`: 이번 달 사용 (2회)
- `monthly_remaining`: 이번 달 잔여 (2회)

**UI 활용**:
- 청구서 생성 전 확인
- 월별 한도 초과 방지
- 잔여 횟수 실시간 표시

---

## 시나리오 10: 청구서 발행 후 수정 시도

### 개요
발행된 청구서를 수정하려고 하면 에러 발생, 해결 방법 안내

### 액터
- 센터 관리자

### 전제 조건
- Billable(id=20, status="issued") 존재
- 항목에 오류 발견 (금액 잘못 입력)

---

### 플로우

#### [1단계] 관리자: 발행된 청구서 수정 시도

**요청**:
```http
PUT /billables/20/items/50
Authorization: Bearer {center_token}
Content-Type: application/json

{
  "unit_price": 120000
}
```

---

#### [2단계] Handler: 상태 검증 실패

**동작**:
```python
billable = await billable_repo.get(20)

if billable.status != "draft":
    raise HTTPException(
        status_code=400,
        detail={
            "message": "발행된 청구서는 수정할 수 없습니다",
            "reason": "감사 추적을 위해 발행 후 수정 불가",
            "solutions": [
                "1. 새 청구서를 생성하세요 (올바른 금액으로)",
                "2. 기존 청구서는 취소 처리하세요",
                "3. 또는 차액만큼 추가 청구서를 생성하세요"
            ],
            "billable_id": 20,
            "current_status": "issued"
        }
    )
```

---

#### [3단계] 응답

**응답** (400 Bad Request):
```json
{
  "detail": {
    "message": "발행된 청구서는 수정할 수 없습니다",
    "reason": "감사 추적을 위해 발행 후 수정 불가",
    "solutions": [
      "1. 새 청구서를 생성하세요 (올바른 금액으로)",
      "2. 기존 청구서는 취소 처리하세요",
      "3. 또는 차액만큼 추가 청구서를 생성하세요"
    ],
    "billable_id": 20,
    "current_status": "issued"
  }
}
```

---

### 해결 방법 A: 청구서 취소 후 재발행

#### [1단계] 기존 청구서 취소

**요청**:
```http
PUT /billables/20/status
Authorization: Bearer {center_token}
Content-Type: application/json

{
  "status": "cancelled",
  "reason": "금액 오류로 취소"
}
```

**응답**:
```json
{
  "id": 20,
  "status": "cancelled",
  "cancelled_at": "2026-01-16T10:00:00Z",
  "cancel_reason": "금액 오류로 취소"
}
```

---

#### [2단계] 새 청구서 생성

**요청**:
```http
POST /billables
Authorization: Bearer {center_token}
Content-Type: application/json

{
  "client_id": 50,
  "billable_date": "2026-01-16",
  "items": [
    {
      "description": "ADHD 검사 (수정)",
      "unit_price": 120000
    }
  ],
  "notes": "청구서 #20 수정본"
}
```

---

### 해결 방법 B: 차액 청구서 생성

차액 -30,000원 (기존 150,000 → 수정 120,000)

**요청**:
```http
POST /billables
Authorization: Bearer {center_token}
Content-Type: application/json

{
  "client_id": 50,
  "billable_date": "2026-01-16",
  "items": [
    {
      "description": "청구서 #20 차액 조정",
      "unit_price": -30000
    }
  ],
  "notes": "과청구 차액 환불"
}
```

---

### 최종 상태

**특징**:
- 발행 후 수정 불가 (엄격한 정책)
- 명확한 에러 메시지 + 해결 방법 안내
- 취소 OR 차액 청구서로 해결

**이유**:
- 감사 추적 (audit trail)
- 수납 내역과 불일치 방지
- 회계 투명성

---

## 시나리오 요약

| 시나리오 | 핵심 기능 | 복잡도 |
|---------|----------|-------|
| 1. 검사 청구 (단가표) | 기본 청구 생성, item_id 참조 | 낮음 |
| 2. 검사 청구 (수동) | item_id=null, 유연한 입력 | 낮음 |
| 3. 바우처 청구 | 자동 계산, 횟수 차감, 한도 체크 | 높음 |
| 4. 부분 납부 | 여러 Payment, 자동 상태 전환 | 중간 |
| 5. 월말 청구 | 여러 항목 묶음, provided_at 추적 | 중간 |
| 6. 미수금 관리 | 필터링, 집계, 연체 자동 표시 | 중간 |
| 7. 청구서 수정 | 상태별 수정 가능 여부 | 중간 |
| 8. 바우처 등록 | ClientVoucher 생성, 중복 체크 | 낮음 |
| 9. 바우처 확인 | 잔여 횟수, 월별 한도 조회 | 중간 |
| 10. 발행 후 수정 | 에러 처리, 해결 방법 안내 | 낮음 |

---

## 참고 문서

- **도메인 설계**: `/docs/payment/domain.md`
- **엣지 케이스**: `/docs/payment/edge-cases.md`
- **경쟁사 분석**: `/docs/payment/competitor-analysis.md`
