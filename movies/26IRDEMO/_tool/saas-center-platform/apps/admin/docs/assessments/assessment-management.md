# 검사 마스터 데이터 관리

> 플랫폼 관리자가 심리검사 도구를 등록/수정/삭제/복구하는 기능

---

## 1. 개요

### 1.1 목적

센터에서 사용할 수 있는 심리검사 도구의 마스터 데이터를 관리한다.
Assessment는 센터 격리 없는 글로벌 엔티티이며, 플랫폼 관리자만 CRUD 가능하다.

### 1.2 현재 구현 상태

| 항목 | 상태 | 비고 |
|------|------|------|
| 목록 페이지 (프론트) | ✅ 완성 | 검색/필터/페이지네이션/삭제/복구 |
| 상세/수정 페이지 (프론트) | ❌ 미구현 | |
| 등록 페이지 (프론트) | ❌ 미구현 | |
| Action 함수 (프론트) | ✅ 완성 | 6개 엔드포인트 전부 정의됨 |
| 백엔드 API | ❌ 미구현 | platform_admin/assessment 모듈 없음 |

---

## 2. Assessment 엔티티

### 2.1 현재 모델 (`apps/api/app/modules/assessment/assessment/models.py`)

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | UUID (string) | ✅ | PK (BaseModel 상속) |
| `code` | string(50) | ✅ | 검사 코드 (unique) - K-CBCL, MMPI-2 등 |
| `version` | string(20) | ✅ | 검사 버전 (기본값: "1.0") |
| `kor_name` | string(255) | ✅ | 한국어 검사명 |
| `eng_name` | string(255) | ✅ | 영어 검사명 |
| `type` | string(20) | ✅ | 검사 유형 |
| `description` | text | ❌ | 검사 설명 |
| `duration` | integer | ❌ | 예상 소요 시간(분) |
| `age` | string(100) | ❌ | 대상 연령 |
| `status` | string(20) | ✅ | 공개 상태 (private/public) |
| `workflow_type` | string(30) | ✅ | 워크플로우 (self_report/external_service) |
| `external_url` | string(500) | ❌ | 외부 검사 URL |
| `supports_online` | boolean | ✅ | 온라인 검사 지원 여부 |
| `definition` | JSONB | ✅ | 문항/채점/해석 정의 |
| `created_at` | datetime | ✅ | 생성 시각 (BaseModel) |
| `updated_at` | datetime | ✅ | 수정 시각 (BaseModel) |

### 2.2 필요한 모델 변경

`deleted_at` 필드 추가 필요 (Soft Delete 지원):

```python
deleted_at: Mapped[datetime | None] = mapped_column(
    DateTime,
    nullable=True,
    default=None,
    comment="논리적 삭제 시각"
)
```

> BaseModel에 이미 `deleted_at`이 있는지 확인 필요. 없으면 Assessment 모델에 직접 추가.

### 2.3 검사 유형 (AssessmentType)

| 코드 | 설명 |
|------|------|
| `projective` | 투사적 검사 |
| `intelligence` | 지능 검사 |
| `objective` | 객관적 검사 |
| `developmental` | 발달 검사 |

### 2.4 공개 상태 (AssessmentStatus)

| 코드 | 설명 | 센터 노출 |
|------|------|-----------|
| `public` | 공개 | ✅ 센터 검사 목록에 노출 |
| `private` | 비공개 | ❌ 센터에서 보이지 않음 |
| `draft` | 초안 | ❌ 작성 중 (관리자만 열람) |

---

## 3. API 엔드포인트

### 3.1 목록 조회

```
GET /api/v1/admin/assessments
```

| 파라미터 | 타입 | 기본값 | 설명 |
|---------|------|--------|------|
| `search` | query | - | 검사명/코드 검색 |
| `status` | query | - | public / private / draft |
| `type` | query | - | 검사 유형 필터 |
| `page` | query | 1 | 페이지 번호 |
| `size` | query | 20 | 페이지 크기 |

