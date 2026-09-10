# Center 도메인 설계

> 상담센터 정보, 상담실, 운영 시간, 멤버 관리 도메인

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

**Center 모듈**은 다음을 담당합니다:
- **센터 등록 신청(CenterApplication)**: 신청-승인 플로우로 센터 생성
- **센터 기본 정보**: 이름, 코드, 주소, 연락처, 로고 등
- **상담실(Room)**: 센터 내 상담 공간 관리
- **운영 시간(OperatingTime)**: 운영/휴게/휴무/공휴일 통합 관리
- **멤버(Member)**: 센터-직원 소속 관계 관리 (권한 복사 정책)
- **멤버 초대(MemberInvitation)**: 초대 정보 저장 및 관리

### 특징

- **멀티테넌시 핵심**: 센터가 테넌트 역할, 모든 비즈니스 데이터는 센터에 종속
- **신청-승인 플로우**: 사용자가 센터 등록 신청 → 플랫폼 관리자 승인 → 센터 생성
- **코드 기반 초대**: 자동 생성된 센터 코드로 멤버 초대
- **권한 복사 정책**: 초대 수락 시 Role의 기본 권한을 복사하여 Member.permissions에 저장

### 도메인 위치

```
Center (Domain Module)
  ↓ depends on
Person (Foundation)
Auth (Foundation) - Role 참조 (권한 복사용)
```

---

## Core Schemas (Models)

### Center (상담센터)

**상담센터 기본 정보**

```python
from sqlalchemy import String, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
import uuid

class Center(Base):
    __tablename__ = "centers"

    # Primary Key
    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4
    )

    # Basic Information
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # NOTE: code는 VO 레벨의 생성 로직으로 생성한다 (서비스로 분리하지 않음).
    # 충돌은 DB unique + INSERT 재시도로 처리한다.
    code: Mapped[str] = mapped_column(
        String(6),
        unique=True,
        nullable=False,
        default=lambda: generate_center_code()
    )

    # Contact
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # {
    #   "zip_code": "06234",                           # 우편번호
    #   "address": "서울특별시 강남구 테헤란로 123",      # 주소 (도로명/지번)
    #   "detail": "4층 401호"                          # 상세주소
    # }

    # Branding
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Business Registration (사업자 정보)
    business_registration_number: Mapped[str | None] = mapped_column(
        String(12),  # 000-00-00000 형식
        nullable=True
    )
    representative_name: Mapped[str | None] = mapped_column(
        String(100),  # 대표자명
        nullable=True
    )

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Soft Delete
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )
```

**센터 코드 생성 (VO 레벨)** (짧고 사람이 읽기 쉬운 코드):
```python
import secrets

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # O, 0, I, 1 제외
CODE_LENGTH = 6

def generate_center_code() -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(CODE_LENGTH))
```

```sql
-- DB 제약조건 (최종 방어선)
ALTER TABLE centers ADD CONSTRAINT centers_code_unique UNIQUE (code);
```

---

### CenterApplication (센터 등록 신청)

**센터 등록 신청 정보 (승인 전 대기)**

```python
from enum import Enum

class ApplicationStatus(str, Enum):
    PENDING = "PENDING"      # 대기중
    APPROVED = "APPROVED"    # 승인됨
    REJECTED = "REJECTED"    # 거절됨


class CenterApplication(Base):
    __tablename__ = "center_applications"

    # Primary Key
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)

    # Applicant
    created_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("persons.id", ondelete="RESTRICT"),
        nullable=False
    )

    # Center Fields (승인 시 Center로 복사)
    # Basic Information
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    # Contact
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Branding
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Business Registration (사업자 정보)
    business_registration_number: Mapped[str | None] = mapped_column(
        String(12),  # 000-00-00000 형식
        nullable=True
    )
    representative_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )

    # Review Status
    status: Mapped[str] = mapped_column(
        String(20),
        default=ApplicationStatus.PENDING,
        nullable=False
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("persons.id"),
        nullable=True
    )
    reviewed_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Result (승인 시 Center로 연결)
    center_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("centers.id"),
        nullable=True
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    # Soft Delete (취소 처리)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
```

**인덱스**:
```sql
-- 대기 중인 신청 조회 (플랫폼 관리자용)
CREATE INDEX idx_application_pending ON center_applications (status, created_at)
  WHERE status = 'PENDING' AND deleted_at IS NULL;

-- 동일 신청자의 대기 중 신청 중복 방지
CREATE UNIQUE INDEX uq_application_pending_per_person
ON center_applications (created_by)
WHERE status = 'PENDING' AND deleted_at IS NULL;
```

---

### Room (상담실)

**센터 내 상담 공간**

```python
class Room(Base):
    __tablename__ = "rooms"

    # Primary Key
    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4
    )

    # Foreign Keys
    center_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("centers.id", ondelete="CASCADE"),
        nullable=False
    )

    # Basic Information
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)  # 상담실 설명
    memo: Mapped[str | None] = mapped_column(Text, nullable=True)  # 내부 메모
    thumbnail_url: Mapped[str | None] = mapped_column(String(500), nullable=True)  # 썸네일 이미지

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)  # 예약 가능 여부
    inactive_reason: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True
    )  # 비활성 사유

    # Soft Delete
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )
```

---

### OperatingTime (영업시간)

**요일별 영업시간 + 휴게시간**

```python
from enum import Enum

class Weekday(str, Enum):
    MON = "MON"
    TUE = "TUE"
    WED = "WED"
    THU = "THU"
    FRI = "FRI"
    SAT = "SAT"
    SUN = "SUN"


class OperatingTime(Base):
    __tablename__ = "operating_times"

    # Primary Key
    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4
    )

    # Foreign Keys
    center_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("centers.id", ondelete="CASCADE"),
        nullable=False
    )

    # Schedule
    weekday: Mapped[str] = mapped_column(String(3), nullable=False)  # Weekday enum

    # Operating Hours (nullable = 휴무일)
    open_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    close_time: Mapped[time | None] = mapped_column(Time, nullable=True)

    # Break Time (optional)
    break_start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    break_end_time: Mapped[time | None] = mapped_column(Time, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )
```

**제약조건**:
```sql
-- 센터별 요일 unique
CREATE UNIQUE INDEX idx_operating_time_center_weekday
ON operating_times (center_id, weekday);
```

---

### NonOperatingTime (비영업시간)

**반복 일정 + 지정 일정 통합 관리**

유연한 nullable 조합으로 다양한 패턴 커버:

| 케이스 | year | month | day | month_week | weekday | 설명 |
|--------|------|-------|-----|------------|---------|------|
| 매주 토요일 | null | null | null | null | SAT | 정기 주말 휴무 |
| 둘째주 화요일 | null | null | null | 2 | TUE | 4.5일제 |
| 특정 공휴일 | 2026 | 1 | 1 | null | null | 신정 (2026년) |
| 매년 1월 1일 | null | 1 | 1 | null | null | 반복 공휴일 |
| 점심시간 (매일) | null | null | null | null | null | start_time/end_time만 |
| 특정 요일 점심 | null | null | null | null | MON | 월요일 점심시간 |

```python
class NonOperatingTime(Base):
    __tablename__ = "non_operating_times"

    # Primary Key
    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4
    )

    # Foreign Keys
    center_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("centers.id", ondelete="CASCADE"),
        nullable=False
    )

    # Date Pattern (all nullable for flexible combinations)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)       # 특정 연도
    month: Mapped[int | None] = mapped_column(Integer, nullable=True)      # 1-12
    day: Mapped[int | None] = mapped_column(Integer, nullable=True)        # 1-31
    month_week: Mapped[int | None] = mapped_column(Integer, nullable=True) # 1-5 (n번째 주)
    weekday: Mapped[str | None] = mapped_column(String(3), nullable=True)  # Weekday enum

    # Time Range (nullable = 종일)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)

    # Effective Period
    effective_from: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )
    effective_to: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Metadata
    reason: Mapped[str] = mapped_column(String(200), nullable=False)  # "신정", "점심시간", "4.5일제" 등
    created_by: Mapped[str] = mapped_column(String(10), nullable=False)  # NonOperatingTimeCreator

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )
```

**인덱스**:
```sql
-- 센터별 비영업시간 조회
CREATE INDEX idx_non_operating_time_center
ON non_operating_times (center_id, effective_from, effective_to);

-- 시스템 등록 비영업시간 조회 (공휴일 일괄 업데이트용)
CREATE INDEX idx_non_operating_time_system
ON non_operating_times (created_by, year, month, day)
WHERE created_by = 'SYSTEM';
```

---

### Member (센터 멤버)

**센터-직원 소속 관계 (시간 기반, 권한 복사 정책)**

```python
from enum import Enum
from sqlalchemy.dialects.postgresql import JSONB

class EmploymentType(str, Enum):
    FULLTIME = "FULLTIME"      # 정규직
    CONTRACT = "CONTRACT"      # 계약직
    FREELANCER = "FREELANCER"  # 프리랜서


class Member(Base):
    __tablename__ = "members"

    # Primary Key
    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4
    )

    # Foreign Keys
    center_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("centers.id", ondelete="CASCADE"),
        nullable=False
    )
    person_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("persons.id"),
        nullable=False  # 가입된 Person만 Member 생성 가능
    )
    role_id: Mapped[int] = mapped_column(
        ForeignKey("roles.id"),
        nullable=False  # Auth 도메인의 Role 참조 (복사 시점 역할)
    )

    # Permissions (Role에서 복사, 개별 수정 가능)
    permissions: Mapped[list[str]] = mapped_column(
        JSONB,
        nullable=False
    )  # ["client:read", "counseling:create", ...]

    # Employment
    employment_type: Mapped[str] = mapped_column(String(20), nullable=False)  # EmploymentType

    # Profile (센터별 프로필)
    profile_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Additional Info
    memo: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Career, Education, Certification (JSONB)
    careers: Mapped[list[dict] | None] = mapped_column(JSONB, nullable=True)
    # [
    #   {
    #     "company_name": "서울심리상담센터",
    #     "position": "수석 상담사",
    #     "start_date": "2020-03",
    #     "end_date": "2024-12",       # null = 재직중
    #     "description": "성인 상담 담당"
    #   }
    # ]

    educations: Mapped[list[dict] | None] = mapped_column(JSONB, nullable=True)
    # [
    #   {
    #     "school_name": "서울대학교",
    #     "major": "심리학과",
    #     "degree": "석사",            # 학사, 석사, 박사, 수료
    #     "start_date": "2015-03",
    #     "end_date": "2017-02"        # null = 재학중
    #   }
    # ]

    certifications: Mapped[list[dict] | None] = mapped_column(JSONB, nullable=True)
    # [
    #   {
    #     "name": "임상심리사 1급",
    #     "issuer": "한국산업인력공단",
    #     "issued_at": "2019-06",
    #     "expires_at": "2024-06"      # null = 만료 없음
    #   }
    # ]

    # Soft Delete
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )
```

