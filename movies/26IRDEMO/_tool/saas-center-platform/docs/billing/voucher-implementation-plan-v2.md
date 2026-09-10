# 바우처 구현 설계서 V2 — 정보 제공 + billing 가계부 모델

> **현재 정답 문서**. 본 문서가 voucher 도메인의 P1 구현 설계의 단일 진실 출처(SSOT)다.
> 2026-05-18 실무자 인터뷰 결과 자동화를 빼고 단순화한 V2.
>
> **이전 문서들**:
> - [`voucher-implementation-plan.md`](./voucher-implementation-plan.md) — 자동 차감·자동 청구·환불 rollback 등 무거운 자동화 포함한 원안. **P3 이후 검토 자료로 보존**, P1 구현 기준이 아님
> - [`voucher-client-integration-plan.md`](./voucher-client-integration-plan.md) — Q1·Q2 결정사항은 본 문서 §4에 흡수. Q3~Q9는 본 문서에서 단순화로 자동 해소
> - [`voucher-integration-plan.md`](./voucher-integration-plan.md) — billing 측 변경 근거 자료로 보존

> **상위 문서**:
> - 사업 기획: [`docs/voucher/voucher-plan.md`](../voucher/voucher-plan.md)
> - 31종 바우처 결제·정산 흐름: [`docs/voucher/voucher_usage_report.html`](../voucher/voucher_usage_report.html)
> - billing 마이그레이션 현황: [`billing-improvement-plan.md`](./billing-improvement-plan.md) (Phase 1~3.5 완료)

---

## 0. 작성 배경 (2026-05 피보)

### 0-1. 원안의 문제

`voucher-implementation-plan.md` 원안은 다음을 가정했다:
- 세션 완료 시 자동 회기 차감
- 자동 Billable 생성 + Payment(voucher) 생성
- 환불 시 음수 Payment rollback
- 케이스 ↔ 바우처 1:N 매핑 (CaseVoucher)
- 차감 정합성 감사

이 가정의 전제는 "우리 시스템이 바우처 차감·청구의 1차 출처"였다. 그러나 [31종 바우처 결제 흐름 조사](../voucher/voucher_usage_report.html) 결과:

- 거의 모든 바우처가 **국민행복카드 단말기·정보원 시스템·복지로** 등 외부에서 실제 차감
- 우리는 외부 결제 결과를 사후 기록할 뿐
- 31종이 모두 다른 결제·정산 모델 → 자동화하려면 사업별 분기 폭증
- 차감 자동화가 외부 단말기와 동기화되지 않아 운영자가 두 곳에 입력하는 비효율

### 0-2. 실무자 피드백 (2026-05-18 상담사 인터뷰)

> "모든 바우처 유형을 커버하는 건 무리다. 바우처 정보 제공과, **청구는 billing이 가계부 역할**만 해도 충분히 도움이 된다."

### 0-3. 본 문서의 결정

| 항목 | 결정 |
|---|---|
| voucher 모듈 책임 | **정보 도메인만** — 카탈로그·CenterVoucher·ClientVoucher |
| 차감·청구 | **기존 billing 모듈 그대로 활용** — 운영자가 청구서·결제 수동 입력 |
| 연결 지점 | billing 측에 **소량의 voucher 참조 컬럼**만 추가 (`Payment.client_voucher_id`) |
| 자동화 | 없음. P1에서는 모든 입력이 수동. 자동화는 운영 경험 쌓인 후 별도 기획 |
| billing-improvement-plan 의존성 | **없음** — 환불 인프라(Phase 4) 의존 제거. 독립 배포 가능 |

---

## 1. 한 줄 요약

> **카탈로그(31종 안내) + CenterVoucher(센터 취급 선언) + ClientVoucher(내담자 보유 기록)** 3개 레이어만.
> 차감·청구는 기존 billing의 청구서·결제 등록에 `client_voucher_id` 한 줄 연결로 끝.
> 가계부 역할 = "이번 달 어느 바우처로 얼마 받았나" 조회는 billing의 매출 리포트에 voucher 필터만 추가.

