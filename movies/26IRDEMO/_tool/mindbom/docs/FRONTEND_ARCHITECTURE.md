# 마인드봄 Frontend Architecture

> 마인드스코프 V4 Feature Module 기반 + 검사 워크플로우 확장

---

## 1. 핵심 차이점: 마인드스코프 vs 마인드봄

| 구분 | 마인드스코프 | 마인드봄 |
|------|-------------|---------|
| **메인 흐름** | CRUD 목록 → 상세 → 수정 | **멀티스텝 워크플로우** (검사 진행 → AI → 채점 → 결과) |
| **상태 관리** | 단순 (탭 필터) | **상태 머신** (created → ... → completed) |
| **실시간 기능** | 없음 | 음성 녹음, 캔버스 드로잉, AI 분석 로딩 |
| **AI 연동** | Agent (채팅) | CDSS (초안 → 검토 → 확인) |
| **멀티테넌시** | center_id | institution_id |
| **역할** | 동적 RBAC | 고정 3종 (admin/clinician/researcher) |

---

## 2. 레이어 구조 (V4 확장)

```
┌──────────────────────────────────────────┐
│  Page (+page.svelte)                     │ ← 쿼리 초기화 + 이벤트 바인딩
├──────────────────────────────────────────┤
│  Hooks (hooks.svelte.ts)                 │ ← 상태/디바운스/URL 동기화
├──────────────────────────────────────────┤
│  Service (*-service.ts)                  │ ← 비즈니스 로직 + 모달 + 토스트
├──────────────────────────────────────────┤
│  Workflow (workflow.svelte.ts)  ★ NEW    │ ← 검사 스텝 관리 + 상태 전이
├──────────────────────────────────────────┤
│  ViewModel (view-model.ts)               │ ← API → UI 변환
├──────────────────────────────────────────┤
│  Actions (*.action.ts)                   │ ← 순수 HTTP 호출
└──────────────────────────────────────────┘
```

### ★ Workflow 레이어 (마인드봄 신규)

검사 진행 흐름을 관리하는 **상태 머신 + 스텝 매니저**.
마인드스코프에는 없는 레이어로, 멀티스텝 워크플로우 도메인에서만 사용.

```typescript
// workflow.svelte.ts — 검사 진행 상태 관리
export function useExamWorkflow(examType: ExamType) {
  let currentStep = $state(0)
  let examStatus = $state<ExamStatus>('created')
  let isDirty = $state(false)        // 미저장 변경 감지
  let isAutoSaving = $state(false)   // 임시저장 상태

  // 스텝 정의 (검사 유형별)
  const steps = $derived(getStepsByType(examType))

  // 상태 전이 검증 (백엔드 state_machine.py와 동기화)
  function canTransitionTo(newStatus: ExamStatus): boolean { ... }
  function transitionTo(newStatus: ExamStatus): void { ... }

  // 스텝 네비게이션
  function nextStep(): void { ... }
  function prevStep(): void { ... }
  function goToStep(index: number): void { ... }

  // 자동 임시저장
  function markDirty(): void { ... }
  function autoSave(): Promise<void> { ... }

  return { currentStep, examStatus, steps, isDirty, ... }
}
```

---

## 3. Feature 디렉터리 구조

