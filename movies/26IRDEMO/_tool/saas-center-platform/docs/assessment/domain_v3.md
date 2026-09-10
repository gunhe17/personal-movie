# Assessment 도메인 설계 v3

> 심리검사, 검사 케이스, 세션, 수행(Task) 관리를 담당하는 도메인
>
> Row-level Multi-tenancy 기반, Counseling 도메인과 일관된 설계 패턴 적용

---

## 목차

1. [도메인 개요](#도메인-개요)
2. [스키마 정의](#스키마-정의)
3. [비즈니스 규칙](#비즈니스-규칙)
4. [API 설계](#api-설계)
5. [주요 워크플로우](#주요-워크플로우)
6. [구현 우선순위](#구현-우선순위)

---

## 도메인 개요

### 핵심 개념

**Assessment(검사)**는 심리검사의 마스터 정보입니다:
- 검사 코드, 이름, 유형, 문항 정의, 채점 규칙 등
- `definition` JSONB 필드에 문항/채점/해석 규칙 통합 관리
- PUBLIC(공용) / PRIVATE(센터 전용) 구분
- 센터가 직접 정의하거나 시스템 제공 검사 사용

**AssessmentCase(검사 케이스)**는 내담자의 검사 세트입니다:
- 1명 이상의 내담자에 대한 검사 수행 단위
- 여러 Assessment를 묶어서 진행 (배터리 검사)
- 집단검사 지원 (복수 내담자 참여, 필요 시 tags로 분류/표기)
- 케이스 단위로 상태 추적 및 종합보고서 관리

**AssessmentSession(검사 세션)**은 검사 실시 일정입니다:
- 케이스 내 검사 방문 일정 관리
- Schedule 도메인과 연동
- 출석/노쇼/취소 상태 관리

**AssessmentTask(검사 수행)**는 개별 검사의 실제 수행입니다:
- Case 내 각 Assessment별 수행 상태 및 결과
- 응답 데이터, 채점 결과, 개별 보고서 관리
- Case에 직접 연결 (Session이 아닌 Case 기준)

### 계층 구조

```
Assessment (검사) - Global
    ↓ 참조
AssessmentCase (검사 케이스) - Center 격리
    - assessment_summary[]로 검사 목록/요약 스냅샷 관리
    ↓ 1:N
AssessmentSession (검사 세션)
    - ScheduledRelation을 통해 Schedule과 연결 (중간 테이블)
    ↓ 1:N
AssessmentTask (검사 수행)
    - case_id + assessment_id 복합 키
    - Case에 직접 연결 (문항/채점은 Assessment.definition 조회)

AssessmentPackage (검사 패키지) - Center 격리
    - assessment_ids[] 배열로 검사 조합 관리
    - center_member_ids[] 배열로 기본 담당자 관리
    - Case 생성 시 패키지 선택 → 담당자 자동 할당

AssessmentSendLink (바로링크) - Center 격리
    - 온라인 검사 링크 발송 관리

ScheduledRelation (일정 연결) - Schedule 도메인
    - schedule_id + "assessment" + session_id 복합 키
    - Schedule 삭제 시 CASCADE 삭제
```

### 책임 (Responsibility)

- 검사(Assessment) 관리 (문항, 채점, 해석 포함)
- 검사 케이스 생명주기 관리 (생성 → 진행 → 완료/취소)
- 검사 세션 일정 및 출석 관리 (Schedule 연동)
- 개별 검사 수행 및 결과 관리
- 종합보고서 관리 (Document 도메인 위임)
- 다대다 참여자 관리 (집단검사 지원)

### 의존성

- **Depends on**: Center (멀티테넌시), Client (내담자), CenterMember (검사전문가), Schedule (일정), Document (보고서)
- **Depended by**: Document (검사 기록)

---

## 스키마 정의

### Core Schemas (Models)

#### 1. Assessment (검사)

```python
class AssessmentType(str, Enum):
    """검사 유형"""
    PROJECTIVE = "projective"        # 투사적 검사
    INTELLIGENCE = "intelligence"    # 지능검사
    OBJECTIVE = "objective"          # 객관적 검사
    DEVELOPMENTAL = "developmental"  # 발달검사


class AssessmentStatus(str, Enum):
    """검사 공개 상태"""
    PRIVATE = "private"              # 센터별 활성화 대상 (기본 비공개)
    PUBLIC = "public"                # 모든 센터에서 활성화 가능


class Assessment(Base):
    """
    검사 엔티티 (Global - 센터 격리 없음)
    - 심리검사 마스터 정보
    - definition JSONB로 문항/채점/해석 통합 관리
    """
    __tablename__ = "assessments"

    # Primary Key
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))

    # 검사 식별
    code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)  # "K-CBCL", "MMPI-2", "SMARTPHONE_ADDICTION"

    # 검사 정보
    kor_name: Mapped[str] = mapped_column(String(255), nullable=False)
    eng_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # 검사 특성
    assessment_type: Mapped[str] = mapped_column(String(20), nullable=False)  # AssessmentType Enum
    target_age_group: Mapped[str | None] = mapped_column(String(100), nullable=True)
    estimated_duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # 기능 플래그
    is_online_available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_ai_supported: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    has_standard_report: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    supports_self_scoring: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    supports_report_upload: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    external_assessment_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # 공개 상태
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="private")  # AssessmentStatus Enum

    # 문항/채점/해석 정의 (통합 JSONB)
    definition: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    # 타임스탬프
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
```

**definition JSONB 구조**:

```json
{
  "version": "2026.01.01",
  "question": {
    "default_type": "likert_3",
    "default_options": [
      { "value": 0, "label": "전혀 해당되지 않는다" },
      { "value": 1, "label": "가끔 그렇다" },
      { "value": 2, "label": "자주 그렇다" }
    ]
  },
  "questions": [
    {
      "sequence": 1,
      "content": "최근 2주간 아이가 불안해하는 모습을 보였습니까?",
      "type": "likert_3",
      "required": true,
      "subscale": "ANXIETY_DEPRESSED"
    }
  ],
  "scoring": {
    "method": "sum",
    "subscales": {
      "ANXIETY_DEPRESSED": {
        "items": [1, 5, 9, 12, 13],
        "reverse_items": [13],
        "weight": 1.0
      }
    },
    "total": {
      "include_subscales": ["ANXIETY_DEPRESSED"]
    }
  },
  "interpretation": {
    "ANXIETY_DEPRESSED": [
      { "min": 0, "max": 13, "level": "NORMAL", "description": "정상 범위입니다." },
      { "min": 14, "max": 15, "level": "BORDERLINE", "description": "주의가 필요합니다." },
      { "min": 16, "max": 20, "level": "CLINICAL", "description": "전문 상담이 필요합니다." }
    ]
  }
}
```

**필드 설명**:

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK | 검사 고유 ID |
| `code` | String(50) | UNIQUE, NOT NULL | 검사 코드 (K-CBCL, MMPI-2 등) |
| `kor_name` | String(255) | NOT NULL | 한국어 검사명 |
| `eng_name` | String(255) | NOT NULL | 영어 검사명 |
| `description` | Text | NULL | 검사 설명 |
| `assessment_type` | String(20) | NOT NULL | 검사 유형 (Enum) |
| `target_age_group` | String(100) | NULL | 대상 연령 |
| `estimated_duration_minutes` | Integer | NULL | 예상 소요 시간 |
| `is_online_available` | Boolean | NOT NULL | 온라인 검사 가능 여부 |
| `is_ai_supported` | Boolean | NOT NULL | AI 채점 지원 여부 |
| `has_standard_report` | Boolean | NOT NULL | 표준 보고서 제공 여부 |
| `supports_self_scoring` | Boolean | NOT NULL | 자가 채점 지원 여부 |
| `supports_report_upload` | Boolean | NOT NULL | 외부 보고서 업로드 지원 |
| `external_assessment_url` | String(500) | NULL | 외부 검사 URL |
| `status` | String(20) | NOT NULL | 공개 상태 (private/public) |
| `definition` | JSONB | NOT NULL | 문항/채점/해석 정의 |

---

#### 2. CenterAssessment (센터별 검사 운영 설정)

```python
class CenterAssessment(Base):
    """
    센터별 검사 운영 설정 엔티티
    - 센터에서 운영할 검사 선택 (운영중/미운영)
    """
    __tablename__ = "center_assessments"

    # 복합 PK
    center_id: Mapped[str] = mapped_column(String(36), ForeignKey("centers.id", ondelete="CASCADE"), primary_key=True)
    assessment_id: Mapped[str] = mapped_column(String(36), ForeignKey("assessments.id", ondelete="CASCADE"), primary_key=True)

    # 운영 여부
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)  # true: 운영중, false: 미운영

    # 타임스탬프
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
```

**필드 설명**:

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `center_id` | UUID | PK, FK | 센터 ID |
| `assessment_id` | UUID | PK, FK | 검사 ID |
| `is_active` | Boolean | NOT NULL | 운영 여부 (true: 운영중, false: 미운영) |

**사용 시나리오**:
- 센터 "검사 관리" 화면에서 운영 여부 토글
- `is_active=true`인 검사만 케이스 생성 시 선택 가능
- 센터 등록 시 public 검사에 대해 기본 레코드 생성 (is_active=false)
- PRIVATE 검사라도 `CenterAssessment` 레코드가 없으면 해당 센터에서는 조회/선택 불가 (API는 `CenterAssessment`를 기준으로 필터)

---

#### 3. AssessmentCase (검사 케이스)

```python

class CaseStatus(str, Enum):
    """케이스 상태"""
    PENDING = "pending"          # 대기
    PROCESSING = "processing"    # 진행중
    COMPLETED = "completed"      # 완료
    CANCELLED = "cancelled"      # 취소


class AssessmentCase(Base):
    """
    검사 케이스 엔티티 (Center 격리)
    - 내담자의 검사 세트
    - N:M 참여자 관계 (집단검사 지원)
    """
    __tablename__ = "assessment_cases"

    # Primary Key
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))

    # 멀티테넌시 격리
    center_id: Mapped[str] = mapped_column(String(36), ForeignKey("centers.id", ondelete="RESTRICT"), nullable=False, index=True)

    # 케이스 식별
    case_code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # "250107-001" (센터 내 고유)

    # 검사 요약 (배열)
    # - Case와 함께 자주 조회되는 Assessment "요약 정보"만 복사하여 저장
    # - 문항/채점/해석(definition)은 Assessment에서 직접 조회한다
    assessment_summary: Mapped[list] = mapped_column(
        JSONB,
        nullable=False,
        default=list
    )
    # [
    #   {
    #     "assessment_id": "assessment_id_1",
    #     "code": "K-CBCL",
    #     "kor_name": "K-CBCL",
    #     "eng_name": "K-CBCL",
    #     "assessment_type": "objective",
    #     "estimated_duration_minutes": 30,
    #     "snapshot_at": "2026-01-22T00:00:00Z"
    #   }
    # ]

    # 패키지 요약 (선택)
    # - Case 생성 시점의 패키지 정보를 복사하여 고정
    package_summary: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # {
    #   "package_id": "pkg_001",
    #   "name": "종합심리검사 패키지",
    #   "source_updated_at": "2026-01-20T00:00:00Z",
    #   "snapshot_at": "2026-01-22T00:00:00Z"
    # }

    # Note: 문서 연결은 Document 도메인에서 역방향 조회
    # Document.entity_type = "assessment_case", Document.entity_id = case.id
    # 종합보고서: Document.category = "final_report"
    # 첨부파일: Document.category = "assessment_attachment"

    # 케이스 태그 (배열)
    # - UI 분류/필터/표기 목적
    # - 예: ["group", "org:서울초등학교"], ["battery", "urgent"]
    tags: Mapped[list] = mapped_column(
        ARRAY(String(50)),
        nullable=False,
        default=list
    )

    is_final_report_required: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False
    )

    # 상태
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending",
        index=True
    )  # CaseStatus Enum

    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # 타임스탬프
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Indexes
    __table_args__ = (
        UniqueConstraint("center_id", "case_code", name="uq_assessment_case_code"),
        Index("ix_assessment_cases_center_status", "center_id", "status"),
    )
```

**필드 설명**:

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK | 케이스 고유 ID |
| `center_id` | UUID | FK, NOT NULL | 센터 ID (멀티테넌시) |
| `case_code` | String(50) | UNIQUE per center | 케이스 코드 (250107-001) |
| `assessment_summary` | JSONB | NOT NULL | 검사 요약 목록 (Case 생성 시 Assessment 요약 복사본) |
| `package_summary` | JSONB | NULL | 사용된 패키지 요약 (Case 생성 시 Package 요약 복사본) |
| `tags` | Array[String] | NOT NULL | 케이스 태그 (분류/필터/표기) |
| `is_final_report_required` | Boolean | NOT NULL | 종합보고서 필요 여부 |
| `status` | String(20) | NOT NULL | 케이스 상태 |
| `completed_at` | DateTime | NULL | 완료 일시 |

**assessment_summary JSONB 구조(예시)**:

```json
[
  {
    "assessment_id": "c3c8b7d8-0000-0000-0000-000000000001",
    "code": "K-CBCL",
    "kor_name": "K-CBCL",
    "eng_name": "K-CBCL",
    "assessment_type": "objective",
    "estimated_duration_minutes": 30,
    "is_online_available": true,
    "has_standard_report": false,
    "source_updated_at": "2026-01-20T00:00:00Z",
    "snapshot_at": "2026-01-22T00:00:00Z"
  }
]
```

---

#### 4. AssessmentSession (검사 세션)

```python
class SessionStatus(str, Enum):
    """세션 상태"""
    SCHEDULED = "scheduled"      # 예약됨
    ATTENDED = "attended"        # 참석함
    NOSHOW = "noshow"            # 불참
    CANCELLED = "cancelled"      # 취소됨


class AssessmentSession(Base):
    """
    검사 세션 엔티티
    - 케이스 내 검사 실시 일정
    - ScheduledRelation을 통해 Schedule과 연결
    """
    __tablename__ = "assessment_sessions"

    # Primary Key
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4())
    )

    # 멀티테넌시 격리
    center_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("centers.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )

    # 케이스 연결
    case_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("assessment_cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # 상태
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="scheduled",
        index=True
    )  # SessionStatus Enum

    # 타임스탬프
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Indexes
    __table_args__ = (
        Index("ix_assessment_sessions_case", "case_id"),
        Index("ix_assessment_sessions_center_status", "center_id", "status"),
    )

    # Note: Schedule 연동은 ScheduledRelation 중간 테이블을 통해 처리
    # ScheduledRelation(schedule_id, "assessment", session_id)
    # 자세한 내용은 /docs/schedule/domain.md 참조
```

**필드 설명**:

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK | 세션 고유 ID |
| `center_id` | UUID | FK, NOT NULL | 센터 ID |
| `case_id` | UUID | FK, NOT NULL | 케이스 ID |
| `status` | String(20) | NOT NULL | 세션 상태 |

**Schedule 연동**:
- `schedule_id` FK 대신 `ScheduledRelation` 중간 테이블 사용
- `ScheduledRelation(schedule_id, "assessment", session_id)` 형태로 연결
- Schedule 삭제 시 ScheduledRelation CASCADE 삭제, Session은 유지

---

#### 5. AssessmentTask (검사 수행)

```python
class ExecutionMethod(str, Enum):
    """실시 방식"""
    ONSITE = "onsite"    # 센터 방문 (오프라인)
    ONLINE = "online"    # 바로링크 (온라인)


class TaskStatus(str, Enum):
    """수행 상태"""
    PENDING = "pending"        # 대기 (진행전)
    PROCESSING = "processing"  # 진행중
    COMPLETED = "completed"    # 완료 (검사완료)
    HOLD = "hold"              # 보류 (검사보류)
    REFUSED = "refused"        # 거부 (검사거부)
    CANCELLED = "cancelled"    # 취소 (검사취소)


class AssessmentTask(Base):
    """
    검사 수행 엔티티
    - 케이스 내 개별 검사의 실제 수행 및 결과
    - Case에 직접 연결 (Session이 아닌 Case 기준)
    """
    __tablename__ = "assessment_tasks"

    # 멀티테넌시 격리
    center_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("centers.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )

    # 복합 키 (Case + Assessment)
    case_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("assessment_cases.id", ondelete="CASCADE"),
        primary_key=True
    )
    assessment_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("assessments.id", ondelete="RESTRICT"),
        primary_key=True
    )

    # 실시 방식
    execution_method: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="onsite"
    )  # ExecutionMethod Enum: onsite(센터방문) / online(바로링크)
    # NOTE: Task는 케이스 생성 시점에 생성되며, 바로링크 전송 시 execution_method를 online으로 업데이트한다.

    # 진행 정보
    process: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    # { "progress": 50, "current_item": 25, "total_items": 50, "responses": [...] }

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending"
    )  # TaskStatus Enum

    # 보고서
    report_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # { "total_score": 85, "subscales": {...}, "interpretation": "..." }

    is_report_visible_to_guardian: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False
    )

    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # 타임스탬프
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Indexes
    __table_args__ = (
        Index("ix_assessment_tasks_center", "center_id"),
        Index("ix_assessment_tasks_case_status", "case_id", "status"),
    )
```

**process JSONB 구조**:

```json
{
  "progress": 50,
  "current_item": 25,
  "total_items": 50,
  "responses": [
    { "item_number": 1, "value": 3, "answered_at": "2026-01-15T10:30:00Z" },
    { "item_number": 2, "value": 2, "answered_at": "2026-01-15T10:30:15Z" }
  ]
}
```

**report_payload JSONB 구조**:

```json
{
  "total_score": 85,
  "subscales": {
    "ANXIETY_DEPRESSED": { "score": 12, "level": "NORMAL" },
    "SOCIAL_PROBLEMS": { "score": 8, "level": "NORMAL" }
  },
  "interpretation": "전체적으로 정상 범위에 해당합니다.",
  "recommendations": "현재 특별한 개입이 필요하지 않습니다."
}
```

**필드 설명**:

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `center_id` | UUID | FK, NOT NULL | 센터 ID |
| `case_id` | UUID | PK, FK | 케이스 ID |
| `assessment_id` | UUID | PK, FK | 검사 ID |
| `execution_method` | String(20) | NOT NULL | 실시 방식 (onsite/online) |
| `process` | JSONB | NOT NULL | 진행 정보 (응답, 진행률) |
| `status` | String(20) | NOT NULL | 수행 상태 |
| `report_payload` | JSONB | NULL | 채점 결과 및 해석 |
| `is_report_visible_to_guardian` | Boolean | NOT NULL | 보호자 공개 여부 |
| `completed_at` | DateTime | NULL | 완료 일시 |

**실시 방식 (execution_method)**:

| 값 | 설명 | 화면 표시 |
|----|------|----------|
| `onsite` | 센터 방문 오프라인 검사 | 센터 방문 검사 |
| `online` | 바로링크 온라인 검사 | 모바일 검사 |

**상태 (status)**:

| 상태 | 설명 | 화면 표시 |
|------|------|----------|
| `pending` | 대기 | 진행전 |
| `processing` | 진행중 | 진행중 |
| `completed` | 완료 | 검사완료 |
| `hold` | 보류 | 검사보류 |
| `refused` | 거부 | 검사거부 |
| `cancelled` | 취소 | 검사취소 |

---

#### 6. AssessmentCaseParticipant (케이스 참여자)

```python
class ParticipantType(str, Enum):
    """참여자 유형"""
    CLIENT = "client"
    SPECIALIST = "specialist"    # 검사전문가 (Counseling의 counselor와 구분)


class AssessmentCaseParticipant(Base):
    """
    검사 케이스 참여자 (통합 테이블)
    - 내담자(client)와 검사전문가(specialist)를 단일 테이블로 관리
    - 집단검사 지원
    """
    __tablename__ = "assessment_case_participants"
    # 멀티테넌시 격리
    center_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("centers.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )

    # 복합 PK
    case_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("assessment_cases.id", ondelete="CASCADE"),
        primary_key=True
    )
    participant_type: Mapped[str] = mapped_column(
        String(20),
        primary_key=True
    )  # "client" | "specialist"
    participant_id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True
    )  # clients.id 또는 center_members.id

    # 참여 기간 관리
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow
    )
    unassigned_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )  # NULL = 현재 참여 중

    # Indexes
    __table_args__ = (
        Index("ix_assessment_case_participants_participant", "participant_type", "participant_id"),
        Index("ix_assessment_case_participants_case_participant_type", "case_id", "participant_type"),
    )
```

**필드 설명**:

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `case_id` | UUID | PK, FK | 케이스 ID |
| `participant_type` | String(20) | PK | "client" \| "specialist" |
| `participant_id` | UUID | PK | clients.id 또는 center_members.id |
| `assigned_at` | DateTime | NOT NULL | 참여 시작 일시 |
| `unassigned_at` | DateTime | NULL | 참여 종료 일시 |

> **설계 근거**:
> - Counseling 도메인의 `counselor` 대신 `specialist` 사용 (검사 도메인 맥락)
> - 집단검사 시 다수의 내담자를 한 케이스에 연결
> - `assigned_at` / `unassigned_at`으로 담당자 변경 이력 추적

---

#### 7. AssessmentSessionParticipant (세션 참여자)

```python
class AssessmentSessionParticipant(Base):
    """
    검사 세션 참여자
    - 세션별 출석 관리
    - 집단검사 출석 체크 지원
    """
    __tablename__ = "assessment_session_participants"

    # 멀티테넌시 격리
    center_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("centers.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )

    # 복합 PK
    session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("assessment_sessions.id", ondelete="CASCADE"),
        primary_key=True
    )
    participant_type: Mapped[str] = mapped_column(
        String(20),
        primary_key=True
    )  # "client" | "specialist"
    participant_id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True
    )  # clients.id 또는 center_members.id

    # 참여 기간
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow
    )
    unassigned_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

    # Indexes
    __table_args__ = (
        Index("ix_assessment_session_participants_session", "session_id"),
        Index("ix_assessment_session_participants_participant", "participant_type", "participant_id"),
    )
```

**필드 설명**:

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `center_id` | UUID | FK, NOT NULL | 센터 ID |
| `session_id` | UUID | PK, FK | 세션 ID |
| `participant_type` | String(20) | PK | "client" \| "specialist" |
| `participant_id` | UUID | PK | clients.id 또는 center_members.id |
| `assigned_at` | DateTime | NOT NULL | 참여 기록 시점 |
| `unassigned_at` | DateTime | NULL | 조기 종료 시점 |

---

#### 8. AssessmentPackage (검사 패키지)

```python
class AssessmentPackage(Base):
    """
    검사 패키지 엔티티 (Center 격리)
    - 자주 사용하는 검사 조합 관리
    """
    __tablename__ = "assessment_packages"

    # Primary Key
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4())
    )

    # 멀티테넌시 격리
    center_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("centers.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )

    # 패키지 정보
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # 검사 목록 (배열)
    assessment_ids: Mapped[list] = mapped_column(
        ARRAY(String(36)),
        nullable=False
    )  # ["assessment_id_1", "assessment_id_2"]

    # 기본 담당자 목록 (배열)
    center_member_ids: Mapped[list | None] = mapped_column(
        ARRAY(String(36)),
        nullable=True
    )  # ["member_id_1", "member_id_2"] - 케이스 생성 시 기본 담당자

    # Soft Delete
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # 타임스탬프
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Indexes
    __table_args__ = (
        Index("ix_assessment_packages_center", "center_id"),
    )
```

**필드 설명**:

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK | 패키지 고유 ID |
| `center_id` | UUID | FK, NOT NULL | 센터 ID |
| `name` | String(255) | NOT NULL | 패키지명 |
| `description` | Text | NULL | 패키지 설명 |
| `assessment_ids` | Array[UUID] | NOT NULL | 포함된 검사 ID 목록 |
| `center_member_ids` | Array[UUID] | NULL | 기본 담당자 ID 목록 (케이스 생성 시 자동 할당) |
| `deleted_at` | DateTime | NULL | Soft Delete |

---

#### 9. AssessmentSendLink (바로링크)

```python
class AssessmentSendLink(Base):
    """
    온라인 검사 바로링크 엔티티
    - 온라인 검사 링크 발송 관리
    """
    __tablename__ = "assessment_send_links"

    # Primary Key
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4())
    )

    # 멀티테넌시 격리
    center_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("centers.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )

    # 케이스 연결
    case_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("assessment_cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # 링크 토큰
    unique_token: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
        index=True
    )  # "abc123xyz789"

    # 수신자 정보
    recipients: Mapped[list] = mapped_column(JSONB, nullable=False)
    # [{ "name": "김보호자", "phone": "010-1234-5678", "relation": "부" }]

    # 유효기간
    expired_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # 타임스탬프
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
```

**recipients JSONB 구조**:

```json
[
  { "name": "김보호자", "phone": "010-1234-5678", "relation": "부" },
  { "name": "이보호자", "phone": "010-8765-4321", "relation": "모" }
]
```

**필드 설명**:

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK | 링크 고유 ID |
| `center_id` | UUID | FK, NOT NULL | 센터 ID |
| `case_id` | UUID | FK, NOT NULL | 케이스 ID |
| `unique_token` | String(100) | UNIQUE, NOT NULL | 고유 토큰 |
| `recipients` | JSONB | NOT NULL | 수신자 정보 |
| `expired_at` | DateTime | NULL | 만료 일시 |

---

### Pydantic Schemas (DTOs)

> 아래 DTO는 “스키마 분류”를 문서화하기 위한 예시이며, 실제 API/Handler에서 사용하는 요청/응답 스키마는 구현 시점에 조정될 수 있습니다.

```python
from datetime import datetime
from pydantic import BaseModel, Field


class AssessmentSummary(BaseModel):
    assessment_id: str
    code: str
    kor_name: str
    eng_name: str
    assessment_type: str
    estimated_duration_minutes: int | None = None
    snapshot_at: datetime


class PackageSummary(BaseModel):
    package_id: str
    name: str
    source_updated_at: datetime | None = None
    snapshot_at: datetime


class AssessmentCaseCreate(BaseModel):
    assessment_ids: list[str] = Field(min_length=1)
    package_id: str | None = None
    tags: list[str] = Field(default_factory=list)
    is_final_report_required: bool = False


class AssessmentCaseUpdate(BaseModel):
    assessment_ids: list[str] | None = None
    package_id: str | None = None
    tags: list[str] | None = None
    is_final_report_required: bool | None = None


class AssessmentCaseResponse(BaseModel):
    id: str
    center_id: str
    case_code: str
    assessment_summary: list[AssessmentSummary]
    package_summary: PackageSummary | None = None
    tags: list[str]
    is_final_report_required: bool
    status: str
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class AssessmentSendLinkRecipient(BaseModel):
    name: str
    phone: str
    relation: str | None = None


class AssessmentSendLinkCreate(BaseModel):
    recipients: list[AssessmentSendLinkRecipient] = Field(min_length=1)
    expired_at: datetime | None = None
```

## 비즈니스 규칙

### 1. 검사 케이스 생성 규칙

| 규칙 | 설명 | 검증 위치 |
|------|------|----------|
| **assessment_ids(요청) 필수** | 최소 1개 이상의 검사 선택 | AssessmentCaseCreate schema |
| **assessment_summary 저장** | Case 생성 시 요청 assessment_ids에 해당하는 Assessment 요약 정보를 복사하여 저장 | Service |
| **CenterAssessment 활성화 필수** | 모든 assessment_id는 해당 center에서 is_active=true 여야 함 | Service |
| **최소 1명 내담자** | AssessmentCaseParticipant(type=client) 최소 1건 | Service |
| **최소 1명 검사전문가** | AssessmentCaseParticipant(type=specialist) 최소 1건 | Service |
| **같은 센터 검증** | 내담자, 검사전문가 모두 같은 center_id | Service |
| **status 기본값** | 생성 시 status='pending' | Model default |
| **Task 자동 생성** | Case 생성 이벤트로 assessment_summary 각각에 대해 Task 자동 생성 | Service |

### 1.1 검사 케이스 수정 규칙

| 규칙 | 설명 | 검증 위치 |
|------|------|----------|
| **assessment_ids 변경 허용** | 케이스의 검사 구성을 변경할 수 있음 (요청으로 assessment_ids 전달) | AssessmentCaseUpdate schema |
| **assessment_summary 재생성** | assessment_ids 변경 시 Assessment 요약을 다시 스냅샷 저장 | Service |
| **Task 동기화** | 추가된 assessment_id는 Task 생성, 제거된 assessment_id는 Task.status='cancelled' 처리 | Service |
| **상태 제한** | COMPLETED/CANCELLED 케이스는 검사 구성 변경 불가 | Service |

### 2. AssessmentSession 생성 규칙

| 규칙 | 설명 | 검증 위치 |
|------|------|----------|
| **케이스 연결 필수** | case_id 필수 | AssessmentSessionCreate schema |
| **Schedule 연동 권장** | schedule_id 전달 시 ScheduledRelation 생성 | Handler |
| **케이스 PENDING/PROCESSING만** | COMPLETED/CANCELLED 케이스에 Session 추가 불가 | Service |

### 3. 상태 전이 규칙

**케이스 상태 (AssessmentCase.status)**:

```
┌─────────┐
│ PENDING │ ← 케이스 생성 초기 상태
└────┬────┘
     │ 첫 Task 시작
     ↓
┌────────────┐
│ PROCESSING │
└─────┬──────┘
      │ (1) 모든 Task 완료     │ (2) 취소
      ↓                        ↓
┌───────────┐            ┌───────────┐
│ COMPLETED │            │ CANCELLED │
└───────────┘            └───────────┘
```

| 현재 상태 | 허용 전이 | 비고 |
|----------|----------|------|
| PENDING | PROCESSING, CANCELLED | 시작 또는 취소 |
| PROCESSING | COMPLETED, CANCELLED | 완료 또는 취소 |
| COMPLETED | - | 최종 상태 |
| CANCELLED | PENDING | 재개 (선택적) |

**세션 상태 (AssessmentSession.status)**:

| 현재 상태 | 허용 전이 | 비고 |
|----------|----------|------|
| SCHEDULED | ATTENDED, NOSHOW, CANCELLED | 예약 → 참석/노쇼/취소 |
| ATTENDED | - | 완료 후 변경 불가 |
| NOSHOW | SCHEDULED | 재예약 가능 |
| CANCELLED | SCHEDULED | 재예약 |

**Task 상태 (AssessmentTask.status)**:

```
pending (대기/진행전)
    ↓ 검사 시작
processing (진행중)
    ↓
┌───────────┬───────────┬───────────┬───────────┐
│ completed │   hold    │  refused  │ cancelled │
│  (완료)   │  (보류)   │  (거부)   │  (취소)   │
└───────────┴───────────┴───────────┴───────────┘
```

| 현재 상태 | 허용 전이 | 비고 |
|----------|----------|------|
| pending | processing, cancelled | 대기 → 시작/취소 |
| processing | completed, hold, refused, cancelled | 진행 → 완료/보류/거부/취소 |
| completed | - | 최종 상태 |
| hold | processing, cancelled | 보류 → 재시작/취소 |
| refused | - | 최종 상태 (내담자 거부) |
| cancelled | pending | 재활성화 |

### 4. Schedule 연동 규칙 (ScheduledRelation 패턴)

| 시나리오 | 처리 |
|----------|------|
| **예약 생성** | Schedule 생성 → AssessmentSession 생성 → ScheduledRelation 생성 |
| **일정 취소** | Schedule 삭제 → ScheduledRelation CASCADE 삭제, Session.status=CANCELLED |
| **일정 없이 검사** | Schedule 없이 Session만 생성 (온라인 검사 등), ScheduledRelation 없음 |
| **세션 삭제** | ScheduledRelation 삭제 → Session 삭제, Schedule은 유지 (재사용 가능) |

> TODO: Schedule 삭제/변경 시 AssessmentSession.status 동기화는 트랜잭션 단위(같은 uow) 또는 이벤트 단위로 처리한다.

**ScheduledRelation 구조**:
```python
# 복합 PK: (schedule_id, scheduled_resource_type, scheduled_resource_id)
ScheduledRelation(
    schedule_id="...",
    scheduled_resource_type="assessment",
    scheduled_resource_id=session.id
)
```

### 5. 종합보고서 관리 (Document 위임)

```python
# 종합보고서 생성 예시
async def create_final_report(case_id: str, report_content: dict, auth: AuthContext):
    async with uow:
        # 1. Document 생성
        document = await document_service.create({
            "entity_type": "assessment_case",
            "entity_id": case_id,
            "uploader_id": auth.member_id,
            "category": "final_report",
            "content": report_content,
        })

        await uow.commit()
```

### 6. 집단검사 지원

> `case_type` 필드를 두지 않으며, 집단검사는 **복수 client 참여자**로 표현하고 필요 시 `tags`로 분류/표기합니다.

```python
# 집단검사 케이스 생성 예시
AssessmentCase:
  tags = ["group", "org:서울초등학교"]

AssessmentCaseParticipant:
  - (case_id, "client", student_1_id, assigned_at)
  - (case_id, "client", student_2_id, assigned_at)
  - ...
  - (case_id, "client", student_30_id, assigned_at)
  - (case_id, "specialist", examiner_id, assigned_at)
```

### 7. 패키지 기본 담당자 자동 할당

```python
# 패키지 선택 시 기본 담당자 자동 할당 예시
AssessmentPackage:
  id = "pkg_001"
  name = "종합심리검사 패키지"
  assessment_ids = ["assessment_1", "assessment_2", "assessment_3"]
  center_member_ids = ["member_1", "member_2"]  # 기본 담당자

# 케이스 생성 시
async def create_case_from_package(package_id, client_id, specialist_ids=None):
    package = await package_repo.get(package_id)

    # specialist_ids가 없으면 패키지 기본 담당자 사용
    final_specialists = specialist_ids or package.center_member_ids

    case = await case_service.create(...)
    for specialist_id in final_specialists:
        await participant_service.add_specialist(case.id, specialist_id)
```

**규칙**:
- `center_member_ids`는 optional (NULL 허용)
- 케이스 생성 시 명시적 담당자 지정이 있으면 우선 적용
- 명시적 지정 없고 패키지에 기본 담당자가 있으면 자동 할당
- 둘 다 없으면 케이스 생성 시 담당자 선택 필수

---

## API 설계

### 엔드포인트 목록

#### CenterAssessment (센터별 검사 운영) 관리

> Assessment(검사) 마스터는 **Global** 리소스이며, 센터는 직접 CRUD 하지 않습니다.  
> 센터의 “운영 여부/노출”은 `CenterAssessment.is_active`로만 제어합니다.

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/centers/{center_id}/center-assessments` | 센터 운영 검사 목록/상태 조회 | assessment:read |
| PATCH | `/centers/{center_id}/center-assessments/{assessment_id}` | 운영 여부 변경 (`is_active`) | assessment:update |

#### AssessmentCase (검사 케이스) CRUD

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/centers/{center_id}/assessment-cases` | 케이스 목록 | assessment:read |
| GET | `/centers/{center_id}/assessment-cases/{id}` | 케이스 상세 | assessment:read |
| POST | `/centers/{center_id}/assessment-cases` | 케이스 생성 | assessment:create |
| PATCH | `/centers/{center_id}/assessment-cases/{id}` | 케이스 수정 (검사 구성 변경 포함) | assessment:update |
| POST | `/centers/{center_id}/assessment-cases/{id}/complete` | 케이스 완료 | assessment:update |
| POST | `/centers/{center_id}/assessment-cases/{id}/cancel` | 케이스 취소 | assessment:update |

**쿼리 파라미터**:
- `status`: pending, processing, completed, cancelled 필터
- `tag`: tags 포함 필터
- `client_id`: 내담자 필터
- `specialist_id`: 검사전문가 필터
- `page`, `size`: 페이징

#### AssessmentSession CRUD

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/centers/{center_id}/assessment-cases/{case_id}/sessions` | 세션 목록 | assessment:read |
| GET | `/centers/{center_id}/sessions/{id}` | 세션 상세 | assessment:read |
| POST | `/centers/{center_id}/assessment-cases/{case_id}/sessions` | 세션 생성 | assessment:create |
| PATCH | `/centers/{center_id}/sessions/{id}` | 세션 수정 | assessment:update |
| POST | `/centers/{center_id}/sessions/{id}/attend` | 출석 처리 | assessment:update |
| POST | `/centers/{center_id}/sessions/{id}/noshow` | 노쇼 처리 | assessment:update |
| POST | `/centers/{center_id}/sessions/{id}/cancel` | 취소 처리 | assessment:update |

#### AssessmentTask CRUD

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/centers/{center_id}/assessment-cases/{case_id}/tasks` | Task 목록 | assessment:read |
| GET | `/centers/{center_id}/assessment-cases/{case_id}/tasks/{assessment_id}` | Task 상세 (Task ID = assessment_id) | assessment:read |
| GET | `/centers/{center_id}/assessment-cases/{case_id}/tasks/{assessment_id}/assessment` | 검사 정보/definition 조회 | assessment:read |
| POST | `/centers/{center_id}/assessment-cases/{case_id}/tasks/{assessment_id}/start` | 검사 시작 | assessment:update |
| POST | `/centers/{center_id}/assessment-cases/{case_id}/tasks/{assessment_id}/submit` | 응답 제출 | assessment:update |
| POST | `/centers/{center_id}/assessment-cases/{case_id}/tasks/{assessment_id}/complete` | 검사 완료 | assessment:update |
| GET | `/centers/{center_id}/assessment-cases/{case_id}/tasks/{assessment_id}/report` | 결과 보고서 | assessment:read |

#### 케이스 참여자 관리

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/centers/{center_id}/assessment-cases/{id}/participants` | 참여자 목록 | assessment:read |
| POST | `/centers/{center_id}/assessment-cases/{id}/participants` | 참여자 추가 | assessment:update |
| DELETE | `/centers/{center_id}/assessment-cases/{id}/participants/{type}/{participant_id}` | 참여자 제거 | assessment:update |

#### AssessmentPackage CRUD

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/centers/{center_id}/assessment-packages` | 패키지 목록 | assessment:read |
| GET | `/centers/{center_id}/assessment-packages/{id}` | 패키지 상세 | assessment:read |
| POST | `/centers/{center_id}/assessment-packages` | 패키지 생성 | assessment:create |
| PATCH | `/centers/{center_id}/assessment-packages/{id}` | 패키지 수정 | assessment:update |
| DELETE | `/centers/{center_id}/assessment-packages/{id}` | 패키지 삭제 (Soft) | assessment:delete |

#### AssessmentSendLink 관리

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| POST | `/centers/{center_id}/assessment-cases/{case_id}/send-link` | 바로링크 생성 (Task.execution_method=online 전환 포함) | assessment:create |
| GET | `/assessment/take/{token}` | 온라인 검사 접속 (Public) | - |

---

## 주요 워크플로우

### 1. 개별 검사 케이스 생성 및 진행

```
[Frontend]
1. 내담자 선택
2. 검사 선택 (개별 또는 패키지)
   - 패키지 선택 시 center_member_ids로 기본 담당자 자동 설정
3. 담당 검사전문가 선택 (패키지 기본값 또는 직접 선택)
4. 일정 선택 (날짜, 시간, 검사실)
5. "검사 접수하기" 클릭

[Backend - CreateAssessmentCaseHandler]
async with uow:
    # 0. 패키지 사용 시 기본 담당자 조회
    specialist_ids = request.specialist_ids
    package_snapshot = None
    if request.package_id:
        package = await package_repo.get(request.package_id)
        if package.center_member_ids and not specialist_ids:
            specialist_ids = package.center_member_ids
        package_snapshot = {
            "package_id": package.id,
            "name": package.name,
            "source_updated_at": package.updated_at,
            "snapshot_at": datetime.utcnow(),
        }

    # 1. Schedule 생성 (일정 정보)
    schedule = await schedule_service.create({
        center_id=center_id,
        schedule_type="assessment",
        start=scheduled_time,
        end=scheduled_time + duration,
        room_id=room_id,
        note="종합심리검사"
    })

    # 2. Case 생성
    case = await case_service.create({
        center_id=center_id,
        assessment_ids=[assessment_1, assessment_2],
        package_summary=package_snapshot,
        status="pending"
    })
    # NOTE: case_service.create 내부에서 assessment_summary를 자동 생성한다.

    # 3. Participant 추가 (패키지 기본 담당자 또는 직접 선택)
    await participant_service.add_client(case.id, client_id)
    for specialist_id in specialist_ids:
        await participant_service.add_specialist(case.id, specialist_id)

    # 4. Session 생성
    session = await session_service.create({
        center_id=center_id,
        case_id=case.id,
        status="scheduled"
    })

    # 5. ScheduledRelation 생성 (Schedule-Session 연결)
    await relation_service.create({
        schedule_id=schedule.id,
        scheduled_resource_type="assessment",
        scheduled_resource_id=session.id
    })

    # 6. Task 자동 생성 (Case 생성 이벤트에서 자동 생성됨)
    # NOTE: Task 생성 시점은 추후 재결정 가능
    await uow.commit()

[생성된 데이터]
Schedule: 시간/장소 정보
Case: PENDING
Session: SCHEDULED
ScheduledRelation: (schedule_id, "assessment", session_id)
Task (x2): PENDING (Case 생성 이벤트로 자동 생성)
```

### 2. 검사 실시

```
[검사 시작]
POST /centers/{center_id}/assessment-cases/{case_id}/tasks/{assessment_id}/start
Task.status: PENDING → PROCESSING
Case.status: PENDING → PROCESSING (첫 Task 시작 시)

[응답 저장 (실시간)]
POST /centers/{center_id}/assessment-cases/{case_id}/tasks/{assessment_id}/submit
Task.process 업데이트:
{
  "progress": 50,
  "current_item": 25,
  "total_items": 50,
  "responses": [...]
}

[검사 완료]
POST /centers/{center_id}/assessment-cases/{case_id}/tasks/{assessment_id}/complete
- Assessment.definition.scoring 기반 채점
- Task.report_payload에 결과 저장
- Task.status: COMPLETED
- Task.completed_at: now()
```

### 3. 케이스 완료

```
[모든 Task COMPLETED 확인]
POST /assessment-cases/{id}/complete
- 모든 Task 상태 확인
- Case.status: COMPLETED
- Case.completed_at: now()
- Session.status: ATTENDED

[종합보고서 생성 (옵션)]
POST /assessment-cases/{id}/final-report
- 모든 Task.report_payload 수집
- Document 생성 (category="final_report")
```

### 4. 온라인 검사 바로링크

```
[링크 생성]
POST /assessment-cases/{case_id}/send-link
- unique_token 생성 (UUID)
- expired_at 설정 (7일 후)
- recipients 설정
- 해당 케이스의 Task.execution_method를 online으로 업데이트

[링크 발송]
- 이메일/SMS 발송 (외부 서비스)

[내담자 접속]
GET /assessment/take/{token}
- Token 검증
- 만료 확인
- Case.assessment_summary 조회 (요약 정보)
- Assessment.definition 조회 (문항/채점/해석)
- 검사 화면 표시

[검사 실시]
Task 진행 (동일 프로세스)
```

---

## 구현 우선순위

### Phase 1: 핵심 CRUD (필수)

1. Assessment 엔티티 및 CRUD
2. AssessmentCase 엔티티 및 CRUD
3. AssessmentTask 엔티티 및 CRUD
4. AssessmentCaseParticipant (케이스 참여자) 관리

**검증 항목**:
- 센터별 격리 (center_id)
- 최소 1명 내담자/검사전문가 (participant_type별)
- Task 자동 생성

### Phase 2: 세션 및 일정 관리

1. AssessmentSession 엔티티 및 CRUD
2. Schedule 도메인 연동
3. 세션 상태 전이

**검증 항목**:
- ScheduledRelation 기반 Schedule 연동
- 상태별 비즈니스 규칙

### Phase 3: 검사 수행

1. Task 시작/응답 저장/완료 API
2. 채점 로직 (Assessment.definition.scoring 기반)
3. report_payload 생성

**검증 항목**:
- 진행률 계산
- 채점 결과 정확성

### Phase 4: 부가 기능

1. AssessmentPackage 엔티티 및 CRUD
2. AssessmentSendLink (바로링크)
3. 종합보고서 (Document 연동)

### Phase 5: 고급 기능

1. 집단검사 지원
2. AssessmentSessionParticipant (세션 참여자)
3. 통계/분석 API

---

## 참고 문서

- **의사결정 기록**: `/docs/assessment/decision-log.md`
- **Counseling 도메인**: `/docs/counseling/domain.md`
- **Client 도메인**: `/docs/client/domain.md`
- **Document 도메인**: `/docs/document/domain.md`
- **Schedule 도메인**: `/docs/schedule/domain.md`

---

**작성일**: 2026-01-20
**버전**: 3.19
**아키텍처**: 모듈러 모놀리스, Row-level Multi-tenancy
**변경 이력**:
- v2 → v3: `definition` JSONB 통합, Schedule 연동 복원, `specialist` 용어 사용
- v3.1: Schedule 연동 방식 변경 - `schedule_id` FK 제거, `ScheduledRelation` 중간 테이블 패턴 적용
- v3.2: `CenterAssessment` 테이블 추가, `AssessmentTask.execution_method` 추가, `TaskStatus`에 `hold`/`refused` 추가, `AssessmentPackage.center_member_ids` 추가 (기본 담당자)
- v3.3: 종합보고서 등록 플래그 추가 (`final_report_document_id` FK 대신), Task 생성 시점 명확화
- v3.4: `AssessmentCase.assessment_snapshots` 추가 (v3.14에서 `assessment_summary_snapshots`로 변경, v3.15에서 `assessment_summary`로 변경)
- v3.5: `AssessmentCase.case_type` 제거 (집단검사는 참여자 구성으로 표현)
- v3.6: `AssessmentCase.organization_name` 제거, `AssessmentCase.tags` 추가
- v3.7: bool 필드 네이밍 정리 (`is_final_report_required`, `is_final_report_registered`) (v3.8에서 `is_final_report_registered` 제거)
- v3.8: `AssessmentCase.is_final_report_registered` 제거 (Document로 역조회)
- v3.10: `AssessmentCase.assessment_ids` 제거, `AssessmentCase.package` 스냅샷 확장, `AssessmentCase.modified_by_*` 제거
- v3.11: `AssessmentSession.modified_by_*` 제거
- v3.12: `Assessment`, `AssessmentTask`, `AssessmentPackage`, `AssessmentSendLink`의 `modified_by_*` 제거
- v3.13: `AssessmentTask.report_visible_to_guardian` → `is_report_visible_to_guardian`
- v3.14: `AssessmentCase.assessment_summary_snapshots`로 스냅샷 범위 축소, `AssessmentSessionParticipant.session_id` 정합성 반영, mutable default 제거 (v3.15에서 필드명 변경)
- v3.15: `AssessmentCase.assessment_summary_snapshots` → `assessment_summary`, `AssessmentCase.package` → `package_summary`
- v3.16: 스키마 정의를 `Core Schemas`/`Pydantic Schemas`로 분류
- v3.17: Core Schemas의 Global/Center 하위 분류 제거
- v3.18: 상태값 소문자 표기 통일, Task 생성 시점/ExecutionMethod 규칙 명확화, DTO를 스키마에 정렬, 취소일시 필드 제거, CenterAssessment 활성화 검증 추가
- v3.19: API 설계 정합성 보강 (CenterAssessment 제어, Task 경로 정리, status 필터 소문자, Case PATCH로 검사 구성 변경 허용)
