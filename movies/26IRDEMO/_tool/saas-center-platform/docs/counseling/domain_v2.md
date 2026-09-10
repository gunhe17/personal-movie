# Counseling 도메인 설계 V2

> 실제 상담센터 운영 흐름에 맞춘 재설계 (2026-01-22)
> 핵심 변경: 회기 번호 제거, 날짜 기반 관리, 초기상담 통합

## 설계 철학

### 1. 단순성 우선 (Simplicity First)
- **날짜 기반 정렬**: 회기 번호 대신 `scheduled_at`로 순서 관리
- **노쇼/취소 처리 간소화**: 상태만 변경, 복잡한 번호 재할당 불필요
- **일정 변경 유연성**: 새 Session 생성만으로 처리 완료

### 2. 실무 중심 설계
- **초기상담 통합**: `session_type`으로 구분, 같은 테이블 관리
- **센터별 정책 유연성**: 설정으로 다양한 운영 방식 지원
- **진행 현황은 계산**: 완료 횟수, 노쇼 횟수 등 동적 계산

### 3. 확장 가능성
- **구조화된 양식 관리**: FormTemplate으로 센터별 커스텀 양식 정의
- **구조화된 일지**: CounselingNote로 상담일지 구조화 저장 및 조회
- **OCR 통합**: 부모님 작성 기록지 → OCR → 초안 생성 → 상담사 수정
- **Billing 분리**: 결제/청구 로직은 별도 도메인
- **Schedule 연동**: ScheduledRelation 중간 테이블로 유연한 연결

---

## 핵심 엔티티

### 1. Counseling (상담 프로그램)

상담센터가 제공하는 서비스 유형 정의.

```python
from sqlalchemy import String, Integer, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from app.core.database import Base

class Counseling(Base):
    """
    상담 프로그램 엔티티
    - 센터가 제공하는 상담 서비스 (개인상담, 언어치료, 미술치료 등)
    - 가격, 소요시간, 담당 상담사 정의
    """
    __tablename__ = "counselings"

    # Primary Key
    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    # 멀티테넌시
    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)

    # 상담 프로그램 정보
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    price: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)

    # 담당 상담사 목록
    counselor_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    # 타임스탬프
    created_at: Mapped[datetime] = mapped_column(nullable=False)
    updated_at: Mapped[datetime] = mapped_column(nullable=False)
```

**필드 설명**:

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK | 프로그램 고유 ID |
| `center_id` | UUID | NOT NULL | 센터 ID (멀티테넌시) |
| `name` | String(100) | NOT NULL | 프로그램명 (예: "개인상담") |
| `description` | String(500) | NULL | 프로그램 설명 |
| `price` | Integer | NOT NULL | 회당 가격 (원) |
| `duration_minutes` | Integer | NOT NULL | 회당 소요 시간 (분) |
| `counselor_ids` | JSONB | NOT NULL | 담당 상담사 ID 목록 |
| `created_at` | DateTime | NOT NULL | 생성 일시 |
| `updated_at` | DateTime | NOT NULL | 수정 일시 |

---

### 2. CounselingCase (상담 케이스)

연속된 상담 여정의 단위. 케이스 제목, 주호소문제, 목표 등 구조화된 정보 포함.

```python
from sqlalchemy import String, Text, Integer, Index
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from uuid import uuid4
from app.core.database import Base

class CounselingCase(Base):
    """
    상담 케이스 엔티티
    - 연속된 상담 여정의 단위 (계약 단위)
    - N:M 참여자 관계 (내담자, 상담사)
    - 초기상담 정보 포함 (title, chief_complaint, goal)
    """
    __tablename__ = "counseling_cases"

    # Primary Key
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4())
    )

    # 멀티테넌시
    center_id: Mapped[str] = mapped_column(
        String(36),
        nullable=False,
        index=True
    )

    # 상담 프로그램 연결
    counseling_id: Mapped[str] = mapped_column(
        String(36),
        nullable=False,
        index=True
    )

    # === 케이스 식별 정보 ===
    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False
    )
    # 예: "김철수 우울증 상담", "부부상담 - 의사소통 문제"

    # === 초기상담 정보 ===
    chief_complaint: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )
    # 예: "우울증, 불안, 대인관계 어려움"

    goal: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )
    # 예: "증상 완화 및 사회적 기능 회복"

    memo: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )
    # 기타 메모 (자유 텍스트)

    # === 계획 ===
    total_sessions: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True
    )
    # 계획된 총 회기 수 (NULL = 무제한)

    # === 상태 ===
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="ACTIVE",
        index=True
    )
    # ACTIVE, COMPLETED, CANCELLED

    # 타임스탬프
    created_at: Mapped[datetime] = mapped_column(
        nullable=False,
        default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # Indexes
    __table_args__ = (
        Index("ix_counseling_cases_center_status", "center_id", "status"),
    )
```

**필드 설명**:

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK | 케이스 고유 ID |
| `center_id` | UUID | NOT NULL, IDX | 센터 ID |
| `counseling_id` | UUID | NOT NULL, IDX | 상담 프로그램 ID |
| **`title`** | **String(200)** | **NOT NULL** | **케이스 제목** |
| **`chief_complaint`** | **Text** | **NULL** | **주 호소 문제** |
| **`goal`** | **Text** | **NULL** | **상담 목표** |
| `memo` | Text | NULL | 기타 메모 |
| `total_sessions` | Integer | NULL | 계획된 총 회기 수 |
| `status` | String(20) | NOT NULL, IDX | 케이스 상태 |
| `created_at` | DateTime | NOT NULL | 생성 일시 |
| `updated_at` | DateTime | NOT NULL | 수정 일시 |

**Status 값**:
- `ACTIVE`: 진행 중
- `COMPLETED`: 완료 (종결)
- `CANCELLED`: 취소

---

### 3. CounselingSession (상담 방문 기록)

**핵심 변경**: `session_number` 필드 제거, `session_type` 추가, 날짜 기반 정렬.

```python
from sqlalchemy import String, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from uuid import uuid4
from enum import Enum
from app.core.database import Base

class SessionType(str, Enum):
    """상담 방문 유형"""
    INTAKE = "intake"      # 초기상담
    REGULAR = "regular"    # 정규상담
    FOLLOWUP = "followup"  # 추후상담

class SessionStatus(str, Enum):
    """상담 방문 상태"""
    SCHEDULED = "scheduled"  # 예약됨
    COMPLETED = "completed"  # 완료
    NO_SHOW = "no_show"      # 노쇼
    CANCELLED = "cancelled"  # 취소

class CounselingSession(Base):
    """
    상담 방문 기록 엔티티
    - 초기상담과 정규상담 통합 관리 (session_type으로 구분)
    - 회기 번호 제거: 날짜 기반 정렬 (scheduled_at)
    - Document 도메인으로 상담일지 첨부
    - ScheduledRelation으로 Schedule 연결
    """
    __tablename__ = "counseling_sessions"

    # Primary Key
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4())
    )

    # 멀티테넌시
    center_id: Mapped[str] = mapped_column(
        String(36),
        nullable=False,
        index=True
    )

    # 케이스 연결
    counseling_case_id: Mapped[str] = mapped_column(
        String(36),
        nullable=False,
        index=True
    )

    # === 방문 유형 (신규) ===
    session_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="regular",
        index=True
    )
    # "intake" | "regular" | "followup"

    # === 회기 번호 제거 ===
    # session_number 필드 없음

    # === 상태 ===
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="scheduled",
        index=True
    )
    # "scheduled" | "completed" | "no_show" | "cancelled"

    # === 일정 정보 ===
    scheduled_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        index=True
    )
    # 예약 일시 (날짜 기반 정렬의 기준)

    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )
    # 완료 일시 (status="completed" 시 설정)

    # 타임스탬프
    created_at: Mapped[datetime] = mapped_column(
        nullable=False,
        default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # Indexes
    __table_args__ = (
        Index("ix_counseling_sessions_case_scheduled", "counseling_case_id", "scheduled_at"),
        Index("ix_counseling_sessions_case_type", "counseling_case_id", "session_type"),
        Index("ix_counseling_sessions_case_status", "counseling_case_id", "status"),
    )
```

**필드 설명**:

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK | 방문 기록 고유 ID |
| `center_id` | UUID | NOT NULL, IDX | 센터 ID |
| `counseling_case_id` | UUID | NOT NULL, IDX | 케이스 ID |
| **`session_type`** | **String(20)** | **NOT NULL, IDX** | **방문 유형** (intake/regular/followup) |
| `status` | String(20) | NOT NULL, IDX | 방문 상태 |
| **`scheduled_at`** | **DateTime** | **NOT NULL, IDX** | **예약 일시** (정렬 기준) |
| `completed_at` | DateTime | NULL | 완료 일시 |
| `created_at` | DateTime | NOT NULL | 생성 일시 |
| `updated_at` | DateTime | NOT NULL | 수정 일시 |

**SessionType 값**:
- `intake`: 초기상담/초기면담
- `regular`: 정규상담 (치료/개입)
- `followup`: 추후상담 (종결 후 체크)

**SessionStatus 값**:
- `scheduled`: 예약됨
- `completed`: 완료
- `no_show`: 노쇼 (무단 불참)
- `cancelled`: 취소

---

### 4. CounselingCaseParticipant (참여자 관계)

N:M 관계로 내담자와 상담사 관리.

```python
from sqlalchemy import String, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from uuid import uuid4
from enum import Enum
from app.core.database import Base

class ParticipantRole(str, Enum):
    """참여자 역할"""
    CLIENT = "client"        # 내담자
    COUNSELOR = "counselor"  # 상담사

class CounselingCaseParticipant(Base):
    """
    상담 케이스 참여자 엔티티
    - N:M 관계 (CounselingCase ↔ Person/Member)
    - 내담자/상담사 구분 (role)
    """
    __tablename__ = "counseling_case_participants"

    # Primary Key
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4())
    )

    # 멀티테넌시
    center_id: Mapped[str] = mapped_column(
        String(36),
        nullable=False,
        index=True
    )

    # 케이스 연결
    counseling_case_id: Mapped[str] = mapped_column(
        String(36),
        nullable=False,
        index=True
    )

    # 참여자 연결
    participant_id: Mapped[str] = mapped_column(
        String(36),
        nullable=False,
        index=True
    )
    # Client 또는 Member의 ID

    # 역할
    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        index=True
    )
    # "client" | "counselor"

    # 타임스탬프
    created_at: Mapped[datetime] = mapped_column(
        nullable=False,
        default=datetime.utcnow
    )

    # Indexes & Constraints
    __table_args__ = (
        Index("ix_counseling_case_participants_case", "counseling_case_id"),
        Index("ix_counseling_case_participants_participant", "participant_id"),
        UniqueConstraint(
            "counseling_case_id",
            "participant_id",
            "role",
            name="uq_case_participant_role"
        ),
    )
```

