# Schedule 도메인 설계

> 상담센터의 일정 관리를 담당하는 독립 도메인 (시공간 정보만 관리)

---

## 목차

1. [도메인 개요](#도메인-개요)
2. [스키마 정의](#스키마-정의)
3. [연동 패턴](#연동-패턴)
4. [비즈니스 규칙](#비즈니스-규칙)
5. [API 설계](#api-설계)
6. [구현 우선순위](#구현-우선순위)

---

## 도메인 개요

### 핵심 개념

**Schedule(일정)**은 **시공간 정보만** 관리하는 미니멀한 엔티티입니다:
- 언제 (start, end)
- 어디서 (room_id, 센터 도메인 참조)
- 무슨 타입 (schedule_type)

**Session(회기)**은 Schedule을 참조하여 실제 상담/검사와 연결됩니다:
- Counseling/Assessment 도메인에서 관리
- schedule_id로 Schedule 직접 참조 (FK nullable)
- 여러 Session이 하나의 Schedule 공유 가능 (짝치료, 집단상담)

### 연동 관계

```
┌─────────────────────────────────────────────────────────────┐
│                 Schedule (시공간 정보만)                      │
│  - start, end (언제)                                         │
│  - room_id (어디서, 센터 도메인 참조)                         │
│  - schedule_type (무슨 타입)                                  │
│  - note (메모)                                               │
└─────────────────────────────────────────────────────────────┘
                              ↑ N:1 (nullable)
┌─────────────────────────────────────────────────────────────┐
│        CounselingSession / AssessmentSession                │
│  (Counseling/Assessment 도메인에서 관리)                     │
│  - case_id (FK)                                             │
│  - client_id (FK) ← Session은 1명의 내담자                   │
│  - schedule_id (FK, nullable) ← Schedule 참조                │
│  - session_number (Case의 회기 번호)                         │
│  - status (SCHEDULED | COMPLETED | NO_SHOW | CANCELLED)    │
│  - billing_amount, billing_status (정산 정보)                │
└─────────────────────────────────────────────────────────────┘
```

### 설계 원칙

**Schedule = 시공간 정보만**:
- 언제, 어디서만 관리
- Client, Case 정보 없음 (Session에서 관리)
- 상태 없음 (Session의 상태로 관리)
- Room, GroupProgram은 센터 도메인에서 관리 (Schedule은 참조만)

**Session → Schedule 직접 참조**:
- Session.schedule_id (FK, nullable)
- 일정 없는 Session 가능 (가계약 지원)
- 여러 Session이 같은 Schedule 공유 (짝치료, 집단상담)
- Schedule 삭제 시 SET NULL (Session은 유지)

**회기 관리**:
- session_number = Case의 회기 번호 (일정 순서, 고정)
- 노쇼여도 session_number 유지
- 완료 횟수는 동적 계산 (status="COMPLETED" 카운트)

### 책임 (Responsibility)

- 시공간 정보 관리 (시작/종료 시간, 장소)
- 캘린더 뷰 데이터 제공
- 시간/장소 충돌 감지

### 의존성

- **Depends on**: Center (멀티테넌시), Room (센터 도메인, 장소)
- **Depended by**: Counseling (CounselingSession), Assessment (AssessmentSession)

---

## 스키마 정의

### Schedule (일정)

```python
from sqlalchemy import String, ForeignKey, DateTime, Text, Index
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from uuid import uuid4


class Schedule(Base):
    """
    일정 엔티티 (Center 격리)
    - 시공간 정보만 관리 (미니멀)
    - Session이 schedule_id로 참조
    """
    __tablename__ = "schedules"

    # Primary Key
    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4())
    )

    # 멀티테넌시 격리 (RLS)
    center_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("centers.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )

    # 일정 타입 (String으로 관리)
    schedule_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        index=True
    )  # "assessment" | "counseling" | "meeting" | "block"

    # 일정 제목 (운영일정용)
    title: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True
    )  # meeting/block만 사용, assessment/counseling은 Session에서 가져옴

    # 장소 (센터 도메인의 Room 참조)
    room_id: Mapped[str | None] = mapped_column(
        String(36),
        nullable=True,  # FK 제약 없음 (센터 도메인)
        index=True
    )

    # 시간
    start: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        index=True
    )
    end: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        index=True
    )

    # 메모
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # 타임스탬프
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

    # Indexes
    __table_args__ = (
        Index("ix_schedules_center_time", "center_id", "start"),
        Index("ix_schedules_center_type", "center_id", "schedule_type"),
        Index("ix_schedules_center_room", "center_id", "room_id"),
    )
```

**필드 설명**:

| 필드 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK | 일정 고유 ID |
| `center_id` | UUID | FK, NOT NULL | 센터 ID (멀티테넌시, RLS) |
| `schedule_type` | String(20) | NOT NULL | 일정 타입 (assessment, counseling, meeting, block) |
| `title` | String(200) | NULL | 일정 제목 (운영일정용, assessment/counseling은 Session에서) |
| `room_id` | String(36) | NULL | 장소 (센터 도메인의 Room 참조, FK 제약 없음) |
| `start` | DateTime | NOT NULL | 시작 시간 (UTC naive) |
| `end` | DateTime | NOT NULL | 종료 시간 (UTC naive) |
| `note` | Text | NULL | 메모 |

**schedule_type 값**:

| 값 | 설명 |
|-----|------|
| `assessment` | 검사 일정 |
| `counseling` | 상담 일정 |
| `meeting` | 회의 |
| `block` | 블록 (휴무, 점심시간 등) |

---

## 연동 패턴

### 1. Session → Schedule 참조 구조

```python
# Counseling 도메인
class CounselingSession(Base):
    """상담 회기"""
    __tablename__ = "counseling_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    center_id: Mapped[str] = mapped_column(String(36), ForeignKey("centers.id"))

    # Case 연결
    case_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("counseling_cases.id"),
        nullable=False
    )

    # 내담자 연결 (Session은 1명의 내담자)
    client_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("clients.id"),
        nullable=False
    )

    # Schedule 연결 (선택사항, 가계약 지원)
    schedule_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("schedules.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # 회기 번호 (Case 기준, 일정 순서)
    session_number: Mapped[int] = mapped_column(Integer, nullable=False)

    # 상태
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    # "SCHEDULED" | "COMPLETED" | "NO_SHOW" | "CANCELLED"

    # 정산 정보 (Session 단위)
    billing_amount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    billing_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # "PENDING" | "PAID" | "OVERDUE" | "WAIVED"

    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]
```

### 2. 개별 상담 (1:1)

```
┌─────────────────────────────────────────┐
│ Schedule (14:00-15:00, 상담실1)          │
└─────────────────────────────────────────┘
                ↑
┌─────────────────────────────────────────┐
│ CounselingSession                       │
│  - case_id: 홍길동 개별상담 Case         │
│  - client_id: 홍길동                    │
│  - schedule_id: Schedule ID             │
│  - session_number: 1                    │
└─────────────────────────────────────────┘
```

**Handler 예시**:
```python
async def create_individual_session_handler(
    center_id: str,
    case_id: str,
    data: IndividualSessionCreate,  # { schedule_data }
    uow: UnitOfWork,
):
    """개별 상담 회기 생성"""
    async with uow:
        schedule_repo = uow.repo(ScheduleRepository)
        session_repo = uow.repo(CounselingSessionRepository)
        case_repo = uow.repo(CounselingCaseRepository)

        # 1. Case 조회
        case = await case_repo.get(case_id)
        if not case:
            raise HTTPException(404, "케이스를 찾을 수 없습니다")

        # 2. 다음 회기 번호 계산
        max_number = await session_repo.get_max_session_number(case_id)
        next_number = (max_number or 0) + 1

        # 3. Schedule 생성
        schedule = await schedule_repo.create({
            "center_id": center_id,
            "schedule_type": "counseling",
            "start": to_utc_naive(data.schedule.start),
            "end": to_utc_naive(data.schedule.end),
            "room_id": data.schedule.room_id
        })

        # 4. Session 생성
        session = await session_repo.create({
            "center_id": center_id,
            "case_id": case_id,
            "client_id": case.primary_client_id,  # Case의 주 내담자
            "schedule_id": schedule.id,
            "session_number": next_number,
            "status": "SCHEDULED"
        })

        await uow.commit()
        return SessionResponse.model_validate(session)
```

### 3. 짝치료 (1:N)

```
┌─────────────────────────────────────────┐
│ Schedule (14:00-15:00, 상담실1)          │
└─────────────────────────────────────────┘
        ↑                   ↑
┌──────────────────┐  ┌──────────────────┐
│ Session (홍길동)  │  │ Session (김영희)  │
│  - case_id: 부부  │  │  - case_id: 부부  │
│  - client_id: 홍  │  │  - client_id: 김  │
│  - session_num: 1 │  │  - session_num: 1 │
└──────────────────┘  └──────────────────┘
```

**Handler 예시**:
```python
async def create_couple_session_handler(
    center_id: str,
    case_id: str,
    data: CoupleSessionCreate,  # { schedule_data, client_ids }
    uow: UnitOfWork,
):
    """짝치료 회기 생성"""
    async with uow:
        schedule_repo = uow.repo(ScheduleRepository)
        session_repo = uow.repo(CounselingSessionRepository)
        case_repo = uow.repo(CounselingCaseRepository)

        # 1. Case 조회 및 검증
        case = await case_repo.get(case_id)
        if not case or case.case_type != "couple":
            raise HTTPException(400, "짝치료 케이스가 아닙니다")

        # 2. 다음 회기 번호 계산 (Case 기준)
        max_number = await session_repo.get_max_session_number(case_id)
        next_number = (max_number or 0) + 1

        # 3. Schedule 1개 생성
        schedule = await schedule_repo.create({
            "center_id": center_id,
            "schedule_type": "counseling",
            "start": to_utc_naive(data.schedule.start),
            "end": to_utc_naive(data.schedule.end),
            "room_id": data.schedule.room_id
        })

        # 4. 참여자별 Session 생성 (N개, 같은 session_number)
        sessions = []
        for client_id in data.client_ids:
            session = await session_repo.create({
                "center_id": center_id,
                "case_id": case_id,
                "client_id": client_id,  # 각 내담자
                "schedule_id": schedule.id,  # 같은 Schedule
                "session_number": next_number,  # 같은 회기 번호
                "status": "SCHEDULED"
            })
            sessions.append(session)

        await uow.commit()
        return {
            "schedule_id": schedule.id,
            "session_number": next_number,
            "sessions": [SessionResponse.model_validate(s) for s in sessions]
        }
```

### 4. 집단 상담 (1:N, N명)

```
┌─────────────────────────────────────────┐
│ Schedule (16:00-18:00, 대강당)           │
└─────────────────────────────────────────┘
    ↑       ↑       ↑       ↑
┌────────┐┌────────┐┌────────┐┌────────┐
│Session1││Session2││Session3││Session8│
│홍길동  ││김철수  ││박영희  ││...     │
│num: 1  ││num: 1  ││num: 1  ││num: 1  │
└────────┘└────────┘└────────┘└────────┘
```

**특징**:
- Schedule 1개
- Session N개 (참가자별)
- 모두 같은 session_number (Case의 회기 번호)
- 각 Session은 개별 정산

### 5. 가계약 시나리오 (Schedule 없는 Session)

```python
# 1. 접수 시 Session 생성 (schedule_id=null)
session = CounselingSession(
    case_id=case.id,
    client_id=client.id,
    schedule_id=None,  # 일정 미확정
    session_number=1,
    status="PENDING"
)

# 2. 나중에 일정 확정
schedule = Schedule(start="...", end="...")
session.schedule_id = schedule.id
session.status = "SCHEDULED"
```

### 6. 삭제 처리

**Schedule 삭제 시**:
```python
# ondelete="SET NULL"
# Schedule 삭제 → Session.schedule_id = null
# Session은 유지됨 (일정 연결만 해제)
```

**Session 삭제 시**:
```python
# Schedule은 유지 (재사용 가능)
await session_repo.delete(session_id)
```

### 7. 연동 규칙 요약

| 시나리오 | Schedule | Session | 특징 |
|----------|----------|---------|------|
| **개별 상담** | 1개 | 1개 | 1:1 연결 |
| **짝치료** | 1개 | 2개 | 같은 schedule_id, 같은 session_number |
| **집단 상담** | 1개 | N개 | 같은 schedule_id, 같은 session_number |
| **가계약** | 없음 | 1개 | schedule_id = null |
| **Schedule 삭제** | 삭제 | 유지 | session.schedule_id = null (SET NULL) |
| **Session 삭제** | 유지 | 삭제 | Schedule 재사용 가능 |

---

## 비즈니스 규칙

### 1. 일정 생성 규칙

| 규칙 | 설명 | 검증 위치 |
|------|------|----------|
| **시간 범위 필수** | start, end 필수 | ScheduleCreate schema |
| **시작 < 종료** | start < end | ScheduleCreate validator |
| **schedule_type 필수** | 유효한 타입만 허용 | ScheduleCreate validator |

### 2. 충돌 감지 규칙

| 충돌 유형 | 동작 | 구현 |
|----------|------|------|
| **장소 충돌** | 차단 | check_room_conflict() |
| **시간 충돌** | 경고 (차단 아님) | check_time_conflict() |

**시간 충돌 로직**:
```python
# 시간대 중복: (A.start < B.end) AND (A.end > B.start)
async def check_room_conflict(
    self,
    room_id: str,
    start: datetime,
    end: datetime,
    exclude_id: str | None = None,
) -> bool:
    """
    Room 충돌 검사

    예시:
    - 기존(14:00-15:00) vs 신규(14:30-15:30) → 충돌
    - 기존(14:00-15:00) vs 신규(15:00-16:00) → 충돌 없음
    """
    query = select(Schedule).where(
        Schedule.room_id == room_id,
        Schedule.start < end,
        Schedule.end > start
    )
    if exclude_id:
        query = query.where(Schedule.id != exclude_id)

    result = await self._session.execute(query)
    return len(result.scalars().all()) > 0
```

### 3. 회기 관리 규칙

| 규칙 | 설명 |
|------|------|
| **session_number = 일정 순서** | Case의 회기 번호 (고정) |
| **노쇼여도 번호 유지** | NO_SHOW 상태여도 session_number는 그대로 |
| **취소 시 번호 건너뜀** | CANCELLED 상태, 다음 회기는 +1 |
| **완료 횟수는 동적 계산** | status="COMPLETED" 카운트 |

**완료 횟수 계산 예시**:
```python
# 홍길동의 실제 완료 회기 수
completed_count = await session.query(
    func.count(Session.id)
).filter(
    Session.case_id == case_id,
    Session.client_id == hong_id,
    Session.status == "COMPLETED"
).scalar()

# 참석률
total_scheduled = await session.query(
    func.count(Session.id)
).filter(
    Session.case_id == case_id,
    Session.client_id == hong_id,
    Session.status.in_(["SCHEDULED", "COMPLETED", "NO_SHOW"])
).scalar()

attendance_rate = (completed_count / total_scheduled * 100) if total_scheduled > 0 else 0
```

---

## API 설계

### 엔드포인트 목록

#### Schedule CRUD

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/centers/{center_id}/schedules` | 일정 목록 (캘린더 뷰) | schedule:read |
| GET | `/centers/{center_id}/schedules/{id}` | 일정 상세 | schedule:read |
| POST | `/centers/{center_id}/schedules` | 일정 생성 | schedule:create |
| PATCH | `/centers/{center_id}/schedules/{id}` | 일정 수정 | schedule:update |
| DELETE | `/centers/{center_id}/schedules/{id}` | 일정 삭제 | schedule:delete |

### 쿼리 파라미터 (일정 목록 조회)

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `start` | DateTime | O | 시작 날짜 |
| `end` | DateTime | O | 종료 날짜 |
| `schedule_type` | String | X | 일정 타입 필터 |
| `room_id` | UUID | X | 장소 필터 |

### Request/Response 스키마

#### ScheduleCreate

```python
from pydantic import BaseModel, Field, field_validator
from datetime import datetime


class ScheduleCreate(BaseModel):
    schedule_type: str = Field(..., pattern="^(assessment|counseling|meeting|block)$")
    title: str | None = None  # 운영일정용 제목 (meeting, block)
    room_id: str | None = None
    start: datetime
    end: datetime
    note: str | None = None

    @field_validator("end")
    def validate_end(cls, v, info):
        if "start" in info.data and v <= info.data["start"]:
            raise ValueError("종료 시간은 시작 시간보다 이후여야 합니다")
        return v
```

#### ScheduleResponse

```python
class ClientSummary(BaseModel):
    """내담자 요약 (캘린더 표시용)"""
    client_id: str
    client_name: str
    attendance_status: str | None = None  # COMPLETED | NO_SHOW | CANCELLED


class SessionSummary(BaseModel):
    """회기 요약 (캘린더 표시용)"""
    session_id: str
    case_code: str
    case_type: str  # "individual" | "couple" | "family" | "group"
    session_number: int
    clients: list[ClientSummary]


class ScheduleResponse(BaseModel):
    id: str
    center_id: str
    schedule_type: str
    title: str | None
    room_id: str | None
    room_name: str | None  # 센터 도메인에서 조회
    start: datetime
    end: datetime
    note: str | None

    # Session 요약 (역참조 조회)
    sessions: list[SessionSummary] = []

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
```

#### ScheduleUpdate

```python
class ScheduleUpdate(BaseModel):
    title: str | None = None
    room_id: str | None = None
    start: datetime | None = None
    end: datetime | None = None
    note: str | None = None
```

---

## 캘린더 뷰 조회

### 개요

캘린더 뷰에서 일정과 함께 **내담자명, 회기 정보** 등을 표시하려면 Session을 역참조 조회합니다.

### 데이터 흐름

```
┌─────────────────────────────────────────────────────────────┐
│ GET /centers/{center_id}/schedules?start=...&end=...       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ [1] Schedule 조회 (날짜 범위)                                 │
│     - ScheduleRepository.get_by_range()                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ [2] Session 역참조 조회 (schedule_id로)                      │
│     - CounselingSessionRepository.get_by_schedule_ids()    │
│     - AssessmentSessionRepository.get_by_schedule_ids()    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ [3] Client, Case 정보 JOIN                                  │
│     - Client 정보 (이름)                                     │
│     - Case 정보 (코드, 타입)                                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ [4] 응답 조합                                                │
│     - Schedule + Session + Client + Case                   │
│     → ScheduleResponse 반환                                 │
└─────────────────────────────────────────────────────────────┘
```

### Handler 구현

```python
async def get_schedules_handler(
    center_id: str,
    start: datetime = Query(...),
    end: datetime = Query(...),
    schedule_type: str | None = Query(None),
    room_id: str | None = Query(None),
    uow: UnitOfWork = Depends(get_uow),
) -> list[ScheduleResponse]:
    """캘린더 뷰 일정 목록 조회"""
    async with uow:
        schedule_repo = uow.repo(ScheduleRepository)
        counseling_session_repo = uow.repo(CounselingSessionRepository)
        assessment_session_repo = uow.repo(AssessmentSessionRepository)

        # [1] Schedule 조회
        schedules = await schedule_repo.get_by_range(
            center_id=center_id,
            start=to_utc_naive(start),
            end=to_utc_naive(end),
            schedule_type=schedule_type,
            room_id=room_id
        )

        if not schedules:
            return []

        schedule_ids = [s.id for s in schedules]

        # [2] Session 역참조 조회
        counseling_sessions = await counseling_session_repo.get_by_schedule_ids(
            schedule_ids
        )
        assessment_sessions = await assessment_session_repo.get_by_schedule_ids(
            schedule_ids
        )

        # schedule_id별로 그룹핑
        sessions_by_schedule: dict[str, list] = {}
        for session in counseling_sessions + assessment_sessions:
            if session.schedule_id not in sessions_by_schedule:
                sessions_by_schedule[session.schedule_id] = []
            sessions_by_schedule[session.schedule_id].append(session)

        # [3] 응답 조합
        result = []
        for schedule in schedules:
            sessions = sessions_by_schedule.get(schedule.id, [])

            # Session 요약 생성
            session_summaries = []
            for session in sessions:
                # Case 정보는 session.case에서 가져옴 (JOIN 필요)
                case_code = session.case.code if session.case else None
                case_type = session.case.case_type if session.case else None

                # Client 정보는 session.client에서 가져옴 (JOIN 필요)
                client_name = session.client.name if session.client else None

                session_summaries.append(SessionSummary(
                    session_id=session.id,
                    case_code=case_code,
                    case_type=case_type,
                    session_number=session.session_number,
                    clients=[
                        ClientSummary(
                            client_id=session.client_id,
                            client_name=client_name,
                            attendance_status=session.status
                        )
                    ]
                ))

            # Room 정보는 센터 도메인에서 조회 (별도 Service 호출)
            room_name = None
            if schedule.room_id:
                # TODO: 센터 도메인 Service 호출
                # room = await center_service.get_room(schedule.room_id)
                # room_name = room.name if room else None
                pass

            result.append(ScheduleResponse(
                id=schedule.id,
                center_id=schedule.center_id,
                schedule_type=schedule.schedule_type,
                title=schedule.title,
                room_id=schedule.room_id,
                room_name=room_name,
                start=schedule.start,
                end=schedule.end,
                note=schedule.note,
                sessions=session_summaries,
                created_at=schedule.created_at,
                updated_at=schedule.updated_at
            ))

        return result
```

---

## 구현 우선순위

### Phase 1: 기본 CRUD (필수)

1. Schedule 엔티티 및 Repository
2. Schedule CRUD API
3. 날짜 범위 조회 (캘린더 뷰)

**검증 항목**:
- 센터별 격리 (center_id, RLS)
- 시간 범위 필터링
- UTC naive 변환 (to_utc_naive)

### Phase 2: 도메인 연동

1. CounselingSession → Schedule 연동
2. AssessmentSession → Schedule 연동
3. 캘린더 뷰 Session 역참조 조회

**검증 항목**:
- Session.schedule_id nullable
- SET NULL 동작 확인
- 여러 Session이 같은 Schedule 참조

### Phase 3: 충돌 감지

1. 장소 충돌 감지 (차단)
2. 시간 충돌 감지 (경고)

### Phase 4: 고급 기능 (선택)

1. 블록 일정 (block) 지원
2. 일정 알림 (SMS, 이메일)
3. 캘린더 연동 (iCal, Google Calendar)

---

## 참고 문서

- **Counseling 도메인**: `/docs/counseling/domain.md`
- **Assessment 도메인**: `/docs/assessment/domain_v3.md`
- **Client 도메인**: `/docs/client/domain.md`

---

**작성일**: 2026-01-27
**버전**: 4.0
**변경 이력**:
- v1: Polymorphic 관계 (Schedule → Session)
- v2: FK 직접 참조 (Session → Schedule)
- v3: 중간 테이블 패턴 (ScheduledRelation), 미니멀 Schedule (시공간 정보만)
- v3.1: 캘린더 뷰 조회 섹션 추가
- v3.2: ScheduleResourceSummary 확장
- v3.3: Schedule.title 필드 추가
- v4.0: 전면 재설계
  - ScheduledRelation 제거
  - Session → Schedule 직접 참조 (FK nullable)
  - Session.client_id 추가 (1명의 내담자)
  - 짝치료/집단상담 = N개 Session이 1개 Schedule 공유
  - session_number = Case의 회기 번호 (일정 순서, 고정)
  - 정산은 Session 단위
  - Room, GroupProgram은 센터 도메인에서 관리
