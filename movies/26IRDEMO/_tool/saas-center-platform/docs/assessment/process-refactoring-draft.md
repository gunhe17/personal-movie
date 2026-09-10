# 검사 진행 프로세스 리팩터링 초안

> **목적**: 현재 `self_report` / `external_service` 두 분기만 지원하는 프로세스 패널을, **검사별 고유 스텝 + 공용 스텝을 조합 가능한 형태**로 일반화한다.
>
> **전제**:
> - 백엔드 도메인(`Assessment / AssessmentTask / Task.process JSONB`)은 **그대로 유지**.
> - 커버 범위는 풀배터리 수준 (K-WISC, MMPI, 로샤, TAT, HTP, SCT, 발달검사 등). 아키텍처는 그 이상을 포괄.
> - 기존 [domain_v3.md](./domain_v3.md)를 디벨롭하는 방향. 새로 갈아엎지 않음.
> - 본 문서는 **프론트엔드 프로세스 패널 구조** 리팩터링 중심. 백엔드에 필요한 최소 보강(카탈로그 메타 필드)만 제안.

---

## 📍 본 리팩터링의 책임 범위

이 플랫폼은 **검사 진행 페이지**와 **검사 상세 페이지**가 분리되어 있다. 본 리팩터링은 **상세 페이지**에만 적용된다.

| | 검사 진행 페이지 | 검사 상세 페이지 (본 문서 대상) |
|---|---|---|
| 주 사용자 | 내담자 (또는 검사자) | 담당자 (상담사·접수·슈퍼바이저) |
| 책임 | 응답 입력, 타이머, 실시간 진행 | **들어온 데이터 핸들링** |
| 예시 | 설문 응답, 카드별 반응 기록, 소검사 실시 | 들어온 데이터 확인·편집·소견 작성·다음 단계 전진 |

**전제 깔고 가기**: 상세 페이지의 step 컴포넌트는 "**실시 UI**"가 아니라 "**이미 들어온 데이터를 보고 후속 조치**"하는 역할. 이 전제로 아키텍처가 훨씬 단순해진다.

- ❌ 타이머·제한시간·만료 워커 같은 실시간 진행 로직 — 진행 페이지 소관
- ❌ 응답 입력 위젯 (응답은 진행 페이지에서 이미 완료되어 들어옴)
- ✅ 데이터 검토·편집·재요청·승인·소견 작성·다음 단계 전진

예: `RorschachCodingStep`은 "카드 반응을 입력하는 화면"이 아니라 **"진행 페이지에서 들어온 코딩 결과를 검토·편집·확정하는 화면"**.

### Task 단위 vs Case 단위 (종합보고서)

| | Task 단위 (본 문서 범위) | Case 단위 (별도 페이지) |
|---|---|---|
| 대상 | 개별 검사 1개 | 풀배터리 = 여러 검사 묶음 |
| 담당 | 검사별 step 템플릿 + artifacts | 종합보고서 에디터 (별도 페이지) |
| 데이터 흐름 | 각 검사가 자기 artifacts 소유 | Task artifacts를 **읽기 전용으로 참조**해 에셋 추출 |
| 결과물 | step별 결과 + 검사별 보고서 | 여러 검사를 묶은 종합 소견서 (Document로 저장) |

**책임 분리 원칙**
- 본 리팩터링은 **Task 단위 (개별 검사)** 만 책임진다.
- 종합보고서는 별도 에디터 페이지가 담당하며, 본 문서 범위 바깥.
- 단, 두 영역의 **인터페이스 표준화** (아래 `exports` 인터페이스)는 지금 명시해 두어 미래의 일을 줄인다.

---

## 0. 현재 문제

### 0-1. 하드코딩된 분기

```
AssessmentMain.svelte
  {#if isSelfReport}
    <SelfReportDetailPanel />        ← 자가보고형 전용
  {:else if isExternalService}
    <ExternalServiceDetailPanel />   ← 외부 보고서 업로드 전용
  {:else}
    <!-- 업로드 카드 폴백 -->
  {/if}
```

- 분기 기준: `selectedAssessment.workflowType` 문자열 비교.
- 각 패널이 자기 영역에서 **스텝·액션·상태뱃지·UI**를 전부 소유.
- 새 검사 타입이 들어오면 `{:else if ...}` 추가 + 새 패널 파일 추가 + AssessmentMain 수정이 묶여 움직임 → 확장 지옥.

