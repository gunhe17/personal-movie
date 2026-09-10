# FieldNote 도메인 설계

> 상담/검사 세션의 녹음, STT, 메모 통합 관리 도메인

---

## 목차

1. [도메인 개요](#도메인-개요)
2. [Core Schemas (Models)](#core-schemas-models)
3. [Pydantic Schemas (DTOs)](#pydantic-schemas-dtos)
4. [비즈니스 규칙](#비즈니스-규칙)
5. [API 엔드포인트](#api-엔드포인트)
6. [참고 문서](#참고-문서)

---

## 도메인 개요

### 책임 범위

**FieldNote 모듈**은 다음을 담당합니다:
- **녹음 관리**: 오디오 파일 저장 (S3), 재생
- **STT (Speech-to-Text)**: 실시간 음성 인식, Voice 레코드 생성
- **메모 관리**: 관찰/행동/감정 등 자유 형식 메모
- **통합 타임라인**: 녹음 시점 기준 Voice/Memo 동기화

### 특징

- **통합 관리**: 녹음, STT, 메모를 하나의 FieldNote로 관리
- **실시간 STT**: WebSocket 기반 실시간 음성 인식
- **Polymorphic**: 다양한 세션 유형과 연결 가능 (Counseling, Assessment 등)
- **독립 서비스 가능**: 향후 별도 마이크로서비스로 분리 가능
- **개인 기록**: 작성자만 조회 가능 (내담자 열람 불가)

### 모듈 계층

```
FieldNote (Core Domain)
  │
  ├── Voice (Sub-Module): STT 구간별 기록
  └── Memo (Sub-Module): 관찰/메모 기록

Dependencies:
  ← Session (Counseling, Assessment)
  ← User (created_by)
  → Storage Service (S3)
  → STT Service (외부 API)
```

### 관계도

```
Session (Polymorphic)
  │
  │ 1:N
  ↓
FieldNote ─────────┬─────────┐
  │                │         │
  │ 1:N            │ 1:N     │
  ↓                ↓         │
Voice            Memo        │
(STT 구간)      (관찰 메모)   │
                             │
                             ↓
                        audio_file_url
                          (S3 URL)
```

---

## Core Schemas (Models)

### FieldNote (필드노트)

**세션 녹음 및 기록의 메인 엔티티**

```python
from sqlalchemy import String, Integer, Text, DateTime, Boolean, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
import uuid

class FieldNote(Base):
    __tablename__ = "field_notes"

    # Primary Key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    # Polymorphic Relations (다양한 세션 유형 지원)
    related_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )  # "COUNSELING", "ASSESSMENT", "OTHER"
    related_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False
    )

    # Creator
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False
    )

    # Audio
    audio_file_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True
    )  # S3 URL (nullable: 녹음 없이 메모만 가능)
    total_duration: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0
    )  # 총 녹음 시간 (초)

    # Transcript
    full_transcript: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )  # 전체 STT 텍스트 (Voice 통합)

    # Status
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="DRAFT"
    )  # "DRAFT", "COMPLETED", "ARCHIVED"

    # Soft Delete
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # Relationships
    voices: Mapped[list["Voice"]] = relationship(
        "Voice",
        back_populates="field_note",
        cascade="all, delete-orphan"
    )
    memos: Mapped[list["Memo"]] = relationship(
        "Memo",
        back_populates="field_note",
        cascade="all, delete-orphan"
    )

    # Indexes
    __table_args__ = (
        Index("idx_fieldnote_related", "related_type", "related_id"),
        Index("idx_fieldnote_created_by", "created_by"),
        Index("idx_fieldnote_status", "status"),
    )
```

**필드 설명**:

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK | 필드노트 고유 ID |
| `related_type` | String(20) | NOT NULL | 연결 세션 유형 (COUNSELING, ASSESSMENT, OTHER) |
| `related_id` | UUID | NOT NULL | 연결 세션 ID |
| `created_by` | UUID | FK, NOT NULL | 작성자 ID |
| `audio_file_url` | String(500) | NULL | S3 오디오 파일 URL |
| `total_duration` | Integer | NOT NULL | 총 녹음 시간 (초) |
| `full_transcript` | Text | NULL | 전체 STT 텍스트 |
| `status` | String(20) | NOT NULL | 상태 (DRAFT, COMPLETED, ARCHIVED) |
| `deleted_at` | DateTime | NULL | Soft Delete 시점 |
| `created_at` | DateTime | NOT NULL | 생성 일시 |
| `updated_at` | DateTime | NOT NULL | 수정 일시 |

---

### Voice (음성 구간)

**STT 결과의 개별 발화 구간**

```python
class Voice(Base):
    __tablename__ = "voices"

    # Primary Key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    # Foreign Key
    field_note_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("field_notes.id", ondelete="CASCADE"),
        nullable=False
    )

    # Time Range (초 단위)
    start_time: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )  # 시작 시간 (초)
    end_time: Mapped[float] = mapped_column(
        Float,
        nullable=False
    )  # 종료 시간 (초)

    # Speaker
    speaker: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )  # "THERAPIST", "PATIENT"

    # Text (원본 + 수정본)
    text_original: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )  # STT 원본 (수정 불가)
    text: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )  # 현재 텍스트 (수정 가능)
    is_edited: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False
    )  # 수정 여부

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # Relationship
    field_note: Mapped["FieldNote"] = relationship(
        "FieldNote",
        back_populates="voices"
    )

    # Indexes
    __table_args__ = (
        Index("idx_voice_field_note", "field_note_id"),
        Index("idx_voice_time", "field_note_id", "start_time"),
    )
```

**필드 설명**:

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK | 음성 구간 ID |
| `field_note_id` | UUID | FK, NOT NULL | 필드노트 ID |
| `start_time` | Float | NOT NULL | 시작 시간 (초) |
| `end_time` | Float | NOT NULL | 종료 시간 (초) |
| `speaker` | String(20) | NOT NULL | 화자 (THERAPIST, PATIENT) |
| `text_original` | Text | NOT NULL | STT 원본 텍스트 |
| `text` | Text | NOT NULL | 현재 텍스트 (수정 가능) |
| `is_edited` | Boolean | NOT NULL | 수정 여부 |
| `created_at` | DateTime | NOT NULL | 생성 일시 |
| `updated_at` | DateTime | NOT NULL | 수정 일시 |

**Speaker Enum**:
```python
from enum import Enum

class Speaker(str, Enum):
    THERAPIST = "THERAPIST"  # 상담사/치료사
    PATIENT = "PATIENT"      # 내담자/환자
    # Phase 2 확장 예정
    # GUARDIAN = "GUARDIAN"
    # CO_THERAPIST = "CO_THERAPIST"
```

---

### Memo (메모)

**관찰/행동/감정 등 자유 형식 메모**

```python
class Memo(Base):
    __tablename__ = "memos"

    # Primary Key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    # Foreign Key
    field_note_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("field_notes.id", ondelete="CASCADE"),
        nullable=False
    )

    # Timestamp (녹음 기준)
    recording_timestamp: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True
    )  # 녹음 기준 ms (없으면 null)

    # Content
    text: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )

    # Category (자유 입력)
    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )  # "OBSERVATION", "SPEECH", "BEHAVIOR", "EMOTION", "OTHER" 등

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # Relationship
    field_note: Mapped["FieldNote"] = relationship(
        "FieldNote",
        back_populates="memos"
    )

    # Indexes
    __table_args__ = (
        Index("idx_memo_field_note", "field_note_id"),
        Index("idx_memo_category", "field_note_id", "category"),
    )
```

**필드 설명**:

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK | 메모 ID |
| `field_note_id` | UUID | FK, NOT NULL | 필드노트 ID |
| `recording_timestamp` | Integer | NULL | 녹음 기준 시점 (ms) |
| `text` | Text | NOT NULL | 메모 내용 |
| `category` | String(50) | NOT NULL | 카테고리 (자유 입력) |
| `created_at` | DateTime | NOT NULL | 생성 일시 |
| `updated_at` | DateTime | NOT NULL | 수정 일시 |

**권장 카테고리**:
```python
SUGGESTED_CATEGORIES = [
    "OBSERVATION",  # 관찰
    "SPEECH",       # 언어
    "BEHAVIOR",     # 행동
    "EMOTION",      # 감정
    "OTHER"         # 기타
]
```

---

## Pydantic Schemas (DTOs)

### FieldNote Schemas

```python
from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID

# === Create ===
class FieldNoteCreate(BaseModel):
    """FieldNote 생성 스키마"""
    related_type: str = Field(..., pattern=r"^(COUNSELING|ASSESSMENT|OTHER)$")
    related_id: UUID


# === Update ===
class FieldNoteUpdate(BaseModel):
    """FieldNote 수정 스키마"""
    status: str | None = Field(None, pattern=r"^(DRAFT|COMPLETED|ARCHIVED)$")
    audio_file_url: str | None = Field(None, max_length=500)
    total_duration: int | None = Field(None, ge=0)
    full_transcript: str | None = None


# === Response ===
class FieldNoteResponse(BaseModel):
    """FieldNote 조회 응답"""
    id: UUID
    related_type: str
    related_id: UUID
    created_by: UUID
    audio_file_url: str | None
    total_duration: int
    full_transcript: str | None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FieldNoteDetailResponse(BaseModel):
    """FieldNote 상세 조회 응답 (Voice, Memo 포함)"""
    id: UUID
    related_type: str
    related_id: UUID
    created_by: UUID
    audio_file_url: str | None
    total_duration: int
    full_transcript: str | None
    status: str
    voices: list["VoiceResponse"]
    memos: list["MemoResponse"]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FieldNoteSummary(BaseModel):
    """FieldNote 요약 정보 (목록용)"""
    id: UUID
    related_type: str
    related_id: UUID
    status: str
    total_duration: int
    voice_count: int
    memo_count: int
    created_at: datetime

    model_config = {"from_attributes": True}
```

### Voice Schemas

```python
# === Create ===
class VoiceCreate(BaseModel):
    """Voice 생성 스키마 (실시간 STT)"""
    start_time: float = Field(..., ge=0)
    end_time: float = Field(..., ge=0)
    speaker: str = Field(..., pattern=r"^(THERAPIST|PATIENT)$")
    text: str = Field(..., min_length=1)


# === Update ===
class VoiceUpdate(BaseModel):
    """Voice 수정 스키마 (텍스트 교정)"""
    text: str = Field(..., min_length=1)


# === Response ===
class VoiceResponse(BaseModel):
    """Voice 조회 응답"""
    id: UUID
    field_note_id: UUID
    start_time: float
    end_time: float
    speaker: str
    text_original: str
    text: str
    is_edited: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

### Memo Schemas

```python
# === Create ===
class MemoCreate(BaseModel):
    """Memo 생성 스키마"""
    recording_timestamp: int | None = Field(None, ge=0)  # ms
    text: str = Field(..., min_length=1)
    category: str = Field(..., min_length=1, max_length=50)


# === Update ===
class MemoUpdate(BaseModel):
    """Memo 수정 스키마"""
    text: str | None = Field(None, min_length=1)
    category: str | None = Field(None, min_length=1, max_length=50)


# === Response ===
class MemoResponse(BaseModel):
    """Memo 조회 응답"""
    id: UUID
    field_note_id: UUID
    recording_timestamp: int | None
    text: str
    category: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

---

## 비즈니스 규칙

### 1. FieldNote 생성 규칙

| 규칙 | 설명 |
|------|------|
| **센터 구성원만** | 생성자는 센터 구성원이어야 함 |
| **related_type 필수** | COUNSELING, ASSESSMENT, OTHER 중 하나 |
| **related_id 필수** | 연결할 세션 ID |
| **1:N 관계** | 하나의 세션에 여러 FieldNote 가능 (여러 전문가) |
| **초기 상태 DRAFT** | 생성 시 status="DRAFT" |

```python
# 생성 예시
async def create_fieldnote(data: FieldNoteCreate, auth: Auth) -> FieldNote:
    return await repo.create({
        "related_type": data.related_type,
        "related_id": data.related_id,
        "created_by": auth.user_id,
        "status": "DRAFT",
        "total_duration": 0
    })
```

### 2. FieldNote-Session 관계 (Polymorphic)

| 관계 | 설명 |
|------|------|
| **Polymorphic** | related_type + related_id로 다양한 세션 연결 |
| **1:N** | 하나의 세션에 여러 FieldNote 가능 |
| **독립적** | FieldNote 삭제해도 세션 영향 없음 |

```python
# Counseling Session 연결
FieldNote(related_type="COUNSELING", related_id=session_id)

# Assessment Session 연결
FieldNote(related_type="ASSESSMENT", related_id=assessment_session_id)

# 조회 시 필터링
GET /fieldnotes?related_type=COUNSELING&related_id={session_id}
```

### 3. Status 전이 규칙

```
          ┌──────────────┐
          │              │
          ↓              │
       DRAFT ←───────→ COMPLETED ────→ ARCHIVED
          │                              (최종)
          │
    (녹음 중/편집 중)   (완료)           (보관)
```

| 전이 | 허용 여부 | 설명 |
|------|----------|------|
| DRAFT → COMPLETED | ✅ | 작성 완료 |
| COMPLETED → DRAFT | ✅ | 수정 위해 되돌리기 |
| COMPLETED → ARCHIVED | ✅ | 보관 처리 |
| ARCHIVED → * | ❌ | 최종 상태, 전이 불가 |

```python
ALLOWED_TRANSITIONS = {
    "DRAFT": ["COMPLETED"],
    "COMPLETED": ["DRAFT", "ARCHIVED"],
    "ARCHIVED": []  # 최종 상태
}

def validate_status_transition(current: str, new: str) -> bool:
    return new in ALLOWED_TRANSITIONS.get(current, [])
```

### 4. COMPLETED 상태 잠금

| 규칙 | 설명 |
|------|------|
| **수정 불가** | COMPLETED 상태에서 Voice/Memo 수정 불가 |
| **추가 불가** | COMPLETED 상태에서 Voice/Memo 추가 불가 |
| **삭제 불가** | COMPLETED 상태에서 Voice/Memo 삭제 불가 |
| **상태 변경만 가능** | DRAFT로 되돌리거나 ARCHIVED로 전환만 가능 |

```python
async def update_voice(field_note_id: UUID, voice_id: UUID, data: VoiceUpdate):
    field_note = await fieldnote_repo.get(field_note_id)

    if field_note.status == "COMPLETED":
        raise HTTPException(
            status_code=400,
            detail="COMPLETED 상태에서는 수정할 수 없습니다. DRAFT로 변경 후 수정하세요."
        )

    # 수정 로직...
```

### 5. 권한 규칙

| 권한 | 대상 | 설명 |
|------|------|------|
| **생성** | 센터 구성원 | 누구나 생성 가능 |
| **조회** | 생성자만 | 본인이 작성한 FieldNote만 조회 |
| **수정** | 생성자만 | 본인이 작성한 것만 수정 |
| **삭제** | 생성자만 | 본인이 작성한 것만 삭제 |
| **관리자 예외** | 센터장/관리자 | 모든 FieldNote 조회 가능 (관리 목적) |

```python
# 조회 권한 검증
async def get_fieldnote(id: UUID, auth: Auth) -> FieldNote:
    fieldnote = await repo.get(id)

    if fieldnote.created_by != auth.user_id:
        # 관리자 권한 체크
        if not auth.has_permission("fieldnote:read_all"):
            raise HTTPException(status_code=403, detail="접근 권한이 없습니다")

    return fieldnote
```

### 6. 내담자 접근 불가

| 규칙 | 설명 |
|------|------|
| **내부 문서** | FieldNote는 전문가의 내부 기록 |
| **Client 앱 미노출** | Client 앱에서 FieldNote API 없음 |
| **공유 불가** | 내담자에게 직접 공유 불가 |

```python
# Client 앱 (내담자용)
# → FieldNote API 자체가 없음

# Center 앱 (전문가용)
# → FieldNote API 존재, 생성자만 접근
```

### 7. Voice 규칙

| 규칙 | 설명 |
|------|------|
| **실시간 생성** | STT 스트리밍으로 실시간 생성 |
| **원본 보존** | text_original은 수정 불가 |
| **수정 가능** | text 필드는 수정 가능 (교정용) |
| **수정 플래그** | 수정 시 is_edited = true |
| **시간 순서** | start_time 기준 정렬 |

```python
# Voice 수정 시
async def update_voice_text(voice_id: UUID, new_text: str):
    voice = await voice_repo.get(voice_id)
    voice.text = new_text
    voice.is_edited = True
    # text_original은 유지
```

### 8. Memo 규칙

| 규칙 | 설명 |
|------|------|
| **언제든지 생성** | 녹음 없이도 생성 가능 |
| **자유 카테고리** | category는 자유 입력 |
| **타임스탬프 선택** | recording_timestamp는 녹음 중일 때만 |
| **생성 시점 기록** | created_at 자동 기록 |

```python
# 녹음 중 메모
Memo(recording_timestamp=120000, text="눈 맞춤 회피", category="OBSERVATION")

# 녹음 없이 메모
Memo(recording_timestamp=None, text="초기 면담", category="OTHER")
```

### 9. 오디오 파일 규칙

| 규칙 | 설명 |
|------|------|
| **S3 저장** | 외부 스토리지 URL만 저장 |
| **영구 보존** | 삭제 정책 없음 (법적 보존) |
| **암호화 필수** | S3 SSE 암호화 적용 |
| **Presigned URL** | 접근 시 임시 URL 발급 |

```python
# 파일 업로드 플로우
1. POST /fieldnotes/{id}/upload-url → Presigned URL 발급
2. PUT {presigned_url} → S3 직접 업로드
3. PATCH /fieldnotes/{id} → audio_file_url 저장
```

### 10. Soft Delete 규칙

| 규칙 | 설명 |
|------|------|
| **Soft Delete** | deleted_at 플래그 사용 |
| **연쇄 삭제 없음** | Voice, Memo는 CASCADE |
| **복구 가능** | deleted_at = null로 복구 |
| **조회 필터링** | 기본 조회 시 deleted_at IS NULL |

```python
# 삭제
async def delete_fieldnote(id: UUID):
    await repo.update(id, {"deleted_at": datetime.utcnow()})

# 조회 (삭제된 것 제외)
async def get_active_fieldnotes(user_id: UUID):
    return await repo.find_by(
        created_by=user_id,
        deleted_at=None
    )
```

---

## API 엔드포인트

### FieldNote API

#### 목록 조회 (본인 것만)

```http
GET /fieldnotes
Authorization: Bearer {access_token}
```

**Query Parameters**:
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `related_type` | string | 세션 유형 필터 (COUNSELING, ASSESSMENT) |
| `related_id` | UUID | 세션 ID 필터 |
| `status` | string | 상태 필터 (DRAFT, COMPLETED, ARCHIVED) |
| `page` | int | 페이지 번호 (기본 1) |
| `size` | int | 페이지 크기 (기본 20) |

**응답 (200 OK)**:
```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "related_type": "COUNSELING",
      "related_id": "660e8400-e29b-41d4-a716-446655440001",
      "status": "DRAFT",
      "total_duration": 3600,
      "voice_count": 45,
      "memo_count": 5,
      "created_at": "2026-01-16T10:00:00Z"
    }
  ],
  "total": 10,
  "page": 1,
  "size": 20,
  "pages": 1
}
```

---

#### 생성

```http
POST /fieldnotes
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "related_type": "COUNSELING",
  "related_id": "660e8400-e29b-41d4-a716-446655440001"
}
```

**응답 (201 Created)**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "related_type": "COUNSELING",
  "related_id": "660e8400-e29b-41d4-a716-446655440001",
  "created_by": "770e8400-e29b-41d4-a716-446655440002",
  "audio_file_url": null,
  "total_duration": 0,
  "full_transcript": null,
  "status": "DRAFT",
  "created_at": "2026-01-16T10:00:00Z",
  "updated_at": "2026-01-16T10:00:00Z"
}
```

---

#### 상세 조회

```http
GET /fieldnotes/{id}
Authorization: Bearer {access_token}
```

**응답 (200 OK)**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "related_type": "COUNSELING",
  "related_id": "660e8400-e29b-41d4-a716-446655440001",
  "created_by": "770e8400-e29b-41d4-a716-446655440002",
  "audio_file_url": "https://storage.example.com/audio/fn_abc123.webm",
  "total_duration": 3600,
  "full_transcript": "상담사: 오늘 기분이 어때요?\n내담자: ...",
  "status": "COMPLETED",
  "voices": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440003",
      "start_time": 0.0,
      "end_time": 3.5,
      "speaker": "THERAPIST",
      "text_original": "오늘 기분이 어때요?",
      "text": "오늘 기분이 어때요?",
      "is_edited": false,
      "created_at": "2026-01-16T10:00:05Z"
    }
  ],
  "memos": [
    {
      "id": "990e8400-e29b-41d4-a716-446655440004",
      "recording_timestamp": 120000,
      "text": "눈 맞춤 회피, 집중력 저하 보임",
      "category": "OBSERVATION",
      "created_at": "2026-01-16T10:02:00Z"
    }
  ],
  "created_at": "2026-01-16T10:00:00Z",
  "updated_at": "2026-01-16T11:00:00Z"
}
```

**에러 (403 Forbidden)**:
```json
{
  "detail": "접근 권한이 없습니다"
}
```

---

#### 수정

```http
PATCH /fieldnotes/{id}
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "status": "COMPLETED",
  "total_duration": 3600
}
```

**응답 (200 OK)**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "COMPLETED",
  "total_duration": 3600,
  "updated_at": "2026-01-16T11:00:00Z"
}
```

**에러 (400 Bad Request - 상태 전이 불가)**:
```json
{
  "detail": "ARCHIVED 상태에서는 변경할 수 없습니다"
}
```

---

#### 삭제 (Soft Delete)

```http
DELETE /fieldnotes/{id}
Authorization: Bearer {access_token}
```

**응답 (204 No Content)**

---

#### 오디오 업로드 URL 발급

```http
POST /fieldnotes/{id}/upload-url
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "content_type": "audio/webm",
  "file_size": 5242880
}
```

**응답 (200 OK)**:
```json
{
  "upload_url": "https://s3.amazonaws.com/bucket/...",
  "expires_in": 300
}
```

---

### Voice API

#### 목록 조회

```http
GET /fieldnotes/{id}/voices
Authorization: Bearer {access_token}
```

**응답 (200 OK)**:
```json
{
  "items": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440003",
      "start_time": 0.0,
      "end_time": 3.5,
      "speaker": "THERAPIST",
      "text_original": "오늘 기분이 어때요?",
      "text": "오늘 기분이 어때요?",
      "is_edited": false
    }
  ],
  "total": 45
}
```

---

#### 생성 (실시간 STT)

```http
POST /fieldnotes/{id}/voices
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "start_time": 0.0,
  "end_time": 3.5,
  "speaker": "THERAPIST",
  "text": "오늘 기분이 어때요?"
}
```

**응답 (201 Created)**:
```json
{
  "id": "880e8400-e29b-41d4-a716-446655440003",
  "field_note_id": "550e8400-e29b-41d4-a716-446655440000",
  "start_time": 0.0,
  "end_time": 3.5,
  "speaker": "THERAPIST",
  "text_original": "오늘 기분이 어때요?",
  "text": "오늘 기분이 어때요?",
  "is_edited": false,
  "created_at": "2026-01-16T10:00:05Z"
}
```

**에러 (400 Bad Request - COMPLETED 상태)**:
```json
{
  "detail": "COMPLETED 상태에서는 Voice를 추가할 수 없습니다"
}
```

---

#### 수정 (텍스트 교정)

```http
PATCH /fieldnotes/{id}/voices/{voice_id}
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "text": "오늘 기분이 어떠세요?"
}
```

**응답 (200 OK)**:
```json
{
  "id": "880e8400-e29b-41d4-a716-446655440003",
  "text_original": "오늘 기분이 어때요?",
  "text": "오늘 기분이 어떠세요?",
  "is_edited": true,
  "updated_at": "2026-01-16T10:30:00Z"
}
```

---

### Memo API

#### 목록 조회

```http
GET /fieldnotes/{id}/memos
Authorization: Bearer {access_token}
```

**Query Parameters**:
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `category` | string | 카테고리 필터 |

**응답 (200 OK)**:
```json
{
  "items": [
    {
      "id": "990e8400-e29b-41d4-a716-446655440004",
      "recording_timestamp": 120000,
      "text": "눈 맞춤 회피, 집중력 저하 보임",
      "category": "OBSERVATION",
      "created_at": "2026-01-16T10:02:00Z"
    }
  ],
  "total": 5
}
```

---

#### 생성

```http
POST /fieldnotes/{id}/memos
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "recording_timestamp": 120000,
  "text": "눈 맞춤 회피, 집중력 저하 보임",
  "category": "OBSERVATION"
}
```

**응답 (201 Created)**:
```json
{
  "id": "990e8400-e29b-41d4-a716-446655440004",
  "field_note_id": "550e8400-e29b-41d4-a716-446655440000",
  "recording_timestamp": 120000,
  "text": "눈 맞춤 회피, 집중력 저하 보임",
  "category": "OBSERVATION",
  "created_at": "2026-01-16T10:02:00Z"
}
```

---

#### 수정

```http
PATCH /fieldnotes/{id}/memos/{memo_id}
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "text": "눈 맞춤 회피, 집중력 저하가 현저히 보임",
  "category": "BEHAVIOR"
}
```

**응답 (200 OK)**:
```json
{
  "id": "990e8400-e29b-41d4-a716-446655440004",
  "text": "눈 맞춤 회피, 집중력 저하가 현저히 보임",
  "category": "BEHAVIOR",
  "updated_at": "2026-01-16T10:10:00Z"
}
```

---

#### 삭제

```http
DELETE /fieldnotes/{id}/memos/{memo_id}
Authorization: Bearer {access_token}
```

**응답 (204 No Content)**

---

## Phase 2 기능 (예정)

### AI 요약

```http
POST /fieldnotes/{id}/generate-summary
Authorization: Bearer {access_token}
```

**응답**:
```json
{
  "summary": "내담자는 우울감과 집중력 저하를 호소하며...",
  "keywords": ["우울", "집중력", "수면"],
  "generated_at": "2026-01-16T12:00:00Z"
}
```

### 개인정보 자동 마스킹

```http
POST /fieldnotes/{id}/mask-pii
Authorization: Bearer {access_token}
```

**응답**:
```json
{
  "masked_count": 3,
  "details": [
    { "type": "phone", "original": "010-1234-5678", "masked": "010-****-5678" }
  ]
}
```

---

## 참고 문서

- **의사결정 기록**: `/docs/fieldnote/decision-log.md` - 설계 질문-답변 및 근거
- **시나리오**: `/docs/fieldnote/scenarios.md` (예정)
- **엣지 케이스**: `/docs/fieldnote/edge-cases.md` (예정)
- **Counseling 도메인**: `/docs/counseling/domain.md`
- **Assessment 도메인**: `/docs/assessment/domain.md`
- **프로젝트 설정**: `/CLAUDE.md`
