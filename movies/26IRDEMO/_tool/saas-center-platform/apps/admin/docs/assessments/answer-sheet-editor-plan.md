# 응답지/답안지 편집 UI

> 온라인 검사 미지원 검사도구의 문항 정의(definition)를 관리자가 편집할 수 있는 UI

---

## 1. 개요

### 1.1 목적

플랫폼 관리자가 검사 도구의 **문항 정의(definition.questions)**를 웹 UI에서 직접 편집할 수 있게 한다.
현재 definition은 seed 스크립트로만 입력 가능한데, 이를 admin 검사 상세 페이지에서 관리할 수 있도록 한다.

### 1.2 용어 정의

| 용어 | 설명 |
|------|------|
| **definition** | `Assessment.definition` JSONB 필드. 문항/채점/해석 정의를 저장 |
| **questions** | `definition.questions` 배열. 각 문항의 번호, 텍스트, 선택지 등 |
| **responses** | `AssessmentTask.process.responses` 배열. 실제 응답 데이터 `[{question_number, answer_value}]` |

### 1.3 현재 상태

| 항목 | 상태 |
|------|------|
| `Assessment.definition` JSONB 필드 (모델) | ✅ 존재 |
| 시드 데이터 (스마트폰 중독 15문항) | ✅ 존재 |
| 채점 엔진 플러그인 시스템 | ✅ 존재 |
| Admin 검사 상세 API (`definition` 포함 반환) | ❌ schema에 definition 미포함 |
| Admin 검사 등록 API (`definition` 저장) | ❌ schema/handler에 definition 미포함 |
| Admin 검사 수정 API (`definition` 수정) | ❌ schema에 definition 미포함 (handler는 `model_dump` 패턴이라 schema 추가만으로 동작) |
| Admin 검사 상세 페이지 definition 표시/편집 UI | ❌ 미구현 |

### 1.4 현재 definition 구조

```json
{
  "questions": [
    { "number": 1, "text": "스마트폰의 지나친 사용으로 학교 성적이 떨어졌다" },
    { "number": 2, "text": "가족이나 친구들과 함께 있는 것보다..." }
  ]
}
```

### 1.5 워크플로우 타입별 문항 관리 필요 여부

| workflow_type | 설명 | definition 사용 | 문항 관리 UI |
|---------------|------|----------------|-------------|
| `self_report` | 자가응답 + 자동채점 | ✅ `definition.questions`로 문항 표시 → 응답 수집 → 채점 | ✅ 필요 |
| `external_service` | 외부 서비스 연동 | ❌ 비어있음 (`{}`) — 외부 URL에서 검사 진행 | ❌ 불필요 |

> **핵심 분기**: 문항 정의 섹션 및 모달은 `workflow_type === 'self_report'`일 때만 노출.

---

## 2. 목표 definition 구조

### 2.1 확장된 questions 스키마

현재 `{ number, text }` 구조를 확장하여 **선택지(options)** 정보를 포함한다.

```json
{
  "questions": [
    {
      "number": 1,
      "text": "스마트폰의 지나친 사용으로 학교 성적이 떨어졌다",
      "options": [
        { "value": 1, "label": "전혀 그렇지 않다" },
        { "value": 2, "label": "그렇지 않다" },
        { "value": 3, "label": "그렇다" },
        { "value": 4, "label": "매우 그렇다" }
      ]
    }
  ],
  "common_options": [
    { "value": 1, "label": "전혀 그렇지 않다" },
    { "value": 2, "label": "그렇지 않다" },
    { "value": 3, "label": "그렇다" },
    { "value": 4, "label": "매우 그렇다" }
  ]
}
```

### 2.2 설계 결정

| 항목 | 결정 | 이유 |
|------|------|------|
| **common_options** | 도입 | 대부분 검사는 모든 문항이 동일한 선택지 사용. 공통 선택지로 반복 제거 |
| **문항별 options** | 선택적 | 문항별 선택지가 다른 경우에만 사용. 없으면 common_options 적용 |
| **역채점(reverse)** | 포함하지 않음 | 채점 로직은 엔진 플러그인이 담당. definition은 순수 문항 정의만 |

### 2.3 하위 호환성

- 기존 `{ number, text }` 구조는 그대로 유효 (options 없이도 동작)
- 채점 엔진은 `process.responses`만 사용하므로 definition 확장에 영향 없음
- 프론트엔드(web)의 `view-model.ts`는 `definition.questions`의 `number`, `text`만 사용 중

---

## 3. 백엔드 변경

> 참조: `apps/admin/docs/API_ARCHITECTURE.md`

