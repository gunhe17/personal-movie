# 그룹 청구 Billable 전환 계획

> **작성일**: 2026-04-13
> **상태**: 제안 (검토 필요)
> **선행 작업**: 단일 청구 Billable 전환 + 최적화 완료

---

## 1. 현재 상태

### 단일 세션 (1명) — Billable 전환 완료 ✅
```
스케줄 상세 → "청구하기" → BillableCreateModal (신 시스템)
           → "청구 확인" → BillableDetailModal (신 시스템)
```

### 그룹 세션 (2명+) — Legacy 사용 중 ⚠️
```
스케줄 상세 → "청구하기/확인" → BillingParticipantSelectModal
  ├─ 미청구 참여자 선택 → postBilling() 반복 호출 (구 시스템)
  └─ 청구된 참여자 클릭 → getBillingDetail() → BillingModal (구 시스템)
```

### 문제점
1. **이중 시스템**: 단일은 Billable, 그룹은 PaymentRecord — 데이터 분산
2. **이중 쿼리**: `getBillingByRelated` + `getBillableByRelated` 동시 호출
3. **기능 격차**: 그룹 청구에서 항목별 단가/수량, 결제 추적 불가 (legacy 한계)
4. **legacy 코드 삭제 차단**: 그룹 흐름이 legacy를 잡고 있어서 정리 불가

---

## 2. 목표 상태

```
스케줄 상세 → 그룹 "청구하기" → BillableParticipantSelectModal (신규)
  ├─ 미청구 참여자 선택 → 참여자별 BillableCreateModal (신 시스템)
  └─ 청구된 참여자 클릭 → BillableDetailModal (신 시스템)

스케줄 상세 → 그룹 "청구 확인" → BillableParticipantSelectModal
  └─ 모든 참여자 청구됨 상태 확인 + 개별 상세 조회
```

**핵심 변경**: Legacy `postBilling` → `postBillable`, Legacy `BillingModal` → `BillableDetailModal`

---

## 3. 구현 전략: 2단계

### Step 1: 그룹 청구 Billable 전환

#### 3-1. `billable-service.ts` 확장
`openGroupCreateModal` 추가. 기존 `billing-service.ts`의 `openGroupCreateModal`을 Billable 버전으로.

```typescript
openGroupCreateModal(
  participants: Participant[],
  prefillItems: PrefillItem[],
  basePrefill: BasePrefill,
  opts: {
    billedClientIds: string[]         // billable 기반
    billableMap: Record<string, string>  // client_id → billable_id
    canWrite: boolean
    onClose?: () => void
    BillableCreateModal: any
    BillableDetailModal: any
  }
)
```

**onConfirm 흐름 (참여자별 청구 생성)**:
- 선택된 참여자 각각에 대해 `postBillable()` 호출
- prefillItems (단가표 매칭 결과)를 items로 변환
- `related_type`, `related_case_id`를 각 item에 설정
- 성공/실패 카운트 toast

**onViewBilling 흐름 (기존 청구 조회)**:
- `billableMap[clientId]`로 billable_id 조회
- `billableService.openDetailModal(BillableDetailModal, billableId, canWrite)`

#### 3-2. `schedule-billing-service.ts` 수정
`openGroupBilling`에서:
- `existingBillings` (legacy) → `existingBillables` (신) 로 전환
- `billingService.openGroupCreateModal` → `billableService.openGroupCreateModal`
- `matchPriceListItems` 결과를 그룹 모달에도 전달

#### 3-3. `ScheduleDetailModal.svelte` 수정
- `handleGroupBilling`의 params에서 `existingBillings` → `existingBillables`
- `existingBillingQuery` (legacy) 제거 가능

#### 3-4. `BillingParticipantSelectModal` 재사용 또는 신규
- **Option A (권장)**: 기존 모달 그대로 재사용
  - props 인터페이스 동일 (participants, billedClientIds, onConfirm, onViewBilling)
  - 서비스 레이어에서 API만 바꾸면 됨
- **Option B**: 새 `BillableParticipantSelectModal` 생성
  - 기존과 거의 동일, Billable 전용 UI 차별화 시

---

### Step 2: Legacy 코드 제거

그룹 청구 전환 확인 후:

#### 프론트엔드 삭제 대상
- `billing-service.ts` — `openGroupCreateModal` + 관련 함수
- `billing.action.ts` — `postBilling`, `getBillingByRelated`, `patchBilling` 등
- `BillingModal.svelte` — legacy 청구 모달
- `BillingCard.svelte` — legacy 카드 컴포넌트
- `ScheduleDetailModal.svelte` — `existingBillingQuery`, `existingBillings` 제거

#### 백엔드 삭제 대상
- `billing/_legacy_payment/` — legacy 모듈 전체
- `facade/legacy_payment_facade.py` — legacy Facade

---

## 4. 수정 대상 파일 목록

### Step 1 (전환)
| 파일 | 변경 |
|------|------|
| `features/billing/billable-service.ts` | `openGroupCreateModal` 추가 |
| `features/schedule/calendar/schedule-billing-service.ts` | `openGroupBilling` 수정 (billable 전환) |
| `components/modal/ScheduleDetailModal.svelte` | params 변경 |

### Step 2 (정리)
| 파일 | 변경 |
|------|------|
| `features/billing/billing-service.ts` | 삭제 또는 그룹 함수 제거 |
| `hooks/actions/billing.action.ts` | legacy 함수 제거 |
| `components/modal/BillingModal.svelte` | 삭제 |
| `components/modal/BillingCard.svelte` | 삭제 |
| `ScheduleDetailModal.svelte` | legacy 쿼리 제거 |
| `ScheduleDetailAssessmentBody.svelte` | `existingBillings` prop 제거 |
| `ScheduleDetailCounselingBody.svelte` | `existingBillings` prop 제거 |

---

## 5. 리스크 & 고려사항

### 기존 데이터 마이그레이션
- 기존 PaymentRecord 데이터 → Billable로 마이그레이션 필요?
- 또는 기존 데이터는 그대로 두고 신규만 Billable로?
- **권장**: 기존 데이터는 유지, 신규만 Billable. legacy 조회 API는 당분간 유지.

### 참여자별 단가 차등
- 현재: 모든 참여자에게 동일한 금액
- 향후: 참여자별 다른 항목/금액 가능 (BillableItem 구조가 지원)

### billingState 판별 변경
- 현재: `existingBillables` 기반 (단일만 정확)
- 전환 후: 그룹도 `existingBillables` 기반으로 통합 → 이중 쿼리 제거 가능

---

## 6. 검증 체크리스트

- [ ] 그룹 세션에서 "청구하기" 클릭 시 참여자 선택 모달 정상 표시
- [ ] 미청구 참여자 선택 후 Billable 청구서 생성 확인
- [ ] 청구된 참여자 클릭 시 BillableDetailModal 정상 표시
- [ ] 부분 청구 (일부 참여자만) 후 재진입 시 청구 상태 정확히 반영
- [ ] 모든 참여자 청구 완료 시 "청구 완료" 상태로 전환
- [ ] legacy 코드 제거 후 단일/그룹 모두 정상 동작