**인덱스**:
```sql
-- Person별 멤버 조회
CREATE INDEX idx_member_person ON members (person_id)
  WHERE deleted_at IS NULL;
```

---

### MemberWorkingTime (멤버 근무시간)

**요일별 기본 근무시간 (OperatingTime과 동일 패턴)**

```python
class MemberWorkingTime(Base):
    __tablename__ = "member_working_times"

    # Primary Key
    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4
    )

    # Foreign Keys
    center_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("centers.id", ondelete="CASCADE"),
        nullable=False
    )
    member_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("members.id", ondelete="CASCADE"),
        nullable=False
    )

    # Schedule
    weekday: Mapped[str] = mapped_column(String(3), nullable=False)  # Weekday enum

    # Working Hours (nullable = 비근무일)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)

    # Break Time (optional)
    break_start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    break_end_time: Mapped[time | None] = mapped_column(Time, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )
```

**제약조건**:
```sql
-- 멤버별 요일 unique
CREATE UNIQUE INDEX idx_member_working_time_weekday
ON member_working_times (member_id, weekday);
```

---

### MemberNonWorkingTime (멤버 비근무시간)

**휴가, 반차, 외근 등 예외 일정 (NonOperatingTime과 동일 패턴)**

```python
class MemberNonWorkingTimeReason(str, Enum):
    ANNUAL_LEAVE = "ANNUAL_LEAVE"      # 연차
    HALF_DAY_AM = "HALF_DAY_AM"        # 오전 반차
    HALF_DAY_PM = "HALF_DAY_PM"        # 오후 반차
    SICK_LEAVE = "SICK_LEAVE"          # 병가
    PERSONAL = "PERSONAL"              # 개인 사정
    TRAINING = "TRAINING"              # 교육/연수
    BUSINESS_TRIP = "BUSINESS_TRIP"    # 출장/외근
    OTHER = "OTHER"                    # 기타


class MemberNonWorkingTime(Base):
    __tablename__ = "member_non_working_times"

    # Primary Key
    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4
    )

    # Foreign Keys
    center_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("centers.id", ondelete="CASCADE"),
        nullable=False
    )
    member_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("members.id", ondelete="CASCADE"),
        nullable=False
    )

    # Date Pattern (all nullable for flexible combinations)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)       # 특정 연도
    month: Mapped[int | None] = mapped_column(Integer, nullable=True)      # 1-12
    day: Mapped[int | None] = mapped_column(Integer, nullable=True)        # 1-31
    month_week: Mapped[int | None] = mapped_column(Integer, nullable=True) # 1-5 (n번째 주)
    weekday: Mapped[str | None] = mapped_column(String(3), nullable=True)  # Weekday enum

    # Time Range (nullable = 종일)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)

    # Effective Period
    effective_from: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )
    effective_to: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Metadata
    reason: Mapped[str] = mapped_column(String(20), nullable=False)  # MemberNonWorkingTimeReason
    description: Mapped[str | None] = mapped_column(String(200), nullable=True)  # 상세 사유

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )
```

**인덱스**:
```sql
-- 멤버별 비근무시간 조회
CREATE INDEX idx_member_non_working_time
ON member_non_working_times (member_id, effective_from, effective_to);
```

---

### MemberInvitation (멤버 초대)

**초대 정보 저장 (가입 전 대기) - 최소 정보만 저장**

> 초대 시에는 name, email, role_id만 저장하고, 나머지 정보(phone, birth, gender, employment_type 등)는 초대 수락 후 가입 화면에서 수집한다.

```python
class MemberInvitation(Base):
    __tablename__ = "member_invitations"

    # Primary Key
    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4
    )

    # Inviter (초대자)
    invited_by: Mapped[uuid.UUID] = mapped_column(nullable=False)  # Person UUID

    # Foreign Keys (FK 제약 없음 - 모듈러 모놀리스)
    center_id: Mapped[uuid.UUID] = mapped_column(nullable=False)

    # Invitation Info (최소 정보만)
    role_id: Mapped[int] = mapped_column(nullable=False)  # 초대 시 지정된 역할
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)

    # Result (수락 시 Member로 연결)
    member_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)  # 수락 시 생성된 Member UUID
    membered_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)  # 수락 시각

    # Expiration
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    # Timestamps (BaseModel 상속)
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]
```

**초대 토큰 생성 (서버 사이드)**:
```python
import hmac
import hashlib
import base64
from datetime import datetime

def generate_invitation_token(invitation_id: str, secret_key: str) -> str:
    """초대 ID를 서버 시크릿으로 서명하여 토큰 생성"""
    message = invitation_id.encode()
    signature = hmac.new(secret_key.encode(), message, hashlib.sha256).digest()
    token = base64.urlsafe_b64encode(f"{invitation_id}:{signature.hex()}".encode()).decode()
    return token

def verify_invitation_token(token: str, secret_key: str) -> str | None:
    """토큰 검증 후 invitation_id 반환, 실패 시 None"""
    try:
        decoded = base64.urlsafe_b64decode(token.encode()).decode()
        invitation_id, signature_hex = decoded.rsplit(":", 1)
        expected_signature = hmac.new(secret_key.encode(), invitation_id.encode(), hashlib.sha256).digest()
        if hmac.compare_digest(bytes.fromhex(signature_hex), expected_signature):
            return invitation_id
    except Exception:
        pass
    return None
```

**인덱스**:
```sql
-- 이메일로 초대 조회
CREATE INDEX idx_invitation_email ON member_invitations (center_id, email)
  WHERE member_id IS NULL;

-- 만료되지 않은 초대 조회
CREATE INDEX idx_invitation_pending ON member_invitations (center_id, expires_at)
  WHERE member_id IS NULL;
```

---

## Pydantic Schemas (DTOs)

> Update(PATCH) DTO 처리 원칙:
> - **필드 미전송**은 "변경 없음"으로 처리한다 (`model_fields_set` / `model_dump(exclude_unset=True)` 활용)
> - **명시적 null 전송**은 기본적으로 "해당 컬럼을 NULL로 설정" 의미가 되므로, **NULL 불가 컬럼은 DTO 단계에서 거절**한다.

### Center Schemas

#### CenterCreate

```python
from pydantic import BaseModel, Field, model_validator

class AddressInfo(BaseModel):
    """주소 정보"""
    zip_code: str | None = Field(None, pattern=r"^\d{5}$")  # 5자리 우편번호
    address: str | None = Field(None, max_length=300)        # 주소 (도로명/지번)
    detail: str | None = Field(None, max_length=200)         # 상세주소


class CenterCreate(BaseModel):
    """센터 생성 (플랫폼 관리자용)"""
    name: str = Field(..., min_length=1, max_length=100)
    phone: str | None = Field(None, pattern=r"^\d{2,3}-\d{3,4}-\d{4}$")
    address: AddressInfo | None = None
    description: str | None = None
    logo_url: str | None = Field(None, max_length=500)
    # Business Registration
    business_registration_number: str | None = Field(
        None,
        pattern=r"^\d{3}-\d{2}-\d{5}$"  # 000-00-00000 형식
    )
    representative_name: str | None = Field(None, max_length=100)
```

#### CenterUpdate

```python
from pydantic import model_validator

class CenterUpdate(BaseModel):
    """센터 수정"""
    name: str | None = Field(None, min_length=1, max_length=100)
    phone: str | None = Field(None, pattern=r"^\d{2,3}-\d{3,4}-\d{4}$")
    address: AddressInfo | None = None
    description: str | None = None
    logo_url: str | None = Field(None, max_length=500)
    # Business Registration
    business_registration_number: str | None = Field(
        None,
        pattern=r"^\d{3}-\d{2}-\d{5}$"
    )
    representative_name: str | None = Field(None, max_length=100)

    @model_validator(mode="after")
    def validate_patch_nulls(self):
        if "name" in self.model_fields_set and self.name is None:
            raise ValueError("name cannot be null (omit the field to keep unchanged)")
        return self
```

#### CenterResponse

```python
from datetime import datetime

class CenterResponse(BaseModel):
    """센터 상세 응답"""
    id: str  # UUID
    name: str
    code: str
    phone: str | None
    address: AddressInfo | None
    description: str | None
    logo_url: str | None
    # Business Registration
    business_registration_number: str | None
    representative_name: str | None
    # Timestamps
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

#### CenterSummary

```python
class CenterSummary(BaseModel):
    """센터 요약 (목록용)"""
    id: str
    name: str
    code: str

    model_config = {"from_attributes": True}
```

---

### CenterApplication Schemas

#### CenterApplicationCreate

```python
class CenterApplicationCreate(BaseModel):
    """센터 등록 신청"""
    name: str = Field(..., min_length=1, max_length=100)
    phone: str | None = Field(None, pattern=r"^\d{2,3}-\d{3,4}-\d{4}$")
    address: AddressInfo | None = None
    description: str | None = None
    # Business Registration
    business_registration_number: str | None = Field(
        None,
        pattern=r"^\d{3}-\d{2}-\d{5}$"  # 000-00-00000 형식
    )
    representative_name: str | None = Field(None, max_length=100)
```

#### CenterApplicationUpdate

```python
from pydantic import model_validator

class CenterApplicationUpdate(BaseModel):
    """센터 등록 신청 수정 (대기 중일 때만)"""
    name: str | None = Field(None, min_length=1, max_length=100)
    phone: str | None = Field(None, pattern=r"^\d{2,3}-\d{3,4}-\d{4}$")
    address: AddressInfo | None = None
    description: str | None = None
    business_registration_number: str | None = Field(
        None,
        pattern=r"^\d{3}-\d{2}-\d{5}$"
    )
    representative_name: str | None = Field(None, max_length=100)

    @model_validator(mode="after")
    def validate_patch_nulls(self):
        if "name" in self.model_fields_set and self.name is None:
            raise ValueError("name cannot be null (omit the field to keep unchanged)")
        return self
```

#### CenterApplicationApprove

```python
class CenterApplicationApprove(BaseModel):
    """센터 등록 승인 (플랫폼 관리자용)"""
    # 승인 시 추가 설정 (선택)
    logo_url: str | None = Field(None, max_length=500)
