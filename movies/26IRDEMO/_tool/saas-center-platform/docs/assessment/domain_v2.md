# Assessment 도메인 설계 v2 (Domain-Driven Design)

> 모듈러 모놀리스 아키텍처 기반, Row-level Multi-tenancy

---

## 📐 아키텍처 개요

### Multi-tenancy 전략

**Row-level Multi-tenancy**: 단일 스키마에서 `center_id` 컬럼으로 데이터 격리

```
PostgreSQL Database (Single Schema)
└── public schema
    ├── centers                    # 센터 마스터
    │
    ├── assessments                # 검사 템플릿 (공통)
    ├── assessment_items           # 검사 문항
    ├── assessment_scoring_rules   # 채점 규칙
    │
    ├── assessment_cases           # 검사 케이스 (center_id로 격리)
    ├── assessment_sessions        # 검사 세션
    ├── assessment_tasks           # 개별 검사 수행
    ├── assessment_schedules       # 일정
    ├── assessment_packages        # 검사 패키지
    ├── assessment_send_links      # 바로링크
    ├── assessment_final_reports   # 종합 보고서
    └── documents                  # 문서
```

**특징**:
- ✅ **단순한 구조**: 단일 스키마, 마이그레이션 단순화
- ✅ **RLS (Row Level Security)**: PostgreSQL RLS로 자동 격리
- ✅ **Cross-tenant 집계**: 통계/분석 쿼리 용이
- ✅ **확장 용이**: 새 센터 추가 시 스키마 생성 불필요

---

## 🏗 모듈 구조

### Main Modules

#### 1. `assessment` Main Module

```
app/modules/assessment/
├── __init__.py
├── router.py                    # Sub-Module 라우터 집계
│
├── template/                    # Sub-Module: 검사 템플릿 관리
│   ├── models.py               # Assessment, AssessmentItem, ScoringRule
│   ├── schemas.py
│   ├── repository.py
│   ├── services/
│   │   ├── create_template.py
│   │   ├── manage_items.py
│   │   └── manage_scoring.py
│   ├── handlers/
│   │   └── template_handler.py
│   └── router.py
│
├── case/                        # Sub-Module: 케이스 관리
│   ├── models.py               # AssessmentCase
│   ├── schemas.py
│   ├── repository.py
│   ├── services/
│   │   ├── create_case.py
│   │   ├── update_case_status.py
│   │   └── complete_case.py
│   ├── handlers/
│   │   └── case_handler.py
│   └── router.py
│
├── session/                     # Sub-Module: 세션/회기 관리
│   ├── models.py               # AssessmentSession
│   ├── schemas.py
│   ├── repository.py
│   ├── services/
│   │   ├── create_session.py
│   │   └── update_session_status.py
│   ├── handlers/
│   └── router.py
│
├── task/                        # Sub-Module: 검사 수행
│   ├── models.py               # AssessmentTask
│   ├── schemas.py
│   ├── repository.py
│   ├── services/
│   │   ├── start_task.py
│   │   ├── save_response.py
│   │   ├── calculate_score.py
│   │   └── generate_report.py
│   ├── handlers/
│   └── router.py
│
├── package/                     # Sub-Module: 패키지 관리
│   ├── models.py               # AssessmentPackage, PackageRelation
│   ├── schemas.py
│   ├── repository.py
│   ├── services/
│   ├── handlers/
│   └── router.py
│
├── link/                        # Sub-Module: 바로링크
│   ├── models.py               # AssessmentSendLink
│   ├── schemas.py
│   ├── repository.py
│   ├── services/
│   ├── handlers/
│   └── router.py
│
└── report/                      # Sub-Module: 종합 보고서
    ├── models.py               # AssessmentFinalReport
    ├── schemas.py
    ├── repository.py
    ├── services/
    ├── handlers/
    └── router.py
```

#### 2. `schedule` Main Module (독립)

```
app/modules/schedule/
├── __init__.py
├── router.py
├── models.py                    # Schedule
├── schemas.py
├── repository.py
├── services/
│   ├── create_schedule.py
│   ├── update_schedule.py
│   └── cancel_schedule.py
├── handlers/
│   └── schedule_handler.py
└── router.py
```

**참고**: Schedule은 Assessment뿐만 아니라 Counseling 등 다른 도메인에서도 사용되므로 독립 Main Module로 분리

