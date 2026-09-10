# Payment API 명세서

> REST API 엔드포인트 상세 명세

---

## 인증

모든 엔드포인트는 JWT 인증 필수.

```http
Authorization: Bearer {access_token}
```

**JWT Payload**:
```json
{
  "account_id": 1,
  "center_id": 1,
  "plan": "pro"
}
```

---

## Billable (청구 관리)

### 1. 청구서 생성

```http
POST /billables
```

**Request**:
```json
{
  "client_id": 50,
  "billable_date": "2026-01-15",
  "due_date": "2026-02-15",
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

**Response** (201):
```json
{
  "id": 1,
  "center_id": 1,
  "client_id": 50,
  "billable_date": "2026-01-15",
  "due_date": "2026-02-15",
  "total_amount": 150000,
  "paid_amount": 0,
  "unpaid_amount": 150000,
  "status": "draft",
  "issued_at": null,
  "notes": "1월 검사 건",
  "items": [...],
  "created_at": "2026-01-15T10:00:00Z"
}
```

**Validation**:
- `items` 최소 1개 필수
- `billable_date`: 미래 날짜 불가
- `client_id`: 센터 소유권 체크

---

### 2. 청구 목록 조회

```http
GET /billables?page=1&size=20&status=issued&client_id=50
```

**Query Parameters**:
- `page`: 페이지 번호 (default: 1)
- `size`: 페이지 크기 (default: 20, max: 100)
- `status`: draft | issued | paid | overdue
- `client_id`: 내담자 필터
- `start_date`: 청구 시작일 (YYYY-MM-DD)
- `end_date`: 청구 종료일

**Response** (200):
```json
{
  "items": [
    {
      "id": 1,
      "client_id": 50,
      "client_name": "김철수",
      "billable_date": "2026-01-15",
      "total_amount": 150000,
      "paid_amount": 0,
      "unpaid_amount": 150000,
      "status": "draft"
    }
  ],
  "total": 1,
  "page": 1,
  "size": 20,
  "pages": 1
}
```

---

### 3. 청구 상세 조회

```http
GET /billables/{billable_id}
```

**Response** (200):
```json
{
  "id": 1,
  "center_id": 1,
  "client_id": 50,
  "client_name": "김철수",
  "billable_date": "2026-01-15",
  "total_amount": 150000,
  "paid_amount": 50000,
  "unpaid_amount": 100000,
  "status": "issued",
  "items": [
    {
      "id": 1,
      "item_type": "service",
      "description": "ADHD 검사",
      "unit_price": 150000,
      "amount": 150000
    }
  ],
  "payments": [
    {
      "id": 1,
      "amount": 50000,
      "payment_method": "cash",
      "paid_at": "2026-01-15T14:00:00Z",
      "receipt_number": "C001-202601-00001"
    }
  ]
}
```

**Errors**:
- `404`: 청구서 없음
- `403`: 다른 센터 청구서

---

### 4. 미수금 목록

```http
GET /billables/unpaid?page=1&size=20
```

**Response** (200):
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
    }
  ],
  "total_unpaid": 450000,
  "total": 2,
  "page": 1,
  "size": 20
}
```

---

### 5. 청구 항목 추가

```http
POST /billables/{billable_id}/items
```

**Request**:
```json
{
  "item_type": "service",
  "description": "추가 검사",
  "unit_price": 80000,
  "quantity": 1
}
```

**Response** (201):
```json
{
  "id": 20,
  "billable_id": 10,
  "item_type": "service",
  "description": "추가 검사",
  "unit_price": 80000,
  "amount": 80000
}
```

**Errors**:
- `400`: 발행된 청구서 (status != "draft")

---

### 6. 청구 항목 삭제

```http
DELETE /billables/{billable_id}/items/{item_id}
```

**Response** (204)

**Errors**:
- `400`: 발행된 청구서
- `400`: 마지막 항목 (최소 1개 필수)

---

### 7. 청구서 발행

```http
PUT /billables/{billable_id}/status
```

**Request**:
```json
{
  "status": "issued"
}
```

**Response** (200):
```json
{
  "id": 1,
  "status": "issued",
  "issued_at": "2026-01-15T10:00:00Z"
}
```

