# Billing 모듈 도메인 설계

> ⚠️ **DEPRECATED (2026-04-08)**
>
> 이 문서는 2026-01-14에 작성된 **1차 초안**이며, 다음 날(2026-01-15) [docs/payment/](../payment/)로 재설계되었다. 현재 본 문서의 모델(`PaymentRecord` 단일 엔티티 + `Voucher`)은 정답이 아니며, 실제 구현과도 다르다.
>
> **본 문서를 새 작업의 참고로 사용하지 말 것.** Historical reference로만 보존된다.
>
> **정답 설계**: [docs/payment/](../payment/)
> **마이그레이션 플랜**: [docs/billing/billing-improvement-plan.md](./billing-improvement-plan.md)
>
> ---

> 결제 및 바우처 관리를 담당하는 Business Support 레이어

## 목차
1. [모듈 개요](#모듈-개요)
2. [서브모듈 구조](#서브모듈-구조)
3. [엔티티 정의](#엔티티-정의)
4. [비즈니스 규칙](#비즈니스-규칙)
5. [워크플로우](#워크플로우)
6. [API 엔드포인트](#api-엔드포인트)
7. [시드 데이터](#시드-데이터)

---

## 모듈 개요

### 책임 (Responsibility)
- **결제 기록 관리**: 상담/검사 회기별 결제 내역 추적
- **바우처 관리**: 정부 지원 바우처 등록 및 사용 추적
- **미수금 관리**: 미납 내역 조회 및 알림
- **정산**: 센터별 매출 통계 및 정산

### 핵심 가치
- **자동화**: 출석 처리 시 자동으로 PaymentRecord 생성
- **투명성**: 모든 결제 내역 추적 가능
- **유연성**: 현금, 카드, 바우처 등 다양한 결제 수단 지원
- **정확성**: Decimal 타입으로 금액 정확성 보장

### 의존성
- **Depends on**: Client, Counseling, Assessment, Auth (center_id)
- **Depended by**: 없음 (Business Support)

---

## 서브모듈 구조

```
apps/api/app/modules/billing/
├── payment/                 # 결제 기록 관리
│   ├── models.py           # PaymentRecord 엔티티
│   ├── schemas.py          # PaymentCreate, PaymentResponse, PaymentUpdate
│   ├── repository.py       # PaymentRepository
│   └── service.py          # 비즈니스 로직 (미수금 계산, 정산)
│
├── voucher/                 # 바우처 관리
│   ├── models.py           # Voucher, VoucherUsage 엔티티
│   ├── schemas.py          # VoucherCreate, VoucherResponse
│   ├── repository.py       # VoucherRepository, VoucherUsageRepository
│   └── service.py          # 바우처 사용, 잔액 계산
│
├── handlers/                # API 핸들러
│   ├── payment.py          # 결제 CRUD
│   └── voucher.py          # 바우처 CRUD
│
└── router.py                # 라우터 통합
```

---

## 엔티티 정의

### 1. PaymentRecord (결제 기록)

```python
from sqlalchemy import String, Integer, ForeignKey, Date, Numeric, Text, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import TenantModel
from enum import Enum as PyEnum
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.modules.client.main.models import Client

class PaymentMethod(str, PyEnum):
    """결제 수단"""
    CASH = "cash"                    # 현금
    CARD = "card"                    # 카드
    TRANSFER = "transfer"            # 계좌이체
    VOUCHER = "voucher"              # 바우처
    MIXED = "mixed"                  # 혼합 (현금 + 바우처 등)

class PaymentStatus(str, PyEnum):
    """결제 상태"""
    PENDING = "pending"              # 미납
    PARTIAL = "partial"              # 일부 납부
    PAID = "paid"                    # 완납
    REFUNDED = "refunded"            # 환불
    CANCELLED = "cancelled"          # 취소

class PaymentRecord(TenantModel):
    """결제 기록 엔티티"""
    __tablename__ = "payment_records"

    # Client Reference
    client_id: Mapped[int] = mapped_column(
        ForeignKey("clients.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )

    # Polymorphic Relationship (상담/검사 회기 참조)
    related_type: Mapped[str] = mapped_column(String(50), nullable=False)  # "counseling_session", "assessment_session"
    related_id: Mapped[int] = mapped_column(Integer, nullable=False)

    # Payment Info
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)  # 청구 금액
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)  # 납부 금액
    outstanding_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)  # 미수금

    method: Mapped[PaymentMethod | None] = mapped_column(SQLEnum(PaymentMethod))
    status: Mapped[PaymentStatus] = mapped_column(
        SQLEnum(PaymentStatus),
        default=PaymentStatus.PENDING,
        nullable=False,
        index=True
    )

    # Dates
    due_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)  # 납부 기한
    paid_at: Mapped[date | None] = mapped_column(Date)  # 실제 납부일

    # Additional Info
    notes: Mapped[str | None] = mapped_column(Text)  # 메모

    # Note: Client relationship removed (cross-module dependency)

    # Indexes
    __table_args__ = (
        # 센터별 + 상태별 조회
        # 센터별 + 내담자별 조회
        # 센터별 + 납부기한별 조회
    )
```

**필드 설명**:
- `amount`: 청구 금액 (회기 가격)
- `paid_amount`: 실제 납부 금액
- `outstanding_amount`: 미수금 (amount - paid_amount)
- `method`: 결제 수단
- `status`: 결제 상태 (미납, 일부 납부, 완납, 환불, 취소)
- `due_date`: 납부 기한
- `paid_at`: 실제 납부일

---

### 2. Voucher (바우처)

```python
from sqlalchemy import String, Integer, ForeignKey, Date, Numeric, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import TenantModel
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING, List

if TYPE_CHECKING:
    from app.modules.client.main.models import Client
    from app.modules.billing.voucher.models import VoucherUsage

class Voucher(TenantModel):
    """바우처 엔티티"""
    __tablename__ = "vouchers"

    # Client Reference
    client_id: Mapped[int] = mapped_column(
        ForeignKey("clients.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )

    # Voucher Info
    voucher_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)  # 바우처 번호
    type: Mapped[str] = mapped_column(String(100), nullable=False)  # 바우처 종류 (예: "청소년 상담 바우처")

    # Amount
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)  # 총 지원 금액
    used_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)  # 사용 금액
    remaining_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)  # 잔액

    # Validity
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Additional Info
    notes: Mapped[str | None] = mapped_column(Text)

    # Note: Client relationship removed (cross-module dependency)
    # usages relationship with VoucherUsage (same module) can be added in implementation

    # Indexes
    __table_args__ = (
        # 센터별 + 내담자별 조회
        # 바우처 번호 조회 (unique)
        # 만료일별 조회
    )
```

**필드 설명**:
- `voucher_number`: 바우처 번호 (전역 unique)
- `type`: 바우처 종류 (예: "청소년 상담 바우처", "발달장애인 부모 상담 지원")
- `total_amount`: 총 지원 금액
- `used_amount`: 사용한 금액
- `remaining_amount`: 잔액 (total_amount - used_amount)
- `start_date`, `end_date`: 유효 기간
- `is_active`: 활성화 여부

---

### 3. VoucherUsage (바우처 사용 내역)

```python
from sqlalchemy import Integer, ForeignKey, Date, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import TenantModel
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.modules.billing.voucher.models import Voucher
    from app.modules.billing.payment.models import PaymentRecord

class VoucherUsage(TenantModel):
    """바우처 사용 내역"""
    __tablename__ = "voucher_usages"

    # Voucher Reference
    voucher_id: Mapped[int] = mapped_column(
        ForeignKey("vouchers.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Payment Reference
    payment_record_id: Mapped[int] = mapped_column(
        ForeignKey("payment_records.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Usage Info
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)  # 사용 금액
    used_at: Mapped[date] = mapped_column(Date, nullable=False)

    # Additional Info
    notes: Mapped[str | None] = mapped_column(Text)

    # Note: Relationships within same module (billing) can be added in implementation
    # voucher, payment_record relationships removed from docs (implementation detail)

    # Indexes
    __table_args__ = (
        # 바우처별 사용 내역 조회
        # 결제 기록별 바우처 사용 조회
    )
```

**필드 설명**:
- `voucher_id`: 바우처 ID
- `payment_record_id`: 결제 기록 ID
- `amount`: 사용 금액
- `used_at`: 사용일

---

## 비즈니스 규칙

### 1. PaymentRecord 생성 규칙

| 규칙 | 설명 | 구현 위치 |
|------|------|----------|
| **자동 생성** | 상담/검사 출석 처리 시 자동 생성 | CounselingSessionService.mark_attendance() |
| **금액 계산** | amount = contract.price_per_session | 자동 계산 |
| **미수금 계산** | outstanding_amount = amount - paid_amount | 자동 계산 |
| **기본 상태** | status = PENDING | PaymentRecord.status (default) |
| **납부 기한** | due_date = 출석일 + 7일 (또는 설정값) | 자동 계산 |

---

### 2. 결제 처리 규칙

| 규칙 | 설명 | 구현 위치 |
|------|------|----------|
| **부분 납부** | paid_amount < amount → status = PARTIAL | PaymentService.process_payment() |
| **완납** | paid_amount = amount → status = PAID | PaymentService.process_payment() |
| **초과 납부 차단** | paid_amount > amount → 400 에러 | PaymentService.process_payment() |
| **납부일 기록** | paid_at = today() | PaymentService.process_payment() |

---

### 3. 바우처 사용 규칙

| 규칙 | 설명 | 구현 위치 |
|------|------|----------|
| **잔액 체크** | voucher.remaining_amount ≥ amount | VoucherService.use() |
| **유효 기간 체크** | start_date ≤ today ≤ end_date | VoucherService.use() |
| **활성화 체크** | is_active = True | VoucherService.use() |
| **잔액 차감** | remaining_amount -= amount | VoucherService.use() |
| **사용 내역 생성** | VoucherUsage 생성 | VoucherService.use() |

---

## 워크플로우

### 1. 출석 처리 → PaymentRecord 자동 생성

```
┌─────────────────────────────────────────┐
│ POST /api/counseling/sessions/123/attendance│
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ CounselingSessionService.mark_attendance()│
│ (UnitOfWork)                            │
│ ├─ session.status = COMPLETED           │
│ ├─ contract.completed_sessions += 1     │
│ └─ PaymentRecord 생성                    │
│    ├─ client_id = contract.client_id    │
│    ├─ related_type = "counseling_session"│
│    ├─ related_id = session.id           │
│    ├─ amount = contract.price_per_session│
│    ├─ paid_amount = 0                   │
│    ├─ outstanding_amount = amount       │
│    ├─ status = PENDING                  │
│    └─ due_date = today + 7일             │
└──────┬──────────────────────────────────┘
       │ DB commit
       ▼
┌─────────────────────────────────────────┐
│ PaymentRecord 생성 완료                  │
│ (미수금 발생)                            │
└─────────────────────────────────────────┘
```

---

### 2. 결제 처리 (현금/카드)

```
┌─────────────┐
│   Client    │
│  (Frontend) │
└──────┬──────┘
       │ POST /api/billing/payments/123/pay
       │ { method: "cash", amount: 80000 }
       ▼
┌─────────────────────────────────────────┐
│ Handler: process_payment()              │
│ ├─ PaymentRecord 조회                    │
│ ├─ 금액 검증 (amount ≤ outstanding)      │
│ ├─ 결제 처리                             │
│ │  ├─ paid_amount += amount             │
│ │  ├─ outstanding_amount -= amount      │
│ │  ├─ status = PAID (완납 시)           │
│ │  ├─ method = "cash"                   │
│ │  └─ paid_at = today()                 │
│ └─ DB 저장                               │
└──────┬──────────────────────────────────┘
       │ PaymentResponse
       ▼
┌─────────────┐
│   Client    │
└─────────────┘
```

**Handler 구현**:
```python
async def process_payment(
    id: int,
    data: PaymentProcessRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    payments = PaymentRepository(session)

    payment = await payments.get(id)
    if not payment:
        raise HTTPException(404, "Payment not found")

    # 초과 납부 체크
    if data.amount > payment.outstanding_amount:
        raise HTTPException(400, "Amount exceeds outstanding amount")

    # 결제 처리
    payment.paid_amount += data.amount
    payment.outstanding_amount -= data.amount
    payment.method = data.method
    payment.paid_at = date.today()

    # 상태 업데이트
    if payment.outstanding_amount == Decimal("0.00"):
        payment.status = PaymentStatus.PAID
    else:
        payment.status = PaymentStatus.PARTIAL

    await session.commit()
    await session.refresh(payment)

    return PaymentResponse.model_validate(payment)
```

---

### 3. 바우처 사용

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ POST /api/billing/vouchers/123/use
       │ { payment_record_id: 456, amount: 50000 }
       ▼
┌─────────────────────────────────────────┐
│ Handler: use_voucher()                  │
│ (UnitOfWork)                            │
│ ├─ Voucher 조회                          │
│ ├─ 유효성 검증                            │
│ │  ├─ 잔액 체크 (remaining ≥ amount)    │
│ │  ├─ 유효 기간 체크                     │
│ │  └─ 활성화 체크                        │
│ ├─ PaymentRecord 조회                    │
│ ├─ 바우처 사용 처리                       │
│ │  ├─ voucher.used_amount += amount     │
│ │  ├─ voucher.remaining_amount -= amount│
│ │  ├─ VoucherUsage 생성                 │
│ │  ├─ payment.paid_amount += amount     │
│ │  ├─ payment.outstanding_amount -= amount│
│ │  └─ payment.status 업데이트            │
│ └─ DB 저장 (commit)                      │
└──────┬──────────────────────────────────┘
       │ VoucherResponse
       ▼
┌─────────────┐
│   Client    │
└─────────────┘
```

**Handler 구현**:
```python
async def use_voucher(
    id: int,
    data: VoucherUseRequest,
    uow: UnitOfWork = Depends(get_uow)
):
    async with uow:
        vouchers = uow.repo(VoucherRepository)
        payments = uow.repo(PaymentRepository)
        voucher_usages = uow.repo(VoucherUsageRepository)

        voucher = await vouchers.get(id)
        if not voucher:
            raise HTTPException(404, "Voucher not found")

        # 유효성 검증
        if voucher.remaining_amount < data.amount:
            raise HTTPException(400, "Insufficient voucher balance")

        today = date.today()
        if not (voucher.start_date <= today <= voucher.end_date):
            raise HTTPException(400, "Voucher expired or not yet valid")

        if not voucher.is_active:
            raise HTTPException(400, "Voucher is not active")

        # PaymentRecord 조회
        payment = await payments.get(data.payment_record_id)
        if not payment:
            raise HTTPException(404, "Payment not found")

        # 바우처 사용 처리
        voucher.used_amount += data.amount
        voucher.remaining_amount -= data.amount

        # VoucherUsage 생성
        await voucher_usages.create({
            "center_id": voucher.center_id,
            "voucher_id": voucher.id,
            "payment_record_id": payment.id,
            "amount": data.amount,
            "used_at": today
        })

        # PaymentRecord 업데이트
        payment.paid_amount += data.amount
        payment.outstanding_amount -= data.amount

        if payment.outstanding_amount == Decimal("0.00"):
            payment.status = PaymentStatus.PAID
        else:
            payment.status = PaymentStatus.PARTIAL

        await uow.commit()

        return VoucherResponse.model_validate(voucher)
```

---

## API 엔드포인트

### 1. PaymentRecord (결제 기록)

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/billing/payments` | 결제 목록 (센터 내, 필터링) | billing:read |
| GET | `/api/billing/payments/{id}` | 결제 상세 | billing:read |
| POST | `/api/billing/payments/{id}/pay` | 결제 처리 | billing:update |
| PATCH | `/api/billing/payments/{id}` | 결제 수정 | billing:update |
| DELETE | `/api/billing/payments/{id}` | 결제 취소 | billing:delete |

---

### 2. Voucher (바우처)

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/billing/vouchers` | 바우처 목록 | billing:read |
| GET | `/api/billing/vouchers/{id}` | 바우처 상세 (사용 내역 포함) | billing:read |
| POST | `/api/billing/vouchers` | 바우처 생성 | billing:create |
| PATCH | `/api/billing/vouchers/{id}` | 바우처 수정 | billing:update |
| DELETE | `/api/billing/vouchers/{id}` | 바우처 삭제 | billing:delete |
| **POST** | `/api/billing/vouchers/{id}/use` | **바우처 사용** | billing:update |

---

### Request/Response 스키마

#### GET /api/billing/payments

**Query Parameters**:
- `client_id`: 내담자 필터 (선택)
- `status`: 상태 필터 (선택)
- `due_date_from`, `due_date_to`: 납부 기한 범위 (선택)
- `page`, `size`: 페이지네이션

```typescript
interface PaymentListResponse {
  items: PaymentResponse[];
  total: number;
  page: number;
  size: number;
  pages: number;
}
```

---

#### POST /api/billing/payments/{id}/pay

```typescript
interface PaymentProcessRequest {
  method: "cash" | "card" | "transfer";
  amount: number;          // Decimal
  notes?: string;
}

interface PaymentResponse {
  id: number;
  center_id: number;
  client_id: number;
  client: ClientSummary;
  related_type: string;
  related_id: number;
  amount: string;          // Decimal as string
  paid_amount: string;
  outstanding_amount: string;
  method: string | null;
  status: string;
  due_date: string;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
```

---

#### POST /api/billing/vouchers

```typescript
interface VoucherCreateRequest {
  client_id: number;
  voucher_number: string;
  type: string;
  total_amount: number;          // Decimal
  start_date: string;            // YYYY-MM-DD
  end_date: string;
  notes?: string;
}

interface VoucherResponse {
  id: number;
  center_id: number;
  client_id: number;
  client: ClientSummary;
  voucher_number: string;
  type: string;
  total_amount: string;
  used_amount: string;
  remaining_amount: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  usages?: VoucherUsageResponse[];  // 상세 조회 시
}
```

---

#### POST /api/billing/vouchers/{id}/use

```typescript
interface VoucherUseRequest {
  payment_record_id: number;
  amount: number;          // Decimal
  notes?: string;
}

// Response: VoucherResponse (remaining_amount 업데이트됨)
```

---

## 시드 데이터

### Development Seeds

```python
# migrations/seeds/billing.py

# 1. 샘플 결제 기록
SAMPLE_PAYMENTS = [
    {
        "center_id": 1,
        "client_id": 1,  # 김철수
        "related_type": "counseling_session",
        "related_id": 1,
        "amount": "80000.00",
        "paid_amount": "80000.00",
        "outstanding_amount": "0.00",
        "method": "cash",
        "status": "paid",
        "due_date": "2026-01-12",
        "paid_at": "2026-01-05"
    },
    {
        "center_id": 1,
        "client_id": 1,
        "related_type": "counseling_session",
        "related_id": 2,
        "amount": "80000.00",
        "paid_amount": "50000.00",
        "outstanding_amount": "30000.00",
        "method": "mixed",
        "status": "partial",
        "due_date": "2026-01-15",
        "paid_at": "2026-01-08"
    },
    {
        "center_id": 1,
        "client_id": 1,
        "related_type": "counseling_session",
        "related_id": 3,
        "amount": "80000.00",
        "paid_amount": "0.00",
        "outstanding_amount": "80000.00",
        "status": "pending",
        "due_date": "2026-01-19"
    }
]

# 2. 샘플 바우처
SAMPLE_VOUCHERS = [
    {
        "center_id": 1,
        "client_id": 1,
        "voucher_number": "YOUTH-2026-001234",
        "type": "청소년 상담 바우처",
        "total_amount": "300000.00",
        "used_amount": "80000.00",
        "remaining_amount": "220000.00",
        "start_date": "2026-01-01",
        "end_date": "2026-12-31",
        "is_active": True
    },
    {
        "center_id": 1,
        "client_id": 3,  # 박민준
        "voucher_number": "PARENT-2026-005678",
        "type": "발달장애인 부모 상담 지원",
        "total_amount": "500000.00",
        "used_amount": "0.00",
        "remaining_amount": "500000.00",
        "start_date": "2026-01-01",
        "end_date": "2026-06-30",
        "is_active": True
    }
]

# 3. 샘플 바우처 사용 내역
SAMPLE_VOUCHER_USAGES = [
    {
        "center_id": 1,
        "voucher_id": 1,
        "payment_record_id": 1,
        "amount": "80000.00",
        "used_at": "2026-01-05"
    }
]
```

---

## 다이어그램

### ERD

```
┌─────────────────────────────────────────────┐
│                   clients                   │
└─────────────────────────────────────────────┘
                      │
            ┌─────────┴─────────┐
            │                   │
            ▼                   ▼
┌─────────────────────┐  ┌──────────────────────┐
│   payment_records   │  │      vouchers        │
├─────────────────────┤  ├──────────────────────┤
│ PK │ id             │  │ PK │ id              │
│ FK │ center_id      │  │ FK │ center_id       │
│ FK │ client_id      │  │ FK │ client_id       │
│    │ related_type   │  │    │ voucher_number  │
│    │ related_id     │  │    │ type            │
│    │ amount         │  │    │ total_amount    │
│    │ paid_amount    │  │    │ used_amount     │
│    │ outstanding    │  │    │ remaining_amount│
│    │ method         │  │    │ start_date      │
│    │ status         │  │    │ end_date        │
│    │ due_date       │  │    │ is_active       │
│    │ paid_at        │  │    │ ...             │
│    │ ...            │  └──────────────────────┘
└─────────────────────┘              │
            │                        │ 1:N
            │                        ▼
            │              ┌──────────────────────┐
            │              │   voucher_usages     │
            │              ├──────────────────────┤
            │              │ PK │ id              │
            │              │ FK │ center_id       │
            │              │ FK │ voucher_id      │
            │              │ FK │ payment_record_id│
            └──────────────│    │ amount          │
                  1:N      │    │ used_at         │
                           └──────────────────────┘
```

---

## 모듈 간 통신

### 1. Counseling 모듈에서 PaymentRecord 생성

```python
# counseling/session/service.py
async def mark_attendance(session_id, uow):
    async with uow:
        # ... 출석 처리 ...

        # PaymentRecord 생성
        await uow.repo(PaymentRepository).create({
            "center_id": session.center_id,
            "client_id": contract.client_id,
            "related_type": "counseling_session",
            "related_id": session.id,
            "amount": contract.price_per_session,
            "paid_amount": Decimal("0.00"),
            "outstanding_amount": contract.price_per_session,
            "status": "pending",
            "due_date": date.today() + timedelta(days=7)
        })

        await uow.commit()
```

---

### 2. Assessment 모듈에서 PaymentRecord 생성

```python
# assessment/session/service.py
async def complete_session(session_id, uow):
    async with uow:
        # ... 완료 처리 ...

        # PaymentRecord 생성
        await uow.repo(PaymentRepository).create({
            "center_id": session.center_id,
            "client_id": case.client_id,
            "related_type": "assessment_session",
            "related_id": session.id,
            "amount": task.price,
            "paid_amount": Decimal("0.00"),
            "outstanding_amount": task.price,
            "status": "pending",
            "due_date": date.today() + timedelta(days=7)
        })

        await uow.commit()
```

---

## 구현 우선순위

### Phase 1: 기본 CRUD (필수)
1. ✅ PaymentRecord, Voucher, VoucherUsage 엔티티 정의
2. 🔄 PaymentRepository, VoucherRepository 구현
3. 🔄 Payment CRUD 핸들러
4. 🔄 결제 처리 (process_payment)
5. 🔄 Pydantic 스키마

### Phase 2: 바우처 관리
1. 🔄 Voucher CRUD 핸들러
2. 🔄 바우처 사용 (use_voucher)
3. 🔄 VoucherUsage 생성 및 추적

### Phase 3: 고급 기능 (선택)
1. 미수금 통계 및 알림
2. 정산 리포트 (센터별, 기간별 매출)
3. 환불 처리
4. 바우처 만료 알림

---

## 참고 문서

- **전체 아키텍처**: `/docs/domain-architecture.md`
- **CLAUDE.md**: 프로젝트 설정 및 개발 규칙
- **Counseling 모듈**: `/docs/counseling/domain.md` (결제 기록 생성 예시)
- **Assessment 모듈**: `/docs/assessment/domain_v2.md` (결제 기록 생성 예시)