---

## 2. 데이터 모델

```
┌─────────────────────────────────────────────────────────────┐
│ vouchers (카탈로그, 기존)                                    │
│   사업 안내 메타 — 이름·기관·연도·기간·안내문·자료           │
│   super_admin 관리. 31종 + α                                 │
└─────────────────────────────────────────────────────────────┘
                          │ catalog_id
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ center_vouchers (신규, Phase A)                              │
│   "우리 센터가 이 사업 다룬다" 선언                          │
│   참고용 단가·회기 기록 가능 (필수 아님)                     │
│   center_admin 관리                                          │
└─────────────────────────────────────────────────────────────┘
                          │ center_voucher_id
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ client_vouchers (신규, Phase B)                              │
│   내담자 한 명의 바우처 보유 기록                            │
│   total_sessions / used_sessions / expires_at — 운영자 수동 │
│   접수 담당자 등록                                           │
└─────────────────────────────────────────────────────────────┘
                          │ client_voucher_id (참조)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ billing.Payment (기존, 컬럼 추가)                            │
│   Payment.payment_method = 'voucher' 허용                    │
│   Payment.client_voucher_id 신규 컬럼 nullable               │
│   → "이 결제는 이 바우처에서 차감됨" 가계부 라인             │
└─────────────────────────────────────────────────────────────┘
```

핵심: **CaseVoucher·VoucherUsage 두 레이어 모두 제거**. Payment가 voucher 사용 기록의 단일 출처.

---

## 3. 테이블 설계

### 3-1. `vouchers` (카탈로그, 기존 platform_admin 모듈)

변경 없음. 31종 사업 안내 그대로 활용. (voucher_type 같은 분기 컬럼 불필요 — 모든 사업이 동일하게 정보 안내만 됨)

### 3-2. `center_vouchers` (신규, Phase A)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | UUID PK | |
| `center_id` | UUID | RLS |
| `catalog_id` | UUID | `vouchers.id` 앱레벨 FK |
| `provider_registration_no` | varchar(50) nullable | 제공기관 등록번호 (필요 시) |
| `unit_price` | int nullable | 참고용 단가. 청구는 별도 |
| `default_total_sessions` | int nullable | UI 자동 채움 힌트 |
| `notes` | text nullable | 센터 내부 메모 |
| `is_active` | bool | 취급 여부 |
| `created_at / updated_at / deleted_at` | timestamp | soft delete |

**unique**: `(center_id, catalog_id)` — 같은 사업 중복 등록 방지

**제거된 컬럼** (원안 대비): `support_ratio`, `max_sessions_per_month`, `session_unit_rule`, `assessment_unit_rule`. 모두 자동 차감 로직용이었는데 가계부 모델에서는 불필요. 필요해지면 추후 컬럼 추가.

### 3-3. `client_vouchers` (신규, Phase B)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | UUID PK | |
| `center_id` | UUID | RLS |
| `client_id` | UUID | 내담자 |
| `center_voucher_id` | UUID | 어느 사업의 매핑 |
| `total_sessions` | int nullable | 외부 확인서 기준 |
| `used_sessions` | int default 0 | 우리가 기록한 사용 회기 (billing Payment 합과 일치하면 정상) |
| `started_at` | date nullable | 시작일 |
| `expires_at` | date nullable | 만료일 |
| `status` | varchar(20) | `'active' / 'expired' / 'exhausted' / 'cancelled'` |
| `external_source_note` | text nullable | "복지로 확인서 5/14 수령" 같은 출처 메모 |
| `notes` | text nullable | |
| `created_at / updated_at / deleted_at` | timestamp | |

**제거된 컬럼** (원안 대비): `input_source`, `consent_version`. 동의서·내담자 앱 시나리오는 Phase F 이후로 미룸. `initial_used_sessions` 같은 정합성 컬럼도 불필요 (자동 차감이 없으니 정합성 감사가 단순해짐).

