# Assessment 도메인 DB 스키마

> Row-level Multi-tenancy 기반 Assessment 도메인 데이터베이스 스키마 정의

---

## 📊 테이블 목록

### Assessment Main Module

| 테이블명 | 설명 | 테넌트 | Sub-Module |
|---------|------|--------|-----------|
| `assessments` | 검사 템플릿 마스터 | ❌ | template |
| `assessment_items` | 검사 문항 | ❌ | template |
| `assessment_scoring_rules` | 채점 규칙 | ❌ | template |
| `assessment_cases` | 검사 케이스 | ✅ | case |
| `assessment_sessions` | 검사 세션 | ✅ | session |
| `assessment_tasks` | 개별 검사 수행 | ✅ | task |
| `assessment_packages` | 검사 패키지 | ✅ | package |
| `assessment_package_relations` | 패키지-검사 관계 | ❌ | package |
| `assessment_send_links` | 바로링크 | ✅ | link |
| `assessment_final_reports` | 종합 보고서 | ✅ | report |

### Schedule Main Module (독립)

| 테이블명 | 설명 | 테넌트 |
|---------|------|--------|
| `schedules` | 일정 (polymorphic) | ✅ |

---

## 🗂 테이블 상세 스키마

### 1. assessments (검사 템플릿)

**테이블명**: `assessments`
**Sub-Module**: `template`
**Tenant**: ❌ (공통 마스터 데이터)

```python
# SQLAlchemy Model
class Assessment(BaseModel):
    __tablename__ = "assessments"

    # BaseModel 상속 (id, uid, created_at, updated_at)

    # 검사 식별
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    eng_name: Mapped[str] = mapped_column(String(200), nullable=False)
    kor_name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    # 검사 특성
    assessment_type: Mapped[str] = mapped_column(String(20), nullable=False)  # Enum
    target_age_group: Mapped[str] = mapped_column(String(100), nullable=False)
    estimated_duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)

    # 기능 플래그
    is_online_available: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_ai_supported: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    has_standard_report: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    supports_self_scoring: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    supports_report_upload: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    external_assessment_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # 공개 여부
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="public")  # Enum
    owner_center_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Soft Delete
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
```

**제약 조건**:
- **PK**: `id`
- **UK**: `code`
- **Index**: `code`, `status`
- **Check**: `status IN ('private', 'public')`
- **Check**: `assessment_type IN ('projective', 'intelligence', 'objective', 'developmental')`

---

### 2. assessment_items (검사 문항)

**테이블명**: `assessment_items`
**Sub-Module**: `template`
**Tenant**: ❌

```python
class AssessmentItem(BaseModel):
    __tablename__ = "assessment_items"

    # 관계
    assessment_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("assessments.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # 문항 정보
    item_number: Mapped[int] = mapped_column(Integer, nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    question_type: Mapped[str] = mapped_column(String(30), nullable=False)  # Enum
    options: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # 설정
    is_required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_reverse_scored: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    subscale: Mapped[str | None] = mapped_column(String(100), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)
```

**제약 조건**:
- **PK**: `id`
- **FK**: `assessment_id` → `assessments(id)` ON DELETE CASCADE
- **UK**: `(assessment_id, item_number)`
- **Index**: `assessment_id`, `display_order`
- **Check**: `question_type IN ('likert_4', 'likert_5', 'yes_no', 'multiple_choice', 'text')`

---

### 3. assessment_scoring_rules (채점 규칙)

**테이블명**: `assessment_scoring_rules`
**Sub-Module**: `template`
**Tenant**: ❌

```python
class AssessmentScoringRule(BaseModel):
    __tablename__ = "assessment_scoring_rules"

    # 관계
    assessment_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("assessments.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # 채점 규칙
    scoring_method: Mapped[str] = mapped_column(String(20), nullable=False)  # Enum
    subscale: Mapped[str | None] = mapped_column(String(100), nullable=True)
    rule_config: Mapped[dict] = mapped_column(JSON, nullable=False)
    interpretation_criteria: Mapped[list] = mapped_column(JSON, nullable=False)
    interpretation_text: Mapped[str] = mapped_column(Text, nullable=False)
```

