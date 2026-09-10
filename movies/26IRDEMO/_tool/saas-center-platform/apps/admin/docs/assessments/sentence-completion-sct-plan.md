# 반투사 검사 — 문장완성검사 (SCT)

> 검사 유형별 definition 확장 계획.

---

## 1. 검사 개요

| 항목 | 내용 |
|------|------|
| **분류** | 반투사 검사 (Semi-Projective Test) |
| **자극** | 미완성 문장 줄기 (stem) |
| **응답 방식** | 자유 텍스트로 문장 완성 |
| **진행 단계** | 단일 단계 (순차 응답) |
| **채점** | AI 보조 해석 (예정) + 검사자 확정 |
| **대표 도구** | Rotter ISB, Sacks SCT, KSSCT 등 |
| **workflow_type** | `self_report` (피검자가 직접 응답) |
| **definition.type** | `sentence_completion` |

---

## 2. 워크플로우 설계 (확정)

### 2.1 워크플로우 분류 체계

`workflow_type`은 **"누가 응답하는가"** 기준으로 분류한다. 채점 방식은 별도 축(채점 엔진)으로 관리.

| workflow_type | 의미 | 해당 검사 | supports_online |
|---|---|---|---|
| `self_report` | 피검자가 직접 응답 | 객관검사, SCT | 선택 가능 |
| `manual` | 검사자가 대면 실시 | 로르샤흐, HTP, BGT, Bayley | 선택 가능 (기본 false) |
| `external_service` | 외부 서비스 연동 | 외부 URL 검사 | 선택 가능 |

### 2.2 SCT가 `self_report`인 이유

- 피검자가 온라인/오프라인 모두에서 **직접 응답**함 (객관검사와 동일한 수집 흐름)
- 채점 방식만 다름 (자동 합산 vs AI 보조 해석) → 이는 채점 엔진이 `definition.type`으로 분기
- `workflow_type`을 검사마다 새로 만들면 끝없이 증가 → 응답 수집 흐름 기준으로 통합

### 2.3 2계층 구조

```
Assessment 모델
├── workflow_type: "self_report" | "manual" | "external_service"
│   → 누가 응답하는가 (admin 에디터 분기 기준)
│
├── supports_online: boolean
│   → workflow_type과 독립적인 옵션 (모든 타입에서 선택 가능)
│
└── definition (JSON)
    ├── type: "choice" | "sentence_completion" | "projective" | "drawing" | ...
    │   → 문항 구조 / 채점 엔진 분기 기준
    ├── instruction: "..."
    └── questions / stimuli / tasks (type에 따라 구조 다름)
```

### 2.4 supports_online 독립화

기존: `self_report`이면 `supports_online = true` 강제
변경: **모든 workflow_type에서 독립적으로 선택 가능**

| workflow_type | supports_online 기본값 | 설명 |
|---|---|---|
| `self_report` | `true` (변경 가능) | 대부분 온라인 지원하지만 오프라인 전용도 가능 |
| `manual` | `false` (변경 가능) | 대면 검사지만 온라인 기록 입력 가능한 경우 있음 |
| `external_service` | `false` (변경 가능) | 외부 서비스 특성에 따라 다름 |

---

## 3. 핵심 특성

### 객관 검사와의 비교

| | 객관 검사 (self_report) | SCT (self_report) |
|---|---|---|
| **자극** | 텍스트 문항 (`text`) | 미완성 문장 줄기 (`stem`) |
| **응답** | 고정 선택지 택1 | 자유 텍스트 입력 |
| **선택지** | `common_options` 필요 | 없음 |
| **채점** | 자동 (점수 합산) | AI 보조 해석 + 검사자 확정 |
| **문항 구조** | `{ number, text, options }` | `{ number, stem_before, stem_after? }` |
| **definition.type** | `choice` | `sentence_completion` |

### 로르샤흐와의 비교

| | 로르샤흐 (투사) | SCT (반투사) |
|---|---|---|
| **자극** | 이미지 카드 | 텍스트 (문장 줄기) |
| **반응 개수** | 카드당 무제한 | 문항당 1개 |
| **코딩 체계** | 복잡 (영역/결정인/내용 등) | 없음 (내용 분석) |
| **definition 구조** | `stimuli` + `coding_categories` | `questions` (현재와 유사) |

