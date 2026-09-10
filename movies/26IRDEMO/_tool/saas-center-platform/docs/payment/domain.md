# Payment 도메인 설계

> B2C 회계 관리: 센터 → 내담자 수납/청구 시스템

---

## 설계 철학

### 1. 유연성 우선
- **센터마다 운영방식이 다름**: 모든 경우를 유연하게 지원
- **가격 결정 시점 자유**: 서비스 제공 시점 ≠ 청구 시점
- **수동/자동 혼용**: 단가표 OR 수동 입력 모두 지원

### 2. 3-Phase 전략
- **Phase 1**: 필수 기능 (데이터 축적 목적)
- **Phase 2**: 축적 데이터 활용 (자동화)
- **Phase 3**: 고급 기능 (예측/분석)

### 3. 경쟁사 검증
- **에피(300+ 센터)** 기능셋 기준
- POS 연동 불필요 (경쟁사 전무)
- 한국 특화 기능 포함 (바우처)

---

## Phase 1: Essential (현재 설계 범위)

### 핵심 목표
1. **서비스 완료 → 자동 청구 생성** (핵심 워크플로우)
2. 미수금 추적 (핵심 pain point)
3. 단가표 기반 가격 관리
4. 바우처 자동 계산
5. 일괄 청구 (월말 청구)

### 엔티티 구조

```
PriceList (단가표)
  ↓ 참조
Billable (청구서) ← 자동 생성 (CounselingSession/Assessment 완료 시)
  ↓ 1:N
BillableItem (청구 항목)

Payment (수납 기록)
  ↓ N:1
Billable

VoucherPolicy (바우처 정책) - 센터 관리
  ↓ 1:N
ClientVoucher (내담자 바우처)
  ↓ 사용
BillableItem (바우처 적용)
```

---

## 엔티티 상세

### 1. Billable (청구서)

**목적**: 서비스 그룹 단위 청구 관리

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| center_id | int | FK (센터) |
| client_id | int | FK (내담자) |
| billable_date | date | 청구 일자 |
| total_amount | int | 총 청구 금액 (계산) |
| paid_amount | int | 납부 금액 (계산) |
| unpaid_amount | int | 미수금 (계산) |
| status | str | draft/issued/paid/overdue (4가지만) |
| issued_at | datetime | 발행 시각 |
| due_date | date | 납부 기한 (nullable) |
| notes | str | 메모 (nullable) |
| created_at | datetime | 생성 시각 |
| updated_at | datetime | 수정 시각 |

**상태 전이**:
```
draft (임시) → issued (발행) → paid (완납)
                           ↘ overdue (연체)
```

**NOTE**: `cancelled` 상태는 Phase 1에서 제외. 음수 청구서로 상계 처리.

**계산 필드**:
- `total_amount = SUM(BillableItem.amount)` (음수 가능 - 환불 청구서)
- `paid_amount = SUM(Payment.amount)` (과납부 시 total_amount 초과 가능)
- `unpaid_amount = total_amount - paid_amount` (음수 = 과납부)

**특징**:
- 여러 서비스를 하나의 청구서로 묶기 가능
- 센터가 청구 시점 결정 (즉시 OR 월말 등)
- `due_date` nullable: 센터 선택 (기한 관리 OR 미관리)
- 과납부 허용: `paid_amount > total_amount` 가능 (경고 로그)

---

### 2. BillableItem (청구 항목)

**목적**: 개별 서비스/제품 청구 상세

**위치**: `billable/` 서브모듈 (Billable과 강한 결합)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| billable_id | int | FK (Billable) |
| item_type | str | service/product/voucher/package |
| item_id | int | 서비스 ID (nullable) |
| description | str | 항목 설명 (예: "ADHD 검사") |
| quantity | int | 수량 (기본 1, 양수만) |
| unit_price | int | 단가 (음수 가능 - 환불/차액) |
| amount | int | 금액 (quantity × unit_price, 음수 가능) |
| voucher_policy_id | int | FK (VoucherPolicy, nullable) |
| voucher_amount | int | 바우처 지원금 (기본 0) |
| self_pay_amount | int | 자기부담금 (계산) |
| provided_at | datetime | 서비스 제공 일시 (nullable) |
| notes | str | 메모 (nullable) |
| created_at | datetime | 생성 시각 |