**제약 조건**:
- **PK**: `id`
- **FK**: `assessment_id` → `assessments(id)` ON DELETE CASCADE
- **UK**: `(assessment_id, subscale)` (subscale NULL은 총점 규칙)
- **Index**: `assessment_id`
- **Check**: `scoring_method IN ('sum', 'average', 'weighted')`

---

### 4. assessment_cases (검사 케이스)

**테이블명**: `assessment_cases`
**Sub-Module**: `case`
**Tenant**: ✅ (center_id)

```python
class AssessmentCase(BaseModel, TenantModel):
    __tablename__ = "assessment_cases"

    # TenantModel 상속 (center_id)

    # 케이스 식별
    case_code: Mapped[str] = mapped_column(String(50), nullable=False)

    # 내담자 정보 (스냅샷)
    client_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    client_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False)

    # 담당자 정보
    assigned_specialist_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    specialist_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False)

    # 검사 정보
    assessment_ids: Mapped[list[int]] = mapped_column(ARRAY(Integer), nullable=False)
    assessment_snapshots: Mapped[dict] = mapped_column(JSON, nullable=False)

    # 패키지
    package_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("assessment_packages.id", ondelete="SET NULL"),
        nullable=True
    )
    package_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # 케이스 설정
    case_type: Mapped[str] = mapped_column(String(20), nullable=False)  # Enum
    require_final_report: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    organization_name: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Note: 문서는 Document 도메인에서 역방향 조회
    # Document.entity_type = "assessment_case", Document.entity_id = case.id

    # 상태
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # Enum
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
```

**제약 조건**:
- **PK**: `id`
- **FK**: `package_id` → `assessment_packages(id)` ON DELETE SET NULL
- **UK**: `(center_id, case_code)`
- **Index**: `center_id`, `status`, `created_at`
- **Check**: `case_type IN ('individual', 'group')`
- **Check**: `status IN ('pending', 'processing', 'completed', 'cancelled')`

**RLS (Row Level Security)**:
```sql
ALTER TABLE assessment_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON assessment_cases
  USING (center_id = current_setting('app.current_center_id')::int);
```

---

### 5. assessment_sessions (검사 세션)

**테이블명**: `assessment_sessions`
**Sub-Module**: `session`
**Tenant**: ✅

```python
class AssessmentSession(BaseModel, TenantModel):
    __tablename__ = "assessment_sessions"

    # 관계
    case_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("assessment_cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # 일정
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # 상태
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="scheduled")  # Enum
```

**제약 조건**:
- **PK**: `id`
- **FK**: `case_id` → `assessment_cases(id)` ON DELETE CASCADE
- **Index**: `center_id`, `case_id`, `status`, `scheduled_at`
- **Check**: `status IN ('scheduled', 'attended', 'noshow', 'cancelled')`

**관계**:
- 1 Case : N Sessions (일반적으로 1:1)
- 1 Session : 1 Schedule (schedule.related_type='assessment', related_id=session.id)

---

### 6. assessment_tasks (개별 검사 수행)

**테이블명**: `assessment_tasks`
**Sub-Module**: `task`
**Tenant**: ✅

```python
class AssessmentTask(BaseModel, TenantModel):
    __tablename__ = "assessment_tasks"

    # 복합 비즈니스 키
    assessment_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("assessments.id", ondelete="RESTRICT"),
        nullable=False
    )
    case_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("assessment_cases.id", ondelete="CASCADE"),
        nullable=False
    )

    # 진행 정보
    process: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # Enum

    # 보고서
    report_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    report_visible_to_guardian: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # 완료
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
```

**제약 조건**:
- **PK**: `id`
- **FK**: `assessment_id` → `assessments(id)` ON DELETE RESTRICT
- **FK**: `case_id` → `assessment_cases(id)` ON DELETE CASCADE
- **UK**: `(assessment_id, case_id)`
- **Index**: `center_id`, `case_id`, `status`
- **Check**: `status IN ('pending', 'processing', 'completed', 'not_completed', 'cancelled')`

---

### 7. assessment_packages (검사 패키지)

**테이블명**: `assessment_packages`
**Sub-Module**: `package`
**Tenant**: ✅

```python
class AssessmentPackage(BaseModel, TenantModel):
    __tablename__ = "assessment_packages"

    # 패키지 정보
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Soft Delete
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
```

