# Client API 명세

> Client 도메인 REST API 엔드포인트 및 스키마 정의 (Client.role 기반)

---

## API 엔드포인트

### Client CRUD

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/centers/{center_id}/clients` | Client 목록 (검색, 페이징, 필터) | client:read |
| GET | `/clients/{id}` | Client 상세 | client:read |
| GET | `/clients/search` | 전화번호 + role 기반 검색 (재사용용) | client:read |
| POST | `/centers/{center_id}/clients` | Client 생성 | client:create |
| PATCH | `/clients/{id}` | Client 수정 (role 전환 포함) | client:update |
| DELETE | `/clients/{id}` | Client 삭제 (소프트) | client:delete |
| POST | `/clients/{id}/restore` | Client 복원 | client:update |

**쿼리 파라미터 (목록 조회)**:
- `role`: client, guardian, both 필터
- `status`: active, inactive, archived 필터
- `include_archived`: archived 포함 여부 (default: false)
- `search`: 이름 검색
- `page`, `size`: 페이징

**보호자 검색 API**:
```http
GET /clients/search?phone=010-1111-1111&role=guardian
```

### ClientRelation 관리

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/clients/{id}/parents` | Client의 보호자 목록 조회 | client:read |
| GET | `/clients/{id}/children` | 보호자의 자녀 목록 조회 | client:read |
| POST | `/client-relations` | Client 관계 생성 (양방향 자동) | client:create |
| PATCH | `/client-relations/{id}` | 관계 수정 (주 보호자 변경) | client:update |
| DELETE | `/client-relations/{id}` | 관계 삭제 (양방향 자동) | client:delete |

### SiblingRelation 관리

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/clients/{id}/siblings` | 형제자매 목록 조회 | client:read |
| POST | `/sibling-relations` | 형제자매 관계 생성 (양방향 자동) | client:create |
| DELETE | `/sibling-relations/{id}` | 형제자매 관계 삭제 (양방향 자동) | client:delete |

### Person-Client 연동

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| POST | `/client-link-requests` | 연동 요청 (Person) | authenticated |
| GET | `/centers/{center_id}/client-link-requests` | 연동 요청 목록 | client:read |
| POST | `/client-link-requests/{id}/approve` | 연동 승인 | client:update |
| POST | `/client-link-requests/{id}/reject` | 연동 거부 | client:update |
| POST | `/clients/{id}/unlink` | 연동 해제 | client:update |
| GET | `/clients/{id}/unlink-logs` | 연동 해제 이력 조회 | client:read |

### 일괄 등록 (배치)

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| POST | `/centers/{center_id}/clients/batch` | 형제 일괄 등록 | client:create |

---

## Request/Response 스키마

### Client

#### ClientCreate (생성)

```python
class ClientCreate(BaseModel):
    role: Literal["client", "guardian", "both"]
    name: str = Field(..., min_length=1, max_length=100)
    birth_date: date | None = None
    gender: Literal["male", "female"] | None = None
    phone: str | None = Field(None, max_length=20)
    email: str | None = Field(None, max_length=255)
    address: str | None = None
    memo: str | None = None
```

**role 설명**:
- `"client"`: 상담 대상만 (미성년 내담자)
- `"guardian"`: 보호자만 (앱 사용 가능)
- `"both"`: 보호자 + 상담 대상 (본인도 상담)

#### ClientUpdate (수정)

```python
class ClientUpdate(BaseModel):
    role: Literal["client", "guardian", "both"] | None = None
    name: str | None = Field(None, min_length=1, max_length=100)
    birth_date: date | None = None
    gender: Literal["male", "female"] | None = None
    phone: str | None = Field(None, max_length=20)
    email: str | None = Field(None, max_length=255)
    address: str | None = None
    status: Literal["active", "inactive", "archived"] | None = None
    memo: str | None = None
```

**role 전환 규칙**:
- `"guardian"` → `"both"`: 허용 (보호자가 상담 시작)
- `"both"` → `"client"`: 허용 (보호자 역할 종료)
- `"client"` → `"guardian"` or `"both"`: 금지 (비즈니스 규칙 위반)

#### ClientResponse (응답)

```python
class ClientResponse(BaseModel):
    id: str
    center_id: int
    person_id: str | None
    role: str  # "client" | "guardian" | "both"
    name: str
    birth_date: date | None
    gender: str | None
    phone: str | None
    email: str | None
    address: str | None
    status: str
    memo: str | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None

    model_config = ConfigDict(from_attributes=True)
