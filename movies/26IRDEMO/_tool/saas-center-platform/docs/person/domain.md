# Person 도메인 설계

> 전역 인적 정보 관리 도메인

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

**Person 모듈**은 다음을 담당합니다:
- **인적 정보 관리**: 이름, 전화번호, 생년월일, 성별
- **전역 식별자**: Account, Client, CenterMember가 참조하는 중심 엔티티
- **개인정보 보호**: 마스킹, 암호화 (Phase 2)

**Person은 직접 조작 대상이 아님** - Account를 통해서만 생성/수정

### 특징

- **전역적(Global)**: 센터 경계를 넘어 공유
- **추상적**: 실제 사람을 나타내는 메타 정보
- **참조용**: Account, Client, CenterMember가 참조
- **최소 정보**: 이름만 필수, 나머지 선택

### Foundation Layer

Person은 **Foundation Module**로 다른 모듈이 의존:
```
Person (Foundation)
  ↑
  │ depends on
  │
Auth, Client, Center (Foundation/Domain)
```

---

## Core Schemas (Models)

### Person (인적 정보)

**전역 인적 정보 엔티티**

```python
from sqlalchemy import String, Integer, Date, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from datetime import date, datetime

class Person(Base):
    __tablename__ = "persons"

    # Primary Key
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Account Reference (1:1 관계, FK 제약 없음, 모듈 간 독립성)
    account_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)

    # Basic Information
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(10), nullable=True)  # male, female

    # Soft Delete
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )
```

**필드 설명**:
- `account_id`: Account 참조 (1:1 관계, unique 제약, FK 제약 없음, 모듈러 모놀리스 설계)
- `name`: 이름 (필수)
- `phone`: 전화번호 (필수, 상담센터 연락 목적)
- `birth`: 생년월일 (선택, 성인 상담 시 불필요)
- `gender`: 성별 (선택, "male" 또는 "female"만 허용)
- `deleted_at`: Soft Delete (개인정보보호법 준수)

**주의사항**:
- `account_id`: 1:1 관계 (unique 제약), FK 제약 없이 정수로만 저장 (모듈 간 독립성 확보)
- `phone`: 필수 필드, unique constraint 없음 (전화번호 중복 허용)
- `gender`: "male" 또는 "female"만 허용 (String 타입)
- Account 삭제 시 애플리케이션 레벨에서 Person도 함께 삭제 처리

**모듈러 모놀리스 설계**:
- 모든 FK 제약 제거 (Auth ↔ Person 간 독립성)
- 데이터 무결성은 애플리케이션 레벨에서 관리
- 향후 마이크로서비스 전환 용이

---

## Pydantic Schemas (DTOs)

### PersonCreate

```python
from pydantic import BaseModel, Field
from datetime import date

class PersonCreate(BaseModel):
    """Person 생성 스키마 (회원가입 시 내부적으로 사용)"""
    account_id: int  # Account 생성 후 할당
    name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., pattern=r"^01[0-9]-\d{3,4}-\d{4}$")
    birth: date | None = None
    gender: str | None = Field(None, pattern=r"^(male|female)$")
```

**참고**:
- `account_id`는 회원가입 시 Account 생성 후 자동으로 할당
- 일반 사용자는 직접 Person을 생성할 수 없음 (Account 통해서만)

### PersonUpdate

```python
class PersonUpdate(BaseModel):
    """Person 수정 스키마 (Account 수정 시 사용)"""
    name: str | None = Field(None, min_length=1, max_length=100)
    phone: str | None = Field(None, pattern=r"^01[0-9]-\d{3,4}-\d{4}$")
    birth: date | None = None
    gender: str | None = Field(None, pattern=r"^(male|female)$")
```

### PersonResponse

```python
from datetime import datetime

class PersonResponse(BaseModel):
    """Person 조회 응답 (마스킹 없음)"""
    id: int
    account_id: int
    name: str
    phone: str
    birth: date | None
    gender: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

### PersonSummary

```python
class PersonSummary(BaseModel):
    """Person 요약 정보 (타 모듈 참조용)"""
    id: int
    name: str
    phone: str

    model_config = {"from_attributes": True}
```

### PersonMasked

```python
class PersonMasked(BaseModel):
    """Person 마스킹 응답 (타인 조회 시)"""
    id: int
    name: str  # 김** (마스킹)
    phone: str  # 010-****-5678 (마스킹)
    birth: date | None  # 마스킹 안 함
    gender: str | None

    model_config = {"from_attributes": True}