### 0-2. 스텝 구성의 경직성

- `Stepper.svelte`는 이미 `steps` prop으로 범용화됨 (✅).
- 하지만 **어떤 스텝을 보여줄지**를 패널 컴포넌트가 하드코딩 중.
- 공용 스텝(예: "접수 → 실시 → 채점 → 결과 전달")과 고유 스텝(예: MMPI는 "프로파일 검토", 지능검사는 "보호자 면담")의 **조합 규칙이 없다**.

### 0-3. 상태·액션 결합

- 완료/중단/되돌리기/소견작성은 공통 액션이지만 AssessmentMain 상단에 붙어 있음.
- 업로드 버튼·링크 복사·바로발송처럼 **검사 타입별 고유 액션**은 패널 안에 있음.
- 공용과 고유가 섞여 있어 "이 검사에 이 액션이 필요한가"를 판단하는 로직이 흩어져 있음.

---

## 1. 리팩터링 목표

| 목표 | 구체 내용 |
|---|---|
| **선언적 구성** | 검사 하나하나마다 "어떤 스텝 × 어떤 액션 × 어떤 패널"을 데이터로 선언 |
| **공용/고유 스텝 조합** | 공용 스텝 카탈로그 + 검사별 오버라이드/추가 스텝 |
| **컴포넌트 레지스트리** | 스텝 컴포넌트를 key로 찾아 렌더링 (분기 없음) |
| **백엔드 무변경** | `Assessment` 테이블에 카탈로그 메타 컬럼 1~2개 추가만. `Task.process` JSONB는 그대로 활용 |
| **점진 마이그레이션** | 기존 2개 타입(self_report / external_service)을 새 구조로 먼저 이전, 기능 동작은 동일 |

---

## 2. 개념 모델

### 2-1. 3-Layer 레지스트리

```
AssessmentCatalog (백엔드 Assessment에 메타 추가)
    ↓ process_template_key  ("self_report_online", "intelligence_battery", ...)
ProcessTemplate (프론트 레지스트리, 선언형 JSON/TS 객체)
    ↓ steps: [step_key, step_key, ...]
StepRegistry (프론트, step_key → Svelte 컴포넌트 매핑)
```

### 2-2. 핵심 개념

| 개념 | 설명 | 예시 |
|---|---|---|
| **ProcessTemplate** | "이 검사는 어떤 스텝을 밟는다"의 선언 | `intake → online_fill → auto_scoring → report_delivery` |
| **ProcessStep** | 한 스텝의 UI와 동작을 담은 단위 (Svelte 컴포넌트 + 메타) | `OnlineFillStep.svelte`, `ReportUploadStep.svelte` |
| **StepContext** | 스텝이 받는 공통 데이터 (task, case, client 등) + 전환 콜백 | `{ task, onComplete, onRollback, ... }` |
| **Action** | 헤더 액션 버튼 선언 (완료/중단/소견 등) | 공용은 기본 제공, 검사별 커스텀 |
| **Badge** | 상태 표시 (뱃지 라벨·색) | 공용 + 확장 가능 |

### 2-3. ProcessTemplate 데이터 형태 (예시)

```typescript
interface ProcessTemplate {
  key: string                     // "self_report_online", "external_report_upload" ...
  label: string                   // "온라인 자가보고형"
  steps: StepDefinition[]
  actions?: ActionOverride[]      // 공용 액션 외 추가/숨김
  badges?: BadgeOverride[]
}

interface StepDefinition {
  key: string                     // StepRegistry에서 찾을 키
  label: string                   // 스테퍼 라벨
  required?: boolean              // 필수 여부 (미완료 시 완료 불가)
  condition?: (ctx) => boolean    // 조건부 노출 (예: "is_online이면")
}
```

### 2-4. StepRegistry (프론트)

```typescript
// src/lib/features/assessment/status-detail/process/step-registry.ts
import IntakeStep from './steps/IntakeStep.svelte'
import OnlineFillStep from './steps/OnlineFillStep.svelte'
import ReportUploadStep from './steps/ReportUploadStep.svelte'
import ScoringStep from './steps/ScoringStep.svelte'
import ReportDeliveryStep from './steps/ReportDeliveryStep.svelte'
// ...

export const STEP_REGISTRY = {
  intake: IntakeStep,
  online_fill: OnlineFillStep,
  paper_fill: PaperFillStep,
  interview: InterviewStep,
  observation: ObservationStep,
  report_upload: ReportUploadStep,
  auto_scoring: AutoScoringStep,
  manual_scoring: ManualScoringStep,
  professional_report: ProfessionalReportStep,
  client_report: ClientReportStep,
  report_delivery: ReportDeliveryStep,
} satisfies Record<string, Component>
```