```

### ClientRelation

#### ClientRelationCreate (생성)

```python
class ClientRelationCreate(BaseModel):
    """Client 관계 생성 (양방향 자동 생성)"""
    client_id: str
    related_client_id: str
    relation_type: Literal["parent", "child"]
    is_primary: bool = False  # parent 관계에만 적용
```

**시스템 동작**:
- `relation_type="parent"` 요청 시 자동으로 역방향 `relation_type="child"` 생성
- 양방향: (child→parent, is_primary) + (parent→child, is_primary=False)

#### ClientRelationUpdate (수정)

```python
class ClientRelationUpdate(BaseModel):
    is_primary: bool  # 주 보호자 변경
```

#### ClientRelationResponse (응답)

```python
class ClientRelationResponse(BaseModel):
    id: str
    center_id: int
    client_id: str
    related_client_id: str
    relation_type: str  # "parent" | "child"
    is_primary: bool
    created_at: datetime

    # Nested 정보 (조회 시 포함)
    related_client: ClientResponse | None = None

    model_config = ConfigDict(from_attributes=True)
```

### SiblingRelation

#### SiblingRelationCreate (생성)

```python
class SiblingRelationCreate(BaseModel):
    """형제자매 관계 생성 (양방향 자동 생성)"""
    client_id: str
    sibling_id: str
```

**시스템 동작**:
- 생년월일 + 성별로 relation_detail 자동 추론
- 양방향: (A→B, "younger_sister") + (B→A, "older_brother")

#### SiblingRelationResponse (응답)

```python
class SiblingRelationResponse(BaseModel):
    id: str
    center_id: int
    client_id: str
    sibling_id: str
    relation_detail: str | None  # "older_brother", "younger_sister" 등
    created_at: datetime

    # Nested 정보 (조회 시 포함)
    sibling: ClientResponse | None = None

    model_config = ConfigDict(from_attributes=True)
```

### ClientLinkRequest

#### ClientLinkRequestCreate (생성)

```python
class ClientLinkRequestCreate(BaseModel):
    center_code: str = Field(..., min_length=1)
    phone: str = Field(..., max_length=20)
```

#### ClientLinkRequestResponse (응답)

```python
class ClientLinkRequestResponse(BaseModel):
    id: str
    center_id: int
    person_id: str
    phone: str
    client_id: str | None
    status: Literal["pending", "approved", "rejected"]
    created_at: datetime
    approved_at: datetime | None

    # Nested 정보 (조회 시 포함)
    matching_clients: list[ClientResponse] | None = None  # 전화번호 매칭 후보

    model_config = ConfigDict(from_attributes=True)
```

**매칭 조건**:
- role="guardian" 또는 "both" Client만 매칭 가능
- role="client"는 Person 연동 불가 (미성년자)

### 일괄 등록 (배치)

#### ClientBatchCreate (형제 일괄 등록)

```python
class ChildInfo(BaseModel):
    """일괄 등록할 아동 정보"""
    name: str = Field(..., min_length=1, max_length=100)
    birth_date: date | None = None
    gender: Literal["male", "female"] | None = None

class GuardianInfo(BaseModel):
    """일괄 등록할 보호자 정보"""
    phone: str = Field(..., max_length=20)  # 재사용 검색 키
    name: str = Field(..., min_length=1, max_length=100)
    email: str | None = Field(None, max_length=255)
    relation_type: Literal["parent"]  # 관계 유형
    is_primary: bool = False  # 주 보호자 여부

class ClientBatchCreate(BaseModel):
    """형제 일괄 등록 요청"""
    guardians: list[GuardianInfo] = Field(..., min_length=1, max_length=10)
    children: list[ChildInfo] = Field(..., min_length=1, max_length=20)
```

**시스템 동작**:
1. guardians → role="guardian" Client 생성 (phone 검색 후 재사용 가능)
2. children → role="client" Client 생성
3. ClientRelation 생성 (양방향 자동)
4. SiblingRelation 생성 (양방향 자동)

#### ClientBatchResponse (일괄 등록 응답)

```python
class ClientBatchResponse(BaseModel):
    """형제 일괄 등록 결과"""
    success: bool
    created_children: list[ClientResponse]  # role="client"
    created_guardians: list[ClientResponse]  # role="guardian"
    created_client_relations: list[ClientRelationResponse]
    created_sibling_relations: list[SiblingRelationResponse]
