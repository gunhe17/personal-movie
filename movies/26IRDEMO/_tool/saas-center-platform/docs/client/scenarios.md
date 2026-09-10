# Client 도메인 주요 시나리오 (Client.role 기반)

> Client.role 기반 설계의 실제 사용 시나리오 및 플로우

---

## 📋 시나리오 빠른 참조

| # | 시나리오 | 주요 흐름 | 핵심 포인트 |
|---|----------|----------|------------|
| 1 | **첫째 아동 등록** | 엄마 Client 생성 (role=guardian) → 첫째 Client 생성 → 관계 연결 | 주 보호자 1명만, phone 저장 |
| 2 | **둘째 순차 등록 (Client 재사용)** | phone 검색 (role=guardian) → 엄마 Client 재사용 → 둘째 Client 생성 | 전화번호 + role 기반 재사용 |
| 3 | **배치 등록 (형제 동시)** | Client 생성 (role=guardian) → 형제 Client 생성 → 관계 연결 + 형제 관계 | ClientRelation + SiblingRelation |
| 4 | **보호자 role 전환** | role="guardian" → "both" (상담 필요 시) | role 업데이트, 90/10 원칙 |
| 5 | **Person 연동** | Person 회원가입 → ClientLinkRequest → 승인 | 전화번호 매칭, 수동 승인 |
| 6 | **Client 삭제** | 소프트 삭제 (deleted_at) | CASCADE 삭제, 이력 보존 |
| 7 | **상태 전이** | active ↔ inactive ↔ archived | ALLOWED_TRANSITIONS 규칙 |

### ⚠️ Client.role 설계 주의사항

| 영역 | 주의사항 |
|------|----------|
| **Client.role** | "client", "guardian", "both" 세 가지 값, person_id nullable |
| **ClientRelation** | is_primary 1개만, 양방향 생성 (parent↔child), 센터 간 금지 |
| **SiblingRelation** | 양방향 자동 생성, relation_detail 자동 추론 |
| **Phone 재사용** | role="guardian" 필터로 보호자 검색, 전화번호 기반 재사용 |

---

## 목차