**제약 조건**:
- **PK**: `id`
- **UK**: `(center_id, name)` WHERE deleted_at IS NULL
- **Index**: `center_id`, `deleted_at`

---

### 8. assessment_package_relations (패키지-검사 관계)

**테이블명**: `assessment_package_relations`
**Sub-Module**: `package`
**Tenant**: ❌ (관계 테이블)

```python
class AssessmentPackageRelation(Base):
    __tablename__ = "assessment_package_relations"

    # 복합 PK
    package_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("assessment_packages.id", ondelete="CASCADE"),
        primary_key=True
    )
    assessment_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("assessments.id", ondelete="CASCADE"),
        primary_key=True
    )

    # 순서
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)
```

**제약 조건**:
- **PK**: `(package_id, assessment_id)`
- **FK**: `package_id` → `assessment_packages(id)` ON DELETE CASCADE
- **FK**: `assessment_id` → `assessments(id)` ON DELETE CASCADE
- **Index**: `package_id`, `display_order`

**관계**: N:M (Package ↔ Assessment)

---

### 9. assessment_send_links (바로링크)

**테이블명**: `assessment_send_links`
**Sub-Module**: `link`
**Tenant**: ✅

```python
class AssessmentSendLink(BaseModel, TenantModel):
    __tablename__ = "assessment_send_links"

    # 링크
    unique_token: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    case_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("assessment_cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # 수신자
    recipients: Mapped[list] = mapped_column(JSON, nullable=False)

    # 유효기간
    expired_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
```

**제약 조건**:
- **PK**: `id`
- **FK**: `case_id` → `assessment_cases(id)` ON DELETE CASCADE
- **UK**: `unique_token`
- **Index**: `center_id`, `case_id`, `expired_at`, `unique_token`

---

### 10. assessment_final_reports (종합 보고서)

**테이블명**: `assessment_final_reports`
**Sub-Module**: `report`
**Tenant**: ✅

```python
class AssessmentFinalReport(BaseModel, TenantModel):
    __tablename__ = "assessment_final_reports"

    # 관계
    case_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("assessment_cases.id", ondelete="CASCADE"),
        nullable=False,
        unique=True
    )

    # 보고서
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
```

**제약 조건**:
- **PK**: `id`
- **FK**: `case_id` → `assessment_cases(id)` ON DELETE CASCADE
- **UK**: `case_id` (1 Case : 1 Final Report)
- **Index**: `center_id`, `case_id`

---

## 📅 schedules (일정 - 독립 Main Module)

**테이블명**: `schedules`
**Main Module**: `schedule` (독립)
**Tenant**: ✅

```python
class Schedule(BaseModel, TenantModel):
    __tablename__ = "schedules"

    # 연결 정보 (Polymorphic)
    related_type: Mapped[str] = mapped_column(String(20), nullable=False)  # Enum
    related_id: Mapped[int] = mapped_column(Integer, nullable=False)

    # 일정
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    assigned_specialist_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    room_name: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # 상태
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="scheduled")  # Enum

    # 메모
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
```

**제약 조건**:
- **PK**: `id`
- **UK**: `(center_id, related_type, related_id)`
- **Index**: `center_id`, `start_time`, `status`, `(related_type, related_id)`
- **Check**: `related_type IN ('assessment', 'counseling')`
- **Check**: `status IN ('scheduled', 'confirmed', 'cancelled', 'completed')`
- **Check**: `end_time > start_time`

**관계**:
- 1 AssessmentSession : 1 Schedule (related_type='assessment')
- 1 CounselingSession : 1 Schedule (related_type='counseling')

---

## 🔗 관계 다이어그램

```
assessments (1) ──┬──< (N) assessment_items
                  ├──< (N) assessment_scoring_rules
                  └──< (N) assessment_package_relations >──< (N) assessment_packages

assessment_cases (1) ──┬──< (N) assessment_sessions ──< (1) schedules
                       ├──< (N) assessment_tasks >──> (1) assessments
                       ├──< (N) assessment_send_links
                       └──< (1) assessment_final_reports

assessment_packages (1) ──< (N) assessment_cases
```

