# 청구(Billing) 개선 계획 — 갭 분석 + 마이그레이션 플랜

> **작성일**: 2026-04-08
> **상태**: 제안 (검토 필요)
> **관련 문서**: [docs/payment/](../payment/) (Phase 1 풀 설계 — **본 문서의 정답**)

---

## 0. 이 문서의 위치

이 문서는 **새 기획서가 아닙니다**.

- **정답 설계**는 이미 [docs/payment/](../payment/)에 존재합니다 (PriceList, Billable, Payment 분리, 바우처 등 Phase 1 풀 설계).
- 그러나 **현재 구현**은 그 설계 이전의 임시 버전입니다 (단일 `PaymentRecord` 테이블, `pending/completed` 2상태, 단가표 없음).
- 사용자 피드백("청구가 어색함, 결제 확인이 없음, 단가표가 필요함")은 정확히 **기존 설계와 현재 구현 사이의 갭**을 가리키고 있습니다.

따라서 이 문서가 다루는 것은:

1. **기존 설계와 현재 구현 사이의 갭이 정확히 무엇인지** (Gap Analysis)
2. **사용자 피드백을 반영해 어떤 순서로 마이그레이션할지** (Migration Plan)
3. **각 단계가 끝나면 사용자에게 무엇이 바뀌는지** (Outcomes)

설계의 세부 필드/엔티티 정의는 [docs/payment/domain.md](../payment/domain.md)를 정답으로 따르고, 이 문서는 그것을 중복 기재하지 않습니다.

---

## 1. 사용자 피드백 (원문)

> 청구 생성 → 청구 확인 흐름이 어색함. 같은 정보를 두 번 입력하는 느낌.
>
> 청구 확인 이후 **결제 확인** 단계가 나와야 함 (어떤 수단으로 결제했는지, 바우처를 썼는지).
>
> **단가표** 같은 기능이 필요함. 검사·상담은 센터마다 가격이 다르므로 단가표를 관리할 수 있어야 함 (설정 → 상품/단가).
>
> 청구 생성 시 **상품을 선택해서** 만들 수 있으면 좋겠음. 상품 선택 시 **검사인지 상담인지에 따라 필터**되어 보이면 좋을 것 같음.

### 피드백을 도메인 용어로 번역

| 사용자 표현 | 도메인 개념 | 기존 설계 위치 |
|---|---|---|
| "청구 생성/확인이 어색" | Billable의 `draft → issued` 상태 흐름 부재 | [domain.md §1 Billable](../payment/domain.md) |
| "결제 확인 단계 필요" | `Payment` 엔티티 분리 부재 | [domain.md §3 Payment](../payment/domain.md) |
| "수단/바우처 사용" | `payment_method`, `VoucherPolicy/ClientVoucher` 부재 | [domain.md §3, §4, §5](../payment/domain.md) |
| "단가표" | `PriceList` 엔티티 부재 | [domain.md §6 PriceList](../payment/domain.md) |
| "상품 선택해서 청구" | `BillableItem` + PriceList 참조 부재 | [domain.md §2 BillableItem](../payment/domain.md) |
| "검사/상담 필터" | `service_type` 분류 부재 | PriceList의 `service_type` 필드 |

**결론**: 사용자 피드백은 **기존 설계와 정확히 일치**합니다. 새 설계가 필요한 것이 아니라, **기존 설계를 구현으로 끌어오는 것**이 본질입니다.

---

## 2. 현재 상태 스냅샷

### 2-1. 백엔드 구현 (As-Is)

**파일**: [apps/api/app/modules/billing/payment/models.py](../../apps/api/app/modules/billing/payment/models.py)

```
billing/
├── facade/
│   └── payment_facade.py
├── payment/
│   ├── models.py        # PaymentRecord (단일 테이블)
│   ├── repository.py
│   ├── schemas.py
│   ├── services/
│   └── handlers/
└── router.py
```

**`payment_records` 테이블 핵심 컬럼**:

| 컬럼 | 타입 | 의미 |
|---|---|---|
| `client_id` | UUID | 내담자 |
| `client_name`, `client_code` | str | 비정규화 |
| `related_type`, `related_id` | str/UUID | 상담/검사 세션 참조 (옵셔널) |
| `billing_code` | str | 화면용 청구번호 |
| `description` | str(200) | **자유 텍스트로 내역** |
| `amount` | int | 금액 (원) |
| `status` | str | `pending` / `completed` 2상태 |
| `issued_at` | datetime | 발행일 |
| `completed_at`, `completed_by`, `completed_by_name` | | 청구 완료 처리 |
| `created_by`, `note` | | 메타 |

**없는 것**:
- ❌ 단가표 (PriceList) — 매번 금액을 손으로 입력
- ❌ 청구 항목 분리 (BillableItem) — 한 청구는 한 줄 텍스트
- ❌ 결제 분리 (Payment) — "청구 완료" = 사실상 "결제 받았다고 가정"하고 도장 찍는 행위
- ❌ 결제 수단 — `payment_method` 컬럼 자체가 없음
- ❌ 바우처 (VoucherPolicy / ClientVoucher)
- ❌ 부분 납부 / 분할 결제
- ❌ 미수금 자동 추적
- ❌ 환불

### 2-2. 프론트엔드 구현 (As-Is)

**파일**:
- [billing/+page.svelte](../../apps/web/src/routes/(protected)/billing/+page.svelte) — 목록
- [features/billing/billing-service.ts](../../apps/web/src/lib/features/billing/billing-service.ts) — CRUD/모달
- [hooks/actions/billing.action.ts](../../apps/web/src/lib/hooks/actions/billing.action.ts) — API 액션

**현재 화면 구성**:
- 목록(필터: 검색, 날짜 범위, 상태 탭 `전체/청구 필요/청구 완료`)
- "청구 추가" 모달 (BillingModal): 내담자 선택, 자유 텍스트 description, 금액
- 상세 모달: 동일 폼 + 편집/삭제/완료 버튼
- "청구 완료" 처리 = `status: pending → completed` 토글뿐

**프론트 타입 정의** ([billing.action.ts](../../apps/web/src/lib/hooks/actions/billing.action.ts)):
```typescript
type PaymentStatus = 'pending' | 'completed'
interface CreatePaymentPayload {
  client_id, description, amount, related_type?, related_id?, note?
}
```

→ 이 타입이 사용자 피드백의 모든 통점을 그대로 반영합니다.

### 2-3. 문서 상황 (3개의 설계가 떠 있음)