**필드 설명**:

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK | 참여 기록 고유 ID |
| `center_id` | UUID | NOT NULL, IDX | 센터 ID |
| `counseling_case_id` | UUID | NOT NULL, IDX | 케이스 ID |
| `participant_id` | UUID | NOT NULL, IDX | 참여자 ID (Client/Member) |
| `role` | String(20) | NOT NULL, IDX | 역할 (client/counselor) |
| `created_at` | DateTime | NOT NULL | 참여 시작 일시 |

**Unique Constraint**: (counseling_case_id, participant_id, role)
- 같은 케이스에 같은 사람이 같은 역할로 중복 참여 방지

---

### 5. FormTemplate (양식 템플릿)

센터별 커스텀 양식 정의. 초기상담 기록지, 정규상담 일지 등의 구조를 센터가 직접 정의.

```python
from sqlalchemy import String, Text, Integer, Boolean, JSONB, Index
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from uuid import uuid4
from app.core.database import Base

class FormTemplate(Base):
    """
    양식 템플릿 엔티티
    - 센터별 커스텀 양식 정의 (초기상담 기록지, 정규상담 일지 등)
    - JSON Schema 형태로 필드 정의
    - 구조화된 데이터 입력 및 조회 지원
    """
    __tablename__ = "form_templates"

    # Primary Key
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4())
    )

    # 멀티테넌시
    center_id: Mapped[str] = mapped_column(
        String(36),
        nullable=False,
        index=True
    )

    # 양식 정보
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )
    # 예: "초기상담 기록지", "정규상담 일지", "놀이치료 일지"

    form_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        index=True
    )
    # "intake_note" | "session_note"

    description: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True
    )

    # 필드 정의 (JSON Schema)
    fields: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False
    )
    # [
    #   {
    #     "name": "chief_complaint",
    #     "type": "textarea",
    #     "label": "주 호소 문제",
    #     "required": true,
    #     "placeholder": "내담자의 주요 호소 문제를 작성하세요"
    #   },
    #   {
    #     "name": "family_history",
    #     "type": "textarea",
    #     "label": "가족력",
    #     "required": false
    #   }
    # ]

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True
    )

    version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1
    )

    # 타임스탬프
    created_at: Mapped[datetime] = mapped_column(
        nullable=False,
        default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # Indexes
    __table_args__ = (
        Index("ix_form_templates_center_type", "center_id", "form_type"),
        Index("ix_form_templates_active", "is_active"),
    )
```

**필드 설명**:

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK | 템플릿 고유 ID |
| `center_id` | UUID | NOT NULL, IDX | 센터 ID |
| `name` | String(100) | NOT NULL | 양식명 |
| `form_type` | String(20) | NOT NULL, IDX | 양식 유형 (intake_note/session_note) |
| `description` | String(500) | NULL | 양식 설명 |
| `fields` | JSONB | NOT NULL | 필드 정의 (JSON Schema) |
| `is_active` | Boolean | NOT NULL | 활성화 여부 |
| `version` | Integer | NOT NULL | 버전 번호 |
| `created_at` | DateTime | NOT NULL | 생성 일시 |
| `updated_at` | DateTime | NOT NULL | 수정 일시 |

**FormType 값**:
- `intake_note`: 초기상담 기록지
- `session_note`: 정규상담 일지

**필드 정의 예시**:
```json
[
  {
    "name": "chief_complaint",
    "type": "textarea",
    "label": "주 호소 문제",
    "required": true,
    "placeholder": "내담자의 주요 호소 문제를 작성하세요",
    "rows": 4
  },
  {
    "name": "family_history",
    "type": "textarea",
    "label": "가족력",
    "required": false,
    "rows": 3
  },
  {
    "name": "counseling_plan",
    "type": "text",
    "label": "상담 계획",
    "required": true,
    "maxLength": 200
  },
  {
    "name": "risk_assessment",
    "type": "select",
    "label": "위험도 평가",
    "required": true,
    "options": ["낮음", "중간", "높음"]
  }
]
```

---

### 6. CounselingNote (상담일지)

구조화된 상담 기록. FormTemplate 기반으로 데이터를 저장하여 화면에서 구조화된 형태로 조회 가능.

```python
from sqlalchemy import String, JSONB, Index
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from uuid import uuid4
from enum import Enum
from app.core.database import Base

class NoteStatus(str, Enum):
    """일지 작성 상태"""
    DRAFT = "draft"           # 초안 (OCR 결과)
    IN_REVIEW = "in_review"   # 검토 중
    COMPLETED = "completed"   # 작성 완료

class OcrStatus(str, Enum):
    """OCR 처리 상태"""
    PENDING = "pending"       # 대기 중
    PROCESSING = "processing" # 처리 중
    COMPLETED = "completed"   # 완료
    FAILED = "failed"         # 실패

class CounselingNote(Base):
    """
    상담일지 엔티티
    - 구조화된 상담 기록 (FormTemplate 기반)
    - 초기상담: 부모님 기록지 → OCR → 초안 → 상담사 수정
    - 정규상담: 상담사가 직접 작성
    - Session과 1:1 관계
    """
    __tablename__ = "counseling_notes"

    # Primary Key
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4())
    )

    # 멀티테넌시
    center_id: Mapped[str] = mapped_column(
        String(36),
        nullable=False,
        index=True
    )

    # Session 1:1 연결
    counseling_session_id: Mapped[str] = mapped_column(
        String(36),
        nullable=False,
        unique=True,
        index=True
    )

    # 양식 템플릿
    template_id: Mapped[str] = mapped_column(
        String(36),
        nullable=False,
        index=True
    )

    # 구조화된 내용 (JSONB)
    content: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False
    )
    # {
    #   "chief_complaint": "우울증, 불안, 대인관계 어려움",
    #   "family_history": "부모 이혼 경험",
    #   "developmental_history": "정상 발달",
    #   "counseling_plan": "10회 인지행동치료"
    # }

    # OCR 관련 (초기상담만)
    source_document_id: Mapped[str | None] = mapped_column(
        String(36),
        nullable=True
    )
    # 부모님 작성 기록지 스캔본 (Document ID)

    ocr_status: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True
    )
    # "pending" | "processing" | "completed" | "failed"

    # 작성 상태
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="draft",
        index=True
    )
    # "draft" | "in_review" | "completed"

    # 작성자
    author_id: Mapped[str] = mapped_column(
        String(36),
        nullable=False
    )
    # Member ID (상담사)

    # 타임스탬프
    created_at: Mapped[datetime] = mapped_column(
        nullable=False,
        default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # Indexes
    __table_args__ = (
        Index("ix_counseling_notes_session", "counseling_session_id"),
        Index("ix_counseling_notes_template", "template_id"),
        Index("ix_counseling_notes_status", "status"),
    )
```

**필드 설명**:

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK | 일지 고유 ID |
| `center_id` | UUID | NOT NULL, IDX | 센터 ID |
| `counseling_session_id` | UUID | NOT NULL, UNIQUE, IDX | Session ID (1:1) |
| `template_id` | UUID | NOT NULL, IDX | 양식 템플릿 ID |
| `content` | JSONB | NOT NULL | 구조화된 내용 |
| `source_document_id` | UUID | NULL | 원본 문서 ID (OCR 소스) |
| `ocr_status` | String(20) | NULL | OCR 처리 상태 |
| `status` | String(20) | NOT NULL, IDX | 작성 상태 |
| `author_id` | UUID | NOT NULL | 작성자 ID (상담사) |
| `created_at` | DateTime | NOT NULL | 생성 일시 |
| `updated_at` | DateTime | NOT NULL | 수정 일시 |

**NoteStatus 값**:
- `draft`: 초안 (OCR 결과 또는 임시 저장)
- `in_review`: 검토 중
- `completed`: 작성 완료

**OcrStatus 값**:
- `pending`: OCR 대기 중
- `processing`: OCR 처리 중
- `completed`: OCR 완료
- `failed`: OCR 실패

---

## 비즈니스 규칙

### 1. 케이스 생성 규칙

**필수 조건**:
- `title`: 케이스 제목 필수 (1-200자)
- `counseling_id`: 존재하는 Counseling 프로그램 ID
- 최소 1명의 내담자 (role="client")
- 최소 1명의 상담사 (role="counselor")

**선택 정보**:
- `chief_complaint`: 주 호소 문제 (초기상담 시 작성)
- `goal`: 상담 목표 (초기상담 시 설정)
- `total_sessions`: 계획된 총 회기 수 (NULL = 무제한)

### 2. 방문 기록 및 일지 작성 규칙

#### 초기상담 워크플로우 (session_type="intake")

```
1. 부모님이 "초기상담 기록지" 작성 (오프라인 종이 양식)
   ↓
2. 사진/스캔 업로드 → Document 저장
   ↓
3. [선택적] OCR 처리 요청
   ↓ (비동기)
4. OCR 완료 → CounselingNote 초안 생성 (status="draft", ocr_status="completed")
   ↓
5. 상담사가 초안 검토/수정 → status="completed"
   ↓
6. CounselingCase.chief_complaint, goal 업데이트 (요약 정보)
```

**규칙**:
- Session 생성 시 `session_type="intake"`
- 부모님 기록지 업로드는 Session 생성 전후 언제든 가능 (센터별 운영 방식)
- OCR은 선택적 (상담사가 직접 타이핑 가능)
- CounselingNote.template_id = "초기상담 기록지" 템플릿
- OCR 초안은 자동으로 `status="draft"` 상태

#### 정규상담 워크플로우 (session_type="regular")

```
1. 상담 세션 진행
   ↓
2. 세션 종료 (status="completed")
   ↓
3. 상담사가 "상담일지" 작성 → CounselingNote 생성
   - 구조화된 양식에 직접 입력
   - 오늘 다룬 내용, 내담자 반응, 다음 계획 등
   ↓
4. 저장 → status="completed"
```

**규칙**:
- Session 생성 시 `session_type="regular"`
- CounselingNote는 상담사가 직접 작성 (OCR 없음)
- CounselingNote.template_id = "정규상담 일지" 템플릿
- 노쇼/취소: Session.status만 변경, CounselingNote 생성하지 않음