### 2-5. 프로세스 템플릿 카탈로그 (초기 시드)

| Template Key | 용도 | 스텝 구성 |
|---|---|---|
| `self_report_online` | 자가보고형 온라인 (현 self_report 이전 대상) | `intake → online_fill → auto_scoring → report_delivery` |
| `self_report_paper` | 자가보고형 지필 | `intake → paper_fill → manual_scoring → report_delivery` |
| `external_report_upload` | 외부 서비스 보고서 업로드 (현 external_service 이전 대상) | `intake → external_run → report_upload → report_delivery` |
| `intelligence_battery` | K-WISC, K-WAIS 등 지능검사 | `intake → interview → administration → scoring → professional_report → client_report → report_delivery` |
| `projective_test` | 로샤·TAT·HTP | `intake → administration → observation → scoring → interpretation → professional_report → client_report` |
| `developmental_screening` | 영유아 발달 | `intake → caregiver_interview → observation → scoring → feedback_session` |

> 초기엔 6~8개 시드 + 해당하지 않는 검사는 `self_report_online` / `external_report_upload`로 폴백. 새 검사 추가는 템플릿 추가 또는 기존 템플릿 재사용만으로 처리.

### 2-6. 검사별 특수 스텝 패턴

공용 스텝(`intake`, `scoring`, `report_delivery` 등)만으로는 표현이 불가능한 **검사 고유 데이터 핸들링 단계**가 존재한다. 대표 예 (상세 페이지 관점 = 들어온 데이터 검토·편집):

| 검사 | 특수 스텝 | 상세 페이지에서의 내용 |
|---|---|---|
| 로샤 | `rorschach_coding` | 진행 페이지에서 들어온 카드별 반응·코딩 결과를 검토·편집 |
| TAT | `tat_narrative` | 들어온 카드별 이야기·주제 태깅 검토·편집 |
| HTP | `htp_interpretation` | 들어온 그림·주석·해석 코딩 검토·편집 |
| K-WISC | `wisc_subtest_review` | 들어온 15개 소검사별 원점수 검토·편집 |

이런 스텝은 **A안의 step 컴포넌트 단위로 수용**하되, 다음 3가지 확장을 허용한다.

#### (1) Step 내부 Sub-Stepper 허용

Top-level Stepper는 템플릿이 정의한 스텝만 표시하지만, **step 컴포넌트 내부는 자체 위저드를 자유롭게 구성**할 수 있다.

```
Top-level Stepper (ProcessPanel이 렌더)
  intake → administration → [rorschach_coding] → scoring → ...
                                    │
                                    ▼ step 컴포넌트 내부
                            Sub-Stepper (RorschachCodingStep 소유)
                              반응 기록 → 코딩 → 구조적 요약 → 지각 풀
```

- 외부에서 본 계약은 동일 (`StepProps` 받고 `onComplete` 호출).
- 내부 위저드의 현재 단계는 `task.process.step_states.rorschach_coding.sub_step` 같은 필드로 저장.
- 한 step 컴포넌트가 1000줄을 넘어가면 **내부에서 모듈로 분해**하되, 외부엔 단일 step으로 보임.

#### (2) StepDefinition.requires (artifacts 의존성)

스텝이 **앞선 스텝의 결과물에 의존**하는 경우 명시적으로 선언한다.

```typescript
interface StepDefinition {
  key: string
  label: string
  required?: boolean
  condition?: (ctx) => boolean
  requires?: string[]    // 이 스텝 이전에 artifacts에 있어야 할 키들
}

// 예: 로샤 템플릿
{
  key: 'scoring',
  label: '채점',
  requires: ['rorschach_coding']   // coding 결과가 없으면 진입 불가
}
```

- Resolver가 `requires` 미충족 시 해당 스텝을 **잠금 상태**로 표시.
- 채점·해석처럼 코딩 artifacts를 입력으로 받는 스텝이 안전하게 작동.
- 공용 step은 `requires` 없이도 동작, 특수 step과 연동할 때만 선언.

