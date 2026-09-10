# Payment 도메인 설계 의사결정 기록

> 설계 과정에서의 주요 의사결정 및 근거

---

## 목차

1. [과납부 처리 정책](#1-과납부-처리-정책)
2. [draft 상태 청구서 수납 처리](#2-draft-상태-청구서-수납-처리)
3. [청구서 cancelled 상태 제외](#3-청구서-cancelled-상태-제외)
4. [영수증 번호 자동 생성](#4-영수증-번호-자동-생성)
5. [음수 금액으로 환불 표현](#5-음수-금액으로-환불-표현)
6. [BillableItem 수정 불가 정책](#6-billableitem-수정-불가-정책)

---

## 1. 과납부 처리 정책

### 결정
**허용 + 경고 로그** (유연한 정책)

### 배경
청구 금액보다 많은 금액을 수납하는 경우 처리 방법

**예시**:
- Billable(total_amount=100,000, paid_amount=50,000)
- Payment(amount=80,000) 추가 시도
- 결과: paid_amount=130,000 (과납부 30,000원)

### 고려한 방안

**방안 A (엄격)**: 에러 발생
```python
if data.amount > remaining:
    raise HTTPException(400, "수납 금액이 미수금을 초과합니다")
```
- 장점: 회계 정확성 보장
- 단점: 현장 상황 대응 어려움

**방안 B (유연)**: 허용 + 경고 로그
```python
if data.amount > remaining:
    logger.warning(f"과납부 발생: billable_id={billable_id}, excess={excess}")
```
- 장점: 현장 대응 유연
- 단점: 회계 데이터 복잡도 증가

### 최종 결정: 방안 B

**근거**:
1. **현장 상황 고려**:
   - 거스름돈 처리 (예: 100,050원 → 101,000원 수납)
   - 입력 실수 (수정 가능해야 함)
   - 차액 상계 (다음 청구에서 차감)

2. **데이터 추적 가능**:
   - `unpaid_amount`가 음수로 표시
   - Payment 기록으로 전체 히스토리 추적
   - 리포트에서 과납부 항목 필터링 가능

3. **경쟁사 검증**:
   - 에피: 과납부 허용 (차기 상계)
   - 케어플센터: 유연한 수납 처리

**구현**:
```python
async def process_payment(data: PaymentCreate):
    async with uow:
        billable = await billable_repo.get(data.billable_id)
        remaining = billable.total_amount - billable.paid_amount

        # 과납부 경고 로그
        if data.amount > remaining:
            logger.warning(
                f"과납부 발생 - billable_id={data.billable_id}, "
                f"remaining={remaining}, payment={data.amount}, "
                f"excess={data.amount - remaining}"
            )

        # 수납 처리
        payment = await payment_repo.create(data.model_dump())
        billable.paid_amount += data.amount
        billable.unpaid_amount = billable.total_amount - billable.paid_amount
        billable.status = "paid"

        await uow.commit()
```

**영향**:
- 프론트엔드: 과납부 시 경고 메시지 표시 권장
- 리포트: `unpaid_amount < 0` 항목 필터링
- 차기 청구: 과납부 금액 자동 상계 (Phase 2)

---

## 2. draft 상태 청구서 수납 처리

### 결정
**자동 발행 후 수납** (워크플로 간소화)

### 배경
draft 상태 청구서에 대한 수납 처리 시도

**예시**:
- Billable(id=1, status="draft")
- Payment 생성 시도

### 고려한 방안

**방안 A (엄격)**: 에러 발생
```python
if billable.status == "draft":
    raise HTTPException(400, "발행되지 않은 청구서는 수납할 수 없습니다")
```
- 장점: 명확한 상태 전이
- 단점: 사용자 불편 (2단계 작업)

**방안 B (유연)**: 자동 발행 후 수납
```python
if billable.status == "draft":
    billable.status = "issued"
    billable.issued_at = datetime.now(timezone.utc)
    logger.info(f"청구서 자동 발행: billable_id={billable.id}")
```
- 장점: 워크플로 간소화
- 단점: 암묵적 상태 전환

### 최종 결정: 방안 B

**근거**:
1. **사용자 편의성**:
   - 즉시 수납 가능 (2단계 → 1단계)
   - 현장 업무 효율 향상

2. **비즈니스 로직 단순화**:
   - 수납 = 발행 의미 (청구 확정)
   - draft는 "임시 저장" 개념

3. **경쟁사 패턴**:
   - 대부분 즉시 수납 가능
   - 발행/미발행 구분 없음

**구현**:
```python
async def process_payment(data: PaymentCreate):
    async with uow:
        billable = await billable_repo.get(data.billable_id)

        # draft → issued 자동 전환
        if billable.status == "draft":
            billable.status = "issued"
            billable.issued_at = datetime.now(timezone.utc)
            logger.info(
                f"청구서 자동 발행 (수납 시) - "
                f"billable_id={billable.id}, center_id={billable.center_id}"
            )

        # 수납 처리
        payment = await payment_repo.create(data.model_dump())
        billable.paid_amount += data.amount

        if billable.paid_amount >= billable.total_amount:
            billable.status = "paid"

        await uow.commit()
```

**영향**:
- API 문서: draft 상태 수납 가능 명시
- 프론트엔드: 발행 버튼 옵션화 (skip 가능)
- 감사 추적: issued_at이 수납 시점과 동일할 수 있음

---

## 3. 청구서 cancelled 상태 제외

### 결정
**Phase 1에서 cancelled 상태 제외**

### 배경
발행 후 오류 발견 시 청구서 취소 필요성

**고려 사항**:
- 청구서 발행 후 금액 오류 발견
- 수납 전 청구서 무효화 필요
- 회계 감사 추적 (audit trail)

### 고려한 방안

**방안 A**: cancelled 상태 추가
```python
status = Enum("draft", "issued", "paid", "overdue", "cancelled")

async def cancel_billable(billable_id: int):
    billable.status = "cancelled"
    billable.cancelled_at = datetime.now(timezone.utc)
```
- 장점: 명시적 취소 표시
- 단점: 상태 복잡도 증가

**방안 B**: cancelled 상태 없이 대안 사용
1. draft 청구서: 직접 삭제
2. issued 청구서: 음수 청구서로 상계
- 장점: 상태 단순, 회계 투명
- 단점: 취소 명시 없음

### 최종 결정: 방안 B

**근거**:
1. **상태 단순성**:
   - 4가지 상태로 충분: draft, issued, paid, overdue
   - cancelled는 비즈니스 로직 복잡도 증가

2. **대안 존재**:
   - draft: 삭제 가능 (수납 내역 없음)
   - issued: 음수 청구서로 상계 (회계 투명)

3. **Phase 1 범위**:
   - 필수 기능 집중
   - cancelled는 Phase 2에서 재검토

**대안 처리 방법**:

**케이스 1: draft 청구서 오류**
```http
DELETE /billables/{id}
```
- draft는 직접 삭제 가능
- 수납 내역 없으므로 안전

**케이스 2: issued 청구서 오류**
```http
POST /billables
{
  "items": [
    {
      "description": "청구서 #20 오류 조정",
      "unit_price": -150000
    }
  ]
}
```
- 음수 청구서로 상계
- 회계 투명성 유지
- notes에 사유 기록

**영향**:
- Billable.status: `draft | issued | paid | overdue`
- 상태 전이 단순화
- Phase 2에서 cancelled 재검토 가능

---

## 4. 영수증 번호 자동 생성

### 결정
**센터별 월별 순번 자동 생성**

### 배경
Payment.receipt_number 필드 활용 방안

**요구사항**:
- 영수증 번호 필요 (회계 추적)
- 센터별 독립 관리
- 월별 순번 리셋

### 고려한 방안

**방안 A**: 수동 입력
```python
receipt_number: str | None  # nullable, 센터 입력
```
- 장점: 센터 자체 규칙 사용 가능
- 단점: 입력 누락, 중복 가능성

**방안 B**: 자동 생성
```python
receipt_number = generate_receipt_number(center_id, paid_at)
# 예: C001-202601-00001
```
- 장점: 일관성, 중복 방지
- 단점: 형식 고정

### 최종 결정: 방안 B

**형식**: `{center_code}-{YYYYMM}-{seq:05d}`

**예시**:
- `C001-202601-00001` (센터 1, 2026년 1월, 1번째)
- `C001-202601-00002` (센터 1, 2026년 1월, 2번째)
- `C010-202602-00001` (센터 10, 2026년 2월, 1번째)

**근거**:
1. **유니크 보장**:
   - 센터별 독립 순번
   - 월별 순번으로 관리 용이

2. **추적 가능**:
   - 센터 코드로 즉시 식별
   - 연월 정보 포함

3. **경쟁사 패턴**:
   - 에피: 자동 생성
   - 마음주의: 자동 생성

**구현**:
```python
async def generate_receipt_number(
    center_id: int,
    paid_at: datetime,
    session: AsyncSession
) -> str:
    """
    영수증 번호 자동 생성
    형식: {center_code}-{YYYYMM}-{seq:05d}
    """
    year_month = paid_at.strftime("%Y%m")

    # 이번 달 마지막 순번 조회
    stmt = (
        select(func.max(Payment.receipt_number))
        .where(Payment.receipt_number.like(f"C{center_id:03d}-{year_month}-%"))
    )
    result = await session.execute(stmt)
    last_receipt = result.scalar()

    if last_receipt:
        # 마지막 5자리 추출하여 +1
        last_seq = int(last_receipt[-5:])
        next_seq = last_seq + 1
    else:
        next_seq = 1

    center_code = f"C{center_id:03d}"
    return f"{center_code}-{year_month}-{next_seq:05d}"

# Payment 생성 시 자동 적용
async def create_payment(data: PaymentCreate):
    async with uow:
        receipt_number = await generate_receipt_number(
            center_id=auth.center_id,
            paid_at=data.paid_at,
            session=uow._session
        )

        payment = await payment_repo.create({
            **data.model_dump(),
            "receipt_number": receipt_number
        })

        await uow.commit()
```

**DB 인덱스**:
```python
# models.py
class Payment(Base):
    receipt_number = Column(String(30), nullable=False, index=True)

    __table_args__ = (
        Index("ix_receipt_number_unique", "receipt_number", unique=True),
    )
```

**영향**:
- Payment 생성 시 자동 생성
- 프론트엔드: 입력 필드 불필요
- 리포트: 영수증 번호로 검색 가능

---

## 5. 음수 금액으로 환불 표현

### 결정
**음수 unit_price로 환불 표현** (item_type 추가 안 함)

### 배경
환불/차액 조정 처리 방법

**예시**:
- 과청구 발생 (150,000원 → 120,000원으로 수정 필요)
- 차액 30,000원 환불

### 고려한 방안

**방안 A**: 별도 item_type="refund"
```python
item_type = Enum("service", "product", "voucher", "package", "refund")

BillableItem(
    item_type="refund",
    description="ADHD 검사 환불",
    unit_price=30000  # 양수
)
```
- 장점: 환불 명시적 표시
- 단점: item_type 의미 혼재 (무엇 vs 방향)

**방안 B**: 음수 금액으로 표현
```python
BillableItem(
    item_type="service",  # 무엇인지
    description="ADHD 검사 차액 조정",
    unit_price=-30000  # 방향 (환불)
)
```
- 장점: item_type 의미 명확
- 단점: 환불 필터링 복잡 (unit_price < 0)

### 최종 결정: 방안 B

**근거**:
1. **의미 분리 명확**:
   - `item_type`: "무엇"인지 (service, voucher, product)
   - `unit_price 부호`: "방향" (청구 vs 환불)

2. **회계 원칙**:
   - 차변/대변 개념과 일치
   - 음수 = 대변 (환불/차감)
   - 양수 = 차변 (청구/매출)

3. **단순성**:
   - item_type 추가 불필요
   - total_amount 계산 단순 (SUM만)

**구현**:
```python
class BillableItemCreate(BaseModel):
    item_type: ItemType  # service, product, voucher, package
    unit_price: int  # 양수 OR 음수

    @model_validator(mode="after")
    def validate_negative_amount(self):
        # 음수 금액 허용하되 notes 권장
        if self.unit_price < 0:
            logger.info(f"음수 금액 항목 생성: {self.unit_price}")
        return self

# 환불 청구서 생성 예시
POST /billables
{
  "client_id": 50,
  "items": [
    {
      "item_type": "service",
      "description": "청구서 #20 차액 조정 (ADHD 검사)",
      "unit_price": -30000  # 음수
    }
  ],
  "notes": "과청구 차액 환불 (150,000 → 120,000)"
}
```

**특징**:
- `total_amount`가 음수 가능 (환불 청구서)
- `unpaid_amount`도 음수 가능 (미환불 금액)
- notes 필수 권장 (음수 항목 사유)

**필터링**:
```sql
-- 환불 항목만 조회
SELECT * FROM billable_items WHERE unit_price < 0;

-- 환불 청구서만 조회
SELECT * FROM billables WHERE total_amount < 0;
```

**영향**:
- item_type: 4가지 유지 (service, product, voucher, package)
- 프론트엔드: 음수 입력 허용 + 경고 표시
- 리포트: 환불 항목 별도 집계

---

## 6. BillableItem 수정 불가 정책

### 결정
**수정 API 없음, 삭제 후 재생성만 허용**

### 배경
draft 청구서 항목 수정 방법

**예시**:
- BillableItem(unit_price=150,000) → 120,000으로 수정 필요

### 고려한 방안

**방안 A**: 수정 API 제공
```http
PUT /billables/{id}/items/{item_id}
{
  "unit_price": 120000
}
```
- 장점: 직관적
- 단점: audit trail 복잡 (수정 이력?)

**방안 B**: 삭제 후 재생성
```http
DELETE /billables/{id}/items/{item_id}
POST /billables/{id}/items
{
  "unit_price": 120000
}
```
- 장점: audit trail 명확
- 단점: 2번 호출

**방안 C**: 전체 항목 재설정
```http
PUT /billables/{id}
{
  "items": [...]  # 전체 교체
}
```
- 장점: 한번에 처리
- 단점: diff 계산 복잡

### 최종 결정: 방안 B

**근거**:
1. **Audit Trail 명확성**:
   - 삭제 = 삭제 기록
   - 생성 = 생성 기록
   - 수정 이력 추적 불필요

2. **구현 단순성**:
   - 수정 로직 불필요
   - 검증 단순 (생성/삭제만)

3. **일관성**:
   - 모든 변경은 "추가" 또는 "삭제"
   - 예외 없는 규칙

**구현**:
```python
# 수정 API 없음

# 삭제만 제공
DELETE /billables/{billable_id}/items/{item_id}

async def delete_billable_item(billable_id: int, item_id: int):
    async with uow:
        billable = await billable_repo.get(billable_id)

        # draft만 삭제 가능
        if billable.status != "draft":
            raise HTTPException(400, "발행된 청구서 항목은 삭제할 수 없습니다")

        # 항목 삭제
        await billable_item_repo.delete(item_id)

        # total_amount 재계산
        total = await billable_item_repo.sum_amount(billable_id)
        billable.total_amount = total
        billable.unpaid_amount = total

        await uow.commit()

# 생성 (기존)
POST /billables/{billable_id}/items
```

**프론트엔드 UX**:
```typescript
// 사용자는 "수정"처럼 느낌
async function updateItem(billableId: number, itemId: number, newData: ItemData) {
  // 내부적으로 삭제 후 생성
  await deleteItem(billableId, itemId);
  await createItem(billableId, newData);

  // UI는 즉시 반영 (낙관적 업데이트)
}
```

**제약 사항**:
- draft 상태에서만 삭제 가능
- issued/paid/overdue는 삭제 불가
- 최소 1개 항목 필수 (전체 삭제 방지)

**영향**:
- API: PUT /billables/{id}/items/{item_id} 없음
- 프론트엔드: 삭제+생성 조합으로 "수정" 구현
- 감사: 생성/삭제 로그만 존재

---

## 의사결정 요약

| 번호 | 주제 | 결정 | Phase |
|------|------|------|-------|
| 1 | 과납부 | 허용 + 경고 로그 | Phase 1 |
| 2 | draft 수납 | 자동 발행 후 수납 | Phase 1 |
| 3 | cancelled | 상태 제외 | Phase 1 |
| 4 | 영수증 번호 | 자동 생성 | Phase 1 |
| 5 | 환불 표현 | 음수 금액 사용 | Phase 1 |
| 6 | 항목 수정 | 삭제 후 재생성만 | Phase 1 |

---

## 참고 문서

- **도메인 설계**: `/docs/payment/domain.md`
- **시나리오**: `/docs/payment/scenarios.md`
- **엣지 케이스**: `/docs/payment/edge-cases.md`
- **경쟁사 분석**: `/docs/payment/competitor-analysis.md`