---

## 🎯 도메인 모델

### 공통 필드

**BaseModel**:
```python
id: int                          # Primary Key (Auto Increment)
uid: UUID                        # 외부 식별자
created_at: datetime
updated_at: datetime
```

**TenantModel** (추가):
```python
center_id: int                   # 센터 FK (RLS 적용)
```

---

## 📦 Sub-Module: template (검사 템플릿 관리)

### 1. Assessment (검사 템플릿)

**역할**: 심리검사 마스터 정보

**필드**:
```python
# BaseModel
id: int
uid: UUID
created_at: datetime
updated_at: datetime

# Assessment 필드
code: str                        # 검사 코드 (UK: code)
eng_name: str
kor_name: str
description: str

# 검사 특성
assessment_type: AssessmentType  # Enum
target_age_group: str
estimated_duration_minutes: int

# 기능 플래그
is_online_available: bool
is_ai_supported: bool
has_standard_report: bool
supports_self_scoring: bool
supports_report_upload: bool
external_assessment_url: str | None

# 공개 여부
status: AssessmentStatus         # Enum: PRIVATE/PUBLIC
owner_center_id: int | None      # 비공개 검사의 소유 센터

# 삭제
deleted_at: datetime | None
```

**Enum**:
```python
class AssessmentType(str, Enum):
    PROJECTIVE = "projective"        # 투사적 검사
    INTELLIGENCE = "intelligence"    # 지능검사
    OBJECTIVE = "objective"          # 객관적 검사
    DEVELOPMENTAL = "developmental"  # 발달검사

class AssessmentStatus(str, Enum):
    PRIVATE = "private"              # 특정 센터 전용
    PUBLIC = "public"                # 모든 센터 사용 가능
```

**비즈니스 규칙**:
- PUBLIC 검사는 모든 센터 사용 가능
- PRIVATE 검사는 owner_center_id 센터만 사용 가능
- code는 전역 Unique (UK)

---

### 2. AssessmentItem (검사 문항)

**역할**: 검사의 실제 문항 데이터

**필드**:
```python
# BaseModel
id: int
uid: UUID

# 관계
assessment_id: int               # FK: assessments

# 문항 정보
item_number: int                 # 문항 번호
question_text: str
question_type: QuestionType      # Enum
options: dict | None             # JSONB

# 설정
is_required: bool
is_reverse_scored: bool
subscale: str | None             # 하위척도/요인
display_order: int
```

**Enum**:
```python
class QuestionType(str, Enum):
    LIKERT_4 = "likert_4"
    LIKERT_5 = "likert_5"
    YES_NO = "yes_no"
    MULTIPLE_CHOICE = "multiple_choice"
    TEXT = "text"
```

**options 예시**:
```json
[
  {"value": 1, "label": "전혀 그렇지 않다"},
  {"value": 2, "label": "그렇지 않다"},
  {"value": 3, "label": "그렇다"},
  {"value": 4, "label": "매우 그렇다"}
]
```

---

### 3. AssessmentScoringRule (채점 규칙)

**역할**: 검사별 채점 방식 및 해석 기준

**필드**:
```python
# BaseModel
id: int
uid: UUID

# 관계
assessment_id: int               # FK: assessments

# 채점 규칙
scoring_method: ScoringMethod    # Enum
subscale: str | None             # NULL = 총점
rule_config: dict                # JSONB
interpretation_criteria: list    # JSONB
interpretation_text: str
```

**Enum**:
```python
class ScoringMethod(str, Enum):
    SUM = "sum"
    AVERAGE = "average"
    WEIGHTED = "weighted"
```

**rule_config 예시**:
```json
{
  "items": [1, 5, 9, 12, 13],
  "reverse_items": [13],
  "weight": 1.0
}
```

**interpretation_criteria 예시**:
```json
[
  {
    "min": 0,
    "max": 13,
    "level": "일반",
    "description": "정상 범위"
  },
  {
    "min": 14,
    "max": 15,
    "level": "잠재적위험",
    "description": "주의 필요"
  },
  {
    "min": 16,
    "max": 20,
    "level": "고위험",
    "description": "전문가 상담 권장"
  }
]
```

---

## 📋 Sub-Module: case (케이스 관리)