```

#### CenterApplicationReject

```python
class CenterApplicationReject(BaseModel):
    """센터 등록 거절 (플랫폼 관리자용)"""
    reviewed_reason: str | None = Field(None, min_length=1, max_length=500)
```

#### CenterApplicationResponse

```python
class CenterApplicationResponse(BaseModel):
    """센터 등록 신청 응답"""
    id: str
    created_by: str  # Person.id (applicant)
    # Center Info
    name: str
    phone: str | None
    address: AddressInfo | None
    description: str | None
    business_registration_number: str | None
    representative_name: str | None
    # Status
    status: str  # ApplicationStatus
    # Review
    reviewed_at: datetime | None
    reviewed_by: str | None
    reviewed_reason: str | None
    # Result
    center_id: str | None  # 승인 시 생성된 Center ID
    # Timestamps
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

#### CenterApplicationSummary

```python
class CenterApplicationSummary(BaseModel):
    """센터 등록 신청 요약 (목록용)"""
    id: str
    name: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
```

---

### Room Schemas

#### RoomCreate

```python
class RoomCreate(BaseModel):
    """상담실 생성"""
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)  # 상담실 설명
    memo: str | None = None  # 내부 메모
    thumbnail_url: str | None = Field(None, max_length=500)  # 썸네일 이미지
    is_active: bool = True  # 예약 가능 여부
    inactive_reason: str | None = Field(None, max_length=200)
```

#### RoomUpdate

```python
from pydantic import model_validator

class RoomUpdate(BaseModel):
    """상담실 수정"""
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    memo: str | None = None
    thumbnail_url: str | None = Field(None, max_length=500)
    is_active: bool | None = None  # 예약 가능 여부
    inactive_reason: str | None = Field(None, max_length=200)

    @model_validator(mode="after")
    def validate_patch_nulls(self):
        if "name" in self.model_fields_set and self.name is None:
            raise ValueError("name cannot be null (omit the field to keep unchanged)")
        if "is_active" in self.model_fields_set and self.is_active is None:
            raise ValueError("is_active cannot be null (omit the field to keep unchanged)")
        return self
```

#### RoomResponse

```python
class RoomResponse(BaseModel):
    """상담실 상세 응답"""
    id: str
    center_id: str
    name: str
    description: str | None
    memo: str | None
    thumbnail_url: str | None
    is_active: bool
    inactive_reason: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

---

### OperatingTime Schemas

#### OperatingTimeCreate

```python
from datetime import time
from pydantic import model_validator

class OperatingTimeCreate(BaseModel):
    """영업시간 생성/수정"""
    weekday: Weekday
    open_time: time | None = None      # null = 휴무일
    close_time: time | None = None     # null = 휴무일
    break_start_time: time | None = None
    break_end_time: time | None = None

    @model_validator(mode='after')
    def validate_times(self):
        if (self.open_time is None) != (self.close_time is None):
            raise ValueError("open_time and close_time must be set together")
        if self.open_time and self.close_time:
            if self.open_time >= self.close_time:
                raise ValueError("open_time must be before close_time")
        if (self.open_time is None) and (self.break_start_time or self.break_end_time):
            raise ValueError("break time requires operating hours")
        if (self.break_start_time is None) != (self.break_end_time is None):
            raise ValueError("break_start_time and break_end_time must be set together")
        if self.break_start_time and self.break_end_time:
            if self.break_start_time >= self.break_end_time:
                raise ValueError("break_start_time must be before break_end_time")
        return self
```

#### OperatingTimeResponse

```python
class OperatingTimeResponse(BaseModel):
    """영업시간 응답"""
    id: str
    center_id: str
    weekday: str
    open_time: time | None
    close_time: time | None
    break_start_time: time | None
    break_end_time: time | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

#### OperatingTimeBulkCreate

```python
from pydantic import model_validator

class OperatingTimeBulkCreate(BaseModel):
    """영업시간 일괄 생성/수정 (7일치)"""
    items: list[OperatingTimeCreate] = Field(..., min_length=7, max_length=7)

    @model_validator(mode='after')
    def validate_all_weekdays(self):
        weekdays = {item.weekday for item in self.items}
        if len(weekdays) != 7:
            raise ValueError("All 7 weekdays must be provided")
        return self
```

---

### NonOperatingTime Schemas

#### NonOperatingTimeCreate

```python
from pydantic import model_validator

class NonOperatingTimeCreate(BaseModel):
    """비영업시간 생성"""
    # Date Pattern
    year: int | None = Field(None, ge=2020, le=2100)
    month: int | None = Field(None, ge=1, le=12)
    day: int | None = Field(None, ge=1, le=31)
    month_week: int | None = Field(None, ge=1, le=5)  # 1-5번째 주
    weekday: Weekday | None = None

    # Time Range (null = 종일)
    start_time: time | None = None
    end_time: time | None = None

    # Effective Period
    effective_from: datetime | None = None  # 미지정 시 now()
    effective_to: datetime | None = None

    # Metadata
    reason: str = Field(..., min_length=1, max_length=200)

    @model_validator(mode='after')
    def validate_pattern(self):
        # day와 month_week는 동시 사용 불가
        if self.day is not None and self.month_week is not None:
            raise ValueError("Cannot specify both day and month_week")
        # time 범위 검증
        if (self.start_time is None) != (self.end_time is None):
            raise ValueError("start_time and end_time must be set together")
        if self.start_time and self.end_time:
            if self.start_time >= self.end_time:
                raise ValueError("start_time must be before end_time")
        return self
```

#### NonOperatingTimeUpdate

```python
class NonOperatingTimeUpdate(BaseModel):
    """비영업시간 수정"""
    start_time: time | None = None
    end_time: time | None = None
    effective_to: datetime | None = None
    reason: str | None = Field(None, min_length=1, max_length=200)
```

#### NonOperatingTimeResponse

```python
class NonOperatingTimeResponse(BaseModel):
    """비영업시간 응답"""
    id: str
    center_id: str
    year: int | None
    month: int | None
    day: int | None
    month_week: int | None
    weekday: str | None
    start_time: time | None
    end_time: time | None
    effective_from: datetime
    effective_to: datetime | None
    reason: str
    created_by: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

---

### Member Schemas

#### CareerItem / EducationItem / CertificationItem (JSONB 항목)

```python
class CareerItem(BaseModel):
    """경력 항목"""
    company_name: str = Field(..., min_length=1, max_length=100)
    position: str | None = Field(None, max_length=100)
    start_date: str = Field(..., pattern=r"^\d{4}-\d{2}$")  # YYYY-MM
    end_date: str | None = Field(None, pattern=r"^\d{4}-\d{2}$")  # null = 재직중
    description: str | None = Field(None, max_length=500)


class EducationItem(BaseModel):
    """학력 항목"""
    school_name: str = Field(..., min_length=1, max_length=100)
    major: str | None = Field(None, max_length=100)
    degree: str | None = Field(None, pattern=r"^(학사|석사|박사|수료)$")
    start_date: str | None = Field(None, pattern=r"^\d{4}-\d{2}$")
    end_date: str | None = Field(None, pattern=r"^\d{4}-\d{2}$")  # null = 재학중


class CertificationItem(BaseModel):
    """자격증 항목"""
    name: str = Field(..., min_length=1, max_length=100)
    issuer: str | None = Field(None, max_length=100)
    issued_at: str | None = Field(None, pattern=r"^\d{4}-\d{2}$")
    expires_at: str | None = Field(None, pattern=r"^\d{4}-\d{2}$")  # null = 만료 없음
```

#### MemberCreate

```python
class MemberCreate(BaseModel):
    """멤버 생성 (내부용 - 초대 수락 시)"""
    person_id: str  # UUID
    role_id: int
    permissions: list[str]  # Role에서 복사된 권한
    employment_type: EmploymentType
    profile_image_url: str | None = Field(None, max_length=500)
    memo: str | None = None
    careers: list[CareerItem] | None = None
    educations: list[EducationItem] | None = None
    certifications: list[CertificationItem] | None = None
```

#### MemberUpdate

```python
from pydantic import model_validator

class MemberUpdate(BaseModel):
    """멤버 수정"""
    role_id: int | None = None
    permissions: list[str] | None = None  # 권한 개별 수정
    employment_type: EmploymentType | None = None
    profile_image_url: str | None = Field(None, max_length=500)
    memo: str | None = None
    careers: list[CareerItem] | None = None
    educations: list[EducationItem] | None = None
    certifications: list[CertificationItem] | None = None

    @model_validator(mode="after")
    def validate_patch_nulls(self):
        if "role_id" in self.model_fields_set and self.role_id is None:
            raise ValueError("role_id cannot be null (omit the field to keep unchanged)")
        if "permissions" in self.model_fields_set and self.permissions is None:
            raise ValueError("permissions cannot be null (use [] to clear, or omit to keep unchanged)")
        if "employment_type" in self.model_fields_set and self.employment_type is None:
            raise ValueError("employment_type cannot be null (omit the field to keep unchanged)")
        return self
```

#### MemberResponse

```python
class MemberResponse(BaseModel):
    """멤버 상세 응답"""
    id: str
    center_id: str
    person_id: str
    role_id: int
    role_name: str  # JOIN으로 가져옴
    permissions: list[str]
    employment_type: str
    profile_image_url: str | None
    memo: str | None
    careers: list[CareerItem] | None
    educations: list[EducationItem] | None
    certifications: list[CertificationItem] | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

#### MemberWithPerson

```python
class MemberWithPerson(BaseModel):
    """멤버 + Person 정보 (목록용)"""
    id: str
    role_id: int
    role_name: str
    employment_type: str
    permissions: list[str]
    profile_image_url: str | None
    certifications: list[CertificationItem] | None
    person: PersonSummary

    model_config = {"from_attributes": True}
```

#### MemberDetail

```python
class MemberDetail(BaseModel):
    """멤버 상세 (상세 페이지용 - Person + Account 정보 포함)"""
    id: str
    role_id: int
    role_name: str
    employment_type: str
    permissions: list[str]
    profile_image_url: str | None
    memo: str | None
    careers: list[CareerItem] | None
    educations: list[EducationItem] | None
    # Person 정보
    person: PersonSummary  # name, phone, birth, gender
    # Account 정보
    email: str  # Account.email (JOIN)
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

---

### MemberWorkingTime Schemas

#### MemberWorkingTimeCreate

```python
from pydantic import model_validator