```
apps/web/src/lib/features/
├── common/                      # 공통 유틸
│   ├── filters.ts               # URL ↔ 필터 변환
│   └── workflow-types.ts        # 워크플로우 공통 타입
│
├── examination/                 # 검사 도메인 (핵심)
│   ├── common/                  # 검사 공통
│   │   ├── constants.ts         # 상태/타입 상수
│   │   ├── state-machine.ts     # 프론트 상태 머신 (백엔드 동기화)
│   │   └── types.ts             # 공통 타입
│   │
│   ├── status/                  # 검사 현황 (목록)
│   │   ├── constants.ts
│   │   ├── filters.ts
│   │   ├── query-builders.ts
│   │   ├── view-model.ts
│   │   ├── hooks.svelte.ts
│   │   └── status-service.ts
│   │
│   ├── htp/                     # HTP 검사 진행
│   │   ├── constants.ts         # HTP 스텝 정의, 분석 요소 상수
│   │   ├── workflow.svelte.ts   # ★ HTP 워크플로우 (4탭: 집/나무/남자/여자)
│   │   ├── htp-service.ts       # AI 분석 요청, 임시저장, 완료
│   │   ├── view-model.ts        # 탐지 결과 → UI 변환
│   │   └── components/          # HTP 전용 컴포넌트
│   │       ├── ImageViewer.svelte       # 그림 뷰어 + bbox 오버레이
│   │       ├── AnalysisTable.svelte     # 분석 요소 테이블
│   │       ├── PostQuestionPanel.svelte # 사후질문 기록
│   │       └── ResultView.svelte        # 결과 보기 (자기개념/정서/대인)
│   │
│   ├── rorschach/               # 로르샤하 검사 진행
│   │   ├── constants.ts         # 카드 I~X, Exner CS 코드
│   │   ├── workflow.svelte.ts   # ★ 3스텝 (반응녹취 → 채점 → 결과)
│   │   ├── rorschach-service.ts # 녹음, AI 채점, Exner 계산
│   │   ├── view-model.ts        # 채점 결과 → Exner 구조화
│   │   └── components/
│   │       ├── InkblotViewer.svelte     # 잉크반점 이미지 + 영역 마킹
│   │       ├── AudioRecorder.svelte     # 실시간 녹음 + 파형
│   │       ├── TranscriptPanel.svelte   # 녹취록 (화자분리)
│   │       ├── ScoringCard.svelte       # 반응별 AI 채점 카드
│   │       ├── LocationMarker.svelte    # 반응 영역 폴리곤 드로잉
│   │       └── ExnerResult.svelte       # Exner 결과표 (Special Indices)
│   │
│   ├── sct/                     # SCT 검사 진행
│   │   ├── constants.ts         # 40문항 줄기, 영역 정의
│   │   ├── workflow.svelte.ts   # ★ 2스텝 (문장완성 → 결과)
│   │   ├── sct-service.ts       # AI 채점, 점수 수정
│   │   ├── view-model.ts        # 채점 → 영역별 시각화
│   │   └── components/
│   │       ├── SentenceCard.svelte      # 문항 카드 (줄기 + 입력)
│   │       ├── ResponseReview.svelte    # 응답 검토 목록
│   │       └── DomainScores.svelte      # 영역별 점수 카드 (A~E)
│   │
│   └── report/                  # 통합 보고서
│       ├── report-service.ts
│       ├── view-model.ts
│       └── components/
│           └── ReportEditor.svelte
│
├── clients/                     # 내담자 관리
│   ├── constants.ts
│   ├── filters.ts
│   ├── query-builders.ts
│   ├── view-model.ts
│   ├── hooks.svelte.ts
│   └── client-service.ts
│
├── dashboard/                   # 대시보드
│   ├── constants.ts
│   ├── view-model.ts
│   └── dashboard-service.ts
│
├── institution/                 # 기관 관리
│   └── ...
│
└── members/                     # 직원 관리
    └── ...
```

---

## 4. 라우트 구조

```
apps/web/src/routes/
├── (public)/                    # 비인증
│   ├── login/
│   ├── signup/
│   └── sct-online/[token]/      # SCT 온라인 검사 (피검자 직접 입력)
│
├── (protected)/                 # 인증 필수
│   ├── +layout.svelte           # 사이드바 + 인증 가드
│   │
│   ├── dashboard/               # 대시보드
│   │   └── +page.svelte
│   │
│   ├── examinations/            # 검사 현황 (목록)
│   │   └── +page.svelte
│   │
│   ├── examination/             # 검사 진행 (워크플로우)
│   │   └── [examId]/
│   │       ├── +layout.svelte   # ★ 검사 진행 레이아웃 (다크 사이드바)
│   │       ├── +page.svelte     # 검사 유형별 자동 라우팅
│   │       ├── htp/
│   │       │   └── +page.svelte # HTP 검사 진행
│   │       ├── rorschach/
│   │       │   └── +page.svelte # 로르샤하 검사 진행
│   │       └── sct/
│   │           └── +page.svelte # SCT 검사 진행
│   │
│   ├── clients/                 # 내담자 관리
│   │   ├── +page.svelte         # 목록
│   │   └── [clientId]/
│   │       └── +page.svelte     # 상세
│   │
│   ├── members/                 # 직원 관리
│   │   └── +page.svelte
│   │
│   └── settings/                # 설정
│       ├── institution/         # 기관 설정
│       └── account/             # 계정 설정
│
└── api/                         # SvelteKit 프록시
    └── proxy/[...path]/
        └── +server.ts
```

---

## 5. 레이아웃 패턴 (시연영상 기반)

### 5-1. 메인 레이아웃 (목록/대시보드)

```
┌──────┬──────────────────────────────────────┐
│      │  Header (페이지 제목 + 설명)         │
│ Side │──────────────────────────────────────│
│ bar  │  Summary Cards (오늘의 검사 등)      │
│      │──────────────────────────────────────│
│ 200px│  Tab Filter + Search + Actions       │
│      │──────────────────────────────────────│
│      │  Data Table / Grid                   │
│      │                                      │
└──────┴──────────────────────────────────────┘
```

- 사이드바: 라이트 테마, 네비게이션 (대시보드/검사현황/내담자)
- 메인: 흰 배경, 카드 + 테이블

### 5-2. 검사 진행 레이아웃 (HTP/로르샤하)