### AssessmentCase (검사 케이스)

**역할**: 센터의 검사 케이스 관리 (내담자 1명의 검사 세트)

**필드**:
```python
# BaseModel + TenantModel
id: int
uid: UUID
center_id: int                   # FK: centers (RLS 적용)

# 케이스 식별
case_code: str                   # UK: (center_id, case_code)

# 내담자 정보 (스냅샷)
client_id: int | None            # FK: clients (향후)
client_snapshot: dict            # JSONB

# 담당자 정보
assigned_specialist_id: int | None  # FK: members (향후)
specialist_snapshot: dict        # JSONB

# 검사 정보
assessment_ids: list[int]        # Array
assessment_snapshots: dict       # JSONB

# 패키지
package_id: int | None           # FK: assessment_packages
package_snapshot: dict | None    # JSONB

# 케이스 설정
case_type: CaseType              # Enum
require_final_report: bool
organization_name: str | None    # 집단검사 시

# 문서 연결
document_ids: list[str]          # Array

# 상태
status: CaseStatus               # Enum
completed_at: datetime | None

# Audit
created_at: datetime
updated_at: datetime
```

**Enum**:
```python
class CaseType(str, Enum):
    INDIVIDUAL = "individual"    # 개별검사
    GROUP = "group"              # 집단검사

class CaseStatus(str, Enum):
    PENDING = "pending"          # 대기
    PROCESSING = "processing"    # 진행중
    COMPLETED = "completed"      # 완료
    CANCELLED = "cancelled"      # 취소
```

**client_snapshot 예시**:
```json
{
  "name": "김민서",
  "birth_date": "2018-03-12",
  "gender": "여",
  "phone": "010-1234-5678",
  "email": "dkdkdk@gmail.com",
  "address": "강남구"
}
```

**비즈니스 규칙**:
- case_code는 센터 내 Unique
- 케이스 생성 시 Session, Task 자동 생성
- 모든 Task COMPLETED 시 Case COMPLETED

---

## 🔄 Sub-Module: session (세션/회기 관리)

### AssessmentSession (검사 세션)

**역할**: 케이스 내 검사 실시 회기 관리

**필드**:
```python
# BaseModel + TenantModel
id: int
uid: UUID
center_id: int
case_id: int                     # FK: assessment_cases

# 일정
scheduled_at: datetime | None
started_at: datetime | None
completed_at: datetime | None

# 상태
status: SessionStatus            # Enum
```

**Enum**:
```python
class SessionStatus(str, Enum):
    SCHEDULED = "scheduled"      # 예약됨
    ATTENDED = "attended"        # 참석함
    NOSHOW = "noshow"            # 불참
    CANCELLED = "cancelled"      # 취소됨
```

**비즈니스 규칙**:
- Case 생성 시 자동 생성 (1개)
- Schedule과 1:1 관계

---

## ✅ Sub-Module: task (검사 수행)

### AssessmentTask (개별 검사 수행)

**역할**: 케이스 내 각 검사의 실제 수행 및 결과

**필드**:
```python
# BaseModel + TenantModel
id: int
uid: UUID
center_id: int

# 복합 PK
assessment_id: int               # FK: assessments (PK)
case_id: int                     # FK: assessment_cases (PK)

# 진행 정보
process: dict | None             # JSONB (응답 데이터)
status: TaskStatus               # Enum

# 보고서
report_payload: dict | None      # JSONB
report_visible_to_guardian: bool

# 완료
completed_at: datetime | None
```

**Enum**:
```python
class TaskStatus(str, Enum):
    PENDING = "pending"          # 대기
    PROCESSING = "processing"    # 진행중
    COMPLETED = "completed"      # 완료
    NOT_COMPLETED = "not_completed"  # 미완료
    CANCELLED = "cancelled"      # 취소
```

**process 필드 예시**:
```json
{
  "responses": [
    {"item_number": 1, "value": 3},
    {"item_number": 2, "value": 2}
  ],
  "progress_percentage": 75,
  "current_item": 15,
  "total_items": 20
}
```

**report_payload 예시**:
```json
{
  "scores": {
    "총점": 45,
    "일상생활장애": 12,
    "금단": 8,
    "가상세계지향": 15,
    "과다사용": 10
  },
  "interpretation": "일반 사용자군",
  "recommendations": "..."
}
```