**item_type 구분**:
- `service`: 상담/검사 서비스
- `product`: 물품 판매 (optional)
- `voucher`: 바우처 서비스
- `package`: 이용권 (Phase 2)

**계산 필드**:
- `amount = quantity × unit_price`
- `self_pay_amount = amount - voucher_amount`

**특징**:
- `item_id`: Assessment/CounselingSession 참조 (nullable - 수동 입력 지원)
- `provided_at`: 서비스 제공 일시 ≠ 청구 일시 (과거 서비스 청구 가능)
- Billable 없이 존재 불가 (CASCADE DELETE)
- **음수 금액 허용**: `unit_price < 0` 가능 (환불/차액 조정), notes 권장
- **수정 불가**: draft 상태에서도 수정 API 없음, 삭제 후 재생성만

---

### 3. Payment (수납 기록)

**목적**: 실제 수납 처리 기록

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| billable_id | int | FK (Billable) |
| amount | int | 수납 금액 |
| payment_method | str | cash/card/transfer/voucher |
| paid_at | datetime | 수납 일시 |
| receipt_number | str | 영수증 번호 (nullable) |
| notes | str | 메모 (nullable) |
| created_at | datetime | 생성 시각 |

**payment_method**:
- `cash`: 현금
- `card`: 카드
- `transfer`: 계좌이체
- `voucher`: 바우처 (정부 지원금)

**영수증 번호**:
- **Phase 1**: nullable (센터가 수동 입력 또는 빈 값)
- **Phase 2**: 자동 생성 옵션 제공 (원하는 센터만)

**특징**:
- 부분 납부 지원 (여러 Payment → 1 Billable)
- 다양한 결제 수단 혼용 가능
- 수납 후 Billable.paid_amount 자동 갱신
- **draft 청구서 수납 시**: 자동으로 issued 상태 전환
- 삭제 불가 (수정만 가능, audit trail)

---

### 4. VoucherPolicy (바우처 정책)

**목적**: 정부 지원금 정책 관리 (센터별)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| center_id | int | FK (센터) |
| name | str | 바우처명 (예: "아동청소년심리지원") |
| code | str | 사업 코드 (예: "CHILD_PSYCH_2024") |
| support_ratio | float | 지원 비율 (0.8 = 80%) |
| max_sessions_per_month | int | 월 이용 한도 (nullable) |
| unit_price | int | 회기당 지원금액 (nullable) |
| is_active | bool | 활성화 여부 |
| valid_from | date | 유효 시작일 |
| valid_until | date | 유효 종료일 (nullable) |
| description | str | 설명 (nullable) |
| created_at | datetime | 생성 시각 |
| updated_at | datetime | 수정 시각 |

**특징**:
- **센터별 관리**: 각 센터가 직접 바우처 정책 생성/수정
- SaaS 팀은 정책 템플릿만 제공 (선택 사항)
- 센터별 상황에 맞게 지원 비율/한도 조정 가능
- `code`: 센터 내 구분용 (예: CHILD_PSYCH_2024)

**주요 바우처**:
- 아동청소년심리지원 서비스 (80% 지원)
- 발달재활서비스 (80% 지원)
- 청소년 특별지원 (100% 지원)

---

### 5. ClientVoucher (내담자 바우처)

**목적**: 내담자별 바우처 사용 내역

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| center_id | int | FK (센터) |
| client_id | int | FK (내담자) |
| voucher_policy_id | int | FK (VoucherPolicy) |
| total_sessions | int | 총 지원 횟수 |
| used_sessions | int | 사용 횟수 (계산) |
| remaining_sessions | int | 잔여 횟수 (계산) |
| started_at | date | 지원 시작일 |
| expires_at | date | 지원 종료일 |
| is_active | bool | 활성화 여부 |
| notes | str | 메모 (nullable) |
| created_at | datetime | 생성 시각 |
| updated_at | datetime | 수정 시각 |

