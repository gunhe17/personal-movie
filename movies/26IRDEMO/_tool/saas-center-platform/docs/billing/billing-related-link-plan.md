# 청구서 생성 모달 ↔ 세션/검사 역방향 연동 플랜

> 작성일: 2026-04-16
> 상태: 제안 (Draft)

## 배경

Phase 1~3.5에서 **세션/검사 상세 → 청구서 생성** 방향의 연동은 완료됨.
- [assessment-billing-service.ts](../../apps/web/src/lib/features/assessment/status-detail/assessment-billing-service.ts)
- [counseling-billing-service.ts](../../apps/web/src/lib/features/counseling/detail/counseling-billing-service.ts)
- [BillingActionButton.svelte](../../apps/web/src/lib/features/billing/components/BillingActionButton.svelte)

상세 페이지에서 모달을 열면 `prefill`로 client/items/relatedType/relatedCaseId/relatedSessionId가 채워져서 생성됨.

**이번 작업의 목적:** 청구 내역 페이지(`/billing`)의 "청구서 생성" 버튼으로 모달을 열었을 때, **반대로 상담 세션이나 검사 케이스를 선택해서 연동**할 수 있게 한다.

## 문제 정의

현재 `/billing` 페이지에서 모달을 열면 `prefill`이 비어있어서:
- 내담자를 먼저 선택 → 단가표에서 항목 추가 → 생성
- `related_type/case_id/session_id`가 모두 `undefined`로 전송됨
- 생성된 청구서가 어떤 세션/검사 건인지 역추적 불가

이 상태에서도 기능은 동작하지만, 양방향 연동의 일관성이 깨짐. 또한 청구 담당자가 "이 청구가 어떤 세션/검사 건인지" 확인하려면 상세 페이지에서 다시 생성해야 해서 UX가 나쁨.

## 제안: 내담자 선택 후 "연동" 선택 스텝 추가

### 흐름

```
1. 내담자 선택 (기존)
   ↓
2. [NEW] 연동 옵션 선택 (선택적)
   - 연동 없음 (기본)
   - 상담 세션 연동
   - 검사 케이스 연동
   ↓
3. 연동 선택 시: 해당 내담자의 세션/검사 목록에서 선택
   → 선택 시 items 자동 prefill + related_* 자동 세팅
   ↓
4. 항목 편집 / 추가 (기존)
   ↓
5. 생성 (기존)
```

### 핵심 원칙

- **선택 사항 (Optional)**: 연동 없이도 생성 가능. 기존 플로우 유지.
- **내담자 선택 선행**: 내담자가 없으면 세션/검사 목록을 가져올 수 없음. 내담자 선택 전에는 연동 UI 비활성화.
- **내담자 변경 시 리셋**: 내담자를 바꾸면 연동 선택도 초기화.
- **prefill과 동일한 모양으로 수렴**: 상세 페이지에서 열 때와 내부 상태 구조가 같아야 함 (items + relatedType/CaseId/SessionId).

## 영향받는 파일

### 수정
- `apps/web/src/routes/(protected)/billing/components/BillableCreateModal.svelte`
  - 내담자 선택 하단에 "연동" 섹션 추가
  - 연동 타입 토글 (없음 / 상담 / 검사)
  - 내담자별 세션/케이스 목록 조회 + 선택 드롭다운
  - 선택 시 items auto-fill 로직
  - 내담자 변경 시 연동 상태 리셋

### 신규 (선택적)
- `apps/web/src/lib/features/billing/components/BillableRelationPicker.svelte`
  - 모달 내부 전용 컴포넌트로 분리하면 유지보수가 쉬움
  - 단, ~100줄 이하로 끝날 것 같으면 모달 내부에 인라인으로 두고 나중에 분리

### 참고/재사용
- `apps/web/src/lib/hooks/actions/case.action.ts` — 검사 케이스 조회
- `apps/web/src/lib/hooks/actions/counseling.action.ts` 또는 `session.action.ts` — 상담 세션 조회
- `apps/web/src/lib/features/assessment/status-detail/assessment-billing-service.ts` — items 생성 로직 참고
- `apps/web/src/lib/features/counseling/detail/counseling-billing-service.ts` — 동일

## 작업 단계

### Step 1. 액션 확인 및 쿼리 패턴 결정 (탐색)
- `case.action.ts` / `counseling.action.ts` / `session.action.ts` 훑어보고
  - 내담자 ID로 필터링 가능한 list 엔드포인트가 있는지 확인
  - 없으면 백엔드에 `client_id` 쿼리 파라미터 추가 필요 여부 판단
- queryBuilder 사용 가능 여부 확인

### Step 2. items 변환 로직 공통화
- 기존 `assessment-billing-service.ts` / `counseling-billing-service.ts`에 세션/검사 → `PrefillItem[]` 변환 로직이 있음
- 이를 순수 함수로 추출해서 `features/billing/`에 공통화하면 모달에서도 재사용 가능
  - 예: `buildItemsFromSession(session)`, `buildItemsFromCase(caseData)`