**Errors**:
- `400`: 이미 발행됨
- `400`: 빈 항목 (items.length = 0)

---

## Payment (수납 관리)

### 1. 수납 처리

```http
POST /payments
```

**Request**:
```json
{
  "billable_id": 1,
  "amount": 50000,
  "payment_method": "cash",
  "paid_at": "2026-01-15T14:00:00Z",
  "notes": "일부 납부"
}
```

**Response** (201):
```json
{
  "id": 1,
  "billable_id": 1,
  "amount": 50000,
  "payment_method": "cash",
  "paid_at": "2026-01-15T14:00:00Z",
  "receipt_number": null,
  "notes": "일부 납부",
  "created_at": "2026-01-15T14:00:00Z"
}
```

**비즈니스 로직**:
1. `status="draft"` → 자동 `status="issued"` 전환
2. `paid_amount += amount`
3. `paid_amount >= total_amount` → `status="paid"`
4. 영수증 번호: nullable (Phase 1), 자동 생성 선택 (Phase 2)

**Validation**:
- `amount > 0` 필수
- 과납부 허용 (경고 로그)

---

### 2. 수납 목록 조회

```http
GET /payments?page=1&size=20&start_date=2026-01-01&end_date=2026-01-31
```

**Query Parameters**:
- `page`, `size`
- `start_date`, `end_date`: 수납 일자
- `payment_method`: cash | card | transfer | voucher

**Response** (200):
```json
{
  "items": [
    {
      "id": 1,
      "billable_id": 1,
      "client_name": "김철수",
      "amount": 50000,
      "payment_method": "cash",
      "paid_at": "2026-01-15T14:00:00Z",
      "receipt_number": "C001-202601-00001"
    }
  ],
  "total": 1,
  "page": 1,
  "size": 20
}
```

---

### 3. 청구서별 수납 내역

```http
GET /billables/{billable_id}/payments
```

**Response** (200):
```json
{
  "billable_id": 1,
  "total_amount": 150000,
  "paid_amount": 150000,
  "payments": [
    {
      "id": 1,
      "amount": 50000,
      "payment_method": "cash",
      "paid_at": "2026-01-15T14:00:00Z",
      "receipt_number": "C001-202601-00001"
    },
    {
      "id": 2,
      "amount": 100000,
      "payment_method": "transfer",
      "paid_at": "2026-01-20T10:00:00Z",
      "receipt_number": "C001-202601-00002"
    }
  ]
}
```

---

## Voucher (바우처 관리)

### 1. 바우처 정책 목록

```http
GET /vouchers/policies?is_active=true
```

**Response** (200):
```json
{
  "items": [
    {
      "id": 1,
      "center_id": 1,
      "name": "아동청소년심리지원 서비스",
      "code": "CHILD_PSYCH_2024",
      "support_ratio": 0.8,
      "max_sessions_per_month": 4,
      "valid_from": "2024-01-01",
      "valid_until": null,
      "is_active": true
    }
  ]
}
```

**특징**:
- **센터별 관리**: 각 센터가 자체 바우처 정책 생성/수정
- SaaS 팀은 정책 템플릿만 제공 (선택 사항)

---

### 2. 바우처 정책 생성

```http
POST /vouchers/policies
```

**Request**:
```json
{
  "name": "아동청소년심리지원 서비스",
  "code": "CHILD_PSYCH_2024",
  "support_ratio": 0.8,
  "max_sessions_per_month": 4,
  "valid_from": "2024-01-01",
  "valid_until": null
}
```

**Response** (201):
```json
{
  "id": 1,
  "center_id": 1,
  "name": "아동청소년심리지원 서비스",
  "code": "CHILD_PSYCH_2024",
  "support_ratio": 0.8,
  "max_sessions_per_month": 4,
  "valid_from": "2024-01-01",
  "valid_until": null,
  "is_active": true,
  "created_at": "2026-01-10T10:00:00Z"
}
```

**Validation**:
- `code` 중복 체크 (같은 센터 내)
- `support_ratio` 0.0 ~ 1.0 범위

---

### 3. 바우처 정책 수정

