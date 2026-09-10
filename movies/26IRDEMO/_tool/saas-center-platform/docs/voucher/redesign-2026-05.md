# 바우처 도메인 재설계 (2026-05)

> 작성일: 2026-05-21 (v3 — 단순화)
> 최종 갱신: 2026-05-21 (PR-C 2단계 완료 반영)
> 상태: PR-A/B/B'/C-1/C-2 완료, C-3(청구 화면) · C-4(정리) 대기
> 트리거:
> - 상담 접수 → 내담자 등록으로 카드 입력 위치 이동
> - 사회서비스 전자바우처 실 모델 검토 후 카드 추상화는 외부 시스템 책임으로 결정
> - **사용 증빙**을 핵심 가치로 재설정

---

## 배경 & 핵심 통찰

### 사회서비스 전자바우처의 실제 구조

- 한 장의 카드로 여러 사업 결제 가능, QR/지문 결제, 잔액 조회는 전자바우처 앱에서.
- 우리 시스템에는 외부 결제망 연동이 **없음**. 카드 컨테이너 모델을 우리 DB에 둬봐야 진실값과 분리된 그림자 사본만 만들어진다.

### 우리 시스템의 책임 재정의

> "우리는 잔액 관리 시스템이 아니라 **상담센터의 바우처 사용 증빙 시스템**이다."

- 결제는 외부 단말/앱에서. 우리는 그 결과를 수기 기록.
- 핵심 가치 = "어떤 내담자의 어떤 바우처 사업으로, 어떤 세션을, 얼마 차감해서 사용했는가" 추적.
- 잔액(remaining_sessions)은 운영자가 수기로 보정 가능한 그림자 값. 진실은 BillableItem 차감 이력이 보존한다.

---

## 도메인 모델 (확정안 — v3 단순)

```
Voucher (카탈로그, 사업 마스터)        ← 변경 없음
   ▼
CenterVoucher (센터 취급)             ← 변경 없음
   ▼
ClientVoucher (내담자 바우처)         ← case_id만 제거, 나머지 유지
   ├─ client_id, center_voucher_id
   ├─ total_sessions, remaining_sessions
   └─ valid_from / valid_until
   ▼
BillableItem (청구 = 사용 증빙의 본체)  ← 컬럼 그대로, 트랜잭셔널 제약 강화
   ├─ client_voucher_id              ← 어느 바우처에서 차감
   ├─ subsidy_amount                 ← 바우처 차감액
   ├─ related_case_id, related_session_id
   └─ amount, quantity, ...
```

**의도적으로 제외한 것:**
- ClientCard 컨테이너 — 외부 시스템에 두고, 우리 DB에는 평면 ClientVoucher만
- CaseDocument 신규 테이블 — 다음 PR
- Voucher.required_documents — 다른 사람이 진행 중, 손대지 않음
- Case.primary_card_voucher_id — 다음 PR (UI 재구성 시 필요해지면)
- card_number/issued_at 등 메타 컬럼 — MVP에서 빠짐

---

## 데이터 모델 변경

### ClientVoucher

| 변경 | 필드 |
|---|---|
| 제거 | `case_id` 컬럼 |
| 제거 | `idx_client_vouchers_case` 인덱스 |
| 제거 | `uq_client_vouchers_case_client_active` partial unique |

### BillableItem

- 컬럼은 그대로 두고, **사용 증빙 측면의 트랜잭셔널 제약을 강화**:
  - 생성 시 client_voucher_id가 set이면 remaining_sessions ≥ quantity 검증 후 차감
  - 수정 시 변경분 보정 (이미 일부 구현 — 검증 강화)
  - 삭제(soft) 시 잔액 복원
  - 이 검증을 Service 레벨에서 엄격하게 (지금은 일부 누락 가능)

---

## 핵심 워크플로우