#### 추후상담 (session_type="followup")

- 케이스 종결(COMPLETED) 후 체크업
- 별도 Session 생성, 정규상담과 동일한 일지 작성

### 3. 회기 수 관리 규칙

**진행 현황 계산**:
```python
total_visits = count(sessions)  # 모든 방문
completed = count(sessions WHERE status="completed")  # 완료된 방문
no_show = count(sessions WHERE status="no_show")  # 노쇼
remaining = total_sessions - completed  # 남은 회기
```

**경고 표시**:
- `completed >= total_sessions`: "계획된 회기 수에 도달했습니다" 경고
- **차단하지 않음**: 경고만 표시, 초과 진행 가능
- 회기 수 연장: `PATCH /cases/{id}` API로 `total_sessions` 수정

### 4. 노쇼/취소 처리 규칙

**노쇼 발생 시**:
```python
session.status = "no_show"
# 새 Session 생성으로 재예약
# 회기 번호 없으므로 복잡한 재할당 불필요
```

**일정 변경 시**:
```python
# 기존 Session 취소
old_session.status = "cancelled"

# 새 Session 생성
new_session = CounselingSession(
    counseling_case_id=case_id,
    session_type="regular",
    status="scheduled",
    scheduled_at=new_datetime
)
# 날짜 기반 정렬이므로 순서 자동 정리
```

### 5. 날짜 기반 정렬 규칙

**조회 시 정렬**:
```python
sessions = await repo.get_by_case(
    case_id,
    order_by="scheduled_at"  # 날짜순 정렬
)
```

**UI 표시**:
```python
for i, session in enumerate(sessions, 1):
    type_label = {
        "intake": "초기상담",
        "regular": "정규상담",
        "followup": "추후상담"
    }[session.session_type]

    status_label = {
        "completed": "완료",
        "no_show": "노쇼",
        "cancelled": "취소",
        "scheduled": "예약"
    }[session.status]

    date_str = session.scheduled_at.strftime("%Y-%m-%d %H:%M")
    print(f"{i}. {date_str} - {type_label} - {status_label}")
```

**출력 예시**:
```
1. 2026-01-08 10:00 - 초기상담 - 완료
2. 2026-01-15 14:00 - 정규상담 - 완료
3. 2026-01-22 14:00 - 정규상담 - 노쇼
4. 2026-01-29 15:00 - 정규상담 - 취소
5. 2026-02-05 14:00 - 정규상담 - 예약
```

---

## Repository Layer

### CounselingCaseRepository

```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.modules.counseling.case.models import CounselingCase
from app.modules.counseling.session.models import CounselingSession

class CounselingCaseRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_progress(self, case_id: str) -> dict:
        """케이스 진행 현황 계산"""
        # 케이스 조회
        case = await self.get(case_id)
        if not case:
            return None

        # 방문 통계
        stmt = select(
            func.count().label("total_visits"),
            func.count().filter(CounselingSession.status == "completed").label("completed"),
            func.count().filter(CounselingSession.status == "no_show").label("no_show"),
            func.count().filter(CounselingSession.session_type == "intake").label("intake_count"),
        ).where(
            CounselingSession.counseling_case_id == case_id
        )

        result = await self._session.execute(stmt)
        stats = result.one()

        # 정규상담 완료 횟수
        regular_completed = stats.completed - stats.intake_count

        return {
            "total_sessions_planned": case.total_sessions,
            "total_visits": stats.total_visits,
            "completed": stats.completed,
            "no_show": stats.no_show,
            "intake_count": stats.intake_count,
            "regular_completed": regular_completed,
            "remaining": (
                case.total_sessions - regular_completed
                if case.total_sessions else None
            )
        }
```

### CounselingSessionRepository

```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.modules.counseling.session.models import CounselingSession

class CounselingSessionRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_by_case(
        self,
        case_id: str,
        session_type: str | None = None
    ) -> list[CounselingSession]:
        """케이스의 방문 기록 조회 (날짜순)"""
        stmt = select(CounselingSession).where(
            CounselingSession.counseling_case_id == case_id
        )

        if session_type:
            stmt = stmt.where(CounselingSession.session_type == session_type)

        # 날짜순 정렬
        stmt = stmt.order_by(CounselingSession.scheduled_at.asc())

        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def count_by_status(
        self,
        case_id: str,
        status: str
    ) -> int:
        """특정 상태의 방문 횟수"""
        stmt = select(func.count()).where(
            CounselingSession.counseling_case_id == case_id,
            CounselingSession.status == status
        )
        result = await self._session.execute(stmt)
        return result.scalar_one()

    async def count_by_type(
        self,
        case_id: str,
        session_type: str
    ) -> int:
        """특정 유형의 방문 횟수"""
        stmt = select(func.count()).where(
            CounselingSession.counseling_case_id == case_id,
            CounselingSession.session_type == session_type
        )
        result = await self._session.execute(stmt)
        return result.scalar_one()
```

### FormTemplateRepository

```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.modules.counseling.form_template.models import FormTemplate

class FormTemplateRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_by_center_and_type(
        self,
        center_id: str,
        form_type: str,
        is_active: bool = True
    ) -> list[FormTemplate]:
        """센터의 특정 유형 양식 목록"""
        stmt = select(FormTemplate).where(
            FormTemplate.center_id == center_id,
            FormTemplate.form_type == form_type
        )

        if is_active:
            stmt = stmt.where(FormTemplate.is_active == True)

        stmt = stmt.order_by(FormTemplate.created_at.desc())

        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_latest_version(
        self,
        center_id: str,
        form_type: str
    ) -> FormTemplate | None:
        """센터의 최신 버전 양식"""
        stmt = select(FormTemplate).where(
            FormTemplate.center_id == center_id,
            FormTemplate.form_type == form_type,
            FormTemplate.is_active == True
        ).order_by(
            FormTemplate.version.desc()
        ).limit(1)

        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()
```

### CounselingNoteRepository

```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.modules.counseling.note.models import CounselingNote

class CounselingNoteRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_by_session(
        self,
        session_id: str
    ) -> CounselingNote | None:
        """세션의 일지 조회 (1:1)"""
        stmt = select(CounselingNote).where(
            CounselingNote.counseling_session_id == session_id
        )

        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_case(
        self,
        case_id: str
    ) -> list[CounselingNote]:
        """케이스의 모든 일지 조회 (날짜순)"""
        # JOIN with CounselingSession for ordering
        stmt = select(CounselingNote).join(
            CounselingSession,
            CounselingNote.counseling_session_id == CounselingSession.id
        ).where(
            CounselingSession.counseling_case_id == case_id
        ).order_by(
            CounselingSession.scheduled_at.asc()
        )

        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_drafts(
        self,
        center_id: str
    ) -> list[CounselingNote]:
        """센터의 초안 일지 목록 (검토 대기)"""
        stmt = select(CounselingNote).where(
            CounselingNote.center_id == center_id,
            CounselingNote.status == "draft"
        ).order_by(
            CounselingNote.updated_at.desc()
        )

        result = await self._session.execute(stmt)
        return list(result.scalars().all())
```

---

## API 설계

### Schemas

#### CounselingCaseCreate

```python
from pydantic import BaseModel, Field

class CounselingCaseCreate(BaseModel):
    """케이스 생성 요청"""

    counseling_id: str = Field(..., description="상담 프로그램 ID")

    # === 필수 필드 ===
    title: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="케이스 제목"
    )

    # === 선택 필드 ===
    chief_complaint: str | None = Field(
        None,
        description="주 호소 문제"
    )

    goal: str | None = Field(
        None,
        description="상담 목표"
    )

    memo: str | None = Field(
        None,
        description="기타 메모"
    )

    total_sessions: int | None = Field(
        None,
        ge=1,
        description="계획된 총 회기 수 (NULL = 무제한)"
    )

    # === 참여자 ===
    client_ids: list[str] = Field(
        ...,
        min_length=1,
        description="내담자 ID 목록"
    )

    counselor_ids: list[str] = Field(
        ...,
        min_length=1,
        description="상담사 ID 목록"
    )
```

#### CounselingCaseUpdate

```python
class CounselingCaseUpdate(BaseModel):
    """케이스 수정 요청"""

    title: str | None = Field(
        None,
        min_length=1,
        max_length=200
    )

    chief_complaint: str | None = None
    goal: str | None = None
    memo: str | None = None
    total_sessions: int | None = Field(None, ge=1)
    status: str | None = Field(
        None,
        pattern="^(ACTIVE|COMPLETED|CANCELLED)$"
    )
```

#### CounselingCaseResponse

```python
from pydantic import BaseModel, computed_field, ConfigDict
from datetime import datetime

class CounselingCaseResponse(BaseModel):
    """케이스 응답"""

    model_config = ConfigDict(from_attributes=True)

    id: str
    center_id: str
    counseling_id: str
    counseling_name: str  # JOIN 결과

    # 케이스 정보
    title: str
    chief_complaint: str | None
    goal: str | None
    memo: str | None
    total_sessions: int | None
    status: str

    # 참여자 통계
    client_count: int
    counselor_count: int

    # 진행 현황
    session_count: int  # 완료된 방문 수

    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def session_warning(self) -> str | None:
        """회기 수 경고 메시지"""
        if self.total_sessions is None:
            return None
        if self.session_count >= self.total_sessions:
            return f"계획된 회기 수({self.total_sessions}회)에 도달했습니다"
        return None
```

#### CounselingSessionCreate

```python
class CounselingSessionCreate(BaseModel):
    """방문 기록 생성 요청"""

    counseling_case_id: str = Field(..., description="케이스 ID")

    session_type: str = Field(
        "regular",
        pattern="^(intake|regular|followup)$",
        description="방문 유형"
    )

    scheduled_at: datetime = Field(..., description="예약 일시")
```

#### CounselingSessionUpdate

```python
class CounselingSessionUpdate(BaseModel):
    """방문 기록 수정 요청"""

    status: str | None = Field(
        None,
        pattern="^(scheduled|completed|no_show|cancelled)$"
    )

    scheduled_at: datetime | None = None
    completed_at: datetime | None = None
```

#### CounselingSessionResponse

```python
class CounselingSessionResponse(BaseModel):
    """방문 기록 응답"""

    model_config = ConfigDict(from_attributes=True)

    id: str
    center_id: str
    counseling_case_id: str

    session_type: str
    status: str

    scheduled_at: datetime
    completed_at: datetime | None

    created_at: datetime
    updated_at: datetime
```