```

---

## API 워크플로우

### 1. 첫째 아동 등록

**보호자 Client 생성** (role="guardian"):
```http
POST /centers/1/clients
Content-Type: application/json

{
  "role": "guardian",
  "name": "김엄마",
  "phone": "010-1111-1111",
  "email": "mom@example.com"
}
```

**응답**:
```json
{
  "id": "uuid-mom",
  "center_id": 1,
  "role": "guardian",
  "name": "김엄마",
  "phone": "010-1111-1111",
  "person_id": null,
  "status": "active",
  "created_at": "2026-01-23T10:00:00Z"
}
```

**아동 Client 생성** (role="client"):
```http
POST /centers/1/clients
Content-Type: application/json

{
  "role": "client",
  "name": "김첫째",
  "birth_date": "2015-01-01",
  "gender": "male"
}
```

**ClientRelation 생성** (양방향 자동):
```http
POST /client-relations
Content-Type: application/json

{
  "client_id": "uuid-child-1",
  "related_client_id": "uuid-mom",
  "relation_type": "parent",
  "is_primary": true
}
```

**응답** (양방향 자동 생성):
```json
{
  "created": [
    {
      "id": "uuid-rel-1",
      "client_id": "uuid-child-1",
      "related_client_id": "uuid-mom",
      "relation_type": "parent",
      "is_primary": true
    },
    {
      "id": "uuid-rel-2",
      "client_id": "uuid-mom",
      "related_client_id": "uuid-child-1",
      "relation_type": "child",
      "is_primary": false
    }
  ]
}
```

### 2. 둘째 아동 등록 (보호자 재사용)

**보호자 검색** (phone + role):
```http
GET /clients/search?phone=010-1111-1111&role=guardian
```

**응답**: 기존 보호자 Client 발견
```json
{
  "items": [
    {
      "id": "uuid-mom",
      "role": "guardian",
      "name": "김엄마",
      "phone": "010-1111-1111"
    }
  ],
  "total": 1
}
```

**둘째 Client 생성**:
```http
POST /centers/1/clients
{
  "role": "client",
  "name": "김둘째",
  "birth_date": "2018-06-15",
  "gender": "female"
}
```

**ClientRelation 생성** (기존 보호자 재사용):
```http
POST /client-relations
{
  "client_id": "uuid-child-2",
  "related_client_id": "uuid-mom",  # 재사용
  "relation_type": "parent",
  "is_primary": true
}
```

**SiblingRelation 생성** (양방향 자동):
```http
POST /sibling-relations
{
  "client_id": "uuid-child-1",
  "sibling_id": "uuid-child-2"
}
```

**응답**:
```json
{
  "created": [
    {
      "client_id": "uuid-child-1",
      "sibling_id": "uuid-child-2",
      "relation_detail": "older_brother"
    },
    {
      "client_id": "uuid-child-2",
      "sibling_id": "uuid-child-1",
      "relation_detail": "younger_sister"
    }
  ]
}
```

### 3. 형제 일괄 등록 (배치 API)

```http
POST /centers/1/clients/batch
Content-Type: application/json