class MemberWorkingTimeCreate(BaseModel):
    """멤버 근무시간 생성/수정"""
    weekday: Weekday
    start_time: time | None = None  # null = 비근무일
    end_time: time | None = None    # null = 비근무일
    break_start_time: time | None = None
    break_end_time: time | None = None

    @model_validator(mode='after')
    def validate_times(self):
        if (self.start_time is None) != (self.end_time is None):
            raise ValueError("start_time and end_time must be set together")
        if self.start_time and self.end_time:
            if self.start_time >= self.end_time:
                raise ValueError("start_time must be before end_time")
        if (self.start_time is None) and (self.break_start_time or self.break_end_time):
            raise ValueError("break time requires working hours")
        if (self.break_start_time is None) != (self.break_end_time is None):
            raise ValueError("break_start_time and break_end_time must be set together")
        if self.break_start_time and self.break_end_time:
            if self.break_start_time >= self.break_end_time:
                raise ValueError("break_start_time must be before break_end_time")
        return self
```

#### MemberWorkingTimeResponse

```python
class MemberWorkingTimeResponse(BaseModel):
    """멤버 근무시간 응답"""
    id: str
    center_id: str
    member_id: str
    weekday: str
    start_time: time | None
    end_time: time | None
    break_start_time: time | None
    break_end_time: time | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

#### MemberWorkingTimeBulkCreate

```python
from pydantic import model_validator

class MemberWorkingTimeBulkCreate(BaseModel):
    """멤버 근무시간 일괄 생성/수정 (7일치)"""
    items: list[MemberWorkingTimeCreate] = Field(..., min_length=7, max_length=7)

    @model_validator(mode='after')
    def validate_all_weekdays(self):
        weekdays = {item.weekday for item in self.items}
        if len(weekdays) != 7:
            raise ValueError("All 7 weekdays must be provided")
        return self
```

---

### MemberNonWorkingTime Schemas

#### MemberNonWorkingTimeCreate

```python
from pydantic import model_validator

class MemberNonWorkingTimeCreate(BaseModel):
    """멤버 비근무시간 생성"""
    # Date Pattern
    year: int | None = Field(None, ge=2020, le=2100)
    month: int | None = Field(None, ge=1, le=12)
    day: int | None = Field(None, ge=1, le=31)
    month_week: int | None = Field(None, ge=1, le=5)
    weekday: Weekday | None = None

    # Time Range (null = 종일)
    start_time: time | None = None
    end_time: time | None = None

    # Effective Period
    effective_from: datetime | None = None  # 미지정 시 now()
    effective_to: datetime | None = None

    # Metadata
    reason: MemberNonWorkingTimeReason
    description: str | None = Field(None, max_length=200)

    @model_validator(mode='after')
    def validate_pattern(self):
        if self.day is not None and self.month_week is not None:
            raise ValueError("Cannot specify both day and month_week")
        if (self.start_time is None) != (self.end_time is None):
            raise ValueError("start_time and end_time must be set together")
        if self.start_time and self.end_time:
            if self.start_time >= self.end_time:
                raise ValueError("start_time must be before end_time")
        return self
```

#### MemberNonWorkingTimeUpdate

```python
class MemberNonWorkingTimeUpdate(BaseModel):
    """멤버 비근무시간 수정"""
    start_time: time | None = None
    end_time: time | None = None
    effective_to: datetime | None = None
    reason: MemberNonWorkingTimeReason | None = None
    description: str | None = Field(None, max_length=200)
```

#### MemberNonWorkingTimeResponse

```python
class MemberNonWorkingTimeResponse(BaseModel):
    """멤버 비근무시간 응답"""
    id: str
    center_id: str
    member_id: str
    year: int | None
    month: int | None
    day: int | None
    month_week: int | None
    weekday: str | None
    start_time: time | None
    end_time: time | None
    effective_from: datetime
    effective_to: datetime | None
    reason: str
    description: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

---

### MemberInvitation Schemas

#### MemberInvitationCreate

```python
class MemberInvitationCreate(BaseModel):
    """멤버 초대 생성 - 최소 정보만"""
    name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., pattern=r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
    role_id: int
```

#### MemberInvitationResponse

```python
class MemberInvitationResponse(BaseModel):
    """멤버 초대 응답"""
    id: str
    center_id: str
    invited_by: str  # 초대자 Person UUID
    # Invitation Info
    name: str
    email: str
    role_id: int
    role_name: str  # JOIN으로 가져옴
    # Result
    member_id: str | None  # 수락 시 생성된 Member UUID
    membered_at: datetime | None  # 수락 시각
    # Status
    expires_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}
```

#### MemberInvitationAccept

```python
class MemberInvitationAccept(BaseModel):
    """초대 수락 시 추가 정보 입력 (가입 화면)"""
    # Person 정보 (Person 생성 또는 업데이트)
    phone: str | None = Field(None, pattern=r"^\d{2,3}-\d{3,4}-\d{4}$")
    birth: date | None = None
    gender: Gender | None = None

    # Member 정보
    employment_type: EmploymentType  # 필수

    # Account 정보 (신규 가입 시)
    password: str | None = Field(None, min_length=8)  # 기존 회원이면 None
```

---

## 비즈니스 규칙

### 1. 센터 등록 신청 규칙

| 규칙 | 설명 |
|------|------|
| **가입된 사용자만 신청** | Person이 있어야 신청 가능 |
| **중복 신청 불가** | 동일 사용자의 대기 중인 신청이 있으면 불가 |
| **대기 중일 때만 수정** | PENDING 상태에서만 신청 내용 수정 가능 |
| **취소 가능** | 신청자가 PENDING 상태에서 취소 가능 (Soft Delete: deleted_at 설정) |

### 2. 센터 등록 승인/거절 규칙

| 규칙 | 설명 |
|------|------|
| **플랫폼 관리자만** | 승인/거절은 플랫폼 관리자 권한 필요 |
| **승인 시 센터 생성** | Registration 정보로 Center 자동 생성 |
| **검토 사유 기록** | reviewed_reason optional |
| **재신청 가능** | 거절 후 신청자는 새로운 신청 가능 |

**승인 플로우**:
```python
async def approve_application_handler(application_id: str, data: CenterApplicationApprove, ...):
    async with uow:
        # 1. Registration 조회
        application = await application_repo.get(application_id)
        if application.deleted_at:
            raise HTTPException(400, "Canceled applications cannot be approved")
        if application.status != ApplicationStatus.PENDING:
            raise HTTPException(400, "Only pending applications can be approved")

        # 2. Center 생성
        center = await center_repo.create({
            "name": application.name,
            "phone": application.phone,
            "address": application.address,
            "description": application.description,
            "business_registration_number": application.business_registration_number,
            "representative_name": application.representative_name,
            "logo_url": data.logo_url,
        })

        # 3. Registration 상태 업데이트
        await application_repo.update(application_id, {
            "status": ApplicationStatus.APPROVED,
            "reviewed_at": datetime.utcnow(),
            "reviewed_by": current_user.person_id,
            "center_id": center.id,
        })

        await uow.commit()
        return application
```

**신청 생성 시 created_by 강제**:
```python
async def create_application_handler(data: CenterApplicationCreate, ...):
    # created_by는 요청 body로 받지 않고, 로그인한 사용자의 Person.id로 강제한다.
    return await application_repo.create({
        "created_by": current_user.person_id,
        **data.model_dump(),
    })
```

### 3. 센터 생성 규칙 (직접 생성)

| 규칙 | 설명 |
|------|------|
| **플랫폼 관리자만 생성** | 일반 사용자는 센터 직접 생성 불가 |
| **코드 자동 생성** | 6자리 랜덤 코드, unique |
| **name 필수** | 유일한 필수 필드 |
| **Soft Delete** | deleted_at 사용 |

### 4. 센터 코드 규칙

| 규칙 | 설명 |
|------|------|
| **자동 생성** | 6자리 대문자 + 숫자 조합 |
| **혼동 문자 제외** | O, 0, I, 1 제외 (가독성) |

### 5. 운영시간/비영업시간 적용 규칙

| 규칙 | 설명 |
|------|------|
| **기본 영업시간** | OperatingTime을 기본 영업시간으로 사용 |
| **비영업시간 우선** | 특정 날짜가 NonOperatingTime에 포함되면 영업시간에서 제외 |
| **공휴일 기본 비영업** | 공휴일은 SYSTEM 생성자로 NonOperatingTime 기본 등록 |
| **공휴일 알림 후 해제** | 공휴일이 가까워지면 센터에 알림을 보내 정책에 따라 영업일로 해제 가능 |

### 6. 상담실 규칙

| 규칙 | 설명 |
|------|------|
| **센터 종속** | Room은 Center에 종속 |
| **삭제 시 Soft Delete** | `deleted_at`으로 삭제 처리 (물리 삭제 없음) |
| **일정 존재 시 삭제 확인(UI)** | Room을 참조하는 Schedule이 있으면 UI로 삭제 확인을 받고, 확인 시 해당 Schedule들의 `room_id=NULL` 처리 후 Soft Delete |
| **비활성화 권장** | 일정의 장소 정보를 유지해야 하면 삭제 대신 비활성화(`is_active=false`) 권장 |
| **운영 시간** | 센터 운영 시간 따름 (Room별 운영 시간 없음) |
| **가용성** | 기존 예약 여부로 판단 |

**상담실 삭제 시 기존 예약 처리**:
```python
async def delete_room_handler(room_id: str, confirm: bool = False, ...):
    # 1. 일정 존재 여부 확인 (해당 상담실을 참조하는 Schedule)
    schedule_count = await schedule_repo.count_by_room(room_id)

    # 2. 일정이 있으면 UI에서 사용자 확인을 받는다.
    #    - confirm=false(기본)일 때는 "확인 필요" 응답만 반환
    if schedule_count > 0 and not confirm:
        return {
            "requires_confirmation": True,
            "warning": {
                "message": "이 상담실은 일정에 사용 중이에요",
                "description": "삭제를 진행하면 해당 일정들의 장소 정보(room_id)가 제거돼요. 장소 정보를 유지하려면 비활성화 해주세요.",
                "schedule_count": schedule_count,
            },
        }

    # 3. 사용자가 확인(confirm=true)하면 트랜잭션으로 처리
    async with uow:
        # 3-1) 해당 상담실을 참조하는 일정의 장소(room_id)를 제거한다.
        await schedule_repo.bulk_set_room_null(room_id=room_id)

        # 3-2) 상담실 Soft Delete
        await room_repo.update(room_id, {"deleted_at": now()})

        await uow.commit()
