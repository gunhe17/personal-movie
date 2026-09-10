# 청구 기능 피드백 반영 — 완료 보고서

> 사용자 피드백을 받아 청구 상태/결제 플로우를 단순화했다. (2026-04-14)

---

## 변경 요지 (완료)

| # | 항목 | AS-IS | TO-BE | 상태 |
|---|---|---|---|---|
| 1 | 청구서 생성 | `draft`로 생성 → 발행 버튼 눌러야 `issued` | 생성 즉시 `issued` | ✅ |
| 2 | 완납 처리 | `issued` 상태에서 "완납 처리" 버튼 수동 클릭 | 미수금=0이 되면 자동 `paid` 전환 | ✅ |
| 3 | "결제 등록" 워딩 | "결제 등록" / "결제 내역" | "납부 등록" / "납부 기록" | ✅ |
| 4 | 부분 결제 후 모달 | 결제 등록 후 청구 상세 모달까지 같이 닫힘 | 부분 결제 시 청구 상세 모달 유지 + 자동 갱신 | ✅ |
| 5 | 청구서 삭제 | 바로 삭제 | `DeleteConfirmModal` 확인 후 삭제 | ✅ |
| 6 | 스케줄 연계 생성 시 항목 잠금 | prefill 항목 수정/삭제 불가 | 내담자만 고정, 항목은 자유롭게 수정/추가/삭제 | ✅ |

---

## 1. 청구서 생성 시 즉시 `issued` ✅

### 구현
- [create_billable.py](apps/api/app/modules/billing/billable/services/create_billable.py) — `status: "issued"` + `issued_at: now()` 즉시 기록
- [BillableDetailModal.svelte](apps/web/src/routes/(protected)/billing/components/BillableDetailModal.svelte) — 발행하기/완납 처리 버튼 + 알림 토글 **주석 처리** (나중에 복구 가능하도록 git history 참고 안내)

### 알림 기능 상태
- **실제 SMS 발송 안 됨** (재확인 완료)
- `send_invoice_notification.py`는 100% STUB — 로그만 찍고 `notification_sent_at`만 DB 기록
- `send_notification=True`일 때만 호출되는 이중 보호도 유지
- 알림 관련 코드/상수/DB 템플릿 모두 유지 — 나중에 되살리기 쉬움

---

## 2. 미수금 = 0 → 자동 `paid` ✅

### 구현
- [create_payment.py](apps/api/app/modules/billing/payment/services/create_payment.py):
  - `amount <= 0` 거부 (`InvalidOperationException`)
  - `amount > unpaid_amount` 거부 — **과오납 방지**
  - 결제 반영 후 `unpaid <= 0`이면 자동 `status: "paid"` 전환
- [PaymentModal.svelte](apps/web/src/routes/(protected)/billing/components/PaymentModal.svelte):
  - 입력 상한을 `unpaidAmount`로 제한 (`Math.min` 적용)
  - `isValid`에 `amount <= unpaidAmount` 범위 검증 추가

### 프론트/백 이중 검증
- 프론트: UX 측면 — 사용자가 애초에 초과값 입력 불가
- 백엔드: 방어 측면 — API 직접 호출이나 동시성 상황 대비

### 제외한 항목
- 환불 시 `paid → issued` 역전환: Phase 4(환불) 범위
- 완납 알림: MVP에서 제외

---

## 3. 워딩 변경 ✅

### 매핑
| AS-IS | TO-BE |
|---|---|
| 결제 등록 (버튼/타이틀) | 납부 등록 |
| 결제 내역 | 납부 기록 |
| 결제액 | 납부액 |
| 결제 금액 | 납부 금액 |
| 결제 수단 | 납부 수단 |
| 결제일시 | 납부일시 |
| 결제가 등록되었습니다 | 납부 기록이 추가되었습니다 |
| 결제 등록에 실패했습니다 | 납부 기록 추가에 실패했습니다 |

### 적용 파일
- [+page.svelte](apps/web/src/routes/(protected)/billing/+page.svelte) — 테이블 컬럼 라벨
- [BillableDetailModal.svelte](apps/web/src/routes/(protected)/billing/components/BillableDetailModal.svelte) — 섹션 제목/버튼
- [PaymentModal.svelte](apps/web/src/routes/(protected)/billing/components/PaymentModal.svelte) — 타이틀/라벨/버튼
- [billable-service.ts](apps/web/src/lib/features/billing/billable-service.ts) — 스낵바 메시지

---

## 4. 부분 결제 후 모달 유지 ✅ (쿼리 기반 리팩토링)