---

---

## 📅 Schedule Main Module (독립 모듈)

### Schedule (일정)

**역할**: 다양한 도메인의 일정 관리 (Assessment, Counseling 등)

**필드**:
```python
# BaseModel + TenantModel
id: int
uid: UUID
center_id: int

# 연결 정보 (Polymorphic)
related_type: ScheduleType       # Enum: ASSESSMENT/COUNSELING
related_id: int                  # FK (polymorphic)

# 일정
start_time: datetime
end_time: datetime
assigned_specialist_id: int | None
room_name: str | None

# 상태
status: ScheduleStatus           # Enum

# 메모
notes: str | None
```

**Enum**:
```python
class ScheduleType(str, Enum):
    ASSESSMENT = "assessment"    # AssessmentSession
    COUNSELING = "counseling"    # CounselingSession

class ScheduleStatus(str, Enum):
    SCHEDULED = "scheduled"      # 예약됨
    CONFIRMED = "confirmed"      # 확정됨
    CANCELLED = "cancelled"      # 취소됨
    COMPLETED = "completed"      # 완료됨
```

**비즈니스 규칙**:
- related_type=ASSESSMENT일 때 related_id는 AssessmentSession.id
- Session 생성 시 Schedule 자동 생성
- UK: (center_id, related_type, related_id)

---

## 📦 Sub-Module: package (패키지 관리)

### 1. AssessmentPackage (검사 패키지)

**역할**: 자주 사용하는 검사 조합 관리

**필드**:
```python
# BaseModel + TenantModel
id: int
uid: UUID
center_id: int

# 패키지 정보
name: str
description: str | None

# Soft Delete
deleted_at: datetime | None
```

---

### 2. AssessmentPackageRelation (패키지-검사 관계)

**역할**: 패키지에 포함된 검사 목록

**필드**:
```python
# 복합 PK
package_id: int                  # FK: assessment_packages (PK)
assessment_id: int               # FK: assessments (PK)

# 순서
display_order: int
```

---

## 🔗 Sub-Module: link (바로링크)

### AssessmentSendLink (바로링크)

**역할**: 온라인 검사 바로링크 생성 및 관리

**필드**:
```python
# BaseModel + TenantModel
id: int
uid: UUID
center_id: int

# 링크
unique_token: str                # UK
case_id: int                     # FK: assessment_cases

# 수신자
recipients: list                 # JSONB

# 유효기간
expired_at: datetime
```

**recipients 예시**:
```json
[
  {
    "type": "email",
    "value": "parent@example.com",
    "sent_at": "2025-01-10T10:00:00Z"
  },
  {
    "type": "sms",
    "value": "010-1234-5678",
    "sent_at": "2025-01-10T10:00:00Z"
  }
]
```

---

## 📊 Sub-Module: report (종합 보고서)

### AssessmentFinalReport (종합 보고서)

**역할**: 케이스의 모든 검사 종합 보고서

**필드**:
```python
# BaseModel + TenantModel
id: int
uid: UUID
center_id: int
case_id: int                     # FK: assessment_cases (UK)

# 보고서
payload: dict                    # JSONB
```

**payload 예시**:
```json
{
  "summary": "종합 요약...",
  "recommendations": "권고 사항...",
  "sections": [
    {
      "title": "지능검사 결과",
      "content": "...",
      "assessment_id": 1
    }
  ]
}
```

---

## 🔄 주요 워크플로우

### 1. 개별 검사 케이스 생성 및 진행

