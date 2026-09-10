# Schedule 도메인 엣지 케이스

> Schedule 도메인의 복잡한 엣지 케이스 및 해결 전략

---

## 목차

1. [동시 Schedule 생성 (Room 충돌)](#동시-schedule-생성-room-충돌)
2. [Schedule 삭제 시 Session 처리](#schedule-삭제-시-session-처리)
3. [짝치료/집단 Session 중 일부만 노쇼](#짝치료집단-session-중-일부만-노쇼)
4. [Session과 Schedule의 시간 불일치](#session과-schedule의-시간-불일치)
5. [Schedule 수정 시 연결된 Session 처리](#schedule-수정-시-연결된-session-처리)
6. [여러 Session이 같은 Schedule 참조 시 삭제](#여러-session이-같은-schedule-참조-시-삭제)
7. [가계약 Session에 Schedule 중복 연결](#가계약-session에-schedule-중복-연결)
8. [Schedule 없이 캘린더 뷰 조회](#schedule-없이-캘린더-뷰-조회)
9. [Case 종결 후 Schedule/Session 처리](#case-종결-후-schedulesession-처리)
10. [Session session_number 중복](#session-session_number-중복)

---

## 동시 Schedule 생성 (Room 충돌)

### 시나리오

**상황**: 같은 Room에 동일 시간대 Schedule을 2명이 동시에 생성 시도

```
Thread A: POST /schedules (14:00-15:00, Room A)
Thread B: POST /schedules (14:30-15:30, Room A)
→ 시간 중복! Room 충돌 발생
```

**문제점**:
- 충돌 검사와 Schedule 생성 사이에 Race Condition 발생
- 두 요청 모두 충돌 검사 통과 → Room 중복 예약

---

### 해결 전략 A: DB Row Lock (권장)

```python
# app/modules/schedule/repository.py
async def check_room_conflict_with_lock(
    self,
    center_id: str,
    room_id: str,
    start: datetime,
    end: datetime,
    exclude_id: str | None = None,
) -> bool:
    """
    Room 충돌 검사 with Row Lock
    - Room별로 Schedule을 시간순 정렬하여 Lock 획득
    - Schedule 생성 완료 전까지 다른 트랜잭션 대기
    """
    # Room별로 Lock 획득 (가장 최근 Schedule)
    lock_query = (
        select(Schedule)
        .where(
            Schedule.center_id == center_id,
            Schedule.room_id == room_id
        )
        .order_by(Schedule.start.desc())
        .limit(1)
        .with_for_update()  # Row Lock
    )

    await self._session.execute(lock_query)

    # 충돌 검사
    conflict_query = select(Schedule).where(
        Schedule.center_id == center_id,
        Schedule.room_id == room_id,
        Schedule.start < end,
        Schedule.end > start
    )

    if exclude_id:
        conflict_query = conflict_query.where(Schedule.id != exclude_id)

    result = await self._session.execute(conflict_query)
    conflicts = result.scalars().all()

    return len(conflicts) > 0


# app/modules/schedule/handlers/create_schedule.py
async def create_schedule_handler(
    center_id: str,
    data: ScheduleCreate,
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        schedule_repo = uow.repo(ScheduleRepository)

        # 1. Room 충돌 검사 (Lock 획득)
        if data.room_id:
            conflict = await schedule_repo.check_room_conflict_with_lock(
                center_id=center_id,
                room_id=data.room_id,
                start=to_utc_naive(data.start),
                end=to_utc_naive(data.end)
            )

            if conflict:
                raise HTTPException(
                    status_code=400,
                    detail="해당 시간에 이미 예약된 일정이 있습니다"
                )

        # 2. Schedule 생성 (Lock 유지 상태)
        schedule = await schedule_repo.create({
            "center_id": center_id,
            "schedule_type": data.schedule_type,
            "room_id": data.room_id,
            "start": to_utc_naive(data.start),
            "end": to_utc_naive(data.end)
        })

        await uow.commit()  # Lock 해제
        return ScheduleResponse.model_validate(schedule)
```

---

### 해결 전략 B: Advisory Lock (PostgreSQL)

```python
# Room별로 Advisory Lock 사용
async def check_room_conflict_with_advisory_lock(
    self,
    room_id: str,
    start: datetime,
    end: datetime,
):
    """PostgreSQL Advisory Lock 사용"""
    # room_id를 integer hash로 변환
    lock_id = hash(room_id) % (2**31)

    # Advisory Lock 획득
    await self._session.execute(
        text("SELECT pg_advisory_xact_lock(:lock_id)"),
        {"lock_id": lock_id}
    )

    # 충돌 검사 및 Schedule 생성
    # ...
```

---

### 성능 비교

| 전략 | 장점 | 단점 | 권장 상황 |
|------|------|------|----------|
| **Row Lock (A)** | 구현 간단, 안정적 | Room당 순차 처리 | 일반적 케이스 |
| **Advisory Lock (B)** | Room별 병렬 처리 | PostgreSQL 전용 | 고부하 환경 |

**권장**: Phase 1은 Row Lock, Phase 2는 Advisory Lock 고려

---

## Schedule 삭제 시 Session 처리

### 시나리오

**상황**: Schedule 삭제 시 연결된 Session 처리 방안

```python
Schedule(id="schedule-1", 14:00-15:00, 상담실1)
  ↑
Session(id="session-hong", schedule_id="schedule-1", status="SCHEDULED")
Session(id="session-kim", schedule_id="schedule-1", status="SCHEDULED")

# Schedule 삭제 요청
DELETE /schedules/schedule-1
```

**문제점**:
- Session.schedule_id FK 제약 (ondelete="SET NULL")
- Session은 유지되지만 일정 정보 손실
- 사용자 혼란 가능

---

### 해결 전략 A: SET NULL + 상태 변경 (채택)

**정책**: Schedule 삭제 시 Session.schedule_id는 null로 변경, Session 상태는 CANCELLED로 변경

```python
# app/modules/schedule/handlers/delete_schedule.py
async def delete_schedule_handler(
    center_id: str,
    schedule_id: str,
    uow: UnitOfWork = Depends(get_uow),
):
    """
    Schedule 삭제 - Session은 유지하되 상태 변경
    """
    async with uow:
        schedule_repo = uow.repo(ScheduleRepository)
        session_repo = uow.repo(CounselingSessionRepository)

        # 1. Schedule 조회
        schedule = await schedule_repo.get(schedule_id)
        if not schedule or schedule.center_id != center_id:
            raise HTTPException(404, "일정을 찾을 수 없습니다")

        # 2. 연결된 Session 조회 (역참조)
        sessions = await session_repo.get_by_schedule_id(schedule_id)

        # 3. Session 상태 변경 (SCHEDULED → CANCELLED)
        for session in sessions:
            if session.status == "SCHEDULED":
                await session_repo.update(session.id, {
                    "status": "CANCELLED"
                })

        # 4. Schedule 삭제 (FK ondelete="SET NULL" 자동 처리)
        await schedule_repo.delete(schedule_id)

        await uow.commit()

        return {
            "message": "일정이 삭제되었습니다",
            "affected_sessions": len(sessions)
        }
```

**DB 변경 순서**:
```sql
-- 1. Session 상태 변경
UPDATE counseling_sessions
SET status = 'CANCELLED'
WHERE schedule_id = 'schedule-1' AND status = 'SCHEDULED';

-- 2. Schedule 삭제 (FK SET NULL 자동)
DELETE FROM schedules WHERE id = 'schedule-1';

-- 3. 자동 처리 (FK ondelete="SET NULL")
-- UPDATE counseling_sessions SET schedule_id = NULL WHERE schedule_id = 'schedule-1';
```

---

### 해결 전략 B: 삭제 차단 (엄격)

```python
async def delete_schedule_strict_handler(
    center_id: str,
    schedule_id: str,
    uow: UnitOfWork = Depends(get_uow),
):
    """Schedule 삭제 (엄격) - Session 연결 시 차단"""
    async with uow:
        schedule_repo = uow.repo(ScheduleRepository)
        session_repo = uow.repo(CounselingSessionRepository)

        # 1. Schedule 조회
        schedule = await schedule_repo.get(schedule_id)
        if not schedule:
            raise HTTPException(404, "일정을 찾을 수 없습니다")

        # 2. 연결된 Session 확인
        sessions = await session_repo.get_by_schedule_id(schedule_id)

        if sessions:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "세션이 연결된 일정은 삭제할 수 없습니다",
                    "linked_sessions": [
                        {
                            "session_id": s.id,
                            "session_number": s.session_number,
                            "client_name": s.client.name
                        }
                        for s in sessions
                    ],
                    "actions_required": [
                        "세션을 먼저 취소하거나 삭제하세요"
                    ]
                }
            )

        # 3. Session 없으면 삭제 진행
        await schedule_repo.delete(schedule_id)
        await uow.commit()
```

---

### 정책 비교

| 정책 | 장점 | 단점 |
|------|------|------|
| **SET NULL + 상태변경 (채택)** | 데이터 유지, 일정만 해제 | Session 상태 업데이트 필요 |
| 삭제 차단 (Strict) | 완전한 무결성 보장 | 삭제 전 Session 처리 필요 |

---

## 짝치료/집단 Session 중 일부만 노쇼

### 시나리오

**상황**: 짝치료에서 1명만 출석, 1명 노쇼

```python
Schedule(id="schedule-1", 14:00-15:00, 상담실1)
  ↑                          ↑
Session(홍길동, num=2)  Session(김영희, num=2)
```

**홍길동 출석, 김영희 노쇼 처리**:
```python
# 홍길동 Session
PATCH /sessions/session-hong
{
  "status": "COMPLETED",
  "billing_amount": 80000,
  "billing_status": "PAID"
}

# 김영희 Session
PATCH /sessions/session-kim
{
  "status": "NO_SHOW"
}
```

**최종 상태**:
```
Schedule(id="schedule-1") - 유지
Session(홍길동, status="COMPLETED", billing_status="PAID")
Session(김영희, status="NO_SHOW", billing_status=null)
```

---

### 핵심 원칙

1. **Session은 독립적**: 같은 Schedule을 참조해도 각 Session의 상태는 독립
2. **개별 정산**: 출석한 사람만 정산
3. **회기 번호 유지**: 노쇼여도 session_number는 그대로 (2회기는 2회기)

---

## Session과 Schedule의 시간 불일치

### 시나리오

**상황**: Schedule 시간 변경 시 Session의 scheduled_at 처리

```python
# 초기 상태
Schedule(id="schedule-1", start="14:00", end="15:00")
Session(id="session-1", schedule_id="schedule-1", scheduled_at="14:00")

# Schedule 시간 변경
PATCH /schedules/schedule-1
{
  "start": "15:00",
  "end": "16:00"
}
```

**문제점**:
- Session.scheduled_at이 Schedule.start와 불일치
- 캘린더 뷰에서 혼란 가능

---

### 해결 전략: Session 테이블에 scheduled_at 없음 (채택)

**정책**: Session은 Schedule 참조만 유지, 시간 정보는 Schedule에서 조회

```python
# Session 스키마 (scheduled_at 필드 없음)
class CounselingSession(Base):
    __tablename__ = "counseling_sessions"

    id: Mapped[str]
    schedule_id: Mapped[str | None]  # FK only
    session_number: Mapped[int]
    status: Mapped[str]
    # scheduled_at 필드 없음!


# 캘린더 뷰 조회 시
async def get_calendar_view(start, end):
    # 1. Schedule 조회
    schedules = await schedule_repo.get_by_range(start, end)

    # 2. Session 역참조
    for schedule in schedules:
        sessions = await session_repo.get_by_schedule_id(schedule.id)

        # 시간 정보는 Schedule에서
        schedule_time = schedule.start
```

**장점**:
- 시간 정보 단일 출처 (Schedule만)
- Schedule 변경 시 Session 업데이트 불필요
- 데이터 정합성 보장

---

## Schedule 수정 시 연결된 Session 처리

### 시나리오

**상황**: Schedule의 Room 변경 시 Session 처리

```python
Schedule(id="schedule-1", room_id="room-a", 14:00-15:00)
  ↑
Session(schedule_id="schedule-1")

# Room 변경
PATCH /schedules/schedule-1
{
  "room_id": "room-b"
}
```

**문제점**:
- Session은 자동으로 새 Room 정보 반영 (Schedule 참조)
- 특별한 처리 불필요

---

### 해결 전략: 경고만 표시 (선택)

```python
async def update_schedule_handler(
    schedule_id: str,
    data: ScheduleUpdate,
    uow: UnitOfWork,
):
    async with uow:
        schedule_repo = uow.repo(ScheduleRepository)
        session_repo = uow.repo(CounselingSessionRepository)

        # 1. Schedule 조회
        schedule = await schedule_repo.get(schedule_id)

        # 2. 연결된 Session 확인
        sessions = await session_repo.get_by_schedule_id(schedule_id)

        if sessions and (data.room_id or data.start or data.end):
            # 경고 메시지 (차단 없이 진행)
            logger.warning(
                f"Schedule {schedule_id} updated with {len(sessions)} linked sessions"
            )

        # 3. Schedule 업데이트
        await schedule_repo.update(schedule_id, data.model_dump(exclude_unset=True))

        await uow.commit()
```

---

## 여러 Session이 같은 Schedule 참조 시 삭제

### 시나리오

**상황**: 집단 상담 (8명) Schedule 삭제 요청

```python
Schedule(id="schedule-1")
  ↑       ↑       ↑       ↑
Session1 Session2 Session3 ... Session8
```

**삭제 시 처리**:
```python
async def delete_schedule_handler(schedule_id, uow):
    async with uow:
        # 1. 연결된 모든 Session 조회
        sessions = await session_repo.get_by_schedule_id(schedule_id)
        # → 8개 Session 조회

        # 2. 모든 Session 상태 변경
        for session in sessions:
            if session.status == "SCHEDULED":
                await session_repo.update(session.id, {"status": "CANCELLED"})

        # 3. Schedule 삭제
        await schedule_repo.delete(schedule_id)
```

**최종 상태**:
```
Schedule: 삭제됨
Session1-8: schedule_id=null, status="CANCELLED"
```

---

## 가계약 Session에 Schedule 중복 연결

### 시나리오

**상황**: schedule_id=null인 Session에 Schedule을 2번 연결 시도

```python
# 가계약 Session
Session(id="session-1", schedule_id=null, status="PENDING")

# 첫 번째 연결
PATCH /sessions/session-1/schedule
{
  "schedule_id": "schedule-a"
}
# → Session.schedule_id = "schedule-a", status="SCHEDULED"

# 두 번째 연결 시도 (실수 또는 재예약)
PATCH /sessions/session-1/schedule
{
  "schedule_id": "schedule-b"
}
```

**문제점**:
- 이미 schedule_id가 있는 Session에 다른 Schedule 연결 시도
- 기존 일정 덮어쓰기 위험

---

### 해결 전략: 기존 schedule_id 검증

```python
async def attach_schedule_to_session_handler(
    session_id: str,
    data: ScheduleAttach,
    uow: UnitOfWork,
):
    async with uow:
        session_repo = uow.repo(CounselingSessionRepository)

        # 1. Session 조회
        session = await session_repo.get(session_id)

        # 2. 이미 schedule_id가 있는지 검증
        if session.schedule_id:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "이미 일정이 연결되어 있습니다",
                    "current_schedule_id": session.schedule_id,
                    "actions_required": [
                        "기존 일정을 먼저 해제하세요",
                        "또는 Schedule 수정 API를 사용하세요"
                    ]
                }
            )

        # 3. Schedule 연결
        await session_repo.update(session_id, {
            "schedule_id": data.schedule_id,
            "status": "SCHEDULED"
        })

        await uow.commit()
```

---

## Schedule 없이 캘린더 뷰 조회

### 시나리오

**상황**: schedule_id=null인 Session들의 캘린더 표시

```python
# 가계약 Session들
Session(id="session-1", schedule_id=null, status="PENDING", session_number=1)
Session(id="session-2", schedule_id=null, status="PENDING", session_number=2)

# 캘린더 뷰 조회
GET /schedules?start=2026-01-01&end=2026-01-31
# → Schedule만 반환 (가계약 Session은 미표시)
```

**문제점**:
- 가계약 Session은 캘린더에 표시되지 않음
- 별도 UI에서 "일정 미확정" 목록 필요

---

### 해결 전략: 별도 API 제공

```python
# 1. Schedule 기반 캘린더 뷰
GET /centers/{center_id}/schedules?start=...&end=...
# → Schedule + 연결된 Session 반환

# 2. 일정 미확정 Session 목록
GET /centers/{center_id}/sessions/unscheduled
# → schedule_id=null인 Session 목록 반환

# app/modules/counseling/session/handlers/get_unscheduled.py
async def get_unscheduled_sessions_handler(
    center_id: str,
    uow: UnitOfWork,
):
    async with uow:
        session_repo = uow.repo(CounselingSessionRepository)

        # schedule_id=null이고 PENDING 상태인 Session 조회
        sessions = await session_repo.get_unscheduled(center_id)

        return {
            "total": len(sessions),
            "sessions": [
                SessionResponse.model_validate(s) for s in sessions
            ]
        }


# UI 구성
┌─────────────────────────────────────┐
│ 캘린더 뷰 (Schedule 기반)            │
│ - 14:00-15:00 부부상담 3회기          │
│ - 16:00-17:00 개별상담 1회기          │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 일정 미확정 (schedule_id=null)       │
│ - 홍길동 부부상담 4회기 (가계약)      │
│ - 김철수 개별상담 1회기 (대기)        │
└─────────────────────────────────────┘
```

---

## Case 종결 후 Schedule/Session 처리

### 시나리오

**상황**: Case 종결 시 예약된 Schedule/Session 존재

```python
# 초기 상태
Case(id="case-1", status="ACTIVE")
Session(id="session-1", case_id="case-1", status="COMPLETED", session_number=1)
Session(id="session-2", case_id="case-1", status="COMPLETED", session_number=2)
Session(id="session-3", case_id="case-1", status="SCHEDULED", session_number=3)  # 예약됨
Schedule(id="schedule-3", start="2026-02-01 14:00")

# Case 종결 요청
PATCH /cases/case-1
{
  "status": "COMPLETED"
}
```

**문제점**:
- 종결된 Case에 예약된 Session 존재
- Schedule은 유지할지, Session은 취소할지 불명확

---

### 해결 전략: 경고 + 옵션 제공

```python
# app/modules/counseling/case/handlers/complete_case.py
async def complete_counseling_case_handler(
    case_id: str,
    data: CounselingCaseCompleteRequest,
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        session_repo = uow.repo(CounselingSessionRepository)

        # 1. 예약된 Session 확인
        scheduled_sessions = await session_repo.get_by_case_and_status(
            case_id, status="SCHEDULED"
        )

        if scheduled_sessions and not data.force:
            # 2. 경고와 함께 옵션 제공
            return {
                "warning": True,
                "message": f"{len(scheduled_sessions)}개의 예약된 세션이 있습니다",
                "scheduled_sessions": [
                    {
                        "session_id": s.id,
                        "session_number": s.session_number,
                        "schedule_id": s.schedule_id
                    }
                    for s in scheduled_sessions
                ],
                "options": [
                    {
                        "action": "cancel_sessions",
                        "label": "예약 세션 취소 후 종결",
                        "description": "Session 상태를 CANCELLED로 변경"
                    },
                    {
                        "action": "force_complete",
                        "label": "경고 무시하고 종결",
                        "description": "Session은 SCHEDULED 상태 유지"
                    }
                ]
            }

        # 3. force=true 또는 예약 Session 없음 → 종결 진행
        case_repo = uow.repo(CounselingCaseRepository)

        if data.cancel_scheduled_sessions:
            # Session 취소
            for session in scheduled_sessions:
                await session_repo.update(session.id, {"status": "CANCELLED"})

        # Case 종결
        await case_repo.update(case_id, {"status": "COMPLETED"})
        await uow.commit()
```

**Request 스키마**:
```python
class CounselingCaseCompleteRequest(BaseModel):
    force: bool = False
    cancel_scheduled_sessions: bool = False
```

---

## Session session_number 중복

### 시나리오

**상황**: 같은 Case에 session_number가 중복 생성

```python
# Race Condition
Thread A: POST /sessions → session_number = max(1) + 1 = 2
Thread B: POST /sessions → session_number = max(1) + 1 = 2

# 결과
Session(case_id="case-1", session_number=2, client_id="client-a")
Session(case_id="case-1", session_number=2, client_id="client-b")  # 중복!
```

**문제점**:
- 같은 Case의 session_number 중복
- 회기 순서 혼란

---

### 해결 전략 A: DB Row Lock (권장)

```python
# app/modules/counseling/session/repository.py
async def get_max_session_number_for_update(self, case_id: str) -> int:
    """SELECT FOR UPDATE로 행 잠금"""
    result = await self._session.execute(
        select(func.max(CounselingSession.session_number))
        .where(CounselingSession.case_id == case_id)
        .with_for_update()  # 행 잠금
    )
    return result.scalar() or 0


# Handler
async def create_session_handler(data, uow):
    async with uow:
        session_repo = uow.repo(CounselingSessionRepository)

        # 1. 잠금 상태에서 최대 번호 조회
        max_number = await session_repo.get_max_session_number_for_update(
            data.case_id
        )

        # 2. 번호 할당 (잠금 상태에서 안전)
        session_number = max_number + 1

        # 3. Session 생성
        session = await session_repo.create({
            "case_id": data.case_id,
            "session_number": session_number,
            # ...
        })

        await uow.commit()  # 잠금 해제
```

---

### 해결 전략 B: Unique Constraint + Retry

```python
# DB 스키마
# UNIQUE(case_id, client_id, session_number) 제약조건

# Handler
from sqlalchemy.exc import IntegrityError

async def create_session_handler(data, uow):
    max_retries = 3

    for attempt in range(max_retries):
        try:
            async with uow:
                session_repo = uow.repo(CounselingSessionRepository)

                # 1. 최대 번호 조회
                max_number = await session_repo.get_max_session_number(
                    data.case_id
                )
                session_number = max_number + 1

                # 2. Session 생성 시도
                session = await session_repo.create({
                    "case_id": data.case_id,
                    "session_number": session_number,
                    # ...
                })

                await uow.commit()
                return session

        except IntegrityError:
            # 중복 발생 → 재시도
            if attempt == max_retries - 1:
                raise HTTPException(
                    status_code=409,
                    detail="세션 생성 충돌. 잠시 후 다시 시도해주세요."
                )
            await asyncio.sleep(0.1 * (attempt + 1))  # 백오프
```

---

### 성능 비교

| 전략 | 동시성 | 성능 | 구현 난이도 | 권장 상황 |
|------|-------|------|-----------|----------|
| **DB Row Lock** | 순차 처리 | 중간 | 낮음 | 일반적 케이스 |
| **Unique + Retry** | 동시 처리 | 높음 | 중간 | 고부하 환경 |

**권장**: Phase 1은 DB Row Lock, Phase 2는 Unique + Retry

---

## 종합 정리

### 엣지 케이스 우선순위

| 우선순위 | 엣지 케이스 | Phase 1 | Phase 2 |
|---------|------------|---------|---------|
| **P0 (Critical)** | 동시 Schedule 생성 (Room 충돌) | ✅ Row Lock | ✅ Advisory Lock |
| **P0** | Session session_number 중복 | ✅ DB Lock | ✅ Unique + Retry |
| **P1 (High)** | Schedule 삭제 시 Session 처리 | ✅ SET NULL + 상태변경 | - |
| **P1** | 가계약 Session에 Schedule 중복 연결 | ✅ 검증 차단 | - |
| **P1** | Case 종결 + SCHEDULED Session | ✅ 경고 | ✅ 자동 취소 옵션 |
| **P2 (Medium)** | 짝치료/집단 일부 노쇼 | ✅ 개별 상태 관리 | - |
| **P2** | Schedule 수정 시 Session 처리 | ✅ 경고만 | - |
| **P2** | Schedule 없이 캘린더 뷰 | ✅ 별도 API | - |
| **P3 (Low)** | Session/Schedule 시간 불일치 | ✅ Session scheduled_at 제거 | - |

---

### Phase별 구현 전략

**Phase 1 (MVP)**:
- Room 충돌 방지 (DB Row Lock)
- session_number 중복 방지 (DB Row Lock)
- Schedule 삭제 시 Session 상태 변경 (CANCELLED)
- 가계약 Session 중복 연결 방지 (검증)
- Case 종결 시 예약 Session 경고

**Phase 2 (확장)**:
- Advisory Lock으로 성능 개선 (고부하 대응)
- 일정 미확정 Session 별도 UI
- Case 종결 시 자동 취소 옵션
- 통계 및 모니터링 강화

---

## 참고 문서

- **Schedule 도메인 설계**: `/docs/schedule/domain.md`
- **Schedule 시나리오**: `/docs/schedule/scenarios.md`
- **Counseling 도메인**: `/docs/counseling/domain.md`
- **Counseling 엣지 케이스**: `/docs/counseling/edge-cases.md`

---

**작성일**: 2026-01-28
**버전**: 1.0
**기반 문서**: Schedule 도메인 v4.0
