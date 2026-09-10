# 검사 프로세스 리팩터링 한 장 요약

> 상세: [process-refactoring-draft.md](./process-refactoring-draft.md)

---

## 📍 범위

**검사 상세 페이지 (담당자용)** 에만 적용.

| 진행 페이지 | 상세 페이지 (← 이 문서) | 종합보고서 에디터 (별도 페이지) |
|---|---|---|
| 내담자가 응답·실시 | 담당자가 **들어온 데이터 핸들링** | 여러 검사 결과를 묶어 종합 소견 작성 |
| 응답 입력, 타이머, 실시간 진행 | 검토·편집·재요청·승인·소견 작성·다음 단계 전진 | Task artifacts를 **읽기 전용으로 참조**해 에셋 조합 |
| 본 문서 밖 | Task 단위 | Case 단위, 본 문서 밖 (단, 연동 인터페이스는 §🔗에서 미리 표준화) |

> 전제: step 컴포넌트는 **"실시 UI"가 아니라 "들어온 데이터를 보고 후속 조치"** 하는 화면. 이 전제로 아키텍처가 단순해짐.

---

## 🎯 왜?

**지금**: `{#if self_report} {:else if external_service}` — 2종만 커버, 검사 추가 시 분기 지옥.

**목표**: 로샤·MMPI·K-WISC 등 풀배터리 모든 검사의 **핸들링 UI를 데이터로 선언**해서 조합.

---

## 🧩 핵심 아이디어

```
AssessmentCatalog  ──→  ProcessTemplate  ──→  StepRegistry
    (백엔드)               (프론트 선언)        (key → 컴포넌트)
```

1. **검사**가 어떤 **템플릿**을 쓸지 선언
2. **템플릿**이 어떤 **스텝**을 밟을지 선언
3. **레지스트리**에서 스텝 컴포넌트를 찾아 렌더

➡️ `if-else` 0개. 새 검사 = 템플릿 추가.

---

## 📐 구조 한눈에

```
┌─────────────────────────────────────────────────────────┐
│  Assessment (백엔드)                                     │
│  process_template_key: "projective_test"                 │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│  ProcessTemplate (프론트 선언형)                          │
│  steps: [intake → administration → rorschach_coding      │
│          → scoring → report_delivery]                    │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│  StepRegistry                                            │
│  rorschach_coding → <RorschachCodingStep />              │
│  scoring          → <ScoringStep />                      │
│  ...                                                     │
└─────────────────────────────────────────────────────────┘
```

---

## 🧱 3가지 빌딩 블록

### 1️⃣ 공용 스텝 (모든 검사가 공유)
`intake` / `administration` / `scoring` / `report_delivery`

### 2️⃣ 검사별 특수 스텝 (레지스트리에 등록)
`rorschach_coding` / `tat_narrative` / `wisc_subtest_input` / `htp_interpretation` ...

### 3️⃣ 검사별 슬롯 (공용 UI에 주입)
소견 모달 · 결과 뷰어에 검사별 위젯을 꽂음

---

## ⚡ 특수 스텝 (예: 로샤) 어떻게?

```
Top-level Stepper
  intake → administration → [ rorschach_coding ] → scoring
                                     │
                                     ▼ step 내부 Sub-Stepper
                              반응기록 → 코딩 → 구조요약 → 지각풀
```

- 외부 계약 통일 (단일 step), 내부는 자유 위저드
- `task.process.artifacts.rorschach_coding`에 JSONB로 저장
- `scoring.requires: ['rorschach_coding']`로 의존성 선언

---

## 🗄 백엔드 변경 (최소)

| 컬럼 | 타입 | 내용 |
|---|---|---|
| `process_template_key` | nullable VARCHAR | 템플릿 매칭 키 |
| `process_overrides` | nullable JSONB | 검사별 스텝 오버라이드 |

> 로직 변경 없음. 기존 `Task.process` JSONB 그대로 활용.

---

## 🚀 5단계 마이그레이션

| Phase | 내용 | 리스크 |
|---|---|---|
| **A** | 레지스트리 뼈대 + 기존 2타입 이전 | UI 회귀 0 목표 |
| **B** | 백엔드 `process_template_key` 컬럼 추가 | nullable, 안전 |
| **C** | 신규 템플릿 (지능·투사·발달) | 검사별 점진 롤아웃 |
| **D** | `task.process` JSONB 표준화 | 어댑터로 구버전 호환 |
| **E** | `process_overrides` 도입 | 실제 필요 시만 |