**주요 관계**:
1. **Assessment → Items/Rules**: 1:N (CASCADE DELETE)
2. **Case → Sessions**: 1:N (일반적으로 1:1, CASCADE DELETE)
3. **Session → Schedule**: 1:1 (polymorphic, related_type='assessment')
4. **Case → Tasks**: 1:N (CASCADE DELETE)
5. **Task → Assessment**: N:1 (RESTRICT DELETE)
6. **Package ↔ Assessment**: N:M (via package_relations)
7. **Case → Final Report**: 1:1 (CASCADE DELETE)

---

## 🎯 인덱스 전략

### 성능 최적화 인덱스

```sql
-- assessments
CREATE INDEX idx_assessments_code ON assessments(code);
CREATE INDEX idx_assessments_status ON assessments(status) WHERE deleted_at IS NULL;

-- assessment_items
CREATE INDEX idx_items_assessment_id ON assessment_items(assessment_id);
CREATE INDEX idx_items_display_order ON assessment_items(assessment_id, display_order);

-- assessment_cases (tenant + business queries)
CREATE INDEX idx_cases_center_id ON assessment_cases(center_id);
CREATE INDEX idx_cases_status ON assessment_cases(center_id, status);
CREATE INDEX idx_cases_created_at ON assessment_cases(center_id, created_at DESC);

-- assessment_sessions (calendar view)
CREATE INDEX idx_sessions_scheduled_at ON assessment_sessions(center_id, scheduled_at);
CREATE INDEX idx_sessions_case_id ON assessment_sessions(case_id);

-- assessment_tasks (case detail)
CREATE INDEX idx_tasks_case_id ON assessment_tasks(case_id);
CREATE INDEX idx_tasks_status ON assessment_tasks(center_id, status);

-- schedules (calendar view)
CREATE INDEX idx_schedules_start_time ON schedules(center_id, start_time);
CREATE INDEX idx_schedules_related ON schedules(related_type, related_id);

-- assessment_send_links
CREATE INDEX idx_links_token ON assessment_send_links(unique_token);
CREATE INDEX idx_links_expired_at ON assessment_send_links(expired_at) WHERE expired_at > NOW();
```

---

## 🛡 제약 조건 요약

### Unique Constraints

| 테이블 | UK |
|--------|-----|
| `assessments` | `code` |
| `assessment_items` | `(assessment_id, item_number)` |
| `assessment_scoring_rules` | `(assessment_id, subscale)` |
| `assessment_cases` | `(center_id, case_code)` |
| `assessment_tasks` | `(assessment_id, case_id)` |
| `assessment_packages` | `(center_id, name)` WHERE deleted_at IS NULL |
| `assessment_package_relations` | 복합 PK `(package_id, assessment_id)` |
| `assessment_send_links` | `unique_token` |
| `assessment_final_reports` | `case_id` |
| `schedules` | `(center_id, related_type, related_id)` |

### Foreign Keys with Actions

| Child | Parent | ON DELETE |
|-------|--------|-----------|
| `assessment_items` | `assessments` | CASCADE |
| `assessment_scoring_rules` | `assessments` | CASCADE |
| `assessment_sessions` | `assessment_cases` | CASCADE |
| `assessment_tasks` | `assessment_cases` | CASCADE |
| `assessment_tasks` | `assessments` | RESTRICT |
| `assessment_send_links` | `assessment_cases` | CASCADE |
| `assessment_final_reports` | `assessment_cases` | CASCADE |
| `assessment_package_relations` | `assessment_packages` | CASCADE |
| `assessment_package_relations` | `assessments` | CASCADE |
| `assessment_cases` | `assessment_packages` | SET NULL |

---

## 📝 DDL 생성 순서

Alembic 마이그레이션 생성 시 테이블 생성 순서:

1. `assessments` (마스터, FK 없음)
2. `assessment_items`
3. `assessment_scoring_rules`
4. `assessment_packages`
5. `assessment_package_relations`
6. `assessment_cases`
7. `assessment_sessions`
8. `assessment_tasks`
9. `assessment_send_links`
10. `assessment_final_reports`
11. `schedules` (독립 모듈)

---

**작성일**: 2025-01-13
**버전**: 1.0
**참고**: `domain_v2.md`