**used_sessions 갱신**:
- 운영자가 billing에 Payment(method='voucher', client_voucher_id=X) 등록하면 `ClientVoucher.used_sessions += sessions_consumed` (보통 1)
- 또는 운영자가 ClientVoucher 직접 수정해서 외부에서 본 잔량으로 동기화

→ "자동" 이지만 단순 로직. 트랜잭션 정합성만 보장하면 됨. 동시성 정합성 감사 같은 무거운 검증은 불필요.

### 3-4. billing 측 변경 (최소)

| 변경 | 위치 | 이유 |
|---|---|---|
| `Payment.payment_method` validator에 `'voucher'` 허용 | `apps/api/app/modules/billing/payment/` | 바우처 결제 분류 |
| `Payment.client_voucher_id` nullable FK 컬럼 추가 | 동일 | 어느 바우처에서 사용했는지 가계부 라인 연결 |
| (선택) `Payment.payment_category` nullable | 동일 | 과세/면세/지원금 분류 — 세무 리포트용. 다른 결제도 채울 수 있음 |

**제거된 항목** (원안 §3-5 대비):
- ~~`BillableItem.voucher_amount`~~ — Item 단위 지원금 분리는 자동 차감 시나리오용. 가계부 모델에서는 Payment 금액 자체가 바우처 결제분
- ~~환불 인프라 (음수 Payment + `create_refund()`)~~ — voucher rollback 자동화 없음. 환불은 billing-improvement-plan 자체 일정 따라감
- ~~`BillableFacade.create_draft_from_session()`~~ — 자동 청구 생성 없음. 운영자가 기존 청구서 추가 흐름 사용

---

## 4. 운영 시나리오

### S1 — 신규 내담자 + 바우처 등록

1. 접수 담당자가 `/clients/new`에서 내담자 기본정보 입력 → 저장
2. `/clients/{id}` 상세 → "바우처" 탭 클릭
3. "바우처 발급" 버튼 → 모달
   - CenterVoucher 선택 (취급중 목록)
   - 총 회기, 시작일, 만료일 입력 (외부 확인서 기준)
   - 외부 출처 메모 (선택)
4. 저장 → ClientVoucher row 생성