```

---

## 비즈니스 규칙

### 1. Person 생성 규칙

| 규칙 | 설명 |
|------|------|
| **name 필수** | 이름은 필수 필드 |
| **phone 필수** | 전화번호는 필수 필드 (상담센터 연락 목적) |
| **birth 선택** | 생년월일은 선택 필드 (성인 상담 시 불필요) |
| **gender 선택** | 성별은 선택 필드 (개인정보 최소화 원칙) |
| **Account와 1:1 관계** | 하나의 Account는 하나의 Person과 연결 (account_id unique 제약) |

**검증 규칙**:
```python
# name 검증
if not data.name or len(data.name) < 1:
    raise ValueError("이름은 필수입니다")

# phone 검증 (필수)
if not data.phone:
    raise ValueError("전화번호는 필수입니다")
if not re.match(r"^01[0-9]-\d{3,4}-\d{4}$", data.phone):
    raise ValueError("올바른 전화번호 형식이 아닙니다 (예: 010-1234-5678)")

# gender 검증 (있는 경우)
if data.gender:
    if data.gender not in ["male", "female"]:
        raise ValueError("성별은 male 또는 female 중 하나여야 합니다")
```

### 2. Person-Account 관계

| 관계 | 설명 |
|------|------|
| **1:1 관계** | 하나의 Account는 하나의 Person과 연결 |
| **Person → Account** | Person.account_id (unique 제약, FK 제약 없음) |
| **역방향 조회** | 애플리케이션 레벨에서 관리 (FK 제약 없이) |
| **생성 시점** | Account 먼저 생성 → Person 생성 (account_id 할당) |

**생성 순서 (1:1 관계)**:
```python
# 회원가입 시
POST /auth/signup
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "person": {
    "name": "김철수",
    "phone": "010-1234-5678"
  }
}

# 내부 처리 순서
async with uow:
    # 1. Account 먼저 생성
    account = await account_repo.create({
        "email": "user@example.com",
        "password_hash": hash_password("SecurePass123!"),
        ...
    })

    # 2. Person 생성 (account_id 할당)
    person = await person_repo.create({
        "account_id": account.id,  # ← Account.id 참조 (1:1)
        "name": "김철수",
        "phone": "010-1234-5678",
        ...
    })

    await uow.commit()

# Person 조회
GET /accounts/me
→ Account 조회
→ Person 조회 (account_id로 조인)
```

### 3. Person-Client 관계

| 관계 | 설명 |
|------|------|
| **1:N 선택적** | 한 Person이 여러 센터에 Client 가능 (person_id nullable) |
| **완전 독립적** | Client는 자체 정보 필드 보유 (name, contact_phone, birth_date) |
| **Person 연동은 인증/식별용** | person_id는 Account 연동 시에만 사용 |
| **나중에 연결** | ClientLinkRequest로 승인 후 연결 |
| **별칭 허용** | Client.name ≠ Person.name 가능 (센터별 호칭) |

**Client 독립 정보 관리**:
```python
# Client 자체 정보 필드 (Person과 독립)
class Client(Base):
    person_id: Mapped[int | None]  # 선택적 연결 (nullable)
    name: Mapped[str]  # Client 자체 이름 (필수)
    contact_phone: Mapped[str]  # Client 자체 전화번호 (필수)
    birth_date: Mapped[date | None]  # Client 자체 생년월일 (선택)
```

**시나리오**:
```python
# 시나리오 1: Person 없이 Client 생성
Client(id=100, center_id=1, person_id=None, name="김아이", contact_phone="010-1111-1111")
# → 센터가 독립적으로 관리

# 시나리오 2: 나중에 Person 연동
Client(id=100, person_id=10)  # ClientLinkRequest 승인 후
Person(id=10, name="김부모")
# → Client.name = "김아이", Person.name = "김부모" (별칭 허용)

# 시나리오 3: 멀티센터 (각 센터별 독립 정보)
Person(id=10, name="김철수")
Client(id=100, center_id=1, person_id=10, name="김철수", contact_phone="010-1111-1111")  # 서울센터
Client(id=200, center_id=2, person_id=10, name="철수", contact_phone="010-2222-2222")  # 부산센터
# → 각 센터가 독립적으로 Client 정보 관리
```

**정보 소유권**:
- **Client 정보 (name, contact_phone)**: 센터가 소유 및 관리
- **Person 정보 (name, phone)**: Account 소유자가 관리
- **Person 연동**: 인증/식별 목적 (정보 공유 아님)

### 4. Person-CenterMember 관계

| 관계 | 설명 |
|------|------|
| **1:N 필수** | 한 Person이 여러 센터의 CenterMember 가능 (person_id NOT NULL) |
| **Person 중심** | CenterMember는 자체 정보 필드 없음 (name, phone 필드 없음) |
| **항상 Person 참조** | 모든 정보 표시 시 Person join 필수 |
| **즉시 연결** | CenterMember 생성 시 Person 필수 (회원가입 직후) |
| **동기화 자동** | Person 수정 시 모든 센터에 자동 반영 |

**CenterMember Person 중심 설계**:
```python
# CenterMember는 Person 정보 필드 없음
class CenterMember(Base):
    person_id: Mapped[int] = mapped_column(ForeignKey("persons.id"), nullable=False)
    center_id: Mapped[int]
    role_id: Mapped[int]
    # name, phone 필드 없음! → Person 참조