### Endpoints

#### CounselingCase APIs

```python
from fastapi import APIRouter, Depends, HTTPException
from app.core.unit_of_work import UnitOfWork, get_uow
from app.modules.counseling.case.schemas import (
    CounselingCaseCreate,
    CounselingCaseUpdate,
    CounselingCaseResponse
)

router = APIRouter(prefix="/counseling-cases", tags=["counseling-cases"])

@router.post("/", response_model=CounselingCaseResponse, status_code=201)
async def create_case(
    data: CounselingCaseCreate,
    uow: UnitOfWork = Depends(get_uow)
):
    """케이스 생성"""
    async with uow:
        # Handler 호출
        result = await create_case_handler(data, uow)
        await uow.commit()
        return result

@router.get("/{case_id}", response_model=CounselingCaseResponse)
async def get_case(
    case_id: str,
    uow: UnitOfWork = Depends(get_uow)
):
    """케이스 상세 조회"""
    async with uow:
        result = await get_case_handler(case_id, uow)
        if not result:
            raise HTTPException(status_code=404, detail="Case not found")
        return result

@router.patch("/{case_id}", response_model=CounselingCaseResponse)
async def update_case(
    case_id: str,
    data: CounselingCaseUpdate,
    uow: UnitOfWork = Depends(get_uow)
):
    """케이스 수정 (회기 수 연장 포함)"""
    async with uow:
        result = await update_case_handler(case_id, data, uow)
        await uow.commit()
        return result

@router.get("/{case_id}/progress")
async def get_case_progress(
    case_id: str,
    uow: UnitOfWork = Depends(get_uow)
):
    """케이스 진행 현황"""
    async with uow:
        repo = uow.repo(CounselingCaseRepository)
        progress = await repo.get_progress(case_id)
        if not progress:
            raise HTTPException(status_code=404, detail="Case not found")
        return progress
```

#### CounselingSession APIs

```python
@router.post("/sessions/", response_model=CounselingSessionResponse, status_code=201)
async def create_session(
    data: CounselingSessionCreate,
    uow: UnitOfWork = Depends(get_uow)
):
    """방문 기록 생성"""
    async with uow:
        result = await create_session_handler(data, uow)
        await uow.commit()
        return result

@router.get("/cases/{case_id}/sessions", response_model=list[CounselingSessionResponse])
async def get_case_sessions(
    case_id: str,
    session_type: str | None = None,
    uow: UnitOfWork = Depends(get_uow)
):
    """케이스의 방문 기록 목록 (날짜순)"""
    async with uow:
        repo = uow.repo(CounselingSessionRepository)
        sessions = await repo.get_by_case(case_id, session_type)
        return sessions

@router.patch("/sessions/{session_id}", response_model=CounselingSessionResponse)
async def update_session(
    session_id: str,
    data: CounselingSessionUpdate,
    uow: UnitOfWork = Depends(get_uow)
):
    """방문 기록 수정 (상태 변경, 노쇼 처리)"""
    async with uow:
        result = await update_session_handler(session_id, data, uow)
        await uow.commit()
        return result
```

#### FormTemplate APIs

```python
from fastapi import APIRouter, Depends, HTTPException
from app.core.unit_of_work import UnitOfWork, get_uow
from app.modules.counseling.form_template.schemas import (
    FormTemplateCreate,
    FormTemplateUpdate,
    FormTemplateResponse
)

@router.post("/form-templates/", response_model=FormTemplateResponse, status_code=201)
async def create_form_template(
    data: FormTemplateCreate,
    uow: UnitOfWork = Depends(get_uow)
):
    """양식 템플릿 생성"""
    async with uow:
        result = await create_form_template_handler(data, uow)
        await uow.commit()
        return result

@router.get("/centers/{center_id}/form-templates", response_model=list[FormTemplateResponse])
async def get_center_form_templates(
    center_id: str,
    form_type: str | None = None,
    uow: UnitOfWork = Depends(get_uow)
):
    """센터의 양식 템플릿 목록"""
    async with uow:
        repo = uow.repo(FormTemplateRepository)
        if form_type:
            templates = await repo.get_by_center_and_type(center_id, form_type)
        else:
            templates = await repo.get_by_center(center_id)
        return templates

@router.get("/form-templates/{template_id}", response_model=FormTemplateResponse)
async def get_form_template(
    template_id: str,
    uow: UnitOfWork = Depends(get_uow)
):
    """양식 템플릿 상세"""
    async with uow:
        repo = uow.repo(FormTemplateRepository)
        template = await repo.get(template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        return template

@router.patch("/form-templates/{template_id}", response_model=FormTemplateResponse)
async def update_form_template(
    template_id: str,
    data: FormTemplateUpdate,
    uow: UnitOfWork = Depends(get_uow)
):
    """양식 템플릿 수정"""
    async with uow:
        result = await update_form_template_handler(template_id, data, uow)
        await uow.commit()
        return result
```

#### CounselingNote APIs

```python
from app.modules.counseling.note.schemas import (
    CounselingNoteCreate,
    CounselingNoteUpdate,
    CounselingNoteResponse
)

@router.post("/counseling-notes/", response_model=CounselingNoteResponse, status_code=201)
async def create_counseling_note(
    data: CounselingNoteCreate,
    uow: UnitOfWork = Depends(get_uow)
):
    """상담일지 작성"""
    async with uow:
        result = await create_counseling_note_handler(data, uow)
        await uow.commit()
        return result

@router.get("/sessions/{session_id}/note", response_model=CounselingNoteResponse)
async def get_session_note(
    session_id: str,
    uow: UnitOfWork = Depends(get_uow)
):
    """세션의 일지 조회 (1:1)"""
    async with uow:
        repo = uow.repo(CounselingNoteRepository)
        note = await repo.get_by_session(session_id)
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        return note

@router.get("/cases/{case_id}/notes", response_model=list[CounselingNoteResponse])
async def get_case_notes(
    case_id: str,
    uow: UnitOfWork = Depends(get_uow)
):
    """케이스의 모든 일지 조회 (날짜순)"""
    async with uow:
        repo = uow.repo(CounselingNoteRepository)
        notes = await repo.get_by_case(case_id)
        return notes

@router.patch("/counseling-notes/{note_id}", response_model=CounselingNoteResponse)
async def update_counseling_note(
    note_id: str,
    data: CounselingNoteUpdate,
    uow: UnitOfWork = Depends(get_uow)
):
    """상담일지 수정 (초안 검토/수정)"""
    async with uow:
        result = await update_counseling_note_handler(note_id, data, uow)
        await uow.commit()
        return result

@router.post("/documents/{document_id}/ocr", status_code=202)
async def request_document_ocr(
    document_id: str,
    template_id: str,
    uow: UnitOfWork = Depends(get_uow)
):
    """OCR 처리 요청"""
    async with uow:
        result = await request_ocr_handler(document_id, template_id, uow)
        await uow.commit()
        return {"status": "accepted", "ocr_job_id": result}

@router.get("/documents/{document_id}/ocr-status")
async def get_ocr_status(
    document_id: str,
    uow: UnitOfWork = Depends(get_uow)
):
    """OCR 상태 조회"""
    async with uow:
        # Note와 연결된 OCR 상태 조회
        repo = uow.repo(CounselingNoteRepository)
        note = await repo.get_by_source_document(document_id)
        if not note:
            return {"status": "not_started"}
        return {"status": note.ocr_status, "note_id": note.id}
```

### Schemas 추가

#### FormTemplateCreate

```python
from pydantic import BaseModel, Field

class FormTemplateCreate(BaseModel):
    """양식 템플릿 생성 요청"""

    name: str = Field(..., min_length=1, max_length=100)
    form_type: str = Field(..., pattern="^(intake_note|session_note)$")
    description: str | None = Field(None, max_length=500)
    fields: list[dict] = Field(..., min_length=1)
    # 필드 정의 예시:
    # [
    #   {
    #     "name": "chief_complaint",
    #     "type": "textarea",
    #     "label": "주 호소 문제",
    #     "required": true
    #   }
    # ]
```

#### FormTemplateResponse

```python
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class FormTemplateResponse(BaseModel):
    """양식 템플릿 응답"""

    model_config = ConfigDict(from_attributes=True)

    id: str
    center_id: str
    name: str
    form_type: str
    description: str | None
    fields: list[dict]
    is_active: bool
    version: int
    created_at: datetime
    updated_at: datetime
```

#### CounselingNoteCreate

```python
class CounselingNoteCreate(BaseModel):
    """상담일지 작성 요청"""

    counseling_session_id: str = Field(..., description="Session ID")
    template_id: str = Field(..., description="양식 템플릿 ID")
    content: dict = Field(..., description="구조화된 내용")
    # 예: {
    #   "chief_complaint": "우울증, 불안",
    #   "family_history": "부모 이혼 경험"
    # }

    source_document_id: str | None = Field(None, description="원본 문서 ID (OCR 소스)")
    status: str = Field("draft", pattern="^(draft|in_review|completed)$")
```

#### CounselingNoteUpdate

```python
class CounselingNoteUpdate(BaseModel):
    """상담일지 수정 요청"""

    content: dict | None = None
    status: str | None = Field(None, pattern="^(draft|in_review|completed)$")
```

#### CounselingNoteResponse

```python
class CounselingNoteResponse(BaseModel):
    """상담일지 응답"""

    model_config = ConfigDict(from_attributes=True)

    id: str
    center_id: str
    counseling_session_id: str
    template_id: str
    template_name: str  # JOIN 결과

    content: dict
    source_document_id: str | None
    ocr_status: str | None

    status: str
    author_id: str
    author_name: str  # JOIN 결과

    created_at: datetime
    updated_at: datetime
```

---

## 주요 시나리오

### 시나리오 1: 초기상담 (OCR 워크플로우)