### 3.1 현재 assessment 모듈 구조

현재 **단순 모듈 구조** (Repository/Service 없이 Handler 직접 처리):

```
platform_admin/assessment/
├── schemas.py
├── router.py
└── handlers/
    ├── __init__.py
    ├── list_assessments.py      ← uow._session 직접 → return (commit 없음)
    ├── get_assessment.py        ← uow._session 직접 → return (commit 없음)
    ├── create_assessment.py     ← uow._session 직접 → audit.log → commit
    └── update_assessment.py     ← uow._session 직접 → audit.log → commit
```

> API_ARCHITECTURE.md §2 "단순 모듈 구조" — 쿼리가 단순한 경우 Handler에서 직접 처리 허용.
> API_ARCHITECTURE.md §6 현황 — assessment: Repository ✗, Services ✗, Handler 직접 처리.

### 3.2 변경 사항

#### schemas.py — definition 필드 추가 (3개 스키마)

```python
class AdminAssessmentDetailResponse(BaseModel):
    # ... 기존 필드 ...
    definition: dict = Field(default_factory=dict)  # 추가

class AdminAssessmentCreateRequest(BaseModel):
    # ... 기존 필드 ...
    definition: dict = Field(default_factory=dict)  # 추가

class AdminAssessmentUpdateRequest(BaseModel):
    # ... 기존 필드 ...
    definition: dict | None = None  # 추가
```

#### handlers/create_assessment.py — definition 전달 추가

현재 create handler는 필드를 명시적으로 나열하여 `Assessment()` 생성:

```python
# 현재 (L28-41)
assessment = Assessment(
    code=data.code,
    version=data.version,
    # ... 기존 필드 ...
    supports_online=data.supports_online,
)

# 변경: definition 추가
assessment = Assessment(
    # ... 기존 필드 ...
    supports_online=data.supports_online,
    definition=data.definition,           # ← 1줄 추가
)
```

#### handlers/update_assessment.py — 변경 불필요

현재 update handler는 `model_dump(exclude_unset=True)` + `setattr` 루프 패턴:

```python
update_data = data.model_dump(exclude_unset=True)
for key, value in update_data.items():
    setattr(assessment, key, value)
```

→ schema에 `definition` 추가하면 **자동으로 definition 업데이트 포함**. handler 수정 불필요.

#### handlers/get_assessment.py, list_assessments.py — 변경 불필요

`AdminAssessmentDetailResponse.model_validate(assessment)`로 변환하므로, schema에 definition 추가하면 자동 포함.

### 3.3 변경 파일 요약

| 파일 | 변경 | 비고 |
|------|------|------|
| `schemas.py` | definition 필드 추가 (3개 스키마) | 모델 변경/마이그레이션 불필요 |
| `handlers/create_assessment.py` | `definition=data.definition` 1줄 추가 | |
| `handlers/update_assessment.py` | **변경 없음** | `model_dump(exclude_unset=True)` 패턴으로 자동 처리 |
| `handlers/get_assessment.py` | **변경 없음** | `model_validate` 패턴으로 자동 포함 |

### 3.4 감사 로그

기존 audit.log가 이미 올바르게 구현되어 있으므로 추가 작업 불필요:
- `create_assessment.py`: `audit.log(action="assessment.created", ...)` → `uow.commit()` ✅
- `update_assessment.py`: `audit.log(action="assessment.updated", ...)` → `uow.commit()` ✅

definition 수정도 기존 `assessment.updated` 액션으로 기록됨.

### 3.5 검증 (추후 Phase)

현재 단계에서는 `dict` 타입으로 자유롭게 저장. 프론트엔드에서 구조 보장.
추후 필요 시 Pydantic 중첩 모델로 서버 검증 추가:

```python
class QuestionOption(BaseModel):
    value: int
    label: str

class QuestionItem(BaseModel):
    number: int
    text: str
    options: list[QuestionOption] | None = None

class AssessmentDefinition(BaseModel):
    questions: list[QuestionItem] = []
    common_options: list[QuestionOption] | None = None
```

---

## 4. 프론트엔드 설계

### 4.1 상세 페이지 — 문항 요약 섹션 (self_report 전용)

검사 상세 페이지(`/assessments/[assessmentId]`)에 조건부 요약 섹션 추가:

```
┌─────────────────────────────────────────────────────────┐
│ 문항 정의                                  [문항 관리]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  총 문항 수      15문항                                 │
│  공통 선택지     4지선다 (전혀 그렇지 않다 ~ 매우 그렇다) │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**표시 조건**: `assessment.workflow_type === 'self_report'`일 때만 렌더링.

- `external_service`인 경우: 이 섹션 자체가 표시되지 않음
- 문항이 없는 `self_report`: 섹션은 표시하되 "등록된 문항이 없습니다" + [문항 관리] 버튼

### 4.2 문항 관리 모달 — 보기/수정 통합 (`wide` 사이즈)

하나의 모달에서 보기↔수정 모드를 전환한다.

#### 보기 모드 (기본)

```
┌──────────────────────────────────────────────────────────────┐
│ 문항 관리 — K-CBCL                                    [✕]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  공통 선택지                                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 1. 전혀 그렇지 않다  2. 그렇지 않다                  │   │
│  │ 3. 그렇다            4. 매우 그렇다                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  문항 목록 (총 15문항)                                       │
│  ┌────┬─────────────────────────────────────────────────┐   │
│  │ #  │ 문항                                            │   │
│  ├────┼─────────────────────────────────────────────────┤   │
│  │ 1  │ 스마트폰의 지나친 사용으로 학교 성적이 떨어졌다 │   │
│  │ 2  │ 가족이나 친구들과 함께 있는 것보다 스마트폰을...│   │
│  │ .. │ ...                                             │   │
│  │ 15 │ 스마트폰 사용이 지금 하고 있는 일에 방해가...   │   │
│  └────┴─────────────────────────────────────────────────┘   │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                    [수정]    │
└──────────────────────────────────────────────────────────────┘
```

#### 수정 모드 ([수정] 클릭 시 전환)

```
┌──────────────────────────────────────────────────────────────┐
│ 문항 관리 — K-CBCL (수정 중)                          [✕]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  공통 선택지                                      [+ 추가]  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  값: [1]  라벨: [전혀 그렇지 않다           ] [✕]   │   │
│  │  값: [2]  라벨: [그렇지 않다                ] [✕]   │   │
│  │  값: [3]  라벨: [그렇다                     ] [✕]   │   │
│  │  값: [4]  라벨: [매우 그렇다                ] [✕]   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  문항 목록                                        [+ 추가]  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  1. [스마트폰의 지나친 사용으로 학교 성적이...    ] │   │
│  │     [↑] [↓] [✕]                                     │   │
│  │  2. [가족이나 친구들과 함께 있는 것보다...         ] │   │
│  │     [↑] [↓] [✕]                                     │   │
│  │  ...                                                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                          [취소]    [저장]    │
└──────────────────────────────────────────────────────────────┘
```

### 4.3 편집 기능 상세

| 기능 | 설명 |
|------|------|
| **문항 추가** | 하단에 빈 문항 추가. 번호 자동 부여 |
| **문항 삭제** | 개별 문항 삭제. 번호 자동 재정렬 |
| **문항 순서 변경** | 위/아래 이동 버튼. 번호 자동 재정렬 |
| **문항 텍스트 수정** | textarea 인라인 편집 |
| **공통 선택지 편집** | 값(숫자) + 라벨(텍스트) 쌍 추가/삭제 |
| **저장** | 전체 definition을 PATCH 요청으로 전송 |
| **취소** | 변경 취소, 원래 데이터로 복원, 보기 모드 복귀 |

### 4.4 데이터 흐름

```
[상세 페이지]
  if (workflow_type === 'self_report')
    assessment.definition → 요약 표시 (문항 수, 공통 선택지 유무)
    [문항 관리] 클릭 → 모달 열기

[모달 - 보기 모드]
  assessment.definition → 전체 문항 테이블 렌더링
  [수정] 클릭 → 수정 모드 전환

[모달 - 수정 모드 진입]
  assessment.definition → structuredClone → 로컬 formDefinition 상태

[저장]
  formDefinition → PATCH /admin/assessments/{id} { definition: formDefinition }
  → 성공 시 쿼리 invalidate → 보기 모드 복귀 + 스낵바

[취소]
  formDefinition 폐기 → 보기 모드 복귀
```

### 4.5 저장 시 API 호출

기존 `patchAssessment` action을 그대로 사용. definition만 포함하여 PATCH:

```typescript
updateMutation.mutate({
  assessmentId,
  definition: formDefinition
})
```

> 기존 `AdminAssessmentUpdateRequest`의 partial 패턴(`exclude_unset`)으로
> definition만 전송해도 다른 필드에 영향 없음.

### 4.6 모달 컴포넌트 위치

> CLAUDE.md 피드백: 페이지 전용 모달은 라우트 폴더 하위 `components/`에 배치

```
src/routes/(protected)/assessments/[assessmentId]/
├── +page.svelte
└── components/
    └── DefinitionModal.svelte    ← 문항 관리 모달 (보기 + 수정 통합)