| 문서 | 상태 | 내용 |
|---|---|---|
| [docs/billing/domain.md](./domain.md) | **구버전 설계** | PaymentRecord (amount/paid_amount/outstanding_amount) + Voucher. 백엔드와도 다름. **historical reference로만 보존.** |
| [docs/payment/](../payment/) | **정답 설계 (Phase 1)** | 9개 문서, ~100쪽. PriceList + Billable + BillableItem + Payment + VoucherPolicy + ClientVoucher. **이 문서의 마이그레이션 목표.** |
| 본 문서 | 갭 분석 + 마이그레이션 | (지금 읽고 있는 문서) |

> **취급 방침**: 기존 두 문서는 **건드리지 않습니다**. 본 문서가 명시적으로 "docs/payment/가 정답"이라고 선언하는 것으로 충분합니다.

---

## 3. 갭 분석 (As-Is → To-Be)

목표 설계는 [docs/payment/domain.md](../payment/domain.md)이고, 그것과 현재 구현의 갭을 정리합니다.

### 3-1. 엔티티 갭

| 엔티티 | As-Is | To-Be (docs/payment/) | 갭 크기 |
|---|---|---|---|
| **PriceList** | ❌ 없음 | 신규: `service_type`, `service_name`, `unit_price`, `is_active` | 🔴 큼 (신규 모듈) |
| **Billable** | `PaymentRecord` (한 줄짜리) | `total_amount`, `paid_amount`, `unpaid_amount`, `status: draft/issued/paid/overdue`, `due_date` | 🔴 큼 (재설계) |
| **BillableItem** | ❌ 없음 | 신규: `item_type`, `item_id`, `description`, `quantity`, `unit_price`, `voucher_amount`, `provided_at` | 🔴 큼 (신규 테이블) |
| **Payment** | ❌ 없음 (status 토글로 대체) | 신규: `billable_id`, `amount`, `payment_method`, `paid_at`, `receipt_number` | 🔴 큼 (신규 테이블) |
| **VoucherPolicy** | ❌ 없음 | 신규 (센터별 정책) | 🟡 중간 (Phase 1 후반) |
| **ClientVoucher** | ❌ 없음 | 신규 (내담자별 잔여 횟수) | 🟡 중간 (Phase 1 후반) |

### 3-2. 워크플로우 갭

| 흐름 | As-Is | To-Be |
|---|---|---|
| **청구 생성** | "청구 추가" 폼에서 description + 금액을 손으로 입력 | 상품(PriceList)을 선택 → 단가 자동 반영 → 필요 시 수정 |
| **검사/상담 컨텍스트** | 청구 페이지에서 수동으로 만들어야 하므로 컨텍스트 없음 | 검사/상담 완료 시 자동으로 draft Billable 생성 (선택) + 수동 진입 시 컨텍스트 기반 PriceList 필터 |
| **청구 → 결제** | "청구 완료" 버튼이 단순 status 토글 (어떻게 받았는지 모름) | Payment 등록(수단/금액/일자) → Billable.status가 자동으로 paid/partial 전환 |
| **부분 결제** | ❌ 불가능 | 한 Billable에 N개 Payment (카드 70k + 바우처 30k) |
| **바우처** | ❌ 불가능 | ClientVoucher 잔여 횟수 자동 차감 + BillableItem.voucher_amount |
| **미수금** | "청구 필요" 탭의 단순 카운트 | `unpaid_amount > 0` 자동 계산, 미수금 리포트 가능 |
| **환불** | ❌ 불가능 | 음수 BillableItem 또는 음수 Billable로 상계 |

### 3-3. UI/UX 갭

| 화면 | As-Is | To-Be |
|---|---|---|
| **청구 목록** | 상태 탭: 전체 / 청구 필요 / 청구 완료 (2상태) | 상태 탭: 전체 / draft / issued / paid / overdue |
| **청구 컬럼** | 청구ID, 발행일, 내담자, **내역(텍스트)**, 결제금액, 상태, 청구자 | 청구ID, 발행일, 내담자, **상품들(요약)**, 총액, **결제금액**, **미수금**, 상태 |
| **청구 추가 모달** | 폼: description(텍스트), amount | 1단계: 상품 선택 (카테고리 필터) → 2단계: 수량/금액 조정 → 저장 |
| **청구 상세 모달** | 폼 + 완료 버튼 | 청구 항목 리스트 + **결제 내역 리스트** + "결제 등록" 버튼 |
| **결제 등록 (신규)** | ❌ | 모달: 수단(현금/카드/이체/바우처) + 금액(부분결제 가능) + 일자 |
| **단가표 관리 (신규)** | ❌ | 설정 → 단가표: 카테고리별 CRUD, 활성/비활성 토글 |
| **검사·상담 상세에서 청구 생성** | 가능하나 컨텍스트 정보(`related_type/id`)만 전달 | 컨텍스트 + 해당 카테고리 PriceList 자동 필터 |

### 3-4. 권한·설정 갭

| 항목 | As-Is | To-Be |
|---|---|---|
| 권한 | `read:billing`, `write:billing` | `read:billing`, `write:billing`, `manage:price_list`(설정 영역) |
| 센터 설정 | 없음 | 단가표 사용 여부, 자동 청구 생성 ON/OFF, 기본 due_date 정책 |

---

## 4. 사용자 피드백에 직접 답하기

### Q1. "청구 생성 → 청구 확인 흐름이 어색함"

**원인**: 현재는 "청구 생성"과 "청구 완료"가 사실상 같은 폼을 두 번 만지는 구조. 그 중간에 의미 있는 단계가 없음.

**해결**: 두 행위를 **다른 개념**으로 명확히 분리.

| 행위 | 도메인 | UI |
|---|---|---|
| "이 사람에게 이만큼 받기로 결정했다" | Billable 생성 → `issued` | 청구 추가 모달 (상품 선택 → 단가 확인 → 저장 = 발행) |
| "실제로 받았다" | Payment 생성 | 청구 상세에서 "결제 등록" |

→ "확인" 단계가 없어집니다. 대신 명확한 두 단계가 생깁니다.

### Q2. "청구 확인 이후 결제 확인이 나와야 함"

**해결**: Payment 엔티티 도입.
- 청구(Billable)는 "받을 돈"
- 결제(Payment)는 "받은 돈"
- Billable.status는 결제 합계가 청구 금액과 일치하면 자동 `paid` 전환
- 부분 결제도 자연스럽게 표현됨 (카드 70k + 바우처 30k → Payment 2개)

### Q3. "단가표 같은 기능이 필요함"

**해결**: PriceList 엔티티 도입 (이미 [docs/payment/domain.md §6](../payment/domain.md)에 설계 완료).
- **위치**: 설정 → "단가표" (또는 "청구 항목 관리")
- **필드**: `service_type`(counseling/assessment/package), `service_name`, `unit_price`, `is_active`
- **CRUD**: 카테고리 필터 + 검색 + 활성/비활성 토글

### Q4. "검사인지 상담인지에 따라 필터되어 나오는 게 좋을 것 같다"