```http
PUT /vouchers/policies/{id}
```

**Request**:
```json
{
  "support_ratio": 0.85,
  "max_sessions_per_month": 5
}
```

**Response** (200):
```json
{
  "id": 1,
  "support_ratio": 0.85,
  "max_sessions_per_month": 5,
  "updated_at": "2026-01-15T10:00:00Z"
}
```

**Note**: 기존 ClientVoucher는 영향 없음 (snapshot)

---

### 4. 내담자 바우처 조회

```http
GET /vouchers/clients/{client_id}
```

**Response** (200):
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

### 5. 내담자 바우처 등록

```http
POST /vouchers/clients
```

**Request**:
```json
{
  "client_id": 60,
  "voucher_policy_id": 1,
  "total_sessions": 10,
  "started_at": "2026-01-01",
  "expires_at": "2026-06-30",
  "notes": "2026년 상반기 지원"
}
```

**Response** (201):
```json
{
  "id": 10,
  "center_id": 1,
  "client_id": 60,
  "voucher_policy_id": 1,
  "total_sessions": 10,
  "used_sessions": 0,
  "remaining_sessions": 10,
  "started_at": "2026-01-01",
  "expires_at": "2026-06-30",
  "is_active": true
}
```

**Validation**:
- 중복 체크 (동일 정책 활성 바우처)
- voucher_policy_id 활성화 체크

---

### 4. 바우처 청구 생성

```http
POST /billables
```

**Request**:
```json
{
  "client_id": 52,
  "billable_date": "2026-01-15",
  "items": [
    {
      "item_type": "voucher",
      "description": "아동청소년심리지원 상담 (1회기)",
      "unit_price": 100000,
      "quantity": 1,
      "voucher_policy_id": 1
    }
  ]
}
```

**비즈니스 로직**:
1. ClientVoucher 잔여 횟수 체크
2. 월별 사용 한도 체크
3. 바우처 금액 자동 계산
   - `voucher_amount = unit_price × support_ratio`
   - `self_pay_amount = unit_price - voucher_amount`
4. `used_sessions += 1` 자동 차감

**Response** (201):
```json
{
  "id": 3,
  "items": [
    {
      "id": 3,
      "item_type": "voucher",
      "unit_price": 100000,
      "voucher_amount": 80000,
      "self_pay_amount": 20000
    }
  ]
}
```

**Errors**:
- `400`: 잔여 횟수 부족
- `400`: 월별 한도 초과
- `400`: 바우처 만료

---

### 5. 일괄 청구 생성

```http
POST /billables/batch
```

**Request**:
```json
{
  "client_ids": [50, 51, 52],
  "period_start": "2026-01-01",
  "period_end": "2026-01-31",
  "include_services": ["counseling", "assessment"],
  "auto_issue": false
}
```

**비즈니스 로직**:
1. 기간 내 완료된 서비스 조회 (client_id IN ...)
2. 내담자별로 Billable 생성
3. 각 서비스마다 BillableItem 추가
4. PriceList 자동 조회 및 단가 적용
5. 바우처 자동 계산 및 적용
6. draft 상태로 생성 (auto_issue=false)

**Response** (201):
```json
{
  "total_billables": 3,
  "total_items": 12,
  "total_amount": 2400000,
  "billable_ids": [1, 2, 3]
}
```

**Validation**:
- `client_ids` 최소 1개 필수
- `period_start` < `period_end`
- 센터 소유권 체크 (모든 client_id)

---

## PriceList (단가표 관리)

### 1. 단가표 목록 조회

```http
GET /price-lists?service_type=counseling&is_active=true
```

**Query Parameters**:
- `service_type`: counseling | assessment | package
- `is_active`: true | false

**Response** (200):
```json
{
  "items": [
    {
      "id": 1,
      "center_id": 1,
      "service_type": "counseling",
      "service_name": "개인상담",
      "unit_price": 100000,
      "is_active": true,
      "created_at": "2026-01-10T10:00:00Z"
    }
  ],
  "total": 1
}
```

---

### 2. 단가 생성

```http
POST /price-lists
```