#### (3) Assessment-Specific Slot (공용 UI의 검사별 주입)

소견 모달·결과 뷰어처럼 **공용 UI지만 검사별 내용이 다른** 경우를 위한 슬롯 개념.

```typescript
// src/lib/features/assessment/status-detail/process/slot-registry.ts
export const ASSESSMENT_SLOT_REGISTRY = {
  opinion_extra: {
    rorschach: RorschachOpinionExtra,       // 로샤 소견에만 추가되는 섹션
    mmpi: MMPIOpinionExtra,
    // 등록 없으면 렌더 안 함
  },
  result_viewer: {
    rorschach: RorschachResultView,
    wisc: WiscResultView,
  }
}
```

- 공용 소견 모달이 `<svelte:component this={ASSESSMENT_SLOT_REGISTRY.opinion_extra[assessment.code]} />`로 렌더.
- 특정 검사만 필요한 UI를 공용 컴포넌트에 분기 박지 않고도 붙일 수 있음.
- 슬롯이 없으면 공용 UI가 그대로 렌더.

#### (4) 특수 step 아트팩트 저장 규약

`task.process.artifacts` 아래 검사별 namespace로 저장.

```json
{
  "current_step": "scoring",
  "step_states": {
    "rorschach_coding": { "status": "completed", "sub_step": "structural_summary" },
    "scoring": { "status": "in_progress" }
  },
  "artifacts": {
    "rorschach_coding": {
      "responses": [
        { "card": "I", "time": 12, "responses": [...] }
      ],
      "structural_summary": { "R": 22, "F_percent": 45, "WSum6": 8 }
    }
  }
}
```

- artifacts 스키마는 각 검사 모듈(프론트 타입 파일 + 선택적 백엔드 validator)이 소유.
- 백엔드는 JSONB로 그대로 저장, 내용 검증은 애플리케이션 레벨에서만.
- 향후 검사별 리포지토리·쿼리가 필요해지면 별도 테이블로 분리 가능(하지만 P1 범위 아님).

#### 공유 위젯 전략

로샤·TAT 공통의 "카드 반응 기록" 같은 위젯은 `process/widgets/` 하위에 두고 step 컴포넌트가 import. step 계약은 동일 유지.

```
process/
├── steps/                      # 각 검사의 특수 step (최상위)
│   ├── RorschachCodingStep.svelte
│   ├── TATNarrativeStep.svelte
│   └── ...
└── widgets/                    # step 내부에서 재사용 가능한 부품
    ├── CardResponseRecorder.svelte
    ├── ImageAnnotationCanvas.svelte
    └── SubtestScoreGrid.svelte
```

### 2-7. Case 단위 종합보고서 연동 (에셋 추출 인터페이스)

종합보고서는 **별도 에디터 페이지**에서 작성된다(본 리팩터링 범위 밖). 그 에디터가 각 검사의 결과를 가져다 조합하려면 Task 템플릿이 **어떤 에셋을 어떻게 노출할지** 미리 선언해 두어야 한다.

이 인터페이스를 **지금 표준화**해 두면 종합보고서 에디터 착수 시 기존 검사를 재작업할 필요가 없다.

#### 개념: `StepDefinition.exports`

```typescript
interface StepDefinition {
  key: string
  label: string
  // ... 기존 필드
  exports?: Record<string, AssetExport>
}

interface AssetExport {
  label: string                         // "WISC 지표 점수표" (에디터 사이드바 노출명)
  category?: 'summary' | 'table' | 'narrative' | 'image' | 'chart'
  renderer?: string                     // 슬롯 레지스트리 키 (별도 미리보기 컴포넌트)

  // 추출 방식은 아래 둘 중 하나 (또는 둘 다)
  extract?: (artifacts: unknown) => AssetPayload   // 정형 데이터 추출 (JSON artifacts)
  auto_crop?: CropRecipe                           // PDF 자동 크롭 (이미지 에셋)
}

interface AssetPayload {
  type: string                          // "wisc_composite" | "rorschach_structural" | ...
  data: unknown
  meta?: { source_task_id: string; source_step_key: string; extracted_at: string }
}

interface CropRecipe {
  source: 'uploaded_pdf'                // 어떤 artifacts에서
  page: number | 'auto'                 // 페이지 번호 또는 패턴 매칭
  region: { x: number; y: number; w: number; h: number }  // PDF 상대 좌표
  output_key: string                    // artifacts.auto_assets[output_key]에 저장
  detect?: 'keyword' | 'layout'         // 선택: 앵커 텍스트/레이아웃으로 영역 자동 탐지
}
```