**의견**: 동의. 단, **사용자가 매번 카테고리를 선택하게 하지 말고, 진입점에 따라 자동 필터**되도록 하는 것을 권장.

| 진입 경로 | 기본 카테고리 |
|---|---|
| 검사 상세 → "청구 생성" | `assessment` 자동 |
| 상담 세션 상세 → "청구 생성" | `counseling` 자동 |
| 청구 페이지 → "청구 추가" | 전체 (사용자가 카테고리 선택) |

이유:
- 검사 화면에서 청구를 만들 때, 사용자는 이미 "검사 청구"라는 컨텍스트를 알고 있음
- 매번 수동 필터링은 클릭 비용 + 휴먼 에러(검사 청구에 상담 단가 잘못 선택)
- 다른 카테고리로 바꾸고 싶으면 필터 변경 가능 (잠금이 아님)

추가로 권장:
- **자주 쓰는 항목 우선 노출** (최근 사용 / 즐겨찾기) — 센터마다 주력 상품 5~10개로 좁혀짐
- **검색은 카테고리 무시하고 전체** — 빠른 탐색용

---

## 5. 마이그레이션 플랜

### 원칙

1. **기존 데이터를 깨지 않는다.** `payment_records` 테이블은 그대로 두고 점진적으로 새 모델 위에 옮긴다.
2. **사용자 가치를 빨리 전달한다.** 단가표만 먼저 도입해도 휴먼 에러가 크게 줄어든다.
3. **모듈 격리.** [docs/payment/](../payment/)는 모듈명을 `payment`로 가정하지만, 현 코드는 `billing/` 아래에 있다. 본 마이그레이션은 **`billing/` 모듈명을 유지**하되, 내부 서브모듈로 `price_list`, `billable`, `payment`, `voucher`를 신설하는 방식을 권장한다 (큰 리네이밍 회피).

### Phase 0 — 정렬 ✅ (완료 — 2026-04-08)