# 조회 시 항상 Person join
SELECT cm.id, cm.center_id, cm.role_id, p.name, p.phone
FROM center_members cm
JOIN persons p ON cm.person_id = p.id
WHERE cm.center_id = 1;
```

**시나리오**:
```python
# 시나리오 1: 구성원 추가 (회원가입 직후)
Person(id=10, name="김철수", phone="010-1111-1111")
CenterMember(id=1, person_id=10, center_id=1, role_id=2)  # A센터 상담사
CenterMember(id=2, person_id=10, center_id=2, role_id=3)  # B센터 관리자

# 시나리오 2: Person 정보 수정 시 자동 동기화
PATCH /accounts/me { "person": { "phone": "010-9999-9999" } }
→ Person(id=10, phone="010-9999-9999") 업데이트
→ 모든 CenterMember 조회 시 자동 반영 (JOIN)

# A센터 구성원 목록 조회
GET /centers/1/members
→ [
  { "id": 1, "person": { "name": "김철수", "phone": "010-9999-9999" } }  # 자동 반영
]

# B센터 구성원 목록 조회
GET /centers/2/members
→ [
  { "id": 2, "person": { "name": "김철수", "phone": "010-9999-9999" } }  # 자동 반영
]
```

**정보 소유권**:
- **CenterMember**: Person 정보를 참조만 (소유 없음)
- **Person 정보 (name, phone)**: Account 소유자가 관리
- **센터 역할 (role_id)**: 센터가 관리 (CenterMember.role_id)

**Phase 2 고려사항**:
- `CenterMember.display_name` 추가 예정 (센터별 별칭)
- 별칭 미설정 시 Person.name 사용
- 설정 시 별칭 우선 표시

### 5. Person 수정 권한

| 권한 | 설명 |
|------|------|
| **본인만 수정** | Account 소유자만 Person 수정 가능 |
| **센터 수정 불가** | 센터는 Client/CenterMember 정보만 수정 (Person 수정 금지) |
| **전역 영향** | Person 수정 시 모든 CenterMember 자동 반영 |
| **Client 독립** | Client 정보 수정은 Person 영향 없음 |

**이유**:
- Person은 전역적 → 한 센터 수정이 다른 센터에 영향
- 개인정보 보호 → 본인만 수정 권한
- CenterMember는 Person 참조 → 자동 동기화
- Client는 독립 정보 → Person 영향 없음

**CenterMember 수정 시나리오**:
```python
# ❌ 센터에서 Person 수정 시도 (불가능)
PATCH /centers/1/members/1
{
  "person": { "phone": "010-9999-9999" }
}
→ 400 Bad Request: "Person 정보는 본인만 수정 가능합니다"

# ✅ 본인이 Person 수정 (자동 동기화)
PATCH /accounts/me
{
  "person": { "phone": "010-9999-9999" }
}
→ Person(id=10, phone="010-9999-9999") 업데이트
→ 모든 센터 CenterMember 조회 시 자동 반영
```

**Client 수정 시나리오**:
```python
# ✅ 센터에서 Client 정보 수정 (독립적)
PATCH /centers/1/clients/100
{
  "name": "김아이",
  "contact_phone": "010-9999-9999"
}
→ Client(id=100, name="김아이", contact_phone="010-9999-9999") 업데이트
→ Person 영향 없음 (독립적)

# ❌ 센터에서 Person 수정 시도 (불가능)
PATCH /centers/1/clients/100
{
  "person": { "phone": "010-9999-9999" }
}
→ 400 Bad Request: "Person 정보는 본인만 수정 가능합니다"
```

### 6. Person 삭제 정책

| 정책 | 설명 |
|------|------|
| **Soft Delete** | deleted_at 플래그 사용 |
| **개인정보보호법 준수** | 삭제 요청 시 처리 |
| **관계 유지** | Account, Client FK는 유지 |
| **조회 필터링** | deleted_at이 null인 것만 조회 |

**삭제 시나리오**:
```python
# 회원 탈퇴
DELETE /accounts/me
→ Account.deleted_at = NOW()
→ Person.deleted_at = NOW()