```

**삭제 vs 비활성화 비교**:
| 방식 | 기존 예약 | 신규 예약 | 목록 표시 | 용도 |
|------|----------|----------|----------|------|
| **삭제** (deleted_at) | 유지 (단, 관련 Schedule의 `room_id=NULL` 처리로 장소 정보 제거) | 불가 | 미표시 | 완전 제거 |
| **비활성화** (is_active=false) | 유지 + 상담실 정보 조회 가능 | 불가 | 표시 (비활성 상태) | 일시 중단 |

### 7. 영업시간(OperatingTime) 규칙

| 규칙 | 설명 |
|------|------|
| **센터별 7일 구성** | 월~일 7일 모두 설정 필수 |
| **센터당 요일 unique** | center_id + weekday 조합 unique |
| **휴무일 표현** | open_time/close_time을 null로 표현 |
| **휴게시간 선택적** | break_start_time/break_end_time nullable |
| **시간 검증** | open_time < close_time, break_start < break_end |

**센터 생성 시 기본 영업시간 자동 생성**:
```python
DEFAULT_OPERATING_TIMES = [
    {"weekday": "MON", "open_time": "09:00", "close_time": "18:00"},
    {"weekday": "TUE", "open_time": "09:00", "close_time": "18:00"},
    {"weekday": "WED", "open_time": "09:00", "close_time": "18:00"},
    {"weekday": "THU", "open_time": "09:00", "close_time": "18:00"},
    {"weekday": "FRI", "open_time": "09:00", "close_time": "18:00"},
    {"weekday": "SAT", "open_time": None, "close_time": None},
    {"weekday": "SUN", "open_time": None, "close_time": None},
]
```

### 8. 비영업시간(NonOperatingTime) 규칙

| 규칙 | 설명 |
|------|------|
| **패턴 조합** | year/month/day/month_week/weekday 조합으로 다양한 패턴 표현 |
| **day와 month_week 배타적** | 동시 지정 불가 (특정 날짜 vs n번째 주) |
| **시간 범위 선택적** | null이면 종일 비영업 |
| **기간 한정** | effective_from/to로 적용 기간 제한 가능 |
| **생성자 구분** | SYSTEM(공휴일 자동) vs CENTER(수동 등록) |
| **SYSTEM 등록 보호** | 센터에서 SYSTEM 등록 항목 삭제 불가, 예외 처리만 가능 |

**패턴 매칭 로직**:
```python
def matches_date(non_op: NonOperatingTime, target_date: date) -> bool:
    """특정 날짜가 비영업시간 패턴에 매칭되는지 확인"""
    # effective 기간 체크
    if non_op.effective_from and target_date < non_op.effective_from.date():
        return False
    if non_op.effective_to and target_date > non_op.effective_to.date():
        return False

    # year 체크
    if non_op.year is not None and target_date.year != non_op.year:
        return False

    # month 체크
    if non_op.month is not None and target_date.month != non_op.month:
        return False

    # day 체크 (특정 날짜)
    if non_op.day is not None and target_date.day != non_op.day:
        return False

    # weekday 체크
    if non_op.weekday is not None:
        target_weekday = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"][target_date.weekday()]
        if target_weekday != non_op.weekday:
            return False

    # month_week 체크 (n번째 주)
    if non_op.month_week is not None:
        week_of_month = (target_date.day - 1) // 7 + 1
        if week_of_month != non_op.month_week:
            return False

    return True
```

**공휴일 자동 등록 (시스템)**:
```python
# 2026년 대한민국 공휴일 예시
HOLIDAYS_2026 = [
    {"year": 2026, "month": 1, "day": 1, "reason": "신정"},
    {"year": 2026, "month": 1, "day": 27, "reason": "설날 연휴"},
    {"year": 2026, "month": 1, "day": 28, "reason": "설날"},
    {"year": 2026, "month": 1, "day": 29, "reason": "설날 연휴"},
    {"year": 2026, "month": 3, "day": 1, "reason": "삼일절"},
    # ...
]

async def register_holidays_for_center(center_id: str, year: int):
    """센터에 해당 연도 공휴일 일괄 등록"""
    for holiday in HOLIDAYS_2026:
        await non_operating_repo.create({
            "center_id": center_id,
            "year": holiday["year"],
            "month": holiday["month"],
            "day": holiday["day"],
            "reason": holiday["reason"],
            "created_by": "SYSTEM",
            "effective_from": datetime(year, 1, 1),
            "effective_to": datetime(year, 12, 31, 23, 59, 59),
        })
```

### 9. 특정 날짜 영업 여부 판단 로직

```python
async def is_operating_at(center_id: str, target_datetime: datetime) -> dict:
    """특정 시점에 센터가 영업 중인지 확인"""
    target_date = target_datetime.date()
    target_time = target_datetime.time()
    weekday = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"][target_date.weekday()]

    # 1. 기본 영업시간 조회
    operating = await operating_time_repo.get_by_weekday(center_id, weekday)
    if not operating or operating.open_time is None or operating.close_time is None:
        return {"is_operating": False, "reason": "정기 휴무일"}

    # 2. 비영업시간 패턴 매칭
    non_operatings = await non_operating_repo.get_by_center(center_id)
    for non_op in non_operatings:
        if matches_date(non_op, target_date):
            # 시간 범위 체크
            if non_op.start_time is None:  # 종일
                return {"is_operating": False, "reason": non_op.reason}
            if non_op.start_time <= target_time < non_op.end_time:
                return {"is_operating": False, "reason": non_op.reason}

    # 3. 영업시간 범위 체크
    if target_time < operating.open_time or target_time >= operating.close_time:
        return {"is_operating": False, "reason": "영업시간 외"}

    # 4. 휴게시간 체크
    if operating.break_start_time and operating.break_end_time:
        if operating.break_start_time <= target_time < operating.break_end_time:
            return {"is_operating": False, "reason": "휴게시간"}

    return {"is_operating": True, "reason": None}
```

### 10. 멤버 규칙

| 규칙 | 설명 |
|------|------|
| **person_id 필수** | 가입된 Person만 Member 생성 가능 |
| **role_id 필수** | Auth 도메인의 Role FK 참조 |
| **permissions 복사** | 초대 수락 시 Role의 권한을 복사 |
| **권한 개별 수정** | 복사 후 Member별 권한 독립 수정 가능 |
| **멀티센터 지원** | Person 1:N Member |
| **프로필/경력/학력** | 센터별 독립 관리 (JSONB) |
| **근무시간** | MemberWorkingTime으로 요일별 관리 |
| **비근무시간** | MemberNonWorkingTime으로 휴가/반차 등 관리 |

**활성 멤버 조회**:
```sql
SELECT * FROM members
WHERE center_id = :center_id
  AND deleted_at IS NULL;
```

### 11. 멤버 초대 플로우

**토큰 기반 초대 URL 방식**

```
1. POST /centers/{center_id}/invitations
   - 센터장이 초대 정보 입력 (name, email, role_id)
   - MemberInvitation 레코드 생성 (expires_at = now + 7일)
   - 서버가 초대 토큰 생성: token = sign(invitation_id, server_secret)
   - 이메일 발송 (초대 링크 포함)

2. 초대 이메일
   - 초대 링크: /invitations/accept?token={SIGNED_TOKEN}
   - 토큰에 invitation_id가 암호화되어 있어 직접 노출되지 않음

3. GET /invitations/accept?token={token}
   - 토큰 검증: invitation_id = verify(token, server_secret)
   - 초대 정보 조회 (만료 여부, 이미 수락 여부 확인)
   - 가입 화면 표시 (name, email은 readonly, 추가 정보 입력)

4. POST /invitations/accept?token={token}
   - 토큰 재검증
   - 추가 정보 수집: phone, birth, gender, employment_type, password(신규)
   - 신규 회원: Person + Account 생성
   - 기존 회원: Person 정보 업데이트 (optional)
   - Member 생성:
     - person_id = Person.id
     - role_id = Invitation.role_id
     - permissions = Role의 기본 권한 복사
     - employment_type = 입력받은 값
   - MemberInvitation 업데이트:
     - member_id = 생성된 Member.id
     - membered_at = now()
```

**토큰 생성 예시**:
```python
# 초대 생성 시
invitation = await invitation_repo.create({...})
token = generate_invitation_token(str(invitation.id), settings.SECRET_KEY)
invitation_url = f"{settings.FRONTEND_URL}/invitations/accept?token={token}"
# 이메일 발송
await send_invitation_email(invitation.email, invitation_url)
```

### 12. 초대 만료 처리

| 규칙 | 설명 |
|------|------|
| **만료 초대 엄격 차단** | 만료된 초대로는 가입 불가, 재초대 필요 |
| **보안 강화** | 오래된 초대 악용 방지 |
| **관리자 제어** | 관리자가 초대 상태 명확히 제어 |

**구현**:
```python
async def get_invitation_info_handler(token: str, ...):
    """초대 정보 조회 (가입 화면 진입 시)"""
    # 1. 토큰 검증
    invitation_id = verify_invitation_token(token, settings.SECRET_KEY)
    if not invitation_id:
        raise HTTPException(400, "Invalid invitation token")

    # 2. 초대 조회
    invitation = await invitation_repo.get(invitation_id)
    if not invitation:
        raise HTTPException(404, "Invitation not found")

    # 3. 이미 수락 확인
    if invitation.member_id:
        raise HTTPException(400, "Invitation already accepted")

    # 4. 만료 확인 (엄격 차단)
    if invitation.expires_at < datetime.utcnow():
        raise HTTPException(400, {
            "message": "Invitation has expired",
            "action": "Please request a new invitation from the center administrator"
        })

    # 5. 초대 정보 반환 → 프론트엔드가 로그인/가입 페이지로 위임
    return InvitationInfoResponse(
        invitation_id=invitation.id,
        center_id=invitation.center_id,
        name=invitation.name,
        email=invitation.email,
        role_id=invitation.role_id,
    )