Response:
```json
{
  "items": [
    {
      "id": "uuid",
      "code": "K-CBCL",
      "kor_name": "한국판 아동행동체크리스트",
      "eng_name": "Korean Child Behavior Checklist",
      "type": "objective",
      "duration": 30,
      "age": "6세~18세",
      "status": "public",
      "created_at": "2026-01-01T00:00:00",
      "deleted_at": null
    }
  ],
  "total": 25,
  "page": 1,
  "size": 20,
  "pages": 2
}
```

> 삭제된 검사(deleted_at != null)도 목록에 포함. 프론트에서 "삭제됨" 뱃지 + 복구 버튼으로 처리.

### 3.2 상세 조회

```
GET /api/v1/admin/assessments/{assessment_id}
```

Response:
```json
{
  "id": "uuid",
  "code": "K-CBCL",
  "version": "1.0",
  "kor_name": "한국판 아동행동체크리스트",
  "eng_name": "Korean Child Behavior Checklist",
  "type": "objective",
  "description": "아동의 문제행동을 측정하는 검사",
  "duration": 30,
  "age": "6세~18세",
  "status": "public",
  "workflow_type": "self_report",
  "external_url": null,
  "supports_online": true,
  "created_at": "2026-01-01T00:00:00",
  "updated_at": "2026-02-15T10:30:00",
  "deleted_at": null
}
```

### 3.3 등록

```
POST /api/v1/admin/assessments
```

Request:
```json
{
  "code": "KPRC-U",
  "kor_name": "한국판 인물화 검사",
  "eng_name": "Korean Person Drawing Test",
  "type": "projective",
  "description": "투사적 검사 도구",
  "duration": 30,
  "age": "5세~성인",
  "status": "public",
  "workflow_type": "self_report",
  "supports_online": false
}
```

검증:
- `code` 중복 체크 (unique 제약)
- `type`은 유효한 검사 유형만
- `status`는 public / private / draft 중 하나

### 3.4 수정

```
PATCH /api/v1/admin/assessments/{assessment_id}
```

Request (변경 필드만):
```json
{
  "kor_name": "수정된 검사명",
  "status": "private",
  "duration": 45
}
```

검증:
- `code` 변경 시 중복 체크
- 삭제된 검사(deleted_at != null)는 수정 불가 → 먼저 복구 필요

### 3.5 삭제 (Soft Delete)

```
DELETE /api/v1/admin/assessments/{assessment_id}
```

동작:
1. `deleted_at` = 현재 시각 설정
2. 이미 사용 중인 센터의 center_assessment에는 영향 없음
3. 이미 삭제된 검사는 에러 반환

### 3.6 복구

```
POST /api/v1/admin/assessments/{assessment_id}/restore
```

동작:
1. `deleted_at` = null로 설정
2. 삭제되지 않은 검사는 에러 반환

---

## 4. 프론트엔드 페이지 설계

### 4.1 검사 목록 (`/assessments`) - ✅ 구현 완료

현재 구현된 기능:
- 검색 (검사명/코드, 300ms 디바운스)
- 상태 필터 (전체/공개/비공개/초안)
- 페이지네이션 (20개/페이지)
- URL 필터 동기화
- 삭제/복구 버튼 (인라인)
- 행 클릭 → 상세 페이지 이동
- "검사 등록" 버튼 → `/assessments/new`

### 4.2 검사 등록 (`/assessments/new`) - ❌ 미구현

#### 화면 구성

```
┌─────────────────────────────────────────┐
│ ← 검사 목록    검사 등록                  │
├─────────────────────────────────────────┤
│                                         │
│  기본 정보                               │
│  ┌───────────────────────────────────┐  │
│  │ 검사 코드 *     [           ]     │  │
│  │ 한국어 검사명 * [           ]     │  │
│  │ 영어 검사명 *   [           ]     │  │
│  │ 검사 유형 *     [▼ 선택     ]     │  │
│  │ 공개 상태 *     [▼ 선택     ]     │  │
│  └───────────────────────────────────┘  │
│                                         │
│  검사 특성                               │
│  ┌───────────────────────────────────┐  │
│  │ 소요 시간(분)   [           ]     │  │
│  │ 대상 연령       [           ]     │  │
│  │ 검사 설명       [              ]  │  │
│  │                 [              ]  │  │
│  └───────────────────────────────────┘  │
│                                         │
│  워크플로우 설정                          │
│  ┌───────────────────────────────────┐  │
│  │ 워크플로우 타입 * [▼ 자가응답  ]   │  │
│  │ 외부 검사 URL    [           ]    │  │
│  │ 온라인 검사 지원  □               │  │
│  └───────────────────────────────────┘  │
│                                         │
│              [취소]  [등록]              │
└─────────────────────────────────────────┘
```