```
┌──────┬──────────────────────────────┬──────────┐
│      │  Step Header (탭/카드 선택)  │          │
│ Dark │──────────────────────────────│  Right   │
│ Side │                              │  Panel   │
│ bar  │  Main Content               │          │
│      │  (이미지/잉크반점)           │ 사후질문  │
│ 200px│                              │  또는    │
│      │                              │  녹취록  │
│      │──────────────────────────────│          │
│      │  Footer (임시저장/결과보기)   │          │
└──────┴──────────────────────────────┴──────────┘
```

- 사이드바: **다크 테마**, 단계 진행 표시 (진행중/대기/완료)
- 메인: 그레이 배경, 이미지/캔버스 영역
- 우측 패널: 사후질문 기록 또는 녹취록 + 오디오 플레이어

### 5-3. 결과 보기 레이아웃

```
┌──────┬──────────────────────────────┬──────────┐
│      │  Result Header              │          │
│ Dark │──────────────────────────────│  Right   │
│ Side │                              │  Panel   │
│ bar  │  Analysis Table             │          │
│      │  (분류/분석요소/표현양상/해석) │ 사후질문  │
│      │                              │  기록    │
│      │  ────────────────────────── │          │
│      │  Important Items ★          │          │
│      │──────────────────────────────│          │
│      │  Footer (이전/저장 및 완료)   │          │
└──────┴──────────────────────────────┴──────────┘
```

---

## 6. Stores (마인드봄 전용)

```
apps/web/src/lib/stores/
├── auth.ts                # 인증 (JWT, 로그인/로그아웃)
├── institution.store.ts   # 기관 선택 (= 마인드스코프의 center.store.ts)
├── modal.ts               # 모달 관리 (마인드스코프 동일)
├── snackbar.ts            # 토스트 알림 (마인드스코프 동일)
└── exam.store.ts          # ★ 현재 진행중인 검사 상태 (SSR 안전)
```

### exam.store.ts (신규)

```typescript
// 검사 진행 중 전역 상태 (페이지 간 유지)
interface ExamState {
  examId: string | null
  examType: ExamType | null
  status: ExamStatus | null
  clientName: string | null
  autoSaveEnabled: boolean
  lastSavedAt: string | null
}
```

---

## 7. 공유 컴포넌트 계획

```
apps/web/src/lib/components/
├── layout/
│   ├── MainLayout.svelte          # 메인 레이아웃 (라이트 사이드바)
│   ├── ExamLayout.svelte          # ★ 검사 진행 레이아웃 (다크 사이드바)
│   ├── Sidebar.svelte             # 네비게이션 사이드바
│   └── ExamSidebar.svelte         # ★ 검사 진행 사이드바 (단계 표시)
│
├── ui/                            # 기본 UI
│   ├── Button.svelte
│   ├── Select.svelte
│   ├── Table.svelte
│   ├── Pagination.svelte
│   ├── Badge.svelte               # 상태 뱃지 (검사대기/분석중/완료)
│   ├── ProgressBar.svelte         # 진행률 (SCT 1/40)
│   ├── Tabs.svelte                # 탭 컴포넌트
│   └── Card.svelte                # 카드
│
├── data/
│   ├── DataTable.svelte           # 데이터 테이블
│   ├── FilterBar.svelte           # 검색 + 필터 바
│   └── SummaryCards.svelte        # 요약 카드 (오늘의 검사 등)
│
├── media/                         # ★ 미디어 (마인드봄 전용)
│   ├── AudioRecorder.svelte       # 실시간 녹음 + 파형
│   ├── AudioPlayer.svelte         # 오디오 재생 + 파형
│   ├── ImageCanvas.svelte         # 이미지 + 오버레이 캔버스
│   └── PolygonDrawer.svelte       # 폴리곤 영역 마킹
│
├── modal/
│   ├── ModalContainer.svelte      # 모달 컨테이너
│   ├── ConfirmModal.svelte
│   └── ...
│
└── feedback/
    ├── Snackbar.svelte
    ├── LoadingSpinner.svelte
    └── AIAnalyzingState.svelte    # ★ AI 분석 중 상태 UI
```

---

## 8. 검사 유형별 워크플로우 상세

### 8-1. HTP

```
Step 1: 이미지 분석 (4탭 순회)
  ┌─────────────────────────────────┐
  │  [집✓] [나무✓] [남자사람] [여자] │  ← 탭 (순서대로 진행)
  ├─────────────────────────────────┤
  │  이미지 뷰어 (bbox 오버레이)     │  ← AI 객체 탐지 결과 시각화
  │  + 사후질문 패널 (우측)          │
  │  + 그림 분석 테이블              │  ← 분류/분석요소/표현양상 (드롭다운)
  └─────────────────────────────────┘

Step 2: 결과 보기
  ┌─────────────────────────────────┐
  │  [자기개념] [정서적안정성] [대인] │  ← 영역 탭
  ├─────────────────────────────────┤
  │  분석 항목 테이블                │
  │  (분류/분석요소/표현양상/해석)    │  ← AI 해석 + 임상가 수정
  │  + 중요항목 ★ 마킹              │
  └─────────────────────────────────┘
```