```

> 이후 회원가입/로그인 및 Member 생성은 Auth 도메인에서 처리한다.
> 상세 플로우는 `/docs/auth/domain.md` 참조

### 13. 동일 이메일 중복 초대

| 규칙 | 설명 |
|------|------|
| **자동 덮어쓰기 (Upsert)** | 동일 이메일로 대기 중인 초대가 있으면 갱신 |
| **단일 API 호출** | 기존 초대 취소 + 재초대 불필요 |
| **항상 최신 초대** | role_id, expires_at 갱신 |
| **중복 방지 방식** | 애플리케이션 레벨에서 "있으면 UPDATE, 없으면 INSERT"로 처리 |

**구현**:
```python
async def create_invitation_handler(center_id: str, data: MemberInvitationCreate, ...):
    # Upsert 처리
    existing = await invitation_repo.get_pending_by_email_and_center(
        email=data.email,
        center_id=center_id
    )

    if existing:
        # UPDATE: 기존 초대 갱신
        await invitation_repo.update(existing.id, {
            "name": data.name,
            "role_id": data.role_id,
            "expires_at": datetime.utcnow() + timedelta(days=7)
        })
        return existing
    else:
        # INSERT: 새 초대 생성
        return await invitation_repo.create({
            "center_id": center_id,
            "invited_by": current_user.person_id,
            "name": data.name,
            "email": data.email,
            "role_id": data.role_id,
            "expires_at": datetime.utcnow() + timedelta(days=7),
        })
```

### 14. 멤버 권한과 JWT 동기화

| 상황 | 설명 |
|------|------|
| **문제** | 센터 관리자가 멤버 권한 변경 → 멤버의 기존 JWT와 불일치 |
| **결정** | Auth 도메인에서 결정 예정 |

> 상세 내용은 `/docs/auth/edge-cases.md` 참조

### 16. 역할 변경과 권한 처리

| 규칙 | 설명 |
|------|------|
| **역할 변경 시 권한 재설정** | 새 역할의 기본 권한으로 자동 재설정 |
| **이전 권한 유지 안 함** | 불필요한 권한 잔존 방지 |
| **관리자 의도 명확** | 역할 = 권한 세트 |

**구현**:
```python
async def update_member_handler(member_id: str, data: MemberUpdate, ...):
    update_data = data.model_dump(exclude_unset=True)

    # 역할 변경 시 권한도 새 역할 기본값으로 재설정
    if data.role_id is not None:
        role = await role_repo.get(data.role_id)
        role_permissions = await role_repo.get_permissions(role.id)
        update_data["permissions"] = [p.code for p in role_permissions]

    await member_repo.update(member_id, update_data)
```

### 17. 권한 복사 정책

| 규칙 | 설명 |
|------|------|
| **초대 수락 시 복사** | Role의 권한을 Member.permissions에 복사 |
| **독립적 관리** | 복사 후 Member 권한은 Role과 독립 (개별 수정 가능) |
| **Role 수정 영향 없음** | Role 수정해도 기존 Member 권한 변경 없음 |
| **역할 변경 시 재설정** | Member 역할 변경 시 새 역할 권한으로 재설정 |
| **신규 멤버** | 신규 멤버는 수정된 Role의 최신 권한 받음 |

### 18. 마지막 관리자 제거 방지

| 규칙 | 설명 |
|------|------|
| **최소 1명 관리자 유지** | 관리자 없는 센터 방지 |
| **역할 변경 시 체크** | 관리자 → 일반 역할 변경 시 확인 |
| **센터 삭제 유도** | 관리자 제거 필요 시 센터 비활성화로 유도 |

**구현**:
```python
async def update_member_handler(member_id: str, data: MemberUpdate, ...):
    member = await member_repo.get(member_id)

    # 관리자 역할에서 다른 역할로 변경 시
    if data.role_id is not None and is_admin_role(member.role_id) and not is_admin_role(data.role_id):
        admin_count = await member_repo.count_admins(member.center_id)
        if admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Cannot remove the last administrator",
                    "action": "Assign another administrator first, or deactivate the center"
                }
            )

    # ... 업데이트 진행
```

### 19. 멤버 종료 처리

| 방식 | 용도 |
|------|------|
| **Soft Delete** | 퇴사/계약 종료 등 멤버 종료 처리 (deleted_at 설정) |

---

### 20. 기본 엣지 케이스

| # | 엣지 케이스 | HTTP 코드 | 설명 |
|---|------------|----------|------|
| 1 | 존재하지 않는 센터 코드 | 404 | 센터 가입 시 코드 검증 |
| 2 | 이미 수락된 초대 | 400 | accepted_at 확인 |
| 3 | 초대 없이 가입 시도 | 400 | 이메일로 초대 조회 |
| 4 | 이미 센터 멤버 | 409 | 중복 멤버 확인 |
| 5 | 존재하지 않는 역할 | 400 | role_id FK 검증 |
| 6 | 유효하지 않은 권한 코드 | 400 | permissions 테이블 확인 |
| 7 | 삭제된 센터 접근 | 403 | deleted_at 확인 |
| 8 | 비활성 상담실 예약 | 400 | is_active 확인 |
| 9 | 잘못된 weekday 값 | 422 | enum 검증 |
| 10 | 시간 범위 오류 | 400 | start_time < end_time |

---

## API 엔드포인트

### CenterApplication API

#### 센터 등록 신청

```http
POST /centers/applications
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "name": "마음건강 상담센터",
  "phone": "02-1234-5678",
  "address": {
    "zip_code": "06234",
    "address": "서울특별시 강남구 테헤란로 123",
    "detail": "4층 401호"
  },
  "description": "전문 상담사가 함께하는 마음건강 센터입니다.",
  "business_registration_number": "123-45-67890",
  "representative_name": "홍길동"
}
```

**응답 (201 Created)**:
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440001",
  "created_by": "880e8400-e29b-41d4-a716-446655440000",
  "name": "마음건강 상담센터",
  "phone": "02-1234-5678",
  "address": {
    "zip_code": "06234",
    "address": "서울특별시 강남구 테헤란로 123",
    "detail": "4층 401호"
  },
  "description": "전문 상담사가 함께하는 마음건강 센터입니다.",
  "business_registration_number": "123-45-67890",
  "representative_name": "홍길동",
  "status": "PENDING",
  "reviewed_at": null,
  "reviewed_by": null,
  "reviewed_reason": null,
  "center_id": null,
  "created_at": "2026-01-15T10:00:00",
  "updated_at": "2026-01-15T10:00:00"
}
```

#### 내 등록 신청 목록 조회

```http
GET /centers/applications/me
Authorization: Bearer {access_token}
```

**Query Parameters**:
- `status`: `PENDING` | `APPROVED` | `REJECTED` (optional)

#### 등록 신청 상세 조회

```http
GET /centers/applications/{application_id}
Authorization: Bearer {access_token}
```

#### 등록 신청 수정 (대기 중일 때만)

```http
PATCH /centers/applications/{application_id}
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "phone": "02-9999-8888",
  "description": "수정된 설명입니다."
}
```

#### 등록 신청 취소

```http
DELETE /centers/applications/{application_id}
Authorization: Bearer {access_token}
```

**동작**: `deleted_at`을 설정하는 Soft Delete

**주의**:
- `status=PENDING`이고 `deleted_at IS NULL`일 때만 취소 가능
- 취소된 신청은 조회/승인/수정 대상에서 제외 (필요 시 별도 관리자 조회로만 확인)

---

#### 등록 신청 목록 조회 (플랫폼 관리자)

```http
GET /admin/center-applications
Authorization: Bearer {admin_token}
```

**Query Parameters**:
- `status`: `PENDING` | `APPROVED` | `REJECTED` (optional)
- `page`: 페이지 번호 (default: 1)
- `size`: 페이지 크기 (default: 20)

**응답 (200 OK)**:
```json
{
  "items": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440001",
      "name": "마음건강 상담센터",
      "status": "PENDING",
      "created_at": "2026-01-15T10:00:00"
    }
  ],
  "total": 1,
  "page": 1,
  "size": 20,
  "pages": 1
}
```

#### 등록 신청 승인 (플랫폼 관리자)

```http
POST /admin/center-applications/{application_id}/approve
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "logo_url": "https://example.com/logo.png"
}
```

**응답 (200 OK)**:
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440001",
  "created_by": "880e8400-e29b-41d4-a716-446655440000",
  "name": "마음건강 상담센터",
  "status": "APPROVED",
  "reviewed_at": "2026-01-16T10:00:00",
  "reviewed_by": "880e8400-e29b-41d4-a716-446655440000",
  "reviewed_reason": null,
  "center_id": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2026-01-15T10:00:00",
  "updated_at": "2026-01-16T10:00:00"
}
```

#### 등록 신청 거절 (플랫폼 관리자)

```http
POST /admin/center-applications/{application_id}/reject
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "reviewed_reason": "사업자 등록번호가 유효하지 않습니다. 확인 후 재신청해 주세요."
}
```

**응답 (200 OK)**:
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440001",
  "created_by": "880e8400-e29b-41d4-a716-446655440000",
  "name": "마음건강 상담센터",
  "status": "REJECTED",
  "reviewed_at": "2026-01-16T10:00:00",
  "reviewed_by": "880e8400-e29b-41d4-a716-446655440000",
  "reviewed_reason": "사업자 등록번호가 유효하지 않습니다. 확인 후 재신청해 주세요.",
  "center_id": null,
  "created_at": "2026-01-15T10:00:00",
  "updated_at": "2026-01-16T10:00:00"
}
```

---

### Center API

#### 센터 생성 (플랫폼 관리자)

```http
POST /centers
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "name": "마음건강 상담센터",
  "phone": "02-1234-5678",
  "address": {
    "zip_code": "06234",
    "address": "서울특별시 강남구 테헤란로 123",
    "detail": "4층 401호"
  },
  "description": "전문 상담사가 함께하는 마음건강 센터입니다.",
  "logo_url": "https://example.com/logo.png",
  "business_registration_number": "123-45-67890",
  "representative_name": "홍길동"
}
```