### 관리자 편집 필요 여부

**✅ 편집 UI 필요**

- 표준화된 버전(Rotter, Sacks)이 있지만 센터/대상에 따라 문장 줄기 커스텀이 흔함
- 문항 추가/삭제/순서변경/텍스트수정 모두 필요
- **현재 에디터 UI를 거의 그대로 활용 가능** (`common_options` 없이 `questions`만 사용)

---

## 4. definition 구조 (예시)

### 문항 형태

| 형태 | 설명 | 예시 |
|------|------|------|
| **일반형** | 줄기 뒤에 응답 | `나의 어머니는 ___` |
| **끼워넣기형** | 줄기 사이에 응답 | `나는 ___ 때문에 학교가 싫다` |

- `stem_before`: 응답 앞에 오는 문장 줄기 (필수)
- `stem_after`: 응답 뒤에 오는 문장 줄기 (null이면 일반형, 값이 있으면 끼워넣기형)

```json
{
  "type": "sentence_completion",
  "instruction": "아래 문장을 읽고 떠오르는 대로 문장을 완성해 주세요.",
  "questions": [
    { "number": 1, "stem_before": "나의 어머니는", "stem_after": null },
    { "number": 2, "stem_before": "내가 가장 두려운 것은", "stem_after": null },
    { "number": 3, "stem_before": "다른 친구들에 비해 나는", "stem_after": null },
    { "number": 4, "stem_before": "나는", "stem_after": "때문에 학교가 싫다" },
    { "number": 5, "stem_before": "앞으로의 나는", "stem_after": null },
    { "number": 6, "stem_before": "내가 바라는 것은", "stem_after": null },
    { "number": 7, "stem_before": "나는", "stem_after": "할 때 가장 행복하다" },
    { "number": 8, "stem_before": "나를 가장 화나게 하는 것은", "stem_after": null },
    { "number": 9, "stem_before": "내가 싫어하는 사람은", "stem_after": null },
    { "number": 10, "stem_before": "잠자리에 들면 나는", "stem_after": null }
  ]
}
```

### 현재 객관 검사 구조와의 호환성

```
객관 검사:  { number, text, options? }             + common_options    → definition.type = "choice"
SCT:       { number, stem_before, stem_after? }   + (선택지 없음)      → definition.type = "sentence_completion"
```

- `questions` 배열 + `number` 순번 구조 동일
- `text` 대신 `stem_before` + `stem_after` 조합으로 문장 줄기 표현
- `stem_after`가 null이면 일반형, 값이 있으면 끼워넣기형
- `common_options` 없음 → 에디터에서 공통 선택지 섹션 미표시

---

## 5. responses 구조 (예시)

```json
{
  "responses": [
    { "question_number": 1, "answer_text": "항상 나를 걱정해 주신다" },
    { "question_number": 2, "answer_text": "혼자 남겨지는 것이다" },
    { "question_number": 3, "answer_text": "조금 소심한 편이다" }
  ]
}
```

- 객관 검사의 `answer_value` (숫자) 대신 `answer_text` (자유 텍스트)
- 문항당 반응 1개 (로르샤흐와 다름)

---

## 6. 에디터 UI 영향

### 현재 에디터로 커버 가능한 부분

| 기능 | 객관 검사 에디터 | SCT 적용 |
|------|-----------------|----------|
| 문항 추가/삭제 | ✅ | ✅ 그대로 사용 |
| 문항 순서 변경 | ✅ | ✅ 그대로 사용 |
| 문항 텍스트 수정 | ✅ (`text`) | ✅ (`stem_before` + `stem_after` 편집) |
| 공통 선택지 편집 | ✅ | ❌ 미표시 (선택지 없음) |
| 번호 자동 재정렬 | ✅ | ✅ 그대로 사용 |

### 필요한 변경

- **에디터 분기**: `definition.type`에 따라 공통 선택지 섹션 표시/숨김
- **필드 구조**: `stem_before` + `stem_after` 2개 입력 필드 (끼워넣기 지원)
- **보기 모드**: 선택지 열 없이 번호 + 문장 줄기 미리보기 테이블
- **끼워넣기 토글**: 문항별로 `stem_after` 입력 활성화/비활성화 (또는 빈 값이면 일반형)

