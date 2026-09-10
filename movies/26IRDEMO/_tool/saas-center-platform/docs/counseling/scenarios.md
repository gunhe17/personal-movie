# Counseling 도메인 주요 시나리오

> Counseling 도메인의 실제 사용 시나리오 및 플로우

---

## 📋 시나리오 빠른 참조

| # | 시나리오 | 주요 흐름 | 핵심 포인트 |
|---|----------|----------|------------|
| 1 | **상담 유형 생성** | 센터별 유형 정의 | name, price, duration_minutes, counselor_ids, counseling_type |
| 2 | **개인상담 케이스 생성** | 상담 유형 선택 → 내담자/상담사 지정 → 케이스 생성 | 최소 1명 내담자, 1명 상담사 필수 |
| 3 | **상담 일정 기록(Session) 생성** | 케이스 선택 → Schedule 연동 → 자동 번호 할당 | session_number 자동 증가 |
| 4 | **짝치료 케이스** | 내담자 N명, 상담사 N명 (1:1 매칭) | CounselingCaseParticipant 활용 |
| 5 | **집단상담 케이스** | 다수 내담자, 1명 상담사 | 세션별 출석 관리 |
| 6 | **케이스 종결** | ACTIVE → COMPLETED 전이 | 진행 중 Session 완료 확인 |
| 7 | **CounselingSession 상태 전이** | SCHEDULED → COMPLETED/NO_SHOW/CANCELLED | 상태별 비즈니스 규칙 |
| 8 | **상담 기록 연동** | Session에 Document 연결 | Document 도메인 위임 |
| 9 | **상담사 변경** | 기존 상담사 unassigned_at 설정 → 새 상담사 추가 | 이력 보존 |
| 10 | **세션별 출석 관리** | CounselingSessionParticipant 생성 | 집단상담 출석 체크 |

### ⚠️ 주요 주의사항

| 영역 | 주의사항 |
|------|----------|
| **CounselingCaseParticipant** | participant_type으로 client/counselor 구분, 최소 1명씩 필수 |
| **CounselingSessionParticipant** | 세션별 출석 관리, status로 출석/불참 구분 |
| **순차 번호** | 자동 순차 증가, 취소/노쇼 시에도 번호 유지 |
| **케이스 상태** | ACTIVE에서만 CounselingSession 추가 가능 |
| **assigned_at / unassigned_at** | 참여자 이력 추적, unassigned_at=NULL은 현재 참여 중 |

> **참고**: CounselingSession은 상담 일정 기록(개별 방문 기록)입니다. 결제/청구 단위(회기)는 별도 Billing 도메인에서 관리합니다.

---

## 목차