#### 두 가지 추출 방식

| 방식 | 용도 | 예시 |
|---|---|---|
| **`extract`** (정형) | artifacts가 JSON인 검사 | 로샤 구조 요약, WISC 원점수 테이블, SCT 주제 분류 |
| **`auto_crop`** (이미지) | PDF 업로드 검사의 차트·표를 자동 크롭 | WISC 보고서의 프로파일 그래프, MMPI 프로파일 |

둘 다 종합보고서 에디터 사이드바에 **같은 에셋 목록**으로 노출된다. 에디터 입장에선 방식 차이를 몰라도 됨.

#### 예시 A — 정형 데이터 (로샤)

```typescript
{
  key: 'rorschach_coding',
  label: '코딩',
  exports: {
    structural_summary: {
      label: '로샤 구조 요약',
      category: 'summary',
      extract: (a) => ({
        type: 'rorschach_structural',
        data: a.rorschach_coding.structural_summary   // { R, F_percent, WSum6 }
      })
    }
  }
}
```

#### 예시 B — PDF 자동 크롭 (K-WISC 업로드)

```typescript
{
  key: 'wisc_report_upload',
  label: '보고서 업로드',
  exports: {
    composite_scores: {
      label: 'WISC 지표 점수표',
      category: 'chart',
      auto_crop: {
        source: 'uploaded_pdf',
        page: 3,
        region: { x: 80, y: 200, w: 440, h: 280 },
        output_key: 'composite_scores_img'
      }
    },
    profile_chart: {
      label: 'WISC 프로파일',
      category: 'chart',
      auto_crop: {
        source: 'uploaded_pdf',
        page: 3,
        region: { x: 80, y: 520, w: 440, h: 260 },
        output_key: 'profile_chart_img'
      }
    }
  }
}
```

#### PDF 자동 크롭 동작 흐름

```
PDF 업로드
  ↓
백엔드 워커가 해당 step의 auto_crop 레시피 전부 실행 (PyMuPDF 등)
  ↓
크롭 이미지 S3 저장 → artifacts.auto_assets[output_key] = { image_url, crop_meta }
  ↓
상세 페이지 step에서 크롭 결과 미리보기 표시 (담당자 확인용)
  ↓
종합보고서 에디터: exports에 선언된 항목을 자동 노출
```

#### 종합보고서 에디터 쪽 (별도 페이지, 본 문서 범위 밖)

```
종합보고서 에디터
  ├─ Case에 속한 Task 목록 조회
  ├─ 각 Task의 template에서 exports를 모아 사이드바 목록 구성
  │     • [로샤] 구조 요약 (정형)
  │     • [TAT] 주제 분석 (정형)
  │     • [K-WISC] 지표 점수표 (이미지) / 프로파일 (이미지)
  │     • [MMPI] 프로파일 차트 (이미지)
  │     ...
  ├─ 담당자가 드래그/삽입 → AssetPayload가 에디터 본문에 꽂힘
  └─ 최종 문서는 Case 단위 Document로 저장
```

#### 원칙

- **읽기 전용 참조**: 종합보고서 에디터는 Task artifacts를 읽기만 한다.
- **추출 책임은 검사 쪽**: 어떤 데이터를 어떻게 요약·크롭할지 각 검사의 `exports`가 결정.
- **자동 중심, 수동은 미래 확장 자리**: 현재는 `extract` + `auto_crop` 두 가지 자동 방식. 담당자가 즉석에서 크롭하는 `manual_assets` 필드는 JSONB 내부 관례로 자리만 비워둠 (P2 이후).
- **레시피 버전 관리**: PDF 레이아웃이 바뀔 수 있으므로 `Assessment.pdf_layout_version` 컬럼으로 버전별 `auto_crop` 분기 가능 (필요 시).
- **본 리팩터링 범위**: `exports` 인터페이스 정의 + 기존 검사의 선언까지만. 에디터 페이지·렌더러·크롭 워커는 별도 작업.

---

## 3. 백엔드 보강 (최소 변경)