```
[등록] 내담자 등록 시 또는 상세에서 ClientVoucher 발급 입력
       └→ client_vouchers row 생성 (case 연결 없음)

[접수] 케이스는 바우처 정보 없이 그냥 접수
       (필요 시 다음 PR에서 case에 voucher link 추가)

[진행] 회기/일지/공통 양식

[청구 생성] 담당자가 수기 트리거
       ☑ 바우처 사용
          → ClientVoucher 선택 (드롭다운, 유효한 것만)
          → BillableItem.client_voucher_id 설정
          → 트랜잭션으로 remaining_sessions 차감

[조회] 내담자/바우처 상세
       └→ 카드 잔액(remaining_sessions)
       └→ "사용 내역" 펼치면 BillableItem 목록
       └→ 월별 집계 (사업별 / 내담자별)
```

---

## API 변경 / 추가

### ClientVoucher 기존 API

- `POST /centers/{cid}/client-vouchers` — case_id 필드 제거
- `PATCH /centers/{cid}/client-vouchers/{id}` — case_id 필드 제거
- `GET /centers/{cid}/client-vouchers` — case_id 필터 제거 (기존 list_by_case 제거)
- `GET /centers/{cid}/client-vouchers/{id}` — 응답에서 case_id 제거

### ClientVoucher 신규 API (사용 증빙)

- **`GET /centers/{cid}/client-vouchers/{id}/usage`** — 이 바우처로 차감된 BillableItem 목록 + 합계
  - response: `{items: BillableItemSummary[], total_sessions_used, total_amount_used}`
- **`GET /centers/{cid}/client-vouchers/{id}/usage/monthly`** — 월별 집계
  - response: `[{year_month, sessions, amount, item_count}, ...]`

### 그 외

- BillableItem 생성/수정/삭제 service의 차감 로직 검증 강화 (기존 코드 정비)
- billing.facade에서 case_id 의존 제거 (`_apply_voucher` 등)

---

## 마이그레이션

| 단계 | 작업 |
|---|---|
| M1 | `client_vouchers.case_id` 컬럼 + 관련 인덱스/unique 제약 drop |

> 단 1개 마이그레이션. 데이터 손실 없음 (case_id 데이터는 BillableItem.related_case_id로 따로 추적 중이므로 무관).

---

## 위험 & 결정 사항

### 1. ClientVoucher의 case 연동을 진짜 끊어도 되는가
- 현재 frontend 일부 화면이 `voucher.caseId`를 보고 동작 (예: `VoucherDetailPanel.svelte`).
- 백엔드에서 컬럼 drop 시 응답 스키마에서 사라지고, 프론트가 깨질 수 있음.
- **방어**: 응답 스키마에서 `case_id: str | None`을 잠시 더 유지하되 항상 null 반환. 프론트가 안전하게 마이그레이션할 때까지 호환.
- 다음 PR에서 프론트 정리 후 응답에서도 완전 제거.

### 2. BillableItem 차감 트랜잭션의 현재 상태
- `create_billable.py`의 `_consume_vouchers` 등 일부 구현은 이미 있음.
- 강화 포인트:
  - update 시 quantity 변경 → 차이만큼 보정
  - soft delete 시 복원 (재호출 시 누락 위험 점검)
  - 모든 검증을 `EntityNotFoundException`/`InvalidOperationException` 도메인 예외로 통일

### 3. 사용 내역 API의 페이지네이션 정책
- 바우처 1개당 차감 이력은 최대 수십 건 수준 → 페이지네이션 없이 전체 반환.
- 월별 집계도 사업 1개당 수 개월 수준 → 페이지네이션 없이 전체.

---

## 진행 상황 (2026-05-22 기준)

### ✅ 완료 (커밋 대기)

#### PR-A — 상담 접수 정리 + 설계 문서
- `counseling/receive`에서 `VoucherSection` 및 관련 의존 모두 제거
- `VoucherSection.svelte`, `voucher-types.ts` 파일 삭제
- `lib/components/schedule/counsel/index.ts`, `lib/features/schedule/counsel/index.ts` export 정리
- 본 설계문서 추가