```
[Frontend]
1. 내담자 선택
2. 검사 선택 (개별 또는 패키지)
3. 담당자 선택
4. 일정 선택 (날짜, 시간, 검사실)
5. "검사 접수하기" 클릭

[Backend - Application Handler: CreateIndividualCaseHandler]
async with uow:
    # 1. Case 생성
    case_service = CreateCaseService(case_repo)
    case = await case_service.execute(
        center_id=1,
        client_snapshot={...},
        specialist_snapshot={...},
        assessment_ids=[1, 2, 3],
        case_type=CaseType.INDIVIDUAL
    )

    # 2. Session 자동 생성
    session_service = CreateSessionService(session_repo)
    session = await session_service.execute(
        case_id=case.id,
        status=SessionStatus.SCHEDULED
    )

    # 3. Schedule 자동 생성 (Session 생성과 함께)
    from app.modules.schedule.services.create_schedule import CreateScheduleService
    schedule_service = CreateScheduleService(schedule_repo)
    schedule = await schedule_service.execute(
        center_id=1,
        related_type=ScheduleType.ASSESSMENT,
        related_id=session.id,
        start_time=schedule_data.start_time,
        end_time=schedule_data.end_time,
        assigned_specialist_id=specialist_id,
        room_name=schedule_data.room_name
    )

    # 4. Task 자동 생성 (각 검사별)
    task_service = CreateTaskService(task_repo)
    for assessment_id in [1, 2, 3]:
        await task_service.execute(
            case_id=case.id,
            assessment_id=assessment_id
        )

    await uow.commit()

[생성된 데이터]
Case: PENDING
Session: SCHEDULED
Schedule: SCHEDULED (related_type=ASSESSMENT, related_id=session.id)
Task (x3): PENDING
```

### 2. 검사 실시

```
[검사 시작]
Task.status: PENDING → PROCESSING

[응답 저장]
Task.process에 실시간 저장:
{
  "responses": [{"item_number": 1, "value": 3}, ...],
  "progress_percentage": 50,
  "current_item": 10
}

[검사 완료]
Service: CalculateScoreService
  → AssessmentScoringRule 기반 채점
  → Task.report_payload에 결과 저장
  → Task.status: COMPLETED
```

### 3. 케이스 완료

```
[모든 Task COMPLETED 확인]
Service: CompleteCaseService
  → 모든 Task 상태 확인
  → Case.status: COMPLETED
  → Case.completed_at: now()
  → Session.status: ATTENDED

[종합 보고서 생성 (옵션)]
Service: GenerateFinalReportService
  → 모든 Task.report_payload 수집
  → AssessmentFinalReport 생성
```

### 4. 온라인 검사 바로링크

```
[링크 생성]
Service: CreateSendLinkService
  → unique_token 생성 (UUID)
  → expired_at 설정 (7일 후)
  → recipients 설정

[링크 발송]
Service: SendLinkService
  → 이메일/SMS 발송
  → recipients.sent_at 업데이트

[내담자 접속]
GET /assessment/take/{token}
  → Token 검증
  → 만료 확인
  → Case.assessment_ids 조회
  → 검사 화면 표시

[검사 실시]
Task 진행 (동일 프로세스)
```

---

## 📐 데이터 관리 전략

### 1. Row-level Security (RLS)

**PostgreSQL RLS 정책**:
```sql
-- assessment_cases 예시
ALTER TABLE assessment_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON assessment_cases
  USING (center_id = current_setting('app.current_center_id')::int);
```

**Middleware**:
```python
# FastAPI Middleware
@app.middleware("http")
async def set_tenant_context(request, call_next):
    center_id = extract_center_id_from_token(request)
    async with db.execute(
        "SET LOCAL app.current_center_id = :center_id",
        {"center_id": center_id}
    ):
        response = await call_next(request)
    return response
```

### 2. 스냅샷 패턴

**목적**: 과거 데이터 보존, 조회 성능 향상

**적용**:
- `AssessmentCase.client_snapshot`
- `AssessmentCase.specialist_snapshot`
- `AssessmentCase.assessment_snapshots`
- `AssessmentCase.package_snapshot`

**장점**:
- JOIN 없이 빠른 조회
- 이름/정보 변경 시 과거 데이터 보존

### 3. Soft Delete

**적용**:
- `Assessment.deleted_at`
- `AssessmentPackage.deleted_at`

**이유**: 완전 삭제보다 논리 삭제로 데이터 보존

---

## 🔌 모듈 간 의존성

### 허용

- ✅ `case` → `template` (Schemas 참조)
- ✅ `task` → `template` (채점 규칙 참조)
- ✅ Application Handler에서 여러 Sub-Module Service 조합

### 금지

- ❌ Sub-Module 간 Repository 직접 접근
- ❌ Sub-Module 간 Models 직접 import

---

## 🚀 API 엔드포인트 구조