### 3-1. `Assessment` 테이블에 컬럼 추가 (nullable, 마이그레이션 안전)

| 컬럼 | 타입 | 용도 |
|---|---|---|
| `process_template_key` | `VARCHAR(50)` nullable | 프론트 레지스트리 매칭 키. null이면 기존 `workflow_type` 기반 폴백 |
| `process_overrides` | `JSONB` nullable | 템플릿에서 step 일부 교체·추가할 때 (예: "이 검사는 observation 스텝 생략") |

### 3-2. `AssessmentTask.process` JSONB 활용 (스키마 확장 없음)

기존 구조에 step별 상태를 담는다:

```json
{
  "current_step": "scoring",
  "step_states": {
    "intake": { "status": "completed", "completed_at": "..." },
    "online_fill": { "status": "completed", "response_rate": 1.0 },
    "scoring": { "status": "in_progress" },
    "report_delivery": { "status": "pending" }
  },
  "artifacts": {                 // 파일 업로드·링크·결과 등
    "professional_report_doc_id": "uuid",
    "client_report_doc_id": "uuid"
  }
}
```

기존 `progress_rate`, `response_count` 같은 필드는 `step_states` 아래로 흡수하거나 보조 캐시로 유지.

### 3-3. API 응답 추가

`Task` 응답 DTO에 `process_template_key`, `step_states`를 포함. 프론트는 이 값으로 템플릿을 찾아 렌더.

> **백엔드 로직 변경 없음**. 컬럼 2개 + JSONB 내부 관례만 정하고, 비즈니스 로직은 그대로 유지.

---

## 4. 프론트 구조 (feature 모듈)

```
src/lib/features/assessment/status-detail/
├── process/
│   ├── step-registry.ts              # step_key → Component 매핑
│   ├── templates.ts                  # ProcessTemplate 카탈로그
│   ├── context.ts                    # StepContext 타입·빌더
│   ├── resolver.ts                   # assessment → template → steps 조립
│   └── steps/
│       ├── IntakeStep.svelte
│       ├── OnlineFillStep.svelte
│       ├── PaperFillStep.svelte
│       ├── InterviewStep.svelte
│       ├── AdministrationStep.svelte
│       ├── ObservationStep.svelte
│       ├── ReportUploadStep.svelte
│       ├── AutoScoringStep.svelte
│       ├── ManualScoringStep.svelte
│       ├── ProfessionalReportStep.svelte
│       ├── ClientReportStep.svelte
│       └── ReportDeliveryStep.svelte
├── components/
│   └── ProcessPanel.svelte           # 새 범용 패널 (기존 Self/External 패널 대체)
└── ...
```

### 4-1. ProcessPanel.svelte (의사코드)

```svelte
<script lang="ts">
  import { resolveTemplate } from '../process/resolver'
  import { STEP_REGISTRY } from '../process/step-registry'
  import Stepper from '$lib/components/assessment/status/Stepper.svelte'

  let { assessment, task, caseVM, callbacks } = $props()

  const template = $derived(resolveTemplate(assessment))
  const visibleSteps = $derived(
    template.steps.filter(s => !s.condition || s.condition({ assessment, task }))
  )
  const activeIdx = $derived(
    visibleSteps.findIndex(s => s.key === task.process.current_step)
  )
  const activeStep = $derived(visibleSteps[activeIdx])
  const ActiveComponent = $derived(STEP_REGISTRY[activeStep?.key])

  const stepperSteps = $derived(
    visibleSteps.map(s => ({ key: s.key, label: s.label }))
  )
  const completedIndices = $derived(
    visibleSteps
      .map((s, i) => task.process.step_states?.[s.key]?.status === 'completed' ? i + 1 : null)
      .filter((n): n is number => n !== null)
  )
</script>

<Stepper steps={stepperSteps} activeStep={activeIdx + 1} completedSteps={completedIndices} />

{#if ActiveComponent}
  <svelte:component this={ActiveComponent} {task} {assessment} {caseVM} {callbacks} />
{:else}
  <!-- 폴백: 템플릿 없거나 스텝 없음 -->
{/if}
```

### 4-2. Step 컴포넌트 계약

모든 step 컴포넌트는 동일한 Props 계약을 가진다:

```typescript
interface StepProps {
  task: AssessmentTask
  assessment: AssessmentItem
  caseVM: CaseDetailVM
  callbacks: {
    onComplete: (stepKey: string, artifacts?: Record<string, unknown>) => Promise<void>
    onRollback: (stepKey: string) => Promise<void>
    onUploadArtifact: (type: string, file: File) => Promise<string>
    // ...
  }
}
```

> 계약이 통일되면 새 스텝 추가는 **Svelte 파일 하나 만들어서 레지스트리에 등록**만 하면 끝.

### 4-3. Actions & Badges

헤더의 공용 액션(완료/중단/소견)은 AssessmentMain이 그대로 들고 있음.
검사별 특수 액션(예: "재채점 요청")은 템플릿 `actions` 필드로 선언 + 헤더가 동적 렌더:

```typescript
interface ActionOverride {
  key: string
  label: string
  icon?: string
  visible?: (ctx) => boolean
  run: (ctx) => Promise<void>
}
```

---

## 5. 마이그레이션 전략 (점진적)

### Phase A — 레지스트리 뼈대 + 기존 2타입 이전

- ProcessPanel, StepRegistry, Templates 기초 모듈 작성.
- `self_report_online`, `external_report_upload` 2개 템플릿으로 시드.
- 기존 `SelfReportDetailPanel` / `ExternalServiceDetailPanel` 로직을 그대로 step 컴포넌트로 분해 이식.
- AssessmentMain의 `{#if isSelfReport} ... {:else if isExternalService}`를 `<ProcessPanel />` 1줄로 대체.
- 백엔드 변경 없음 — `assessment.workflow_type`을 resolver가 template_key로 매핑.

**성공 기준**: 기존 동작 100% 유지, UI 차이 없음.

### Phase B — 백엔드 메타 컬럼 추가

- `Assessment.process_template_key` 컬럼 추가 (nullable).
- super_admin 시드로 주요 검사 ~20개의 template_key 설정.
- Resolver를 `assessment.process_template_key` 우선, 없으면 `workflow_type` 폴백으로 변경.

### Phase C — 신규 템플릿 추가

- `intelligence_battery`, `projective_test`, `developmental_screening` 등 시드.
- 새 step 컴포넌트 추가 (`InterviewStep`, `ObservationStep` 등).
- 대상 검사부터 하나씩 `process_template_key` 설정.
- UI QA 후 점진 롤아웃.

### Phase D — process JSONB 표준화

- `task.process`에 `current_step`·`step_states` 포맷을 공식화.
- 기존 자가보고형의 `response_count`, `progress_rate`는 `step_states.online_fill` 아래로 통합 (혹은 캐시로 보존).
- 백엔드 completeStep/rollbackStep API (또는 기존 task 상태 API에 step_key 파라미터 추가) 마련.

### Phase E — process_overrides 도입 (필요 시)

- 같은 템플릿을 쓰지만 특정 검사만 특정 스텝 생략/추가가 필요할 때.
- `assessment.process_overrides` JSONB로 조작.
- 실제 필요성 확인 후 진행.

---

## 6. 설계 결정 포인트 (합의 필요)

1. **템플릿 저장 위치**
   - (A) 프론트 코드 상수 (지금 제안). 배포 필요하나 타입 안전·검토 용이.
   - (B) DB 마스터 테이블. 런타임 변경 가능하나 검증·관리 부담.
   - **초안 권장**: A로 시작, Phase D 이후 필요 시 B로 마이그레이션.

2. **step_states 소유 주체**
   - (A) 백엔드가 task 상태 전이 API에서 직접 갱신.
   - (B) 프론트가 JSONB에 써서 저장.
   - **초안 권장**: A. 상태 전이는 백엔드 책임이 원칙.

3. **공용 스텝 최소 집합**
   - intake / administration / scoring / report_delivery 를 공용으로. 그 외는 고유.
   - 공용 스텝은 백엔드 상태 전이(pending→processing→completed) 매핑이 일관.

4. **조건부 스텝 (condition)**
   - 예: "is_online이면 online_fill, 아니면 paper_fill" — 템플릿을 2개로 쪼개는 게 나은가, 하나에 condition으로 해결하는 게 나은가?
   - **초안 권장**: 기본은 템플릿 분리, 명백히 한 쌍일 때만 condition.