**목표**: 팀이 같은 그림을 보게 한다. 모든 정책 결정을 [§7](#7-phase-0-결정-사항-확정--2026-04-08)에 확정한다.

- [x] 본 문서 작성
- [x] [docs/payment/](../payment/) 핵심 문서(`summary.md`, `domain.md`) 재확인 — `payment/`가 본 마이그레이션의 정답 설계임을 확인
- [x] **모듈 구조 결정** ([§7-1](#7-1-모듈-구조)): `billing/` 유지, `_legacy/payment/` 격리, 서브모듈별 Facade
- [x] **데이터 정책 결정** ([§7-2](#7-2-데이터-정책)): cutover 방식, 이중 쓰기 불필요, PaymentRecord 영구 보관
- [x] **UX 정책 결정** ([§7-3](#7-3-ux-정책)): PriceList 영구 선택(자유 입력 fallback), 컨텍스트 자동 필터 기본값
- [x] **권한 결정** ([§7-4](#7-4-권한)): `write:billing` 통합 사용, 권한 신설 0
- [x] **policy 8개 중 영향 항목 결정** ([§7-5](#7-5-docspaymentsummarymd-8개-미결-정책-중-영향-항목)): 영수증 번호 형식, 연체, 환불, 삭제 정책

**남은 Phase 0 정리 작업** (구현 시작 전 별도 PR 가능):
- [ ] [docs/billing/domain.md](./domain.md) 상단에 "Deprecated. See [billing-improvement-plan.md](./billing-improvement-plan.md)" 안내문 추가 (선택)
- [ ] 본 문서를 팀에 공유 + Phase 1 작업 착수 승인

**Outcome**: 팀 전체가 "billing 모듈을 어디로 가져갈지" 명확히 안다. Phase 1부터는 의사결정 없이 작업만 남는다.

---

### Phase 1 — 단가표 (PriceList) 단독 도입 ✅ (완료 — 2026-04-10)

**목표**: **사용자 피드백의 가장 큰 통점인 단가표 부재를 가장 빨리 해결**한다. 기존 청구 흐름은 건드리지 않는다.

#### 백엔드
- [x] `billing/price_list/` 서브모듈 신설
  - `models.py` — PriceList (service_type, service_name, unit_price, is_active, source, notes, created_by)
  - `repository.py`, `schemas.py`, `services/` (5개 CRUD), `handlers/`
- [x] `PriceListFacade` 신설
- [x] Alembic 마이그레이션: `price_lists` 테이블 생성 + `source` 컬럼 추가
  - `service_type`(상담/검사/패키지), `service_name`, `unit_price`, `is_active`
  - `source`(manual/synced) — 동기화 출처 추적, 수정 시 자동 manual 전환
  - **삭제 정책**: soft delete (`deleted_at`)
- [x] API:
  - `GET /api/centers/{id}/price-lists` (필터: `service_type`, `is_active`, `search`, 페이지네이션)
  - `POST /api/centers/{id}/price-lists`
  - `GET /api/centers/{id}/price-lists/{id}`
  - `PATCH /api/centers/{id}/price-lists/{id}`
  - `DELETE /api/centers/{id}/price-lists/{id}` (soft delete)
- [x] 권한: **`write:billing` 통합 사용** — 신규 권한 신설 없음
- [x] ~~시드 데이터~~ → 동기화 기능으로 대체 (시드 불필요)

#### 프론트엔드
- [x] **새 페이지**: `/billing/price-list` — V4 Feature 아키텍처
  - `features/billing/price-list/` (constants, filters, query-builders, view-model, service, hooks)
  - 필터: 유형(Select) + 상태(Select) + 검색(디바운스) + URL 동기화
  - 테이블 뷰 + 카드(그리드) 뷰 + ListGridToggleButton (URL 반영)
  - 반응형: 모바일 자동 카드 뷰 전환
  - 케밥 메뉴(수정/삭제), PersonChipSelect(활성/비활성 토글)
  - 단가 미설정 경고: `source=synced && unit_price=0`인 항목 표시
  - 생성일/수정일 컬럼 (formatUtcToKst YYYY-MM-DD HH:mm)
- [x] **등록/수정 모달** (PriceListFormModal)
  - 검사/프로그램/패키지 불러오기 (CenterAssessment + Program + AssessmentSet API 연동)
  - 선택 시 서비스명 + 단가 자동 채우기 (자유 입력 fallback 유지)
- [x] **검사/프로그램/패키지 동기화** 기능
  - 검사: 이름만 (가격 없으므로 0원)
  - 프로그램: 이름 + 가격 (이미 있으면 가격만 업데이트)
  - 패키지(검사 세트): 이름만 (가격 없으므로 0원)
  - 개별 실패 시 스킵 후 계속 진행, 결과 토스트 (N건 추가, M건 업데이트, K건 실패)
  - 생성 시 `source: 'synced'` 설정
- [x] 사이드바 메뉴: 청구 하위에 "청구 내역" + "단가 관리" 추가
- [x] **KebabMenu 개선**: `horizontal` prop 추가 (카드용 가로 점 세 개)
- [x] **PriceListCard** 컴포넌트: 뱃지 + 케밥(portal) + PersonChipSelect + 정보 표시

#### 기존 청구 화면 영향
- [x] BillingModal에 **"단가표에서 불러오기"** 드롭다운 추가
  - `[상담]`, `[검사]`, `[패키지]` 유형 prefix + 서비스명 + 금액 표시
  - 선택 시 `description`/`amount` 자동 채움
  - **자유 입력 경로 그대로 유지**
  - 백엔드 PaymentRecord 스키마는 변경 없음 — 단지 입력 보조 도구
- [x] BillingModal 인풋 스타일 통일 (`h-13 rounded-xl px-4`, Typography 라벨 `mb-2`)

**Outcome**:
- 단가 관리 페이지에서 CRUD + 동기화 가능
- 청구 만들 때 단가표에서 골라 자동 입력 → 휴먼 에러 감소
- **기존 청구 데이터 영향 0**, 새 권한 신설 0

**롤백 안전**: 단가표 모듈만 추가했으므로 페이지를 숨기면 즉시 롤백 가능. 데이터 손실 위험 0.

---

### Phase 2 — Billable + BillableItem 모델 마이그레이션 ✅ (완료 — 2026-04-10)

**목표**: "한 청구 = 한 줄 텍스트" 구조를 "청구서 + N개 항목"으로 바꾼다. 이 단계에서 사용자 피드백 1번("생성 → 확인이 어색")이 본격 해결된다.

#### 백엔드
- [x] `billing/billable/` 서브모듈 신설
  - `Billable` 모델: center_id, client_id, billable_date, total_amount, paid_amount, unpaid_amount, status, issued_at, due_date, notes, created_by
  - `BillableItem` 모델: billable_id, item_type, item_id, related_type, related_case_id, price_list_id, description, quantity, unit_price, amount, provided_at, notes
  - **상태 enum**: `draft / issued / paid / overdue`
  - **삭제 정책**: 모두 soft delete (`deleted_at`), draft만 삭제 허용
- [x] `BillableFacade` 신설 (ClientFacade 연동으로 client_name/client_code 자동 채움)
- [x] DB 테이블: 이미 존재하여 마이그레이션 불필요. `related_type`/`related_case_id` 컬럼만 추가 (마이그레이션 `a5b2e8c1d4f7`)
- [x] ClientInfo에 `code` 필드 추가 (Facade DTO 확장)
- [x] API:
  - `POST /api/centers/{id}/billables` — 청구서+항목 생성
  - `GET /api/centers/{id}/billables` — 목록 (status/client_id 필터, 페이지네이션)
  - `GET /api/centers/{id}/billables/{id}` — 상세 (항목 포함)
  - `PATCH /api/centers/{id}/billables/{id}` — 기본 정보 수정 (메모, 청구일, 납부기한)
  - `PATCH /api/centers/{id}/billables/{id}/status` — 상태 전환 (draft→issued→paid)
  - `DELETE /api/centers/{id}/billables/{id}` — 삭제 (draft만, soft delete)
- [x] 상태 전환 규칙: draft→issued, issued→paid/overdue, overdue→paid

#### 데이터 마이그레이션
- [x] `scripts/migrate_payment_to_billable.py` — payment_records → billables + billable_items 변환
  - pending → issued, completed → paid 매핑
  - 2건 변환 완료, 총액 검증 통과 (22,290원)
  - 재실행 안전 (이미 데이터 있으면 스킵)

#### 프론트엔드
- [x] `billable.action.ts` — 6개 CRUD action (list, detail, create, update, updateStatus, delete)
- [x] Feature 모듈 확장:
  - `constants.ts`: BILLABLE_STATUS, BILLABLE_STATUS_COLORS, BILLABLE_STATUS_OPTIONS 추가
  - `view-model.ts`: BillableListItemVM, BillableDetailVM + 매핑 함수 추가
  - `filters.ts`: BillableFilters + URL 파싱/직렬화 추가
  - `query-builders.ts`: buildBillableListInput 추가
  - `hooks.svelte.ts`: useBillableFilters 추가 (디바운스 검색, URL 동기화, 반응형)
- [x] `billable-service.ts` — 생성/상세/상태변경/삭제/메모수정 + 모달 오케스트레이션
- [x] 청구 목록 페이지 전환 (`billing/+page.svelte`):
  - getBillingList → getBillableList API 전환
  - 컬럼: 내담자 / 내역(항목요약) / 총액 / 결제액 / 미수금(빨간색) / 상태(뱃지) / 생성일
  - 탭: 전체 / 임시 / 발행 / 완납 / 연체
  - 테이블 + 카드 뷰 (반응형, URL 동기화)
- [x] **BillableCreateModal** — 청구서 생성:
  - 내담자 선택 (ClientSearchDropdown)
  - 단가표에서 항목 선택 (N개 추가, [유형] prefix 표시) + 직접 입력
  - 수량/단가 조정, 합계 표시
  - 메모 입력
  - 항목 리스트 내부 스크롤 (max-h-80)
  - 인풋 높이 통일 (h-13 rounded-xl, ClientSearchDropdown 기준)
- [x] **BillableDetailModal** — 청구서 상세 (영수증 스타일):
  - 기존 BillingModal과 동일한 영수증 디자인 (아이콘 + 큰 금액 + 그라데이션 구분선 + 점선 + isReceipt 톱니 마스크)
  - 상태 뱃지, 청구 정보 (내담자, 청구일, 발행일)
  - 메모 편집 (canWrite일 때 textarea, 변경 시 "메모 저장" 버튼)
  - 항목 리스트 + 바로가기 (related_type → 상담/검사 페이지 이동)
  - 항목 스크롤 (max-h-36, 2개까지 보이고 이후 스크롤)
  - 금액 요약 (총액/결제액/미수금)
  - 상태 전환 버튼 (draft→발행, issued→완납) + 삭제 (draft만)

#### 미전환 (Phase 3에서 처리)
- [ ] 스케줄 디테일 모달 연동 전환 (구 billing API → billable API)
  - `ScheduleDetailModal`, `ScheduleDetailAssessmentBody`, `ScheduleDetailCounselingBody`
  - `getBillableByRelated` API 추가 필요
- [ ] Legacy 코드 삭제 (`billing.action.ts`, `billing-service.ts`, `BillingModal.svelte`, `BillingCard.svelte`)

**Outcome**:
- 청구서가 N개 항목을 가질 수 있음 → 한 번에 여러 서비스 청구 가능
- 단가표에서 골라 청구 → 휴먼 에러 더 감소
- 청구 추가 흐름이 명확해짐 (생성=발행이 한 번에)
- 영수증 스타일 상세 모달 + 메모 편집 + 상태 전환
- 기존 청구 데이터 마이그레이션 완료

**여전히 부족**: 결제 수단 / 부분 결제 / 바우처 (Phase 3에서 해결), 스케줄 연동 전환
  - 청구 항목 리스트 (각 항목의 description, qty, unit_price, amount)
  - 총액 / 결제액 / 미수금 표시
  - "결제 등록" 버튼 (Phase 3에서 활성화, Phase 2에서는 placeholder)
- [ ] 검사/상담 상세 페이지의 "청구 생성"이 새 모달을 호출하면서 카테고리 자동 필터 전달

**Outcome**:
- 청구서가 N개 항목을 가질 수 있음 → 한 번에 여러 서비스 청구 가능
- 단가표에서 골라 청구 → 휴먼 에러 더 감소
- 청구 추가 흐름이 명확해짐 (생성=발행이 한 번에)
- 기존 청구 페이지가 새 데이터 모델 위에서 동작

**여전히 부족**: 결제 수단 / 부분 결제 / 바우처 (Phase 3에서 해결)

---

### Phase 3 — Payment + 결제 등록 ✅ (완료 — 2026-04-10, 간소화 버전)

**목표**: 사용자 피드백 2번("결제 확인 단계 필요")을 해결한다. 사용자 피드백("결제 수단은 카드/계좌이체 정도면 충분") 반영하여 간소화.

#### 사전 작업: 모듈 위치 정리
- [x] `billing/payment/` (구 PaymentRecord) → `billing/_legacy_payment/`로 이동
  - import path 일괄 치환 완료 (21개 파일)
  - `_legacy_payment/` 내부 + `router.py` + `facade/` 참조 모두 업데이트
- [x] `PaymentFacade` → `LegacyPaymentFacade`로 이름 변경
  - `facade/legacy_payment_facade.py`로 파일명 정리
  - legacy handler들 참조 일괄 치환
- [x] 새 Payment가 `billing/payment/` 차지
  - `facade/payment_facade.py` (신규 PaymentFacade)
  - v2, new 접두사 전부 제거

#### 백엔드
- [x] `billing/payment/` 서브모듈 신설
  - `Payment` 모델: billable_id, amount, payment_method(card/transfer), paid_at, receipt_number, notes, created_by
  - DB 테이블 이미 존재하여 마이그레이션 불필요
- [x] `PaymentFacade` 신설 (`facade/payment_facade.py`)
- [x] Service 2개:
  - `CreatePaymentService` — 결제 등록 + 영수증 번호 자동 생성 + Billable paid_amount 갱신 + 상태 자동 전환
  - `ListPaymentsService` — 결제 내역 조회
- [x] API 2개:
  - `POST /api/centers/{id}/billables/{billable_id}/payments` — 결제 등록
  - `GET /api/centers/{id}/billables/{billable_id}/payments` — 결제 내역
- [x] 비즈니스 로직:
  - Payment 생성 시 `Billable.paid_amount` 자동 갱신 (`SUM(payments.amount)`)
  - `paid_amount >= total_amount` → `Billable.status: paid` 자동 전환
  - draft 상태 청구서에 결제 불가 (issued 이상만)
  - 이미 완납된 청구서에 결제 불가
- [x] 영수증 번호 자동 생성:
  - 형식: `{YYYYMMDD}-{seq:03d}` (예: `20260410-001`)
  - 미입력 시 자동 생성, 수동 입력 시 스킵
- [x] `paid_at` timezone-aware → UTC naive 변환 (`to_utc_naive`)

#### 프론트엔드
- [x] `billable.action.ts`에 Payment 타입 + action 추가
  - `PaymentResponse`, `PaymentListResponse`, `CreatePaymentPayload`
  - `PAYMENT_METHOD_LABELS` (카드/계좌이체)
  - `postPayment()`, `getPaymentList()`
- [x] `billable-service.ts` — 상세 모달에서 결제 등록/내역 조회 연동
- [x] **PaymentModal** — 결제 등록 모달:
  - 결제 금액 입력 (미수금 기준 25%/50%/75%/100% 프리셋 버튼)
  - 미수금 실시간 차감 표시 (라벨 옆 justify-between)
  - 결제 수단 선택 (카드/계좌이체, Select)
  - 결제일 선택 (DatePickerInput 캘린더 드롭다운)
  - 메모 (선택)
  - 인풋 높이 통일 (h-13 rounded-xl)
- [x] **BillableDetailModal** 결제 내역 섹션:
  - 결제 리스트 (수단 뱃지 + 일시 + 영수증 번호 + 금액)
  - 스크롤 (max-h-32)
  - "결제 등록" 버튼 (issued 상태 + 미수금 > 0일 때만)
  - 삭제 버튼 TrashIcon24 아이콘으로 변경 (스케줄 모달과 통일)
  - 전체 간격 축소 (mt-4/mt-3, space-y-1/space-y-2, py-0.5)
  - 메모 textarea rows={1} + max-h-16 스크롤
  - body overflow-y-auto 스크롤 적용
  - BillsTitleIcon48 class prop 추가 + 크기 축소 (h-9)

#### 스케줄 모달 연동 (개별 청구)
- [x] 백엔드: `GET /billables/by-related?related_type=...&related_id=...` API 추가
  - BillableItem의 related_type/item_id로 역조회 (JOIN)
  - Facade에서 client 정보 자동 채움
- [x] 프론트: `getBillableByRelated` action 추가
- [x] ScheduleDetailModal 개별 청구 전환:
  - `existingBillableQuery` — 새 billable API로 조회
  - `billingState` — billable 상태 기반 (draft/issued → pending, paid → completed)
  - `handleViewBilling` → `billableService.openDetailModal`
  - `handleCreateBilling` → `billableService.openCreateModal` (prefill 포함)
- [x] 프로그램/검사/패키지 단가표 자동 매칭:
  - 상담: `schedule.program_name`으로 단가표 검색
  - 검사: `session.assessments[].kor_name + " 검사"`로 각각 매칭
  - 검사 세트: `session.set_name`으로 패키지 매칭
  - 매칭 시 서비스명 + 단가 + priceListId 자동 입력
- [x] BillableCreateModal prefill 기능:
  - `BillablePrefill` 인터페이스 (client, items[], relatedType, relatedId)
  - prefill 항목: locked (내역 수정 불가, 삭제 불가, 수량/단가만 수정 가능)
  - prefill 있을 때: 내담자 선택 잠금 (ClientSearchDropdown showDelete={false})
  - prefill 있을 때: 단가표 선택 / 직접 입력 버튼 숨김
- [x] ClientSearchDropdown에 `showDelete` prop 추가

#### Phase 3.5 — 단일 청구 최적화 + 그룹 청구 전환 + Legacy 정리 ✅ (완료 — 2026-04-13)

**단일 청구 연계 최적화**:
- [x] `related_case_id` 수정: session_id → case_id 저장
- [x] 검사 세트 이중 청구 방지: `belongs_to_set` 플래그 (AssessmentInfo, AssessmentSet 조회)
- [x] 단가표 `reference_id` 필드 추가 + `GET /price-lists/by-references` 전용 API
- [x] 단가표 조회 최적화: 200개 전체 → reference_id 기반 필요한 것만
- [x] 스케줄 응답 ID 추가: AssessmentInfo.id, SessionSummary.set_id, SessionSummary.program_id

**ScheduleDetailModal 리팩토링** (826줄 → 578줄):
- [x] `session-cancel-service.ts` — 세션 취소/복구 서비스 추출
- [x] `schedule-billing-service.ts` — 청구 연계 (prefill + 단가표 매칭 + 모달) 추출
- [x] `calendar-service.ts` — 삭제 옵션 확장 (isAssessment)

**그룹 청구 Billable 전환**:
- [x] `billable-service.ts` — `openGroupCreateModal` 추가 (참여자별 postBillable)
- [x] `schedule-billing-service.ts` — openGroupBilling billable 전환 + 단가표 매칭 적용
- [x] `ScheduleDetailModal` — existingBillings → existingBillables, legacy 쿼리 제거
- [x] Body 컴포넌트 — existingBillings → existingBillables prop 전환

**Legacy 프론트엔드 코드 삭제**:
- [x] `billing-service.ts` — 삭제
- [x] `billing.action.ts` — 삭제
- [x] `BillingModal.svelte` — 삭제
- [x] `BillingCard.svelte` — 삭제
- [x] `view-model.ts` — legacy VM 제거
- [x] 상담 상세 `onBilling` dead code — 전체 제거 (detail-service, page, SessionDetailPanel, ClientActionCard)

**Legacy 백엔드 유지** (기존 데이터 조회용):
- `billing/_legacy_payment/` — 당분간 유지
- `facade/legacy_payment_facade.py` — 당분간 유지

#### Phase 4로 미룸
- [ ] 환불 (음수 Payment, RefundModal)
- [ ] 바우처
- [ ] 결제 취소/삭제
- [ ] 과납부 처리
- [ ] legacy 백엔드 최종 삭제 (`_legacy_payment/`, `legacy_payment_facade.py`)
- [ ] 단가 매칭 실패 시 0원 표시 개선 (경고 또는 안내)

**Outcome**:
- 어떤 수단(카드/계좌이체)으로 받았는지 시스템에 기록됨
- 부분 결제 가능 (퍼센트 프리셋으로 편리하게)
- 미수금이 자동 추적되고 완납 시 상태 자동 전환
- 영수증 번호 자동 생성
- 스케줄에서 바로 청구 시 내담자 + 서비스 + 단가 자동 입력

---

### Phase 4 — 바우처 (VoucherPolicy + ClientVoucher)

**목표**: 정부 지원금/바우처 사용을 시스템에 들인다.

> ⚠️ **선결조건**: 센터별 바우처 정책이 어떻게 다른지 운영팀과 충분히 인터뷰. [docs/payment/scenarios.md](../payment/scenarios.md), [docs/payment/edge-cases.md](../payment/edge-cases.md) 참고.

- [ ] 백엔드: `billing/voucher/` 서브모듈
  - `VoucherPolicy` ([docs/payment/domain.md §4](../payment/domain.md))
  - `ClientVoucher` ([docs/payment/domain.md §5](../payment/domain.md))
- [ ] Alembic: `voucher_policies`, `client_vouchers` 테이블
- [ ] API:
  - 정책 CRUD
  - 내담자 바우처 등록 / 조회
  - 바우처 사용 (Payment 생성 시 voucher_amount 차감)
- [ ] 프론트엔드:
  - 설정 → 바우처 정책 관리
  - 내담자 상세 → 바우처 탭
  - PaymentModal에 "바우처 사용" 옵션 + 잔여 횟수 표시
  - BillableItem 생성 시 바우처 자동 계산 (지원율 × 단가)

**Outcome**: 한국 상담센터 운영의 핵심 통점 해결.

---

### Phase 5 — 자동 청구 생성 + 일괄 청구 (Optional)

[docs/payment/domain.md "자동 청구 워크플로우"](../payment/domain.md) 참고.

- [ ] 상담 세션 / 검사 완료 이벤트 → draft Billable 자동 생성
- [ ] 월말 일괄 청구 API (`POST /billables/batch`)
- [ ] 미수금 리포트 / 매출 리포트

> Phase 5는 이전 단계가 충분히 안정화된 후에만 진행. 자동화는 데이터가 정확할 때만 가치 있음.

---

## 6. 우선순위 요약

```
[완료] Phase 1: PriceList 도입 (단가표 + reference_id)     ✅ 2026-04-10
   ↓
[완료] Phase 2: Billable + BillableItem 마이그레이션       ✅ 2026-04-10
   ↓
[완료] Phase 3: Payment 도입 (결제 등록)                   ✅ 2026-04-10
   ↓
[완료] Phase 3.5: 단일 최적화 + 그룹 전환 + Legacy 정리    ✅ 2026-04-13
   ↓
[다음] Phase 4: Voucher (정책 + 내담자)                    ← 한국 특화
   ↓
[향후] Phase 5: 자동 청구 / 일괄 청구 (Optional)
```

각 Phase는 **독립적으로 사용자 가치를 전달**합니다. 중간에 멈춰도 의미 있는 상태가 됩니다.

---

## 7. Phase 0 결정 사항 (확정 — 2026-04-08)

> 본 §7은 원래 "결정이 필요한 사항" 목록이었으나, Phase 0 정렬 단계에서 모두 결정되었다. 이 결정들은 §5의 Phase별 작업 내용에 이미 반영되어 있다.

### 7-1. 모듈 구조

| 항목 | 결정 | 비고 |
|---|---|---|
| 코드 모듈명 | **`billing/` 유지** | DB·API·라우트·메뉴 변경 0. 도메인 의미상으로도 Billing(청구·회계)이 Payment(결제)보다 정확. 문서·코드 이름 차이는 본 마이그레이션 후 별도 PR로 정리 |
| 신규 서브모듈 | `billing/price_list/` (P1), `billing/billable/` (P2), `billing/payment/` (P3), `billing/voucher/` (P4) | |
| 구버전 PaymentRecord | Phase 3 시점에 **`billing/_legacy/payment/`로 이동** | import path 1회 변경. 동결 의도 시각화 |
| Facade 전략 | **서브모듈별 Facade + Application Handler에서 조합** | `PriceListFacade`, `BillableFacade`, `PaymentFacade`, `VoucherFacade`. 협력 로직은 `app/application/handlers/billing/`. CLAUDE.md "Facade 간 호출 금지" 원칙 준수 |

**최종 디렉터리 구조 (Phase 5까지 갔을 때)**:
```
apps/api/app/modules/billing/
├── facade/
│   ├── price_list_facade.py
│   ├── billable_facade.py
│   ├── payment_facade.py
│   └── voucher_facade.py
├── price_list/                  ← Phase 1
├── billable/                    ← Phase 2 (Billable + BillableItem)
├── payment/                     ← Phase 3 (새 Payment, Phase 3까지 비워둠)
├── voucher/                     ← Phase 4
├── _legacy/
│   └── payment/                 ← Phase 3 시점에 기존 PaymentRecord 이동
└── router.py

apps/api/app/application/handlers/billing/
├── create_billable_with_items.py
├── settle_billable_payment.py
└── apply_voucher_to_billable.py
```

### 7-2. 데이터 정책

| 항목 | 결정 |
|---|---|
| 운영 상태 (전제) | **시범 운영 / 소량 데이터** — 데이터는 보존하되 이중 쓰기까지는 불필요 |
| PaymentRecord → Billable 매핑 | 1 PaymentRecord → 1 Billable + 1 BillableItem (`description → BillableItem.description`, `amount → BillableItem.amount`) |
| status 매핑 | `pending → issued`, `completed → paid` |
| 이중 쓰기 | **불필요**. cutover 방식 (Phase 2 배포 시 한 번에 전환). 단 변환 전 백업 + 변환 후 합계·건수 검증 필수 |
| 레거시 Payment 자동 생성 | Phase 3에서 `payment_method = 'legacy'`, `paid_at = completed_at`, `notes = 'Phase 3 마이그레이션'`로 자동 생성 |
| PaymentRecord 테이블 최종 처리 | **영구 보관 (read-only archive)**. `_legacy/payment/` 코드도 그대로 유지. 회계 감사 대비 |

**Phase 2 cutover 절차** (참고용 체크리스트):
```
1. 정기 백업 트리거 + 수동 확인
2. payment_records 테이블 스냅샷 dump (안전망)
3. Alembic: billables, billable_items 테이블 생성
4. 변환 스크립트 실행 (one-shot, 위 매핑 규칙대로)
5. 검증: SUM(amount) 일치, COUNT(*) 일치
6. 애플리케이션 레이어에서 payment_records INSERT 차단
   (billing/_legacy/payment/repository.py를 read-only로 변경)
7. 롤백 시: Phase 2 배포 revert + billables/billable_items DROP + read-only 해제
```

### 7-3. UX 정책

| 항목 | 결정 |
|---|---|
| PriceList 선택 강제 여부 | **영구 선택** — 자유 입력 fallback 항상 허용. 도입 마찰 최소화. 단가표 미입력 센터도 즉시 사용 가능 |
| 컨텍스트 자동 필터 | 진입점에 따라 카테고리 **기본값 자동 설정**, 사용자 변경 가능 (잠금 X) |
| 즐겨찾기/최근 사용 | Phase 2의 새 모달 흐름에 통합 (Phase 1에는 포함 안 함) |

**청구 추가 모달의 두 입력 경로** (C-1 결정으로 항상 병존):
- (a) 단가표에서 선택 (권장)
- (b) 직접 입력 (description + 금액 자유 입력)

### 7-4. 권한

| 항목 | 결정 |
|---|---|
| 단가표 관리 | **`write:billing`으로 충분** — 신규 권한 신설 없음. 청구 작성자가 곧 단가표 관리자 |
| 결제 등록 (Phase 3) | `write:billing` — 일상 작업이므로 가볍게 |
| 결제 취소 / 환불 (Phase 3) | `manage:billing` 또는 별도 권한자 — 회계 사고 위험으로 통제 |

→ Phase 1에는 권한 시스템 변경 PR 불필요. Phase 3에서 `manage:billing` 권한이 이미 존재하는지 확인 후 적용.

### 7-5. docs/payment/summary.md 8개 미결 정책 중 영향 항목

| 항목 | 결정 | 영향 Phase |
|---|---|---|
| 영수증 번호 (D-1) | **`{YYYYMMDD}-{billable_code}-{seq:02d}`** 형식. center_code 도입 없음. 시퀀스는 같은 billable 내에서만 관리 (구현 단순) | Phase 3 |
| 연체 overdue (D-2) | Phase 2엔 **status enum에만 포함**, 자동 전환 배치는 Phase 5 | Phase 2 → 5 |
| 환불 (D-3) | **Phase 3에 환불 전용 모달** 추가. 결제 모달과 환불 모달을 명확히 분리. 음수 Payment로 표현하되 UI는 별도 | Phase 3 |
| 청구서 삭제 (D-4) | **모두 soft delete만**. draft도 hard delete 안 함. 가장 안전 | Phase 2~ |

**영수증 번호 형식 상세** (D-1):
- 형식: `{YYYYMMDD}-{billable_code}-{seq:02d}`
- 예시: `20260408-BIL001234-01`, `20260408-BIL001234-02` (같은 청구의 부분결제 2건)
- 장점:
  - 사람이 읽기 자연스러움 (날짜 + 청구 + 순번)
  - 언제 발급한 결제인지 즉시 보임
  - 어느 청구서의 결제인지 즉시 보임
  - 한 청구서 내 여러 결제 구분 가능 (부분결제)
- 시퀀스 관리:
  - 같은 `billable_id` 내 `MAX(seq) + 1` (전역 시퀀스 불필요)
  - 한 청구서에 동시 다발 결제는 사실상 없으므로 race condition 위험 거의 0
  - 안전장치: PostgreSQL row-level lock (`SELECT ... FOR UPDATE`)
- `billable_code`는 기존 `payment_records.billing_code`를 그대로 계승 (예: `BIL001234`, `#112124421`)
- **center_code 도입 보류** — Phase 3 부담 최소화를 위한 임시 결정. 추후 외부 회계 연동 등으로 필요해지면 별도 PR

### 7-6. 미결정 (운영 상황 봐서 결정 — 본 마이그레이션 진행에는 무관)

다음은 [docs/payment/summary.md](../payment/summary.md)의 8개 정책 중 본 마이그레이션 직접 영향이 없는 항목들. 운영팀과의 대화 기반으로 별도 결정.

- 과납부 처리 (운영 정책)
- 바우처 정책 업데이트 프로세스 (Phase 4 시작 시)
- 미수금 독촉 정책 (Phase 5 이후)
- 바우처 동시성 제어 (Phase 4 구현 디테일)

---

## 8. 위험과 대응

| 위험 | 영향 | 대응 | 결정 반영 |
|---|---|---|---|
| Phase 2 cutover 중 기존 청구 데이터 손실 | 회계 사고 | 변환 전 백업 + dump + 변환 후 합계·건수 검증 + 샘플 100건 수동 비교 + 롤백 절차 사전 정의 | [§7-2](#7-2-데이터-정책) |
| 사용자가 새 모달 흐름에 적응 못 함 | 운영 저항 | Phase 1(단가표 추가)만으로도 가치를 먼저 전달. 청구 흐름은 Phase 2까지 그대로 유지. PriceList 강제 안 함 | [§7-3](#7-3-ux-정책) |
| 단가표 입력이 운영 부담 | 도입 실패 | 시드 데이터 + 자유 입력 fallback 영구 허용. 단가표는 권장이지 필수가 아님 | [§7-3](#7-3-ux-정책) |
| 바우처 정책이 센터마다 너무 다름 | Phase 4 지연 | Phase 4 시작 전 운영팀과 5개 이상 센터 인터뷰. 본 마이그레이션 진행에는 무관 | [§7-6](#7-6-미결정-운영-상황-봐서-결정--본-마이그레이션-진행에는-무관) |
| Phase 3 영수증 번호 동시성 | 부분결제 시 중복 시퀀스 | PostgreSQL row-level lock (`SELECT ... FOR UPDATE`) + 같은 billable 내에서만 시퀀스 관리 | [§7-5](#7-5-docspaymentsummarymd-8개-미결-정책-중-영향-항목) |
| Phase 3에서 환불 모달과 결제 모달 혼동 | UX 사고 | 시각적으로 명확히 구분(빨간 톤), 권한 분리(`manage:billing`만 환불), 환불 사유 필수 | [§7-4](#7-4-권한), Phase 3 |
| `_legacy/payment/`로 옮긴 후 기존 import 누락 | 빌드 실패 | Phase 3 사전 작업에 import 일괄 치환 명시. CI에서 잡힘 | [§7-1](#7-1-모듈-구조) |
| Phase 2 변환 시 `completed_at` 정보 손실 | Phase 3 legacy Payment 생성 불가 | Phase 2 변환 스크립트가 `PaymentRecord.completed_at`을 `Billable`의 메타에 보존. Phase 3 작업 시 이 정보 활용 | Phase 3 데이터 마이그레이션 |
| 기존 [docs/payment/](../payment/)와 본 문서가 다시 어긋남 | 문서 부채 | 본 마이그레이션이 끝나면 [docs/billing/domain.md](./domain.md) 폐기, [docs/payment/](../payment/)를 정답으로 일원화 | [§9-3](#9-3-폐기-예정-문서) |

---

## 9. 부록

### 9-1. 관련 파일

**백엔드**:
- [apps/api/app/modules/billing/payment/models.py](../../apps/api/app/modules/billing/payment/models.py) — 현재 PaymentRecord
- [apps/api/app/modules/billing/facade/payment_facade.py](../../apps/api/app/modules/billing/facade/payment_facade.py)
- [apps/api/app/modules/billing/router.py](../../apps/api/app/modules/billing/router.py)

**프론트엔드**:
- [apps/web/src/routes/(protected)/billing/+page.svelte](../../apps/web/src/routes/(protected)/billing/+page.svelte)
- [apps/web/src/lib/features/billing/](../../apps/web/src/lib/features/billing/)
- [apps/web/src/lib/hooks/actions/billing.action.ts](../../apps/web/src/lib/hooks/actions/billing.action.ts)

### 9-2. 참조 문서 (정답 설계)

- [docs/payment/README.md](../payment/README.md) — 문서 인덱스
- [docs/payment/summary.md](../payment/summary.md) — 핵심 정책 + 결정 필요 사항 (필독)
- [docs/payment/domain.md](../payment/domain.md) — 엔티티 풀 설계
- [docs/payment/api-spec.md](../payment/api-spec.md) — REST API 상세
- [docs/payment/events.md](../payment/events.md) — 도메인 이벤트
- [docs/payment/scenarios.md](../payment/scenarios.md) — 10개 시나리오
- [docs/payment/edge-cases.md](../payment/edge-cases.md) — 18개 예외 상황
- [docs/payment/decision-log.md](../payment/decision-log.md) — 의사결정 기록
- [docs/payment/competitor-analysis.md](../payment/competitor-analysis.md)

### 9-3. 폐기 예정 문서

- [docs/billing/domain.md](./domain.md) — Phase 2 완료 후 폐기 또는 deprecated 표시

---

## 10. 다음 액션

Phase 0(정렬)이 완료되었으므로 즉시 Phase 1 작업에 착수할 수 있다.

### 즉시 (Phase 0 잔여)
1. 본 문서 + [§7](#7-phase-0-결정-사항-확정--2026-04-08) 결정 사항을 팀에 공유
2. Phase 1 작업 착수 승인
3. (선택) [docs/billing/domain.md](./domain.md) 상단에 deprecated 안내문 추가

### Phase 1 (단가표 단독 도입)

[§5 Phase 1](#phase-1--단가표-pricelist-단독-도입) 체크리스트를 따른다. 권장 작업 순서:

1. **백엔드**:
   - `billing/price_list/` 서브모듈 스캐폴딩 (CLAUDE.md의 단순 모듈 패턴: Handler → Service)
   - `PriceListFacade` 작성
   - Alembic 마이그레이션 작성·적용
   - 시드 데이터 (실제 센터 운영 단가 샘플 5~10개)
2. **프론트엔드**:
   - `features/price-list/` 스캐폴딩 (V4 아키텍처)
   - `/settings/price-list` 페이지
   - 사이드바 메뉴 추가
3. **기존 화면 보강** (선택):
   - BillingModal에 "단가표에서 불러오기" 추가
4. **검증**:
   - 운영팀에 단가표 입력 시연
   - 청구 추가 시 단가표 활용성 확인
5. **승인 후 Phase 2 시작**

### Phase 2 이후

- Phase 2: [§5 Phase 2](#phase-2--billable--billableitem-모델-마이그레이션) — 백업·검증 절차 엄수
- Phase 3: [§5 Phase 3](#phase-3--payment--결제-등록--환불) — `_legacy/payment/` 이동 + 환불 모달
- Phase 4 시작 전: [§7-6](#7-6-미결정-운영-상황-봐서-결정--본-마이그레이션-진행에는-무관) 운영 정책 결정 (운영팀 5개 센터 이상 인터뷰)
- Phase 5: 자동/일괄 청구 및 리포트

---

**문서 끝**.