```

---

## 5. 구현 순서

### Phase 1: 백엔드 스키마 확장

| # | 항목 | 파일 | 변경량 |
|---|------|------|--------|
| 1 | 3개 스키마에 `definition` 필드 추가 | `schemas.py` | +3줄 |
| 2 | create handler에 `definition=data.definition` 추가 | `handlers/create_assessment.py` | +1줄 |

### Phase 2: 프론트엔드 - 문항 요약 + 모달 보기 모드

| # | 항목 |
|---|------|
| 3 | 상세 페이지에 "문항 정의" 요약 섹션 추가 (`workflow_type === 'self_report'` 조건부) |
| 4 | `DefinitionModal.svelte` 생성 — 보기 모드 (공통 선택지 + 문항 테이블) |

### Phase 3: 프론트엔드 - 모달 수정 모드

| # | 항목 |
|---|------|
| 5 | 모달 내 수정 모드 전환 (보기↔수정 토글) |
| 6 | 문항 편집 UI (추가/삭제/순서변경/텍스트수정) |
| 7 | 공통 선택지 편집 UI |
| 8 | 저장/취소 로직 (기존 PATCH mutation + definition만 전송 + invalidate) |

---

## 6. 고려사항

### 6.1 기존 데이터와의 호환

- 기존 시드 데이터는 `{ questions: [{ number, text }] }` (options 없음)
- UI에서 options이 없는 문항은 정상 표시 (선택지 부분만 빈 상태)
- 관리자가 편집 시 common_options를 추가하면 그때부터 적용

### 6.2 채점 엔진과의 관계

- definition 편집은 **문항 정의만** 수정
- 채점 로직(역채점, 하위척도, 기준점수)은 **엔진 플러그인 코드**에서 관리
- definition에 채점 관련 정보를 넣지 않음 (관심사 분리)

### 6.3 동시 편집

- 현재 단계에서는 낙관적 업데이트 (마지막 저장이 우선)
- 추후 필요 시 `updated_at` 기반 충돌 감지 추가

### 6.4 검사 유형별 definition 확장 (미래 고려)

현재는 객관 검사(self_report)의 리커트 척도만 지원하지만, 추후 다른 유형도 추가될 수 있다.

| 유형 | 응답 방식 | 예상 definition 구조 |
|------|----------|---------------------|
| **객관 검사** (현재) | 문항 + 리커트 선택지 | `{ questions, common_options }` |
| **투사 검사** | 자유 응답, 이미지 자극 | 자극 이미지 URL + 프롬프트, 선택지 없음 |
| **지능 검사** | 소검사별 원점수 입력 | 소검사 목록 + 환산표 |
| **발달 검사** | 체크리스트/관찰 기록 | 영역별 문항 그룹 |

**확장 방향**: definition에 `type` 필드를 추가하여 유형별 스키마를 분기하고, 프론트에서 `type`에 따라 다른 에디터 컴포넌트를 렌더링하는 방식.

```json
{ "type": "likert", "questions": [...], "common_options": [...] }
{ "type": "subtest_score", "subtests": [{ "name": "어휘", "max_score": 19 }] }
```

→ 실제 해당 유형 검사가 추가될 때 설계/구현 진행

---

## 7. 파일 변경 목록

### 백엔드 (`apps/api/app/modules/platform_admin/assessment/`)

| 파일 | 변경 | 비고 |
|------|------|------|
| `schemas.py` | definition 필드 추가 (3개 스키마) | 모델 변경/마이그레이션 불필요 |
| `handlers/create_assessment.py` | `definition=data.definition` 1줄 추가 | |
| `handlers/update_assessment.py` | **변경 없음** | `model_dump(exclude_unset=True)` 패턴으로 자동 처리 |
| `handlers/get_assessment.py` | **변경 없음** | `model_validate` 패턴으로 자동 포함 |

### 프론트엔드 (`apps/admin/`)

| 파일 | 변경 |
|------|------|
| `src/routes/(protected)/assessments/[assessmentId]/+page.svelte` | 문항 요약 섹션 추가 (`self_report` 조건부) + 모달 연결 |
| `src/routes/(protected)/assessments/[assessmentId]/components/DefinitionModal.svelte` | **신규** — 문항 관리 모달 (보기 + 수정 통합) |
| `src/lib/hooks/actions/assessment.action.ts` | definition 타입 추가 (타입만) |