> [voucher-client-integration-plan §2 S1](./voucher-client-integration-plan.md#시나리오-s1)과 동일. Q1·Q2 결정 그대로.

### S2 — 세션 진행 + 단말기 결제 + 가계부 기록

1. 상담사가 세션 진행
2. 외부 국민행복카드 단말기에 카드 접촉 → 결제
3. 우리 시스템에서:
   - **방법 A**: 청구 페이지 → "청구 추가" → 내담자 + 항목 선택 → 저장 → "결제 등록" → method='voucher' + client_voucher_id 선택 → 저장
   - **방법 B**: 케이스/세션 상세에서 "청구 생성" 단축 진입 → 동일 흐름
4. ClientVoucher.used_sessions += 1 (Service 레벨에서 Payment 생성 시 자동 갱신)

> 자동화는 (3)에서 운영자가 직접 등록. 단말기 결제와 시스템 입력 사이는 동기화 없음. 운영자가 매 세션 후 입력하거나, 월말에 모아서 일괄 입력.

### S3 — 월별 가계부 조회

기존 billing의 매출 리포트에 "결제 수단" 필터로 `voucher`를 선택하면 그 달의 바우처 매출 자동 집계.

→ 별도 voucher 전용 리포트 페이지 불필요. billing이 곧 가계부.

### S4 — 잔여 회기 조회

내담자 상세 바우처 탭에서:
- `total_sessions - used_sessions = 남은 회기` 표시
- "외부에서 본 잔량과 다를 수 있음" 명시
- 운영자가 "수동 동기화" 버튼으로 외부에서 본 used_sessions 갱신 가능

### S5 — 만료 임박 표시

ClientVoucher.expires_at - today < 30일이면 카드에 D-N 배지. 알림은 Phase E.

### S6 — 차년도 갱신

내담자가 새 연도 바우처 받음 → 새 ClientVoucher row insert. 기존 row는 자연 만료 (status='expired'로 운영자가 수동 전이 or lazy). 별도 renew API 불필요.

> Q3 결정 — 단순 새 row 패턴.

### S7 — 환불

내담자 환불 요청 → 외부 시스템에서 환불 처리 → 우리 시스템에서:
- billing의 환불 흐름이 준비되면 그걸 사용 (billing-improvement-plan Phase 4)
- 그 전에는 운영자가 Payment 삭제 또는 메모 추가로 처리
- ClientVoucher.used_sessions 운영자 수동 감산

> voucher 모듈은 환불 자동화를 만들지 않음. billing이 환불 인프라 만들면 자동으로 voucher 환불도 같이 됨.

---

## 5. API 설계

### 5-1. 어드민 카탈로그 (변경 없음)

```
GET    /admin/vouchers
POST   /admin/vouchers
GET    /admin/vouchers/{id}
PATCH  /admin/vouchers/{id}
DELETE /admin/vouchers/{id}
```

### 5-2. 센터 취급 바우처 (CenterVoucher, Phase A)

```
GET    /centers/{cid}/voucher-catalog              # 카탈로그를 센터 시점에서 조회 (취급 여부 표시)
GET    /centers/{cid}/center-vouchers              # 우리 센터 취급 목록
POST   /centers/{cid}/center-vouchers              # 카탈로그에서 취급 등록
PATCH  /centers/{cid}/center-vouchers/{id}         # 단가·메모 수정
DELETE /centers/{cid}/center-vouchers/{id}         # 취급 해제 (soft)
```

### 5-3. 내담자 바우처 (ClientVoucher, Phase B)

```
GET    /centers/{cid}/clients/{client_id}/vouchers # 내담자 보유 바우처
POST   /centers/{cid}/clients/{client_id}/vouchers # 발급
GET    /centers/{cid}/client-vouchers/{id}         # 상세
PATCH  /centers/{cid}/client-vouchers/{id}         # 정보 수정 (잔여 동기화 포함)
DELETE /centers/{cid}/client-vouchers/{id}         # 취소
```

POST 발급 body:
```json
{
  "center_voucher_id": "uuid",
  "total_sessions": 8,
  "used_sessions": 0,
  "started_at": "2026-05-15",
  "expires_at": "2026-12-31",
  "external_source_note": "복지로 확인서 5/14 수령",
  "notes": "..."
}
```

PATCH 수동 조정 body:
```json
{
  "used_sessions": 3,
  "notes": "외부 시스템에서 본 잔량으로 동기화 (5/30)"
}
```

### 5-4. billing 연동 (Phase B 후반 또는 별도)

기존 billing 결제 등록 API에 추가:
```
POST /centers/{cid}/billables/{id}/payments
```

body 추가 필드:
```json
{
  "amount": 80000,
  "payment_method": "voucher",
  "client_voucher_id": "uuid",       // 신규
  "paid_at": "2026-05-18",
  "notes": "마음투자 4회차"
}
```

**Service 동작**: Payment 생성 시 client_voucher_id가 있으면 `ClientVoucher.used_sessions += 1` (단순 갱신, 정합성 감사 없이). Payment 삭제 시 같이 `-= 1`. 트랜잭션 안에서 처리.

---

## 6. 프론트엔드

### 6-1. 어드민 (`apps/admin/`)
- 카탈로그 등록·수정·자료 첨부 — 기존 그대로
- 변경 없음

### 6-2. 센터 SaaS 설정 — `/settings/vouchers` (Phase A)
- 좌: 31종 카탈로그 목록 (검색·필터)
- 우: 우리 센터 취급 바우처
- 카탈로그에서 클릭 → 모달로 단가·메모 입력 → 취급 등록

### 6-3. 내담자 상세 바우처 탭 (Phase B)
- 보유 바우처 카드 목록
  - 사업명 / 잔여(우리 기록) / 만료일 / 상태 뱃지
  - "외부와 다를 수 있음" 안내
- "바우처 발급" 버튼 → 모달 ([Q2 확정](./voucher-client-integration-plan.md#q2))
- 카드 액션: 잔여 동기화 / 메모 추가 / 취소

### 6-4. 청구 생성 모달 (billing 측 보강, Phase B 후반)
- 결제 수단 Select에 "바우처" 추가
- 선택 시 보유 바우처 드롭다운 노출 → client_voucher_id 입력
- ClientVoucher 만료 임박이면 경고 배지

### 6-5. 매출 리포트 — billing 기존 페이지 활용
- "결제 수단" 필터에 "바우처" 추가만 하면 가계부 뷰 완성

---

## 7. Phase 순서

```
Phase 0: 카탈로그는 그대로 (변경 없음)
   ↓
Phase A: 센터 취급 바우처            (CenterVoucher CRUD)        ~1주
   ↓
Phase B: 내담자 바우처 + billing 연동 (ClientVoucher + Payment FK) ~1.5주
   ↓
Phase E: 운영 보조 (만료 알림·대시보드)                            ~1주 (선택)
```

**제거된 Phase** (원안 대비):
- ~~Phase C (CaseVoucher 매핑)~~
- ~~Phase D (자동 차감 + 자동 청구 + 환불 rollback)~~
- ~~Phase F (월별 청구·재청구)~~ → billing의 매출 리포트로 대체

### Phase A — 센터 취급 바우처 (1주)

- [ ] Alembic: `center_vouchers` 테이블
- [ ] 모델·Repository·Service·Handler
- [ ] API 5-2
- [ ] 프론트 6-2 페이지
- [ ] E2E: 등록 → 수정 → 해제

### Phase B — 내담자 바우처 + billing 연동 (1.5주)

- [ ] Alembic: `client_vouchers` 테이블 + `payments.client_voucher_id` 컬럼
- [ ] `Payment.payment_method` validator에 `'voucher'`
- [ ] voucher 모듈: ClientVoucher CRUD + 잔여 수동 조정
- [ ] billing 모듈: Payment 생성 시 `client_voucher_id`로 ClientVoucher.used_sessions 갱신 (단순 Service 보강)
- [ ] API 5-3, 5-4
- [ ] 프론트 6-3 내담자 탭
- [ ] 프론트 6-4 청구 생성 모달에 바우처 옵션
- [ ] 프론트 6-5 매출 리포트에 바우처 필터
- [ ] E2E: 발급 → 청구·결제 등록 → 잔여 갱신 확인 → 환불(Payment 삭제) → 잔여 복구

### Phase E — 운영 보조 (선택, 1주)

- [ ] 만료 D-30/D-7 알림 (BackgroundTasks)
- [ ] 센터 관리자 "바우처 보유 현황" 대시보드
- [ ] CSV/Excel 내보내기 (수기 청구서 보조)

---

## 8. 모듈 구조

```
apps/api/app/modules/
├── platform_admin/voucher/       # 기존 카탈로그 (변경 없음)
│
├── voucher/                       # 신규 도메인 (단순 모듈)
│   ├── center_voucher/           # Phase A
│   │   ├── models.py
│   │   ├── repository.py
│   │   ├── schemas.py
│   │   ├── services/  # CRUD
│   │   └── handlers/
│   │
│   ├── client_voucher/           # Phase B
│   │   ├── models.py
│   │   ├── repository.py
│   │   ├── schemas.py
│   │   ├── services/
│   │   │   ├── issue.py
│   │   │   ├── adjust_used_sessions.py
│   │   │   ├── cancel.py
│   │   │   └── increment_used_on_payment.py  # billing Payment 생성 시 호출
│   │   └── handlers/
│   │
│   └── facade/
│       ├── center_voucher_facade.py
│       └── client_voucher_facade.py
│       └── voucher_facade.py    # 통합 입구 (billing이 호출)
│
└── billing/
    └── payment/                  # client_voucher_id 컬럼 + voucher method
        └── services/create_payment.py  # voucher_facade.increment_used 호출
```

**모듈 의존성**:
- billing → voucher (Facade 호출): Payment 생성 시 `VoucherFacade.increment_used_sessions(client_voucher_id, delta=1)`
- voucher → billing (Facade 호출 없음): voucher 모듈은 billing 모름

**CaseVoucher / VoucherUsage 모듈 없음**.

---

## 9. 운영 원칙

| 원칙 | 의미 |
|---|---|
| **billing이 가계부** | 바우처 사용 기록의 단일 출처는 billing.Payment. voucher 모듈은 정보 도메인만 |
| **자동화 없음** | 모든 입력은 운영자가 수동. 자동 차감·자동 청구 생성·자동 환불 없음 |
| **단순 잔여 갱신** | Payment 생성 시 ClientVoucher.used_sessions += 1. 동시성 정합성 감사 없음 (트랜잭션만 보장) |
| **외부와 다를 수 있음** | 우리 기록 ≠ 외부 시스템 잔량. UI에 명시. 운영자가 필요 시 수동 동기화 |
| **billing 환불 따라감** | voucher 환불 자동화 없음. billing Phase 4 환불 인프라 완성되면 자동으로 voucher도 적용 |
| **31종 동일 모델** | voucher_type 분기 없음. 모든 바우처가 같은 흐름으로 정보 안내 + 가계부 기록 |
| **Payment.client_voucher_id 단일 FK** | 한 Payment는 한 바우처에서만 차감. "두 바우처 분할 사용"이 발생하면 Payment 2건으로 분리. 별도 매핑 테이블 불필요 |
| **잔여 갱신 = 하이브리드** | 디폴트: Payment 생성 시 `used_sessions += 결제 시 입력한 차감 회기 수 (default 1)`. 추가: ClientVoucher 카드에 "외부 잔량으로 동기화" 액션 별도 제공. 두 메커니즘 공존 |
| **보호자 동반 = 경고만, 차단 X** | Payment.client_voucher_id의 client_id ≠ billable.client_id 케이스 허용. 청구 모달은 디폴트로 청구 대상의 바우처만 노출하되, "다른 내담자 바우처에서 차감" 토글로 확장 가능 |

---

## 10. Open Questions

자동화를 다 빼서 결정해야 할 게 거의 없음.

### 10-1. 해소된 항목 (§9로 이관)
- ~~`Payment.client_voucher_id` 단일 FK 충분한가~~ → §9 단일 FK 확정. 분할 사용은 Payment 2건으로 표현
- ~~잔여 갱신 자동 vs 수동~~ → §9 하이브리드 확정. 자동 디폴트 + 수동 동기화 액션 공존
- ~~자녀 바우처 보호자 동반 UX~~ → §9 경고 + 토글 확정

### 10-2. 착수 전 추가 토론 필요
1. **잔여 동기화 UX 디테일** — "외부 잔량으로 동기화" 액션에 사유 메모 필수? 이력 보존? (Phase B 디자인 시 결정)
2. **만료 임박 D-day 기준** — D-30 / D-7 두 단계 알림? D-14만? (Phase E 알림 작업 시 결정)
3. **CenterVoucher 비활성화 시 ClientVoucher 어떻게 되나** — 센터가 사업 취급 중단해도 기존 발급 ClientVoucher는 active 유지? (Phase A 검증 시 결정)

---

## 12. 구현 진행 상황 (2026-05-18 기준)

### 12-1. Phase A — 센터 취급 바우처 ✅ 완료

**골인선 달성**: 센터 관리자가 어드민 카탈로그를 보고 "우리 센터 취급" 등록 가능. 사이드바 메뉴 연결까지 완료. **실제 브라우저 동작 검증은 아직**.

#### 백엔드 (apps/api)

| 항목 | 파일 |
|---|---|
| 권한 enum 추가 | `app/core/permissions.py` — `READ_VOUCHER / WRITE_VOUCHER / DELETE_VOUCHER` |
| 모델 | `app/modules/voucher/center_voucher/models.py` (CenterVoucher) |
| Repository | `app/modules/voucher/center_voucher/repository.py` (list / get_active / find_by_catalog_id) |
| Schemas | `app/modules/voucher/center_voucher/schemas.py` (Create/Update/Response/List + VoucherCatalogItem) |
| Services (6개) | `services/create_center_voucher.py`, `list_center_vouchers.py`, `get_center_voucher.py`, `update_center_voucher.py`, `delete_center_voucher.py`, `list_voucher_catalog.py` |
| Facade | `app/modules/voucher/facade/center_voucher_facade.py` (CenterVoucherFacade) |
| Handlers (6개) | 동일 5개 + `list_voucher_catalog.py` |
| Router | `app/modules/voucher/center_voucher/router.py` |
| Voucher 모듈 통합 라우터 | `app/modules/voucher/router.py` (신설) |
| main.py 등록 | `app/main.py` — voucher_router include |
| Alembic 마이그레이션 | `migrations/versions/22cf53d17fea_add_center_vouchers_table.py` (적용 완료) |
| Alembic env.py | CenterVoucher import 추가 |

**등록된 API 엔드포인트**:
```
GET   /api/v1/centers/{cid}/voucher-catalog            (카탈로그 + is_taken 플래그)
POST  /api/v1/centers/{cid}/center-vouchers/           (취급 등록)
GET   /api/v1/centers/{cid}/center-vouchers/           (목록)
GET   /api/v1/centers/{cid}/center-vouchers/{id}       (상세)
PATCH /api/v1/centers/{cid}/center-vouchers/{id}       (수정)
DELETE /api/v1/centers/{cid}/center-vouchers/{id}      (해제 — soft delete)
```

#### 프론트엔드 (apps/web)

| 항목 | 파일 |
|---|---|
| Permission 타입 | `src/lib/types/permissions.ts` — voucher 3개 추가 |
| API actions | `src/lib/hooks/actions/centerVoucher.action.ts` (6개 함수 + 타입) |
| Feature 모듈 | `src/lib/features/voucher/center-voucher/` — constants, filters, query-builders, view-model, hooks, center-voucher-service |
| 페이지 | `src/routes/(protected)/settings/vouchers/+page.svelte`, `+page.ts` |
| 모달 | `src/routes/(protected)/settings/vouchers/components/CenterVoucherFormModal.svelte` |
| 사이드바 메뉴 | `common/components/layout/UnifiedSidebar.svelte` — `설정 > 취급 바우처` 추가 |

#### 검증 완료
- ✅ DB 테이블 + unique constraint + 부분 index 정상 생성
- ✅ 백엔드 import 정상 (앱 로드, 6개 라우트 OpenAPI 등록)
- ✅ 프론트 `npm run check` — voucher 관련 에러 0건 (56 → 47 errors)

#### 검증 미완 (내일 이어갈 일)
- ⏳ 실제 브라우저 동작 검증
  - 어드민(`/admin/vouchers`)에서 카탈로그 사업 1~2개 등록
  - 센터 SaaS(`/settings/vouchers`)에서 취급 등록 → 수정 → 비활성화 → 해제
  - 권한 없는 사용자(예: counselor) 차단 확인
- ⏳ super_admin이 `READ/WRITE/DELETE_VOUCHER` 권한을 manager 역할에 부여 (DB role_permissions 작업)
- ⏳ V2 §10-2 Open Question 3번 (CenterVoucher 비활성화 시 발급된 ClientVoucher 정책) — Phase B 진입 전 결정

#### 의도적으로 미구현 — Phase B에 포함시킬 항목
- 카탈로그 폼 UI 보강 (어드민 폼은 기존 그대로, voucher_type 등 신규 필드 없음)
- 페이지 분할 레이아웃 (V2 §6-2 "좌: 카탈로그 / 우: 취급 바우처") — 현재는 단일 카드 그리드만

---

### 12-2. Phase B — 내담자 바우처 + billing 연동 ⏳ 다음 작업

**골인선**: 접수 담당자가 내담자에게 바우처를 수동 발급하고, billing.Payment 생성 시 `client_voucher_id` 연결로 잔여 회기 자동 갱신.

#### 우선 결정 필요 (착수 직전)
1. V2 §10-2 #3 — CenterVoucher 비활성화 시 발급된 ClientVoucher는 active 유지?
2. (선택) V2 §10-2 #1 — 잔여 동기화 UX에 사유 메모 필수 여부

#### 백엔드 작업 윤곽
- Alembic: `client_vouchers` 테이블 + `payments.client_voucher_id` 컬럼
- `Payment.payment_method` validator에 `'voucher'` 추가
- voucher 모듈: ClientVoucher CRUD (V2 §3-3, §5-3)
- billing 모듈: Payment 생성 시 `VoucherFacade.increment_used_sessions()` 호출
- voucher/client_voucher 서브모듈 + facade 신설 (Phase A의 center_voucher와 동일 패턴)

#### 프론트엔드 작업 윤곽
- 내담자 상세 페이지에 "바우처" 탭 추가 (V2 §6-3)
- 발급 모달 (V2 §4 S1, [`voucher-client-integration-plan.md`](./voucher-client-integration-plan.md) Q2 확정안)
- billing 결제 등록 모달에 "바우처 사용" 옵션 추가 (V2 §6-4)
- 매출 리포트에 결제 수단 "바우처" 필터 (V2 §6-5)

#### 참고 (Phase A에서 만든 자산 재활용)
- Feature 모듈 패턴 (`features/voucher/center-voucher/`)을 `features/voucher/client-voucher/`로 동일하게 적용 가능
- price-list 패턴이 양 phase 공통 템플릿

---

### 12-3. Phase E — 운영 보조 (Phase B 이후)

만료 알림·대시보드·CSV. V2 §7 그대로.

---

### 12-4. 이번 토론에서 만든 문서들

| 문서 | 상태 | 비고 |
|---|---|---|
| [`voucher-implementation-plan-v2.md`](./voucher-implementation-plan-v2.md) | ✅ 현재 SSOT | 본 문서. P1 구현 기준 |
| [`voucher-implementation-plan.md`](./voucher-implementation-plan.md) | 🟡 superseded | 자동화 원안. P3 이후 검토용 보존 |
| [`voucher-client-integration-plan.md`](./voucher-client-integration-plan.md) | 🟡 부분 superseded | Q1·Q2 결정은 V2 §4 S1에 흡수 |
| [`voucher-integration-plan.md`](./voucher-integration-plan.md) | 🟡 superseded | billing 측 의존성 근거. V2에서 축소 |
| [`../voucher/voucher_usage_report.html`](../voucher/voucher_usage_report.html) | 📎 참고 자료 | 31종 바우처 결제 흐름 비교. (C2) 결정 근거 |

---

## 11. 참고 문서

- 사업 기획: [`../voucher/voucher-plan.md`](../voucher/voucher-plan.md)
- 31종 바우처 결제·정산 흐름: [`../voucher/voucher_usage_report.html`](../voucher/voucher_usage_report.html) — 본 모델 단순화의 근거
- 원안(P3 이후 자동화 검토용): [`voucher-implementation-plan.md`](./voucher-implementation-plan.md)
- 내담자 운영 시나리오 (Q1·Q2 결정): [`voucher-client-integration-plan.md`](./voucher-client-integration-plan.md)
- billing 마이그레이션 현황: [`billing-improvement-plan.md`](./billing-improvement-plan.md)
- 현재 billing 모델: [`apps/api/app/modules/billing/billable/models.py`](../../apps/api/app/modules/billing/billable/models.py), [`payment/models.py`](../../apps/api/app/modules/billing/payment/models.py)
