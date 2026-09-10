# Payment 도메인 이벤트

> 도메인 이벤트 정의 및 처리 흐름

---

## 이벤트 정의

### 1. BillableCreated (청구서 생성)

**발생 시점**: 청구서 생성 완료

**Payload**:
```json
{
  "event_type": "BillableCreated",
  "billable_id": 1,
  "center_id": 1,
  "client_id": 50,
  "total_amount": 150000,
  "status": "draft",
  "created_at": "2026-01-15T10:00:00Z"
}
```

**처리**:
- 알림 없음 (draft 상태)

---

### 2. BillableIssued (청구서 발행)

**발생 시점**: 청구서 발행 (draft → issued)

**Payload**:
```json
{
  "event_type": "BillableIssued",
  "billable_id": 1,
  "center_id": 1,
  "client_id": 50,
  "total_amount": 150000,
  "issued_at": "2026-01-15T10:00:00Z"
}
```

**처리** (Phase 2):
- 내담자 알림: SMS/이메일 발송
- 센터 알림: 청구서 발행 완료

---

### 3. PaymentProcessed (수납 처리)

**발생 시점**: Payment 생성 완료

**Payload**:
```json
{
  "event_type": "PaymentProcessed",
  "payment_id": 1,
  "billable_id": 1,
  "center_id": 1,
  "amount": 50000,
  "payment_method": "cash",
  "receipt_number": "C001-202601-00001",
  "paid_at": "2026-01-15T14:00:00Z"
}
```

**처리**:
- Billable.paid_amount 갱신 (동일 트랜잭션)
- 영수증 발급
- 센터 알림: 수납 완료

---

### 4. BillablePaid (완납)

**발생 시점**: paid_amount >= total_amount

**Payload**:
```json
{
  "event_type": "BillablePaid",
  "billable_id": 1,
  "center_id": 1,
  "client_id": 50,
  "total_amount": 150000,
  "paid_amount": 150000,
  "paid_at": "2026-01-20T10:00:00Z"
}
```

**처리**:
- 내담자 알림: 완납 확인
- 센터 알림: 완납 알림
- 회계 연동 (Phase 3)

---

### 5. VoucherUsed (바우처 사용)

**발생 시점**: 바우처 청구 항목 생성

**Payload**:
```json
{
  "event_type": "VoucherUsed",
  "client_voucher_id": 10,
  "client_id": 52,
  "voucher_policy_id": 1,
  "voucher_policy_name": "아동청소년심리지원 서비스",
  "used_sessions": 3,
  "remaining_sessions": 7,
  "used_at": "2026-01-15T10:00:00Z"
}
```

**처리**:
- ClientVoucher.used_sessions 갱신 (동일 트랜잭션)
- 잔여 횟수 알림 (5회 이하 시)

---

### 6. VoucherExhausted (바우처 소진)

**발생 시점**: remaining_sessions = 0

**Payload**:
```json
{
  "event_type": "VoucherExhausted",
  "client_voucher_id": 10,
  "client_id": 52,
  "voucher_policy_id": 1,
  "total_sessions": 10,
  "exhausted_at": "2026-03-15T10:00:00Z"
}
```

**처리**:
- 센터 알림: 바우처 소진
- 내담자 알림: 바우처 재신청 안내

---

### 7. BillableOverdue (연체)

**발생 시점**: 납부 기한 초과 (배치)

**Payload**:
```json
{
  "event_type": "BillableOverdue",
  "billable_id": 4,
  "center_id": 1,
  "client_id": 50,
  "unpaid_amount": 350000,
  "due_date": "2026-02-10",
  "overdue_days": 5
}
```

**처리**:
- 센터 알림: 연체 알림
- 내담자 알림: 납부 독촉 (선택)

---

## 이벤트 처리 패턴

### 패턴 1: 동기 처리 (동일 트랜잭션)

**예시**: PaymentProcessed → Billable.paid_amount 갱신

```python
async def process_payment(data: PaymentCreate):
    async with uow:
        # 1. Payment 생성
        payment = await payment_repo.create(data.model_dump())

        # 2. Billable 갱신 (동기)
        billable = await billable_repo.get(data.billable_id)
        billable.paid_amount += data.amount

        # 3. 상태 전환
        if billable.paid_amount >= billable.total_amount:
            billable.status = "paid"
            # BillablePaid 이벤트 발행 (동일 트랜잭션)

        await uow.commit()
```

---

### 패턴 2: 비동기 처리 (알림)

**예시**: BillablePaid → 내담자/센터 알림

```python
# Handler에서 이벤트 발행
async def process_payment(data: PaymentCreate):
    async with uow:
        # ... 트랜잭션 처리 ...
        await uow.commit()

    # 트랜잭션 외부에서 비동기 이벤트 발행
    if billable.status == "paid":
        await event_bus.publish(BillablePaid(
            billable_id=billable.id,
            client_id=billable.client_id,
            total_amount=billable.total_amount
        ))

# Event Handler
async def handle_billable_paid(event: BillablePaid):
    # 내담자 알림
    await notification_service.send_sms(
        phone=client.phone,
        message=f"청구 금액 {event.total_amount}원이 완납되었습니다."
    )

    # 센터 알림
    await notification_service.send_email(
        to=center.email,
        subject="완납 알림",
        body="..."
    )
```