{
  "guardians": [
    {
      "phone": "010-2222-2222",
      "name": "박엄마",
      "email": "mom@example.com",
      "relation_type": "parent",
      "is_primary": true
    },
    {
      "phone": "010-3333-3333",
      "name": "박아빠",
      "email": "dad@example.com",
      "relation_type": "parent",
      "is_primary": false
    }
  ],
  "children": [
    {
      "name": "박첫째",
      "birth_date": "2015-01-01",
      "gender": "male"
    },
    {
      "name": "박둘째",
      "birth_date": "2018-06-15",
      "gender": "female"
    }
  ]
}
```

**응답**:
```json
{
  "success": true,
  "created_guardians": [
    {"id": "uuid-mom-2", "role": "guardian", "name": "박엄마"},
    {"id": "uuid-dad-2", "role": "guardian", "name": "박아빠"}
  ],
  "created_children": [
    {"id": "uuid-child-3", "role": "client", "name": "박첫째"},
    {"id": "uuid-child-4", "role": "client", "name": "박둘째"}
  ],
  "created_client_relations": [
    {"client_id": "uuid-child-3", "related_client_id": "uuid-mom-2", "relation_type": "parent"},
    {"client_id": "uuid-mom-2", "related_client_id": "uuid-child-3", "relation_type": "child"},
    {"client_id": "uuid-child-3", "related_client_id": "uuid-dad-2", "relation_type": "parent"},
    {"client_id": "uuid-dad-2", "related_client_id": "uuid-child-3", "relation_type": "child"},
    {"client_id": "uuid-child-4", "related_client_id": "uuid-mom-2", "relation_type": "parent"},
    {"client_id": "uuid-mom-2", "related_client_id": "uuid-child-4", "relation_type": "child"},
    {"client_id": "uuid-child-4", "related_client_id": "uuid-dad-2", "relation_type": "parent"},
    {"client_id": "uuid-dad-2", "related_client_id": "uuid-child-4", "relation_type": "child"}
  ],
  "created_sibling_relations": [
    {"client_id": "uuid-child-3", "sibling_id": "uuid-child-4", "relation_detail": "older_brother"},
    {"client_id": "uuid-child-4", "sibling_id": "uuid-child-3", "relation_detail": "younger_sister"}
  ]
}
```

### 4. 보호자 role 전환 (guardian → both)

**보호자가 본인도 상담 필요 시**:
```http
PATCH /clients/uuid-mom
Content-Type: application/json

{
  "role": "both",
  "birth_date": "1985-05-15",
  "gender": "female"
}
```

**응답**:
```json
{
  "id": "uuid-mom",
  "role": "both",
  "name": "김엄마",
  "phone": "010-1111-1111",
  "birth_date": "1985-05-15",
  "gender": "female",
  "person_id": null,
  "status": "active"
}
```

**효과**:
- 자녀의 보호자 역할 유지 (ClientRelation 그대로)
- 본인도 Counseling/Assessment 가능
- Person 연동 가능 (role="both"는 앱 사용 허용)

### 5. Person-Client 연동

**Person이 연동 요청**:
```http
POST /client-link-requests
Content-Type: application/json
Authorization: Bearer <person_token>

{
  "center_code": "ABC123",
  "phone": "010-1111-1111"
}
```

**센터 관리자: 매칭 후보 조회**:
```http
GET /centers/1/client-link-requests?status=pending
```

**응답**:
```json
{
  "items": [
    {
      "id": "uuid-request-1",
      "person_id": "person-1",
      "phone": "010-1111-1111",
      "status": "pending",
      "matching_clients": [
        {
          "id": "uuid-mom",
          "role": "both",
          "name": "김엄마",
          "phone": "010-1111-1111",
          "relation_hint": "self"
        }
      ]
    }
  ]
}
```

**센터 관리자: 승인**:
```http
POST /client-link-requests/uuid-request-1/approve
{
  "client_ids": ["uuid-mom"]
}
```

**시스템 동작**:
1. `Client(id=uuid-mom).person_id = "person-1"` 설정
2. `ClientLinkRequest.status = "approved"` 업데이트
3. 이제 보호자가 앱에서 자녀 정보 조회 가능

---

## 비즈니스 로직

### 1. 보호자 Client 전화번호 재사용

```python
async def create_client_with_guardians_handler(
    center_id: int,
    child_data: ClientCreate,
    guardian_phones: list[str],
    uow: UnitOfWork
):
    """
    아동 생성 시 보호자 Client 재사용 로직
    """
    async with uow:
        client_repo = uow.repo(ClientRepository)
        relation_repo = uow.repo(ClientRelationRepository)

        # 1. 아동 Client 생성 (role="client")
        child = await client_repo.create({
            **child_data.model_dump(),
            "role": "client"
        })

        # 2. 보호자 Client 재사용 검색
        for phone in guardian_phones:
            guardian = await client_repo.find_by_phone_and_role(
                center_id, phone, role="guardian"
            )

            if not guardian:
                # 새로 생성 (role="guardian")
                guardian = await client_repo.create({
                    "center_id": center_id,
                    "role": "guardian",
                    "phone": phone,
                    "name": "보호자",  # UI에서 입력받음
                })

            # 3. ClientRelation 생성 (양방향 자동)
            await relation_repo.create_bidirectional({
                "client_id": child.id,
                "related_client_id": guardian.id,
                "relation_type": "parent",
                "is_primary": False,  # UI에서 지정
            })

        await uow.commit()
        return child