#### 입력 필드 정의

| 필드 | 타입 | 필수 | 검증 |
|------|------|------|------|
| 검사 코드 | text input | ✅ | 영문+숫자+하이픈, 최대 50자 |
| 한국어 검사명 | text input | ✅ | 최대 255자 |
| 영어 검사명 | text input | ✅ | 최대 255자 |
| 검사 유형 | select | ✅ | projective/intelligence/objective/developmental |
| 공개 상태 | select | ✅ | public/private/draft |
| 소요 시간(분) | number input | ❌ | 양수 |
| 대상 연령 | text input | ❌ | 자유 입력 (예: "5세~성인") |
| 검사 설명 | textarea | ❌ | 자유 입력 |
| 워크플로우 타입 | select | ✅ | self_report/external_service |
| 외부 검사 URL | text input | ❌ | workflow_type=external_service일 때만 활성 |
| 온라인 검사 지원 | checkbox | ❌ | 기본값: false |

#### 동작

- "등록" 클릭 → `POST /admin/assessments` → 성공 시 목록으로 이동 + 스낵바
- "취소" 클릭 → 목록으로 이동
- 코드 중복 에러(409) → 스낵바 "이미 존재하는 검사 코드입니다"

### 4.3 검사 상세/수정 (`/assessments/[assessmentId]`) - ❌ 미구현

#### 화면 구성

```
┌─────────────────────────────────────────┐
│ ← 검사 목록    검사 상세                  │
├─────────────────────────────────────────┤
│                                         │
│  기본 정보                     [수정]    │
│  ┌───────────────────────────────────┐  │
│  │ 검사 코드      K-CBCL             │  │
│  │ 한국어 검사명  한국판 아동행동...    │  │
│  │ 영어 검사명    Korean Child...     │  │
│  │ 검사 유형      객관적 검사          │  │
│  │ 공개 상태      공개                 │  │
│  └───────────────────────────────────┘  │
│                                         │
│  검사 특성                               │
│  ┌───────────────────────────────────┐  │
│  │ 소요 시간      30분               │  │
│  │ 대상 연령      6세~18세            │  │
│  │ 검사 설명      아동의 문제행동을... │  │
│  └───────────────────────────────────┘  │
│                                         │
│  워크플로우 설정                          │
│  ┌───────────────────────────────────┐  │
│  │ 워크플로우 타입  자가응답           │  │
│  │ 온라인 검사      지원              │  │
│  └───────────────────────────────────┘  │
│                                         │
│  메타 정보                               │
│  ┌───────────────────────────────────┐  │
│  │ 등록일   2026-01-01 09:00         │  │
│  │ 수정일   2026-02-15 10:30         │  │
│  └───────────────────────────────────┘  │
│                                         │
│              [삭제]                      │
└─────────────────────────────────────────┘
```

#### 두 가지 모드

**보기 모드 (기본)**:
- 모든 필드를 읽기 전용으로 표시
- "수정" 버튼 → 수정 모드 전환
- "삭제" 버튼 → 확인 후 soft delete → 목록으로 이동

**수정 모드**:
- 등록 폼과 동일한 입력 필드로 전환
- `code` 필드는 수정 가능 (중복 체크)
- "저장" → `PATCH /admin/assessments/{id}` → 보기 모드 복귀 + 스낵바
- "취소" → 변경 취소 + 보기 모드 복귀

#### 삭제된 검사 상세

삭제된 검사(`deleted_at != null`) 접근 시:
- 모든 필드 읽기 전용
- "수정" 버튼 비활성
- "복구" 버튼 표시 (삭제 버튼 대신)