```python
# 1. 케이스 생성
case_data = CounselingCaseCreate(
    counseling_id="counseling-uuid",
    title="김철수 우울증 상담",
    client_ids=["client-uuid"],
    counselor_ids=["counselor-uuid"]
)
case = await create_case(case_data)

# 2. 초기상담 예약
intake_data = CounselingSessionCreate(
    counseling_case_id=case.id,
    session_type="intake",
    scheduled_at=datetime(2026, 1, 8, 10, 0)
)
intake = await create_session(intake_data)

# 3. 부모님 작성 기록지 업로드
document = await upload_document(
    entity_type="counseling_session",
    entity_id=intake.id,
    category="intake_source",
    file=uploaded_file
)

# 4. OCR 처리 요청
ocr_job = await request_document_ocr(
    document_id=document.id,
    template_id="intake-template-uuid"
)
# 비동기로 OCR 처리, 완료 시 CounselingNote 초안 자동 생성

# 5. OCR 완료 후 초안 조회
note = await get_session_note(intake.id)
# {
#   "status": "draft",
#   "ocr_status": "completed",
#   "content": {
#     "chief_complaint": "우울증, 불안 (OCR 추출)",
#     "family_history": "부모 이혼 경험 (OCR 추출)"
#   }
# }

# 6. 상담사가 초안 검토 및 수정
await update_counseling_note(note.id, CounselingNoteUpdate(
    content={
        "chief_complaint": "우울증, 불안, 대인관계 어려움",  # 수정됨
        "family_history": "부모 이혼 경험",
        "developmental_history": "정상 발달",
        "counseling_plan": "10회 인지행동치료"
    },
    status="completed"
))

# 7. 초기상담 세션 완료
await update_session(intake.id, CounselingSessionUpdate(
    status="completed",
    completed_at=datetime(2026, 1, 8, 11, 0)
))

# 8. 케이스 요약 정보 업데이트
await update_case(case.id, CounselingCaseUpdate(
    chief_complaint="우울증, 불안, 대인관계 어려움",
    goal="증상 완화 및 사회적 기능 회복",
    total_sessions=10
))
```

### 시나리오 2: 정규상담 (일지 작성)

```python
# 1. 정규상담 예약
regular_data = CounselingSessionCreate(
    counseling_case_id=case.id,
    session_type="regular",
    scheduled_at=datetime(2026, 1, 15, 14, 0)
)
regular = await create_session(regular_data)

# 2. 상담 진행 후 세션 완료
await update_session(regular.id, CounselingSessionUpdate(
    status="completed",
    completed_at=datetime(2026, 1, 15, 15, 0)
))

# 3. 상담일지 작성
note_data = CounselingNoteCreate(
    counseling_session_id=regular.id,
    template_id="session-note-template-uuid",
    content={
        "session_content": "인지 왜곡 패턴에 대해 다룸. 자동적 사고 기록 연습.",
        "client_response": "내담자가 자신의 사고 패턴 인식하기 시작",
        "interventions": "인지 재구조화 기법 소개",
        "homework": "생각 기록지 작성 (일주일간)",
        "next_plan": "다음 회기에 기록지 검토 및 피드백"
    },
    status="completed"
)
note = await create_counseling_note(note_data)

# 4. 방문 기록 및 일지 조회
sessions = await get_case_sessions(case.id)
notes = await get_case_notes(case.id)
# 날짜순으로 정렬되어 전체 상담 흐름 확인 가능
```

### 시나리오 3: 노쇼 발생 및 재예약

```python
# 1. 정규상담 예약
session = await create_session(CounselingSessionCreate(
    counseling_case_id=case.id,
    session_type="regular",
    scheduled_at=datetime(2026, 1, 22, 14, 0)
))

# 2. 노쇼 발생
await update_session(session.id, CounselingSessionUpdate(
    status="no_show"
))

# 3. 재예약 (새 Session 생성)
new_session = await create_session(CounselingSessionCreate(
    counseling_case_id=case.id,
    session_type="regular",
    scheduled_at=datetime(2026, 1, 29, 15, 0)
))

# 4. 방문 기록 조회 (날짜순)
sessions = await get_case_sessions(case.id)
# [
#   {..., scheduled_at: "2026-01-08", session_type: "intake", status: "completed"},
#   {..., scheduled_at: "2026-01-15", session_type: "regular", status: "completed"},
#   {..., scheduled_at: "2026-01-22", session_type: "regular", status: "no_show"},
#   {..., scheduled_at: "2026-01-29", session_type: "regular", status: "scheduled"}
# ]
```

### 시나리오 4: 회기 수 도달 시 경고

```python
# 1. 10회 계획 케이스 조회
case = await get_case(case_id)
# total_sessions = 10

# 2. 진행 현황
progress = await get_case_progress(case_id)
# {
#   "total_sessions_planned": 10,
#   "completed": 10,
#   "regular_completed": 10,
#   "remaining": 0
# }

# 3. 케이스 응답에 경고 메시지
case_response = CounselingCaseResponse.model_validate(case)
print(case_response.session_warning)
# "계획된 회기 수(10회)에 도달했습니다"

# 4. 회기 수 연장
await update_case(case_id, CounselingCaseUpdate(
    total_sessions=15
))

# 5. 11회기 예약 (차단하지 않음)
session_11 = await create_session(CounselingSessionCreate(
    counseling_case_id=case_id,
    session_type="regular",
    scheduled_at=datetime(2026, 3, 5, 14, 0)
))
```

### 시나리오 5: 일정 변경

```python
# 1. 기존 예약 취소
await update_session(session_id, CounselingSessionUpdate(
    status="cancelled"
))

# 2. 새 일정으로 예약 (새 Session 생성)
new_session = await create_session(CounselingSessionCreate(
    counseling_case_id=case.id,
    session_type="regular",
    scheduled_at=datetime(2026, 2, 10, 16, 0)  # 변경된 일시
))

# 3. 날짜순 정렬로 자동 순서 정리
sessions = await get_case_sessions(case.id)
# 날짜 기반이므로 자동으로 올바른 순서
```

---

## 마이그레이션 계획

### Phase 1: CounselingCase 필드 추가

```python
"""add title, chief_complaint, goal to counseling_cases

Revision ID: xxxx
Revises: yyyy
"""
from alembic import op
import sqlalchemy as sa

def upgrade():
    # 1. 컬럼 추가 (임시 기본값)
    op.add_column(
        'counseling_cases',
        sa.Column('title', sa.String(200), nullable=False, server_default='')
    )
    op.add_column(
        'counseling_cases',
        sa.Column('chief_complaint', sa.Text(), nullable=True)
    )
    op.add_column(
        'counseling_cases',
        sa.Column('goal', sa.Text(), nullable=True)
    )

    # 2. 기존 데이터 title 자동 생성
    op.execute("""
        UPDATE counseling_cases
        SET title = CONCAT(
            (SELECT name FROM counselings WHERE id = counseling_cases.counseling_id),
            ' #',
            ROW_NUMBER() OVER (PARTITION BY center_id ORDER BY created_at)
        )
        WHERE title = ''
    """)

    # 3. 기본값 제거
    op.alter_column('counseling_cases', 'title', server_default=None)

def downgrade():
    op.drop_column('counseling_cases', 'goal')
    op.drop_column('counseling_cases', 'chief_complaint')
    op.drop_column('counseling_cases', 'title')
```

### Phase 2: CounselingSession 필드 추가

```python
"""add session_type to counseling_sessions

Revision ID: zzzz
Revises: xxxx
"""
from alembic import op
import sqlalchemy as sa

def upgrade():
    # 1. session_type 컬럼 추가 (기본값: regular)
    op.add_column(
        'counseling_sessions',
        sa.Column('session_type', sa.String(20), nullable=False, server_default='regular')
    )

    # 2. 인덱스 추가
    op.create_index(
        'ix_counseling_sessions_session_type',
        'counseling_sessions',
        ['session_type']
    )

    op.create_index(
        'ix_counseling_sessions_case_type',
        'counseling_sessions',
        ['counseling_case_id', 'session_type']
    )

    # 3. 기본값 제거
    op.alter_column('counseling_sessions', 'session_type', server_default=None)

def downgrade():
    op.drop_index('ix_counseling_sessions_case_type')
    op.drop_index('ix_counseling_sessions_session_type')
    op.drop_column('counseling_sessions', 'session_type')
```

### Phase 3: session_number 제거 (선택적)

```python
"""remove session_number from counseling_sessions

Revision ID: aaaa
Revises: zzzz
"""
from alembic import op
import sqlalchemy as sa

def upgrade():
    # 1. 데이터 검증 (session_number 사용 여부 확인)
    # 실제 운영 환경에서는 충분한 검증 후 진행

    # 2. session_number 관련 인덱스 제거
    op.drop_index('ix_counseling_sessions_case_number', 'counseling_sessions')

    # 3. session_number 컬럼 제거
    op.drop_column('counseling_sessions', 'session_number')

def downgrade():
    op.add_column(
        'counseling_sessions',
        sa.Column('session_number', sa.Integer(), nullable=False)
    )
    op.create_index(
        'ix_counseling_sessions_case_number',
        'counseling_sessions',
        ['counseling_case_id', 'session_number'],
        unique=True
    )
```

### Phase 4: FormTemplate 및 CounselingNote 테이블 추가

```python
"""add form_templates and counseling_notes tables

Revision ID: bbbb
Revises: aaaa
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

def upgrade():
    # 1. form_templates 테이블 생성
    op.create_table(
        'form_templates',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('center_id', sa.String(36), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('form_type', sa.String(20), nullable=False),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('fields', JSONB, nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('version', sa.Integer(), nullable=False, default=1),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False)
    )

    # form_templates 인덱스
    op.create_index('ix_form_templates_center', 'form_templates', ['center_id'])
    op.create_index('ix_form_templates_center_type', 'form_templates', ['center_id', 'form_type'])
    op.create_index('ix_form_templates_active', 'form_templates', ['is_active'])

    # 2. counseling_notes 테이블 생성
    op.create_table(
        'counseling_notes',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('center_id', sa.String(36), nullable=False),
        sa.Column('counseling_session_id', sa.String(36), nullable=False, unique=True),
        sa.Column('template_id', sa.String(36), nullable=False),
        sa.Column('content', JSONB, nullable=False),
        sa.Column('source_document_id', sa.String(36), nullable=True),
        sa.Column('ocr_status', sa.String(20), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, default='draft'),
        sa.Column('author_id', sa.String(36), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False)
    )

    # counseling_notes 인덱스
    op.create_index('ix_counseling_notes_center', 'counseling_notes', ['center_id'])
    op.create_index('ix_counseling_notes_session', 'counseling_notes', ['counseling_session_id'])
    op.create_index('ix_counseling_notes_template', 'counseling_notes', ['template_id'])
    op.create_index('ix_counseling_notes_status', 'counseling_notes', ['status'])

def downgrade():
    op.drop_table('counseling_notes')
    op.drop_table('form_templates')
```