```

### 2. 형제 관계 양방향 생성

```python
async def create_sibling_relation_handler(
    data: SiblingRelationCreate,
    uow: UnitOfWork
):
    """
    형제 관계 생성 (양방향 자동)
    """
    async with uow:
        client_repo = uow.repo(ClientRepository)
        sibling_repo = uow.repo(SiblingRelationRepository)

        # 1. Client 조회
        client_a = await client_repo.get(data.client_id)
        client_b = await client_repo.get(data.sibling_id)

        # 2. relation_detail 자동 추론
        detail_ab = infer_sibling_relation(client_a, client_b)
        detail_ba = infer_sibling_relation(client_b, client_a)

        # 3. 양방향 생성
        await sibling_repo.create({
            "client_id": client_a.id,
            "sibling_id": client_b.id,
            "relation_detail": detail_ab,  # "younger_sister"
        })

        await sibling_repo.create({
            "client_id": client_b.id,
            "sibling_id": client_a.id,
            "relation_detail": detail_ba,  # "older_brother"
        })

        await uow.commit()


def infer_sibling_relation(client: Client, sibling: Client) -> str | None:
    """생년월일 + 성별로 관계 추론"""
    if not client.birth_date or not sibling.birth_date:
        return None

    if client.birth_date > sibling.birth_date:
        # client가 더 어림
        return "younger_brother" if client.gender == "male" else "younger_sister"
    else:
        # client가 더 나이 많음
        return "older_brother" if client.gender == "male" else "older_sister"
```

### 3. 주 보호자 변경 (UnitOfWork)

```python
async def change_primary_guardian_handler(
    child_id: str,
    new_primary_guardian_id: str,
    uow: UnitOfWork
):
    """
    주 보호자 변경 (트랜잭션)
    """
    async with uow:
        relation_repo = uow.repo(ClientRelationRepository)

        # 1. 기존 주 보호자: is_primary = false
        old_relations = await relation_repo.find_by_client_and_type(
            child_id, relation_type="parent"
        )
        for rel in old_relations:
            if rel.is_primary:
                rel.is_primary = False

        # 2. 새 주 보호자: is_primary = true
        new_relation = await relation_repo.find_by_clients(
            child_id, new_primary_guardian_id, "parent"
        )
        new_relation.is_primary = True

        # 3. 검증: 주 보호자 1개만 확인
        primary_count = sum(1 for r in old_relations if r.is_primary)
        if primary_count != 1:
            raise ValueError("Only one primary guardian allowed")

        await uow.commit()
```

### 4. role 전환 검증

```python
async def update_client_handler(
    client_id: str,
    data: ClientUpdate,
    uow: UnitOfWork
):
    """
    Client 수정 (role 전환 포함)
    """
    async with uow:
        client_repo = uow.repo(ClientRepository)

        client = await client_repo.get(client_id)

        # role 전환 검증
        if data.role and data.role != client.role:
            validate_role_transition(client.role, data.role)

        # 업데이트
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(client, key, value)

        await uow.commit()
        return ClientResponse.model_validate(client)


def validate_role_transition(current_role: str, new_role: str):
    """role 전환 규칙 검증"""
    ALLOWED_TRANSITIONS = {
        "guardian": ["both"],
        "both": ["client"],
        "client": []  # client → 다른 role 금지
    }

    if new_role not in ALLOWED_TRANSITIONS.get(current_role, []):
        raise ValueError(
            f"Invalid role transition: {current_role} → {new_role}"
        )
```

---

## 에러 응답

### 400 Bad Request

```json
{
  "detail": "Invalid role transition: client → guardian"
}
```

### 404 Not Found

```json
{
  "detail": "Client not found"
}
```

### 409 Conflict

```json
{
  "detail": "Client relation already exists"
}
```

### 422 Validation Error

```json
{
  "detail": [
    {
      "loc": ["body", "role"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

---

## 참고 문서

- **도메인 설계**: `/docs/client/domain.md`
- **엣지 케이스**: `/docs/client/edge-cases.md`
- **시나리오**: `/docs/client/scenarios.md`
- **의사결정 기록**: `/docs/client/decision-log.md`

---

**작성일**: 2026-01-23
**Version**: 3.0 (Client.role 기반 API)