5. **기존 task.process 필드 호환**
   - 현 구조에 이미 저장된 데이터 (`response_count` 등)를 어떻게 마이그레이션?
   - 읽기 시 step_states로 투영하는 어댑터로 시작, 쓰기는 새 포맷.

6. **검사별 고유 액션 구현 경계**
   - 예: MMPI "재채점 요청" 같은 희귀 액션을 템플릿의 `actions`로 정의하는가, step 컴포넌트 내부에서 해결하는가.
   - **초안 권장**: step 내부 해결. 헤더에 노출이 꼭 필요한 경우만 `actions`.

7. **Sub-Stepper 깊이 허용 범위** (§2-6 관련)
   - step 컴포넌트 내부에 자체 위저드(sub-step)를 두는 것은 허용.
   - **제한**: 중첩은 1단계까지. sub-step이 또 sub-step을 가지면 추적성 붕괴.
   - **초안 권장**: 1단계 sub-stepper 허용, 그 이상 복잡도는 step을 최상위로 분리.

8. **Assessment-Specific Slot 범위** (§2-6 관련)
   - 슬롯 포인트를 어디까지 공식화할지: 소견 모달 / 결과 뷰어 / 목록 뱃지 / 인쇄 포맷 등.
   - **초안 권장**: 초기엔 `opinion_extra`, `result_viewer` 2개만. 필요해지는 대로 추가.

9. **Artifacts 스키마 검증 주체**
   - `task.process.artifacts.rorschach_coding` 같은 검사별 JSONB의 타입 안전을 어디서 보장?
   - (A) 프론트 TypeScript 타입만. 백엔드는 JSONB 그대로 저장.
   - (B) 백엔드 Pydantic 검증 (검사별 스키마를 모듈에 정의).
   - **초안 권장**: A로 시작. 수급 오류가 관측되면 특정 검사만 B로 승격.

10. **특수 step 백엔드 분리 시점**
    - JSONB로 시작해도, 쿼리·집계가 빈번해지면 별도 테이블이 유리해짐 (로샤 결정인 빈도 통계 등).
    - **초안 권장**: P1에선 JSONB 유지. 검사별 리포트 요구가 실제로 생기는 시점에 분리.

---

## 7. 기존 문서와의 관계

- [domain_v3.md](./domain_v3.md) §2-2 `AssessmentTask.process` JSONB 설계는 **그대로 유지·확장**. 본 문서는 그 JSONB 안에 `current_step / step_states` 관례를 추가하는 제안.
- [scenarios.md](./scenarios.md)의 워크플로우 예시는 템플릿 카탈로그의 근거 자료로 활용.
- [schema.md](./schema.md)에는 `process_template_key`, `process_overrides` 컬럼 추가만 반영.

---

## 8. 다음 액션

1. §6 설계 결정 포인트 합의.
2. 초기 템플릿 카탈로그(6~8개) 구체화 — 실제 검사 대상 선정.
3. Step 컴포넌트 계약(StepProps) 타입 확정.
4. Phase A 착수 (기존 2타입 이전 — UI 회귀 무)로 안전성 검증.
5. domain_v3.md에 본 문서 §2 개념 모델 링크 반영.

---

## 9. 한눈에 보는 변화

| 영역 | 현재 | 리팩터링 후 |
|---|---|---|
| 분기 | `{#if isSelfReport} ... {:else if isExternalService}` | `<ProcessPanel />` 단일 컴포넌트 |
| 새 검사 추가 | 새 패널 파일 + AssessmentMain 수정 + 분기 추가 | 템플릿 하나 추가 + (필요시) step 컴포넌트 추가 |
| 스텝 구성 | 패널 내부 하드코딩 | 템플릿이 선언, 레지스트리가 렌더 |
| 공용/고유 | 섞임 | 공용은 공통 집합, 고유는 step 컴포넌트·액션 오버라이드 |
| **검사별 특수 단계** (로샤 코딩, WISC 소검사 등) | 대응 불가 | Step 내부 Sub-Stepper + artifacts JSONB + requires 의존성 선언 |
| **검사별 공용 UI 확장** (소견·결과뷰어) | 공용 컴포넌트에 검사별 분기 | Assessment-Specific Slot으로 주입 |
| 백엔드 | — | nullable 컬럼 2개 추가(Phase B 이후). 로직 무변경 |
| 검사 타입 확장성 | 2종 | 무제한 (템플릿 조합 + 특수 step 레지스트리) |