# Client, CenterMember는 유지 (상담 기록 보존)
Client(id=100, person_id=10)  # person_id 유지
→ 조회 시 person이 삭제됨 표시
```

### 7. Person 중복 허용

| 정책 | 설명 |
|------|------|
| **중복 허용** | 동명이인, 전화번호 변경 고려 |
| **unique constraint 없음** | phone, (name, birth_date) unique 아님 |
| **센터 판단** | ClientLinkRequest 승인 시 중복 확인 |

**중복 시나리오**:
```python
# 동명이인
Person(id=10, name="김철수", phone="010-1111-1111")
Person(id=20, name="김철수", phone="010-2222-2222")
→ 허용 (다른 사람)

# 전화번호 변경
Person(id=10, phone="010-1111-1111" → "010-9999-9999")
→ 기존 Person 업데이트 (새 Person 생성 아님)
```

### 8. Person 개인정보 보호

#### 마스킹 규칙

| 조회자 | 마스킹 여부 | 설명 |
|--------|------------|------|
| **본인** | 마스킹 없음 | 전체 정보 조회 |
| **타인 (설정 ON)** | 마스킹 적용 | name: 김\*\*, phone: 010-\*\*\*\*-5678 |
| **타인 (설정 OFF)** | 마스킹 없음 | 전체 정보 조회 |

**설정 위치**: `Account.privacy_mask_enabled`

**마스킹 로직**:
```python
def mask_name(name: str) -> str:
    """이름 마스킹: 김** (첫 글자만 표시)"""
    if not name:
        return ""
    return name[0] + "*" * (len(name) - 1)

def mask_phone(phone: str | None) -> str | None:
    """전화번호 마스킹: 010-****-5678"""
    if not phone:
        return None

    # 010-1234-5678 → 010-****-5678
    parts = phone.split("-")
    if len(parts) != 3:
        return phone

    return f"{parts[0]}-****-{parts[2]}"
```

#### 암호화 (Phase 2)

**Phase 1 (MVP)**: 접근 제어만 (권한 기반)
**Phase 2**: Application 레벨 암호화 추가

```python
# Phase 2 구현 예정
class Person(Base):
    phone_encrypted: Mapped[bytes | None]
    birth_encrypted: Mapped[bytes | None]

    @property
    def phone(self) -> str | None:
        if not self.phone_encrypted:
            return None
        return decrypt(self.phone_encrypted)