**Request**:
```json
{
  "service_type": "counseling",
  "service_name": "개인상담",
  "unit_price": 100000,
  "notes": "성인 개인상담 표준 단가"
}
```

**Response** (201):
```json
{
  "id": 1,
  "center_id": 1,
  "service_type": "counseling",
  "service_name": "개인상담",
  "unit_price": 100000,
  "is_active": true,
  "notes": "성인 개인상담 표준 단가",
  "created_at": "2026-01-10T10:00:00Z"
}
```

**Validation**:
- `service_name` 중복 체크 (같은 센터 내)
- `unit_price > 0` 필수

---

### 3. 단가 수정

```http
PUT /price-lists/{id}
```

**Request**:
```json
{
  "unit_price": 120000,
  "notes": "2026년 인상 단가"
}
```

**Response** (200):
```json
{
  "id": 1,
  "unit_price": 120000,
  "notes": "2026년 인상 단가",
  "updated_at": "2026-01-15T10:00:00Z"
}
```

**Note**: 기존 청구서는 영향 없음 (snapshot)

---

### 4. 단가 삭제 (비활성화)

```http
DELETE /price-lists/{id}
```

**Response** (200):
```json
{
  "id": 1,
  "is_active": false
}
```

**Note**: 실제 삭제 아님, is_active = false로 변경

---

## Report (리포트)

### 1. 매출 리포트

```http
GET /reports/revenue?start_date=2026-01-01&end_date=2026-01-31
```

**Response** (200):
```json
{
  "period": {
    "start_date": "2026-01-01",
    "end_date": "2026-01-31"
  },
  "summary": {
    "total_billed": 5000000,
    "total_paid": 4500000,
    "total_unpaid": 500000
  },
  "by_type": [
    {
      "item_type": "service",
      "count": 50,
      "amount": 3000000
    },
    {
      "item_type": "voucher",
      "count": 30,
      "amount": 2000000
    }
  ],
  "by_payment_method": [
    {
      "payment_method": "cash",
      "count": 20,
      "amount": 2000000
    },
    {
      "payment_method": "card",
      "count": 15,
      "amount": 1500000
    }
  ]
}
```

---

### 2. 미수금 리포트

```http
GET /reports/unpaid
```

**Response** (200):
```json
{
  "summary": {
    "total_unpaid": 500000,
    "overdue_count": 3,
    "overdue_amount": 200000
  },
  "by_client": [
    {
      "client_id": 50,
      "client_name": "김철수",
      "unpaid_amount": 200000,
      "oldest_billable_date": "2025-12-15"
    }
  ]
}
```

---

## 에러 응답

### 표준 에러 형식

```json
{
  "detail": {
    "code": "VOUCHER_EXHAUSTED",
    "message": "바우처 잔여 횟수가 부족합니다",
    "remaining_sessions": 0,
    "voucher_id": 5
  }
}
```

### 주요 에러 코드

| 코드 | HTTP | 설명 |
|------|------|------|
| VOUCHER_EXHAUSTED | 400 | 바우처 잔여 횟수 부족 |
| MONTHLY_LIMIT_EXCEEDED | 400 | 월별 사용 한도 초과 |
| VOUCHER_EXPIRED | 400 | 바우처 유효기간 만료 |
| DUPLICATE_VOUCHER | 400 | 중복 바우처 등록 |
| OVERPAYMENT | 400 | 과납부 (방안 A 선택 시) |
| BILLABLE_NOT_ISSUED | 400 | 발행되지 않은 청구서 |
| ALREADY_PAID | 400 | 이미 완납된 청구서 |
| CANNOT_DELETE_ISSUED | 400 | 발행된 청구서 수정 불가 |

---

## Webhook (Phase 2)

### 1. 완납 알림

```http
POST {webhook_url}
```

**Payload**:
```json
{
  "event": "billable.paid",
  "billable_id": 1,
  "center_id": 1,
  "client_id": 50,
  "total_amount": 150000,
  "paid_at": "2026-01-20T10:00:00Z"
}
```

---

## 참고 문서

- **도메인 설계**: `/docs/payment/domain.md`
- **시나리오**: `/docs/payment/scenarios.md`
- **Summary**: `/docs/payment/summary.md`
