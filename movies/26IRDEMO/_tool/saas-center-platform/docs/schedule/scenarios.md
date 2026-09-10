# Schedule 도메인 시나리오

> Schedule 도메인의 실제 사용 시나리오 및 플로우

---

## 시나리오 빠른 참조

| # | 시나리오 | 주요 흐름 | 핵심 포인트 |
|---|----------|----------|------------|
| 1 | **개별 상담 회기 생성** | Schedule + Session 생성 | 1 Schedule → 1 Session |
| 2 | **짝치료 회기 생성** | Schedule 1개 + Session N개 | 같은 schedule_id, 같은 session_number |
| 3 | **집단 상담 회기 생성** | Schedule 1개 + Session N개 | 참가자별 Session, 개별 정산 |
| 4 | **가계약 시나리오** | Session만 생성 → 나중에 Schedule 연결 | schedule_id = null |
| 5 | **노쇼 처리** | Session 상태만 변경 | session_number는 유지 |
| 6 | **회기 진행 현황 조회** | Case의 Session 목록 + 통계 | 완료 횟수는 동적 계산 |
| 7 | **캘린더 뷰 조회** | Schedule → Session 역참조 | 날짜 범위 조회 |
| 8 | **Schedule 삭제** | Session.schedule_id = null | SET NULL, Session 유지 |
| 9 | **Room 충돌 감지** | 동일 Room + 시간 중복 → 차단 | 충돌 시 400 에러 |
| 10 | **블록 일정 관리** | 휴무/점심시간 등록 → 예약 차단 | schedule_type="block" |

### 주요 주의사항

| 영역 | 주의사항 |
|------|----------|
| **Session → Schedule** | Session이 schedule_id로 직접 참조 (nullable) |
| **회기 번호** | session_number = Case의 회기 번호 (일정 순서, 고정) |
| **노쇼 처리** | 상태만 변경, session_number는 유지 |
| **완료 횟수** | status="COMPLETED" 카운트로 동적 계산 |
| **정산** | Session 단위 (개별 관리) |

> **핵심**: Schedule은 **시공간 정보만**. Session은 **내담자별 회기 + 정산 단위**.

---

## 목차