---

## ✅ Before / After

| | 지금 | 리팩터링 후 |
|---|---|---|
| 분기 | `if-else` 분기 박힘 | `<ProcessPanel />` 한 줄 |
| 검사 추가 | 패널 새로 + 분기 추가 | 템플릿 한 줄 추가 |
| 특수 단계 (로샤 등) | 대응 불가 | Sub-Stepper + artifacts |
| 검사 타입 확장성 | **2종** | **무제한** |
| 백엔드 로직 | — | **변경 없음** |

---

## 🔑 핵심 메시지

> **"분기를 데이터로 바꾼다."**
> 검사가 늘어나도 `if`는 늘지 않는다. 템플릿과 스텝만 늘어난다.

---

## 📦 예시: 로샤 검사를 추가하려면?

### 디렉터리 구조

```
src/lib/features/assessment/status-detail/process/
│
├── templates.ts                         ← ① 템플릿 선언 (1줄 추가)
├── step-registry.ts                     ← ② 레지스트리 등록 (1줄 추가)
├── slot-registry.ts                     ← ③ 소견/결과 슬롯 등록 (선택)
│
├── steps/
│   └── RorschachCodingStep.svelte       ← ④ 특수 스텝 컴포넌트 (신규)
│
├── widgets/                             ← ⑤ 재사용 위젯 (선택)
│   └── CardResponseRecorder.svelte
│
└── slots/
    ├── opinion-extra/
    │   └── RorschachOpinionExtra.svelte ← ⑥ 소견 모달 주입 (선택)
    └── result-viewer/
        └── RorschachResultView.svelte   ← ⑦ 결과 뷰어 (선택)
```

### ① 템플릿 선언 — `templates.ts`

```typescript
export const PROCESS_TEMPLATES = {
  // ... 기존 템플릿들
  projective_rorschach: {
    key: 'projective_rorschach',
    label: '로샤 검사',
    steps: [
      { key: 'intake',            label: '접수' },
      { key: 'administration',    label: '실시' },
      { key: 'rorschach_coding',  label: '코딩' },
      { key: 'scoring',           label: '채점', requires: ['rorschach_coding'] },
      { key: 'professional_report', label: '보고서' },
      { key: 'report_delivery',   label: '전달' }
    ]
  }
}
```

### ② 레지스트리 등록 — `step-registry.ts`

```typescript
import RorschachCodingStep from './steps/RorschachCodingStep.svelte'

export const STEP_REGISTRY = {
  // ... 기존 스텝들
  rorschach_coding: RorschachCodingStep
}
```

### ④ 특수 스텝 — `RorschachCodingStep.svelte`

> 진행 페이지에서 들어온 코딩 결과를 **검토·편집·확정**하는 화면 (실시 UI 아님)

```svelte
<script lang="ts">
  import CardResponseReview from '../widgets/CardResponseReview.svelte'
  import type { StepProps } from '../context'

  let { task, callbacks }: StepProps = $props()

  // 내부 Sub-Stepper (검토 단계 전환)
  let subStep = $state<'responses' | 'coding' | 'summary'>('responses')
  const coding = $derived(task.process.artifacts?.rorschach_coding ?? { responses: [] })

  async function saveAndNext(next: typeof subStep) {
    await callbacks.saveArtifact('rorschach_coding', coding)
    subStep = next
  }
</script>

<!-- 들어온 카드 반응 검토 → 코딩 검토·수정 → 구조 요약 확정 -->
{#if subStep === 'responses'}
  <CardResponseReview bind:responses={coding.responses} />
  <button onclick={() => saveAndNext('coding')}>다음: 코딩 검토</button>
{:else if subStep === 'coding'}
  <!-- Location / Determinant / FormQuality / Content / Popular 검토·수정 -->
{:else}
  <!-- 구조적 요약 (R, F%, WSum6...) 확인 -->
  <button onclick={() => callbacks.onComplete('rorschach_coding', coding)}>
    코딩 확정 · 다음 단계
  </button>
{/if}
```

### ⑤ 백엔드 — `Assessment` 시드 데이터만 한 줄

```python
Assessment(
  code="RORSCHACH",
  kor_name="로샤 검사",
  process_template_key="projective_rorschach",  # ← 이 한 줄
  # ... 나머지 기존 필드
)
```

### 📊 artifacts 저장 예시