### BillableDetailModal 리팩토링 (옵션 B)
- `detail: BillableDetailVM` prop 제거 → `billableId: string` prop으로 변경
- 내부에서 `queryBuilder`로 detail + payments 자체 조회
- 로딩 상태: **스피너 + "불러오는 중..."**
- invalidate만으로 자동 갱신

### billable-service.ts 변경
- `openDetailModal`: pre-fetch 제거, billableId만 전달
- `onCreatePayment` 콜백: `modalStore.closeAll()` **제거**
  - PaymentModal은 자체 `closeModal()`로 닫힘
  - BillableDetailModal은 유지되며 invalidate로 자동 갱신
- `invalidateList` + `invalidateDetail` + `invalidatePayments` 셋 다 호출

### 동작
- **부분 결제**: PaymentModal만 닫히고 상세 유지 → 연속 납부 기록 추가 가능
- **전액 결제**: 상세 모달은 유지되지만 상태가 `paid`로 자동 전환 → 사용자가 확인 후 직접 닫기

---

## 5. 청구서 삭제 확인 모달 ✅

### 구현
- [billable-service.ts](apps/web/src/lib/features/billing/billable-service.ts) — `onDelete` 콜백이 `DeleteConfirmModal`을 먼저 오픈
- price-list 페이지와 동일한 패턴으로 일관성 유지

### 모달 내용
- 제목: "청구서를 삭제할까요?"
- 설명: "삭제된 청구서는 복구할 수 없습니다"
- 버튼: `닫기` / `삭제`

---

## 6. 스케줄 연계 생성 시 항목 자유 수정 ✅

### 변경
[BillableCreateModal.svelte](apps/web/src/routes/(protected)/billing/components/BillableCreateModal.svelte):
- prefill 항목들의 `locked: true` → `locked: false`
- "+ 직접 입력" 버튼 항상 표시
- 단가표 Select도 항상 표시

### 동작
| 항목 | 스케줄 연계 시 |
|---|---|
| 내담자 | 고정 (`showDelete={!hasPrefillItems}` 유지) |
| 자동 채워진 항목 | 설명/수량/단가 수정 + 삭제 가능 |
| 추가 항목 | 단가표에서 선택 또는 직접 입력 가능 |

---

## 작업 순서 (실제)

1. ✅ **#1** 생성 즉시 issued + 알림 UI 주석 처리
2. ✅ **#2** 과오납 검증 + 자동 완납 전환
3. ✅ **#3** 워딩 일괄 교체
4. ✅ **#4** BillableDetailModal 쿼리 기반 리팩토링 + 부분 결제 시 상세 모달 유지
5. ✅ **#5** 청구서 삭제 확인 모달
6. ✅ **#6** 스케줄 연계 생성 시 항목 잠금 해제

---

## 관련 파일

### 백엔드
- [apps/api/app/modules/billing/billable/services/create_billable.py](apps/api/app/modules/billing/billable/services/create_billable.py)
- [apps/api/app/modules/billing/billable/services/send_invoice_notification.py](apps/api/app/modules/billing/billable/services/send_invoice_notification.py) — STUB 유지
- [apps/api/app/modules/billing/payment/services/create_payment.py](apps/api/app/modules/billing/payment/services/create_payment.py)

### 프론트
- [apps/web/src/routes/(protected)/billing/components/BillableCreateModal.svelte](apps/web/src/routes/(protected)/billing/components/BillableCreateModal.svelte) — 항목 잠금 해제
- [apps/web/src/routes/(protected)/billing/components/BillableDetailModal.svelte](apps/web/src/routes/(protected)/billing/components/BillableDetailModal.svelte) — 쿼리 기반 + 버튼 주석 처리
- [apps/web/src/routes/(protected)/billing/components/PaymentModal.svelte](apps/web/src/routes/(protected)/billing/components/PaymentModal.svelte) — 과오납 방지 + 워딩
- [apps/web/src/lib/features/billing/billable-service.ts](apps/web/src/lib/features/billing/billable-service.ts) — 삭제 확인 + 모달 유지 + invalidate
- [apps/web/src/routes/(protected)/billing/+page.svelte](apps/web/src/routes/(protected)/billing/+page.svelte) — 워딩

---

## 향후 작업 (Phase 4 범위)

- 환불 플로우 (`paid → issued` 역전환)
- 결제 취소/삭제
- 바우처 (`VoucherPolicy` + `ClientVoucher`)
- 알림 기능 실제 연동 재활성화 검토
- PG 연동 시 결제 링크 발송