### 8-2. Rorschach

```
Step 1: 반응 영역 기록
  ┌────────────────────────────────┐
  │  카드 I ~ X (10개)             │
  ├────────────────────────────────┤
  │  잉크반점 이미지                │  ← 폴리곤 드로잉 (반응 영역)
  │  + 실시간 녹음 (우측)           │  ← 타이머 + 파형
  │  + 영역 메모 팝업               │
  └────────────────────────────────┘

Step 2: 채점하기 (스마트 인덱싱)
  ┌────────────────────────────────┐
  │  반응 영역 보기 (번호 마커)      │
  │  + 녹취록 패널 (우측, 화자분리)  │  ← 타임스탬프 클릭 → 음성 재생
  │  + 반응별 코딩/AI채점 버튼       │
  │  + 채점 결과 (LOC/DET/FQ/CONT) │
  └────────────────────────────────┘

Step 3: 결과 보기 (Exner)
  ┌────────────────────────────────┐
  │  Upper/Lower/Special Indices   │
  │  특수 지표 체크박스 매트릭스      │
  │  채점결과 내려받기               │
  └────────────────────────────────┘
```

### 8-3. SCT

```
Step 1: 문장 완성 검사
  ┌────────────────────────────────┐
  │  진행률 바 (1/40, 3%)          │
  │  문항 카드 (줄기 + 입력)        │  ← Enter로 다음
  │  이전/다음 네비게이션            │
  └────────────────────────────────┘

Step 2: 결과 보기
  ┌────────────────────────────────┐
  │  5개 영역 점수 카드 (A~E)       │  ← 색상 코딩
  │  영역별 문항 리스트              │
  │  + AI 채점 (0~6)               │  ← 클릭으로 수정 가능
  └────────────────────────────────┘
```

---

## 9. 핵심 설계 원칙

### 9-1. centerId → institutionId 변환
```typescript
// 마인드스코프: requireCenterId()
// 마인드봄:     requireInstitutionId()
export function requireInstitutionId(): string {
  const id = institutionStore.getCurrentInstitutionId()
  if (!id) throw new Error('기관이 선택되지 않았습니다.')
  return id
}
```

### 9-2. 워크플로우 ↔ 서비스 분리
```
- Workflow: 스텝 진행, 상태 전이, 자동저장 타이머 (프론트 전용 관심사)
- Service:  API 호출, 모달, 토스트, 캐시 무효화 (비즈니스 로직)

Page에서 둘 다 초기화하고 조합:
  const workflow = useHTPWorkflow()
  const service = createHTPService({ queryClient })
```

### 9-3. AI 분석 플로우 (CDSS)
```
1. 사용자가 "AI 채점" 버튼 클릭
2. Service → API 호출 (POST /examinations/{id}/ai-analyze)
3. 백엔드: 상태 전이 (in_progress → ai_analyzing)
4. 프론트: 로딩 UI ("AI 분석 중...")
5. 폴링 또는 SSE로 완료 감지
6. 상태 전이 (ai_analyzing → ai_draft_ready)
7. AI 초안 표시 + 임상가 수정 UI 활성화
8. 임상가 확인 → confirmed
```

### 9-4. 자동 임시저장
```typescript
// 검사 진행 중 30초마다 또는 변경 감지 시 자동 저장
$effect(() => {
  if (!workflow.isDirty) return
  const timer = setTimeout(() => workflow.autoSave(), 30_000)
  return () => clearTimeout(timer)
})
```

---

## 10. 개발 우선순위

### Phase 1 — 골격 (현장점검 필수)
1. 프로젝트 셋업 (SvelteKit + TailwindCSS + TanStack Query)
2. 레이아웃 (MainLayout + ExamLayout)
3. 인증 (로그인/로그아웃)
4. 검사 현황 목록 (테이블 + 필터 + 상태 뱃지)
5. HTP 검사 진행 (Step 1: 이미지 분석, Step 2: 결과 보기)
6. 내담자 관리 (CRUD)

### Phase 2 — 핵심 검사
7. 로르샤하 검사 (녹음 + 마킹 + 채점 + Exner 결과)
8. SCT 검사 (문장 완성 + AI 채점 + 결과)
9. 대시보드
10. 통합 보고서

### Phase 3 — 실증 준비
11. 기관 관리
12. 직원 관리
13. 감사추적 뷰어
14. 데이터 내보내기