```json
{
  "current_step": "scoring",
  "step_states": {
    "rorschach_coding": { "status": "completed", "sub_step": "summary" },
    "scoring": { "status": "in_progress" }
  },
  "artifacts": {
    "rorschach_coding": {
      "responses": [
        { "card": "I", "time": 12, "responses": [
          { "location": "W", "determinant": "F", "form_quality": "o",
            "content": "A", "popular": true }
        ]}
      ],
      "structural_summary": { "R": 22, "F_percent": 45, "WSum6": 8 }
    }
  }
}
```

### 🎯 결과

- 프론트: **파일 2개 수정 + 파일 1~4개 신규**
- 백엔드: **시드 1줄**
- AssessmentMain.svelte, Stepper, ProcessPanel: **한 줄도 수정 안 함**

> 다음 검사 추가도 같은 패턴. 규모는 달라도 프로세스는 동일.

---

## 📦 다른 투사검사 예시 3종

로샤와 같은 뼈대로 추가되는 대표 투사검사들. 각 검사의 **고유 스텝**과 **공유 위젯**만 다를 뿐 추가 방식은 동일.

### 🎨 TAT (주제통각검사)

> 카드별 이야기·주제 분석을 검토·편집

```typescript
// templates.ts
projective_tat: {
  key: 'projective_tat',
  label: 'TAT 주제통각검사',
  steps: [
    { key: 'intake',             label: '접수' },
    { key: 'administration',     label: '실시' },
    { key: 'tat_narrative',      label: '이야기 검토' },
    { key: 'tat_theme_analysis', label: '주제 분석', requires: ['tat_narrative'] },
    { key: 'professional_report', label: '보고서' },
    { key: 'report_delivery',    label: '전달' }
  ]
}
```

```
steps/
├── TATNarrativeStep.svelte       ← 카드별 이야기 검토·편집
└── TATThemeAnalysisStep.svelte   ← 주요 주제·욕구·압력 코딩

widgets/
└── CardResponseReview.svelte     ← 로샤와 공유 (재사용)
```

**artifacts 예시**
```json
"artifacts": {
  "tat_narrative": {
    "cards": [
      { "card": "1", "time_sec": 45,
        "story": "소년이 바이올린을 바라보며...",
        "hero": "소년", "main_theme": "성취 갈등" }
    ]
  },
  "tat_theme_analysis": {
    "needs": ["achievement", "autonomy"],
    "press": ["parental_expectation"],
    "outcome_tone": "ambivalent"
  }
}
```

---

### 🏠 HTP (집·나무·사람)

> 그림별 주석·해석 코딩을 검토·편집

```typescript
// templates.ts
projective_htp: {
  key: 'projective_htp',
  label: 'HTP 집-나무-사람',
  steps: [
    { key: 'intake',              label: '접수' },
    { key: 'administration',      label: '실시' },
    { key: 'htp_house_review',    label: '집 검토' },
    { key: 'htp_tree_review',     label: '나무 검토' },
    { key: 'htp_person_review',   label: '사람 검토' },
    { key: 'htp_interpretation',  label: '해석 통합',
      requires: ['htp_house_review', 'htp_tree_review', 'htp_person_review'] },
    { key: 'professional_report', label: '보고서' },
    { key: 'report_delivery',     label: '전달' }
  ]
}
```

```
steps/
├── HTPHouseReviewStep.svelte
├── HTPTreeReviewStep.svelte
├── HTPPersonReviewStep.svelte
└── HTPInterpretationStep.svelte  ← 세 그림 통합 해석

widgets/
└── ImageAnnotationCanvas.svelte  ← 그림 위 주석 레이어 (HTP 공용)
```

**artifacts 예시**
```json
"artifacts": {
  "htp_house_review": {
    "image_url": "...",
    "annotations": [
      { "x": 120, "y": 80, "note": "창문 없음 - 폐쇄성 시사" }
    ],
    "coding": { "door": "absent", "chimney": "exaggerated" }
  },
  "htp_interpretation": {
    "self_concept": "low",
    "family_dynamics": "distant",
    "integrated_note": "..."
  }
}
```

> **포인트**: step이 3개로 분리되고 마지막이 `requires`로 앞 3개 artifacts에 의존. 한 그림씩 집중 검토하다가 마지막에 통합.

---

### 📝 SCT (문장완성검사)

> 완성된 문장별 주제 분류·해석 검토