#### PR-B — 백엔드 v3 단순화
- **ClientVoucher 모델**: `case_id` 컬럼 + 관련 인덱스/제약 제거
- **스키마**: Create/Update에서 `case_id` 제거. Response의 `case_id`는 호환 위해 잠시 유지 (항상 null)
- **Repository**: `list_by_case`, `find_by_case_and_client` 제거
- **Service / Facade / Handler / Router**: case 검증 로직 + `CounselingCaseFacade` 의존 제거. `case_id` 쿼리/필드 제거
- **billing 외부 호출자**: `build_billable_prefill_for_case.py::_apply_voucher` 제거 (case-바우처 자동 prefill 더이상 없음)
- **차감 검증 강화** (`_consume_vouchers`):
  - 다른 내담자 바우처 차단
  - 유효기간 (`valid_from`/`valid_until`) 범위 검증
- **사용 증빙 API 신설**:
  - `GET /centers/{cid}/client-vouchers/{id}/usage` — 차감된 BillableItem + 합계
  - `GET /centers/{cid}/client-vouchers/{id}/usage/monthly` — billable_date 기준 월별 집계
- **마이그레이션** `1572993b0d9e`: `case_id` 컬럼/인덱스 drop. upgrade/downgrade 왕복 검증 완료

#### PR-B' — 금액 추적 확장
- **ClientVoucher 모델**: `total_amount`, `remaining_amount` 컬럼 추가 (nullable, 통지서 잔액 원액 그대로 입력)
- **스키마/Service**: amount 필드 검증 (remaining_amount 음수 허용 = 운영 보정 영역, total_amount 초과만 차단)
- **`_consume_vouchers`**: 청구 시 회기·금액 동시 차감. **회기는 부족 시 차단, 금액은 비차단 + warnings 누적**
- **BillableResponse**에 `warnings: list[str] = []` 필드 추가 — 잔액 부족 경고 메시지 노출
- **마이그레이션** `b5aa0037412f`: 금액 컬럼 2개 추가

#### PR-C 1단계 — 내담자 등록 화면 바우처 UI
- `features/clients/register/voucher-types.ts`: `VoucherRow` 타입 + 헬퍼
- `routes/(protected)/clients/register/components/VoucherSection.svelte`: 다중 발급 UI (사업 선택 → 회기/금액/유효기간 자동 프리필 + 사용자 보정)
- `register-service.ts`: 등록 응답에서 client_id 추출 후 각 row를 `postClientVoucher`로 순차 발급
- `register/+page.svelte`: 보호자 섹션 아래 바우처 섹션 노출 (등록 모드 전용)
- 검증: 부분 입력 차단, amount 음수 차단
- 액션 타입 `clientVoucher.action.ts`에 amount 필드 추가

#### PR-C 2단계 — 내담자 상세 바우처 패널 (완료)
> 결정: 디자인 톤은 유지하되 "케이스 단위" → "사용 회기 모음"으로 의미 변경. CRUD까지 한 번에 포함.

**Feature 모듈 확장**
- `clientVoucher.action.ts`: `getVoucherUsage`, `getVoucherUsageMonthly` 액션 + 응답 타입(`VoucherUsageResponse`, `VoucherMonthlyUsageResponse`)
- `features/clients/detail/voucher/view-model.ts`: `ClientVoucherCardVM`에 `centerVoucherId`/`totalAmount`/`remainingAmount` 추가. 사용내역 VM(`VoucherUsageMonthVM`, `VoucherUsageItemVM`) + `groupUsageByMonth` 헬퍼 추가
- `features/clients/detail/voucher/query-builders.ts`: `buildVoucherUsageInput` 추가
- `features/clients/detail/voucher/form-types.ts`: 단건 폼 데이터 타입(`VoucherFormData`, `VoucherFormErrors`) 신설. 등록 화면의 `VoucherRow`와 의도적으로 분리(모달=단건, 등록=다건)
- `features/clients/detail/voucher/voucher-service.ts`: 발급/수정/삭제 모달 + invalidate(`getClientVoucherList`, `getVoucherUsage*`) + 토스트 캡슐화

**UI 컴포넌트**
- `lib/components/clients/detail/VoucherFormModal.svelte` (신규): 발급/수정 공용 폼 모달.
  - 수정 모드에서는 사업 변경 잠금 (잘못된 사업 변경 방지)
  - 수정 모드에서만 잔여 회기/금액 "보정" 필드 노출 (음수 허용)
  - 사업 선택 시 빈 필드는 카탈로그 default로 자동 채움 (등록 화면 UX와 동일)
