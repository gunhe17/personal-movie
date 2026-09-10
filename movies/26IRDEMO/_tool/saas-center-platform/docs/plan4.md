# 상담센터 SaaS - 상담 관리 시스템 설계 문서 v4

> plan3.md 기반 + **결제 도메인 분리(PaymentRecord)** + 청구 관리 화면 추가 + 시나리오 고도화

---

## 1. 도메인 모델 (Revised)

### 핵심 도메인

```mermaid
graph TD
    Client[Client (내담자)] -->|1:N| Counseling[Counseling (상담 계약)]
    Counseling -->|1:N| Session[CounselingSession (상담 세션)]
    
    Session -->|N:1| Schedule[Schedule (물리적 일정)]
    Session -->|1:N| Payment[PaymentRecord (결제/청구 기록)]
    
    Payment -->|N:1 (nullable)| Voucher[Voucher (바우처 마스터)]
    
    Schedule -->|N:1| Room[Room]
    Schedule -->|N:1| Counselor[User]
```

#### 1. CounselingSession (상담 세션) - 순수 상담 행위
- `counseling_id`, `schedule_id`
- `session_number`: 회차
- `status`: `scheduled`(예정) / `completed`(출석) / `no_show`(노쇼) / `cancelled`(취소)
- **역할**: "상담 서비스가 제공되었는가?"를 관리 (결제와 무관)

#### 2. PaymentRecord (결제 기록) - **[New]**
- `session_id`: 어떤 세션에 대한 비용인가?
- `type`: 'voucher'(바우처) | 'self_pay'(자부담-카드/현금)
- `voucher_id`: 바우처 사용 시 연결
- `amount`: 청구 금액 (자부담금 or 바우처 단가)
- `status`: 
    - `pending`: 청구 대기 / 미납 (서비스는 했으나 돈은 아직)
    - `paid`: 결제 완료 / 청구 승인
    - `refunded`: 환불 / 취소
- `paid_at`: 실제 결제 일시

---

## 2. 기술 스택
(plan3.md와 동일)

---

## 3. 프로젝트 구조
(plan3.md와 동일)

---

## 4. 스크립트 인터페이스
(plan3.md와 동일)

---

## 5. 화면 및 라우팅 (Updated)

| Route | 설명 | 비고 |
|-------|------|------|
| `/counseling` | 상담 목록 | |
| `/counseling/[id]` | 상담 상세 | **[Tabs]: 세션목록(일지) / 결제내역** |
| `/billing` | **[New] 청구 관리** | 미수금/청구대기 건 모아보기 |
| `/billing/vouchers` | 바우처 청구 | 바우처별 청구 현황 리스트 |
| `/billing/unpaid` | 미납 관리 | 자부담 미납 건 관리 |
| `/schedule` | 스케줄 (캘린더) | |
| `/client` | 내담자 목록 | |

---

## 6. API 엔드포인트 (Updated)

### CounselingSession (상담세션)
- `PATCH /api/counseling-sessions/:id`
    - 출석 처리(`completed`) 시 -> **자동으로 `pending` 상태의 `PaymentRecord` 생성 트리거** (비즈니스 로직).

### Payment (결제) - **[New]**
```
GET    /api/payments?counseling_id=...     # 특정 상담의 결제 이력
GET    /api/payments/pending               # 전체 미수/청구대기 목록 (Billing 페이지용)
POST   /api/payments                       # 수동 결제 생성 (선결제 등)
PATCH  /api/payments/:id                   # 상태 변경 (pending -> paid)
/* Payload: { "status": "paid", "method": "card", "paid_at": "..." } */
```

### Counseling / Schedule / Client
(기존 plan3.md와 동일)

---

## 7. 핵심 컴포넌트

### 도메인 컴포넌트 추가
| 컴포넌트 | 설명 |
|----------|------|
| `BillingTable` | `/billing` 페이지용. 내담자명, 금액, 상태, '결제처리' 버튼 포함. |
| `PaymentHistory` | 상담 상세 페이지 '결제' 탭용. 회차별 납부 이력 리스트. |
| `PaymentModal` | 결제 처리 팝업 (카드/현금/바우처 승인 선택). |
| `StatusBadge` | 세션 상태(출석/노쇼)와 결제 상태(미납/완료) 구분하여 표시. |

---

## 8. 인증/권한 설계
(plan3.md와 동일, `payment:read`, `payment:write` 권한 추가)

---

## 9. DB 스키마 (Revised)

### counseling_sessions (결제 필드 제거)
```sql
CREATE TABLE counseling_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    counseling_id UUID NOT NULL REFERENCES counselings(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
    session_number INT NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled', 
    -- scheduled, completed, no_show, cancelled
    
    -- 상담 기록
    goal TEXT, content TEXT, summary TEXT, private_memo TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (counseling_id, session_number)
);
```

### payment_records (신규)
```sql
CREATE TABLE payment_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES counseling_sessions(id) ON DELETE SET NULL,
    counseling_id UUID NOT NULL REFERENCES counselings(id), -- 조회 편의성
    
    type VARCHAR(20) NOT NULL, -- voucher, self_pay
    voucher_id UUID REFERENCES vouchers(id),
    
    amount INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending', -- pending, paid, refunded, cancelled
    
    paid_at TIMESTAMP,
    note TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_payments_counseling_id ON payment_records(counseling_id);
CREATE INDEX idx_payments_status ON payment_records(status);
```

---

## 10. 시나리오 검증 (Flow Analysis)

### Scenario A: 상담 완료 후 결제 처리 (표준)
1. **상담사**: `/schedule`에서 오늘 상담 '출석(`completed`)' 처리.
   - **System**: `CounselingSession` 상태 변경 + `PaymentRecord` 생성 (`pending`, 자부담 5만원).
2. **데스크**: 내담자가 나가면서 카드 결제 요청.
3. **데스크**: `/counseling/[id]` -> [결제] 탭 or `/billing`에서 해당 건 '결제(`paid`)' 처리.

### Scenario B: 그룹 상담 혼합 결제
- **상황**: A(바우처), B(자부담) 그룹 상담 출석.
- **처리**:
  - `Session A`, `Session B` 모두 `completed`로 변경.
  - `Payment A` (Type: Voucher, Status: Pending) 생성.
  - `Payment B` (Type: Self_pay, Status: Pending) 생성.
- **결과**: 
  - 관리자는 월말에 `/billing/vouchers`에서 `Payment A`를 포함해 일괄 청구 작업.
  - 데스크는 즉시 `Payment B`에 대해 카드 결제 받음.

### Scenario C: 선결제 (Pre-payment)
- **상황**: 10회기 비용(50만원)을 미리 결제함.
- **처리**: 
  - `POST /payments`로 세션 연결 없는 `Credit`(예치금) 성격의 레코드 생성 (심화 기능, v2 고려).
  - *현재 v1에서는*: 각 회기 끝날 때마다 'Paid' 상태로 바로 처리하거나, 메모를 남기는 방식으로 우회.

---

## 11. 회기 관리 및 결제 플로우

### 상담 등록 시
- `Counseling`에 `default_payment_type`, `default_amount` 등을 설정해두면, 세션 완료 시 이 정보를 바탕으로 `PaymentRecord`가 자동 생성되도록 구현.

---

## 12. 구현 순서
1. **DB**: `schedules`, `counseling_sessions`, `payment_records` 테이블 생성.
2. **API**: 상담 완료(`completed`) 시 결제 레코드 생성 트리거 로직 구현.
3. **Frontend**:
   - `/billing` 페이지 (Table UI).
   - 상담 상세 페이지 탭 분리 구현.
