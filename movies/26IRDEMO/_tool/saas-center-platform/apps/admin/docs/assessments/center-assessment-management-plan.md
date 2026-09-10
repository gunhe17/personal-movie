# 센터별 검사 관리 기능 (Admin)

## Context

admin에서 검사를 등록하면 `assessments` 테이블에만 추가되고, `center_assessments`에는 연결되지 않아 센터(web)에서 검사를 사용할 수 없음. 센터 생성 시에만 `initialize_center_assessments()`로 일괄 생성되므로, **기존 센터에는 새 검사가 자동 반영되지 않는 문제**.

### 결정 사항

- **검사 등록과 센터 할당을 분리**: 검사 등록 시 `assessments`만 생성, 센터 할당은 admin에서 수동 관리
- **API 방식**: admin 전용 라우트 (`/admin/centers/{id}/center-assessments`)
- **UI 위치**: 센터 상세 페이지에 "검사 관리" 탭 추가
- **할당 방식**: 관리자가 센터별로 필요한 검사를 선택적으로 할당
- 향후 "전체 센터 일괄 할당" 기능은 필요시 별도 추가

---

## Step 1: 백엔드 — Admin 센터 검사 API

### 새 모듈: `platform_admin/center_assessment/`

기존 서비스를 재사용하여 admin 전용 라우트 추가.

**라우트:**

```
GET   /admin/centers/{center_id}/center-assessments?is_active=all&search=...
POST  /admin/centers/{center_id}/center-assessments   { assessment_id }    # 검사 할당
PATCH /admin/centers/{center_id}/center-assessments/{assessment_id}  { is_active: bool }
DELETE /admin/centers/{center_id}/center-assessments/{assessment_id}  # 할당 해제
```

**파일 구조:**

```
apps/api/app/modules/platform_admin/center_assessment/
├── __init__.py
├── router.py      # admin 라우트 (admin 인증)
└── handlers.py    # 기존 서비스 호출 래퍼
```

**재사용할 기존 코드:**
- `ListCenterAssessmentsService` → 목록 조회
- `BuildCenterAssessmentsService` → 검사 정보 조합
- `UpdateCenterAssessmentService` → 활성/비활성 토글
- `AssessmentFacade.get_assessments_by_ids()` → 검사 정보 조회
- `CenterAssessmentWithAssessment` → 응답 스키마

**추가 필요:**
- 미할당 검사 목록 조회 (할당 모달용): `assessments` 중 해당 센터의 `center_assessments`에 없는 것
- 검사 할당 (POST): `center_assessments` 레코드 생성
- 할당 해제 (DELETE): `center_assessments` 레코드 삭제

**인증**: 기존 admin 인증 (`require_admin` 또는 동급) 사용, CenterContext 불필요

---

## Step 2: 프론트엔드 — 센터 상세 탭 구조 + 검사 관리 UI

### 센터 상세 페이지 탭 구조

```
┌──────────┬──────────────┐
│   개요   │  검사 관리   │
├──────────┴──────────────┤
│  (탭 콘텐츠)            │
└─────────────────────────┘
```

| 탭 | 내용 |
|----|------|
| **개요** | 기본 정보 + 멤버 + 내담자 (현재 그대로) |
| **검사 관리** | 센터에 할당된 검사 목록 + 할당/해제/토글 |

### 새 파일

| 파일 | 역할 |
|------|------|
| `admin/src/lib/hooks/actions/center-assessment.action.ts` | API action (목록, 할당, 토글, 해제) |
| `admin/src/routes/(protected)/center/manage/[centerId]/components/CenterAssessmentTab.svelte` | 검사 관리 탭 컴포넌트 |
| `admin/src/routes/(protected)/center/manage/[centerId]/components/AssignAssessmentModal.svelte` | 검사 할당 모달 |

### 수정 파일

| 파일 | 변경 |
|------|------|
| `admin/src/routes/(protected)/center/manage/[centerId]/+page.svelte` | 탭 UI 추가, 기존 콘텐츠를 "개요" 탭으로 래핑 |

### center-assessment.action.ts

```typescript
getCenterAssessments()     // GET    /admin/centers/{centerId}/center-assessments
getUnassignedAssessments() // GET    /admin/centers/{centerId}/center-assessments/unassigned
postAssignAssessment()     // POST   /admin/centers/{centerId}/center-assessments
patchCenterAssessment()    // PATCH  /admin/centers/{centerId}/center-assessments/{assessmentId}
deleteCenterAssessment()   // DELETE /admin/centers/{centerId}/center-assessments/{assessmentId}
```

### CenterAssessmentTab.svelte

```
┌───────────────────────────────────────────────────────────┐
│ 검사 관리 (할당 N개)           [상태: 전체 ▾] [+ 검사 할당] │
├─────┬──────────┬─────────────────┬───────┬────────┬───────┤
│  #  │ 코드     │ 검사명          │ 유형  │ 활성화 │       │
│  1  │ PHQ-9    │ 우울증 선별검사..│ 객관  │  [✓]   │ [해제]│
│  2  │ GAD-7    │ 범불안장애 선별..│ 객관  │  [✓]   │ [해제]│
│  3  │ SCT      │ 문장완성검사     │ 객관  │  [ ]   │ [해제]│
├─────┴──────────┴─────────────────┴───────┴────────┴───────┤
│                    < 1 2 3 ... >                           │
└───────────────────────────────────────────────────────────┘
```

- **[+ 검사 할당]**: 모달에서 미할당 검사 목록 표시 → 선택하여 할당
- **활성화 토글**: PATCH API → snackbar → 쿼리 invalidate
- **[해제]**: 할당 해제 확인 → DELETE API
- **필터**: 전체 / 활성 / 비활성

### AssignAssessmentModal.svelte

```
┌───────────────────────────────────────────┐
│ 검사 할당                          [닫기] │
├───────────────────────────────────────────┤
│ [🔍 검사명 또는 코드 검색]                │
│                                           │
│ ☐ PHQ-9  우울증 선별검사 (PHQ-9)    객관  │
│ ☐ GAD-7  범불안장애 선별검사 (GAD-7) 객관  │
│ ☐ MMPI-2 다면적 인성검사            객관  │
│                                           │
├───────────────────────────────────────────┤
│             [취소]  [할당 (2개)]           │
└───────────────────────────────────────────┘
```

- 미할당 검사만 표시 (이미 할당된 검사는 제외)
- 복수 선택 가능
- 할당 시 선택된 검사들 일괄 POST

---

## Step 3: 검사 할당/해제 시 센터 알림

검사 할당 또는 해제 시 해당 센터의 매니저에게 in-app 알림 발송.

**할당 시:**
- category: `system`
- event_type: `assessment_assigned`
- title: `"새 검사 할당"`
- body: `"{검사명}이(가) 센터에 할당되었습니다."`
- priority: `normal` (in-app만)

**해제 시:**
- category: `system`
- event_type: `assessment_unassigned`
- title: `"검사 할당 해제"`
- body: `"{검사명}이(가) 센터에서 해제되었습니다."`
- priority: `normal` (in-app만)

**패턴**: `warn_center_handler`와 동일 — `notify_members()` 호출, 외부 채널 없음

---

## 검증

1. admin 센터 상세 → "검사 관리" 탭에서 할당된 검사 목록 표시
2. [+ 검사 할당] → 미할당 검사 목록에서 선택 → 할당 성공
3. 활성화 토글 동작 확인
4. 할당 해제 동작 확인
5. web에서 `/centers/{id}/center-assessments` 호출 시 할당된 검사만 표시 확인