---

## 확장 고려사항

### 1. Center Settings 통합

센터별 운영 정책 설정:

```python
class CenterSettings(Base):
    """센터별 상담 운영 설정"""

    # 초기상담을 계약 회기에 포함할지
    include_intake_in_contract: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False
    )

    # 노쇼 결제 정책
    charge_for_no_show: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False
    )
```

### 2. Billing 도메인 연동

결제/청구는 별도 도메인에서 관리:

```python
class CounselingBilling(Base):
    """상담 결제 기록"""
    counseling_session_id: Mapped[str]
    amount: Mapped[int]
    payment_status: Mapped[str]
```

### 3. Document 도메인 연동

부모님 작성 초기상담 기록지 원본 저장:

```python
# Document 생성 (부모님 작성 기록지 스캔본)
document = Document(
    entity_type="counseling_session",
    entity_id=session.id,
    category="intake_source",  # 초기상담 원본
    file_path="..."
)

# CounselingNote에서 참조
note = CounselingNote(
    counseling_session_id=session.id,
    source_document_id=document.id,  # 원본 문서 참조
    ocr_status="pending",
    content={}  # OCR 완료 후 채워짐
)
```

### 4. OCR 서비스 연동

비동기 OCR 처리 워크플로우:

```python
# 1. OCR 요청
ocr_job_id = await ocr_service.request_ocr(
    document_id=document.id,
    template_id=template.id,
    language="ko"
)

# 2. OCR 완료 시 Webhook 처리
@app.post("/webhooks/ocr-completed")
async def handle_ocr_completed(
    document_id: str,
    extracted_data: dict
):
    # CounselingNote 초안 생성
    note = CounselingNote(
        counseling_session_id=session_id,
        template_id=template_id,
        content=extracted_data,  # OCR 결과
        source_document_id=document_id,
        ocr_status="completed",
        status="draft",
        author_id=counselor_id
    )
```

### 5. 센터별 양식 관리

센터 관리자가 직접 양식 정의:

```python
# 초기상담 기록지 템플릿 생성
template = FormTemplate(
    center_id=center.id,
    name="초기상담 기록지 v2.0",
    form_type="intake_note",
    fields=[
        {
            "name": "chief_complaint",
            "type": "textarea",
            "label": "주 호소 문제",
            "required": True,
            "rows": 4
        },
        {
            "name": "family_structure",
            "type": "text",
            "label": "가족 구성",
            "required": True
        },
        {
            "name": "risk_level",
            "type": "select",
            "label": "위험도",
            "required": True,
            "options": ["낮음", "중간", "높음", "긴급"]
        }
    ],
    version=2
)
```

---

## V1 → V2 주요 변경 사항 요약

| 항목 | V1 | V2 |
|------|----|----|
| **케이스 식별** | counseling_id만 | title, chief_complaint, goal 추가 |
| **초기상담 관리** | 별도 처리 불명확 | session_type으로 통합 관리 |
| **회기 번호** | session_number 필드 | ❌ 제거, 날짜 기반 정렬 |
| **진행 현황** | session_number 기반 | 완료 횟수 동적 계산 |
| **노쇼 처리** | 번호 유지/재할당 복잡 | 상태만 변경, 단순 |
| **일정 변경** | 번호 관리 복잡 | 새 Session 생성, 날짜 정렬 |
| **정렬 기준** | session_number | scheduled_at (날짜/시간) |
| **상담일지 관리** | Document 파일 첨부만 | ✅ FormTemplate + CounselingNote (구조화) |
| **초기상담 기록** | 파일 첨부만 | ✅ OCR → 초안 → 상담사 수정 |
| **센터별 양식** | 없음 | ✅ FormTemplate로 커스텀 양식 정의 |

---

## 장점 요약

### 1. 단순성
- 회기 번호 없이 날짜로만 관리 → 로직 단순화
- 노쇼/취소 시 상태만 변경 → 복잡한 재할당 불필요

### 2. 유연성
- 일정 변경: 새 Session 생성만으로 처리
- 센터별 정책: CenterSettings로 다양한 운영 방식 지원

### 3. 확장성
- **센터별 커스텀**: FormTemplate로 양식 자유 정의
- **구조화된 데이터**: JSONB로 유연한 필드 관리
- **OCR 통합**: 비동기 OCR 워크플로우
- **Billing 연동**: 결제는 별도 도메인에서 관리
- **Schedule 연동**: ScheduledRelation으로 유연한 연결

### 4. 실무 적합성
- **초기상담 통합**: session_type으로 명확히 구분
- **진행 현황 계산**: 완료/노쇼 횟수 실시간 집계
- **경고 표시**: 회기 수 도달 시 경고, 차단하지 않음
- **구조화된 조회**: 파일이 아닌 화면에서 필드별 조회
- **OCR 자동화**: 부모님 기록지 → OCR → 초안 자동 생성

---

## 결론

**Domain V2**는 실제 상담센터 운영 흐름에 맞춰 설계되었습니다:

### 핵심 개선사항
1. **회기 번호 제거** → 노쇼/취소/변경 시 복잡도 급감
2. **날짜 기반 정렬** → 자연스러운 순서 관리
3. **초기상담 통합** → session_type으로 명확한 구분
4. **구조화된 일지** → FormTemplate + CounselingNote로 화면 조회
5. **OCR 워크플로우** → 부모님 기록지 자동 처리

### 실무 적합성
- ✅ 초기상담: 부모님 기록지 → OCR → 초안 → 상담사 수정
- ✅ 정규상담: 상담사가 구조화된 양식에 직접 작성
- ✅ 센터별 커스텀: 양식 필드를 센터가 직접 정의
- ✅ 구조화된 조회: 파일이 아닌 화면에서 필드별로 확인

이 설계는 **단순함**, **유연성**, **확장성**, **실무 적합성**을 모두 갖추고 있으며, 향후 다양한 센터 운영 방식에 대응할 수 있습니다.

---

## 짝 치료 및 그룹 상담 설계

### 설계 원칙

**핵심 원칙**: **1 Case = 1 Counselor + 1 Client + 1 Billing Unit**

짝 치료나 그룹 상담에서도 각 상담사-내담자 조합은 **개별 케이스**로 관리됩니다.

### 7. PairedCaseGroup (짝 치료 그룹)

짝 치료 시 2~3쌍의 케이스를 연결하는 메타데이터.

```python
from sqlalchemy import String, JSONB, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from uuid import uuid4
from app.core.database import Base

class PairedCaseGroup(Base):
    """
    짝 치료 그룹 엔티티
    - 2~3쌍의 케이스 연결 (메타데이터)
    - 각 케이스는 독립적으로 유지
    - 일괄 세션 생성 기준
    """
    __tablename__ = "paired_case_groups"

    # Primary Key
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4())
    )

    # 멀티테넌시
    center_id: Mapped[str] = mapped_column(
        String(36),
        nullable=False,
        index=True
    )

    # 그룹 정보
    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False
    )
    # 예: "사회화 짝 치료 A조"

    # 연결된 케이스들
    case_ids: Mapped[list] = mapped_column(
        JSONB,
        nullable=False
    )
    # ["case-001", "case-002", "case-003"]

    # 편성 정보
    paired_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False
    )

    created_by: Mapped[str] = mapped_column(
        String(36),
        nullable=False
    )
    # 편성한 사람 (상담사 또는 센터장)

    # 상태
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="ACTIVE",
        index=True
    )
    # ACTIVE, DISBANDED

    disbanded_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

    # 타임스탬프
    created_at: Mapped[datetime] = mapped_column(
        nullable=False,
        default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # Indexes
    __table_args__ = (
        Index("ix_paired_case_groups_center", "center_id"),
        Index("ix_paired_case_groups_status", "status"),
    )
```

**필드 설명**:

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK | 그룹 고유 ID |
| `center_id` | UUID | NOT NULL, IDX | 센터 ID |
| `name` | String(200) | NOT NULL | 그룹명 |
| `case_ids` | JSONB | NOT NULL | 연결된 케이스 ID 목록 |
| `paired_at` | DateTime | NOT NULL | 편성 일시 |
| `created_by` | UUID | NOT NULL | 편성자 ID |
| `status` | String(20) | NOT NULL, IDX | 그룹 상태 (ACTIVE/DISBANDED) |
| `disbanded_at` | DateTime | NULL | 해체 일시 |

---

### 8. GroupCaseCluster (그룹 상담 클러스터)

그룹 상담 시 여러 케이스를 클러스터링하는 메타데이터.

```python
from sqlalchemy import String, Integer, JSONB, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from uuid import uuid4
from app.core.database import Base

class GroupCaseCluster(Base):
    """
    그룹 상담 클러스터 엔티티
    - 여러 케이스를 그룹으로 연결 (메타데이터)
    - 각 케이스는 독립적으로 유지
    - 메인 상담사 + 보조 상담사 관리
    """
    __tablename__ = "group_case_clusters"

    # Primary Key
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4())
    )

    # 멀티테넌시
    center_id: Mapped[str] = mapped_column(
        String(36),
        nullable=False,
        index=True
    )

    # 그룹 정보
    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False
    )
    # 예: "사회성 그룹 A반"

    # 연결된 케이스들
    case_ids: Mapped[list] = mapped_column(
        JSONB,
        nullable=False
    )
    # ["case-101", "case-102", "case-103", ...]

    # 상담사 정보
    main_counselor_id: Mapped[str] = mapped_column(
        String(36),
        nullable=False
    )
    # 메인 상담사

    assistant_counselor_ids: Mapped[list | None] = mapped_column(
        JSONB,
        nullable=True
    )
    # 보조 상담사 목록 (선택적)

    # 그룹 설정
    max_participants: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=8
    )

    # 편성 정보
    formed_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False
    )

    created_by: Mapped[str] = mapped_column(
        String(36),
        nullable=False
    )
    # 편성한 사람 (센터장 또는 상담사)

    # 상태
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="ACTIVE",
        index=True
    )
    # ACTIVE, COMPLETED

    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

    # 타임스탬프
    created_at: Mapped[datetime] = mapped_column(
        nullable=False,
        default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # Indexes
    __table_args__ = (
        Index("ix_group_case_clusters_center", "center_id"),
        Index("ix_group_case_clusters_status", "status"),
        Index("ix_group_case_clusters_main_counselor", "main_counselor_id"),
    )
```