**계산 필드**:
- `used_sessions`: BillableItem (item_type=voucher, voucher_policy_id 일치) 개수
- `remaining_sessions = total_sessions - used_sessions`

**특징**:
- BillableItem 생성 시 자동 차감
- 월별 사용 한도 체크 (VoucherPolicy 기준)
- 한 내담자가 여러 바우처 동시 보유 가능
- 유효기간 만료 시 자동 비활성화

---

### 6. PriceList (단가표)

**목적**: 센터별 서비스 단가 관리

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| center_id | int | FK (센터) |
| service_type | str | counseling/assessment/package |
| service_name | str | 서비스명 (예: "ADHD 검사", "개인상담") |
| unit_price | int | 단가 (원) |
| is_active | bool | 활성화 여부 |
| notes | str | 메모 (nullable) |
| created_at | datetime | 생성 시각 |
| updated_at | datetime | 수정 시각 |

**특징**:
- **센터별 자유 설정**: 각 센터가 자체 단가표 관리
- **서비스 유형 분류**: 상담/검사/패키지 구분
- **청구 시 참조**: BillableItem 생성 시 단가 자동 입력
- **가격 히스토리**: 단가 변경 시 기존 청구는 영향 없음 (snapshot)

**사용 예시**:
```python
# 단가표 조회
price = PriceList.filter(
    center_id=1,
    service_type="counseling",
    service_name="개인상담",
    is_active=True
).first()

# 청구 항목 생성 시 단가 자동 적용
BillableItem(
    description="개인상담 (1회기)",
    unit_price=price.unit_price,  # 단가표에서 자동 적용
    quantity=1
)
```

---

## 자동 청구 워크플로우

### 서비스 완료 → 청구 자동 생성

**트리거**:
- `CounselingSession.status = "completed"` 전환 시
- `Assessment.status = "completed"` 전환 시

**워크플로우**:
```
1. Service 완료 이벤트 발생
   → CounselingSessionCompleted
   → AssessmentCompleted

2. Payment 모듈 이벤트 핸들러 실행
   → create_billable_from_service()

3. PriceList 조회
   → 해당 서비스의 단가 자동 조회
   → 없으면 기본 단가 사용 또는 수동 입력 필요 알림

4. Billable + BillableItem 자동 생성
   → status = "draft"
   → 센터 직원이 검토 후 발행

5. 센터 알림
   → "새 청구서 초안이 생성되었습니다"
```

**구현 위치**: `app/application/handlers/create_billable_from_service.py`

**Phase 1 제약**:
- 자동 생성은 draft 상태로만
- 센터 직원이 검토 후 수동 발행 필요
- Phase 2에서 "자동 발행" 옵션 추가 예정

---

## 일괄 청구 (Batch Billing)

### 월말 일괄 청구 시나리오

**시나리오**: 20명 내담자 × 4회기 = 80개 항목을 한 번에 청구

**API 엔드포인트**:
```http
POST /billables/batch
```

**Request**:
```json
{
  "client_ids": [1, 2, 3, ...],
  "period_start": "2026-01-01",
  "period_end": "2026-01-31",
  "include_services": ["counseling", "assessment"],
  "auto_issue": false  // true면 자동 발행, false면 draft
}
```

**비즈니스 로직**:
1. 기간 내 완료된 서비스 조회 (client_id IN ...)
2. 내담자별로 Billable 생성
3. 각 서비스마다 BillableItem 추가
4. PriceList 자동 조회 및 단가 적용
5. 바우처 자동 계산 및 적용
6. draft 상태로 생성 (auto_issue=false)

**Response**:
```json
{
  "total_billables": 20,
  "total_items": 80,
  "total_amount": 16000000,
  "billable_ids": [1, 2, 3, ...]
}
```

**Phase 1 제약**:
- 센터 직원이 각 청구서 검토 필요
- 일괄 발행은 Phase 2 예정

---

## 모듈 구조