```typescript
// templates.ts
projective_sct: {
  key: 'projective_sct',
  label: 'SCT 문장완성검사',
  steps: [
    { key: 'intake',               label: '접수' },
    { key: 'administration',       label: '실시' },
    { key: 'sct_sentence_review',  label: '문장 검토' },
    { key: 'sct_theme_coding',     label: '주제 분류',
      requires: ['sct_sentence_review'] },
    { key: 'professional_report',  label: '보고서' },
    { key: 'report_delivery',      label: '전달' }
  ]
}
```

```
steps/
├── SCTSentenceReviewStep.svelte  ← 완성된 문장 50개 검토·편집
└── SCTThemeCodingStep.svelte     ← 가족/자아/대인/미래 등 주제별 분류

widgets/
└── SentenceListEditor.svelte     ← SCT·유사 자극법 공용
```

**artifacts 예시**
```json
"artifacts": {
  "sct_sentence_review": {
    "items": [
      { "stem": "내가 가장 좋아하는 사람은...", "response": "엄마", "category": "family" },
      { "stem": "나의 미래는...", "response": "불안하다", "category": "future" }
    ]
  },
  "sct_theme_coding": {
    "themes": {
      "family": { "score": 2, "note": "모와 밀착, 부와 거리" },
      "self": { "score": -1, "note": "부정적 자아상" },
      "future": { "score": -2, "note": "비관적 전망" }
    }
  }
}
```

---

### 🧩 세 검사 공통 패턴

| 공통 요소 | 방식 |
|---|---|
| **템플릿 선언** | `templates.ts`에 key 추가 (1블록) |
| **레지스트리 등록** | `step-registry.ts`에 step → 컴포넌트 매핑 (1~4줄) |
| **백엔드 시드** | `Assessment.process_template_key` 한 줄 |
| **공용 UI 재사용** | `AssessmentMain`, `ProcessPanel`, `Stepper`, 소견 모달, 공용 스텝(`intake`, `administration`, `professional_report`, `report_delivery`) 모두 **한 줄도 수정 안 함** |
| **검사별 차이** | 고유 step 컴포넌트 + artifacts JSONB 스키마만 |

> 위 4개 검사(로샤/TAT/HTP/SCT)를 다 추가해도 `AssessmentMain.svelte`에 분기 한 줄 안 늘어남. 새 검사는 **템플릿 + 스텝**으로만.

---

## 🔗 종합보고서 연동 (exports)

Case 단위 종합보고서는 **별도 에디터 페이지**에서 작성. 각 검사가 어떤 에셋을 노출할지 **지금 표준 인터페이스**로 선언해 두면 나중에 일 안 늘어남.

### 두 가지 추출 방식

| 방식 | 용도 | 예시 |
|---|---|---|
| **`extract`** (정형) | artifacts가 JSON인 검사 | 로샤 구조 요약, SCT 주제 분류 |
| **`auto_crop`** (이미지) | PDF 업로드 검사의 차트·표 자동 크롭 | WISC 프로파일, MMPI 프로파일 |

### 선언 예시

```typescript
// 정형 — 로샤
{
  key: 'rorschach_coding',
  exports: {
    structural_summary: {
      label: '로샤 구조 요약', category: 'summary',
      extract: (a) => ({ type: 'rorschach_structural', data: a.rorschach_coding.structural_summary })
    }
  }
}

// PDF 자동 크롭 — K-WISC
{
  key: 'wisc_report_upload',
  exports: {
    profile_chart: {
      label: 'WISC 프로파일', category: 'chart',
      auto_crop: { source: 'uploaded_pdf', page: 3,
                   region: { x: 80, y: 520, w: 440, h: 260 },
                   output_key: 'profile_chart_img' }
    }
  }
}
```

### 동작 흐름

```
PDF 업로드 → 백엔드 워커가 auto_crop 레시피 실행 → S3 저장
            ↓
    artifacts.auto_assets[output_key] = { image_url, ... }
            ↓
종합보고서 에디터: Task별 exports 목록을 사이드바에 노출
            ↓
담당자가 드래그·삽입 → Case Document로 저장
```

### 원칙

- **읽기 전용**: 에디터는 Task artifacts를 건드리지 않음
- **추출 책임은 검사 쪽**: 각 검사의 `exports`가 무엇을 노출할지 결정
- **자동 중심**: 수동 크롭(`manual_assets`)은 나중 확장 자리만 남김
- **레시피 버전 관리**: PDF 레이아웃 변경 시 `Assessment.pdf_layout_version`로 분기 가능

> 본 리팩터링 범위는 **인터페이스 정의 + 기존 검사의 선언**까지. 에디터 페이지·크롭 워커는 별도.