### Step 3. 모달 UI 추가
- 내담자 선택 하단에 연동 섹션 추가
- 타입 토글(없음/상담/검사) + 목록 드롭다운
- 선택 시 items/relatedType/relatedCaseId/relatedSessionId 상태 업데이트
- 기존 `locked` 플래그 재사용해서 자동 채워진 항목 잠금 처리 (선택)

### Step 4. 엣지 케이스
- 내담자 변경 → 연동 해제 + items 초기화 (또는 사용자 확인)
- 연동 해제 → relatedType 등 null로 리셋, items는 유지할지 초기화할지 정책 결정
- 이미 청구된 세션/검사는 드롭다운에서 제외하거나 표시 (중복 청구 방지)

### Step 5. 검증
- 상세 페이지에서 열 때와 목록 페이지에서 연동 선택 후 열 때 결과 payload 일치 여부 확인
- 내담자 없이 연동 시도 시 UI가 막히는지 확인

## 결정사항

1. **이미 청구된 세션/검사 처리**: 타임라인에서 **제외**
2. **연동 해제 시 items 정책**: 자동 채워진 items **함께 삭제**
3. **locked 처리**: 연동으로 자동 채워진 항목도 **편집 가능** (상세 페이지와 일관성)
4. **컴포넌트 분리**: `BillableRelationPicker.svelte`로 **별도 분리**
5. **UI 방식**: **세로 타임라인 (Vertical Timeline)** — 진짜 타임라인 느낌으로 시각화

## 타임라인 뷰 설계

### 컨셉

내담자의 세션/검사 이력을 실제 세로선 + 노드(●)가 있는 타임라인으로 펼쳐서, "이 사람의 최근 활동 중 뭘 청구할지" 시각적 맥락으로 선택하게 한다.

### 레이아웃

```
 연동할 세션/검사 선택 (선택사항)
 [전체] [상담] [검사]    [최근 30일 ▾]  🔍 검색

   │
   ●━━━┓ 2026-04-15 (오늘)
   │   ┣━ 🗂️ MMPI-2 검사        ₩50,000  [선택]
   │   ┗━ 💬 3회차 상담          ₩80,000  [선택]
   │
   ●━━━  2026-04-10
   │     💬 2회차 상담            ₩80,000  [선택]
   │
   ●━━━  2026-04-03
   │     🗂️ SCT 검사              ₩30,000  [선택됨 ✓]
   │
   ◌     (더 과거 이력 보기)
```

### 시각 요소

- **세로선**: 왼쪽에 실제 세로 라인 (border-left 또는 가상 요소로)
- **노드(●)**: 날짜마다 원형 노드. 상담/검사 섞인 날은 기본색, 단일 타입은 타입 색상
- **타입 색상**: 상담 = 파랑, 검사 = 보라 (또는 프로젝트 팔레트 반영)
- **아이콘**: 상담 💬 / 검사 🗂️ (또는 lucide-svelte 아이콘)
- **선택 상태**:
  - 호버: 카드 살짝 확대(scale) + 그림자 강조
  - 선택됨: 노드 + 카드에 하이라이트 링 + 체크 아이콘
- **같은 날짜 그룹핑**: 한 노드에서 여러 아이템이 분기되는 트리 느낌

### 필터/검색

- **타입 탭**: 전체 / 상담 / 검사
- **기간 필터**: 최근 30일 (기본) / 최근 90일 / 전체
- **검색창**: 항목명/회차 텍스트 검색
- **더 보기**: 타임라인 하단 흐릿한 노드(◌)로 "과거 이력 더 보기" 표현

### 상호작용

- **단일 선택**: 한 번에 하나의 세션 또는 검사만 연동
- **선택 시**: `items` 자동 prefill + `relatedType/CaseId/SessionId` 세팅
- **재선택**: 다른 건 클릭 시 기존 items 교체 (확인 없이)
- **연동 해제**: 상단 "연동 없음" 토글 → items 초기화 + related_* 리셋
- **내담자 변경**: 타임라인 리로드 + 연동 상태 리셋

### 빈 상태 / 엣지

- 내담자 미선택: 섹션 비활성화 + "내담자를 먼저 선택해주세요"
- 이력 없음: 타임라인 영역에 "청구 가능한 세션/검사가 없습니다"
- 모두 청구됨: "모든 이력이 이미 청구되었습니다"

### 구현 메모

- Tailwind로 세로선: `border-l-2 border-slate-200` + 노드는 `absolute -left-[5px] w-3 h-3 rounded-full`
- 애니메이션: `transition-all` + `hover:scale-[1.02]` 정도로 은은하게
- 접근성: 키보드 포커스 이동(Tab) + Enter/Space 선택 가능하게

## 제외 범위 (Non-goals)

- 백엔드 스키마 변경 (이미 `related_*` 필드 존재)
- 청구 내역 목록에서 연동 정보 표시 (별도 작업)
- Phase 4 바우처 연동