**응답 (201 Created)**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "마음건강 상담센터",
  "code": "A3K9M2",
  "phone": "02-1234-5678",
  "address": {
    "zip_code": "06234",
    "address": "서울특별시 강남구 테헤란로 123",
    "detail": "4층 401호"
  },
  "description": "전문 상담사가 함께하는 마음건강 센터입니다.",
  "logo_url": "https://example.com/logo.png",
  "business_registration_number": "123-45-67890",
  "representative_name": "홍길동",
  "created_at": "2026-01-15T10:00:00",
  "updated_at": "2026-01-15T10:00:00"
}
```

#### 센터 조회

```http
GET /centers/{center_id}
Authorization: Bearer {access_token}
```

#### 센터 수정

```http
PATCH /centers/{center_id}
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "phone": "02-9999-8888",
  "description": "업데이트된 설명입니다."
}
```

---

### Room API

#### 상담실 생성

```http
POST /centers/{center_id}/rooms
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "name": "상담실 A",
  "memo": "창가 쪽, 조용한 분위기"
}
```

#### 상담실 목록 조회

```http
GET /centers/{center_id}/rooms
Authorization: Bearer {access_token}
```

#### 상담실 삭제 (Soft Delete)

```http
DELETE /centers/{center_id}/rooms/{room_id}
Authorization: Bearer {access_token}
```

**일정이 존재하는 경우**:
- 서버는 `requires_confirmation=true` 응답을 반환한다.
- UI는 사용자에게 삭제 확인을 요청한다.
- 사용자가 확인하면 `DELETE /centers/{center_id}/rooms/{room_id}?confirm=true`로 재요청한다.
- 확인 삭제가 수행되면 Room은 Soft Delete되고, 해당 Room을 참조하던 Schedule들의 `room_id`는 `NULL`로 변경된다.

---

### OperatingTime API

#### 영업시간 목록 조회

```http
GET /centers/{center_id}/operating-times
Authorization: Bearer {access_token}
```

**응답 (200 OK)**:
```json
{
  "items": [
    {
      "id": "...",
      "center_id": "...",
      "weekday": "MON",
      "open_time": "09:00:00",
      "close_time": "18:00:00",
      "break_start_time": "12:00:00",
      "break_end_time": "13:00:00",
      "created_at": "2026-01-15T10:00:00",
      "updated_at": "2026-01-15T10:00:00"
    },
    {
      "id": "...",
      "center_id": "...",
      "weekday": "SAT",
      "open_time": null,
      "close_time": null,
      "break_start_time": null,
      "break_end_time": null,
      "created_at": "2026-01-15T10:00:00",
      "updated_at": "2026-01-15T10:00:00"
    }
  ]
}
```

#### 영업시간 일괄 수정

```http
PUT /centers/{center_id}/operating-times
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "items": [
    {"weekday": "MON", "open_time": "09:00", "close_time": "18:00", "break_start_time": "12:00", "break_end_time": "13:00"},
    {"weekday": "TUE", "open_time": "09:00", "close_time": "18:00"},
    {"weekday": "WED", "open_time": "09:00", "close_time": "18:00"},
    {"weekday": "THU", "open_time": "09:00", "close_time": "18:00"},
    {"weekday": "FRI", "open_time": "09:00", "close_time": "17:00"},
    {"weekday": "SAT", "open_time": null, "close_time": null},
    {"weekday": "SUN", "open_time": null, "close_time": null}
  ]
}
```

**예약(Schedule)이 존재하는 경우 (확인 후 삭제 → 변경)**:
- 영업시간 변경으로 인해 **영업시간/휴게시간 범위 밖**이 되거나, **휴무일(null)** 로 바뀌는 날짜에 포함되는 **미래 일정**(예: `start_at >= now()`)이 존재하면 서버는 바로 변경하지 않고 `requires_confirmation=true`로 응답한다.
- UI는 사용자에게 “변경 시 영향을 받는 예약이 삭제됩니다. 진행하시겠습니까?” 확인을 요청한다.
- 사용자가 확인하면 `PUT /centers/{center_id}/operating-times?confirm=true` 로 동일 payload를 재요청한다.
- 확인 요청(`confirm=true`)에서는 서버가 영향을 받는 미래 일정을 **삭제(또는 취소 처리)** 한 뒤 영업시간을 변경한다. 이 작업은 트랜잭션으로 처리되어야 한다(일정 삭제/영업시간 변경 중 일부만 반영되지 않도록).

**확인 필요 응답 예시 (409 Conflict)**:
```json
{
  "requires_confirmation": true,
  "message": "영업시간 변경으로 인해 삭제될 예약이 있습니다.",
  "affected_schedules_count": 3
}
```

---

### NonOperatingTime API

#### 비영업시간 목록 조회

```http
GET /centers/{center_id}/non-operating-times
Authorization: Bearer {access_token}
```

**Query Parameters**:
- `created_by`: `SYSTEM` | `CENTER` (optional) - 생성자 필터
- `year`: `2026` (optional) - 연도 필터

**응답 (200 OK)**:
```json
{
  "items": [
    {
      "id": "...",
      "center_id": "...",
      "year": 2026,
      "month": 1,
      "day": 1,
      "month_week": null,
      "weekday": null,
      "start_time": null,
      "end_time": null,
      "effective_from": "2026-01-01T00:00:00",
      "effective_to": "2026-12-31T23:59:59",
      "reason": "신정",
      "created_by": "SYSTEM",
      "created_at": "2026-01-15T10:00:00",
      "updated_at": "2026-01-15T10:00:00"
    },
    {
      "id": "...",
      "center_id": "...",
      "year": null,
      "month": null,
      "day": null,
      "month_week": 2,
      "weekday": "TUE",
      "start_time": null,
      "end_time": null,
      "effective_from": "2026-01-01T00:00:00",
      "effective_to": null,
      "reason": "4.5일제 (둘째주 화요일)",
      "created_by": "CENTER",
      "created_at": "2026-01-15T10:00:00",
      "updated_at": "2026-01-15T10:00:00"
    }
  ],
  "total": 2,
  "page": 1,
  "size": 20,
  "pages": 1
}
```

#### 비영업시간 생성

```http
POST /centers/{center_id}/non-operating-times
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "month_week": 2,
  "weekday": "TUE",
  "reason": "4.5일제 (둘째주 화요일)",
  "effective_from": "2026-01-01T00:00:00"
}
```

**예약(Schedule)이 존재하는 경우 (확인 후 삭제 → 생성)**:
- 비영업시간 생성으로 인해 해당 기간/시간대가 **영업 불가**가 되며, 그 범위에 포함되는 **미래 일정**(예: `start_at >= now()`)이 존재하면 서버는 바로 생성하지 않고 `requires_confirmation=true`로 응답한다.
- UI는 사용자에게 “생성 시 영향을 받는 예약이 삭제됩니다. 진행하시겠습니까?” 확인을 요청한다.
- 사용자가 확인하면 `POST /centers/{center_id}/non-operating-times?confirm=true` 로 동일 payload를 재요청한다.
- 확인 요청(`confirm=true`)에서는 서버가 영향을 받는 미래 일정을 **삭제(또는 취소 처리)** 한 뒤 비영업시간을 생성한다. 이 작업은 트랜잭션으로 처리되어야 한다.

**확인 필요 응답 예시 (409 Conflict)**:
```json
{
  "requires_confirmation": true,
  "message": "비영업시간 생성으로 인해 삭제될 예약이 있습니다.",
  "affected_schedules_count": 3
}
```

**응답 (201 Created)**:
```json
{
  "id": "...",
  "center_id": "...",
  "year": null,
  "month": null,
  "day": null,
  "month_week": 2,
  "weekday": "TUE",
  "start_time": null,
  "end_time": null,
  "effective_from": "2026-01-01T00:00:00",
  "effective_to": null,
  "reason": "4.5일제 (둘째주 화요일)",
  "created_by": "CENTER",
  "created_at": "2026-01-15T10:00:00",
  "updated_at": "2026-01-15T10:00:00"
}
```

#### 비영업시간 수정

```http
PATCH /centers/{center_id}/non-operating-times/{non_operating_time_id}
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "effective_to": "2026-12-31T23:59:59",
  "reason": "4.5일제 종료"
}
```

**예약(Schedule)이 존재하는 경우 (확인 후 삭제 → 수정)**:
- 비영업시간 수정으로 인해(예: `effective_from/to` 확장, `start_time/end_time` 추가/변경, 패턴 변경 등) **추가로 영업 불가**가 되는 범위에 포함되는 **미래 일정**이 존재하면 서버는 바로 수정하지 않고 `requires_confirmation=true`로 응답한다.
- UI는 사용자에게 “수정 시 영향을 받는 예약이 삭제됩니다. 진행하시겠습니까?” 확인을 요청한다.
- 사용자가 확인하면 `PATCH /centers/{center_id}/non-operating-times/{non_operating_time_id}?confirm=true` 로 재요청한다.
- 확인 요청(`confirm=true`)에서는 서버가 영향을 받는 미래 일정을 **삭제(또는 취소 처리)** 한 뒤 비영업시간을 수정한다. 이 작업은 트랜잭션으로 처리되어야 한다.

**확인 필요 응답 예시 (409 Conflict)**:
```json
{
  "requires_confirmation": true,
  "message": "비영업시간 수정으로 인해 삭제될 예약이 있습니다.",
  "affected_schedules_count": 3
}
```

#### 비영업시간 삭제

```http
DELETE /centers/{center_id}/non-operating-times/{non_operating_time_id}
Authorization: Bearer {access_token}
```

**주의**: `created_by=SYSTEM`인 항목은 삭제 불가 (400 Bad Request)

---

### 영업 상태 조회 API

> **30분 블록 개념**: 시간은 30분 단위 블록으로 관리됩니다. 예를 들어 "14:00 블록"은 14:00:00 ~ 14:29:59를 의미합니다.

```http
GET /centers/{center_id}/operating-status
Authorization: Bearer {access_token}
```

**Query Parameters**:
- `date`: ISO 8601 날짜 형식 (required) - 예: `2026-01-15`
- `slot`: HH:MM 형식 (optional) - 예: `14:00`

#### 전체 슬롯 조회 (slot 미지정)

```
GET /centers/{center_id}/operating-status?date=2026-01-15
```

**응답 (200 OK)**:
```json
{
  "date": "2026-01-15",
  "available_slots": ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"]
}
```

**휴무일인 경우**:
```json
{
  "date": "2026-01-01",
  "available_slots": []
}
```

#### 단일 슬롯 조회 (slot 지정)

```
GET /centers/{center_id}/operating-status?date=2026-01-15&slot=14:00
```

**응답 (200 OK)**:
```json
{
  "date": "2026-01-15",
  "slot": "14:00",
  "is_operating": true,
  "reason": null
}
```

**비영업 중인 경우**:
```json
{
  "date": "2026-01-01",
  "slot": "14:00",
  "is_operating": false,
  "reason": "신정"
}
```

**reason 값 예시**:
- `null`: 영업 중
- `"휴무일"`: 해당 요일이 휴무
- `"영업시간 외"`: 영업시간 범위 밖
- `"휴게시간"`: 휴게시간 내
- `"신정"`, `"설날"` 등: NonOperatingTime의 reason

**로직**:
1. 해당 요일의 OperatingTime 조회 (open_time ~ close_time)
2. 휴게시간 블록 제외 (break_start_time ~ break_end_time)
3. NonOperatingTime 패턴 매칭되는 블록 제외
4. 30분 단위로 분할하여 반환

---

### MemberInvitation API

#### 멤버 초대 생성

```http
POST /centers/{center_id}/invitations
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "name": "김상담사",
  "email": "newmember@example.com",
  "role_id": 2
}
```

**응답 (201 Created)**:
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "center_id": "550e8400-e29b-41d4-a716-446655440000",
  "invited_by": "880e8400-e29b-41d4-a716-446655440000",
  "name": "김상담사",
  "email": "newmember@example.com",
  "role_id": 2,
  "role_name": "상담사",
  "member_id": null,
  "membered_at": null,
  "expires_at": "2026-01-22T10:00:00",
  "created_at": "2026-01-15T10:00:00"
}
```