```

---

## API 엔드포인트

**중요**: Person은 독립 API 없음, Account API에 포함

### Account API를 통한 Person 관리

#### Person 생성 (Account 회원가입 시)

```http
POST /auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "person": {
    "name": "김철수",
    "phone": "010-1234-5678",
    "birth": "1990-01-01",
    "gender": "male"
  }
}
```

**응답 (201 Created)**:
```json
{
  "account": {
    "id": 1,
    "email": "user@example.com",
    "is_active": true
  },
  "person": {
    "id": 10,
    "name": "김철수",
    "phone": "010-1234-5678",
    "birth": "1990-01-01",
    "gender": "male",
    "created_at": "2026-01-13T10:00:00Z",
    "updated_at": "2026-01-13T10:00:00Z"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 1800
}
```

---

#### Person 조회 (Account 정보 조회 시 포함)

```http
GET /accounts/me
Authorization: Bearer {access_token}
```

**응답 (200 OK)**:
```json
{
  "account": {
    "id": 1,
    "email": "user@example.com",
    "is_active": true,
    "is_verified": true,
    "privacy_mask_enabled": false,
    "created_at": "2026-01-13T10:00:00Z"
  },
  "person": {
    "id": 10,
    "name": "김철수",
    "phone": "010-1234-5678",
    "birth": "1990-01-01",
    "gender": "male",
    "created_at": "2026-01-13T10:00:00Z",
    "updated_at": "2026-01-13T10:00:00Z"
  }
}
```

---

#### Person 수정 (Account 수정 시)

```http
PATCH /accounts/me
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "person": {
    "name": "이철수",
    "phone": "010-9999-9999"
  }
}
```

**응답 (200 OK)**:
```json
{
  "account": {
    "id": 1,
    "email": "user@example.com",
    "updated_at": "2026-01-13T11:00:00Z"
  },
  "person": {
    "id": 10,
    "name": "이철수",
    "phone": "010-9999-9999",
    "birth": "1990-01-01",
    "gender": "male",
    "updated_at": "2026-01-13T11:00:00Z"
  }
}
```

**에러 (400 Bad Request - 전화번호 형식)**:
```json
{
  "detail": "올바른 전화번호 형식이 아닙니다 (예: 010-1234-5678)"
}
```

---

#### Person 삭제 (Account 탈퇴 시)

```http
DELETE /accounts/me
Authorization: Bearer {access_token}
```

**응답 (204 No Content)**:
```
(empty body)
```

**데이터베이스 변경**:
```sql
UPDATE accounts SET deleted_at = NOW() WHERE id = 1;
UPDATE persons SET deleted_at = NOW() WHERE id = 10;
```

---

### Client API를 통한 Person 조회

#### Client 상세 조회 시 Person 포함

```http
GET /centers/{center_id}/clients/{client_id}
Authorization: Bearer {access_token}
```

**응답 (200 OK - Client 독립 정보 + Person 참조)**:
```json
{
  "client": {
    "id": 100,
    "center_id": 1,
    "person_id": 10,
    "name": "김아이",  // Client 자체 이름 (센터 관리)
    "contact_phone": "010-1234-5678",  // Client 자체 전화번호 (센터 관리)
    "birth_date": "2015-03-15",
    "status": "active"
  },
  "person": {  // Person 참조 정보 (마스킹 적용)
    "id": 10,
    "name": "김**",  // Person.name (Account 소유자 관리)
    "phone": "010-****-5678",  // Person.phone (Account 소유자 관리)
    "birth": "1990-01-01",
    "gender": "male"
  }
}
```

**주의사항**:
- **Client 정보 (name, contact_phone)**: 센터가 수정 가능 (독립적)
- **Person 정보 (name, phone)**: 본인만 수정 가능 (전역적)
- Client.name ≠ Person.name 허용 (별칭)

**Client 수정 (독립 정보)**:
```http
PATCH /centers/1/clients/100
{
  "name": "김신아이",
  "contact_phone": "010-9999-9999"
}

→ 200 OK
{
  "client": {
    "id": 100,
    "name": "김신아이",  // Client.name 업데이트 ✅
    "contact_phone": "010-9999-9999"  // Client.contact_phone 업데이트 ✅
  }
}
```

**Person 수정 시도 (금지)**:
```http
PATCH /centers/1/clients/100
{
  "person": { "phone": "010-9999-9999" }  // ❌ 금지
}

→ 400 Bad Request
{
  "detail": "Person 정보는 본인만 수정 가능합니다"
}
```

---

### CenterMember API를 통한 Person 조회

#### CenterMember 목록 조회 시 Person 자동 JOIN

```http
GET /centers/{center_id}/members
Authorization: Bearer {access_token}
```

**응답 (200 OK - Person 자동 반영)**:
```json
{
  "items": [
    {
      "id": 1,
      "center_id": 1,
      "person_id": 10,
      "role_id": 2,
      "person": {  // Person 참조 (항상 JOIN)
        "id": 10,
        "name": "김철수",  // Person.name (본인이 수정 시 자동 반영)
        "phone": "010-1111-1111"  // Person.phone (본인이 수정 시 자동 반영)
      }
    }
  ]
}
```

**CenterMember 수정 (Person 수정 불가)**:
```http
PATCH /centers/1/members/1
{
  "role_id": 3  // ✅ 센터 역할 수정 가능
}

→ 200 OK
```

**Person 수정 시도 (금지)**:
```http
PATCH /centers/1/members/1
{
  "person": { "phone": "010-9999-9999" }  // ❌ 금지
}

→ 400 Bad Request
{
  "detail": "Person 정보는 본인만 수정 가능합니다"
}
```

**Person 수정 시 자동 동기화**:
```http
# 본인이 Person 수정
PATCH /accounts/me
{
  "person": { "phone": "010-9999-9999" }
}

→ Person(id=10, phone="010-9999-9999") 업데이트
→ 모든 센터의 CenterMember 조회 시 자동 반영 (JOIN)
```

---

## 참고 문서

- **의사결정 기록**: `/docs/person/decision-log.md` - 설계 질문-답변 및 근거
- **엣지 케이스**: `/docs/person/edge-cases.md` (예정)
- **시나리오**: `/docs/person/scenarios.md` (예정)
- **Auth 도메인**: `/docs/auth/domain.md`
- **Client 도메인**: `/docs/client/domain.md`
- **프로젝트 설정**: `/CLAUDE.md`