**필드 설명**:

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK | 클러스터 고유 ID |
| `center_id` | UUID | NOT NULL, IDX | 센터 ID |
| `name` | String(200) | NOT NULL | 그룹명 |
| `case_ids` | JSONB | NOT NULL | 연결된 케이스 ID 목록 |
| `main_counselor_id` | UUID | NOT NULL, IDX | 메인 상담사 ID |
| `assistant_counselor_ids` | JSONB | NULL | 보조 상담사 ID 목록 |
| `max_participants` | Integer | NOT NULL | 최대 참여 인원 |
| `formed_at` | DateTime | NOT NULL | 편성 일시 |
| `created_by` | UUID | NOT NULL | 편성자 ID |
| `status` | String(20) | NOT NULL, IDX | 클러스터 상태 |

---

### 권한 모델

#### 케이스 조회 권한 레벨

| 레벨 | 조회 범위 | 데이터 | 권한 |
|------|----------|--------|------|
| **기본 정보 조회** | 센터 전체 케이스 | 제목, 내담자명, 담당 상담사, 상태 | 같은 센터 상담사 |
| **상세 정보 조회** | 본인 참여 케이스 | 상담 기록, 일지, 진행 현황 | 해당 케이스 참여자 |
| **전체 조회** | 센터 전체 케이스 (상세) | 모든 정보 | 센터장, 관리자 |

#### 편성 권한

| 작업 | 권한 | 조건 |
|------|------|------|
| **짝 치료 편성** | 관련 상담사들, 센터장 | case_ids의 모든 케이스에 참여 중인 상담사 |
| **그룹 편성** | 센터장, 프로그램 담당자 | - |
| **편성 해체** | 편성한 사람, 센터장 | - |

#### 케이스 조회 API

**기본 정보 조회** (센터 전체):
```python
GET /centers/{center_id}/counseling-cases?level=basic
Authorization: Bearer {counselor_token}

Response:
[
  {
    "id": "case-001",
    "title": "김철수 놀이치료",
    "client_name": "김철수",
    "counselor_name": "박상담사",
    "status": "ACTIVE",
    "created_at": "2026-01-10T10:00:00Z"
  },
  {
    "id": "case-002",
    "title": "이영희 놀이치료",
    "client_name": "이영희",
    "counselor_name": "최상담사",
    "status": "ACTIVE",
    "created_at": "2026-01-12T10:00:00Z"
  }
]
```

**본인 케이스 상세 조회**:
```python
GET /members/{member_id}/counseling-cases
Authorization: Bearer {counselor_token}

Response:
[
  {
    "id": "case-001",
    "title": "김철수 놀이치료",
    "chief_complaint": "우울증, 불안, 대인관계 어려움",
    "goal": "증상 완화",
    "session_count": 5,
    "total_sessions": 10,
    # ... 전체 상세 정보
  }
]
```

---

### 짝 치료 워크플로우

#### 1. 개인 상담 진행 중

```
case-001: 김철수 - 박상담사 - 개인 놀이치료 (5회 완료)
case-002: 이영희 - 최상담사 - 개인 놀이치료 (3회 완료)
```

#### 2. 상담사들 협의

**박상담사**:
```python
# 센터 전체 케이스 기본 정보 조회
GET /centers/{center_id}/counseling-cases?level=basic

Response:
[
  {"id": "case-001", "client_name": "김철수", "counselor_name": "박상담사"},
  {"id": "case-002", "client_name": "이영희", "counselor_name": "최상담사"},
  # ... 다른 케이스들
]

# 박상담사: "이영희도 사회화 훈련이 필요할 것 같은데..."
# → 최상담사에게 연락 (전화/메신저)
```

**최상담사**: "좋습니다, 짝 치료로 진행하죠"

#### 3. 짝 치료 그룹 생성

**박상담사 또는 최상담사**가 생성:

```python
POST /paired-case-groups
Authorization: Bearer {counselor_token}
{
  "name": "사회화 짝 치료 A조",
  "case_ids": ["case-001", "case-002"]
}

# Backend 권한 검증:
# - 요청자가 case-001 또는 case-002의 참여자인가?
# - case_ids의 모든 케이스가 ACTIVE 상태인가?
# - 요청자가 센터장인가? (센터장은 모든 편성 가능)
```

**Database State**:
```sql
paired_case_groups:
  paired-group-001:
    name: "사회화 짝 치료 A조"
    case_ids: ["case-001", "case-002"]
    created_by: "counselor-park"
    status: ACTIVE

-- 개별 케이스는 그대로 유지
counseling_cases:
  case-001: status=ACTIVE (변경 없음)
  case-002: status=ACTIVE (변경 없음)
```

#### 4. 짝 치료 세션 예약

```python
POST /paired-case-groups/{group_id}/sessions
Authorization: Bearer {counselor_token}
{
  "scheduled_at": "2026-01-25T14:00:00Z",
  "duration_minutes": 60,
  "location": "놀이치료실 2"
}

# Backend Handler:
async def create_paired_session_handler(group_id, data, uow):
    async with uow:
        # 1. 그룹 조회
        group = await paired_group_repo.get(group_id)
        case_ids = group.case_ids  # ["case-001", "case-002"]

        # 2. 공통 일정 생성 (Schedule)
        schedule = await schedule_repo.create({
            "scheduled_at": data.scheduled_at,
            "duration_minutes": data.duration_minutes,
            "location": data.location
        })

        # 3. 각 케이스별 세션 생성
        for case_id in case_ids:
            session = await session_repo.create({
                "counseling_case_id": case_id,
                "session_type": "regular",
                "status": "SCHEDULED",
                "scheduled_at": data.scheduled_at
            })

            # 4. Schedule과 Session 연결
            await scheduled_relation_repo.create({
                "schedule_id": schedule.id,
                "counseling_session_id": session.id
            })

        await uow.commit()
```

**결과**:
- Schedule 1개 (공통 일정)
- Session 2개 (각 케이스별)
- ScheduledRelation 2개 (연결)

#### 5. 상담 진행 및 기록

**박상담사**:
```python
# 본인 케이스만 조회
GET /members/{counselor-park}/counseling-cases

Response: [case-001]  # case-002는 안 보임

# session-101 기록 작성 (김철수)
POST /counseling-sessions/session-101/notes
{
  "template_id": "session-note-template",
  "content": {
    "activity": "블록 쌓기",
    "peer_interaction": "이영희와 협력하여 성 만들기 성공",
    "progress": "타인과 협력하는 능력 향상됨"
  },
  "status": "completed"
}
```

**최상담사**:
```python
# 본인 케이스만 조회
GET /members/{counselor-choi}/counseling-cases

Response: [case-002]  # case-001은 안 보임

# session-102 기록 작성 (이영희)
POST /counseling-sessions/session-102/notes
{
  "template_id": "session-note-template",
  "content": {
    "activity": "블록 쌓기",
    "peer_interaction": "김철수와 협력 시도",
    "progress": "또래 관계 형성 능력 향상"
  },
  "status": "completed"
}
```

**권한 분리**:
- 박상담사는 case-001(김철수) 기록만 작성/조회
- 최상담사는 case-002(이영희) 기록만 작성/조회
- 서로의 상세 기록은 볼 수 없음

#### 6. 청구 생성

```python
# 월말 자동 청구 (케이스별로 독립적)
invoice-001:
  client_id: "client-kim"
  case_id: "case-001"
  sessions: 4회 (짝 치료 포함)
  total_amount: 480,000원

invoice-002:
  client_id: "client-lee"
  case_id: "case-002"
  sessions: 4회 (짝 치료 포함)
  total_amount: 480,000원
```

---

### 그룹 상담 워크플로우

#### 1. 그룹 프로그램 모집

```
센터장: "사회성 그룹 3월반 모집" 공지
→ 5명 신청

접수 담당자:
  - Client 5명 등록
  - CounselingCase 5개 생성 (각 아동별로)
    case-101: 아동A - 박상담사(메인)
    case-102: 아동B - 박상담사(메인)
    case-103: 아동C - 박상담사(메인)
    case-104: 아동D - 박상담사(메인)
    case-105: 아동E - 박상담사(메인)
```

#### 2. 그룹 편성 (센터장)

```python
POST /group-case-clusters
Authorization: Bearer {director_token}
{
  "name": "사회성 그룹 A반",
  "case_ids": ["case-101", "case-102", "case-103", "case-104", "case-105"],
  "main_counselor_id": "counselor-park",
  "assistant_counselor_ids": ["assistant-kim"],
  "max_participants": 8
}

# 권한 검증:
# - 요청자가 센터장 또는 관리자인가?
# - 모든 case_ids가 같은 센터인가?
# - main_counselor_id가 유효한가?
```

#### 3. 그룹 세션 예약

```python
POST /group-case-clusters/{cluster_id}/sessions
{
  "scheduled_at": "2026-01-25T15:00:00Z",
  "duration_minutes": 90,
  "location": "그룹상담실"
}

# Backend: 5개의 개별 Session 생성 (각 케이스별)
# + 1개의 공통 Schedule
# + 5개의 ScheduledRelation
```

#### 4. 상담 진행 (출석 체크)

```python
# 박상담사 (메인): 그룹 세션 화면
GET /group-case-clusters/{cluster_id}/sessions/{schedule_id}

Response:
{
  "schedule_id": "schedule-301",
  "participants": [
    {
      "case_id": "case-101",
      "session_id": "session-201",
      "client_name": "아동A",
      "status": "SCHEDULED"
    },
    # ... 5명
  ]
}

# 출석 체크 (개별 Session 상태 업데이트)
PATCH /counseling-sessions/session-201 { "status": "COMPLETED" }
PATCH /counseling-sessions/session-202 { "status": "COMPLETED" }
PATCH /counseling-sessions/session-203 { "status": "COMPLETED" }
PATCH /counseling-sessions/session-204 { "status": "NO_SHOW" }  # 아동D 결석
PATCH /counseling-sessions/session-205 { "status": "COMPLETED" }
```

#### 5. 개별 기록 작성