- `lib/components/clients/detail/VoucherDetailPanel.svelte`: **전면 재작성**.
  - 제거: case_id 기반 케이스 상세 링크, 진행 회기 목록, 일지 모달, 목업 서류 카드
  - 추가: 잔여 회기 진행률 카드(잔여 금액 포함, 음수일 때 빨간색 + "운영 보정으로 유지 중" 안내) / 월별 사용 내역(클릭 시 펼치면 BillableItem 상세) / 수정·삭제 버튼
  - 데이터: `getVoucherUsage` + `getVoucherUsageMonthly` 두 쿼리 사용. 월별 합계는 monthly API, 상세 펼침 시 usage API의 그룹핑 결과 사용

**진입점 연결**
- `lib/components/clients/detail/ContentPanel.svelte`: 바우처 탭 **항상 노출**(빈 상태에서도 발급 진입점 필요). 빈 상태에 "바우처 발급" CTA 버튼 + `onVoucherCreate`/`onVoucherEdit`/`onVoucherDelete` 콜백 통과
- `routes/(protected)/clients/[clientId]/+page.svelte`: `createVoucherService` 주입(`clientId` 변경 시 재생성). ContentPanel에 CRUD 핸들러 전달

**검증**
- `npm run check`: 본 작업 파일들 0 errors / 0 warnings (전체는 기존 47 errors 유지, 우리 변경으로 새 에러 0건)

---

#### PR-C 3단계 보강 — 지원금 입력을 청구서 단위로 (2026-05-22)
**의도**: 사용자 모델에서 지원금은 "거래(청구서) 단위"가 자연스러움. 항목별 입력은 v3 모델과 안 맞고 시니어 입장에서도 헷갈림.

**모델 정합 정책**
- 입력: 사용자가 청구서 단위 `subsidy_amount` 하나만 입력 (UI 한 줄)
- 저장: `Billable.subsidy_amount`에 그대로 + `BillableItem.subsidy_amount`에는 바우처 연결 item들에 회기 비율로 분배 (usage API 추적용 유지)
- → v3 핵심 "세션 단위 차감 추적" 그대로 보존, 사용자 모델만 단순화

**백엔드**
- `BillableItemCreate.subsidy_amount` 입력 제거. 응답 필드(`BillableItemResponse.subsidy_amount`)는 유지 (분배값 노출)
- `BillableCreate.subsidy_amount` 추가
- `BillableItem.subsidy_amount` 모델 comment 갱신 (= 분배값 의미)
- `create_billable.py`:
  - 사전 단계로 정가 합계 + 바우처 연결 item 인덱스 수집
  - `subsidy_amount > 0`인데 바우처 연결 item 0개면 차단
  - 청구서 subsidy를 voucher 연결 item들에 회기 비율로 분배 (rounding 마지막 item에서 흡수)
  - 분배값을 voucher별로 묶어 `_consume_vouchers`에 그대로 전달
- `update_billable.py`: 변경 없음 — 이미 `billable.subsidy_amount` 단독 사용
- 마이그레이션: 불필요 (컬럼 추가/제거 없음)

**프론트**
- `billable.action.ts`: `BillableItemCreatePayload.subsidy_amount` 제거, `CreateBillablePayload.subsidy_amount` 추가
- `features/billing/components/create/types.ts`: `ItemRow.subsidyAmount` 제거 (PrefillItem은 그대로 — voucher 표시 필드만 남음)
- `helpers.ts`: `sumSubsidies` 제거. `buildCreatePayload`에 `subsidyAmount` 인자 추가하고 payload 최상위에 세팅
- `parts/BillableItemRow.svelte`: 하단 지원금 입력/본인부담 박스 + 핸들러 제거. 상단 voucher 칩은 유지
- `parts/SubsidyField.svelte` (신규): 청구서 단위 지원금 한 줄 입력. 바우처 미선택 시 disabled 상태 안내
- 3개 모달 모두 `subsidyAmount` 상태 + `SubsidyField` 배치 (BillableItemList 아래). 검증: `subsidyExceedsSubtotal` 차단, `voucherAmountShortage` 비차단 안내