1. [시나리오 1: 상담 유형 생성](#시나리오-1-상담-유형-생성)
2. [시나리오 2: 개인상담 케이스 생성](#시나리오-2-개인상담-케이스-생성)
3. [시나리오 3: 상담 일정 기록(Session) 생성](#시나리오-3-상담-일정-기록session-생성)
4. [시나리오 4: 짝치료 케이스](#시나리오-4-짝치료-케이스)
5. [시나리오 5: 집단상담 케이스](#시나리오-5-집단상담-케이스)
6. [시나리오 6: 케이스 종결](#시나리오-6-케이스-종결)
7. [시나리오 7: CounselingSession 상태 전이](#시나리오-7-counselingsession-상태-전이)
8. [시나리오 8: 상담 기록 연동 (Document)](#시나리오-8-상담-기록-연동-document)
9. [시나리오 9: 상담사 변경](#시나리오-9-상담사-변경)
10. [시나리오 10: 세션별 출석 관리](#시나리오-10-세션별-출석-관리)

---

## 시나리오 1: 상담 유형 생성

### 개요
센터에서 새로운 상담 유형(Counseling)을 정의

### 액터
- 센터 관리자

### 전제 조건
- center_id = {center_id}
- 기존 상담 유형: 개인상담, 부부상담

---

### 플로우

#### [1단계] 센터: 상담 유형 생성 요청

**HTTP Request**:
```http
POST /centers/{center_id}/counselings
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "가족상담",
  "description": "가족 구성원 전체 또는 일부가 참여하는 상담",
  "price": 80000,
  "duration_minutes": 90,
  "counselor_ids": ["{member_id_a}", "{member_id_b}"],
  "counseling_type": "group"
}
```

#### [2단계] Handler: 검증 및 생성

**Handler Logic**:
```python
async def create_counseling_handler(
    center_id: str,
    data: CounselingCreate,
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        counseling_repo = uow.repo(CounselingRepository)

        # 1. 중복 이름 검증 (센터 내 유일)
        existing = await counseling_repo.get_by_name(center_id, data.name)
        if existing:
            raise HTTPException(400, f"이미 존재하는 상담 유형입니다: {data.name}")

        # 2. 담당자 검증 (선택적)
        if data.counselor_ids:
            member_repo = uow.repo(CenterMemberRepository)
            for member_id in data.counselor_ids:
                member = await member_repo.get(member_id)
                if not member or member.center_id != center_id:
                    raise HTTPException(404, f"상담사를 찾을 수 없습니다: {member_id}")

        # 3. Counseling 생성
        counseling = await counseling_repo.create({
            "center_id": center_id,
            "name": data.name,
            "description": data.description,
            "price": data.price,
            "duration_minutes": data.duration_minutes,
            "counselor_ids": data.counselor_ids or [],
            "counseling_type": data.counseling_type
        })

        await uow.commit()
        return CounselingResponse.model_validate(counseling)
```

#### [3단계] DB Changes

```sql
INSERT INTO counselings (
    id, center_id, name, description, price, duration_minutes,
    counselor_ids, counseling_type, created_at, updated_at
) VALUES (
    '{counseling_id_new}', '{center_id}', '가족상담',
    '가족 구성원 전체 또는 일부가 참여하는 상담',
    80000, 90, '["member_id_a", "member_id_b"]', 'group',
    '2026-01-15 14:00:00', '2026-01-15 14:00:00'
);
```

#### [4단계] HTTP Response

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": "{counseling_id_new}",
  "center_id": "{center_id}",
  "name": "가족상담",
  "description": "가족 구성원 전체 또는 일부가 참여하는 상담",
  "price": 80000,
  "duration_minutes": 90,
  "counseling_type": "group",
  "counselors": [
    {"id": "{member_id_a}", "name": "상담사 A", "profile_image_url": null},
    {"id": "{member_id_b}", "name": "상담사 B", "profile_image_url": null}
  ],
  "created_at": "2026-01-15T14:00:00Z",
  "updated_at": "2026-01-15T14:00:00Z"
}
```

---

### 최종 상태

```
Counseling(id={counseling_id_new}, name="가족상담")
  - center_id = {center_id}
  - price = 80000
  - duration_minutes = 90
  - counselor_ids = ["{member_id_a}", "{member_id_b}"]
  - counseling_type = "group"
  - 케이스 생성 가능
```

---

## 시나리오 2: 개인상담 케이스 생성

### 개요
센터에서 개인상담 케이스를 생성하고, 내담자 1명과 상담사 1명을 지정하는 기본 케이스

### 액터
- 센터 관리자 / 상담사

### 전제 조건
- `Counseling(id={counseling_id}, name="개인상담")` 존재
- `Client(id={client_id}, name="김내담자")` 존재
- `CenterMember(id={member_id})` 존재 (상담사)
- center_id = {center_id}

---

### 플로우

#### [1단계] 센터: 케이스 생성 요청

**HTTP Request**:
```http
POST /centers/{center_id}/counseling-cases
Content-Type: application/json
Authorization: Bearer {token}

{
  "counseling_id": "{counseling_id}",
  "memo": "초기 면담 후 10회 상담 계획",
  "total_sessions": 10,
  "client_ids": ["{client_id}"],
  "counselor_ids": ["{member_id}"]
}
```

#### [2단계] Handler: 검증 및 생성

**Handler Logic**:
```python
async def create_counseling_case_handler(
    center_id: str,
    data: CounselingCaseCreate,
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        # 1. 상담 유형 검증
        counseling_repo = uow.repo(CounselingRepository)
        counseling = await counseling_repo.get(data.counseling_id)

        if not counseling or counseling.center_id != center_id:
            raise HTTPException(404, "상담 유형을 찾을 수 없습니다")

        # 2. 내담자 검증 (최소 1명)
        client_repo = uow.repo(ClientRepository)
        for client_id in data.client_ids:
            client = await client_repo.get(client_id)
            if not client or client.center_id != center_id:
                raise HTTPException(404, f"내담자를 찾을 수 없습니다: {client_id}")

        # 3. 상담사 검증 (최소 1명)
        member_repo = uow.repo(CenterMemberRepository)
        for member_id in data.counselor_ids:
            member = await member_repo.get(member_id)
            if not member or member.center_id != center_id:
                raise HTTPException(404, f"상담사를 찾을 수 없습니다: {member_id}")

        # 4. CounselingCase 생성
        case_repo = uow.repo(CounselingCaseRepository)
        case = await case_repo.create({
            "center_id": center_id,
            "counseling_id": data.counseling_id,
            "memo": data.memo,
            "total_sessions": data.total_sessions,
            "status": "ACTIVE"
        })

        # 5. CounselingCaseParticipant 생성 (내담자)
        participant_repo = uow.repo(CounselingCaseParticipantRepository)
        for client_id in data.client_ids:
            await participant_repo.create({
                "counseling_case_id": case.id,
                "participant_type": "client",
                "participant_id": client_id,
                "assigned_at": datetime.utcnow()
            })

        # 6. CounselingCaseParticipant 생성 (상담사)
        for member_id in data.counselor_ids:
            await participant_repo.create({
                "counseling_case_id": case.id,
                "participant_type": "counselor",
                "participant_id": member_id,
                "assigned_at": datetime.utcnow()
            })

        await uow.commit()
        return CounselingCaseResponse.model_validate(case)
```

#### [3단계] DB Changes

```sql
-- 1. CounselingCase 생성
INSERT INTO counseling_cases (
    id, center_id, counseling_id, memo, total_sessions, status, created_at, updated_at
) VALUES (
    '{case_id}', '{center_id}', '{counseling_id}',
    '초기 면담 후 10회 상담 계획', 10, 'ACTIVE',
    '2026-01-15 10:00:00', '2026-01-15 10:00:00'
);

-- 2. CounselingCaseParticipant 생성 (내담자)
INSERT INTO counseling_case_participants (
    counseling_case_id, participant_type, participant_id, assigned_at
) VALUES (
    '{case_id}', 'client', '{client_id}', '2026-01-15 10:00:00'
);

-- 3. CounselingCaseParticipant 생성 (상담사)
INSERT INTO counseling_case_participants (
    counseling_case_id, participant_type, participant_id, assigned_at
) VALUES (
    '{case_id}', 'counselor', '{member_id}', '2026-01-15 10:00:00'
);
```

#### [4단계] HTTP Response

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": "{case_id}",
  "center_id": "{center_id}",
  "counseling_id": "{counseling_id}",
  "counseling_name": "개인상담",
  "memo": "초기 면담 후 10회 상담 계획",
  "total_sessions": 10,
  "status": "ACTIVE",
  "client_count": 1,
  "counselor_count": 1,
  "session_count": 0,
  "created_at": "2026-01-15T10:00:00Z",
  "updated_at": "2026-01-15T10:00:00Z"
}
```

---

### 최종 상태

```
CounselingCase(id={case_id}, status="ACTIVE", total_sessions=10)
  ↓ counseling_id
Counseling(id={counseling_id}, name="개인상담")

CounselingCase(id={case_id})
  ↓ CounselingCaseParticipant (type=client)
Client(id={client_id}, name="김내담자")

CounselingCase(id={case_id})
  ↓ CounselingCaseParticipant (type=counselor)
CenterMember(id={member_id})
```

---

## 시나리오 3: 상담 일정 기록(Session) 생성

### 개요
기존 케이스에 새 CounselingSession(상담 일정 기록)을 추가하고, ScheduledRelation을 통해 Schedule과 연동

### 액터
- 센터 관리자 / 상담사

### 전제 조건
- `CounselingCase(id={case_id}, status="ACTIVE")` 존재
- 현재 최대 session_number = 0 (첫 방문)
- `Schedule(id={schedule_id}, schedule_type="counseling")` 존재 (일정 연동 시)

---

### 플로우

#### [1단계] 센터: Session 생성 요청

**HTTP Request**:
```http
POST /centers/{center_id}/counseling-cases/{case_id}/sessions
Content-Type: application/json
Authorization: Bearer {token}

{
  "schedule_id": "{schedule_id}"
}
```

> **Note**: `schedule_id`는 Session 테이블에 저장되지 않고, `ScheduledRelation` 중간 테이블 생성에 사용됩니다.

#### [2단계] Handler: 검증 및 생성

**Handler Logic**:
```python
async def create_session_handler(
    center_id: str,
    case_id: str,
    data: CounselingSessionCreate,
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        # 1. 케이스 검증
        case_repo = uow.repo(CounselingCaseRepository)
        case = await case_repo.get(case_id)

        if not case or case.center_id != center_id:
            raise HTTPException(404, "상담 케이스를 찾을 수 없습니다")

        # 2. 케이스 상태 검증 (ACTIVE에서만 Session 추가 가능)
        if case.status != "ACTIVE":
            raise HTTPException(400, "종결/취소된 케이스에는 상담 일정 기록을 추가할 수 없습니다")

        # 3. Schedule 검증 (선택적)
        if data.schedule_id:
            schedule_repo = uow.repo(ScheduleRepository)
            schedule = await schedule_repo.get(data.schedule_id)
            if not schedule or schedule.center_id != center_id:
                raise HTTPException(404, "일정을 찾을 수 없습니다")

        # 4. 자동 순차 번호 할당
        session_repo = uow.repo(CounselingSessionRepository)
        max_number = await session_repo.get_max_session_number(case_id)
        session_number = (max_number or 0) + 1

        # 5. CounselingSession 생성 (schedule_id FK 없음)
        session = await session_repo.create({
            "center_id": center_id,
            "counseling_case_id": case_id,
            "session_number": session_number,
            "status": "SCHEDULED"
        })

        # 6. ScheduledRelation 생성 (Schedule-Session 연결)
        if data.schedule_id:
            relation_repo = uow.repo(ScheduledRelationRepository)
            await relation_repo.create({
                "schedule_id": data.schedule_id,
                "scheduled_resource_type": "counseling",
                "scheduled_resource_id": session.id
            })

        await uow.commit()
        return CounselingSessionResponse.model_validate(session)
```

#### [3단계] DB Changes

```sql
-- 1. 현재 최대 session_number 조회
SELECT MAX(session_number) FROM counseling_sessions
WHERE counseling_case_id = '{case_id}';
-- Result: NULL (첫 방문)

-- 2. CounselingSession 생성 (schedule_id FK 없음)
INSERT INTO counseling_sessions (
    id, center_id, counseling_case_id, session_number,
    status, created_at, updated_at
) VALUES (
    '{session_id}', '{center_id}', '{case_id}',
    1, 'SCHEDULED',
    '2026-01-15 10:30:00', '2026-01-15 10:30:00'
);

-- 3. ScheduledRelation 생성 (Schedule-Session 연결)
INSERT INTO scheduled_relations (
    schedule_id, scheduled_resource_type, scheduled_resource_id
) VALUES (
    '{schedule_id}', 'counseling', '{session_id}'
);
```

#### [4단계] HTTP Response

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": "{session_id}",
  "center_id": "{center_id}",
  "counseling_case_id": "{case_id}",
  "session_number": 1,
  "status": "SCHEDULED",
  "schedule": {
    "id": "{schedule_id}",
    "start": "2026-01-20T14:00:00Z",
    "end": "2026-01-20T15:00:00Z",
    "room_name": "1상담실"
  },
  "created_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-01-15T10:30:00Z"
}
```

---

### 최종 상태

```
CounselingCase(id={case_id}, status="ACTIVE")
  ↓ has Session
CounselingSession(id={session_id}, session_number=1, status="SCHEDULED")
  ↔ ScheduledRelation(schedule_id, "counseling", session_id)
  ↔ Schedule(id={schedule_id}, start, end, room_id)
```

---

## 시나리오 4: 짝치료 케이스

### 개요
짝치료(Co-therapy) 케이스: 내담자와 상담사 수가 동일한 조합 (예: 부부상담에서 각 배우자에게 담당 상담사 배정)

### 액터
- 센터 관리자

### 전제 조건
- `Counseling(id={counseling_id}, name="부부상담")` 존재
- `Client(id={client_id_a}, name="김남편")` 존재 (내담자 A)
- `Client(id={client_id_b}, name="이아내")` 존재 (내담자 B)
- `CenterMember(id={member_id_a})` 존재 (상담사 A)
- `CenterMember(id={member_id_b})` 존재 (상담사 B)

---

### 플로우

#### [1단계] 센터: 짝치료 케이스 생성

**HTTP Request**:
```http
POST /centers/{center_id}/counseling-cases
Content-Type: application/json
Authorization: Bearer {token}

{
  "counseling_id": "{counseling_id}",
  "memo": "짝치료 방식으로 진행 (각 배우자에게 담당 상담사 배정)",
  "total_sessions": 10,
  "client_ids": ["{client_id_a}", "{client_id_b}"],
  "counselor_ids": ["{member_id_a}", "{member_id_b}"]
}
```

#### [2단계] DB Changes

```sql
-- 1. CounselingCase 생성
INSERT INTO counseling_cases (
    id, center_id, counseling_id, memo, total_sessions, status, created_at, updated_at
) VALUES (
    '{case_id_cotherapy}', '{center_id}', '{counseling_id}',
    '짝치료 방식으로 진행 (각 배우자에게 담당 상담사 배정)', 10, 'ACTIVE',
    '2026-01-15 11:00:00', '2026-01-15 11:00:00'
);

-- 2. CounselingCaseParticipant 생성 (내담자 2명)
INSERT INTO counseling_case_participants (
    counseling_case_id, participant_type, participant_id, assigned_at
) VALUES
('{case_id_cotherapy}', 'client', '{client_id_a}', '2026-01-15 11:00:00'),
('{case_id_cotherapy}', 'client', '{client_id_b}', '2026-01-15 11:00:00');

-- 3. CounselingCaseParticipant 생성 (상담사 2명 - 짝치료)
INSERT INTO counseling_case_participants (
    counseling_case_id, participant_type, participant_id, assigned_at
) VALUES
('{case_id_cotherapy}', 'counselor', '{member_id_a}', '2026-01-15 11:00:00'),
('{case_id_cotherapy}', 'counselor', '{member_id_b}', '2026-01-15 11:00:00');
```

#### [3단계] HTTP Response

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": "{case_id_cotherapy}",
  "center_id": "{center_id}",
  "counseling_id": "{counseling_id}",
  "counseling_name": "부부상담",
  "memo": "짝치료 방식으로 진행 (각 배우자에게 담당 상담사 배정)",
  "total_sessions": 10,
  "status": "ACTIVE",
  "client_count": 2,
  "counselor_count": 2,
  "session_count": 0,
  "created_at": "2026-01-15T11:00:00Z",
  "updated_at": "2026-01-15T11:00:00Z"
}
```

---

### 최종 상태

```
CounselingCase(id={case_id_cotherapy}, counseling_name="부부상담")
  ↓ CounselingCaseParticipant (type=client)
Client(id={client_id_a}, name="김남편")   # 내담자 A
Client(id={client_id_b}, name="이아내")   # 내담자 B

CounselingCase(id={case_id_cotherapy})
  ↓ CounselingCaseParticipant (type=counselor)
CenterMember(id={member_id_a}, name="상담사 A")  # 상담사 A
CenterMember(id={member_id_b}, name="상담사 B")  # 상담사 B
```

---

### 짝치료 상담 기록 관리

**각 상담사가 개별 상담 기록 작성**:
- 동일 세션에 대해 각 상담사가 개별 Document 생성
- `Document.uploader_id`로 작성자 구분
- `entity_type="counseling_session"`, `entity_id=session.id`로 연결

> **TODO**: Document 도메인 연동 시 구현

---

## 시나리오 5: 집단상담 케이스

### 개요
집단상담 케이스를 생성하고, 다수의 내담자(10명)와 1명의 상담사를 지정

### 액터
- 센터 관리자

### 전제 조건
- `Counseling(id={counseling_id_group}, name="집단상담")` 존재
- Client 10명 존재 ({client_id_g1} ~ {client_id_g10})
- `CenterMember(id={member_id_group})` 존재 (그룹 진행자)

---

### 플로우

#### [1단계] 센터: 집단상담 케이스 생성

**HTTP Request**:
```http
POST /centers/{center_id}/counseling-cases
Content-Type: application/json
Authorization: Bearer {token}

{
  "counseling_id": "{counseling_id_group}",
  "memo": "사회불안 집단치료 프로그램 (8주)",
  "total_sessions": 8,
  "client_ids": [
    "{client_id_g1}", "{client_id_g2}", "{client_id_g3}",
    "{client_id_g4}", "{client_id_g5}", "{client_id_g6}",
    "{client_id_g7}", "{client_id_g8}", "{client_id_g9}", "{client_id_g10}"
  ],
  "counselor_ids": ["{member_id_group}"]
}
```

#### [2단계] HTTP Response

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": "{case_id_group}",
  "center_id": "{center_id}",
  "counseling_id": "{counseling_id_group}",
  "counseling_name": "집단상담",
  "memo": "사회불안 집단치료 프로그램 (8주)",
  "total_sessions": 8,
  "status": "ACTIVE",
  "client_count": 10,
  "counselor_count": 1,
  "session_count": 0,
  "created_at": "2026-01-15T12:00:00Z",
  "updated_at": "2026-01-15T12:00:00Z"
}
```

---

### 최종 상태

```
CounselingCase(id={case_id_group}, counseling_name="집단상담")
  ↓ CounselingCaseParticipant (type=client)
Client(id={client_id_g1}) ... Client(id={client_id_g10})  # 10명

CounselingCase(id={case_id_group})
  ↓ CounselingCaseParticipant (type=counselor)
CenterMember(id={member_id_group})  # 1명
```

---

## 시나리오 6: 케이스 종결

### 개요
상담 목표 달성으로 케이스를 종결 (ACTIVE → COMPLETED)

### 액터
- 상담사

### 전제 조건
- `CounselingCase(id={case_id}, status="ACTIVE")` 존재
- `CounselingSession` 10개 완료

---

### 플로우

#### [1단계] 상담사: 케이스 종결 요청

**HTTP Request**:
```http
POST /centers/{center_id}/counseling-cases/{case_id}/complete
Content-Type: application/json
Authorization: Bearer {token}

{
  "summary": "10회 상담을 통해 초기 목표 달성. 내담자 증상 호전됨."
}
```

#### [2단계] Handler: 검증 및 종결

**Handler Logic**:
```python
async def complete_counseling_case_handler(
    center_id: str,
    case_id: str,
    data: CounselingCaseCompleteRequest,
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        case_repo = uow.repo(CounselingCaseRepository)
        case = await case_repo.get(case_id)

        if not case or case.center_id != center_id:
            raise HTTPException(404, "상담 케이스를 찾을 수 없습니다")

        # 상태 전이 검증
        if case.status != "ACTIVE":
            raise HTTPException(400, f"현재 상태({case.status})에서 종결할 수 없습니다")

        # 진행 중인 CounselingSession 확인 (경고만, 블로킹 아님)
        session_repo = uow.repo(CounselingSessionRepository)
        scheduled_sessions = await session_repo.count_by_status(
            case_id, status="SCHEDULED"
        )

        if scheduled_sessions > 0:
            # 경고 로그 또는 response에 포함
            pass

        # 상태 업데이트
        case.status = "COMPLETED"
        case.memo = f"{case.memo or ''}\n\n[종결 요약] {data.summary}"
        await case_repo.update(case)

        await uow.commit()
        return CounselingCaseResponse.model_validate(case)
```

#### [3단계] DB Changes

```sql
UPDATE counseling_cases
SET
    status = 'COMPLETED',
    memo = '초기 면담 후 10회 상담 계획\n\n[종결 요약] 10회 상담을 통해 초기 목표 달성. 내담자 증상 호전됨.',
    updated_at = '2026-03-15 16:00:00'
WHERE id = '{case_id}';
```

#### [4단계] HTTP Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": "{case_id}",
  "status": "COMPLETED",
  "session_count": 10,
  "updated_at": "2026-03-15T16:00:00Z"
}
```

---

### 상태 전이 다이어그램

```
┌─────────┐
│ ACTIVE  │ ← 케이스 생성 초기 상태
└────┬────┘
     │ complete()           │ cancel()
     ↓                      ↓
┌───────────┐          ┌───────────┐
│ COMPLETED │          │ CANCELLED │
└───────────┘          └───────────┘
   (최종 상태)            (최종 상태)
```

> **정책**: 종결/취소된 케이스는 재개할 수 없습니다. 동일 내담자의 상담 재개가 필요한 경우 새 케이스를 생성합니다. 내담자의 상담 이력은 Client 기준으로 CounselingCaseParticipant를 JOIN하여 조회합니다.

---

## 시나리오 7: CounselingSession 상태 전이

### 개요
CounselingSession 상태를 SCHEDULED → COMPLETED / NO_SHOW / CANCELLED로 전이

### 액터
- 상담사

### 전제 조건
- `CounselingSession(id={session_id}, status="SCHEDULED")` 존재

---

### 플로우

#### Case A: 상담 완료 (SCHEDULED → COMPLETED)

**HTTP Request**:
```http
POST /centers/{center_id}/sessions/{session_id}/complete
Content-Type: application/json
Authorization: Bearer {token}

{}
```

**DB Changes**:
```sql
UPDATE counseling_sessions
SET status = 'COMPLETED', updated_at = '2026-01-20 15:00:00'
WHERE id = '{session_id}';
```

**HTTP Response**:
```http
HTTP/1.1 200 OK

{
  "id": "{session_id}",
  "session_number": 1,
  "status": "COMPLETED",
  "updated_at": "2026-01-20T15:00:00Z"
}
```

---

#### Case B: 노쇼 (SCHEDULED → NO_SHOW)

**HTTP Request**:
```http
POST /centers/{center_id}/sessions/{session_id}/no-show
Content-Type: application/json
Authorization: Bearer {token}

{
  "note": "연락 없이 불참"
}
```

**DB Changes**:
```sql
UPDATE counseling_sessions
SET status = 'NO_SHOW', updated_at = '2026-01-20 15:00:00'
WHERE id = '{session_id}';
```

**중요**: 노쇼 시에도 session_number=1 유지 (결번 없음, 방문 순서 추적용)

---

#### Case C: 취소 (SCHEDULED → CANCELLED)

**HTTP Request**:
```http
POST /centers/{center_id}/sessions/{session_id}/cancel
Content-Type: application/json
Authorization: Bearer {token}

{
  "reason": "내담자 요청으로 취소"
}
```

**DB Changes**:
```sql
UPDATE counseling_sessions
SET status = 'CANCELLED', updated_at = '2026-01-19 10:00:00'
WHERE id = '{session_id}';
```

---

### CounselingSession 상태 전이 규칙

```
┌───────────┐
│ SCHEDULED │ ← 초기 상태
└─────┬─────┘
      │
      ├───── complete() ─────→ ┌───────────┐
      │                        │ COMPLETED │ (최종 상태)
      │                        └───────────┘
      │
      ├───── no_show() ──────→ ┌─────────┐
      │                        │ NO_SHOW │
      │                        └────┬────┘
      │                             │ complete() (사후 진행)
      │                             ↓
      │                        ┌───────────┐
      │                        │ COMPLETED │
      │                        └───────────┘
      │
      └───── cancel() ───────→ ┌───────────┐
                               │ CANCELLED │
                               └─────┬─────┘
                                     │ reschedule()
                                     ↓
                               ┌───────────┐
                               │ SCHEDULED │
                               └───────────┘
```

| 현재 상태 | 허용 전이 | 비고 |
|----------|----------|------|
| SCHEDULED | COMPLETED, NO_SHOW, CANCELLED | 예약됨 → 완료/노쇼/취소 |
| COMPLETED | - | 완료 후 변경 불가 |
| NO_SHOW | COMPLETED | 노쇼 → 사후 진행으로 완료 처리 가능 |
| CANCELLED | SCHEDULED | 취소 → 재예약 |

---

## 시나리오 8: 상담 기록 연동 (Document 도메인 위임)

### 개요
CounselingSession 완료 후 상담일지(Document)를 저장

> **핵심 원칙**: 상담일지는 CounselingSession에 저장하지 않고, **Document 도메인의 Service를 사용**하여 관리합니다.

### 액터
- 상담사

### 전제 조건
- `CounselingSession(id={session_id}, status="COMPLETED")` 존재

---

### 플로우

#### [1단계] 상담사: 상담일지 저장 API 호출

**HTTP Request**:
```http
PUT /centers/{center_id}/sessions/{session_id}/journal
Content-Type: application/json
Authorization: Bearer {token}

{
  "goal": "불안 증상 완화를 위한 인지 재구성",
  "content": "내담자의 자동적 사고 패턴 탐색...",
  "summary": "긍정적 변화 관찰됨",
  "private_memo": "다음 회기에 심호흡 기법 도입 고려"
}
```

---

#### [2단계] Handler: DocumentService 호출

```python
async def save_counseling_journal_handler(
    session_id: str,
    data: CounselingJournalCreate,
    auth: AuthContext,
):
    # Document 도메인 Service 호출
    # 각 필드를 별도 Document로 생성
    await document_service.create_text_document({
        "entity_type": "counseling_session",
        "entity_id": session_id,
        "uploader_id": auth.member_id,
        "category": "counseling_goal",  # or counseling_content, etc.
        "access_level": "center",  # private_memo는 "private"
        "content": data.goal,
    })
```

> 구체적인 Document 생성 로직은 [Document 도메인](/docs/document/domain.md) 참조

---

#### [3단계] DB Changes (Document 도메인)

```sql
-- Document 테이블에 저장 (CounselingSession 테이블 변경 없음)
INSERT INTO documents (
    id, center_id, entity_type, entity_id, uploader_id,
    category, access_level, content, created_at
) VALUES (
    '{doc_id}', '{center_id}', 'counseling_session', '{session_id}',
    '{member_id}', 'counseling_goal', 'center', '불안 증상 완화...', NOW()
);
```

---

### Document Category 값

| category | 설명 | access_level |
|----------|------|--------------|
| `counseling_goal` | 상담 목표 | center |
| `counseling_content` | 상담 내용 | center |
| `counseling_summary` | 종합 소견 | center / public |
| `counseling_private_memo` | 개인 메모 | **private** |
| `counseling_attachment` | 첨부파일 | center |

---

## 시나리오 9: 상담사 변경

### 개요
기존 상담사 퇴사로 새 상담사로 교체 (이력 보존)

### 액터
- 센터 관리자

### 전제 조건
- `CounselingCase(id={case_id})` 존재
- 기존 상담사: `CenterMember(id={member_id_old})`
- 새 상담사: `CenterMember(id={member_id_new})`

---

### 플로우

#### [1단계] 센터: 기존 상담사 제거 (unassigned_at 설정)

**HTTP Request**:
```http
DELETE /centers/{center_id}/counseling-cases/{case_id}/participants/counselor/{member_id_old}
Authorization: Bearer {token}
```

**Handler Logic**:
```python
async def remove_participant_handler(
    center_id: str,
    case_id: str,
    participant_type: str,
    participant_id: str,
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        participant_repo = uow.repo(CounselingCaseParticipantRepository)

        # 현재 참여자 수 확인
        count = await participant_repo.count_active_by_type(case_id, participant_type)

        if count <= 1:
            raise HTTPException(400, f"최소 1명의 {participant_type}가 필요합니다")

        # unassigned_at 설정 (삭제 대신 이력 보존)
        await participant_repo.unassign(case_id, participant_type, participant_id)
        await uow.commit()
```

**DB Changes**:
```sql
UPDATE counseling_case_participants
SET unassigned_at = '2026-02-01 10:00:00'
WHERE counseling_case_id = '{case_id}'
  AND participant_type = 'counselor'
  AND participant_id = '{member_id_old}';
```

**⚠️ 검증 실패**: 상담사가 1명뿐이면 unassign 불가

---

#### [2단계] 센터: 새 상담사 추가

**HTTP Request**:
```http
POST /centers/{center_id}/counseling-cases/{case_id}/participants
Content-Type: application/json
Authorization: Bearer {token}

{
  "participant_type": "counselor",
  "participant_id": "{member_id_new}"
}
```

**DB Changes**:
```sql
INSERT INTO counseling_case_participants (
    counseling_case_id, participant_type, participant_id, assigned_at
) VALUES (
    '{case_id}', 'counselor', '{member_id_new}', '2026-02-01 10:00:00'
);
```

**HTTP Response**:
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "counseling_case_id": "{case_id}",
  "participant_type": "counselor",
  "participant_id": "{member_id_new}",
  "assigned_at": "2026-02-01T10:00:00Z"
}
```

---

#### [3단계] 센터: 기존 상담사 제거 (이제 가능)

**HTTP Request**:
```http
DELETE /centers/{center_id}/counseling-cases/{case_id}/participants/counselor/{member_id_old}
Authorization: Bearer {token}
```

**DB Changes**:
```sql
UPDATE counseling_case_participants
SET unassigned_at = '2026-02-01 10:05:00'
WHERE counseling_case_id = '{case_id}'
  AND participant_type = 'counselor'
  AND participant_id = '{member_id_old}';
```

**HTTP Response**:
```http
HTTP/1.1 204 No Content
```

---

### 트랜잭션 처리 (한 번에)

```python
async def change_counselor_handler(
    case_id: str,
    old_member_id: str,
    new_member_id: str,
    uow: UnitOfWork = Depends(get_uow),
):
    """상담사 교체 (트랜잭션)"""
    async with uow:
        participant_repo = uow.repo(CounselingCaseParticipantRepository)

        # 1. 새 상담사 추가
        await participant_repo.create({
            "counseling_case_id": case_id,
            "participant_type": "counselor",
            "participant_id": new_member_id,
            "assigned_at": datetime.utcnow()
        })

        # 2. 기존 상담사 unassign (이력 보존)
        await participant_repo.unassign(case_id, "counselor", old_member_id)

        await uow.commit()
```

---

### 최종 상태 (이력 보존)

```
CounselingCase(id={case_id})
  ↓ CounselingCaseParticipant (type=counselor)
CenterMember(id={member_id_old}, assigned_at="2026-01-15", unassigned_at="2026-02-01")  # 이력
CenterMember(id={member_id_new}, assigned_at="2026-02-01", unassigned_at=NULL)  # 현재 담당
```

---

## 시나리오 10: 세션별 출석 관리

### 개요
집단상담 세션에서 참여자별 출석/불참 기록

### 액터
- 상담사

### 전제 조건
- `CounselingSession(id={session_id}, status="SCHEDULED")` 존재
- 케이스 참여자: 내담자 10명, 상담사 1명

---

### 플로우

#### [1단계] 상담사: 세션 시작 시 참여자 등록

**HTTP Request**:
```http
POST /centers/{center_id}/sessions/{session_id}/participants
Content-Type: application/json
Authorization: Bearer {token}

{
  "participants": [
    {"participant_type": "client", "participant_id": "{client_id_g1}", "status": "attended"},
    {"participant_type": "client", "participant_id": "{client_id_g2}", "status": "attended"},
    {"participant_type": "client", "participant_id": "{client_id_g3}", "status": "no_show"},
    {"participant_type": "client", "participant_id": "{client_id_g4}", "status": "excused"},
    {"participant_type": "client", "participant_id": "{client_id_g5}", "status": "late"},
    {"participant_type": "counselor", "participant_id": "{member_id_group}", "status": "attended"}
  ]
}
```

#### [2단계] Handler: 세션 참여자 생성

**Handler Logic**:
```python
async def create_session_participants_handler(
    center_id: str,
    session_id: str,
    data: SessionParticipantsCreate,
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        session_repo = uow.repo(CounselingSessionRepository)
        session = await session_repo.get(session_id)

        if not session or session.center_id != center_id:
            raise HTTPException(404, "세션을 찾을 수 없습니다")

        participant_repo = uow.repo(CounselingSessionParticipantRepository)

        for p in data.participants:
            await participant_repo.create({
                "counseling_session_id": session_id,
                "participant_type": p.participant_type,
                "participant_id": p.participant_id,
                "status": p.status,
                "assigned_at": datetime.utcnow()
            })

        await uow.commit()
        return {"message": "Participants recorded successfully"}
```

#### [3단계] DB Changes

```sql
INSERT INTO counseling_session_participants (
    counseling_session_id, participant_type, participant_id, status, assigned_at
) VALUES
('{session_id}', 'client', '{client_id_g1}', 'attended', '2026-01-20 14:00:00'),
('{session_id}', 'client', '{client_id_g2}', 'attended', '2026-01-20 14:00:00'),
('{session_id}', 'client', '{client_id_g3}', 'no_show', '2026-01-20 14:00:00'),
('{session_id}', 'client', '{client_id_g4}', 'excused', '2026-01-20 14:00:00'),
('{session_id}', 'client', '{client_id_g5}', 'late', '2026-01-20 14:00:00'),
('{session_id}', 'counselor', '{member_id_group}', 'attended', '2026-01-20 14:00:00');
```

#### [4단계] HTTP Response

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "message": "Participants recorded successfully",
  "session_id": "{session_id}",
  "attendance_summary": {
    "attended": 2,
    "no_show": 1,
    "excused": 1,
    "late": 1
  }
}
```

---

#### [5단계] 출석 상태 수정

**HTTP Request**:
```http
PATCH /centers/{center_id}/sessions/{session_id}/participants/client/{client_id_g3}
Content-Type: application/json
Authorization: Bearer {token}

{
  "status": "attended"
}
```

**DB Changes**:
```sql
UPDATE counseling_session_participants
SET status = 'attended'
WHERE counseling_session_id = '{session_id}'
  AND participant_type = 'client'
  AND participant_id = '{client_id_g3}';
```

---

### 최종 상태

```
CounselingSession(id={session_id})
  ↓ CounselingSessionParticipant
  - (client, {client_id_g1}, "attended")
  - (client, {client_id_g2}, "attended")
  - (client, {client_id_g3}, "attended")  # no_show → attended 수정됨
  - (client, {client_id_g4}, "excused")
  - (client, {client_id_g5}, "late")
  - (counselor, {member_id_group}, "attended")
```

---

### 출석 상태 값

| status | 설명 |
|--------|------|
| `attended` | 출석 |
| `no_show` | 불참 (무단) |
| `excused` | 불참 (사전 통보) |
| `late` | 지각 |

---

## 시나리오 요약

| 시나리오 | 주요 액터 | 핵심 기능 | 연관 엔티티 |
|---------|----------|----------|------------|
| 1. 상담 유형 생성 | 관리자 | 센터별 유형 정의 | Counseling |
| 2. 개인상담 케이스 | 상담사 | 기본 케이스 생성 | CounselingCase, CounselingCaseParticipant |
| 3. 상담 일정 기록 생성 | 상담사 | 자동 번호 할당, Schedule 연동 | CounselingSession, Schedule |
| 4. 짝치료 | 관리자 | N명 내담자, N명 상담사 (1:1 매칭) | CounselingCaseParticipant |
| 5. 집단상담 | 관리자 | 다수 내담자 관리 | CounselingCaseParticipant |
| 6. 케이스 종결 | 상담사 | ACTIVE → COMPLETED 전이 | CounselingCase |
| 7. CounselingSession 상태 전이 | 상담사 | 상태 전이 규칙 적용 | CounselingSession |
| 8. 상담 기록 연동 | 상담사 | Document 연결 | CounselingSession, Document |
| 9. 상담사 변경 | 관리자 | unassigned_at으로 이력 보존 | CounselingCaseParticipant |
| 10. 세션별 출석 관리 | 상담사 | 집단상담 출석 체크 | CounselingSessionParticipant |

> **참고**: CounselingSession은 상담 일정 기록(개별 방문 기록)입니다. 결제/청구 단위(회기)는 별도 Billing 도메인에서 관리합니다.

---

## 참고 문서

- **Counseling 도메인 설계**: `/docs/counseling/domain.md`
- **Counseling 의사결정 기록**: `/docs/counseling/decision-log.md`
- **Client 도메인**: `/docs/client/domain.md`
- **Document 도메인**: `/docs/document/domain.md`
- **Schedule 도메인**: `/docs/schedule/domain.md`
