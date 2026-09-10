# Counseling 도메인 설계

> 상담센터의 상담 프로그램, 상담 케이스(계약 단위) 및 개별 상담 일정 기록(Session) 관리를 담당하는 도메인

---

## 목차

1. [도메인 개요](#도메인-개요)
2. [스키마 정의](#스키마-정의)
3. [비즈니스 규칙](#비즈니스-규칙)
4. [API 설계](#api-설계)
5. [구현 우선순위](#구현-우선순위)

---

## 도메인 개요

### 핵심 개념

**Counseling(상담 프로그램)**은 센터에서 제공하는 서비스 상품입니다:
- 언어치료, 놀이치료, 심리상담 등 센터가 판매하는 서비스
- 센터가 직접 정의하고 관리
- 기본 요금(price)과 소요시간(duration_minutes) 포함
- 담당 가능한 상담사 목록 (counselor_ids: JSONB 배열)
- 상담 유형 (counseling_type: individual/group/pair)

**CounselingCase(상담 케이스)**는 연속된 상담 여정의 단위입니다:
- 초기 면담 → 문제 탐색 → 해결 방안 → 종결까지의 과정
- 여러 CounselingSession으로 구성
- 케이스 단위로 추적성 및 통계 관리
- 계약/여정 단위 (계획된 총 회기 수 포함)

**CounselingSession(상담 일정 기록)**은 개별 상담 방문 기록입니다:
- 케이스 내 순차적 번호 (1, 2, 3...)
- 일정(Schedule)과 연동하여 예약/방문 정보 관리
- 상담 기록은 Document 도메인에 위임
- **참고**: 결제/청구 단위(회기)는 별도 Billing 도메인에서 관리

### 계층 구조

```
Counseling (상담 프로그램)
    - price: 기본 요금
    - duration_minutes: 소요 시간
    - counselor_ids: 담당자 ID 목록 (JSONB 배열)
    - counseling_type: 상담 유형 (individual, group, pair)
    ↓ 1:N
CounselingCase (상담 케이스 = 계약 단위)
    - counseling_id FK → Counseling
    ↓ 1:N
CounselingSession (상담 일정 기록 = 개별 상담 횟수)
    - counseling_case_id FK → CounselingCase
    - ScheduledRelation을 통해 Schedule과 연결 (중간 테이블)

ScheduledRelation (일정 연결) - Schedule 도메인
    - schedule_id + "counseling" + session_id 복합 키
    - Schedule 삭제 시 CASCADE 삭제
```

### 책임 (Responsibility)

- 상담 프로그램(Counseling) 센터별 관리 (요금, 소요시간, 담당자)
- 상담 케이스 생명주기 관리 (생성 → 진행 → 종결/취소)
- 개별 상담 일정 기록 관리 (순차 번호, 상태, Schedule 연동)
- 다대다 참여자 관리 (짝치료, 집단상담 지원)

### 의존성

- **Depends on**: Center (멀티테넌시), Client (내담자), CenterMember (상담사), Schedule (일정)
- **Depended by**: Document (상담 기록), Billing (비용 청구)

---

## 스키마 정의

### 1. Counseling (상담 프로그램)

```python
# app/modules/counseling/models.py
from sqlalchemy import String, Text, Integer, ForeignKey, DateTime, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from uuid import uuid4

class Counseling(Base):
    """
    상담 프로그램 엔티티 (센터별 관리)
    - 언어치료, 놀이치료, 심리상담 등 센터에서 제공하는 서비스 상품
    - 센터가 직접 정의하고 관리
    - 기본 요금 및 소요시간 포함
    - 담당자 목록을 JSONB 배열로 저장
    """
    __tablename__ = "counselings"

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

    # 프로그램 정보
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # "언어치료 - 개별", "놀이치료 - 그룹", "심리상담 - 부부"

    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 프로그램에 대한 설명

    # 요금 및 시간
    price: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # 기본 요금 (원 단위), 예: 30000

    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    # 소요 시간 (분 단위), 예: 120

    # 담당자 목록 (center_members.id 배열)
    counselor_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=[])
    # ["uuid1", "uuid2", ...] - 담당 가능한 상담사 ID 목록

    # 상담 유형
    counseling_type: Mapped[str] = mapped_column(String(20), nullable=False, default="individual")
    # "individual" (개별), "group" (그룹), "pair" (짝)

    # 타임스탬프
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # Indexes
    __table_args__ = (
        Index("ix_counselings_center", "center_id"),
        UniqueConstraint("center_id", "name", name="uq_counseling_name"),
    )
```

**필드 설명**:

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK | 프로그램 고유 ID |
| `center_id` | UUID | FK, NOT NULL | 센터 ID (멀티테넌시) |
| `name` | String(100) | NOT NULL, UNIQUE per center | 프로그램명 (예: "언어치료") |
| `description` | Text | NULL | 프로그램 설명 |
| `price` | Integer | NOT NULL, default=0 | 기본 요금 (원 단위) |
| `duration_minutes` | Integer | NOT NULL, default=60 | 소요 시간 (분 단위) |
| `counselor_ids` | JSONB | NOT NULL, default=[] | 담당자 ID 목록 (center_members.id 배열) |
| `counseling_type` | String(20) | NOT NULL, default="individual" | 상담 유형: individual, group, pair |
| `created_at` | DateTime | NOT NULL | 생성 일시 |
| `updated_at` | DateTime | NOT NULL | 수정 일시 |

---

### 2. CounselingCase (상담 케이스)

```python
class CounselingCase(Base):
    """
    상담 케이스 엔티티 (계약/여정 단위)
    - 연속된 상담 여정의 단위
    - N:M 참여자 관계 (짝치료, 집단상담)
    """
    __tablename__ = "counseling_cases"

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

    # 상담 유형 연결
    counseling_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("counselings.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )

    # 케이스별 메모 (선택)
    memo: Mapped[str | None] = mapped_column(Text, nullable=True)

    # 계획된 총 회기 수 (NULL = 무제한)
    total_sessions: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # 상태
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="ACTIVE",
        index=True
    )  # ACTIVE, COMPLETED, CANCELLED

    # 타임스탬프
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # Indexes
    __table_args__ = (
        Index("ix_counseling_cases_center_status", "center_id", "status"),
        Index("ix_counseling_cases_counseling", "counseling_id"),
    )
```

**필드 설명**:

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK | 케이스 고유 ID |
| `center_id` | UUID | FK, NOT NULL | 센터 ID (멀티테넌시) |
| `counseling_id` | UUID | FK, NOT NULL | 상담 유형 ID |
| `memo` | Text | NULL | 케이스별 메모 |
| `total_sessions` | Integer | NULL | 계획된 총 회기 수 (NULL = 무제한) |
| `status` | String(20) | NOT NULL | ACTIVE, COMPLETED, CANCELLED |
| `created_at` | DateTime | NOT NULL | 생성 일시 |
| `updated_at` | DateTime | NOT NULL | 수정 일시 |

---

### 3. CounselingSession (상담 일정 기록)

```python
class CounselingSession(Base):
    """
    상담 일정 기록 엔티티
    - 케이스 내 개별 상담 방문 기록
    - ScheduledRelation을 통해 Schedule과 연결 (중간 테이블)
    - 상담 기록 내용은 Document 도메인에 위임
    - 결제/청구 단위(회기)는 Billing 도메인에서 별도 관리
    """
    __tablename__ = "counseling_sessions"

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

    # 상담 케이스 연결
    counseling_case_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("counseling_cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # 순차 번호 (자동 할당)
    session_number: Mapped[int] = mapped_column(Integer, nullable=False)
    # 1, 2, 3... (케이스 내 순차, 방문 순서 추적용)

    # 상태
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="SCHEDULED",
        index=True
    )  # SCHEDULED, COMPLETED, NO_SHOW, CANCELLED

    # 타임스탬프
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # Indexes
    __table_args__ = (
        Index("ix_sessions_case", "counseling_case_id", "session_number"),
        Index("ix_sessions_center_status", "center_id", "status"),
        UniqueConstraint("counseling_case_id", "session_number", name="uq_session_number"),
    )

    # Note: Schedule 연동은 ScheduledRelation 중간 테이블을 통해 처리
    # ScheduledRelation(schedule_id, "counseling", session_id)
    # 자세한 내용은 /docs/schedule/domain.md 참조
```

**필드 설명**:

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK | 상담 일정 기록 고유 ID |
| `center_id` | UUID | FK, NOT NULL | 센터 ID |
| `counseling_case_id` | UUID | FK, NOT NULL | 케이스 ID |
| `session_number` | Integer | NOT NULL, UNIQUE per case | 순차 번호 (방문 순서 추적용) |
| `status` | String(20) | NOT NULL | SCHEDULED, COMPLETED, NO_SHOW, CANCELLED |

**Schedule 연동**:
- `schedule_id` FK 대신 `ScheduledRelation` 중간 테이블 사용
- `ScheduledRelation(schedule_id, "counseling", session_id)` 형태로 연결
- Schedule 삭제 시 ScheduledRelation CASCADE 삭제, Session은 유지
- 과거 기록 입력 시 ScheduledRelation 없이 Session만 생성 가능

---

### 4. CounselingCaseParticipant (케이스 참여자)

```python
class ParticipantType(str, Enum):
    """참여자 유형"""
    CLIENT = "client"
    COUNSELOR = "counselor"


class CounselingCaseParticipant(Base):
    """
    상담 케이스 참여자 (통합 테이블)
    - 내담자(client)와 상담사(counselor)를 단일 테이블로 관리
    - 짝치료, 가족상담, 집단상담 지원
    - assigned_at / unassigned_at으로 참여 기간 추적
    """
    __tablename__ = "counseling_case_participants"

    # 복합 PK
    counseling_case_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("counseling_cases.id", ondelete="CASCADE"),
        primary_key=True
    )
    participant_type: Mapped[str] = mapped_column(
        String(20),
        primary_key=True
    )  # "client" | "counselor"
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
        Index("ix_case_participants_participant", "participant_type", "participant_id"),
        Index("ix_case_participants_case_type", "counseling_case_id", "participant_type"),
    )
```

**필드 설명**:

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `counseling_case_id` | UUID | PK, FK | 케이스 ID |
| `participant_type` | String(20) | PK, NOT NULL | "client" \| "counselor" |
| `participant_id` | UUID | PK, NOT NULL | clients.id 또는 center_members.id |
| `assigned_at` | DateTime | NOT NULL | 참여 시작 일시 |
| `unassigned_at` | DateTime | NULL | 참여 종료 일시 (NULL = 현재 참여 중) |

> **설계 근거**:
> - `participant_type`으로 내담자/상담사 구분
> - `participant_id`는 type에 따라 clients.id 또는 center_members.id 참조
> - `assigned_at` / `unassigned_at`으로 참여 기간 추적 (상담사 교체 이력 관리)
> - 단일 테이블로 통합하여 일관된 참여자 관리

---

### 5. CounselingSessionParticipant (세션 참여자)

```python
class SessionParticipantStatus(str, Enum):
    """세션 참여 상태"""
    ATTENDED = "attended"      # 출석
    NO_SHOW = "no_show"        # 불참 (무단)
    EXCUSED = "excused"        # 불참 (사전 통보)
    LATE = "late"              # 지각


class CounselingSessionParticipant(Base):
    """
    상담 세션 참여자
    - 세션별 출석/불참 관리
    - 집단상담 출석 체크 지원
    """
    __tablename__ = "counseling_session_participants"

    # 복합 PK
    counseling_session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("counseling_sessions.id", ondelete="CASCADE"),
        primary_key=True
    )
    participant_type: Mapped[str] = mapped_column(
        String(20),
        primary_key=True
    )  # "client" | "counselor"
    participant_id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True
    )  # clients.id 또는 center_members.id

    # 출석 상태
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="attended"
    )  # attended, no_show, excused, late

    # 참여 기간 (세션 내 참여 시점)
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow
    )
    unassigned_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )  # NULL = 세션 끝까지 참여

    # Indexes
    __table_args__ = (
        Index("ix_session_participants_session", "counseling_session_id"),
        Index("ix_session_participants_participant", "participant_type", "participant_id"),
    )
```

**필드 설명**:

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `counseling_session_id` | UUID | PK, FK | 세션 ID |
| `participant_type` | String(20) | PK, NOT NULL | "client" \| "counselor" |
| `participant_id` | UUID | PK, NOT NULL | clients.id 또는 center_members.id |
| `status` | String(20) | NOT NULL | attended, no_show, excused, late |
| `assigned_at` | DateTime | NOT NULL | 참여 기록 시점 |
| `unassigned_at` | DateTime | NULL | 조기 종료 시점 (NULL = 끝까지 참여) |

> **설계 근거**:
> - 세션별 출석 관리 (집단상담 출석 체크)
> - `status`로 출석/불참 상태 명시적 기록
> - 케이스 참여자와 별도 관리 (세션에 참여하지 않은 케이스 참여자 가능)

---

## 비즈니스 규칙

### 1. 상담 케이스 생성 규칙

| 규칙 | 설명 | 검증 위치 |
|------|------|----------|
| **counseling_id 필수** | 상담 유형은 반드시 선택 | CounselingCaseCreate schema |
| **최소 1명 내담자** | CounselingCaseParticipant(type=client) 최소 1건 | Service |
| **최소 1명 상담사** | CounselingCaseParticipant(type=counselor) 최소 1건 | Service |
| **같은 센터 검증** | 내담자, 상담사 모두 같은 center_id | Service |
| **status 기본값** | 생성 시 status='ACTIVE' | Model default |

### 2. CounselingSession 생성 규칙

| 규칙 | 설명 | 검증 위치 |
|------|------|----------|
| **자동 번호 할당** | session_number = max(케이스 내) + 1 | Service |
| **첫 Session = 1** | 케이스 최초 Session은 1번 | Service |
| **케이스 ACTIVE만** | COMPLETED/CANCELLED 케이스에 Session 추가 불가 | Service |
| **Schedule 연동 선택** | schedule_id 전달 시 ScheduledRelation 생성, 과거 기록은 생략 가능 | Handler |

### 3. 상태 전이 규칙

**케이스 상태 (CounselingCase.status)**:

```
┌─────────┐
│ ACTIVE  │ ← 케이스 생성 초기 상태
└────┬────┘
     │ (1) 목표 달성        │ (2) 상담 취소
     ↓                      ↓
┌───────────┐          ┌───────────┐
│ COMPLETED │          │ CANCELLED │
└───────────┘          └───────────┘
   (최종 상태)            (최종 상태)
```

| 현재 상태 | 허용 전이 | 비고 |
|----------|----------|------|
| ACTIVE | COMPLETED, CANCELLED | 종결 또는 취소 |
| COMPLETED | - | 최종 상태 (재개 불가, 새 케이스 생성 유도) |
| CANCELLED | - | 최종 상태 (재개 불가, 새 케이스 생성 유도) |

> **정책**: 종결/취소된 케이스는 재개할 수 없습니다. 동일 내담자의 상담 재개가 필요한 경우 새 케이스를 생성합니다. 내담자의 상담 이력은 Client 기준으로 CounselingCaseParticipant를 JOIN하여 조회합니다.

**Session 상태 (CounselingSession.status)**:

| 현재 상태 | 허용 전이 | 비고 |
|----------|----------|------|
| SCHEDULED | COMPLETED, NO_SHOW, CANCELLED | 예약 → 완료/노쇼/취소 |
| COMPLETED | - | 완료 후 변경 불가 |
| NO_SHOW | COMPLETED | 노쇼 → 사후 진행으로 완료 처리 가능 |
| CANCELLED | SCHEDULED | 취소 → 재예약 |

### 4. 순차 번호 관리

```python
class CreateCounselingSessionService:
    async def execute(self, counseling_case_id: str, data: SessionCreate) -> CounselingSession:
        # 자동 번호 할당
        max_number = await self.repo.get_max_session_number(counseling_case_id)
        session_number = (max_number or 0) + 1

        session = CounselingSession(
            counseling_case_id=counseling_case_id,
            session_number=session_number,  # 자동 할당
            status="SCHEDULED",
            **data.model_dump()
        )
        return await self.repo.create(session)
```

**규칙**:
- 취소/노쇼 시에도 번호 유지 (결번 없음)
- Session 3번 취소 → session_number=3 유지, status=CANCELLED
- 다음 Session → session_number=4

### 5. Schedule 연동 규칙 (ScheduledRelation 패턴)

| 시나리오 | 처리 |
|----------|------|
| **예약 생성** | Schedule 생성 → CounselingSession 생성 → ScheduledRelation 생성 |
| **일정 취소** | Schedule 삭제 → ScheduledRelation CASCADE 삭제, Session.status=CANCELLED |
| **과거 기록 입력** | Schedule 없이 CounselingSession만 생성, ScheduledRelation 없음 |
| **일정 변경** | Schedule만 수정, CounselingSession 및 ScheduledRelation 영향 없음 |
| **세션 삭제** | ScheduledRelation 삭제 → Session 삭제, Schedule은 유지 (재사용 가능) |

**ScheduledRelation 구조**:
```python
# 복합 PK: (schedule_id, scheduled_resource_type, scheduled_resource_id)
ScheduledRelation(
    schedule_id="...",
    scheduled_resource_type="counseling",
    scheduled_resource_id=session.id
)
```

### 6. 상담일지 관리 (Document 도메인 위임)

> **핵심 원칙**: 상담일지는 CounselingSession 테이블에 직접 저장하지 않고, **Document 도메인의 Service를 사용**하여 관리합니다.

#### 위임 원칙

- **저장/수정/삭제**: `DocumentService`를 호출하여 처리
- **조회**: `DocumentService.get_by_entity()`로 Session에 연결된 Document 목록 조회
- **권한 관리**: Document 도메인의 `access_level` 규칙을 따름

> 구체적인 Document 생성/조회 로직은 [Document 도메인 문서](/docs/document/domain.md)를 참조하세요.

#### 상담일지 필드 → Document 매핑

| UI 필드 | Document category | access_level | 설명 |
|---------|-------------------|--------------|------|
| **상담 목표** | `counseling_goal` | center | 이번 회기의 상담 목표 |
| **상담 내용** | `counseling_content` | center | 실제 상담에서 다룬 내용 |
| **종합 소견** | `counseling_summary` | center (또는 public) | 상담사의 종합 의견 |
| **개인 메모** | `counseling_private_memo` | **private** | 작성자 본인만 볼 수 있는 메모 |
| **첨부파일** | `counseling_attachment` | center | 검사 결과 등 파일 |

#### Document 연결 방식

```
CounselingSession                     Document 도메인
┌─────────────────────┐              ┌─────────────────────────────────┐
│ id: "session-uuid"  │              │ entity_type: "counseling_session"│
│ session_number: 1   │◄─────────────│ entity_id: "session-uuid"        │
│ status: "COMPLETED" │              │ category: "counseling_goal"      │
└─────────────────────┘              │ content: "상담 목표 텍스트..."    │
                                     └─────────────────────────────────┘
```

- Document는 `entity_type` + `entity_id`로 CounselingSession과 연결
- Session에서 Document를 직접 참조하지 않음 (역방향 조회)

#### 개인 메모 격리

> **중요**: 개인 메모(`counseling_private_memo`)는 `access_level="private"`으로 설정되며, 작성자 본인만 조회 가능합니다.

**시나리오**: 짝치료(Co-therapy)에서 상담사 A, B가 각각 개인 메모 작성
- 상담사 A 조회 시: 본인 메모만 표시
- 상담사 B 조회 시: 본인 메모만 표시
- 센터장 조회 시: 개인 메모 없음 (공유된 goal, content, summary만)

#### 상담일지 미작성 경고

- `has_journal`: goal, content, summary 중 하나라도 있으면 `true`
- `journal_warning`: status="COMPLETED"이고 `has_journal=false`이면 "상담일지 미작성" 표시

### 7. 짝치료 / 집단상담 지원

**짝치료 (Co-therapy)**:
```python
# 2명의 내담자 + 2명의 상담사 (1:1 매칭)
# 예: 부부상담에서 각 배우자에게 담당 상담사 배정
CounselingCaseParticipant:
  - (case_id, "client", client_1_id, assigned_at)    # 내담자 A
  - (case_id, "client", client_2_id, assigned_at)    # 내담자 B
  - (case_id, "counselor", member_a_id, assigned_at) # 상담사 A
  - (case_id, "counselor", member_b_id, assigned_at) # 상담사 B

# 각 상담사가 동일 세션에 개별 상담 기록 작성
# Document.uploader_id로 작성자 구분
```

**집단상담**:
```python
# 다수의 내담자 + 1명 이상의 상담사
CounselingCaseParticipant:
  - (case_id, "client", client_1_id, assigned_at)
  - (case_id, "client", client_2_id, assigned_at)
  - ...
  - (case_id, "client", client_10_id, assigned_at)
  - (case_id, "counselor", member_id, assigned_at)

# 세션별 출석 관리
CounselingSessionParticipant:
  - (session_id, "client", client_1_id, "attended")
  - (session_id, "client", client_2_id, "no_show")   # 불참
  - (session_id, "client", client_3_id, "excused")   # 사전 통보 불참
  - ...
  - (session_id, "counselor", member_id, "attended")
```

**상담사 교체 이력**:
```python
# 기존 상담사 제거 (unassigned_at 설정)
UPDATE counseling_case_participants
SET unassigned_at = NOW()
WHERE counseling_case_id = ? AND participant_type = 'counselor' AND participant_id = ?;

# 새 상담사 추가
INSERT INTO counseling_case_participants (counseling_case_id, participant_type, participant_id, assigned_at)
VALUES (?, 'counselor', ?, NOW());
```

---

## API 설계

### 엔드포인트 목록

#### Counseling (상담 프로그램) 관리

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/centers/{center_id}/counselings` | 프로그램 목록 | counseling:read |
| POST | `/centers/{center_id}/counselings` | 프로그램 생성 | counseling:create |
| GET | `/centers/{center_id}/counselings/{id}` | 프로그램 상세 | counseling:read |
| PATCH | `/centers/{center_id}/counselings/{id}` | 프로그램 수정 | counseling:update |
| DELETE | `/centers/{center_id}/counselings/{id}` | 프로그램 삭제 | counseling:delete |

> **Note**: 담당자(counselor_ids)는 프로그램 생성/수정 시 PATCH로 관리 (별도 API 불필요)

#### CounselingCase (상담 케이스) CRUD

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/centers/{center_id}/counseling-cases` | 상담 케이스 목록 | counseling:read |
| GET | `/centers/{center_id}/counseling-cases/{id}` | 케이스 상세 | counseling:read |
| POST | `/centers/{center_id}/counseling-cases` | 케이스 생성 | counseling:create |
| PATCH | `/centers/{center_id}/counseling-cases/{id}` | 케이스 수정 | counseling:update |
| POST | `/centers/{center_id}/counseling-cases/{id}/complete` | 케이스 종결 | counseling:update |
| POST | `/centers/{center_id}/counseling-cases/{id}/cancel` | 케이스 취소 | counseling:update |

**쿼리 파라미터**:
- `status`: ACTIVE, COMPLETED, CANCELLED 필터
- `counseling_id`: 상담 유형 필터
- `client_id`: 내담자 필터
- `counselor_id`: 상담사 필터
- `page`, `size`: 페이징

#### CounselingSession CRUD

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/centers/{center_id}/counseling-cases/{case_id}/sessions` | 상담 일정 기록 목록 | counseling:read |
| GET | `/centers/{center_id}/sessions/{id}` | 상담 일정 기록 상세 | counseling:read |
| POST | `/centers/{center_id}/counseling-cases/{case_id}/sessions` | 상담 일정 기록 생성 | counseling:create |
| PATCH | `/centers/{center_id}/sessions/{id}` | 상담 일정 기록 수정 | counseling:update |
| POST | `/centers/{center_id}/sessions/{id}/complete` | 상담 완료 처리 | counseling:update |
| POST | `/centers/{center_id}/sessions/{id}/no-show` | 노쇼 처리 | counseling:update |
| POST | `/centers/{center_id}/sessions/{id}/cancel` | 취소 처리 | counseling:update |

#### 케이스 참여자 관리

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/centers/{center_id}/counseling-cases/{id}/participants` | 참여자 목록 | counseling:read |
| GET | `/centers/{center_id}/counseling-cases/{id}/participants?type=client` | 내담자 목록 | counseling:read |
| GET | `/centers/{center_id}/counseling-cases/{id}/participants?type=counselor` | 상담사 목록 | counseling:read |
| POST | `/centers/{center_id}/counseling-cases/{id}/participants` | 참여자 추가 | counseling:update |
| DELETE | `/centers/{center_id}/counseling-cases/{id}/participants/{type}/{participant_id}` | 참여자 제거 | counseling:update |

#### 세션 참여자 관리 (출석)

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/centers/{center_id}/sessions/{id}/participants` | 세션 참여자 목록 | counseling:read |
| POST | `/centers/{center_id}/sessions/{id}/participants` | 세션 참여자 추가/출석 기록 | counseling:update |
| PATCH | `/centers/{center_id}/sessions/{id}/participants/{type}/{participant_id}` | 출석 상태 수정 | counseling:update |

---

### Request/Response 스키마

#### CounselingCreate (프로그램 생성)

```python
class CounselingCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="프로그램명")
    description: str | None = Field(None, description="프로그램 설명")
    price: int = Field(0, ge=0, description="기본 요금 (원 단위)")
    duration_minutes: int = Field(60, ge=1, description="소요 시간 (분 단위)")
    counselor_ids: list[str] | None = Field(None, description="담당자 ID 목록 (선택)")
    counseling_type: str = Field("individual", description="상담 유형: individual, group, pair")
```

#### CounselingUpdate (프로그램 수정)

```python
class CounselingUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100, description="프로그램명")
    description: str | None = Field(None, description="프로그램 설명")
    price: int | None = Field(None, ge=0, description="기본 요금 (원 단위)")
    duration_minutes: int | None = Field(None, ge=1, description="소요 시간 (분 단위)")
    counselor_ids: list[str] | None = Field(None, description="담당자 ID 목록")
    counseling_type: str | None = Field(None, description="상담 유형: individual, group, pair")
```

#### CounselingResponse (프로그램 응답)

```python
class CounselorSummary(BaseModel):
    """상담사 요약 정보"""
    id: str
    name: str
    profile_image_url: str | None


class CounselingResponse(BaseModel):
    id: str
    center_id: str
    name: str
    description: str | None
    price: int
    duration_minutes: int
    counseling_type: str  # individual, group, pair
    counselors: list[CounselorSummary]  # 담당자 목록
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
```

#### CounselingListResponse (프로그램 목록 응답)

```python
class CounselingListItem(BaseModel):
    """프로그램 목록 아이템 (UI 카드용)"""
    id: str
    name: str
    price: int
    duration_minutes: int
    counseling_type: str  # individual, group, pair
    counselors: list[CounselorSummary]  # 담당자 목록


class CounselingListResponse(BaseModel):
    items: list[CounselingListItem]
    total: int
```

#### CounselingCaseCreate (케이스 생성)

```python
class CounselingCaseCreate(BaseModel):
    counseling_id: str = Field(..., description="상담 유형 ID")
    memo: str | None = Field(None, description="케이스별 메모")
    total_sessions: int | None = Field(None, ge=1, description="계획된 총 회기 수")
    client_ids: list[str] = Field(..., min_length=1, description="내담자 ID 목록")
    counselor_ids: list[str] = Field(..., min_length=1, description="상담사 ID 목록")
```

#### CounselingCaseResponse (케이스 응답)

```python
class CounselingCaseResponse(BaseModel):
    id: str
    center_id: str
    counseling_id: str
    counseling_name: str  # JOIN 결과
    memo: str | None
    total_sessions: int | None
    status: str
    client_count: int
    counselor_count: int
    session_count: int  # 완료된 Session 수
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
```

#### CounselingSessionCreate (상담 일정 기록 생성)

```python
class CounselingSessionCreate(BaseModel):
    schedule_id: str | None = Field(None, description="Schedule ID (ScheduledRelation 생성용, 과거 기록은 생략)")
```

> **Note**: `schedule_id`는 `CounselingSession` 테이블에 저장되지 않고, `ScheduledRelation` 중간 테이블 생성에 사용됩니다.

#### CounselingSessionResponse (상담 일정 기록 응답)

```python
class CounselingSessionResponse(BaseModel):
    id: str
    center_id: str
    counseling_case_id: str
    session_number: int  # 순차 번호 (방문 순서)
    status: str
    created_at: datetime
    updated_at: datetime

    # Schedule 정보 (ScheduledRelation JOIN 결과)
    schedule: ScheduleSummary | None = None  # { id, start, end, room_name }

    model_config = ConfigDict(from_attributes=True)


class ScheduleSummary(BaseModel):
    """Schedule 요약 정보 (JOIN용)"""
    id: str
    start: datetime
    end: datetime
    room_id: str | None
    room_name: str | None
```

#### CounselingJournalCreate (상담일지 저장)

```python
class CounselingJournalCreate(BaseModel):
    """상담일지 저장 (상담 목표, 내용, 소견, 개인 메모)"""
    goal: str | None = Field(None, description="상담 목표")
    content: str | None = Field(None, description="상담 내용")
    summary: str | None = Field(None, description="종합 소견")
    private_memo: str | None = Field(None, description="개인 메모 (작성자만 조회 가능)")

    @model_validator(mode='after')
    def validate_at_least_one_field(self) -> Self:
        """최소 하나의 필드는 입력 필수"""
        if not any([self.goal, self.content, self.summary, self.private_memo]):
            raise ValueError("At least one field is required")
        return self
```

#### CounselingJournalResponse (상담일지 조회)

```python
class CounselingJournalResponse(BaseModel):
    """상담일지 조회 응답"""
    session_id: str
    session_number: int

    # 상담일지 필드 (Document 내용)
    goal: str | None  # counseling_goal
    content: str | None  # counseling_content
    summary: str | None  # counseling_summary
    private_memo: str | None  # counseling_private_memo (본인 것만)

    # Computed fields
    has_journal: bool  # goal, content, summary 중 하나라도 있으면 True

    # 메타 정보
    goal_updated_at: datetime | None
    content_updated_at: datetime | None
    summary_updated_at: datetime | None
    private_memo_updated_at: datetime | None
```

#### CounselingSessionListItem (세션 목록 아이템)

```python
class CounselingSessionListItem(BaseModel):
    """상담 세션 목록 아이템 (UI 카드용)"""
    id: str
    session_number: int
    status: str  # SCHEDULED, COMPLETED, NO_SHOW, CANCELLED
    has_journal: bool  # 상담일지 작성 여부

    # Schedule 정보
    scheduled_at: datetime | None  # Schedule.start (ScheduledRelation JOIN)
    room_name: str | None

    # Computed
    @computed_field
    @property
    def journal_warning(self) -> str | None:
        """상담일지 미작성 경고 (완료 상태인데 미작성 시)"""
        if self.status == "COMPLETED" and not self.has_journal:
            return "상담일지 미작성"
        return None
```

#### 상담일지 API 엔드포인트

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/centers/{center_id}/sessions/{id}/journal` | 상담일지 조회 | counseling:read |
| PUT | `/centers/{center_id}/sessions/{id}/journal` | 상담일지 저장/수정 | counseling:update |

---

## 구현 우선순위

### Phase 1: 핵심 CRUD (필수)

1. Counseling (상담 유형) 엔티티 및 CRUD
2. CounselingCase (상담 케이스) 엔티티 및 CRUD
3. CounselingSession 엔티티 및 CRUD
4. CounselingCaseParticipant (케이스 참여자) 관리

**검증 항목**:
- 센터별 격리 (center_id)
- 최소 1명 내담자/상담사 (participant_type별)
- 순차 번호 자동 할당

### Phase 2: 상태 전이

1. CounselingCase 상태 전이 (ACTIVE → COMPLETED / CANCELLED)
2. CounselingSession 상태 전이
3. 상태별 비즈니스 규칙 검증

**검증 항목**:
- COMPLETED/CANCELLED 케이스에 CounselingSession 추가 불가
- 종결된 케이스는 재개 불가 (새 케이스 생성 유도)

### Phase 3: Schedule 연동 (ScheduledRelation)

1. Schedule 도메인 연동 (ScheduledRelation 중간 테이블)
2. CounselingSession-ScheduledRelation 관계 관리
3. 일정 취소 시 ScheduledRelation CASCADE 삭제, Session.status=CANCELLED 처리

**검증 항목**:
- ScheduledRelation CASCADE 동작
- Session 삭제 시 ScheduledRelation 정리
- 과거 기록 입력 (ScheduledRelation 없이 Session만 생성)

### Phase 4: Document 연동

1. 상담일지 저장/수정 API → DocumentService 호출
2. 상담일지 조회 API → DocumentService.get_by_entity() 호출
3. access_level별 접근 제어 (Document 도메인 위임)

**검증 항목**:
- entity_type="counseling_session", entity_id=session.id
- category별 권한 (private/center/public)

### Phase 5: 세션 참여자 관리

1. CounselingSessionParticipant (세션 참여자) 엔티티
2. 세션별 출석 관리 API
3. 출석률 통계 API

**검증 항목**:
- 세션 생성 시 케이스 참여자 자동 복사 (옵션)
- 출석 상태 전이 규칙

### Phase 6: 고급 기능 (선택)

1. 상담사 변경 이력 추적 (assigned_at, unassigned_at)
2. 참여자별 출석률 통계
3. 상담 통계 API (유형별, 상담사별, 기간별)
4. 내담자 앱 API (내 상담 목록)

---

## 참고 문서

- **의사결정 기록**: `/docs/counseling/decision-log.md`
- **Client 도메인**: `/docs/client/domain.md`
- **Document 도메인**: `/docs/document/domain.md`
- **Center 도메인**: `/docs/center/domain.md`
- **Schedule 도메인**: `/docs/schedule/domain.md`

---

**작성일**: 2026-01-20
**버전**: 1.2
**변경 이력**:
- v1.0: 초기 설계
- v1.1: Schedule 연동 방식 변경 - `schedule_id` FK 제거, `ScheduledRelation` 중간 테이블 패턴 적용
- v1.2: 케이스 재개 정책 변경 - 재개 불가, 새 케이스 생성 유도 (상담 이력은 Client 기준 JOIN 조회)