**이메일 발송**:
- 초대 생성 후 이메일로 초대 링크 발송
- 초대 링크: `{FRONTEND_URL}/invitations/accept?token={SIGNED_TOKEN}`

#### 초대 목록 조회

```http
GET /centers/{center_id}/invitations
Authorization: Bearer {access_token}
```

**Query Parameters**:
- `status`: `pending` | `accepted` | `expired` (optional)

#### 초대 취소

```http
DELETE /centers/{center_id}/invitations/{invitation_id}
Authorization: Bearer {access_token}
```

#### 초대 정보 조회 (토큰 기반)

```http
GET /invitations/accept?token={SIGNED_TOKEN}
```

**응답 (200 OK)**:
```json
{
  "invitation_id": "660e8400-e29b-41d4-a716-446655440001",
  "center_id": "550e8400-e29b-41d4-a716-446655440000",
  "center_name": "마음건강 상담센터",
  "name": "김상담사",
  "email": "newmember@example.com",
  "role_id": 2,
  "role_name": "상담사",
  "expires_at": "2026-01-22T10:00:00"
}
```

**에러 (400 Bad Request)**:
```json
{
  "detail": "Invalid invitation token"
}
```

**에러 (400 Bad Request)** - 만료:
```json
{
  "detail": {
    "message": "Invitation has expired",
    "action": "Please request a new invitation from the center administrator"
  }
}
```

> 초대 정보 조회 후 프론트엔드가 로그인/회원가입 페이지로 위임한다.
> 회원가입 및 Member 생성은 Auth 도메인에서 처리한다.

---

### Member API

> 센터 가입(Member 생성)은 초대 토큰 기반으로 Auth 도메인에서 처리한다.
> 상세 플로우는 `/docs/auth/domain.md` 참조

#### 멤버 목록 조회 (센터 멤버)

```http
GET /centers/{center_id}/members
Authorization: Bearer {access_token}
```

**응답 (200 OK)**:
```json
{
  "items": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440003",
      "role_id": 2,
      "role_name": "상담사",
      "employment_type": "FULLTIME",
      "permissions": ["client:read", "counseling:read", "counseling:create"],
      "profile_image_url": null,
      "certifications": null,
      "person": {
        "id": "990e8400-e29b-41d4-a716-446655440004",
        "name": "김상담사",
        "phone": "010-1234-5678"
      }
    }
  ],
  "total": 1,
  "page": 1,
  "size": 20,
  "pages": 1
}
```

#### 멤버 권한 수정

```http
PATCH /centers/{center_id}/members/{member_id}
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "permissions": ["client:read", "client:create", "counseling:read", "counseling:create"]
}
```

### MemberWorkingTime API

#### 멤버 근무시간 목록 조회

```http
GET /centers/{center_id}/members/{member_id}/working-times
Authorization: Bearer {access_token}
```

**응답 (200 OK)**:
```json
{
  "items": [
    {
      "id": "...",
      "center_id": "...",
      "member_id": "...",
      "weekday": "MON",
      "start_time": "09:00:00",
      "end_time": "18:00:00",
      "break_start_time": "12:00:00",
      "break_end_time": "13:00:00",
      "created_at": "2026-01-15T10:00:00",
      "updated_at": "2026-01-15T10:00:00"
    },
    {
      "id": "...",
      "center_id": "...",
      "member_id": "...",
      "weekday": "SAT",
      "start_time": null,
      "end_time": null,
      "break_start_time": null,
      "break_end_time": null,
      "created_at": "2026-01-15T10:00:00",
      "updated_at": "2026-01-15T10:00:00"
    }
  ]
}
```

#### 멤버 근무시간 일괄 수정

```http
PUT /centers/{center_id}/members/{member_id}/working-times
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "items": [
    {"weekday": "MON", "start_time": "09:00", "end_time": "18:00", "break_start_time": "12:00", "break_end_time": "13:00"},
    {"weekday": "TUE", "start_time": "09:00", "end_time": "18:00"},
    {"weekday": "WED", "start_time": "09:00", "end_time": "18:00"},
    {"weekday": "THU", "start_time": "09:00", "end_time": "18:00"},
    {"weekday": "FRI", "start_time": "09:00", "end_time": "17:00"},
    {"weekday": "SAT", "start_time": null, "end_time": null},
    {"weekday": "SUN", "start_time": null, "end_time": null}
  ]
}
```

---

### MemberNonWorkingTime API

#### 멤버 비근무시간 목록 조회

```http
GET /centers/{center_id}/members/{member_id}/non-working-times
Authorization: Bearer {access_token}
```

**Query Parameters**:
- `year`: `2026` (optional) - 연도 필터
- `reason`: `ANNUAL_LEAVE` | `HALF_DAY_AM` | ... (optional) - 사유 필터

**응답 (200 OK)**:
```json
{
  "items": [
    {
      "id": "...",
      "center_id": "...",
      "member_id": "...",
      "year": 2026,
      "month": 2,
      "day": 15,
      "month_week": null,
      "weekday": null,
      "start_time": null,
      "end_time": null,
      "effective_from": "2026-02-15T00:00:00",
      "effective_to": "2026-02-15T23:59:59",
      "reason": "ANNUAL_LEAVE",
      "description": "개인 휴가",
      "created_at": "2026-01-15T10:00:00",
      "updated_at": "2026-01-15T10:00:00"
    },
    {
      "id": "...",
      "center_id": "...",
      "member_id": "...",
      "year": 2026,
      "month": 3,
      "day": 5,
      "month_week": null,
      "weekday": null,
      "start_time": "09:00:00",
      "end_time": "13:00:00",
      "effective_from": "2026-03-05T00:00:00",
      "effective_to": "2026-03-05T23:59:59",
      "reason": "HALF_DAY_AM",
      "description": "병원 진료",
      "created_at": "2026-01-20T10:00:00",
      "updated_at": "2026-01-20T10:00:00"
    }
  ],
  "total": 2,
  "page": 1,
  "size": 20,
  "pages": 1
}
```

#### 멤버 비근무시간 생성

```http
POST /centers/{center_id}/members/{member_id}/non-working-times
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "year": 2026,
  "month": 2,
  "day": 15,
  "reason": "ANNUAL_LEAVE",
  "description": "개인 휴가",
  "effective_from": "2026-02-15T00:00:00",
  "effective_to": "2026-02-15T23:59:59"
}
```

**응답 (201 Created)**:
```json
{
  "id": "...",
  "center_id": "...",
  "member_id": "...",
  "year": 2026,
  "month": 2,
  "day": 15,
  "month_week": null,
  "weekday": null,
  "start_time": null,
  "end_time": null,
  "effective_from": "2026-02-15T00:00:00",
  "effective_to": "2026-02-15T23:59:59",
  "reason": "ANNUAL_LEAVE",
  "description": "개인 휴가",
  "created_at": "2026-01-15T10:00:00",
  "updated_at": "2026-01-15T10:00:00"
}
```

#### 멤버 비근무시간 수정

```http
PATCH /centers/{center_id}/members/{member_id}/non-working-times/{non_working_time_id}
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "description": "개인 휴가 (연장)"
}
```

#### 멤버 비근무시간 삭제

```http
DELETE /centers/{center_id}/members/{member_id}/non-working-times/{non_working_time_id}
Authorization: Bearer {access_token}
```

---

### 멤버 근무 상태 조회 API

> **30분 블록 개념**: 시간은 30분 단위 블록으로 관리됩니다. 예를 들어 "14:00 블록"은 14:00:00 ~ 14:29:59를 의미합니다.

```http
GET /centers/{center_id}/members/{member_id}/working-status
Authorization: Bearer {access_token}
```

**Query Parameters**:
- `date`: ISO 8601 날짜 형식 (required) - 예: `2026-01-15`
- `slot`: HH:MM 형식 (optional) - 예: `14:00`

#### 전체 슬롯 조회 (slot 미지정)

```
GET /centers/{center_id}/members/{member_id}/working-status?date=2026-01-15
```

**응답 (200 OK)**:
```json
{
  "date": "2026-01-15",
  "available_slots": ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"]
}
```

**비근무일인 경우**:
```json
{
  "date": "2026-01-15",
  "available_slots": []
}
```

#### 단일 슬롯 조회 (slot 지정)

```
GET /centers/{center_id}/members/{member_id}/working-status?date=2026-01-15&slot=14:00
```

**응답 (200 OK)**:
```json
{
  "date": "2026-01-15",
  "slot": "14:00",
  "is_working": true,
  "reason": null
}
```

**근무 불가 시**:
```json
{
  "date": "2026-02-15",
  "slot": "14:00",
  "is_working": false,
  "reason": "연차"
}
```

**reason 값 예시**:
- `null`: 근무 가능
- `"비근무일"`: 해당 요일이 비근무
- `"근무시간 외"`: 근무시간 범위 밖
- `"휴게시간"`: 휴게시간 내
- `"연차"`, `"반차(오전)"`, `"병가"` 등: MemberNonWorkingTime의 reason

**로직**:
1. 해당 요일의 MemberWorkingTime 조회 (start_time ~ end_time)
2. 휴게시간 블록 제외 (break_start_time ~ break_end_time)
3. MemberNonWorkingTime 패턴 매칭되는 블록 제외
4. 30분 단위로 분할하여 반환

---

## 참고 문서

- **의사결정 기록**: `/docs/center/decision-log.md` - 설계 질문-답변 및 근거
- **시���리오**: `/docs/center/scenarios.md`
- **엣지 케이스**: `/docs/center/edge-cases.md`
- **Auth 도메인**: `/docs/auth/domain.md` - Role 참조
- **Person 도메인**: `/docs/person/domain.md` - Person 참조
- **프로젝트 설정**: `/CLAUDE.md` - 개발 규칙 및 아키텍처 패턴