```
app/modules/payment/
├── __init__.py
├── router.py                    # Main router

├── billable/                    # Sub-Module: 청구 관리
│   ├── __init__.py
│   ├── models.py               # Billable + BillableItem
│   ├── schemas.py              # BillableCreate, BillableItemCreate, ...
│   ├── repository.py           # BillableRepository + BillableItemRepository
│   ├── services/
│   │   ├── __init__.py
│   │   ├── create_billable.py  # 청구서 생성
│   │   ├── add_item.py         # 청구 항목 추가
│   │   └── update_status.py    # 상태 업데이트
│   ├── handlers/
│   │   ├── __init__.py
│   │   ├── create_billable.py      # POST /billables
│   │   ├── add_item_handler.py     # POST /billables/{id}/items
│   │   └── get_billables.py        # GET /billables
│   └── router.py

├── payment/                     # Sub-Module: 수납 관리
│   ├── __init__.py
│   ├── models.py               # Payment
│   ├── schemas.py
│   ├── repository.py
│   ├── services/
│   │   ├── __init__.py
│   │   └── process_payment.py  # 수납 처리 + Billable 업데이트
│   ├── handlers/
│   │   ├── __init__.py
│   │   └── create_payment.py   # POST /payments
│   └── router.py

├── voucher/                     # Sub-Module: 바우처 관리
│   ├── __init__.py
│   ├── models.py               # VoucherPolicy + ClientVoucher
│   ├── schemas.py
│   ├── repository.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── calculate_voucher.py    # 바우처 금액 계산
│   │   └── deduct_session.py       # 사용 횟수 차감
│   ├── handlers/
│   │   ├── __init__.py
│   │   ├── get_policies.py         # GET /vouchers/policies
│   │   └── get_client_voucher.py   # GET /vouchers/clients/{id}
│   └── router.py

├── price_list/                  # Sub-Module: 단가표 관리
│   ├── __init__.py
│   ├── models.py               # PriceList
│   ├── schemas.py
│   ├── repository.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── create_price.py         # 단가 생성
│   │   └── get_price.py            # 단가 조회
│   ├── handlers/
│   │   ├── __init__.py
│   │   ├── create_price.py         # POST /price-lists
│   │   └── get_prices.py           # GET /price-lists
│   └── router.py

└── report/                      # Sub-Module: 리포트 (Phase 1 최소)
    ├── __init__.py
    ├── schemas.py
    ├── services/
    │   ├── __init__.py
    │   └── generate_revenue_report.py
    ├── handlers/
    │   ├── __init__.py
    │   └── get_revenue_report.py   # GET /reports/revenue
    └── router.py
```

---

## API 엔드포인트

### Billable (청구 관리)
```
POST   /billables                    # 청구서 생성
POST   /billables/batch              # 일괄 청구 생성 (월말 청구)
GET    /billables                    # 청구 목록 조회
GET    /billables/{id}               # 청구 상세 조회
PUT    /billables/{id}/status        # 상태 변경 (draft→issued→paid)
GET    /billables/unpaid             # 미수금 목록
POST   /billables/{id}/items         # 청구 항목 추가
DELETE /billables/{id}/items/{item_id}  # 청구 항목 삭제 (draft만)
```

### Payment (수납 관리)
```
POST   /payments                     # 수납 처리
GET    /payments                     # 수납 목록 조회
GET    /billables/{id}/payments      # 청구서별 수납 내역
```

### Voucher (바우처 관리)
```
GET    /vouchers/policies            # 바우처 정책 목록
POST   /vouchers/policies            # 바우처 정책 생성 (센터)
PUT    /vouchers/policies/{id}       # 바우처 정책 수정
GET    /vouchers/clients/{client_id} # 내담자 바우처 조회
POST   /vouchers/clients             # 내담자 바우처 등록
PUT    /vouchers/clients/{id}        # 바우처 정보 수정
```

### PriceList (단가표 관리)
```
GET    /price-lists                  # 단가표 목록 조회
POST   /price-lists                  # 단가 생성
PUT    /price-lists/{id}             # 단가 수정
DELETE /price-lists/{id}             # 단가 삭제 (비활성화)
```

### Report (리포트)
```
GET    /reports/revenue              # 매출 리포트
GET    /reports/unpaid               # 미수금 리포트
```