**검증**: `npm run check` 우리 변경 파일 0 errors. 전체 47 유지. 백엔드 import 스모크 통과.

---

#### PR-C 3단계 — 청구 화면 v3 적응 (완료 2026-05-22)
**증빙 흐름 완성**: 등록 → 사용 → 기록까지 닫음.

**액션 / 서비스**
- `billable.action.ts`: `BillableDetail.warnings?: string[]` 필드 추가 (생성/수정 응답 비차단 경고 채널)
- `billing/billable-service.ts`: `createBillableHandler`에서 응답의 warnings 추출 → 토스트 노출. `extractWarnings()` 헬퍼는 평평/래퍼 두 응답 형태 모두 대응

**공용 UI**
- `features/billing/components/create/parts/VoucherField.svelte` (신규): 내담자 변경 시 `getClientVoucherList` 자동 조회 → 사용 가능한 바우처(잔여 회기>0, 유효기간 내) 필터링 → 드롭다운. 선택 시 잔여 회기/금액·지원금 안내 칩 표시. `SelectedVoucher` 타입 export
- `features/billing/components/create/helpers.ts`: `buildVoucherPatch()` 헬퍼 추가 — `SelectedVoucher` → `ItemRow` voucher 필드 patch (해제 시 null 클리어)

**세 모달 모두 적용** (`BillableCreateModal` / `SessionBillingModal` / `PackageBillingModal`)
- ClientField 바로 아래에 VoucherField 배치 (내담자 → 바우처 → 항목 흐름)
- `selectedVoucher` 상태 + `handleVoucherChange()` — 기존 items 일괄 patch
- `$effect`로 모달 내부에서 새로 추가된 items에도 현재 voucher 자동 부착 (priceList Select, "직접 입력", relation prefill 모두 커버)
- `voucherSessionsShortage` 차단 (잔여 회기 < 청구 회기 → canSubmit false, 빨간 박스 안내)
- `voucherAmountShortage` 비차단 (잔여 금액 < 지원금 합 → 노란 박스 안내, 진행 가능)

**검증**: `npm run check` 우리 변경 파일 0 errors / 0 warnings. 전체는 기존 47 errors 유지.

---

## 남은 작업 (우선순위 순)

#### PR-C 4단계 — 정리 (프론트 완료, 백엔드 대기)
**프론트 (2026-05-22 완료)**
- `clientVoucher.action.ts`: `ClientVoucherResponse.case_id` / `CreateClientVoucherPayload.case_id` / `UpdateClientVoucherPayload.case_id` / `getClientVoucherList`의 `case_id` 쿼리 파라미터 제거
- `features/clients/detail/voucher/view-model.ts`: `ClientVoucherCardVM.caseId` 필드 + 매핑 제거
- `features/clients/detail/voucher/query-builders.ts`: 불용 `buildCounselingDetailInput` 제거 (counseling/detail에 동명 함수 존재, voucher 폴더에 남아있던 잔재) + index export 정리
- `features/billing/components/create/helpers.ts`: `attachVoucherToPrefill` 함수 완전 제거 (v3에서 case-바우처 자동 prefill 폐기). 호출처 2곳(`BillableCreateModal.svelte`, `MissingSessionBanner.svelte`)도 단순 baseItems 전달로 단순화
- `lib/components/clients/detail/ContentPanel.svelte`: 바우처 탭 빈 상태를 `NoDataSection`으로 통일 (사전기록지·문서관리 톤 일치). "좌측에서 바우처 선택" 안내도 동일 컴포넌트로 매치
- `lib/components/clients/detail/ProfileSection.svelte`: 좌측 패널 빈 상태 CTA를 "상담 접수하기 (→ /counseling/receive)"에서 발급 모달(`voucherService.openCreateModal`)을 여는 "바우처 발급" 버튼으로 교체. `goto` / `NavigateIcon20` import 제거, `onVoucherCreate?: () => void` props 추가
- `routes/(protected)/clients/[clientId]/+page.svelte`: ProfileSection에 `onVoucherCreate={voucherService.openCreateModal}` 콜백 전달

