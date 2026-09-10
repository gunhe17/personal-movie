# Assessment 도메인 주요 시나리오

> Assessment 도메인의 실제 사용 시나리오 및 플로우

---

## 시나리오 빠른 참조

| # | 시나리오 | 주요 흐름 | 핵심 포인트 |
|---|----------|----------|------------|
| 1 | **개별 검사 케이스 생성** | 내담자/검사전문가 지정 → 검사 선택 → 케이스 생성 | 최소 1명씩 필수, Participant 자동 생성 |
| 2 | **집단 검사 케이스 생성** | 기관명 입력 → 다수 내담자 지정 → 케이스 생성 | case_type=GROUP |
| 3 | **패키지로 케이스 생성** | 패키지 선택 → 검사 추가/제외 → 케이스 생성 | 패키지=프리셋, 검사 수정 가능 |
| 4 | **검사 세션 생성** | 케이스 선택 → Schedule 연동 → Session 생성 | ScheduledRelation 연동, **Task 자동 생성** |
| 5 | **검사 실시 (Task 진행)** | Task 시작 → 응답 제출 → 채점/완료 | process JSONB, report_payload |
| 6 | **온라인 검사 바로링크** | 링크 생성 → 발송 → 내담자 접속 → 검사 실시 | unique_token, expired_at |
| 7 | **케이스 완료 (종합보고서 생성)** | 모든 Task 완료 확인 → 종합보고서 생성 → 케이스 완료 | **종합보고서 생성 = 케이스 완료 시점** |
| 8 | ~~종합보고서 생성~~ | (시나리오 7에 통합) | - |
| 9 | **검사전문가 변경** | 기존 전문가 unassign → 새 전문가 추가 | 이력 보존 (unassigned_at) |
| 10 | **검사 패키지 관리** | 패키지 생성/수정/삭제 | assessment_ids[] 배열 |

### 주요 주의사항

| 영역 | 주의사항 |
|------|----------|
| **AssessmentCaseParticipant** | participant_type으로 client/specialist 구분, 최소 1명씩 필수 |
| **AssessmentTask** | case_id + assessment_id 복합 키, **Session 생성 시 자동 생성** |
| **상태 전이** | PENDING → PROCESSING → COMPLETED/CANCELLED 순서 준수 |
| **Schedule 연동** | ScheduledRelation 중간 테이블로 연결, Schedule 삭제 시 CASCADE |
| **Document 연동** | 종합보고서는 Document 도메인에 위임 (has_final_report 플래그로 상태 관리) |

> **용어**: 검사 도메인에서는 `counselor` 대신 `specialist` (검사전문가) 용어 사용

---

## 목차