---

## Phase 2 Preview (향후 확장)

### 추가 엔티티
- **Package (이용권)**: 10회, 20회 패키지 관리
- **PackageUsage**: 이용권 사용 내역
- **StaffSettlement**: 상담사 정산

### 추가 기능
- 이용권 자동 회기 차감
- 상담사별 정산 자동 계산
- 환불 처리 (Refund 엔티티)
- 월별/분기별 분석

---

## Phase 3 Preview (고급 기능)

### 추가 기능
- 위약금 관리 (노쇼/취소)
- 정산 대사 (reconciliation)
- 외부 회계 프로그램 연동 (API)
- 매출 예측 분석

---

## 설계 원칙

### 1. 유연성
- ✅ 단가표 기반 OR 수동 입력
- ✅ 즉시 청구 OR 월말 청구
- ✅ 서비스 참조 OR 직접 입력
- ✅ 부분 납부 지원

### 2. 자동화 (최소한)
- ✅ 바우처 금액 자동 계산
- ✅ 미수금 자동 계산
- ✅ 잔여 횟수 자동 차감
- ✅ 총액 자동 집계

### 3. 데이터 축적
- ✅ provided_at: 서비스 제공 일시 기록
- ✅ item_type: 서비스 유형 분류
- ✅ payment_method: 결제 수단 분류
- → Phase 2/3에서 활용

### 4. 단순성
- ✅ POS 연동 없음 (경쟁사 검증)
- ✅ 복잡한 할인/프로모션 없음 (Phase 1)
- ✅ 정산 대사 없음 (Phase 1)

---

## 제약 사항

### 기술적 제약
- POS 연동 불가 (센터마다 다름)
- 외부 회계 연동 Phase 3

### 비즈니스 제약
- 센터마다 운영방식 상이 → 유연성 최우선
- 바우처 정책 변경 빈번 → 시스템 관리
- 미수금 추적 핵심 → 상태 관리 강화

---

## 주요 비즈니스 규칙

### 청구서 상태 관리
1. **draft**: 항목 추가/삭제 가능 (수정 불가, 삭제 후 재생성)
2. **issued**: 항목 추가/삭제/수정 모두 불가
3. **paid**: 완납 시 자동 전환 (`paid_amount >= total_amount`)
4. **overdue**: 납부 기한 초과 시 자동 전환 (배치)
5. **cancelled 없음**: 음수 청구서로 상계 처리

### 수납 처리
1. **draft 수납 시 자동 발행**: `status="draft"` → `status="issued"` 자동 전환
2. **과납부 허용**: `paid_amount > total_amount` 가능 (경고 로그)
3. **부분 납부**: 여러 Payment로 나누어 납부 가능
4. **영수증 자동 생성**: `{center_code}-{YYYYMM}-{seq:05d}` 형식

### 음수 금액 (환불/차액)
1. **unit_price < 0 허용**: 환불, 차액 조정, 과청구 수정
2. **notes 권장**: 음수 금액 사유 기록 권장
3. **total_amount < 0 가능**: 환불 청구서
4. **item_type 유지**: refund 타입 없음, 기존 타입 + 음수 금액

### BillableItem 수정 정책
1. **수정 API 없음**: PUT 엔드포인트 제공 안 함
2. **삭제 후 재생성**: draft 상태에서만 DELETE → POST
3. **issued 이후 불가**: 발행 후 항목 변경 불가

### 바우처 관리
1. BillableItem (item_type=voucher) 생성 시 ClientVoucher.used_sessions 자동 증가
2. remaining_sessions < 1 시 바우처 사용 불가
3. 월별 사용 한도 체크 (VoucherPolicy.max_sessions_per_month)
4. 유효기간 만료 시 자동 비활성화 (배치)

---

## 참고 문서

- **의사결정 기록**: `/docs/payment/decision-log.md`
- **경쟁사 분석**: `/docs/payment/competitor-analysis.md`
- **시나리오**: `/docs/payment/scenarios.md`
- **엣지 케이스**: `/docs/payment/edge-cases.md`