### 에디터 UI 예시

#### 일반형 문항

```
1. 줄기: [나의 어머니는                    ]
   미리보기: "나의 어머니는 ___"
```

#### 끼워넣기형 문항

```
4. 줄기(앞): [나는                          ]
   줄기(뒤): [때문에 학교가 싫다             ]
   미리보기: "나는 ___ 때문에 학교가 싫다"
```

---

## 7. 구현 시 고려사항

### 7.1 현재 구조 검증용 테스트 케이스

SCT는 **`common_options` 없이 `questions`만 있는 definition**의 좋은 테스트 케이스:
- 에디터에서 공통 선택지 섹션이 빈 상태로 정상 동작하는지
- 보기 모드에서 선택지 열 없이 깔끔하게 표시되는지

### 7.2 온라인 검사 지원

- 온/오프라인 모두 지원 (`supports_online` 옵션으로 선택)
- 온라인: 피검자가 웹에서 문장 줄기를 보고 텍스트 입력 → responses에 저장
- 오프라인: 검사자가 수기 응답을 시스템에 입력
- 끼워넣기형은 `stem_before [입력란] stem_after` 형태로 렌더링

### 7.3 채점/해석

- 자동 합산 채점 불가 (자유 텍스트)
- 검사자가 반응 내용을 읽고 영역별(가족, 대인관계, 자아개념 등) 해석 작성
- 해석 결과는 별도 필드에 저장 (definition과 무관)

### 7.4 AI 보조 해석 (추후 확장)

SCT는 투사 검사 중 AI 적용이 가장 수월한 유형이다:
- 입력이 텍스트 (이미지 해석 불필요)
- 해석 프레임이 비교적 구조화되어 있음 (영역별 분류)
- 정답 없이 경향성 파악이 목적 → LLM이 잘하는 영역

#### 적용 수준별 단계

| 수준 | 기능 | 설명 |
|------|------|------|
| **1단계** | 응답 요약 | 키워드 추출, 감정 태깅 → 검사자 시간 절약 |
| **2단계** | 영역별 경향성 분석 | 가족/대인관계/자아개념 등 영역별 분류 + 경향성 초안 |
| **3단계** | 해석 보고서 초안 | 검사자가 수정만 하면 되는 수준의 보고서 생성 |

#### 핵심 원칙

- **보조 도구**이지 최종 해석이 아님
- "AI 해석 제안" → 검사자 검토/수정 → 확정 흐름 필수
- 프롬프트에 검사 도구별 해석 프레임워크 제공 필요 (해석 품질 좌우)

#### 데이터 흐름

```
responses (자유 텍스트 응답)
  → AI 분석 요청 (백그라운드)
  → ai_interpretation 필드에 저장
  → 검사자에게 "AI 해석 제안"으로 표시
  → 검사자가 수정/확정
  → final_interpretation 저장
```

#### 아키텍처

- 기존 채점 엔진 플러그인 구조 활용
- SCT용 플러그인에서 LLM API 호출
- definition과 독립적 (엔진 레이어의 영역)
- 현재 설계에 영향 없음

---

## 8. 구현 체크리스트 (admin)

### 프론트엔드 변경

- [ ] `constants.ts` — `WORKFLOW_OPTIONS`에 `manual` 추가, `WORKFLOW_LABELS` 업데이트
- [ ] `assessment.action.ts` — `QuestionItem` 타입에 `stem_before`, `stem_after` 추가
- [ ] `definition-editor.svelte.ts` — `definition.type`에 따라 SCT용 문항 추가/편집/export 분기
- [ ] `DefinitionEditor.svelte` — `definition.type`에 따라 UI 분기 (공통 선택지 숨김, stem 필드)
- [ ] 등록 페이지 — `supports_online` 독립 옵션화, `self_report` + `sentence_completion` 에디터 연결
- [ ] 수정 페이지 — 동일하게 `supports_online` 독립 옵션화

### 백엔드 변경

- 없음 (definition은 JSON 컬럼, workflow_type은 String(30)이라 제약 없음)