**검증**: `npm run check` 우리 변경 파일 0 errors / 0 warnings, 전체는 기존 47 errors 유지 (우리 변경으로 새 에러 0)

**남은 백엔드 정리 (PR-C 4단계 후속)**
- `ClientVoucherResponse` 스키마에서 호환용 `case_id` 필드 응답 제거 (현재 항상 null로 직렬화 중)

### 🥉 PR-C 추가 검증 (사용자 손)
- dev 서버에서 실제 흐름 확인 필요:
  - 발급 모달: 사업 선택 → 자동 프리필 → 발급 → 패널/목록 즉시 갱신
  - 수정 모달: 잔여 보정 필드(음수 포함) 입력 → 저장
  - 삭제: confirm → 토스트 → 목록 갱신
  - 사용 내역: 청구 발생한 바우처에서 월별 요약 → 펼침 → 상세 표시
- 모바일 뷰(오버레이 모드)에서도 동작 확인

### 4. 별건 — 테스트 DB 분리 (재발 방지)
- `tests/conftest.py:16`의 `TEST_DATABASE_URL`이 dev DB와 동일 → 통합 테스트가 dev 데이터 TRUNCATE 가능
- 별도 DB(`imomtae_test`)로 분리 + conftest에 안전 가드 (`if "test" not in url: raise`)
- 이번 작업 중 데이터 손실 사고 발생 → 우선순위 별개 작업

### 5. 다음에 (다른 사람 또는 후속)
- **PR-D**: `Voucher.required_documents` + `CaseDocument` 모듈 (서류 양식/작성)
- **PR-E**: Case ↔ 바우처 명시 link (서류 양식 결정용, 필요해질 때만)

---

## 위험·결정 추적

| 항목 | 상태 |
|---|---|
| `ClientVoucherResponse.case_id` 호환 유지 | 프론트 제거 완료 (2026-05-22). 백엔드 응답 스키마는 여전히 항상 null로 흘려보내는 중 — 백엔드 정리 대기 |
| `BillableItem` update/delete 시 voucher 복원 | 현행 정책 유지 (복원 X). 미래 draft 청구 기능 추가 시 재검토 필요 |
| `remaining_amount` 음수 허용 | 의도된 동작 (운영 보정용). 음수 시 경고 토스트로 안내 |
| 백엔드 응답이 평평/래퍼 혼재 | `register-service`에서 `extractCreatedId` 패턴으로 둘 다 대응 (다른 모듈도 동일 방어 패턴 사용 중) |

---

## 핵심 가치 달성도

| 가치 | 상태 | 비고 |
|---|---|---|
| ① 등록 시점 바우처 입력 | ✅ 완료 | 다중 발급, 회기·금액·유효기간 |
| ② 잔액 확인 (한눈에) | ✅ 완료 | 내담자 상세 바우처 패널 — 진행률 카드 + 잔여 금액(음수 보정 표시) |
| ③ 사용 증빙 추적 | ✅ 완료 | 월별 요약 + 펼치면 BillableItem 상세 |
| ④ 청구 시 자동 차감 | ✅ 완료 | 회기·금액 모두. 프론트 청구 모달 3종 모두 수기 바우처 선택 + 잔여 부족 안내 + warnings 토스트 |
| ⑤ 자비/바우처 구분 | ✅ | `client_voucher_id` null 여부로 명확 |
| ⑥ 무결성/안전성 | ✅ | 유효기간·다른 내담자·잔액 모두 검증 |
| ⑦ 외부 시스템과 책임 분리 | ✅ | 그림자 기록 + 보정 + 증빙 모델로 명확화 |
| ⑧ 발급/수정/삭제 (수기 관리) | ✅ 완료 | 내담자 상세 패널에서 CRUD 가능 (수정 시 사업 변경 잠금, 잔여 보정 가능) |

**전체 진행률 약 90%**. 등록 → 조회 → 사용 증빙까지 사용자 흐름 완성. 남은 건 청구 화면(PR-C 3단계)과 정리(PR-C 4단계).