---

## 5. 백엔드 모듈 구조

```
apps/api/app/modules/platform_admin/assessment/
├── __init__.py
├── router.py           # /api/v1/admin/assessments
├── schemas.py          # Request/Response DTO
├── repository.py       # 관리자용 쿼리 (삭제된 검사 포함)
├── handlers/
│   ├── __init__.py
│   ├── list_assessments.py
│   ├── get_assessment.py
│   ├── create_assessment.py
│   ├── update_assessment.py
│   ├── delete_assessment.py
│   └── restore_assessment.py
└── services/
    ├── __init__.py
    ├── list_assessments_service.py
    ├── get_assessment_service.py
    ├── create_assessment_service.py
    ├── update_assessment_service.py
    ├── delete_assessment_service.py
    └── restore_assessment_service.py
```

### 5.1 아키텍처

```
Router → Handler → Service → Repository → DB
             ↓
        Unit of Work
```

Facade 불필요 (단순 CRUD, 도메인 간 복합 조합 없음).

### 5.2 모델 참조

```python
# ✅ 기존 Assessment 모델 공유 (새 모델 생성하지 않음)
from app.modules.assessment.assessment.models import Assessment
```

### 5.3 Repository 특이사항

관리자용 Repository는 센터용과 다르게:
- `deleted_at IS NOT NULL`인 레코드도 조회 (센터용은 제외)
- 검색: `kor_name`, `eng_name`, `code`에 대해 ILIKE 검색

---

## 6. 프론트엔드 파일 구조

### 6.1 새로 생성할 파일

```
src/routes/(protected)/assessments/
├── +page.svelte                    # ✅ 이미 존재
├── new/
│   └── +page.svelte               # 등록 페이지
└── [assessmentId]/
    └── +page.svelte               # 상세/수정 페이지
```

### 6.2 기존 파일 (수정 불필요)

```
src/lib/hooks/actions/assessment.action.ts   # ✅ Action 전부 정의됨
```

### 6.3 공통 폼 컴포넌트 검토

등록/수정에서 동일한 폼을 사용하므로, 폼이 복잡해지면 컴포넌트 분리 고려:

```
src/lib/features/assessments/
└── components/
    └── AssessmentForm.svelte       # (옵션) 등록/수정 공통 폼
```

> 처음에는 각 페이지에서 직접 구현하고, 중복이 명확해지면 추출.

---

## 7. 구현 순서

### Phase 1: 백엔드 API

| # | 항목 | 의존성 |
|---|------|--------|
| 1 | Assessment 모델에 `deleted_at` 확인/추가 + 마이그레이션 | 없음 |
| 2 | `platform_admin/assessment/` 모듈 생성 (schemas, repository) | #1 |
| 3 | Service 구현 (list, get, create, update, delete, restore) | #2 |
| 4 | Handler + Router 구현 | #3 |
| 5 | `platform_admin/router.py`에 assessment_router 등록 | #4 |

### Phase 2: 프론트엔드 페이지

| # | 항목 | 의존성 |
|---|------|--------|
| 6 | 등록 페이지 (`/assessments/new`) | #5 |
| 7 | 상세/수정 페이지 (`/assessments/[assessmentId]`) | #5 |
| 8 | 목록 페이지 연동 테스트 (기존 페이지 ↔ 실제 API) | #5 |

---

## 8. 에러 케이스

| 상황 | HTTP | 메시지 |
|------|------|--------|
| 검사 코드 중복 | 409 | "이미 존재하는 검사 코드입니다" |
| 검사 없음 | 404 | "검사를 찾을 수 없습니다" |
| 삭제된 검사 수정 시도 | 400 | "삭제된 검사는 수정할 수 없습니다. 먼저 복구해주세요" |
| 이미 삭제된 검사 재삭제 | 400 | "이미 삭제된 검사입니다" |
| 삭제되지 않은 검사 복구 시도 | 400 | "삭제되지 않은 검사입니다" |
| 권한 없음 | 403 | "플랫폼 관리자 권한이 필요합니다" |