```
/assessments
  /templates              # template sub-module
    GET  /
    POST /
    GET  /{id}
    PUT  /{id}
    GET  /{id}/items
    POST /{id}/items

  /cases                  # case sub-module
    GET  /
    POST /
    GET  /{id}
    PUT  /{id}
    POST /{id}/complete

  /sessions               # session sub-module
    GET  /cases/{case_id}/sessions
    POST /cases/{case_id}/sessions

  /tasks                  # task sub-module
    GET  /cases/{case_id}/tasks
    POST /tasks/{id}/start
    POST /tasks/{id}/submit
    GET  /tasks/{id}/report

  /packages               # package sub-module
    GET  /
    POST /

  /links                  # link sub-module
    POST /cases/{case_id}/send-link

  /reports                # report sub-module
    GET  /cases/{case_id}/final-report
    POST /cases/{case_id}/final-report

/schedules                # schedule main module (독립)
  GET  /
  POST /
  GET  /{id}
  PUT  /{id}
  DELETE /{id}
  GET  /calendar          # 캘린더 뷰용
```

---

## 📝 개발 우선순위

### Phase 1: 핵심 기능

1. **core** 인프라
   - Database 설정
   - Unit of Work
   - Base Models
   - Alembic 초기화

2. **schedule** Main Module (먼저 구현 - 다른 모듈에서 의존)
   - Schedule Model
   - Schedule CRUD

3. **assessment/template** Sub-Module
   - Assessment CRUD
   - AssessmentItem CRUD
   - AssessmentScoringRule CRUD
   - **Seed 데이터**: 스마트폰중독척도, 네오팩트 등

4. **assessment/case** Sub-Module
   - Case 생성 (개별) + Session + Schedule + Task 자동 생성
   - Case 목록/상세

5. **assessment/session** Sub-Module
   - Session 조회
   - Session 상태 관리

6. **assessment/task** Sub-Module
   - Task 조회
   - 응답 저장
   - 채점 및 보고서 생성

### Phase 2: 부가 기능

7. **assessment/package** Sub-Module
8. **assessment/link** Sub-Module

### Phase 3: 고도화

9. **assessment/report** Sub-Module (종합 보고서)
10. 집단 검사
11. 통계/분석

---

## 🌱 초기 Seed 데이터

### 1. Assessment (검사 템플릿)

**스마트폰중독척도**:
```python
{
    "code": "SMARTPHONE_ADDICTION",
    "eng_name": "Smartphone Addiction Scale",
    "kor_name": "스마트폰중독척도",
    "description": "스마트폰 과의존 및 중독 위험도를 평가하는 자기보고식 검사",
    "assessment_type": AssessmentType.OBJECTIVE,
    "target_age_group": "청소년 및 성인",
    "estimated_duration_minutes": 10,
    "is_online_available": True,
    "is_ai_supported": True,
    "has_standard_report": True,
    "supports_self_scoring": True,
    "supports_report_upload": False,
    "status": AssessmentStatus.PUBLIC
}
```

**네오팩트 스마트 밸런스**:
```python
{
    "code": "NEOFECT_SMART_BALANCE",
    "eng_name": "NEOFECT Smart Balance",
    "kor_name": "네오팩트-스마트 밸런스",
    "description": "타업체 오프라인 균형 능력 평가 검사 (결과 보고서 업로드 전용)",
    "assessment_type": AssessmentType.OBJECTIVE,
    "target_age_group": "전 연령",
    "estimated_duration_minutes": 15,
    "is_online_available": False,
    "is_ai_supported": False,
    "has_standard_report": False,
    "supports_self_scoring": False,
    "supports_report_upload": True,
    "external_assessment_url": "https://www.neofect.com",
    "status": AssessmentStatus.PUBLIC
}
```

**추가 예정**:
- K-WISC-IV (지능검사)
- MMPI-2 (다면적인성검사)
- HTP (집-나무-사람 그림검사)
- SCT (문장완성검사)

### 2. Seed 스크립트 위치

```
docs/assessment/seeds/
  ├── assessments.py           # Assessment 템플릿
  ├── smartphone_items.py      # 스마트폰중독척도 문항
  └── smartphone_scoring.py    # 스마트폰중독척도 채점 규칙
```

---

**작성일**: 2025-01-13
**버전**: 2.0 (Domain-Driven Design)
**아키텍처**: 모듈러 모놀리스, Row-level Multi-tenancy