---

### 패턴 3: 배치 처리

**예시**: BillableOverdue (매일 자동 실행)

```python
# 배치 작업
async def check_overdue_billables():
    """매일 자동 실행: 연체 청구서 체크"""
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
        # 상태 전환
        billable.status = "overdue"

        # 이벤트 발행
        await event_bus.publish(BillableOverdue(
            billable_id=billable.id,
            client_id=billable.client_id,
            unpaid_amount=billable.unpaid_amount,
            overdue_days=(today - billable.due_date).days
        ))

    await session.commit()
```

---

## 이벤트 구독자

### 1. 알림 서비스

**구독 이벤트**:
- BillableIssued → 청구서 발행 알림
- BillablePaid → 완납 알림
- VoucherExhausted → 바우처 소진 알림
- BillableOverdue → 연체 알림

---

### 2. 회계 연동 (Phase 3)

**구독 이벤트**:
- BillablePaid → 외부 회계 시스템 전송
- PaymentProcessed → 수납 내역 전송

---

### 3. 분석 서비스 (Phase 3)

**구독 이벤트**:
- PaymentProcessed → 매출 분석
- VoucherUsed → 바우처 사용 통계

---

## 이벤트 스키마

### Base Event

```python
from pydantic import BaseModel
from datetime import datetime

class BaseEvent(BaseModel):
    event_type: str
    event_id: str  # UUID
    center_id: int
    occurred_at: datetime
    version: str = "1.0"
```

### Concrete Events

```python
class BillableCreated(BaseEvent):
    event_type: str = "BillableCreated"
    billable_id: int
    client_id: int
    total_amount: int
    status: str

class BillableIssued(BaseEvent):
    event_type: str = "BillableIssued"
    billable_id: int
    client_id: int
    total_amount: int
    issued_at: datetime

class PaymentProcessed(BaseEvent):
    event_type: str = "PaymentProcessed"
    payment_id: int
    billable_id: int
    amount: int
    payment_method: str
    receipt_number: str

class BillablePaid(BaseEvent):
    event_type: str = "BillablePaid"
    billable_id: int
    client_id: int
    total_amount: int
    paid_amount: int

class VoucherUsed(BaseEvent):
    event_type: str = "VoucherUsed"
    client_voucher_id: int
    client_id: int
    voucher_policy_id: int
    used_sessions: int
    remaining_sessions: int

class VoucherExhausted(BaseEvent):
    event_type: str = "VoucherExhausted"
    client_voucher_id: int
    client_id: int
    voucher_policy_id: int
    total_sessions: int

class BillableOverdue(BaseEvent):
    event_type: str = "BillableOverdue"
    billable_id: int
    client_id: int
    unpaid_amount: int
    due_date: date
    overdue_days: int
```

---

## 이벤트 버스 구현

### In-Memory (Phase 1)

```python
class InMemoryEventBus:
    def __init__(self):
        self._handlers: dict[str, list[Callable]] = {}

    def subscribe(self, event_type: str, handler: Callable):
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)

    async def publish(self, event: BaseEvent):
        handlers = self._handlers.get(event.event_type, [])
        for handler in handlers:
            await handler(event)
```

### Redis Pub/Sub (Phase 2)

```python
class RedisEventBus:
    def __init__(self, redis: Redis):
        self._redis = redis

    async def publish(self, event: BaseEvent):
        channel = f"payment:{event.event_type}"
        payload = event.model_dump_json()
        await self._redis.publish(channel, payload)

    async def subscribe(self, event_type: str, handler: Callable):
        channel = f"payment:{event_type}"
        pubsub = self._redis.pubsub()
        await pubsub.subscribe(channel)

        async for message in pubsub.listen():
            if message["type"] == "message":
                event_data = json.loads(message["data"])
                await handler(event_data)
```

---

## 이벤트 로그 (Audit Trail)

### EventLog 엔티티 (Phase 2)

```python
class EventLog(Base):
    __tablename__ = "event_logs"

    id = Column(Integer, primary_key=True)
    event_id = Column(String(36), unique=True, nullable=False)  # UUID
    event_type = Column(String(50), nullable=False)
    center_id = Column(Integer, nullable=False)
    aggregate_id = Column(Integer, nullable=False)  # billable_id, payment_id 등
    aggregate_type = Column(String(50), nullable=False)  # Billable, Payment 등
    payload = Column(JSON, nullable=False)
    occurred_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.now)

    __table_args__ = (
        Index("ix_event_type", "event_type"),
        Index("ix_center_id_occurred_at", "center_id", "occurred_at"),
    )
```

---

## 참고 문서

- **도메인 설계**: `/docs/payment/domain.md`
- **API 명세**: `/docs/payment/api-spec.md`
- **Summary**: `/docs/payment/summary.md`