```python
# 박상담사가 각 아동별로 개별 기록 작성

# 아동A 기록
POST /counseling-sessions/session-201/notes
{
  "template_id": "group-session-template",
  "content": {
    "attendance": "출석",
    "mood": "밝음",
    "group_activity": "역할극 - 친구 사귀기",
    "individual_behavior": "적극적으로 참여",
    "peer_interaction": "모든 친구들과 원활하게 소통",
    "progress": "리더십 발휘"
  }
}

# 아동B 기록
POST /counseling-sessions/session-202/notes
{
  "template_id": "group-session-template",
  "content": {
    "attendance": "출석",
    "mood": "약간 긴장",
    "group_activity": "역할극 - 친구 사귀기",
    "individual_behavior": "처음에는 소극적",
    "peer_interaction": "아동A, 아동C와 주로 상호작용",
    "progress": "점차 자신감 향상"
  }
}

# ... 아동C, 아동E도 동일하게 개별 기록

# 아동D (결석)
POST /counseling-sessions/session-204/notes
{
  "template_id": "group-session-template",
  "content": {
    "attendance": "결석",
    "absence_reason": "감기로 인한 결석",
    "followup_plan": "다음 회기 전 개별 연락 예정"
  }
}
```

**핵심**: 그룹 활동은 같지만, 각 아동별로 개별 기록 작성

#### 6. 청구 생성 (개별)

```python
# 월말 자동 청구 (케이스별로 독립적)
invoice-101: case-101, 4회 완료, 320,000원
invoice-102: case-102, 4회 완료, 320,000원
invoice-103: case-103, 4회 완료, 320,000원
invoice-104: case-104, 3회 완료, 240,000원  # 결석 1회 제외
invoice-105: case-105, 4회 완료, 320,000원
```

---

### API 설계 (추가)

#### PairedCaseGroup APIs

```python
from fastapi import APIRouter, Depends, HTTPException
from app.core.unit_of_work import UnitOfWork, get_uow

@router.post("/paired-case-groups/", status_code=201)
async def create_paired_group(
    data: PairedCaseGroupCreate,
    current_user: Member = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow)
):
    """짝 치료 그룹 생성 (상담사들 협의 후)"""
    async with uow:
        # 권한 검증
        case_repo = uow.repo(CounselingCaseRepository)
        participant_repo = uow.repo(CounselingCaseParticipantRepository)

        # 1. 요청자가 센터장인가?
        if current_user.role == "DIRECTOR":
            # 센터장은 모든 편성 가능
            pass
        else:
            # 2. 요청자가 모든 케이스의 참여자인가?
            for case_id in data.case_ids:
                is_participant = await participant_repo.is_participant(
                    case_id, current_user.id
                )
                if not is_participant:
                    raise HTTPException(
                        status_code=403,
                        detail=f"Case {case_id}에 참여하지 않은 상담사는 편성할 수 없습니다"
                    )

        # 3. 그룹 생성
        result = await create_paired_group_handler(data, current_user.id, uow)
        await uow.commit()
        return result

@router.post("/paired-case-groups/{group_id}/sessions", status_code=201)
async def create_paired_session(
    group_id: str,
    data: PairedSessionCreate,
    uow: UnitOfWork = Depends(get_uow)
):
    """짝 치료 세션 일괄 생성"""
    async with uow:
        result = await create_paired_session_handler(group_id, data, uow)
        await uow.commit()
        return result

@router.patch("/paired-case-groups/{group_id}", status_code=200)
async def disband_paired_group(
    group_id: str,
    data: PairedCaseGroupUpdate,
    uow: UnitOfWork = Depends(get_uow)
):
    """짝 치료 그룹 해체"""
    async with uow:
        result = await disband_paired_group_handler(group_id, data, uow)
        await uow.commit()
        return result

@router.get("/centers/{center_id}/paired-case-groups")
async def get_paired_groups(
    center_id: str,
    uow: UnitOfWork = Depends(get_uow)
):
    """센터의 짝 치료 그룹 목록"""
    async with uow:
        repo = uow.repo(PairedCaseGroupRepository)
        groups = await repo.get_by_center(center_id, status="ACTIVE")
        return groups
```

#### GroupCaseCluster APIs

```python
@router.post("/group-case-clusters/", status_code=201)
async def create_group_cluster(
    data: GroupCaseClusterCreate,
    current_user: Member = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow)
):
    """그룹 상담 편성 (센터장 또는 프로그램 담당자)"""
    async with uow:
        # 권한 검증
        if current_user.role not in ["DIRECTOR", "ADMIN"]:
            raise HTTPException(status_code=403, detail="권한이 없습니다")

        result = await create_group_cluster_handler(data, current_user.id, uow)
        await uow.commit()
        return result

@router.post("/group-case-clusters/{cluster_id}/sessions", status_code=201)
async def create_group_session(
    cluster_id: str,
    data: GroupSessionCreate,
    uow: UnitOfWork = Depends(get_uow)
):
    """그룹 세션 일괄 생성"""
    async with uow:
        result = await create_group_session_handler(cluster_id, data, uow)
        await uow.commit()
        return result

@router.get("/group-case-clusters/{cluster_id}/sessions/{schedule_id}")
async def get_group_session_participants(
    cluster_id: str,
    schedule_id: str,
    uow: UnitOfWork = Depends(get_uow)
):
    """그룹 세션 참여자 목록 (출석 체크용)"""
    async with uow:
        repo = uow.repo(GroupCaseClusterRepository)
        participants = await repo.get_session_participants(cluster_id, schedule_id)
        return participants

@router.patch("/group-case-clusters/{cluster_id}")
async def update_group_cluster(
    cluster_id: str,
    data: GroupCaseClusterUpdate,
    uow: UnitOfWork = Depends(get_uow)
):
    """그룹 편성 수정 (참여자 추가/제거)"""
    async with uow:
        result = await update_group_cluster_handler(cluster_id, data, uow)
        await uow.commit()
        return result
```

#### 케이스 조회 API (레벨별)

```python
@router.get("/centers/{center_id}/counseling-cases")
async def get_center_cases(
    center_id: str,
    level: str = "basic",  # "basic" | "detailed"
    current_user: Member = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow)
):
    """
    센터 케이스 목록 조회
    - level=basic: 기본 정보만 (제목, 내담자명, 상담사명, 상태)
    - level=detailed: 상세 정보 (센터장/관리자만)
    """
    async with uow:
        repo = uow.repo(CounselingCaseRepository)

        if level == "basic":
            # 같은 센터 상담사는 기본 정보 조회 가능
            cases = await repo.get_basic_info_by_center(center_id)
            return cases

        elif level == "detailed":
            # 센터장/관리자만 상세 정보 조회
            if current_user.role not in ["DIRECTOR", "ADMIN"]:
                raise HTTPException(status_code=403, detail="권한이 없습니다")

            cases = await repo.get_by_center(center_id)
            return cases

@router.get("/members/{member_id}/counseling-cases")
async def get_member_cases(
    member_id: str,
    current_user: Member = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow)
):
    """본인 케이스 목록 (상세 정보 포함)"""
    # 본인 또는 관리자만 조회 가능
    if current_user.id != member_id and current_user.role not in ["DIRECTOR", "ADMIN"]:
        raise HTTPException(status_code=403, detail="권한이 없습니다")

    async with uow:
        repo = uow.repo(CounselingCaseRepository)
        cases = await repo.get_by_participant(member_id)
        return cases
```

---

### Schemas (추가)

#### PairedCaseGroupCreate

```python
from pydantic import BaseModel, Field

class PairedCaseGroupCreate(BaseModel):
    """짝 치료 그룹 생성 요청"""

    name: str = Field(..., min_length=1, max_length=200)
    case_ids: list[str] = Field(..., min_length=2, max_length=3)
    # 2~3쌍
```

#### GroupCaseClusterCreate

```python
class GroupCaseClusterCreate(BaseModel):
    """그룹 상담 편성 요청"""

    name: str = Field(..., min_length=1, max_length=200)
    case_ids: list[str] = Field(..., min_length=3)
    main_counselor_id: str
    assistant_counselor_ids: list[str] | None = None
    max_participants: int = Field(8, ge=3, le=15)
```

#### CaseBasicInfo

```python
class CaseBasicInfo(BaseModel):
    """케이스 기본 정보 (센터 전체 조회용)"""

    id: str
    title: str
    client_name: str  # JOIN Person
    counselor_name: str  # JOIN Member
    status: str
    created_at: datetime
```

---

### 연결 테이블의 역할

#### PairedCaseGroup 역할

```yaml
목적:
  - "이 케이스들은 짝 치료로 함께 진행됩니다" 메타데이터
  - 일괄 세션 생성 기준
  - UI 필터링 ("짝 치료 목록 보기")

사용:
  - 짝 치료 세션 예약 시 → group의 모든 case_ids에 세션 생성
  - 짝 치료 해체 → group status = DISBANDED

안 하는 것:
  - ❌ 청구 (각 케이스별로 독립)
  - ❌ 기록 작성 (각 상담사별로 독립)
  - ❌ 권한 관리 (각 케이스 참여자별로)
```

#### GroupCaseCluster 역할

```yaml
목적:
  - "이 케이스들은 같은 그룹입니다" 메타데이터
  - 일괄 세션 생성 기준
  - 보조 상담사 정보 저장

사용:
  - 그룹 세션 예약 시 → cluster의 모든 case_ids에 세션 생성
  - 참여자 추가/제거 → cluster.case_ids 수정

안 하는 것:
  - ❌ 개별 출석 체크 (각 session 상태로)
  - ❌ 개별 기록 (각 session별 note로)
  - ❌ 개별 청구 (각 case별로)
```

---

### 정리: 핵심 설계 원칙

| 원칙 | 이유 | 결과 |
|------|------|------|
| **1 Case = 1 Billing Unit** | 청구 독립성 보장 | 짝/그룹도 개별 청구 |
| **1 Case = 1 Counselor-Client** | 권한 명확성 | 상담사는 자기 케이스만 상세 조회 |
| **Linking Table = 연결만** | 데이터 중복 방지 | 실제 데이터는 각 엔티티에 |
| **Session은 Case별 생성** | 일관성 유지 | 모든 상담 유형이 동일한 구조 |
| **기본 정보는 공유** | 편성 협의 가능 | 센터 내 케이스 기본 정보 조회 가능 |
| **상세 정보는 제한** | 개인정보 보호 | 본인 케이스만 상세 조회 |

### 장점

1. **UI 재사용**: 개인 상담 UI를 짝/그룹에도 그대로 사용
2. **권한 단순화**: 케이스 참여자 기준으로 권한 처리
3. **청구 명확성**: 케이스 = 청구 단위, 혼란 없음
4. **유연성**: 개인 → 짝 → 그룹 → 개인 전환 자유로움
5. **데이터 일관성**: 모든 기록이 케이스-세션-노트 구조로 통일
6. **협의 가능**: 상담사들이 기본 정보 보고 협의 후 편성