1. [시나리오 1: 개별 검사 케이스 생성](#시나리오-1-개별-검사-케이스-생성)
2. [시나리오 2: 집단 검사 케이스 생성](#시나리오-2-집단-검사-케이스-생성)
3. [시나리오 3: 패키지로 케이스 생성](#시나리오-3-패키지로-케이스-생성)
4. [시나리오 4: 검사 세션 생성](#시나리오-4-검사-세션-생성)
5. [시나리오 5: 검사 실시 (Task 진행)](#시나리오-5-검사-실시-task-진행)
6. [시나리오 6: 온라인 검사 바로링크](#시나리오-6-온라인-검사-바로링크)
7. [시나리오 7: 케이스 완료](#시나리오-7-케이스-완료)
8. [시나리오 8: 종합보고서 생성](#시나리오-8-종합보고서-생성)
9. [시나리오 9: 검사전문가 변경](#시나리오-9-검사전문가-변경)
10. [시나리오 10: 검사 패키지 관리](#시나리오-10-검사-패키지-관리)

---

## 시나리오 1: 개별 검사 케이스 생성

### 개요
내담자 1명에 대해 여러 검사를 포함하는 개별 검사 케이스를 생성

### 액터
- 센터 관리자 / 검사전문가

### 전제 조건
- `Client(id={client_id}, name="김아동")` 존재
- `CenterMember(id={specialist_id})` 존재 (검사전문가)
- `Assessment(id={assessment_1}, code="K-CBCL")` 존재 (PUBLIC)
- `Assessment(id={assessment_2}, code="MMPI-2")` 존재 (PUBLIC)
- center_id = {center_id}

---

### 플로우

#### [1단계] 센터: 케이스 생성 요청

**HTTP Request**:
```http
POST /centers/{center_id}/assessment-cases
Content-Type: application/json
Authorization: Bearer {token}

{
  "assessment_ids": ["{assessment_1}", "{assessment_2}"],
  "case_type": "individual",
  "require_final_report": true,
  "client_ids": ["{client_id}"],
  "specialist_ids": ["{specialist_id}"]
}
```

#### [2단계] Handler: 검증 및 생성

**Handler Logic**:
```python
async def create_assessment_case_handler(
    center_id: str,
    data: AssessmentCaseCreate,
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        # 1. 검사 검증 (최소 1개)
        assessment_repo = uow.repo(AssessmentRepository)
        for assessment_id in data.assessment_ids:
            assessment = await assessment_repo.get(assessment_id)
            if not assessment:
                raise HTTPException(404, f"검사를 찾을 수 없습니다: {assessment_id}")
            # PUBLIC 또는 같은 센터의 PRIVATE 검사만 허용
            if assessment.status == "private" and assessment.center_id != center_id:
                raise HTTPException(403, f"접근 권한이 없는 검사입니다: {assessment_id}")

        # 2. 내담자 검증 (최소 1명)
        client_repo = uow.repo(ClientRepository)
        for client_id in data.client_ids:
            client = await client_repo.get(client_id)
            if not client or client.center_id != center_id:
                raise HTTPException(404, f"내담자를 찾을 수 없습니다: {client_id}")

        # 3. 검사전문가 검증 (최소 1명)
        member_repo = uow.repo(CenterMemberRepository)
        for specialist_id in data.specialist_ids:
            member = await member_repo.get(specialist_id)
            if not member or member.center_id != center_id:
                raise HTTPException(404, f"검사전문가를 찾을 수 없습니다: {specialist_id}")

        # 4. 케이스 코드 생성 (YYMMDD-NNN)
        case_code = await generate_case_code(center_id)

        # 5. AssessmentCase 생성
        case_repo = uow.repo(AssessmentCaseRepository)
        case = await case_repo.create({
            "center_id": center_id,
            "case_code": case_code,
            "assessment_ids": data.assessment_ids,
            "case_type": data.case_type,
            "require_final_report": data.require_final_report,
            "status": "pending"
        })

        # 6. AssessmentCaseParticipant 생성 (내담자)
        participant_repo = uow.repo(AssessmentCaseParticipantRepository)
        for client_id in data.client_ids:
            await participant_repo.create({
                "case_id": case.id,
                "participant_type": "client",
                "participant_id": client_id,
                "assigned_at": datetime.utcnow()
            })

        # 7. AssessmentCaseParticipant 생성 (검사전문가)
        for specialist_id in data.specialist_ids:
            await participant_repo.create({
                "case_id": case.id,
                "participant_type": "specialist",
                "participant_id": specialist_id,
                "assigned_at": datetime.utcnow()
            })

        # NOTE: Task는 Session 생성 시 자동 생성됨 (시나리오 4 참조)

        await uow.commit()
        return AssessmentCaseResponse.model_validate(case)
```

#### [3단계] DB Changes

```sql
-- 1. AssessmentCase 생성
INSERT INTO assessment_cases (
    id, center_id, case_code, assessment_ids, case_type,
    require_final_report, status, created_at, updated_at
) VALUES (
    '{case_id}', '{center_id}', '260120-001',
    ARRAY['{assessment_1}', '{assessment_2}'],
    'individual', true, 'pending',
    '2026-01-20 10:00:00', '2026-01-20 10:00:00'
);

-- 2. AssessmentCaseParticipant (내담자)
INSERT INTO assessment_case_participants (
    case_id, participant_type, participant_id, assigned_at
) VALUES (
    '{case_id}', 'client', '{client_id}', '2026-01-20 10:00:00'
);

-- 3. AssessmentCaseParticipant (검사전문가)
INSERT INTO assessment_case_participants (
    case_id, participant_type, participant_id, assigned_at
) VALUES (
    '{case_id}', 'specialist', '{specialist_id}', '2026-01-20 10:00:00'
);

-- NOTE: Task는 Session 생성 시 자동 생성됨 (시나리오 4 참조)
```

#### [4단계] HTTP Response

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": "{case_id}",
  "center_id": "{center_id}",
  "case_code": "260120-001",
  "assessment_ids": ["{assessment_1}", "{assessment_2}"],
  "case_type": "individual",
  "require_final_report": true,
  "status": "pending",
  "client_count": 1,
  "specialist_count": 1,
  "created_at": "2026-01-20T10:00:00Z",
  "updated_at": "2026-01-20T10:00:00Z"
}
```

---

### 최종 상태

```
AssessmentCase(id={case_id}, status="pending", case_type="individual")
  - case_code = "260120-001"
  - assessment_ids = [K-CBCL, MMPI-2]

  ↓ AssessmentCaseParticipant (type=client)
Client(id={client_id}, name="김아동")

  ↓ AssessmentCaseParticipant (type=specialist)
CenterMember(id={specialist_id})

  ※ Task는 Session 생성 시 자동 생성됨 (시나리오 4 참조)
```

---

## 시나리오 2: 집단 검사 케이스 생성

### 개요
학교/기관 단위 집단검사 케이스 생성 (다수 내담자, 1명 검사전문가)

### 액터
- 센터 관리자

### 전제 조건
- Client 30명 존재 ({client_id_1} ~ {client_id_30})
- `CenterMember(id={specialist_id})` 존재
- `Assessment(id={assessment_id}, code="SMARTPHONE_ADDICTION")` 존재
- center_id = {center_id}

---

### 플로우

#### [1단계] 센터: 집단 검사 케이스 생성 요청

**HTTP Request**:
```http
POST /centers/{center_id}/assessment-cases
Content-Type: application/json
Authorization: Bearer {token}

{
  "assessment_ids": ["{assessment_id}"],
  "case_type": "group",
  "organization_name": "서울초등학교 5학년 1반",
  "require_final_report": false,
  "client_ids": [
    "{client_id_1}", "{client_id_2}", "{client_id_3}",
    ...
    "{client_id_30}"
  ],
  "specialist_ids": ["{specialist_id}"]
}
```

#### [2단계] DB Changes

```sql
-- 1. AssessmentCase 생성 (GROUP)
INSERT INTO assessment_cases (
    id, center_id, case_code, assessment_ids, case_type,
    organization_name, require_final_report, status, created_at, updated_at
) VALUES (
    '{case_id_group}', '{center_id}', '260120-002',
    ARRAY['{assessment_id}'],
    'group', '서울초등학교 5학년 1반', false, 'pending',
    '2026-01-20 11:00:00', '2026-01-20 11:00:00'
);

-- 2. AssessmentCaseParticipant (내담자 30명)
INSERT INTO assessment_case_participants (
    case_id, participant_type, participant_id, assigned_at
) VALUES
('{case_id_group}', 'client', '{client_id_1}', '2026-01-20 11:00:00'),
('{case_id_group}', 'client', '{client_id_2}', '2026-01-20 11:00:00'),
...
('{case_id_group}', 'client', '{client_id_30}', '2026-01-20 11:00:00');

-- 3. AssessmentCaseParticipant (검사전문가)
INSERT INTO assessment_case_participants (
    case_id, participant_type, participant_id, assigned_at
) VALUES (
    '{case_id_group}', 'specialist', '{specialist_id}', '2026-01-20 11:00:00'
);

-- NOTE: Task는 Session 생성 시 자동 생성됨 (시나리오 4 참조)
```

#### [3단계] HTTP Response

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": "{case_id_group}",
  "center_id": "{center_id}",
  "case_code": "260120-002",
  "assessment_ids": ["{assessment_id}"],
  "case_type": "group",
  "organization_name": "서울초등학교 5학년 1반",
  "status": "pending",
  "client_count": 30,
  "specialist_count": 1,
  "created_at": "2026-01-20T11:00:00Z",
  "updated_at": "2026-01-20T11:00:00Z"
}
```

---

### 최종 상태

```
AssessmentCase(id={case_id_group}, case_type="group")
  - organization_name = "서울초등학교 5학년 1반"
  - client_count = 30

  ↓ AssessmentCaseParticipant (type=client)
Client(id={client_id_1}) ... Client(id={client_id_30})  # 30명

  ↓ AssessmentCaseParticipant (type=specialist)
CenterMember(id={specialist_id})  # 1명

  ※ Task는 Session 생성 시 자동 생성됨 (시나리오 4 참조)
```

---

## 시나리오 3: 패키지로 케이스 생성

### 개요
미리 정의된 검사 패키지를 선택하여 케이스 생성. **패키지는 프리셋 개념**으로, 패키지 선택 후 검사를 추가하거나 제외할 수 있음.

### 액터
- 센터 관리자 / 검사전문가

### 전제 조건
- `AssessmentPackage(id={package_id}, name="종합심리검사", assessment_ids=[A, B, C])` 존재
- `Client(id={client_id})` 존재
- `CenterMember(id={specialist_id})` 존재
- 추가 검사: `Assessment(id={assessment_4}, code="BGT")` 존재

---

### 플로우

#### [1단계] 패키지 정보 조회

**HTTP Request**:
```http
GET /centers/{center_id}/assessment-packages/{package_id}
Authorization: Bearer {token}
```

**HTTP Response**:
```http
HTTP/1.1 200 OK

{
  "id": "{package_id}",
  "name": "종합심리검사",
  "description": "K-CBCL, MMPI-2, HTP를 포함한 종합 검사 패키지",
  "assessment_ids": ["{assessment_1}", "{assessment_2}", "{assessment_3}"]
}
```

#### [2단계] 패키지로 케이스 생성 (검사 추가/제외 가능)

**HTTP Request**:
```http
POST /centers/{center_id}/assessment-cases
Content-Type: application/json
Authorization: Bearer {token}

{
  "package_id": "{package_id}",
  "assessment_ids": ["{assessment_1}", "{assessment_3}", "{assessment_4}"],
  "case_type": "individual",
  "require_final_report": true,
  "client_ids": ["{client_id}"],
  "specialist_ids": ["{specialist_id}"]
}
```

> **패키지 기반 검사 선택**:
> - 패키지 원본: `[A, B, C]`
> - 실제 선택: `[A, C, D]` (B 제외, D 추가)
> - 패키지는 **프리셋(초기값)** 역할만 함

#### [3단계] Handler: 패키지 처리

**Handler Logic**:
```python
async def create_assessment_case_handler(
    center_id: str,
    data: AssessmentCaseCreate,
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        package_snapshot = None

        # 패키지 사용 시 스냅샷 저장 (추후 조회용)
        if data.package_id:
            package_repo = uow.repo(AssessmentPackageRepository)
            package = await package_repo.get(data.package_id)

            if not package or package.center_id != center_id:
                raise HTTPException(404, "패키지를 찾을 수 없습니다")

            # 패키지 스냅샷 저장 (어떤 패키지 기반인지 추적)
            package_snapshot = {
                "id": package.id,
                "name": package.name
            }

        # assessment_ids는 항상 클라이언트에서 전달받음
        # (패키지 선택 후 사용자가 추가/제외한 최종 검사 목록)
        assessment_ids = data.assessment_ids

        # 검사 검증
        assessment_repo = uow.repo(AssessmentRepository)
        for assessment_id in assessment_ids:
            assessment = await assessment_repo.get(assessment_id)
            if not assessment:
                raise HTTPException(404, f"검사를 찾을 수 없습니다: {assessment_id}")

        # Case 생성 (package 스냅샷 + 최종 assessment_ids)
        case = await case_repo.create({
            "center_id": center_id,
            "case_code": await generate_case_code(center_id),
            "assessment_ids": assessment_ids,  # 사용자가 최종 선택한 검사들
            "package": package_snapshot,       # 어떤 패키지 기반인지 기록
            "case_type": data.case_type,
            "require_final_report": data.require_final_report,
            "status": "pending"
        })

        # ... (Participant 생성 동일)
        # NOTE: Task는 Session 생성 시 자동 생성됨 (시나리오 4 참조)
```

#### [4단계] DB Changes

```sql
-- 패키지 기반이지만 검사 B 제외, D 추가한 케이스
INSERT INTO assessment_cases (
    id, center_id, case_code, assessment_ids, package,
    case_type, require_final_report, status, created_at, updated_at
) VALUES (
    '{case_id}', '{center_id}', '260120-003',
    ARRAY['{assessment_1}', '{assessment_3}', '{assessment_4}'],  -- 최종 선택
    '{"id": "{package_id}", "name": "종합심리검사"}',              -- 원본 패키지 정보
    'individual', true, 'pending',
    '2026-01-20 12:00:00', '2026-01-20 12:00:00'
);
```

#### [5단계] HTTP Response

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": "{case_id}",
  "case_code": "260120-003",
  "assessment_ids": ["{assessment_1}", "{assessment_3}", "{assessment_4}"],
  "package": {
    "id": "{package_id}",
    "name": "종합심리검사"
  },
  "case_type": "individual",
  "status": "pending",
  "created_at": "2026-01-20T12:00:00Z"
}
```

---

### 패키지 개념 및 저장 이유

**패키지 = 프리셋 (초기값)**
- 자주 사용하는 검사 조합을 미리 정의
- 케이스 생성 시 검사 선택의 출발점 역할
- 패키지 선택 후 검사 추가/제외 자유롭게 가능

**package 스냅샷 저장 이유**

| 상황 | package 스냅샷 | assessment_ids | 설명 |
|------|--------------|----------------|------|
| 패키지 기반 + 수정 없음 | `{"id": "...", "name": "종합심리검사"}` | `[A, B, C]` | 패키지 그대로 사용 |
| 패키지 기반 + 수정 있음 | `{"id": "...", "name": "종합심리검사"}` | `[A, C, D]` | 패키지 기반이지만 B 제외, D 추가 |
| 패키지 삭제됨 | 동일 | 동일 | 원본 패키지 삭제되어도 정보 유지 |
| 직접 검사 선택 | `null` | `[X, Y]` | 패키지 미사용 |

> **핵심**: `package`는 "어떤 패키지에서 시작했는지" 기록용, `assessment_ids`는 "실제 수행할 검사" 목록

---

## 시나리오 4: 검사 세션 생성

### 개요
검사 케이스에 검사 실시 세션 추가 및 Schedule 연동. **Session 생성 시 해당 세션에서 수행할 Task들이 자동 생성됨.**

### 액터
- 센터 관리자 / 검사전문가

### 전제 조건
- `AssessmentCase(id={case_id}, status="pending")` 존재 (assessment_ids 포함)
- `Schedule(id={schedule_id}, schedule_type="assessment")` 존재

---

### 플로우

#### [1단계] 센터: Session 생성 요청

**HTTP Request**:
```http
POST /centers/{center_id}/assessment-cases/{case_id}/sessions
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
async def create_assessment_session_handler(
    center_id: str,
    case_id: str,
    data: AssessmentSessionCreate,
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        # 1. 케이스 검증
        case_repo = uow.repo(AssessmentCaseRepository)
        case = await case_repo.get(case_id)

        if not case or case.center_id != center_id:
            raise HTTPException(404, "검사 케이스를 찾을 수 없습니다")

        # 2. 케이스 상태 검증 (PENDING, PROCESSING에서만 Session 추가)
        if case.status not in ["pending", "processing"]:
            raise HTTPException(400, "완료/취소된 케이스에는 세션을 추가할 수 없습니다")

        # 3. Schedule 검증 (optional)
        if data.schedule_id:
            schedule_repo = uow.repo(ScheduleRepository)
            schedule = await schedule_repo.get(data.schedule_id)
            if not schedule or schedule.center_id != center_id:
                raise HTTPException(404, "일정을 찾을 수 없습니다")

        # 4. AssessmentSession 생성 (schedule_id FK 없음)
        session_repo = uow.repo(AssessmentSessionRepository)
        session = await session_repo.create({
            "center_id": center_id,
            "case_id": case_id,
            "status": "scheduled"
        })

        # 5. ScheduledRelation 생성 (Schedule-Session 연결)
        if data.schedule_id:
            relation_repo = uow.repo(ScheduledRelationRepository)
            await relation_repo.create({
                "schedule_id": data.schedule_id,
                "scheduled_resource_type": "assessment",
                "scheduled_resource_id": session.id
            })

        # 6. AssessmentTask 자동 생성 (Session 생성 시 자동 생성)
        # NOTE: Task 생성 시점은 추후 재결정 가능
        task_repo = uow.repo(AssessmentTaskRepository)
        for assessment_id in case.assessment_ids:
            await task_repo.create({
                "center_id": center_id,
                "case_id": case_id,
                "assessment_id": assessment_id,
                "status": "pending",
                "process": {}
            })

        await uow.commit()
        return AssessmentSessionResponse.model_validate(session)
```

#### [3단계] DB Changes

```sql
-- 1. AssessmentSession 생성 (schedule_id FK 없음)
INSERT INTO assessment_sessions (
    id, center_id, case_id, status, created_at, updated_at
) VALUES (
    '{session_id}', '{center_id}', '{case_id}',
    'scheduled',
    '2026-01-20 13:00:00', '2026-01-20 13:00:00'
);

-- 2. ScheduledRelation 생성 (Schedule-Session 연결)
INSERT INTO scheduled_relations (
    schedule_id, scheduled_resource_type, scheduled_resource_id
) VALUES (
    '{schedule_id}', 'assessment', '{session_id}'
);

-- 3. AssessmentTask 자동 생성 (검사 1)
-- 복합 키: case_id + assessment_id
INSERT INTO assessment_tasks (
    center_id, case_id, assessment_id, status, process, created_at, updated_at
) VALUES (
    '{center_id}', '{case_id}', '{assessment_1}', 'pending', '{}',
    '2026-01-20 13:00:00', '2026-01-20 13:00:00'
);

-- 4. AssessmentTask 자동 생성 (검사 2)
INSERT INTO assessment_tasks (
    center_id, case_id, assessment_id, status, process, created_at, updated_at
) VALUES (
    '{center_id}', '{case_id}', '{assessment_2}', 'pending', '{}',
    '2026-01-20 13:00:00', '2026-01-20 13:00:00'
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
  "status": "scheduled",
  "task_count": 2,
  "schedule": {
    "id": "{schedule_id}",
    "start": "2026-01-25T14:00:00Z",
    "end": "2026-01-25T16:00:00Z",
    "room_name": "1상담실"
  },
  "created_at": "2026-01-20T13:00:00Z",
  "updated_at": "2026-01-20T13:00:00Z"
}
```

---

### 세션 상태 전이

```
┌───────────┐
│ SCHEDULED │ ← 초기 상태
└─────┬─────┘
      │
      ├───── attend() ──────→ ┌──────────┐
      │                       │ ATTENDED │ (최종)
      │                       └──────────┘
      │
      ├───── noshow() ──────→ ┌────────┐
      │                       │ NOSHOW │
      │                       └───┬────┘
      │                           │ reschedule()
      │                           ↓
      │                       ┌───────────┐
      │                       │ SCHEDULED │
      │                       └───────────┘
      │
      └───── cancel() ──────→ ┌───────────┐
                              │ CANCELLED │
                              └─────┬─────┘
                                    │ reschedule()
                                    ↓
                              ┌───────────┐
                              │ SCHEDULED │
                              └───────────┘
```

---

### 최종 상태

```
AssessmentCase(id={case_id}, status="pending")
  - assessment_ids = [K-CBCL, MMPI-2]

  ↓ AssessmentSession (ScheduledRelation으로 Schedule 연동)
AssessmentSession(id={session_id}, status="scheduled")
  ↔ ScheduledRelation(schedule_id, "assessment", session_id)
  ↔ Schedule(id={schedule_id}, start, end, room_id)

  ↓ AssessmentTask (Session 생성 시 자동 생성)
Task(case_id + K-CBCL, status="pending")
Task(case_id + MMPI-2, status="pending")
```

---

## 시나리오 5: 검사 실시 (Task 진행)

### 개요
검사 세션 내 개별 검사 수행: 시작 → 응답 제출 → 완료

### 액터
- 검사전문가 / 내담자 (온라인 검사)

### 전제 조건
- `AssessmentCase(id={case_id}, status="pending" or "processing")` 존재
- `AssessmentSession(id={session_id}, case_id={case_id})` 존재
- `AssessmentTask(case_id={case_id}, assessment_id={assessment_id}, status="pending")` 존재
- `Assessment(id={assessment_id})` 존재 (definition 포함)

---

### 플로우

#### [1단계] Task 시작

**HTTP Request**:
```http
POST /centers/{center_id}/sessions/{session_id}/tasks/{assessment_id}/start
Authorization: Bearer {token}
```

**Handler Logic**:
```python
async def start_task_handler(
    center_id: str,
    session_id: str,
    assessment_id: str,
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        # Session 검증
        session_repo = uow.repo(AssessmentSessionRepository)
        session = await session_repo.get(session_id)

        if not session or session.center_id != center_id:
            raise HTTPException(404, "세션을 찾을 수 없습니다")

        task_repo = uow.repo(AssessmentTaskRepository)
        task = await task_repo.get(session.case_id, assessment_id)

        if not task or task.center_id != center_id:
            raise HTTPException(404, "Task를 찾을 수 없습니다")

        if task.status != "pending":
            raise HTTPException(400, f"현재 상태({task.status})에서 시작할 수 없습니다")

        # Assessment 정보로 total_items 가져오기
        assessment_repo = uow.repo(AssessmentRepository)
        assessment = await assessment_repo.get(assessment_id)
        total_items = len(assessment.definition.get("questions", []))

        # Task 상태 업데이트
        task.status = "processing"
        task.process = {
            "progress": 0,
            "current_item": 0,
            "total_items": total_items,
            "responses": []
        }

        # Session 상태 업데이트 (첫 Task 시작 시 ATTENDED로)
        if session.status == "scheduled":
            session.status = "attended"

        # Case 상태도 PROCESSING으로 (첫 Task 시작 시)
        case_repo = uow.repo(AssessmentCaseRepository)
        case = await case_repo.get(session.case_id)
        if case.status == "pending":
            case.status = "processing"

        await uow.commit()
        return TaskResponse.model_validate(task)
```

**DB Changes**:
```sql
-- Task 상태 업데이트
UPDATE assessment_tasks
SET
    status = 'processing',
    process = '{"progress": 0, "current_item": 0, "total_items": 113, "responses": []}',
    updated_at = '2026-01-25 14:00:00'
WHERE case_id = '{case_id}' AND assessment_id = '{assessment_id}';

-- Case 상태 업데이트 (첫 Task 시작 시)
UPDATE assessment_cases
SET status = 'processing', updated_at = '2026-01-25 14:00:00'
WHERE id = '{case_id}' AND status = 'pending';
```

---

#### [2단계] 응답 제출 (실시간)

**HTTP Request**:
```http
POST /centers/{center_id}/sessions/{session_id}/tasks/{assessment_id}/submit
Content-Type: application/json
Authorization: Bearer {token}

{
  "responses": [
    { "item_number": 1, "value": 2 },
    { "item_number": 2, "value": 1 },
    { "item_number": 3, "value": 0 }
  ]
}
```

**Handler Logic**:
```python
async def submit_responses_handler(
    center_id: str,
    session_id: str,
    assessment_id: str,
    data: ResponseSubmit,
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        # Session 검증
        session_repo = uow.repo(AssessmentSessionRepository)
        session = await session_repo.get(session_id)

        if not session or session.center_id != center_id:
            raise HTTPException(404, "세션을 찾을 수 없습니다")

        task_repo = uow.repo(AssessmentTaskRepository)
        task = await task_repo.get(session.case_id, assessment_id)

        if task.status != "processing":
            raise HTTPException(400, "진행 중인 검사만 응답을 제출할 수 있습니다")

        # 기존 응답에 추가
        current_responses = task.process.get("responses", [])

        for response in data.responses:
            # 기존 응답 업데이트 또는 새 응답 추가
            existing = next(
                (r for r in current_responses if r["item_number"] == response.item_number),
                None
            )
            if existing:
                existing["value"] = response.value
                existing["answered_at"] = datetime.utcnow().isoformat()
            else:
                current_responses.append({
                    "item_number": response.item_number,
                    "value": response.value,
                    "answered_at": datetime.utcnow().isoformat()
                })

        # 진행률 계산
        total_items = task.process["total_items"]
        answered_count = len(current_responses)
        progress = int((answered_count / total_items) * 100)

        task.process = {
            **task.process,
            "progress": progress,
            "current_item": max(r["item_number"] for r in current_responses),
            "responses": current_responses
        }

        await uow.commit()
        return {"progress": progress, "answered_count": answered_count}
```

**DB Changes**:
```sql
UPDATE assessment_tasks
SET
    process = '{
        "progress": 50,
        "current_item": 57,
        "total_items": 113,
        "responses": [
            {"item_number": 1, "value": 2, "answered_at": "2026-01-25T14:05:00Z"},
            {"item_number": 2, "value": 1, "answered_at": "2026-01-25T14:05:15Z"},
            ...
        ]
    }',
    updated_at = '2026-01-25 14:30:00'
WHERE case_id = '{case_id}' AND assessment_id = '{assessment_id}';
```

---

#### [3단계] 검사 완료 및 채점

**HTTP Request**:
```http
POST /centers/{center_id}/sessions/{session_id}/tasks/{assessment_id}/complete
Authorization: Bearer {token}
```

**Handler Logic**:
```python
async def complete_task_handler(
    center_id: str,
    session_id: str,
    assessment_id: str,
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        # Session 검증
        session_repo = uow.repo(AssessmentSessionRepository)
        session = await session_repo.get(session_id)

        if not session or session.center_id != center_id:
            raise HTTPException(404, "세션을 찾을 수 없습니다")

        task_repo = uow.repo(AssessmentTaskRepository)
        task = await task_repo.get(session.case_id, assessment_id)

        if task.status != "processing":
            raise HTTPException(400, "진행 중인 검사만 완료할 수 있습니다")

        # 모든 문항 응답 확인 (옵션)
        responses = task.process.get("responses", [])
        total_items = task.process.get("total_items", 0)

        if len(responses) < total_items:
            # 미완료 문항 있음 - 경고 또는 거부
            pass

        # 채점 수행
        assessment_repo = uow.repo(AssessmentRepository)
        assessment = await assessment_repo.get(assessment_id)

        scoring_service = ScoringService()
        report_payload = scoring_service.calculate(
            definition=assessment.definition,
            responses=responses
        )

        # Task 완료 처리
        task.status = "completed"
        task.report_payload = report_payload
        task.completed_at = datetime.utcnow()

        await uow.commit()
        return TaskResponse.model_validate(task)
```

**채점 로직 예시** (Assessment.definition.scoring 기반):
```python
class ScoringService:
    def calculate(self, definition: dict, responses: list) -> dict:
        scoring = definition.get("scoring", {})
        interpretation = definition.get("interpretation", {})

        # 응답을 item_number: value 맵으로 변환
        response_map = {r["item_number"]: r["value"] for r in responses}

        subscale_scores = {}

        for subscale_name, subscale_def in scoring.get("subscales", {}).items():
            items = subscale_def["items"]
            reverse_items = subscale_def.get("reverse_items", [])

            score = 0
            for item_num in items:
                value = response_map.get(item_num, 0)
                if item_num in reverse_items:
                    # 역채점
                    max_value = 2  # likert_3 기준
                    value = max_value - value
                score += value

            # 해석 찾기
            level = self._get_level(interpretation.get(subscale_name, []), score)

            subscale_scores[subscale_name] = {
                "score": score,
                "level": level
            }

        # 총점 계산
        total_score = sum(s["score"] for s in subscale_scores.values())

        return {
            "total_score": total_score,
            "subscales": subscale_scores,
            "interpretation": self._generate_interpretation(subscale_scores)
        }
```

**DB Changes**:
```sql
UPDATE assessment_tasks
SET
    status = 'completed',
    report_payload = '{
        "total_score": 85,
        "subscales": {
            "ANXIETY_DEPRESSED": {"score": 12, "level": "NORMAL"},
            "SOCIAL_PROBLEMS": {"score": 8, "level": "NORMAL"}
        },
        "interpretation": "전체적으로 정상 범위에 해당합니다."
    }',
    completed_at = '2026-01-25 15:00:00',
    updated_at = '2026-01-25 15:00:00'
WHERE case_id = '{case_id}' AND assessment_id = '{assessment_id}';
```

**HTTP Response**:
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "case_id": "{case_id}",
  "assessment_id": "{assessment_id}",
  "status": "completed",
  "report_payload": {
    "total_score": 85,
    "subscales": {
      "ANXIETY_DEPRESSED": {"score": 12, "level": "NORMAL"},
      "SOCIAL_PROBLEMS": {"score": 8, "level": "NORMAL"}
    },
    "interpretation": "전체적으로 정상 범위에 해당합니다."
  },
  "completed_at": "2026-01-25T15:00:00Z"
}
```

---

### Task 상태 전이 다이어그램

```
┌─────────┐
│ PENDING │ ← Task 생성 초기 상태
└────┬────┘
     │ start()
     ↓
┌────────────┐
│ PROCESSING │
└─────┬──────┘
      │
      ├── complete() ────→ ┌───────────┐
      │                    │ COMPLETED │ (최종)
      │                    └───────────┘
      │
      ├── hold() ────────→ ┌──────┐
      │                    │ HOLD │ (보류)
      │                    └──┬───┘
      │                       │ resume()
      │                       ↓
      │                    ┌────────────┐
      │                    │ PROCESSING │
      │                    └────────────┘
      │
      ├── refuse() ──────→ ┌─────────┐
      │                    │ REFUSED │ (거부, 최종)
      │                    └─────────┘
      │
      └── cancel() ──────→ ┌───────────┐
                           │ CANCELLED │
                           └─────┬─────┘
                                 │ reactivate()
                                 ↓
                           ┌─────────┐
                           │ PENDING │
                           └─────────┘
```

> **상태 설명**: domain_v3.md의 TaskStatus 참조
> - `pending`: 대기 (진행전)
> - `processing`: 진행중
> - `completed`: 완료 (검사완료)
> - `hold`: 보류 (검사보류)
> - `refused`: 거부 (검사거부, 내담자 거부)
> - `cancelled`: 취소 (검사취소)

---

## 시나리오 6: 온라인 검사 바로링크

### 개요
내담자/보호자에게 온라인 검사 링크 발송 및 검사 실시

### 액터
- 센터 관리자 / 내담자(보호자)

### 전제 조건
- `AssessmentCase(id={case_id})` 존재
- 검사 중 `is_online_available=true`인 검사 포함

---

### 플로우

#### [1단계] 바로링크 생성

**HTTP Request**:
```http
POST /centers/{center_id}/assessment-cases/{case_id}/send-link
Content-Type: application/json
Authorization: Bearer {token}

{
  "recipients": [
    { "name": "김보호자", "phone": "010-1234-5678", "relation": "부" },
    { "name": "이보호자", "phone": "010-8765-4321", "relation": "모" }
  ],
  "expire_days": 7
}
```

**Handler Logic**:
```python
async def create_send_link_handler(
    center_id: str,
    case_id: str,
    data: SendLinkCreate,
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        # 케이스 검증
        case_repo = uow.repo(AssessmentCaseRepository)
        case = await case_repo.get(case_id)

        if not case or case.center_id != center_id:
            raise HTTPException(404, "케이스를 찾을 수 없습니다")

        # 온라인 가능 검사 확인
        assessment_repo = uow.repo(AssessmentRepository)
        for assessment_id in case.assessment_ids:
            assessment = await assessment_repo.get(assessment_id)
            if not assessment.is_online_available:
                raise HTTPException(400, f"온라인 검사가 불가능합니다: {assessment.code}")

        # 토큰 생성
        unique_token = secrets.token_urlsafe(32)
        expired_at = datetime.utcnow() + timedelta(days=data.expire_days)

        # SendLink 생성
        sendlink_repo = uow.repo(AssessmentSendLinkRepository)
        sendlink = await sendlink_repo.create({
            "center_id": center_id,
            "case_id": case_id,
            "unique_token": unique_token,
            "recipients": data.recipients,
            "expired_at": expired_at
        })

        await uow.commit()

        return {
            "id": sendlink.id,
            "link": f"https://assess.imomtae.com/take/{unique_token}",
            "expired_at": expired_at.isoformat()
        }
```

**DB Changes**:
```sql
INSERT INTO assessment_send_links (
    id, center_id, case_id, unique_token, recipients, expired_at, created_at, updated_at
) VALUES (
    '{sendlink_id}', '{center_id}', '{case_id}',
    'abc123xyz789...',
    '[{"name": "김보호자", "phone": "010-1234-5678", "relation": "부"}, ...]',
    '2026-02-01 10:00:00',
    '2026-01-25 10:00:00', '2026-01-25 10:00:00'
);
```

**HTTP Response**:
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": "{sendlink_id}",
  "link": "https://assess.imomtae.com/take/abc123xyz789...",
  "expired_at": "2026-02-01T10:00:00Z"
}
```

---

#### [2단계] 링크 발송 (외부 서비스)

센터에서 생성된 링크를 SMS/이메일로 발송

---

#### [3단계] 내담자 접속 (Public API)

**HTTP Request**:
```http
GET /assessment/take/{token}
```

**Handler Logic**:
```python
async def get_assessment_by_token(
    token: str,
    session: AsyncSession = Depends(get_session),
):
    # 토큰 검증
    sendlink_repo = SendLinkRepository(session)
    sendlink = await sendlink_repo.get_by_token(token)

    if not sendlink:
        raise HTTPException(404, "유효하지 않은 링크입니다")

    # 만료 확인
    if sendlink.expired_at and sendlink.expired_at < datetime.utcnow():
        raise HTTPException(400, "만료된 링크입니다")

    # Case 정보 조회
    case_repo = AssessmentCaseRepository(session)
    case = await case_repo.get(sendlink.case_id)

    # 검사 정보 조회 (온라인 검사만)
    assessment_repo = AssessmentRepository(session)
    assessments = []
    for assessment_id in case.assessment_ids:
        assessment = await assessment_repo.get(assessment_id)
        if assessment.is_online_available:
            assessments.append({
                "id": assessment.id,
                "code": assessment.code,
                "kor_name": assessment.kor_name,
                "estimated_duration_minutes": assessment.estimated_duration_minutes,
                "definition": assessment.definition  # 문항 포함
            })

    return {
        "case_id": case.id,
        "assessments": assessments
    }
```

**HTTP Response**:
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "case_id": "{case_id}",
  "assessments": [
    {
      "id": "{assessment_id}",
      "code": "K-CBCL",
      "kor_name": "한국판 아동행동체크리스트",
      "estimated_duration_minutes": 30,
      "definition": {
        "questions": [...],
        ...
      }
    }
  ]
}
```

---

#### [4단계] 검사 실시 (시나리오 5와 동일)

```
1. 검사 시작: POST /assessment/take/{token}/tasks/{assessment_id}/start
2. 응답 제출: POST /assessment/take/{token}/tasks/{assessment_id}/submit
3. 검사 완료: POST /assessment/take/{token}/tasks/{assessment_id}/complete
```

---

## 시나리오 7: 케이스 완료 (종합보고서 생성)

### 개요
모든 검사 Task가 완료된 후 **종합보고서를 생성하면서 케이스를 완료** 처리. 종합보고서 생성이 케이스 완료의 트리거가 됨.

> **핵심**: 종합보고서 생성 = 케이스 완료 시점

### 액터
- 검사전문가

### 전제 조건
- `AssessmentCase(id={case_id}, status="processing")` 존재
- 모든 `AssessmentTask.status = "completed"` (모든 검사 수행 완료)
- 모든 Task의 `report_payload` 존재

---

### 플로우

#### [1단계] 종합보고서 생성 및 케이스 완료 요청

**HTTP Request**:
```http
POST /centers/{center_id}/assessment-cases/{case_id}/complete
Content-Type: application/json
Authorization: Bearer {token}

{
  "additional_notes": "검사 결과 종합 소견...",
  "recommendations": [
    "정기적인 상담 권장",
    "부모 교육 프로그램 참여 권장"
  ]
}
```

#### [2단계] Handler: 검증 → 종합보고서 생성 → 케이스 완료

**Handler Logic**:
```python
async def complete_case_handler(
    center_id: str,
    case_id: str,
    data: CaseCompleteRequest,
    auth: AuthContext = Depends(get_auth),
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        case_repo = uow.repo(AssessmentCaseRepository)
        case = await case_repo.get(case_id)

        if not case or case.center_id != center_id:
            raise HTTPException(404, "케이스를 찾을 수 없습니다")

        if case.status != "processing":
            raise HTTPException(400, f"현재 상태({case.status})에서 완료할 수 없습니다")

        if case.has_final_report:
            raise HTTPException(400, "이미 완료된 케이스입니다")

        # 1. 모든 Task 완료 확인
        task_repo = uow.repo(AssessmentTaskRepository)
        tasks = await task_repo.list_by_case(case_id)

        incomplete_tasks = [t for t in tasks if t.status != "completed"]
        if incomplete_tasks:
            incomplete_names = [t.assessment_id for t in incomplete_tasks]
            raise HTTPException(
                400,
                f"완료되지 않은 검사가 있습니다: {incomplete_names}"
            )

        # 2. 모든 Task 결과 수집
        task_results = []
        assessment_repo = uow.repo(AssessmentRepository)
        for task in tasks:
            assessment = await assessment_repo.get(task.assessment_id)
            task_results.append({
                "assessment_code": assessment.code,
                "assessment_name": assessment.kor_name,
                "report_payload": task.report_payload
            })

        # 3. 종합보고서 생성 (Document 도메인 연동)
        document_service = DocumentService(uow)
        document = await document_service.create({
            "center_id": center_id,
            "entity_type": "assessment_case",
            "entity_id": case_id,
            "uploader_id": auth.member_id,
            "category": "final_report",
            "title": f"종합심리검사 보고서 - {case.case_code}",
            "content": {
                "case_code": case.case_code,
                "task_results": task_results,
                "additional_notes": data.additional_notes,
                "recommendations": data.recommendations,
                "generated_at": datetime.utcnow().isoformat()
            }
        })

        # 4. 케이스 완료 처리 (종합보고서 플래그 업데이트)
        case.status = "completed"
        case.completed_at = datetime.utcnow()
        case.has_final_report = True

        # 5. 세션 상태도 ATTENDED로 (아직 SCHEDULED인 경우)
        session_repo = uow.repo(AssessmentSessionRepository)
        sessions = await session_repo.list_by_case(case_id)
        for session in sessions:
            if session.status == "scheduled":
                session.status = "attended"

        await uow.commit()
        return CaseCompleteResponse(
            case_id=case.id,
            status="completed",
            completed_at=case.completed_at,
            document_id=document.id
        )
```

#### [3단계] DB Changes

```sql
-- 1. Document 생성 (종합보고서)
INSERT INTO documents (
    id, center_id, entity_type, entity_id, uploader_id,
    category, title, content, created_at, updated_at
) VALUES (
    '{document_id}', '{center_id}', 'assessment_case', '{case_id}',
    '{member_id}', 'final_report', '종합심리검사 보고서 - 260120-001',
    '{"case_code": "260120-001", "task_results": [...], "additional_notes": "...", "recommendations": [...]}',
    '2026-01-25 16:00:00', '2026-01-25 16:00:00'
);

-- 2. Case 완료 처리 + 종합보고서 플래그 업데이트
UPDATE assessment_cases
SET
    status = 'completed',
    completed_at = '2026-01-25 16:00:00',
    has_final_report = true,
    updated_at = '2026-01-25 16:00:00'
WHERE id = '{case_id}';

-- 3. Session 상태 업데이트
UPDATE assessment_sessions
SET status = 'attended', updated_at = '2026-01-25 16:00:00'
WHERE case_id = '{case_id}' AND status = 'scheduled';
```

#### [4단계] HTTP Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "case_id": "{case_id}",
  "status": "completed",
  "completed_at": "2026-01-25T16:00:00Z",
  "document_id": "{document_id}",
  "document_title": "종합심리검사 보고서 - 260120-001"
}
```

---

### 케이스 상태 전이 다이어그램

```
┌─────────┐
│ PENDING │ ← 케이스 생성 초기 상태
└────┬────┘
     │ 첫 Task 시작 (자동)
     ↓
┌────────────┐
│ PROCESSING │
└─────┬──────┘
      │
      ├── complete() ────────→ ┌───────────┐
      │   (종합보고서 생성)    │ COMPLETED │ (최종)
      │                        └───────────┘
      │
      └── cancel() ──────────→ ┌───────────┐
                               │ CANCELLED │
                               └─────┬─────┘
                                     │ reopen() (선택적)
                                     ↓
                               ┌─────────┐
                               │ PENDING │
                               └─────────┘
```

> **중요**: `complete()` 호출 시 종합보고서가 생성되고, 케이스가 완료됨. 둘은 동시에 발생하는 단일 트랜잭션.

---

### 최종 상태

```
AssessmentCase(id={case_id}, status="completed")
  - completed_at = "2026-01-25T16:00:00Z"
  - has_final_report = true

  ↓ Document 역방향 조회 (종합보고서)
Document(id={document_id}, category="final_report")
  - entity_type = "assessment_case"
  - entity_id = {case_id}
  - content = { task_results, additional_notes, recommendations }

  ↓ AssessmentTask (모두 completed)
Task(case_id + K-CBCL, status="completed", report_payload={...})
Task(case_id + MMPI-2, status="completed", report_payload={...})
```

---

### require_final_report 플래그 처리

| require_final_report | 케이스 완료 시 동작 |
|---------------------|-------------------|
| `true` | 종합보고서 필수 생성 후 완료 |
| `false` | 종합보고서 없이 완료 가능 (additional_notes, recommendations 생략) |

```python
# require_final_report=false인 경우
if not case.require_final_report:
    # 종합보고서 없이 케이스만 완료
    case.status = "completed"
    case.completed_at = datetime.utcnow()
    # has_final_report는 false로 유지
else:
    # 종합보고서 필수
    if not data.additional_notes:
        raise HTTPException(400, "종합 소견이 필요합니다")
    # ... 종합보고서 생성 로직
    case.has_final_report = True  # 종합보고서 등록 플래그
```

---

## 시나리오 9: 검사전문가 변경

### 개요
담당 검사전문가 교체 (이력 보존)

### 액터
- 센터 관리자

### 전제 조건
- `AssessmentCase(id={case_id})` 존재
- 기존 검사전문가: `CenterMember(id={specialist_old})`
- 새 검사전문가: `CenterMember(id={specialist_new})`

---

### 플로우

#### [1단계] 새 검사전문가 추가

**HTTP Request**:
```http
POST /centers/{center_id}/assessment-cases/{case_id}/participants
Content-Type: application/json
Authorization: Bearer {token}

{
  "participant_type": "specialist",
  "participant_id": "{specialist_new}"
}
```

**DB Changes**:
```sql
INSERT INTO assessment_case_participants (
    case_id, participant_type, participant_id, assigned_at
) VALUES (
    '{case_id}', 'specialist', '{specialist_new}', '2026-02-01 10:00:00'
);
```

---

#### [2단계] 기존 검사전문가 제거 (unassign)

**HTTP Request**:
```http
DELETE /centers/{center_id}/assessment-cases/{case_id}/participants/specialist/{specialist_old}
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
        participant_repo = uow.repo(AssessmentCaseParticipantRepository)

        # 남은 참여자 수 확인
        count = await participant_repo.count_active_by_type(case_id, participant_type)

        if count <= 1:
            raise HTTPException(400, f"최소 1명의 {participant_type}가 필요합니다")

        # unassigned_at 설정 (삭제 대신 이력 보존)
        await participant_repo.unassign(case_id, participant_type, participant_id)
        await uow.commit()
```

**DB Changes**:
```sql
UPDATE assessment_case_participants
SET unassigned_at = '2026-02-01 10:05:00'
WHERE case_id = '{case_id}'
  AND participant_type = 'specialist'
  AND participant_id = '{specialist_old}';
```

**HTTP Response**:
```http
HTTP/1.1 204 No Content
```

---

### 트랜잭션 처리 (한 번에)

```python
async def change_specialist_handler(
    case_id: str,
    old_specialist_id: str,
    new_specialist_id: str,
    uow: UnitOfWork = Depends(get_uow),
):
    """검사전문가 교체 (트랜잭션)"""
    async with uow:
        participant_repo = uow.repo(AssessmentCaseParticipantRepository)

        # 1. 새 검사전문가 추가
        await participant_repo.create({
            "case_id": case_id,
            "participant_type": "specialist",
            "participant_id": new_specialist_id,
            "assigned_at": datetime.utcnow()
        })

        # 2. 기존 검사전문가 unassign (이력 보존)
        await participant_repo.unassign(case_id, "specialist", old_specialist_id)

        await uow.commit()
```

---

### 최종 상태 (이력 보존)

```
AssessmentCase(id={case_id})
  ↓ AssessmentCaseParticipant (type=specialist)
CenterMember(id={specialist_old}, assigned_at="2026-01-20", unassigned_at="2026-02-01")  # 이력
CenterMember(id={specialist_new}, assigned_at="2026-02-01", unassigned_at=NULL)  # 현재 담당
```

---

## 시나리오 10: 검사 패키지 관리

### 개요
자주 사용하는 검사 조합을 패키지로 관리

### 액터
- 센터 관리자

---

### 플로우

#### [A] 패키지 생성

**HTTP Request**:
```http
POST /centers/{center_id}/assessment-packages
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "종합심리검사",
  "description": "K-CBCL, MMPI-2, HTP를 포함한 종합 검사 패키지",
  "assessment_ids": ["{assessment_1}", "{assessment_2}", "{assessment_3}"]
}
```

**Handler Logic**:
```python
async def create_package_handler(
    center_id: str,
    data: PackageCreate,
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        # 검사 검증
        assessment_repo = uow.repo(AssessmentRepository)
        for assessment_id in data.assessment_ids:
            assessment = await assessment_repo.get(assessment_id)
            if not assessment:
                raise HTTPException(404, f"검사를 찾을 수 없습니다: {assessment_id}")

        # 패키지 생성
        package_repo = uow.repo(AssessmentPackageRepository)
        package = await package_repo.create({
            "center_id": center_id,
            "name": data.name,
            "description": data.description,
            "assessment_ids": data.assessment_ids
        })

        await uow.commit()
        return PackageResponse.model_validate(package)
```

**DB Changes**:
```sql
INSERT INTO assessment_packages (
    id, center_id, name, description, assessment_ids, created_at, updated_at
) VALUES (
    '{package_id}', '{center_id}', '종합심리검사',
    'K-CBCL, MMPI-2, HTP를 포함한 종합 검사 패키지',
    ARRAY['{assessment_1}', '{assessment_2}', '{assessment_3}'],
    '2026-01-20 09:00:00', '2026-01-20 09:00:00'
);
```

---

#### [B] 패키지 수정

**HTTP Request**:
```http
PATCH /centers/{center_id}/assessment-packages/{package_id}
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "종합심리검사 Plus",
  "assessment_ids": ["{assessment_1}", "{assessment_2}", "{assessment_3}", "{assessment_4}"]
}
```

**DB Changes**:
```sql
UPDATE assessment_packages
SET
    name = '종합심리검사 Plus',
    assessment_ids = ARRAY['{assessment_1}', '{assessment_2}', '{assessment_3}', '{assessment_4}'],
    updated_at = '2026-01-25 10:00:00'
WHERE id = '{package_id}' AND center_id = '{center_id}';
```

---

#### [C] 패키지 삭제 (Soft Delete)

**HTTP Request**:
```http
DELETE /centers/{center_id}/assessment-packages/{package_id}
Authorization: Bearer {token}
```

**DB Changes**:
```sql
UPDATE assessment_packages
SET deleted_at = '2026-02-01 10:00:00', updated_at = '2026-02-01 10:00:00'
WHERE id = '{package_id}' AND center_id = '{center_id}';
```

**HTTP Response**:
```http
HTTP/1.1 204 No Content
```

---

### 패키지 목록 조회

**HTTP Request**:
```http
GET /centers/{center_id}/assessment-packages
Authorization: Bearer {token}
```

**HTTP Response**:
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "items": [
    {
      "id": "{package_id}",
      "name": "종합심리검사",
      "description": "K-CBCL, MMPI-2, HTP를 포함한 종합 검사 패키지",
      "assessment_count": 3,
      "created_at": "2026-01-20T09:00:00Z"
    },
    {
      "id": "{package_id_2}",
      "name": "학습검사 패키지",
      "description": "지능검사 + 학습진단검사",
      "assessment_count": 2,
      "created_at": "2026-01-15T09:00:00Z"
    }
  ],
  "total": 2
}
```

---

## 시나리오 요약

| 시나리오 | 주요 액터 | 핵심 기능 | 연관 엔티티 |
|---------|----------|----------|------------|
| 1. 개별 검사 케이스 생성 | 검사전문가 | 케이스 + Participant 생성 | AssessmentCase, AssessmentCaseParticipant |
| 2. 집단 검사 케이스 생성 | 관리자 | case_type=GROUP, 다수 내담자 | AssessmentCase, AssessmentCaseParticipant |
| 3. 패키지로 케이스 생성 | 검사전문가 | 패키지=프리셋, 검사 추가/제외 가능 | AssessmentCase, AssessmentPackage |
| 4. 검사 세션 생성 | 검사전문가 | Schedule 연동, **Task 자동 생성** | AssessmentSession, AssessmentTask, Schedule |
| 5. 검사 실시 (Task) | 검사전문가/내담자 | 시작→응답→채점→완료 | AssessmentTask |
| 6. 온라인 바로링크 | 관리자/내담자 | 토큰 기반 접속 | AssessmentSendLink |
| 7. 케이스 완료 | 검사전문가 | **종합보고서 생성 = 케이스 완료** | AssessmentCase, AssessmentTask, Document |
| 8. ~~종합보고서 생성~~ | - | (시나리오 7에 통합) | - |
| 9. 검사전문가 변경 | 관리자 | unassigned_at 이력 보존 | AssessmentCaseParticipant |
| 10. 패키지 관리 | 관리자 | CRUD + Soft Delete | AssessmentPackage |

---

## 참고 문서

- **Assessment 도메인 설계**: `/docs/assessment/domain_v3.md`
- **Counseling 시나리오**: `/docs/counseling/scenarios.md`
- **Client 도메인**: `/docs/client/domain.md`
- **Document 도메인**: `/docs/document/domain.md`
- **Schedule 도메인**: `/docs/schedule/domain.md`

---

**작성일**: 2026-01-20
**버전**: 1.1
**기반 문서**: Assessment 도메인 v3
**변경 이력**:
- v1.1: Task 복합 키 수정 (case_id + assessment_id), session_id 제거, Task 상태 다이어그램 업데이트, has_final_report 플래그 적용