1. [시나리오 1: 개별 상담 회기 생성](#시나리오-1-개별-상담-회기-생성)
2. [시나리오 2: 짝치료 회기 생성](#시나리오-2-짝치료-회기-생성)
3. [시나리오 3: 집단 상담 회기 생성](#시나리오-3-집단-상담-회기-생성)
4. [시나리오 4: 가계약 시나리오](#시나리오-4-가계약-시나리오)
5. [시나리오 5: 노쇼 처리](#시나리오-5-노쇼-처리)
6. [시나리오 6: 회기 진행 현황 조회](#시나리오-6-회기-진행-현황-조회)
7. [시나리오 7: 캘린더 뷰 조회](#시나리오-7-캘린더-뷰-조회)
8. [시나리오 8: Schedule 삭제](#시나리오-8-schedule-삭제)
9. [시나리오 9: Room 충돌 감지](#시나리오-9-room-충돌-감지)
10. [시나리오 10: 블록 일정 관리](#시나리오-10-블록-일정-관리)

---

## 시나리오 1: 개별 상담 회기 생성

### 개요
개별 상담(1:1) 회기 생성

### 액터
- 센터 관리자 / 상담사

### 전제 조건
- `Center(id={center_id})` 존재
- `CounselingCase(id={case_id}, case_type="individual")` 존재
- `Client(id={client_id})` 존재

---

### 플로우

#### [1단계] 센터: 개별 상담 회기 생성 요청

**HTTP Request**:
```http
POST /centers/{center_id}/counseling-cases/{case_id}/sessions
Content-Type: application/json
Authorization: Bearer {token}

{
  "schedule": {
    "start": "2026-01-27T14:00:00Z",
    "end": "2026-01-27T15:00:00Z",
    "room_id": "{room_id}",
    "note": "정기 상담"
  }
}
```

#### [2단계] Handler: Schedule + Session 생성

**Handler Logic**:
```python
async def create_individual_session_handler(
    center_id: str,
    case_id: str,
    data: IndividualSessionCreate,
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        schedule_repo = uow.repo(ScheduleRepository)
        session_repo = uow.repo(CounselingSessionRepository)
        case_repo = uow.repo(CounselingCaseRepository)

        # 1. Case 조회
        case = await case_repo.get(case_id)
        if not case or case.center_id != center_id:
            raise HTTPException(404, "케이스를 찾을 수 없습니다")

        if case.case_type != "individual":
            raise HTTPException(400, "개별 상담 케이스가 아닙니다")

        # 2. 다음 회기 번호 계산
        max_number = await session_repo.get_max_session_number(case_id)
        next_number = (max_number or 0) + 1

        # 3. Schedule 생성 (1개)
        schedule = await schedule_repo.create({
            "center_id": center_id,
            "schedule_type": "counseling",
            "start": to_utc_naive(data.schedule.start),
            "end": to_utc_naive(data.schedule.end),
            "room_id": data.schedule.room_id,
            "note": data.schedule.note
        })

        # 4. Session 생성 (1개)
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

#### [3단계] DB Changes

```sql
-- 1. Schedule 생성
INSERT INTO schedules (
    id, center_id, schedule_type, room_id,
    start, end, note, created_at, updated_at
) VALUES (
    '{schedule_id}', '{center_id}', 'counseling', '{room_id}',
    '2026-01-27 14:00:00', '2026-01-27 15:00:00', '정기 상담',
    '2026-01-27 10:00:00', '2026-01-27 10:00:00'
);

-- 2. Session 생성
INSERT INTO counseling_sessions (
    id, center_id, case_id, client_id, schedule_id,
    session_number, status, created_at, updated_at
) VALUES (
    '{session_id}', '{center_id}', '{case_id}', '{client_id}', '{schedule_id}',
    1, 'SCHEDULED', '2026-01-27 10:00:00', '2026-01-27 10:00:00'
);
```

#### [4단계] HTTP Response

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": "{session_id}",
  "center_id": "{center_id}",
  "case_id": "{case_id}",
  "client_id": "{client_id}",
  "schedule_id": "{schedule_id}",
  "session_number": 1,
  "status": "SCHEDULED",
  "billing_amount": null,
  "billing_status": null,
  "created_at": "2026-01-27T10:00:00Z",
  "updated_at": "2026-01-27T10:00:00Z"
}
```

---

### 최종 상태

```
Schedule(id={schedule_id}, 14:00-15:00, 상담실1)
  ↑
Session(case=개별상담, client=홍길동, session_number=1, SCHEDULED)
```

---

## 시나리오 2: 짝치료 회기 생성

### 개요
짝치료(부부상담) 회기 생성 - 1개 Schedule, 2개 Session

### 액터
- 센터 관리자 / 상담사

### 전제 조건
- `CounselingCase(id={case_id}, case_type="couple")` 존재
- `CaseParticipant(case_id, client_id=홍길동)` 존재
- `CaseParticipant(case_id, client_id=김영희)` 존재

---

### 플로우

#### [1단계] 센터: 짝치료 회기 생성 요청

**HTTP Request**:
```http
POST /centers/{center_id}/counseling-cases/{case_id}/sessions
Content-Type: application/json
Authorization: Bearer {token}

{
  "case_type": "couple",
  "client_ids": ["{hong_id}", "{kim_id}"],
  "schedule": {
    "start": "2026-01-27T14:00:00Z",
    "end": "2026-01-27T15:00:00Z",
    "room_id": "{room_id}"
  }
}
```

#### [2단계] Handler: Schedule 1개 + Session 2개 생성

**Handler Logic**:
```python
async def create_couple_session_handler(
    center_id: str,
    case_id: str,
    data: CoupleSessionCreate,
    uow: UnitOfWork = Depends(get_uow),
):
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

#### [3단계] DB Changes

```sql
-- 1. Schedule 생성 (1개)
INSERT INTO schedules (
    id, center_id, schedule_type, room_id,
    start, end, created_at, updated_at
) VALUES (
    '{schedule_id}', '{center_id}', 'counseling', '{room_id}',
    '2026-01-27 14:00:00', '2026-01-27 15:00:00',
    '2026-01-27 10:00:00', '2026-01-27 10:00:00'
);

-- 2. Session 생성 (홍길동)
INSERT INTO counseling_sessions (
    id, center_id, case_id, client_id, schedule_id,
    session_number, status, created_at, updated_at
) VALUES (
    '{session_hong_id}', '{center_id}', '{case_id}', '{hong_id}', '{schedule_id}',
    1, 'SCHEDULED', '2026-01-27 10:00:00', '2026-01-27 10:00:00'
);

-- 3. Session 생성 (김영희)
INSERT INTO counseling_sessions (
    id, center_id, case_id, client_id, schedule_id,
    session_number, status, created_at, updated_at
) VALUES (
    '{session_kim_id}', '{center_id}', '{case_id}', '{kim_id}', '{schedule_id}',
    1, 'SCHEDULED', '2026-01-27 10:00:00', '2026-01-27 10:00:00'
);
```

#### [4단계] HTTP Response

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "schedule_id": "{schedule_id}",
  "session_number": 1,
  "sessions": [
    {
      "id": "{session_hong_id}",
      "case_id": "{case_id}",
      "client_id": "{hong_id}",
      "client_name": "홍길동",
      "schedule_id": "{schedule_id}",
      "session_number": 1,
      "status": "SCHEDULED"
    },
    {
      "id": "{session_kim_id}",
      "case_id": "{case_id}",
      "client_id": "{kim_id}",
      "client_name": "김영희",
      "schedule_id": "{schedule_id}",
      "session_number": 1,
      "status": "SCHEDULED"
    }
  ]
}
```

---

### 최종 상태

```
Schedule(id={schedule_id}, 14:00-15:00, 상담실1)
  ↑                          ↑
Session(홍길동, num=1)  Session(김영희, num=1)
```

---

## 시나리오 3: 집단 상담 회기 생성

### 개요
집단 상담 회기 생성 - 1개 Schedule, N개 Session (참가자별)

### 액터
- 센터 관리자 / 상담사

### 전제 조건
- `CounselingCase(id={case_id}, case_type="group")` 존재
- `CaseParticipant` 8명 존재

---

### 플로우

#### [1단계] 센터: 집단 상담 회기 생성 요청

**HTTP Request**:
```http
POST /centers/{center_id}/counseling-cases/{case_id}/sessions
Content-Type: application/json
Authorization: Bearer {token}

{
  "case_type": "group",
  "schedule": {
    "start": "2026-01-27T16:00:00Z",
    "end": "2026-01-27T18:00:00Z",
    "room_id": "{room_group_id}"
  }
}
```

#### [2단계] Handler: Schedule 1개 + Session 8개 생성

**Handler Logic**:
```python
async def create_group_session_handler(
    center_id: str,
    case_id: str,
    data: GroupSessionCreate,
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        schedule_repo = uow.repo(ScheduleRepository)
        session_repo = uow.repo(CounselingSessionRepository)
        case_repo = uow.repo(CounselingCaseRepository)
        participant_repo = uow.repo(CaseParticipantRepository)

        # 1. Case 조회 및 검증
        case = await case_repo.get(case_id)
        if not case or case.case_type != "group":
            raise HTTPException(400, "집단 상담 케이스가 아닙니다")

        # 2. 참여자 목록 조회
        participants = await participant_repo.list_by_case(case_id)
        if not participants:
            raise HTTPException(400, "참여자가 없습니다")

        # 3. 다음 회기 번호 계산 (Case 기준)
        max_number = await session_repo.get_max_session_number(case_id)
        next_number = (max_number or 0) + 1

        # 4. Schedule 1개 생성
        schedule = await schedule_repo.create({
            "center_id": center_id,
            "schedule_type": "counseling",
            "start": to_utc_naive(data.schedule.start),
            "end": to_utc_naive(data.schedule.end),
            "room_id": data.schedule.room_id
        })

        # 5. 참가자별 Session 생성 (N개, 같은 session_number)
        sessions = []
        for participant in participants:
            session = await session_repo.create({
                "center_id": center_id,
                "case_id": case_id,
                "client_id": participant.client_id,  # 각 참가자
                "schedule_id": schedule.id,  # 같은 Schedule
                "session_number": next_number,  # 같은 회기 번호
                "status": "SCHEDULED"
            })
            sessions.append(session)

        await uow.commit()
        return {
            "schedule_id": schedule.id,
            "session_number": next_number,
            "participant_count": len(sessions),
            "sessions": [SessionResponse.model_validate(s) for s in sessions]
        }
```

#### [3단계] DB Changes

```sql
-- 1. Schedule 생성 (1개)
INSERT INTO schedules (...) VALUES (...);

-- 2. Session 생성 (참가자별, 8개)
INSERT INTO counseling_sessions (
    id, center_id, case_id, client_id, schedule_id,
    session_number, status, created_at, updated_at
) VALUES
('{session1_id}', '{center_id}', '{case_id}', '{client1_id}', '{schedule_id}', 1, 'SCHEDULED', ...),
('{session2_id}', '{center_id}', '{case_id}', '{client2_id}', '{schedule_id}', 1, 'SCHEDULED', ...),
-- ... 8개
```

---

### 최종 상태

```
Schedule(id={schedule_id}, 16:00-18:00, 대강당)
  ↑       ↑       ↑       ↑
Session1 Session2 Session3 ... Session8
(홍길동)  (김철수)  (박영희)     (...)
num=1    num=1    num=1       num=1
```

---

## 시나리오 4: 가계약 시나리오

### 개요
일정 미확정 상태에서 Session만 생성 → 나중에 Schedule 연결

### 액터
- 센터 관리자 / 상담사

### 전제 조건
- `CounselingCase(id={case_id})` 존재
- 일정은 아직 확정되지 않음

---

### 플로우

#### [1단계] 접수 시: Session만 생성 (schedule_id=null)

**HTTP Request**:
```http
POST /centers/{center_id}/counseling-cases/{case_id}/sessions
Content-Type: application/json
Authorization: Bearer {token}

{
  "without_schedule": true
}
```

**Handler Logic**:
```python
async def create_session_without_schedule_handler(
    center_id: str,
    case_id: str,
    uow: UnitOfWork,
):
    async with uow:
        session_repo = uow.repo(CounselingSessionRepository)
        case_repo = uow.repo(CounselingCaseRepository)

        # 1. Case 조회
        case = await case_repo.get(case_id)

        # 2. 다음 회기 번호 계산
        max_number = await session_repo.get_max_session_number(case_id)
        next_number = (max_number or 0) + 1

        # 3. Session 생성 (schedule_id=null)
        session = await session_repo.create({
            "center_id": center_id,
            "case_id": case_id,
            "client_id": case.primary_client_id,
            "schedule_id": None,  # 일정 미확정
            "session_number": next_number,
            "status": "PENDING"  # 대기 상태
        })

        await uow.commit()
        return SessionResponse.model_validate(session)
```

**DB Changes**:
```sql
-- Session 생성 (schedule_id=null)
INSERT INTO counseling_sessions (
    id, center_id, case_id, client_id, schedule_id,
    session_number, status, created_at, updated_at
) VALUES (
    '{session_id}', '{center_id}', '{case_id}', '{client_id}', NULL,
    1, 'PENDING', '2026-01-27 10:00:00', '2026-01-27 10:00:00'
);
```

#### [2단계] 일정 확정 시: Schedule 생성 + Session 연결

**HTTP Request**:
```http
PATCH /centers/{center_id}/counseling-sessions/{session_id}/schedule
Content-Type: application/json
Authorization: Bearer {token}

{
  "start": "2026-01-30T14:00:00Z",
  "end": "2026-01-30T15:00:00Z",
  "room_id": "{room_id}"
}
```

**Handler Logic**:
```python
async def attach_schedule_to_session_handler(
    center_id: str,
    session_id: str,
    data: ScheduleAttach,
    uow: UnitOfWork,
):
    async with uow:
        schedule_repo = uow.repo(ScheduleRepository)
        session_repo = uow.repo(CounselingSessionRepository)

        # 1. Session 조회
        session = await session_repo.get(session_id)
        if session.schedule_id:
            raise HTTPException(400, "이미 일정이 연결되어 있습니다")

        # 2. Schedule 생성
        schedule = await schedule_repo.create({
            "center_id": center_id,
            "schedule_type": "counseling",
            "start": to_utc_naive(data.start),
            "end": to_utc_naive(data.end),
            "room_id": data.room_id
        })

        # 3. Session에 Schedule 연결
        await session_repo.update(session_id, {
            "schedule_id": schedule.id,
            "status": "SCHEDULED"
        })

        await uow.commit()
        return SessionResponse.model_validate(session)
```

**DB Changes**:
```sql
-- 1. Schedule 생성
INSERT INTO schedules (...) VALUES (...);

-- 2. Session 업데이트
UPDATE counseling_sessions
SET schedule_id = '{schedule_id}', status = 'SCHEDULED', updated_at = NOW()
WHERE id = '{session_id}';
```

---

### 최종 상태

```
[가계약 상태]
Session(schedule_id=null, status="PENDING")

[일정 확정 후]
Schedule(id={schedule_id})
  ↑
Session(schedule_id={schedule_id}, status="SCHEDULED")
```

---

## 시나리오 5: 노쇼 처리

### 개요
회기 진행 시 노쇼 발생 - 상태만 변경, session_number는 유지

### 액터
- 상담사

### 전제 조건
- `Schedule(id={schedule_id})` 존재
- `Session(session_number=2, status="SCHEDULED")` 2개 존재 (짝치료)

---

### 플로우

#### [1단계] 회기 진행: 홍길동 출석, 김영희 노쇼

**HTTP Request (홍길동)**:
```http
PATCH /centers/{center_id}/counseling-sessions/{session_hong_id}
Content-Type: application/json
Authorization: Bearer {token}

{
  "status": "COMPLETED",
  "billing_amount": 80000,
  "billing_status": "PAID"
}
```

**HTTP Request (김영희)**:
```http
PATCH /centers/{center_id}/counseling-sessions/{session_kim_id}
Content-Type: application/json
Authorization: Bearer {token}

{
  "status": "NO_SHOW"
}
```

#### [2단계] DB Changes

```sql
-- 홍길동 Session: 완료
UPDATE counseling_sessions
SET
    status = 'COMPLETED',
    billing_amount = 80000,
    billing_status = 'PAID',
    updated_at = '2026-01-27 15:30:00'
WHERE id = '{session_hong_id}';

-- 김영희 Session: 노쇼 (session_number는 그대로)
UPDATE counseling_sessions
SET
    status = 'NO_SHOW',
    updated_at = '2026-01-27 15:30:00'
WHERE id = '{session_kim_id}';
```

---

### 회기 진행 상태

```
부부상담 2회기:
- 홍길동: session_number=2, status="COMPLETED" → 2회기 완료
- 김영희: session_number=2, status="NO_SHOW" → 2회기 노쇼

다음 회기:
- 모두 session_number=3 (회기 번호는 계속 증가)

홍길동 완료 횟수: 2회 (1회, 2회)
김영희 완료 횟수: 1회 (1회만, 2회는 노쇼)
```

---

## 시나리오 6: 회기 진행 현황 조회

### 개요
Case의 전체 회기 목록 및 내담자별 통계 조회

### 액터
- 센터 관리자 / 상담사

### 전제 조건
- `CounselingCase(id={case_id}, case_type="couple")` 존재
- 여러 회기 진행됨

---

### 플로우

#### [1단계] 회기 진행 현황 조회 요청

**HTTP Request**:
```http
GET /centers/{center_id}/counseling-cases/{case_id}/progress
Authorization: Bearer {token}
```

#### [2단계] Handler: Session 조회 + 통계 계산

**Handler Logic**:
```python
async def get_case_progress_handler(
    center_id: str,
    case_id: str,
    uow: UnitOfWork,
) -> CaseProgressResponse:
    async with uow:
        session_repo = uow.repo(CounselingSessionRepository)

        # 1. Case의 모든 Session 조회
        sessions = await session_repo.list_by_case(case_id)

        # 2. client별로 그룹핑
        sessions_by_client = {}
        for session in sessions:
            if session.client_id not in sessions_by_client:
                sessions_by_client[session.client_id] = []
            sessions_by_client[session.client_id].append(session)

        # 3. 통계 계산
        client_progress = []
        for client_id, client_sessions in sessions_by_client.items():
            # 전체 일정 수 (취소 제외)
            total = len([s for s in client_sessions if s.status != "CANCELLED"])

            # 완료 횟수
            completed = len([s for s in client_sessions if s.status == "COMPLETED"])

            # 노쇼 횟수
            no_show = len([s for s in client_sessions if s.status == "NO_SHOW"])

            # 참석률
            attendance_rate = (completed / total * 100) if total > 0 else 0

            client_progress.append(ClientProgressResponse(
                client_id=client_id,
                client_name=client_sessions[0].client.name,
                total_scheduled=total,
                completed_count=completed,
                no_show_count=no_show,
                attendance_rate=attendance_rate,
                sessions=[
                    SessionSummary(
                        session_number=s.session_number,
                        schedule_date=s.schedule.start if s.schedule else None,
                        status=s.status,
                        billing_status=s.billing_status
                    ) for s in sorted(client_sessions, key=lambda x: x.session_number)
                ]
            ))

        return CaseProgressResponse(
            case_id=case_id,
            case_code=sessions[0].case.code,
            case_type=sessions[0].case.case_type,
            clients=client_progress
        )
```

#### [3단계] HTTP Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "case_id": "{case_id}",
  "case_code": "홍길동부부-부부상담-20260127",
  "case_type": "couple",
  "clients": [
    {
      "client_id": "{hong_id}",
      "client_name": "홍길동",
      "total_scheduled": 3,
      "completed_count": 3,
      "no_show_count": 0,
      "attendance_rate": 100.0,
      "sessions": [
        {
          "session_number": 1,
          "schedule_date": "2026-01-13T14:00:00Z",
          "status": "COMPLETED",
          "billing_status": "PAID"
        },
        {
          "session_number": 2,
          "schedule_date": "2026-01-20T14:00:00Z",
          "status": "COMPLETED",
          "billing_status": "PAID"
        },
        {
          "session_number": 3,
          "schedule_date": "2026-01-27T14:00:00Z",
          "status": "COMPLETED",
          "billing_status": "PAID"
        }
      ]
    },
    {
      "client_id": "{kim_id}",
      "client_name": "김영희",
      "total_scheduled": 3,
      "completed_count": 2,
      "no_show_count": 1,
      "attendance_rate": 66.7,
      "sessions": [
        {
          "session_number": 1,
          "schedule_date": "2026-01-13T14:00:00Z",
          "status": "COMPLETED",
          "billing_status": "PAID"
        },
        {
          "session_number": 2,
          "schedule_date": "2026-01-20T14:00:00Z",
          "status": "NO_SHOW",
          "billing_status": null
        },
        {
          "session_number": 3,
          "schedule_date": "2026-01-27T14:00:00Z",
          "status": "COMPLETED",
          "billing_status": "PAID"
        }
      ]
    }
  ]
}
```

---

### UI 표시

```
홍길동부부-부부상담 진행 현황

홍길동:
  참석률: 3/3 (100%)
  1회기: 2026-01-13 출석 ✓ 정산완료
  2회기: 2026-01-20 출석 ✓ 정산완료
  3회기: 2026-01-27 출석 ✓ 정산완료

김영희:
  참석률: 2/3 (66.7%)
  1회기: 2026-01-13 출석 ✓ 정산완료
  2회기: 2026-01-20 노쇼 ✗
  3회기: 2026-01-27 출석 ✓ 정산완료
```

---

## 시나리오 7: 캘린더 뷰 조회

### 개요
날짜 범위 기반 일정 목록 조회 (캘린더 UI용)

### 액터
- 센터 관리자 / 상담사

### 전제 조건
- 해당 기간에 Schedule 데이터 존재
- Schedule과 연결된 Session 존재

---

### 플로우

#### [1단계] 주간/월간 일정 조회 요청

**HTTP Request**:
```http
GET /centers/{center_id}/schedules?start=2026-01-27T00:00:00Z&end=2026-02-03T23:59:59Z
Authorization: Bearer {token}
```

#### [2단계] Handler: Schedule + Session 역참조 조회

**Handler Logic**:
```python
async def get_schedules_handler(
    center_id: str,
    start: datetime,
    end: datetime,
    uow: UnitOfWork,
) -> list[ScheduleResponse]:
    async with uow:
        schedule_repo = uow.repo(ScheduleRepository)
        session_repo = uow.repo(CounselingSessionRepository)

        # 1. Schedule 조회 (날짜 범위)
        schedules = await schedule_repo.get_by_range(
            center_id=center_id,
            start=to_utc_naive(start),
            end=to_utc_naive(end)
        )

        if not schedules:
            return []

        schedule_ids = [s.id for s in schedules]

        # 2. Session 역참조 조회 (schedule_id로)
        sessions = await session_repo.get_by_schedule_ids(schedule_ids)

        # schedule_id별로 그룹핑
        sessions_by_schedule = {}
        for session in sessions:
            if session.schedule_id not in sessions_by_schedule:
                sessions_by_schedule[session.schedule_id] = []
            sessions_by_schedule[session.schedule_id].append(session)

        # 3. 응답 조합
        result = []
        for schedule in schedules:
            schedule_sessions = sessions_by_schedule.get(schedule.id, [])

            # Session 요약 생성
            session_summaries = []
            for session in schedule_sessions:
                session_summaries.append(SessionSummary(
                    session_id=session.id,
                    case_code=session.case.code,
                    case_type=session.case.case_type,
                    session_number=session.session_number,
                    clients=[
                        ClientSummary(
                            client_id=session.client_id,
                            client_name=session.client.name,
                            attendance_status=session.status
                        )
                    ]
                ))

            result.append(ScheduleResponse(
                id=schedule.id,
                start=schedule.start,
                end=schedule.end,
                room_id=schedule.room_id,
                room_name="상담실1",  # TODO: 센터 도메인에서 조회
                schedule_type=schedule.schedule_type,
                sessions=session_summaries
            ))

        return result
```

#### [3단계] HTTP Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

[
  {
    "id": "{schedule1_id}",
    "start": "2026-01-27T14:00:00Z",
    "end": "2026-01-27T15:00:00Z",
    "room_id": "{room_id}",
    "room_name": "상담실1",
    "schedule_type": "counseling",
    "sessions": [
      {
        "session_id": "{session_hong_id}",
        "case_code": "홍길동부부-부부상담",
        "case_type": "couple",
        "session_number": 3,
        "clients": [
          {
            "client_id": "{hong_id}",
            "client_name": "홍길동",
            "attendance_status": "COMPLETED"
          }
        ]
      },
      {
        "session_id": "{session_kim_id}",
        "case_code": "홍길동부부-부부상담",
        "case_type": "couple",
        "session_number": 3,
        "clients": [
          {
            "client_id": "{kim_id}",
            "client_name": "김영희",
            "attendance_status": "NO_SHOW"
          }
        ]
      }
    ]
  }
]
```

---

### 캘린더 UI 표시

```
┌─────────────────────────────────────────────────────────┐
│  2026-01-27 월요일                                        │
├─────────────────────────────────────────────────────────┤
│  14:00-15:00  부부상담 3회기  상담실1                     │
│  홍길동부부-부부상담                                       │
│  👥 홍길동 (출석), 김영희 (노쇼)                           │
└─────────────────────────────────────────────────────────┘
```

---

## 시나리오 8: Schedule 삭제

### 개요
일정 삭제 시 Session은 유지 (연결만 해제)

### 액터
- 센터 관리자

### 전제 조건
- `Schedule(id={schedule_id})` 존재
- 해당 Schedule과 연결된 Session 존재

---

### 플로우

#### [1단계] Schedule 삭제 요청

**HTTP Request**:
```http
DELETE /centers/{center_id}/schedules/{schedule_id}
Authorization: Bearer {token}
```

#### [2단계] Handler: Schedule 삭제 (SET NULL)

**Handler Logic**:
```python
async def delete_schedule_handler(
    center_id: str,
    schedule_id: str,
    uow: UnitOfWork,
):
    async with uow:
        schedule_repo = uow.repo(ScheduleRepository)

        # 1. Schedule 조회
        schedule = await schedule_repo.get(schedule_id)
        if not schedule or schedule.center_id != center_id:
            raise HTTPException(404, "일정을 찾을 수 없습니다")

        # 2. Schedule 삭제
        # ondelete="SET NULL" → Session.schedule_id = null
        await schedule_repo.delete(schedule_id)

        await uow.commit()
        return {"message": "일정이 삭제되었습니다"}
```

#### [3단계] DB Changes

```sql
-- Schedule 삭제 → Session.schedule_id = null (SET NULL)
DELETE FROM schedules WHERE id = '{schedule_id}';

-- 자동으로 연결된 Session의 schedule_id가 null로 변경됨
-- UPDATE counseling_sessions SET schedule_id = NULL WHERE schedule_id = '{schedule_id}';
```

---

### 최종 상태

```
[삭제 전]
Schedule(id={schedule_id})
  ↑
Session(schedule_id={schedule_id})

[삭제 후]
Schedule: 삭제됨
Session(schedule_id=null, status 유지)
```

**Session은 유지**되며, 다른 Schedule과 다시 연결 가능합니다.

---

## 시나리오 9: Room 충돌 감지

### 개요
동일 장소에 시간대가 겹치는 일정 등록 시 차단

### 액터
- 센터 관리자 / 상담사

### 전제 조건
- `Room(id={room_id})` 존재
- 해당 Room에 기존 Schedule 존재

---

### 플로우

#### [1단계] 기존 일정 상태

```
기존 일정:
Schedule(room_id={room_id}, start="14:00", end="15:00")
```

#### [2단계] 충돌 일정 생성 시도

**HTTP Request**:
```http
POST /centers/{center_id}/schedules
Content-Type: application/json
Authorization: Bearer {token}

{
  "schedule_type": "counseling",
  "room_id": "{room_id}",
  "start": "2026-01-27T14:30:00Z",
  "end": "2026-01-27T15:30:00Z"
}
```

#### [3단계] Handler: 충돌 검사

**충돌 검사 로직**:
```python
async def check_room_conflict(
    self,
    room_id: str,
    start: datetime,
    end: datetime,
    exclude_id: str | None = None,
) -> bool:
    """
    시간대 중복 조건: (A.start < B.end) AND (A.end > B.start)
    """
    query = select(Schedule).where(
        Schedule.room_id == room_id,
        Schedule.start < end,
        Schedule.end > start
    )

    if exclude_id:
        query = query.where(Schedule.id != exclude_id)

    result = await self._session.execute(query)
    conflicts = result.scalars().all()
    return len(conflicts) > 0
```

#### [4단계] HTTP Response (충돌 시)

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "detail": "해당 시간에 이미 예약된 일정이 있습니다"
}
```

---

### 충돌 케이스 정리

| 기존 일정 | 신규 일정 | 결과 |
|----------|----------|------|
| 14:00-15:00 | 14:30-15:30 | **충돌** (시간 중복) |
| 14:00-15:00 | 13:30-14:30 | **충돌** (시간 중복) |
| 14:00-15:00 | 13:00-16:00 | **충돌** (기존 일정 포함) |
| 14:00-15:00 | 14:15-14:45 | **충돌** (기존 일정에 포함) |
| 14:00-15:00 | 15:00-16:00 | 충돌 없음 (연속) |
| 14:00-15:00 | 13:00-14:00 | 충돌 없음 (연속) |
| 14:00-15:00 | 16:00-17:00 | 충돌 없음 (시간대 다름) |

---

## 시나리오 10: 블록 일정 관리

### 개요
점심시간, 휴무일 등 예약 불가 시간대 등록

### 액터
- 센터 관리자

### 전제 조건
- `Center(id={center_id})` 존재

---

### 플로우

#### [1단계] 블록 일정 생성 요청

**HTTP Request**:
```http
POST /centers/{center_id}/schedules
Content-Type: application/json
Authorization: Bearer {token}

{
  "schedule_type": "block",
  "title": "점심시간",
  "room_id": null,
  "start": "2026-01-27T12:00:00Z",
  "end": "2026-01-27T13:00:00Z"
}
```

#### [2단계] Handler: 블록 일정 생성

**Handler Logic**:
```python
async def create_schedule_handler(
    center_id: str,
    data: ScheduleCreate,
    uow: UnitOfWork,
):
    async with uow:
        schedule_repo = uow.repo(ScheduleRepository)

        # 블록 일정은 Room 검증 생략
        if data.schedule_type != "block" and data.room_id:
            # ... 기존 Room 검증 로직
            pass

        schedule = await schedule_repo.create({
            "center_id": center_id,
            "schedule_type": data.schedule_type,
            "title": data.title,  # 블록/회의용 제목
            "room_id": data.room_id,  # 블록은 null 가능
            "start": to_utc_naive(data.start),
            "end": to_utc_naive(data.end)
        })

        await uow.commit()
        return ScheduleResponse.model_validate(schedule)
```

#### [3단계] HTTP Response

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": "{schedule_id}",
  "center_id": "{center_id}",
  "schedule_type": "block",
  "title": "점심시간",
  "room_id": null,
  "room_name": null,
  "start": "2026-01-27T12:00:00Z",
  "end": "2026-01-27T13:00:00Z",
  "sessions": [],
  "created_at": "2026-01-27T09:00:00Z",
  "updated_at": "2026-01-27T09:00:00Z"
}
```

---

### 블록 일정 유형

| 유형 | room_id | 설명 |
|------|---------|------|
| **전체 블록** | null | 센터 전체 예약 불가 (점심, 휴무) |
| **장소 블록** | {room_id} | 특정 Room만 예약 불가 (청소, 점검) |

---

## 시나리오 요약

| 시나리오 | Schedule | Session | 핵심 특징 |
|---------|----------|---------|----------|
| 1. 개별 상담 | 1개 | 1개 | 1:1 연결 |
| 2. 짝치료 | 1개 | 2개 | 같은 schedule_id, 같은 session_number |
| 3. 집단 상담 | 1개 | N개 | 참가자별 Session, 개별 정산 |
| 4. 가계약 | 없음 → 생성 | 1개 | schedule_id = null → 연결 |
| 5. 노쇼 | 유지 | 상태만 변경 | session_number 유지 |
| 6. 진행 현황 | - | Session 목록 | 완료 횟수 동적 계산 |
| 7. 캘린더 뷰 | Schedule | Session 역참조 | 날짜 범위 조회 |
| 8. Schedule 삭제 | 삭제 | 유지 | SET NULL, 재연결 가능 |
| 9. Room 충돌 | 차단 | - | 시간 중복 감지 |
| 10. 블록 일정 | 생성 | 없음 | room_id null 가능 |

---

## 참고 문서

- **Schedule 도메인 설계**: `/docs/schedule/domain.md`
- **Counseling 도메인**: `/docs/counseling/domain.md`
- **Assessment 도메인**: `/docs/assessment/domain_v3.md`

---

**작성일**: 2026-01-27
**버전**: 2.0
**기반 문서**: Schedule 도메인 v4.0
**변경 이력**:
- v1.0: 초기 작성 (ScheduledRelation 패턴)
- v1.1: domain.md v3.3과 동기화
- v2.0: 전면 재작성 (domain.md v4.0 기준)
  - Session → Schedule 직접 참조
  - Session.client_id 추가
  - 짝치료/집단상담 시나리오 개선
  - 가계약 시나리오 추가
  - 노쇼 처리 상세화
  - 회기 진행 현황 조회 추가