1. [시나리오 1: 첫째 아동 등록](#시나리오-1-첫째-아동-등록)
2. [시나리오 2: 둘째 순차 등록 (Client 재사용)](#시나리오-2-둘째-순차-등록-client-재사용)
3. [시나리오 3: 배치 등록 (형제 동시)](#시나리오-3-배치-등록-형제-동시)
4. [시나리오 4: 보호자 role 전환](#시나리오-4-보호자-role-전환)
5. [시나리오 5: Person 연동](#시나리오-5-person-연동)
6. [시나리오 6: Client 삭제](#시나리오-6-client-삭제)
7. [시나리오 7: 상태 전이](#시나리오-7-상태-전이)

---

## 시나리오 1: 첫째 아동 등록

### 개요
센터에서 첫째 아동을 등록하고, 엄마를 보호자로 설정

### 액터
- 센터 관리자

### 전제 조건
- center_id = 1

---

### 플로우

#### [1단계] 센터: 엄마 Client 생성 (role="guardian")

**요청**:
```http
POST /centers/1/clients
Content-Type: application/json

{
  "name": "김엄마",
  "role": "guardian",
  "phone": "010-1111-1111",
  "address": "서울시 강남구",
  "memo": "주 보호자"
}
```

**응답**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "center_id": 1,
  "role": "guardian",
  "name": "김엄마",
  "phone": "010-1111-1111",
  "address": "서울시 강남구",
  "person_id": null,
  "status": "active",
  "memo": "주 보호자",
  "created_at": "2026-01-15T10:00:00Z"
}
```

**결과**: `Client(id=550e..., role="guardian", person_id=NULL)`

---

#### [2단계] 센터: 첫째 Client 생성 (role="client")

**요청**:
```http
POST /centers/1/clients
Content-Type: application/json

{
  "name": "김첫째",
  "role": "client",
  "birth_date": "2015-03-15",
  "gender": "female",
  "memo": "놀이치료 필요"
}
```

**응답**:
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "center_id": 1,
  "role": "client",
  "person_id": null,
  "name": "김첫째",
  "birth_date": "2015-03-15",
  "gender": "female",
  "status": "active",
  "memo": "놀이치료 필요",
  "created_at": "2026-01-15T10:05:00Z"
}
```

**결과**: `Client(id=660e..., role="client", person_id=NULL)`

---

#### [3단계] 센터: ClientRelation 생성 (양방향)

**요청**:
```http
POST /centers/1/client-relations
Content-Type: application/json

{
  "client_id": "660e8400-e29b-41d4-a716-446655440001",
  "related_client_id": "550e8400-e29b-41d4-a716-446655440001",
  "relation_type": "parent",
  "is_primary": true
}
```

**응답**:
```json
{
  "created": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440001",
      "client_id": "660e8400-e29b-41d4-a716-446655440001",
      "related_client_id": "550e8400-e29b-41d4-a716-446655440001",
      "relation_type": "parent",
      "is_primary": true
    },
    {
      "id": "780e8400-e29b-41d4-a716-446655440001",
      "client_id": "550e8400-e29b-41d4-a716-446655440001",
      "related_client_id": "660e8400-e29b-41d4-a716-446655440001",
      "relation_type": "child",
      "is_primary": false
    }
  ]
}
```

**시스템 동작**:
- 양방향 레코드 자동 생성 (child→parent, parent→child)
- is_primary는 부모 관계에만 적용

---

### 최종 상태

```
Client(id=550e..., role="guardian", name="김엄마", phone="010-1111-1111", person_id=NULL)
  ↕ ClientRelation (parent ↔ child, is_primary=true)
Client(id=660e..., role="client", name="김첫째", person_id=NULL)
```

**핵심 포인트**:
- 보호자는 `role="guardian"` Client로 생성
- 전화번호는 보호자 Client에만 저장
- ClientRelation은 양방향 자동 생성
- is_primary=true는 1개만 (주 보호자)

---

## 시나리오 2: 둘째 순차 등록 (Client 재사용)

### 개요
시나리오 1 이후, 같은 엄마의 둘째를 등록 → 보호자 Client 재사용

### 액터
- 센터 관리자

### 전제 조건
- 시나리오 1 완료
- `Client(id=550e..., role="guardian", phone="010-1111-1111")` 존재

---

### 플로우

#### [1단계] 센터: 전화번호로 보호자 Client 검색

**요청**:
```http
GET /centers/1/clients/search?phone=010-1111-1111&role=guardian
Authorization: Bearer {admin_token}
```

**응답**:
```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "role": "guardian",
      "name": "김엄마",
      "phone": "010-1111-1111",
      "children": [
        {
          "id": "660e8400-e29b-41d4-a716-446655440001",
          "name": "김첫째",
          "birth_date": "2015-03-15"
        }
      ]
    }
  ],
  "total": 1
}
```

**센터 UI**: 기존 보호자 표시 + "이 보호자 재사용" 버튼

---

#### [2단계] 센터: 둘째 Client 생성

**요청**:
```http
POST /centers/1/clients
Content-Type: application/json

{
  "name": "김둘째",
  "role": "client",
  "birth_date": "2018-07-10",
  "gender": "male",
  "memo": "언어치료 필요"
}
```

**결과**: `Client(id=880e..., role="client", name="김둘째")`

---

#### [3단계] 센터: ClientRelation 생성 (재사용)

**요청**:
```http
POST /centers/1/client-relations
Content-Type: application/json

{
  "client_id": "880e8400-e29b-41d4-a716-446655440002",
  "related_client_id": "550e8400-e29b-41d4-a716-446655440001",
  "relation_type": "parent",
  "is_primary": true
}
```

**결과**: ClientRelation 양방향 생성 (둘째↔엄마)

---

#### [4단계] 센터: 형제 관계 생성 (양방향 자동)

**요청**:
```http
POST /centers/1/sibling-relations
Content-Type: application/json

{
  "client_id": "660e8400-e29b-41d4-a716-446655440001",
  "sibling_id": "880e8400-e29b-41d4-a716-446655440002"
}
```

**응답**:
```json
{
  "created": [
    {
      "client_id": "660e8400-e29b-41d4-a716-446655440001",
      "sibling_id": "880e8400-e29b-41d4-a716-446655440002",
      "relation_detail": "older_sister"
    },
    {
      "client_id": "880e8400-e29b-41d4-a716-446655440002",
      "sibling_id": "660e8400-e29b-41d4-a716-446655440001",
      "relation_detail": "younger_brother"
    }
  ]
}
```

**시스템 동작**:
- 생년월일 + 성별 → relation_detail 자동 추론
- 양방향 레코드 자동 생성 (A→B, B→A)

---

### 최종 상태

```
Client(id=550e..., role="guardian", name="김엄마", phone="010-1111-1111", person_id=NULL)
  ↕ ClientRelation (parent ↔ child)
  ├─ Client(id=660e..., role="client", name="김첫째", birth_date=2015-03-15, gender=female)
  └─ Client(id=880e..., role="client", name="김둘째", birth_date=2018-07-10, gender=male)
      ↕ SiblingRelation
     (older_sister ↔ younger_brother)
```

**핵심 포인트**:
- **보호자 재사용**: 같은 전화번호 + role="guardian"으로 검색 → 재사용
- **형제 관계**: 양방향 자동 생성 + relation_detail 자동 추론
- **주 보호자**: 두 자녀 모두 엄마가 주 보호자

---

## 시나리오 3: 배치 등록 (형제 동시)

### 개요
배치 API로 보호자 + 형제 2명을 한 번에 등록

### 액터
- 센터 관리자

---

### 플로우

#### [1단계] 센터: 배치 등록 요청

**요청**:
```http
POST /centers/1/clients/batch
Content-Type: application/json

{
  "guardians": [
    {
      "name": "박엄마",
      "phone": "010-2222-3333",
      "relation_type": "parent",
      "is_primary": true
    },
    {
      "name": "박아빠",
      "phone": "010-2222-4444",
      "relation_type": "parent",
      "is_primary": false
    }
  ],
  "children": [
    {
      "name": "박첫째",
      "birth_date": "2014-05-01",
      "gender": "male"
    },
    {
      "name": "박둘째",
      "birth_date": "2017-09-15",
      "gender": "female"
    }
  ]
}
```

**응답**:
```json
{
  "guardians": [
    {
      "id": "990e8400-e29b-41d4-a716-446655440001",
      "role": "guardian",
      "name": "박엄마",
      "phone": "010-2222-3333"
    },
    {
      "id": "aa0e8400-e29b-41d4-a716-446655440001",
      "role": "guardian",
      "name": "박아빠",
      "phone": "010-2222-4444"
    }
  ],
  "children": [
    {
      "id": "bb0e8400-e29b-41d4-a716-446655440001",
      "role": "client",
      "name": "박첫째",
      "birth_date": "2014-05-01"
    },
    {
      "id": "cc0e8400-e29b-41d4-a716-446655440001",
      "role": "client",
      "name": "박둘째",
      "birth_date": "2017-09-15"
    }
  ],
  "relations": {
    "client_relations": 8,
    "sibling_relations": 2
  }
}
```

**시스템 동작 (트랜잭션)**:
1. Client 2명 생성 (엄마, 아빠) - role="guardian"
2. Client 2명 생성 (첫째, 둘째) - role="client"
3. ClientRelation 8개 생성 (양방향 × 4 = 8)
   - 엄마↔첫째 (parent↔child, is_primary=true)
   - 엄마↔둘째 (parent↔child, is_primary=true)
   - 아빠↔첫째 (parent↔child, is_primary=false)
   - 아빠↔둘째 (parent↔child, is_primary=false)
4. SiblingRelation 2개 생성 (양방향: 첫째↔둘째)

---

### 최종 상태

```
Client(id=990e..., role="guardian", name="박엄마")
Client(id=aa0e..., role="guardian", name="박아빠")
  ↕ ClientRelation (parent ↔ child)
  ├─ Client(id=bb0e..., role="client", name="박첫째", birth_date=2014-05-01, gender=male)
  └─ Client(id=cc0e..., role="client", name="박둘째", birth_date=2017-09-15, gender=female)
      ↕ SiblingRelation (older_brother ↔ younger_sister)
```

**핵심 포인트**:
- **배치 생성**: Client (role=guardian) → Client (role=client) → ClientRelation → SiblingRelation 순서
- **트랜잭션**: 실패 시 전체 롤백
- **형제 관계**: 자동 생성 + relation_detail 추론

---

## 시나리오 4: 보호자 role 전환

### 개요
보호자만 하던 Client가 본인도 상담이 필요해져 role 전환

### 액터
- 센터 관리자

### 전제 조건
- `Client(id=550e..., role="guardian", name="김엄마", person_id=NULL)` 존재

---

### 플로우

#### [1단계] 센터: 보호자 role 전환 요청

**요청**:
```http
PATCH /centers/1/clients/550e8400-e29b-41d4-a716-446655440001
Content-Type: application/json

{
  "role": "both",
  "memo": "부부 상담 필요"
}
```

**Handler 로직**:
```python
async def update_client_handler(
    client_id: str,
    data: ClientUpdateRequest,
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        client_repo = uow.repo(ClientRepository)

        # 1. Client 조회
        client = await client_repo.get(client_id)

        # 2. role 전환 검증
        if data.role and data.role != client.role:
            # "guardian" → "both" 허용
            # "both" → "client" 허용 (자녀 성인되어 보호자 역할 종료)
            # "client" → "guardian" 금지 (비즈니스 규칙)
            validate_role_transition(client.role, data.role)

        # 3. 업데이트
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(client, key, value)

        await uow.commit()
        return ClientResponse.model_validate(client)
```

**응답**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "role": "both",
  "name": "김엄마",
  "phone": "010-1111-1111",
  "person_id": null,
  "memo": "부부 상담 필요",
  "status": "active"
}
```

---

### 최종 상태

```
Client(id=550e..., role="both", name="김엄마", person_id=NULL)
  ↕ ClientRelation (parent ↔ child)
  ├─ Client(id=660e..., role="client", name="김첫째")
  └─ Client(id=880e..., role="client", name="김둘째")
```

**핵심 포인트**:
- **role 전환**: "guardian" → "both" (상담 추가)
- **역할 병행**: 자녀의 보호자 역할 + 본인의 상담 Client
- **90/10 원칙**: 10%에 해당하는 케이스

**허용되는 role 전환**:
- `"guardian"` → `"both"` (보호자가 상담 시작)
- `"both"` → `"client"` (자녀 성인되어 보호자 역할 종료)
- `"client"` → `"guardian"` ❌ 금지 (비즈니스 규칙 위반)

---

## 시나리오 5: Person 연동

### 개요
보호자가 앱에서 회원가입 → Client 연동 요청 → 센터 승인

### 액터
- 보호자 (김엄마)
- 센터 관리자

### 전제 조건
- `Client(id=550e..., role="both", phone="010-1111-1111", person_id=NULL)` 존재

---

### 플로우

#### [1단계] 보호자: 회원가입

**요청**:
```http
POST /account/register
Content-Type: application/json

{
  "email": "mom@example.com",
  "name": "김엄마",
  "phone": "010-1111-1111",
  "password": "secure_password"
}
```

**결과**: `Account` + `Person(id=1, phone="010-1111-1111")` 생성

---

#### [2단계] 보호자: 연동 요청

**요청**:
```http
POST /client-link-requests
Authorization: Bearer {person_token}
Content-Type: application/json

{
  "center_code": "ABC123",
  "phone": "010-1111-1111"
}
```

**결과**: `ClientLinkRequest(person_id=1, status="pending")` 생성

---

#### [3단계] 센터: 연동 요청 확인

**요청**:
```http
GET /centers/1/client-link-requests?status=pending
```

**응답**:
```json
{
  "items": [
    {
      "id": "ee0e8400-e29b-41d4-a716-446655440001",
      "person": {
        "id": "1",
        "name": "김엄마",
        "phone": "010-1111-1111"
      },
      "matching_clients": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440001",
          "role": "both",
          "name": "김엄마",
          "phone": "010-1111-1111",
          "relation_hint": "self"
        }
      ],
      "status": "pending"
    }
  ]
}
```

**센터 UI**: 매칭된 Client 선택 → 승인 버튼

---

#### [4단계] 센터: 승인

**요청**:
```http
POST /centers/1/client-link-requests/ee0e8400-e29b-41d4-a716-446655440001/approve
Content-Type: application/json

{
  "client_ids": ["550e8400-e29b-41d4-a716-446655440001"]
}
```

**시스템 동작**:
1. `Client(id=550e...).person_id = 1` 업데이트
2. `ClientLinkRequest.status = "approved"` 업데이트

---

### 최종 상태

```
Account(email="mom@example.com")
  ↓ 1:1
Person(id=1, name="김엄마", phone="010-1111-1111")
  ↓ 1:N
Client(id=550e..., role="both", name="김엄마", person_id=1)
  ↕ ClientRelation (parent ↔ child)
  ├─ Client(id=660e..., role="client", name="김첫째")
  └─ Client(id=880e..., role="client", name="김둘째")
```

**보호자 앱에서 가능한 작업**:
- 본인 상담 기록 조회 (role="both"로 상담 Client)
- 자녀 상담 기록 조회 (보호자 역할로 접근)

**핵심 포인트**:
- Person 연동은 항상 `Client.person_id`를 통해 이루어짐
- role="guardian" 또는 "both"인 Client만 앱 사용 가능 (person_id 설정)
- role="client"는 앱 사용 불가 (미성년 내담자)

---

## 시나리오 6: Client 삭제

### 개요
Client 삭제 시 소프트 삭제 처리, ClientRelation CASCADE 삭제

### 액터
- 센터 관리자

### 전제 조건
- `Client(id=660e...)` 존재
- `ClientRelation(client_id=660e...)` 존재

---

### 플로우

**요청**:
```http
DELETE /centers/1/clients/660e8400-e29b-41d4-a716-446655440001
```

**Handler 로직**:
```python
async def delete_client(client_id: str, uow: UnitOfWork):
    async with uow:
        client_repo = uow.repo(ClientRepository)

        # 1. 관련 데이터 확인
        has_counselings = await counseling_repo.exists_for_client(client_id)

        if has_counselings:
            # 소프트 삭제만 가능
            client = await client_repo.get(client_id)
            client.deleted_at = datetime.utcnow()
        else:
            # 하드 삭제 가능
            await client_repo.delete(client_id)

        await uow.commit()
```

**응답**:
```http
HTTP/1.1 204 No Content
```

---

### 최종 상태

```
Client(id=660e..., deleted_at="2026-01-15 15:00:00")  # 소프트 삭제
ClientRelation: 삭제됨 (CASCADE)
Client(id=550e..., role="guardian"): 유지 (다른 자녀 관계 있음)
Counseling: 유지 (이력 보존)
```

**핵심 포인트**:
- 상담 기록이 있으면 소프트 삭제만 가능
- ClientRelation은 CASCADE 삭제
- 보호자 Client는 유지 (다른 자녀 관계가 있을 수 있음)

---

## 시나리오 7: 상태 전이

### 개요
Client 상태 전이 규칙 적용 (모든 role에 동일 적용)

### ALLOWED_TRANSITIONS

```python
ALLOWED_TRANSITIONS = {
    "active": ["inactive"],
    "inactive": ["active", "archived"],
    "archived": ["active"]
}
```

---

### 플로우

#### [1단계] active → inactive

**요청**:
```http
PATCH /centers/1/clients/660e8400-e29b-41d4-a716-446655440001
Content-Type: application/json

{
  "status": "inactive",
  "memo": "3개월 미방문"
}
```

**검증**: ✅ 허용 (active → inactive)

---

#### [2단계] inactive → archived

**요청**:
```http
PATCH /centers/1/clients/660e8400-e29b-41d4-a716-446655440001
Content-Type: application/json

{
  "status": "archived",
  "memo": "6개월 경과로 보관"
}
```

**검증**: ✅ 허용 (inactive → archived)

---

#### [3단계] archived → active

**요청**:
```http
PATCH /centers/1/clients/660e8400-e29b-41d4-a716-446655440001
Content-Type: application/json

{
  "status": "active",
  "memo": "재방문으로 활성화"
}
```

**검증**: ✅ 허용 (archived → active)

---

### 에러 케이스: active → archived

**요청**:
```http
PATCH /centers/1/clients/660e8400-e29b-41d4-a716-446655440001
Content-Type: application/json

{
  "status": "archived"
}
```

**검증**: ❌ 불가 (inactive 경유 필수)

**에러 응답**:
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "detail": {
    "message": "Invalid status transition: active → archived",
    "allowed_transitions": ["inactive"]
  }
}
```

---

## 시나리오 요약

| 시나리오 | Client 생성 | ClientRelation | 핵심 포인트 |
|---------|------------|----------------|------------|
| 1. 첫째 등록 | role="guardian" + role="client" | 양방향 생성 | phone 저장, is_primary |
| 2. 둘째 등록 | role="client" (보호자 재사용) | 양방향 생성 + SiblingRelation | phone + role 검색 |
| 3. 배치 등록 | 여러 Client 생성 (role별) | ClientRelation + SiblingRelation | 트랜잭션 처리 |
| 4. role 전환 | role 업데이트 | - | "guardian" → "both" |
| 5. Person 연동 | - | - | person_id 설정 |
| 6. 삭제 | 소프트 삭제 | CASCADE | deleted_at, 이력 보존 |
| 7. 상태 전이 | - | - | ALLOWED_TRANSITIONS |

---

## Client.role 패턴 정리

### role 값 및 의미

| role | 의미 | person_id | 앱 사용 | 예시 |
|------|------|----------|---------|------|
| `"client"` | 상담 대상만 | NULL | 불가 (미성년) | 아동, 청소년 내담자 |
| `"guardian"` | 보호자만 | NULL (90%) / 설정 (10%) | 가능 (person_id 있으면) | 엄마, 아빠 (정보만) |
| `"both"` | 보호자 + 상담 대상 | NULL / 설정 | 가능 (person_id 있으면) | 엄마 (본인도 상담) |

### 전화번호 기반 재사용 패턴

```http
GET /centers/1/clients/search?phone=010-1111-1111&role=guardian
```

**시나리오**:
1. 첫째 등록 → 엄마 Client 생성 (role="guardian", phone="010-1111-1111")
2. 둘째 등록 → 전화번호 + role 검색 → 기존 엄마 Client 재사용
3. 셋째 등록 → 전화번호 + role 검색 → 기존 엄마 Client 재사용

### role 전환 규칙

**허용**:
- `"guardian"` → `"both"` (보호자가 상담 시작)
- `"both"` → `"client"` (자녀 성인되어 보호자 역할 종료)

**금지**:
- `"client"` → `"guardian"` (비즈니스 규칙 위반)
- `"client"` → `"both"` (비즈니스 규칙 위반)

---

## 참고 문서

- **Client 도메인**: `/docs/client/domain.md`
- **Client 엣지 케이스**: `/docs/client/edge-cases.md`
- **Client API 명세**: `/docs/client/api.md`
- **Client 의사결정 기록**: `/docs/client/decision-log.md`

---

**작성일**: 2026-01-23
**Version**: 3.0 (Client.role 기반 재설계, Guardian 제거)
