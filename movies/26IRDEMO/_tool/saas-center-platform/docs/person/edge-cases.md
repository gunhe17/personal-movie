# Person 도메인 엣지 케이스

> Person 관리에서 발생 가능한 엣지 케이스, 복잡한 시나리오 및 설계 전략

---

## 목차

### 기본 검증 엣지 케이스
1. [Person 생성 엣지 케이스](#person-생성-엣지-케이스)
2. [Person 수정 엣지 케이스](#person-수정-엣지-케이스)
3. [Person 삭제 엣지 케이스](#person-삭제-엣지-케이스)
4. [Person 조회 엣지 케이스](#person-조회-엣지-케이스)
5. [Person-Account 관계 엣지 케이스](#person-account-관계-엣지-케이스)
6. [Person-Client 관계 엣지 케이스](#person-client-관계-엣지-케이스)

### 복잡한 시나리오 엣지 케이스
7. [CenterMember Person 정보 동기화 (멀티센터)](#centermember-person-정보-동기화-멀티센터)
8. [Client-Person 정보 독립성 검증](#client-person-정보-독립성-검증)
9. [멀티센터 Person 동시 수정 경합](#멀티센터-person-동시-수정-경합)
10. [ClientLinkRequest 동시 승인 처리](#clientlinkrequest-동시-승인-처리)
11. [Person Soft Delete와 참조 처리](#person-soft-delete와-참조-처리)
12. [Person 마스킹 설정 변경 시 캐싱](#person-마스킹-설정-변경-시-캐싱)
13. [CenterMember 센터별 별칭 관리 (Phase 2)](#centermember-센터별-별칭-관리-phase-2)
14. [Account 통합 시 Person 병합](#account-통합-시-person-병합)
15. [Person 변경 이력 추적 전략](#person-변경-이력-추적-전략)
16. [대량 Person 데이터 마이그레이션](#대량-person-데이터-마이그레이션)

---

## Person 생성 엣지 케이스

### 1. 이름 없이 생성 시도

**설명**: name 필드 없이 Person 생성

**발생 조건**:
```python
PersonCreate(name="", phone="010-1234-5678")
PersonCreate(name=None, phone="010-1234-5678")
```

**검증 위치**: Pydantic Schema

**HTTP 상태 코드**: `422 Unprocessable Entity`

**에러 메시지**:
```json
{
  "detail": [
    {
      "loc": ["body", "person", "name"],
      "msg": "이름은 필수입니다",
      "type": "value_error"
    }
  ]
}
```

**검증 로직**:
```python
# app/modules/person/schemas.py
from pydantic import BaseModel, Field, field_validator

class PersonCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., pattern=r"^01[0-9]-\d{3,4}-\d{4}$")
    birth: date | None = None
    gender: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("이름은 필수입니다")
        return v.strip()
```

---

### 2. 잘못된 전화번호 형식

**설명**: 한국 전화번호 형식이 아닌 값 입력

**발생 조건**:
```python
PersonCreate(name="김철수", phone="1234567890")  # 하이픈 없음
PersonCreate(name="김철수", phone="02-1234-5678")  # 지역번호
PersonCreate(name="김철수", phone="+82-10-1234-5678")  # 국가번호
```

**검증 위치**: Pydantic Schema

**HTTP 상태 코드**: `422 Unprocessable Entity`

**에러 메시지**:
```json
{
  "detail": [
    {
      "loc": ["body", "person", "phone"],
      "msg": "올바른 전화번호 형식이 아닙니다 (예: 010-1234-5678)",
      "type": "value_error"
    }
  ]
}
```

**검증 로직**:
```python
import re

class PersonCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., pattern=r"^01[0-9]-\d{3,4}-\d{4}$")

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        # 한국 휴대폰 번호 형식: 010-1234-5678, 010-123-4567
        pattern = r"^01[0-9]-\d{3,4}-\d{4}$"
        if not re.match(pattern, v):
            raise ValueError("올바른 전화번호 형식이 아닙니다 (예: 010-1234-5678)")

        return v
```

---

### 3. 잘못된 성별 값

**설명**: male, female 외의 값 입력

**발생 조건**:
```python
PersonCreate(name="김철수", gender="남자")
PersonCreate(name="김철수", gender="M")
PersonCreate(name="김철수", gender="unknown")
```

**검증 위치**: Pydantic Schema

**HTTP 상태 코드**: `422 Unprocessable Entity`

**에러 메시지**:
```json
{
  "detail": [
    {
      "loc": ["body", "person", "gender"],
      "msg": "성별은 male 또는 female이어야 합니다",
      "type": "value_error"
    }
  ]
}
```

**검증 로직**:
```python
from enum import Enum

class Gender(str, Enum):
    MALE = "male"
    FEMALE = "female"

class PersonCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    gender: Gender | None = None

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v: str | None) -> str | None:
        if v is None:
            return None

        if v not in ["male", "female"]:
            raise ValueError("성별은 male 또는 female이어야 합니다")

        return v
```

---

### 4. 미래 생년월일

**설명**: 미래 날짜를 생년월일로 입력

**발생 조건**:
```python
PersonCreate(name="김철수", birth="2030-01-01")
```

**검증 위치**: Service 레이어

**HTTP 상태 코드**: `400 Bad Request`

**에러 메시지**:
```json
{
  "detail": "생년월일은 오늘 이전이어야 합니다"
}
```

**검증 로직**:
```python
# app/modules/person/services/create_person.py
from datetime import date
from fastapi import HTTPException

class CreatePersonService:
    def __init__(self, repo: PersonRepository):
        self.repo = repo

    async def execute(self, data: PersonCreate) -> Person:
        # 생년월일 검증
        if data.birth:
            if data.birth > date.today():
                raise HTTPException(
                    status_code=400,
                    detail="생년월일은 오늘 이전이어야 합니다"
                )

        # Person 생성
        person_data = data.model_dump()
        return await self.repo.create(person_data)
```

---

## Person 수정 엣지 케이스

### 5. 타인의 Person 수정 시도

**설명**: 본인이 아닌 다른 사람의 Person 수정

**발생 조건**:
```python
# Account A의 Person 수정 시도 (Account B 권한으로)
current_account_id = 2
target_person_id = 10  # Account 1의 Person
```

**검증 위치**: Handler

**HTTP 상태 코드**: `403 Forbidden`

**에러 메시지**:
```json
{
  "detail": "본인의 정보만 수정할 수 있습니다"
}
```

**검증 로직**:
```python
# app/modules/auth/handlers/update_account.py
from fastapi import HTTPException

async def update_account_handler(
    data: AccountUpdate,
    current_account: Account = Depends(get_current_account),
    uow: UnitOfWork = Depends(get_uow),
):
    """Account 및 Person 정보 수정"""
    async with uow:
        account_repo = uow.repo(AccountRepository)
        person_repo = uow.repo(PersonRepository)

        # Account 수정
        if data.email:
            await account_repo.update(current_account.id, {"email": data.email})

        # Person 수정
        if data.person:
            if not current_account.person_id:
                raise HTTPException(403, "Person 정보가 없습니다")

            # 본인 확인 (이미 current_account로 필터링됨)
            person = await person_repo.get(current_account.person_id)
            if not person:
                raise HTTPException(404, "Person을 찾을 수 없습니다")

            # Person 업데이트
            update_data = data.person.model_dump(exclude_unset=True)
            await person_repo.update(person.id, update_data)

        await uow.commit()
        return {"message": "정보가 수정되었습니다"}
```

---

### 6. 센터에서 Person 수정 시도

**설명**: 센터 직원이 Client의 Person 정보 수정 시도

**발생 조건**:
```http
PATCH /centers/1/clients/100
{
  "person": {
    "phone": "010-9999-9999"
  }
}
```

**검증 위치**: Handler

**HTTP 상태 코드**: `400 Bad Request`

**에러 메시지**:
```json
{
  "detail": "Person 정보는 본인만 수정 가능합니다. Client 정보만 수정해주세요."
}
```

**검증 로직**:
```python
# app/modules/client/handlers/update_client.py
async def update_client_handler(
    center_id: int,
    client_id: int,
    data: ClientUpdate,
    current_account: Account = Depends(get_current_account),
    uow: UnitOfWork = Depends(get_uow),
):
    """Client 정보 수정 (Person 수정 금지)"""

    # Person 수정 시도 체크
    if hasattr(data, "person") and data.person is not None:
        raise HTTPException(
            status_code=400,
            detail="Person 정보는 본인만 수정 가능합니다. Client 정보만 수정해주세요."
        )

    async with uow:
        client_repo = uow.repo(ClientRepository)

        # Client 수정
        client = await client_repo.get_by_id_and_center(client_id, center_id)
        if not client:
            raise HTTPException(404, "Client를 찾을 수 없습니다")

        update_data = data.model_dump(exclude_unset=True)
        await client_repo.update(client.id, update_data)

        await uow.commit()
        return {"message": "Client 정보가 수정되었습니다"}
```

---

### 7. 삭제된 Person 수정 시도

**설명**: deleted_at이 설정된 Person 수정 시도

**발생 조건**:
```python
person.deleted_at = datetime(2026, 1, 13, 10, 0, 0)
```

**검증 위치**: Repository

**HTTP 상태 코드**: `404 Not Found`

**에러 메시지**:
```json
{
  "detail": "Person을 찾을 수 없습니다"
}
```

**검증 로직**:
```python
# app/modules/person/repository.py
class PersonRepository:
    async def get(self, person_id: int) -> Person | None:
        """Person 조회 (삭제된 것 제외)"""
        result = await self.session.execute(
            select(Person)
            .where(Person.id == person_id)
            .where(Person.deleted_at.is_(None))  # 삭제 안 된 것만
        )
        return result.scalar_one_or_none()
```

---

## Person 삭제 엣지 케이스

### 8. Person 직접 삭제 시도

**설명**: Person을 직접 삭제하려는 시도 (API 없음)

**발생 조건**:
```http
DELETE /persons/10
```

**HTTP 상태 코드**: `404 Not Found`

**에러 메시지**:
```json
{
  "detail": "Not Found"
}
```

**이유**: Person 독립 API 없음, Account 탈퇴로만 삭제 가능

---

### 9. Account 삭제 시 Person도 삭제

**설명**: Account 탈퇴 시 Person도 함께 Soft Delete

**발생 조건**:
```http
DELETE /accounts/me
```

**검증 위치**: Handler

**HTTP 상태 코드**: `204 No Content`

**데이터베이스 변경**:
```sql
UPDATE accounts SET deleted_at = NOW() WHERE id = 1;
UPDATE persons SET deleted_at = NOW() WHERE id = 10;
```

**검증 로직**:
```python
# app/modules/auth/handlers/delete_account.py
async def delete_account_handler(
    current_account: Account = Depends(get_current_account),
    uow: UnitOfWork = Depends(get_uow),
):
    """Account 및 Person 삭제 (Soft Delete)"""
    async with uow:
        account_repo = uow.repo(AccountRepository)
        person_repo = uow.repo(PersonRepository)

        # Account Soft Delete
        await account_repo.soft_delete(current_account.id)

        # Person Soft Delete (있는 경우)
        if current_account.person_id:
            await person_repo.soft_delete(current_account.person_id)

        await uow.commit()

    return Response(status_code=204)
```

---

### 10. 삭제된 Person과 연결된 Client 조회

**설명**: Person이 삭제된 Client 조회 시

**발생 조건**:
```python
Client(id=100, person_id=10)
Person(id=10, deleted_at="2026-01-13T10:00:00Z")
```

**검증 위치**: Repository (Join 조건)

**HTTP 상태 코드**: `200 OK`

**응답**:
```json
{
  "client": {
    "id": 100,
    "name": "김철수",
    "center_id": 1
  },
  "person": null
}
```

**검증 로직**:
```python
# app/modules/client/repository.py
class ClientRepository:
    async def get_with_person(self, client_id: int) -> dict:
        """Client와 Person 함께 조회"""
        result = await self.session.execute(
            select(Client, Person)
            .outerjoin(Person, and_(
                Client.person_id == Person.id,
                Person.deleted_at.is_(None)  # 삭제 안 된 Person만
            ))
            .where(Client.id == client_id)
        )

        row = result.first()
        if not row:
            return None

        client, person = row
        return {
            "client": client,
            "person": person  # None if deleted
        }
```

---

## Person 조회 엣지 케이스

### 11. 마스킹 설정에 따른 조회

**설명**: Account.privacy_mask_enabled에 따라 마스킹 적용

**발생 조건**:
```python
# 본인 조회
viewer_account_id = 1
target_person.account_id = 1
→ 마스킹 없음

# 타인 조회 (마스킹 ON)
viewer_account.privacy_mask_enabled = True
target_person.account_id = 2
→ 마스킹 적용
```

**검증 위치**: Service 레이어

**HTTP 상태 코드**: `200 OK`

**응답 (마스킹)**:
```json
{
  "person": {
    "id": 10,
    "name": "김**",
    "phone": "010-****-5678",
    "birth": "1990-01-01",
    "gender": "male"
  }
}
```

**검증 로직**:
```python
# app/modules/person/services/get_person.py
class GetPersonService:
    def __init__(self, person_repo: PersonRepository, account_repo: AccountRepository):
        self.person_repo = person_repo
        self.account_repo = account_repo

    async def execute(
        self,
        person_id: int,
        viewer_account_id: int
    ) -> PersonResponse | PersonMasked:
        """Person 조회 (마스킹 처리)"""
        person = await self.person_repo.get(person_id)
        if not person:
            raise HTTPException(404, "Person을 찾을 수 없습니다")

        # 본인 조회: 마스킹 없음
        viewer_account = await self.account_repo.get(viewer_account_id)
        if person.account and person.account.id == viewer_account_id:
            return PersonResponse.model_validate(person)

        # 타인 조회: 마스킹 설정 확인
        target_account = await self.account_repo.get_by_person(person_id)
        if target_account and target_account.privacy_mask_enabled:
            return PersonMasked(
                id=person.id,
                name=self._mask_name(person.name),
                phone=self._mask_phone(person.phone),
                birth=person.birth,
                gender=person.gender
            )

        return PersonResponse.model_validate(person)

    def _mask_name(self, name: str) -> str:
        """이름 마스킹: 김**"""
        if not name:
            return ""
        return name[0] + "*" * (len(name) - 1)

    def _mask_phone(self, phone: str | None) -> str | None:
        """전화번호 마스킹: 010-****-5678"""
        if not phone:
            return None

        parts = phone.split("-")
        if len(parts) != 3:
            return phone

        return f"{parts[0]}-****-{parts[2]}"
```

---

### 12. Account 없는 Person 조회

**설명**: Account가 연결되지 않은 Person 조회

**발생 조건**:
```python
# 아동 Client (Account 없음)
Person(id=10, name="김아이")
Account.query.filter_by(person_id=10).first()  # None
```

**검증 위치**: Repository

**HTTP 상태 코드**: `200 OK`

**응답**:
```json
{
  "person": {
    "id": 10,
    "name": "김아이",
    "phone": null,
    "birth": "2018-05-10",
    "gender": "male"
  }
}
```

**주의**: Account 없는 Person은 본인 확인 불가 → 센터를 통해서만 조회 가능

---

## Person-Account 관계 엣지 케이스

### 13. Person 없는 Account 생성

**설명**: 시스템 관리자 Account (person_id=null)

**발생 조건**:
```python
Account(email="admin@platform.com", person_id=None)
```

**검증 위치**: Handler

**HTTP 상태 코드**: `201 Created`

**응답**:
```json
{
  "account": {
    "id": 1,
    "email": "admin@platform.com"
  },
  "person": null,
  "access_token": "...",
  "refresh_token": "..."
}
```

**검증 로직**:
```python
# app/modules/auth/handlers/signup.py
async def signup_handler(
    data: SignupRequest,
    uow: UnitOfWork = Depends(get_uow),
):
    """회원가입 (Person 선택적 생성)"""
    async with uow:
        account_repo = uow.repo(AccountRepository)
        person_repo = uow.repo(PersonRepository)

        person_id = None

        # Person 정보 있으면 생성
        if data.person:
            person_data = data.person.model_dump()
            person = await person_repo.create(person_data)
            person_id = person.id

        # Account 생성
        account = await account_repo.create({
            "email": data.email,
            "password_hash": hash_password(data.password),
            "person_id": person_id  # NULL 가능
        })

        await uow.commit()
        return {"account": account, "person": person if person_id else None}
```

---

### 14. 한 Person에 여러 Account (소셜 로그인)

**설명**: 동일 Person에 여러 provider의 Account 연결

**발생 조건**:
```python
Person(id=10, name="김철수")
Account(id=1, email="user@naver.com", provider="naver", person_id=10)
Account(id=2, email="user@kakao.com", provider="kakao", person_id=10)
```

**검증 위치**: Handler

**HTTP 상태 코드**: `200 OK` (로그인 성공)

**응답**:
```json
{
  "account": {
    "id": 2,
    "email": "user@kakao.com",
    "provider": "kakao"
  },
  "person": {
    "id": 10,
    "name": "김철수",
    "phone": "010-1234-5678"
  },
  "access_token": "...",
  "refresh_token": "..."
}
```

**주의**: Person은 공유되므로 정보 수정 시 모든 Account에 영향

---

## Person-Client 관계 엣지 케이스

### 15. 한 Person이 여러 센터의 Client

**설명**: 멀티센터 이용자

**발생 조건**:
```python
Person(id=10, name="김철수")
Client(id=100, center_id=1, person_id=10)  # 서울센터
Client(id=200, center_id=2, person_id=10)  # 부산센터
```

**검증 위치**: Repository

**HTTP 상태 코드**: `200 OK`

**조회 결과** (서울센터에서 조회):
```json
{
  "client": {
    "id": 100,
    "center_id": 1,
    "name": "김철수"
  },
  "person": {
    "id": 10,
    "name": "김철수",
    "phone": "010-1234-5678"
  }
}
```

**주의**: Person 정보 수정 시 부산센터 Client에도 영향 (하지만 Client는 독립 정보 보유)

---

### 16. Client-Person 연결 승인 전 조회

**설명**: ClientLinkRequest 대기 중인 Client 조회

**발생 조건**:
```python
Client(id=100, center_id=1, person_id=None)
ClientLinkRequest(client_id=100, person_id=10, status="pending")
```

**검증 위치**: Repository

**HTTP 상태 코드**: `200 OK`

**응답**:
```json
{
  "client": {
    "id": 100,
    "center_id": 1,
    "name": "김아이",
    "contact_phone": "010-1111-1111"
  },
  "person": null,
  "link_request": {
    "id": 1,
    "status": "pending",
    "requested_at": "2026-01-13T10:00:00Z"
  }
}
```

**검증 로직**:
```python
# app/modules/client/repository.py
async def get_with_person_and_link_request(self, client_id: int) -> dict:
    """Client, Person, ClientLinkRequest 함께 조회"""
    result = await self.session.execute(
        select(Client, Person, ClientLinkRequest)
        .outerjoin(Person, Client.person_id == Person.id)
        .outerjoin(ClientLinkRequest, Client.id == ClientLinkRequest.client_id)
        .where(Client.id == client_id)
    )

    row = result.first()
    if not row:
        return None

    client, person, link_request = row
    return {
        "client": client,
        "person": person,
        "link_request": link_request
    }
```

---

## 복잡한 시나리오 엣지 케이스

---

## CenterMember Person 정보 동기화 (멀티센터)

### 문제 정의

**시나리오**: 한 Person이 여러 센터의 CenterMember로 등록된 상태에서 Person 정보 수정 시, 모든 센터에서 즉시 반영되어야 함

**발생 조건**:
```python
Person(id=10, name="김철수", phone="010-1111-1111")
CenterMember(id=1, person_id=10, center_id=1, role_id=2)  # A센터 상담사
CenterMember(id=2, person_id=10, center_id=2, role_id=3)  # B센터 관리자
CenterMember(id=3, person_id=10, center_id=3, role_id=2)  # C센터 상담사

# 본인이 Person 정보 수정
PATCH /accounts/me
{
  "person": { "phone": "010-9999-9999" }
}
```

**기대 동작**:
- A, B, C 센터 모든 구성원 목록 조회 시 즉시 반영
- 실시간 동기화 (캐시 무효화 또는 JOIN 기반)

---

### 전략 비교

#### 전략 A: JOIN 기반 동기화 (추천)

**개요**: CenterMember 조회 시 항상 Person JOIN, 실시간 반영

**구현**:
```python
# app/modules/center/repository.py
class CenterMemberRepository:
    async def get_members_by_center(self, center_id: int) -> list[dict]:
        """센터 구성원 목록 조회 (Person JOIN)"""
        result = await self.session.execute(
            select(CenterMember, Person)
            .join(Person, CenterMember.person_id == Person.id)
            .where(CenterMember.center_id == center_id)
            .where(Person.deleted_at.is_(None))
            .order_by(CenterMember.created_at.desc())
        )

        members = []
        for member, person in result:
            members.append({
                "id": member.id,
                "center_id": member.center_id,
                "role_id": member.role_id,
                "person": {
                    "id": person.id,
                    "name": person.name,  # 실시간 반영
                    "phone": person.phone,  # 실시간 반영
                }
            })

        return members
```

**장점**:
- ✅ 실시간 동기화 보장
- ✅ 캐시 무효화 불필요
- ✅ 구현 단순
- ✅ 데이터 일관성 100%

**단점**:
- ❌ 매번 JOIN 오버헤드 (단, Person 인덱스 사용 시 최소화)
- ❌ 대규모 센터 구성원 목록 조회 시 성능 영향 가능

**적용 시나리오**: MVP 단계, 센터당 구성원 수 < 100명

---

#### 전략 B: CenterMember 비정규화 + 이벤트 기반 동기화

**개요**: CenterMember에 name, phone 복사, Person 수정 시 이벤트로 모든 CenterMember 업데이트

**구현**:
```python
# CenterMember 비정규화 필드 추가
class CenterMember(Base):
    person_id: Mapped[int]
    name_cache: Mapped[str]  # Person.name 복사
    phone_cache: Mapped[str | None]  # Person.phone 복사
    synced_at: Mapped[datetime]  # 마지막 동기화 시각

# Person 수정 시 이벤트 발행
class UpdatePersonService:
    async def execute(self, person_id: int, data: PersonUpdate) -> Person:
        person = await self.repo.update(person_id, data.model_dump(exclude_unset=True))

        # 이벤트 발행
        await self.event_bus.publish(PersonUpdatedEvent(person_id=person_id))

        return person

# 이벤트 핸들러
class PersonUpdatedHandler:
    async def handle(self, event: PersonUpdatedEvent):
        """Person 수정 시 모든 CenterMember 캐시 업데이트"""
        person = await self.person_repo.get(event.person_id)
        members = await self.member_repo.get_by_person(event.person_id)

        for member in members:
            await self.member_repo.update(member.id, {
                "name_cache": person.name,
                "phone_cache": person.phone,
                "synced_at": datetime.utcnow()
            })
```

**장점**:
- ✅ 조회 성능 우수 (JOIN 불필요)
- ✅ 대규모 센터 대응 가능

**단점**:
- ❌ 복잡한 구현 (이벤트 시스템 필요)
- ❌ 비정규화 필드 관리 부담
- ❌ 이벤트 실패 시 데이터 불일치 위험
- ❌ 동기화 지연 발생 가능

**적용 시나리오**: 대규모 센터 (구성원 > 1000명), 이벤트 시스템 구축 완료

---

#### 전략 C: Redis 캐시 + TTL 기반 동기화

**개요**: Person 정보를 Redis 캐시, TTL 만료 시 DB 조회

**구현**:
```python
# Person 조회 서비스 (캐시 레이어)
class GetPersonService:
    def __init__(self, repo: PersonRepository, cache: RedisCache):
        self.repo = repo
        self.cache = cache

    async def execute(self, person_id: int) -> Person:
        # 캐시 조회
        cache_key = f"person:{person_id}"
        cached = await self.cache.get(cache_key)
        if cached:
            return Person(**cached)

        # DB 조회
        person = await self.repo.get(person_id)
        if not person:
            raise HTTPException(404, "Person을 찾을 수 없습니다")

        # 캐시 저장 (TTL 60초)
        await self.cache.set(cache_key, person.model_dump(), ttl=60)

        return person

# Person 수정 시 캐시 무효화
class UpdatePersonService:
    async def execute(self, person_id: int, data: PersonUpdate) -> Person:
        person = await self.repo.update(person_id, data.model_dump(exclude_unset=True))

        # 캐시 무효화
        cache_key = f"person:{person_id}"
        await self.cache.delete(cache_key)

        return person
```

**장점**:
- ✅ 조회 성능 우수 (캐시 히트 시)
- ✅ JOIN 오버헤드 감소
- ✅ 구현 중간 난이도

**단점**:
- ❌ Redis 인프라 필요
- ❌ TTL 만료 전 조회 시 stale data
- ❌ 캐시 무효화 실패 시 불일치 위험

**적용 시나리오**: 조회 빈도 높음, 수정 빈도 낮음, Redis 운영 가능

---

### 권장 전략: 전략 A (JOIN 기반)

**이유**:
1. **MVP 단계 적합**: 구현 단순, 데이터 일관성 보장
2. **센터 규모 고려**: 센터당 구성원 수 < 100명 (JOIN 성능 충분)
3. **인프라 최소화**: Redis 없이 PostgreSQL만으로 해결
4. **확장 경로 명확**: Phase 2에서 전략 B 또는 C로 전환 가능

**구현 예시**:
```python
# CenterMember 모델 (Person 정보 필드 없음)
class CenterMember(Base):
    person_id: Mapped[int] = mapped_column(ForeignKey("persons.id"), nullable=False)
    center_id: Mapped[int]
    role_id: Mapped[int]
    # name, phone 필드 없음! → Person JOIN

# Repository
class CenterMemberRepository:
    async def get_members_by_center(self, center_id: int) -> list[dict]:
        """센터 구성원 목록 조회 (Person JOIN)"""
        result = await self.session.execute(
            select(CenterMember, Person)
            .join(Person, CenterMember.person_id == Person.id)
            .where(CenterMember.center_id == center_id)
            .where(Person.deleted_at.is_(None))
        )

        return [
            {
                "id": member.id,
                "person": {
                    "id": person.id,
                    "name": person.name,
                    "phone": person.phone,
                }
            }
            for member, person in result
        ]
```

---

## Client-Person 정보 독립성 검증

### 문제 정의

**시나리오**: Client는 독립적인 정보 필드를 보유하며, Person과의 연동은 인증/식별 목적만 수행. 센터가 Client 정보를 수정해도 Person에 영향 없어야 함.

**핵심 검증 사항**:
1. Client.name ≠ Person.name 허용 (별칭)
2. Client.contact_phone 수정 시 Person.phone 변경 없음
3. Person.phone 수정 시 Client.contact_phone 변경 없음

---

### 전략: 완전 독립 정보 관리

**구현**:
```python
# Client 모델 (독립 정보 필드)
class Client(Base):
    __tablename__ = "clients"

    person_id: Mapped[int | None] = mapped_column(ForeignKey("persons.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)  # Client 자체 이름
    contact_phone: Mapped[str] = mapped_column(String(20), nullable=False)  # Client 자체 전화번호
    birth: Mapped[date | None] = mapped_column(Date, nullable=True)

# Client 수정 Handler
async def update_client_handler(
    center_id: int,
    client_id: int,
    data: ClientUpdate,
    uow: UnitOfWork = Depends(get_uow),
):
    """Client 정보 수정 (Person 독립)"""

    # Person 수정 시도 차단
    if hasattr(data, "person") and data.person is not None:
        raise HTTPException(400, "Person 정보는 본인만 수정 가능합니다")

    async with uow:
        client_repo = uow.repo(ClientRepository)

        # Client 정보만 수정
        client = await client_repo.get_by_id_and_center(client_id, center_id)
        if not client:
            raise HTTPException(404, "Client를 찾을 수 없습니다")

        # 독립 필드 업데이트 (Person 영향 없음)
        update_data = data.model_dump(exclude_unset=True)
        await client_repo.update(client.id, update_data)

        await uow.commit()
        return {"message": "Client 정보가 수정되었습니다"}
```

---

### 검증 시나리오

#### 시나리오 1: Client 별칭 허용

```python
# 초기 상태
Person(id=10, name="김부모", phone="010-1111-1111")
Client(id=100, person_id=10, name="김아이", contact_phone="010-2222-2222")

# 검증
assert Client.name != Person.name  # ✅ "김아이" != "김부모"
assert Client.contact_phone != Person.phone  # ✅ "010-2222-2222" != "010-1111-1111"
```

#### 시나리오 2: Client 정보 수정 시 Person 영향 없음

```python
# Client 수정
PATCH /centers/1/clients/100
{
  "name": "김신아이",
  "contact_phone": "010-3333-3333"
}

# 검증
Client(id=100, name="김신아이", contact_phone="010-3333-3333")  # ✅ 수정됨
Person(id=10, name="김부모", phone="010-1111-1111")  # ✅ 변경 없음
```

#### 시나리오 3: Person 정보 수정 시 Client 영향 없음

```python
# Person 수정
PATCH /accounts/me
{
  "person": { "phone": "010-9999-9999" }
}

# 검증
Person(id=10, phone="010-9999-9999")  # ✅ 수정됨
Client(id=100, contact_phone="010-2222-2222")  # ✅ 변경 없음
```

---

### 주의사항

**API 설계 원칙**:
1. **Client API**:
   - `PATCH /centers/{center_id}/clients/{client_id}`: Client 정보만 수정
   - Person 수정 시도 시 400 Bad Request
2. **Account API**:
   - `PATCH /accounts/me`: Person 정보만 수정
   - Client 정보는 수정 불가

**데이터 정합성**:
- Client.name과 Person.name이 다를 수 있음 (의도적)
- UI에서 둘 다 표시하거나, 센터 정책에 따라 선택 표시

---

## 멀티센터 Person 동시 수정 경합

### 문제 정의

**시나리오**: 한 Person이 여러 센터의 CenterMember로 등록된 상태에서, 본인이 Person 정보를 수정하는 동시에 여러 센터에서 CenterMember 목록을 조회하는 경우

**발생 조건**:
```python
# 초기 상태
Person(id=10, name="김철수", phone="010-1111-1111")
CenterMember(id=1, person_id=10, center_id=1)  # A센터
CenterMember(id=2, person_id=10, center_id=2)  # B센터
CenterMember(id=3, person_id=10, center_id=3)  # C센터

# 동시 작업
# Thread 1: Person 수정
PATCH /accounts/me { "person": { "phone": "010-9999-9999" } }

# Thread 2: A센터 구성원 목록 조회
GET /centers/1/members

# Thread 3: B센터 구성원 목록 조회
GET /centers/2/members
```

**문제점**:
1. **Dirty Read**: 트랜잭션 격리 수준에 따라 커밋 전 데이터 조회 가능
2. **Phantom Read**: 동일 조회 쿼리 반복 시 다른 결과
3. **데이터 불일치**: 센터별로 다른 Person 정보 조회 가능

---

### 전략 비교

#### 전략 A: READ COMMITTED (기본 격리 수준)

**개요**: PostgreSQL 기본 격리 수준, 커밋된 데이터만 조회

**장점**:
- ✅ Dirty Read 방지
- ✅ 성능 우수
- ✅ 설정 불필요

**단점**:
- ❌ Phantom Read 가능
- ❌ 동시 조회 시 다른 결과 가능

**적용 시나리오**: MVP 단계, 데이터 불일치 허용 범위

---

#### 전략 B: REPEATABLE READ (격리 수준 상향)

**개요**: 트랜잭션 시작 시점 스냅샷 기준 조회, Phantom Read 방지

**구현**:
```python
# Repository 레벨 격리 수준 설정
class CenterMemberRepository:
    async def get_members_by_center(self, center_id: int) -> list[dict]:
        """센터 구성원 목록 조회 (REPEATABLE READ)"""
        # PostgreSQL REPEATABLE READ 설정
        await self.session.execute(text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ"))

        result = await self.session.execute(
            select(CenterMember, Person)
            .join(Person, CenterMember.person_id == Person.id)
            .where(CenterMember.center_id == center_id)
            .where(Person.deleted_at.is_(None))
        )

        return [
            {"id": m.id, "person": {"name": p.name, "phone": p.phone}}
            for m, p in result
        ]
```

**장점**:
- ✅ Phantom Read 방지
- ✅ 트랜잭션 내 일관성 보장

**단점**:
- ❌ 성능 저하 (스냅샷 관리 오버헤드)
- ❌ 트랜잭션 충돌 가능

**적용 시나리오**: 데이터 일관성 중요, 조회 트랜잭션 짧음

---

#### 전략 C: 낙관적 잠금 (Optimistic Locking)

**개요**: Person.updated_at 기반 버전 관리, 수정 시 충돌 감지

**구현**:
```python
# Person 모델 (버전 관리)
class Person(Base):
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Person 수정 Service (낙관적 잠금)
class UpdatePersonService:
    async def execute(self, person_id: int, data: PersonUpdate, expected_version: datetime) -> Person:
        person = await self.repo.get(person_id)
        if not person:
            raise HTTPException(404, "Person을 찾을 수 없습니다")

        # 버전 충돌 검사
        if person.updated_at != expected_version:
            raise HTTPException(409, "Person 정보가 다른 곳에서 수정되었습니다. 다시 시도해주세요.")

        # 업데이트
        updated = await self.repo.update(person_id, data.model_dump(exclude_unset=True))
        return updated
```

**장점**:
- ✅ 충돌 감지 정확
- ✅ 데드락 없음
- ✅ 성능 우수

**단점**:
- ❌ 충돌 시 재시도 필요
- ❌ 클라이언트 복잡도 증가

**적용 시나리오**: 수정 빈도 낮음, 충돌 가능성 낮음

---

### 권장 전략: 전략 A (READ COMMITTED) + 전략 C (낙관적 잠금)

**이유**:
1. **READ COMMITTED**: 기본 격리 수준으로 성능 우수, Dirty Read 방지
2. **낙관적 잠금**: Person 수정 시 충돌 감지, 데이터 무결성 보장
3. **조합 효과**: 조회는 빠르게, 수정은 안전하게

**구현**:
```python
# 조회: READ COMMITTED (기본)
async def get_members_handler(center_id: int, uow: UnitOfWork):
    async with uow:
        members = await member_repo.get_members_by_center(center_id)
        return {"items": members}

# 수정: 낙관적 잠금
async def update_person_handler(
    data: PersonUpdate,
    current_account: Account,
    uow: UnitOfWork
):
    async with uow:
        person_repo = uow.repo(PersonRepository)

        # Person 조회 (현재 버전 확인)
        person = await person_repo.get(current_account.person_id)
        if not person:
            raise HTTPException(404, "Person을 찾을 수 없습니다")

        # 클라이언트가 보낸 버전과 비교
        if data.expected_version and person.updated_at != data.expected_version:
            raise HTTPException(409, "다른 곳에서 수정되었습니다. 새로고침 후 다시 시도해주세요.")

        # 업데이트
        update_data = data.model_dump(exclude_unset=True, exclude={"expected_version"})
        updated = await person_repo.update(person.id, update_data)

        await uow.commit()
        return {"person": updated}
```

---

## ClientLinkRequest 동시 승인 처리

### 문제 정의

**시나리오**: 한 Person이 여러 센터에 ClientLinkRequest를 동시에 요청하고, 승인 과정에서 경합 발생

**발생 조건**:
```python
# 초기 상태
Person(id=10, name="김철수")
Client(id=100, center_id=1, person_id=None)
Client(id=200, center_id=2, person_id=None)

# ClientLinkRequest 생성
ClientLinkRequest(id=1, client_id=100, person_id=10, status="pending")
ClientLinkRequest(id=2, client_id=200, person_id=10, status="pending")

# 동시 승인
# Thread 1: A센터 승인
POST /centers/1/client-link-requests/1/approve

# Thread 2: B센터 승인
POST /centers/2/client-link-requests/2/approve
```

**문제점**:
1. **중복 승인**: 동일 Person이 여러 센터에 동시 연결 시도
2. **데이터 무결성**: Client.person_id 동시 업데이트
3. **상태 불일치**: ClientLinkRequest.status 경합

---

### 전략 비교

#### 전략 A: 비관적 잠금 (Pessimistic Locking)

**개요**: ClientLinkRequest 조회 시 FOR UPDATE 잠금, 순차 처리

**구현**:
```python
# app/modules/client/handlers/approve_link_request.py
async def approve_link_request_handler(
    center_id: int,
    request_id: int,
    uow: UnitOfWork = Depends(get_uow),
):
    """ClientLinkRequest 승인 (비관적 잠금)"""
    async with uow:
        link_request_repo = uow.repo(ClientLinkRequestRepository)
        client_repo = uow.repo(ClientRepository)

        # FOR UPDATE 잠금
        link_request = await link_request_repo.get_for_update(request_id)
        if not link_request:
            raise HTTPException(404, "연결 요청을 찾을 수 없습니다")

        if link_request.status != "pending":
            raise HTTPException(400, f"이미 {link_request.status} 상태입니다")

        # Client 업데이트
        client = await client_repo.get_by_id_and_center(link_request.client_id, center_id)
        if not client:
            raise HTTPException(404, "Client를 찾을 수 없습니다")

        await client_repo.update(client.id, {"person_id": link_request.person_id})

        # LinkRequest 상태 업데이트
        await link_request_repo.update(link_request.id, {
            "status": "approved",
            "approved_at": datetime.utcnow()
        })

        await uow.commit()
        return {"message": "승인되었습니다"}

# Repository
class ClientLinkRequestRepository:
    async def get_for_update(self, request_id: int) -> ClientLinkRequest | None:
        """ClientLinkRequest 조회 (FOR UPDATE 잠금)"""
        result = await self.session.execute(
            select(ClientLinkRequest)
            .where(ClientLinkRequest.id == request_id)
            .with_for_update()  # 잠금
        )
        return result.scalar_one_or_none()
```

**장점**:
- ✅ 동시 승인 완벽 차단
- ✅ 데이터 무결성 100% 보장
- ✅ 구현 단순

**단점**:
- ❌ 데드락 위험
- ❌ 성능 저하 (잠금 대기)
- ❌ 확장성 제한

**적용 시나리오**: MVP 단계, 동시 승인 빈도 낮음

---

#### 전략 B: 낙관적 잠금 + 재시도

**개요**: ClientLinkRequest.status 버전 관리, 충돌 시 재시도

**구현**:
```python
# ClientLinkRequest 모델 (버전 필드)
class ClientLinkRequest(Base):
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

# Handler (낙관적 잠금)
async def approve_link_request_handler(
    center_id: int,
    request_id: int,
    uow: UnitOfWork,
):
    """ClientLinkRequest 승인 (낙관적 잠금)"""
    max_retries = 3
    for attempt in range(max_retries):
        try:
            async with uow:
                link_request_repo = uow.repo(ClientLinkRequestRepository)
                client_repo = uow.repo(ClientRepository)

                # LinkRequest 조회
                link_request = await link_request_repo.get(request_id)
                if not link_request:
                    raise HTTPException(404, "연결 요청을 찾을 수 없습니다")

                if link_request.status != "pending":
                    raise HTTPException(400, f"이미 {link_request.status} 상태입니다")

                # 낙관적 잠금 업데이트
                updated = await link_request_repo.update_with_version(
                    request_id,
                    {"status": "approved", "approved_at": datetime.utcnow()},
                    expected_version=link_request.version
                )

                if not updated:
                    # 버전 충돌 → 재시도
                    continue

                # Client 업데이트
                await client_repo.update(link_request.client_id, {"person_id": link_request.person_id})

                await uow.commit()
                return {"message": "승인되었습니다"}

        except Exception as e:
            if attempt == max_retries - 1:
                raise
            await asyncio.sleep(0.1 * (attempt + 1))  # 지수 백오프

    raise HTTPException(409, "동시 승인 충돌로 실패했습니다. 다시 시도해주세요.")

# Repository
class ClientLinkRequestRepository:
    async def update_with_version(
        self,
        request_id: int,
        data: dict,
        expected_version: int
    ) -> bool:
        """낙관적 잠금 업데이트"""
        result = await self.session.execute(
            update(ClientLinkRequest)
            .where(ClientLinkRequest.id == request_id)
            .where(ClientLinkRequest.version == expected_version)
            .values(**data, version=expected_version + 1)
        )

        return result.rowcount > 0  # 업데이트 성공 여부
```

**장점**:
- ✅ 데드락 없음
- ✅ 확장성 우수
- ✅ 충돌 재시도 자동화

**단점**:
- ❌ 구현 복잡도 증가
- ❌ 재시도 로직 필요
- ❌ 충돌 빈도 높으면 성능 저하

**적용 시나리오**: 동시 승인 빈도 높음, 확장성 중요

---

### 권장 전략: 전략 A (비관적 잠금)

**이유**:
1. **MVP 단계 적합**: 구현 단순, 데이터 무결성 보장
2. **동시 승인 빈도 낮음**: ClientLinkRequest 승인은 자주 발생하지 않음
3. **확장 경로 명확**: Phase 2에서 전략 B로 전환 가능

**구현 예시**:
```python
# Repository (FOR UPDATE)
class ClientLinkRequestRepository:
    async def get_for_update(self, request_id: int) -> ClientLinkRequest | None:
        """ClientLinkRequest 조회 (FOR UPDATE 잠금)"""
        result = await self.session.execute(
            select(ClientLinkRequest)
            .where(ClientLinkRequest.id == request_id)
            .with_for_update()
        )
        return result.scalar_one_or_none()

# Handler
async def approve_link_request_handler(
    center_id: int,
    request_id: int,
    uow: UnitOfWork,
):
    """ClientLinkRequest 승인 (비관적 잠금)"""
    async with uow:
        link_request_repo = uow.repo(ClientLinkRequestRepository)
        client_repo = uow.repo(ClientRepository)

        # FOR UPDATE 잠금
        link_request = await link_request_repo.get_for_update(request_id)
        if not link_request:
            raise HTTPException(404, "연결 요청을 찾을 수 없습니다")

        if link_request.status != "pending":
            raise HTTPException(400, f"이미 {link_request.status} 상태입니다")

        # Client, LinkRequest 업데이트
        await client_repo.update(link_request.client_id, {"person_id": link_request.person_id})
        await link_request_repo.update(link_request.id, {"status": "approved", "approved_at": datetime.utcnow()})

        await uow.commit()
        return {"message": "승인되었습니다"}
```

---

## Person Soft Delete와 참조 처리

### 문제 정의

**시나리오**: Account 탈퇴 시 Person Soft Delete 처리, 하지만 Client, CenterMember는 person_id 유지하여 상담 기록 보존

**발생 조건**:
```python
# 초기 상태
Person(id=10, name="김철수", deleted_at=None)
Account(id=1, person_id=10, deleted_at=None)
Client(id=100, center_id=1, person_id=10)
Client(id=200, center_id=2, person_id=10)
CenterMember(id=1, center_id=1, person_id=10)

# Account 탈퇴
DELETE /accounts/me

# 결과
Person(id=10, deleted_at="2026-01-13T10:00:00Z")
Account(id=1, deleted_at="2026-01-13T10:00:00Z")
Client(id=100, person_id=10)  # person_id 유지
Client(id=200, person_id=10)  # person_id 유지
CenterMember(id=1, person_id=10)  # person_id 유지
```

**핵심 요구사항**:
1. Person, Account Soft Delete (개인정보보호법 준수)
2. Client, CenterMember person_id 유지 (상담 기록 보존)
3. 조회 시 Person 정보 숨김 (deleted_at 필터링)

---

### 전략: Soft Delete + 참조 유지

**구현**:

#### 1. Account 탈퇴 Handler

```python
# app/modules/auth/handlers/delete_account.py
async def delete_account_handler(
    current_account: Account = Depends(get_current_account),
    uow: UnitOfWork = Depends(get_uow),
):
    """Account 및 Person 삭제 (Soft Delete)"""
    async with uow:
        account_repo = uow.repo(AccountRepository)
        person_repo = uow.repo(PersonRepository)

        # Account Soft Delete
        await account_repo.soft_delete(current_account.id)

        # Person Soft Delete (있는 경우)
        if current_account.person_id:
            await person_repo.soft_delete(current_account.person_id)

        # Client, CenterMember는 건드리지 않음 (person_id 유지)

        await uow.commit()

    return Response(status_code=204)

# Repository
class PersonRepository:
    async def soft_delete(self, person_id: int) -> None:
        """Person Soft Delete"""
        await self.session.execute(
            update(Person)
            .where(Person.id == person_id)
            .values(deleted_at=datetime.utcnow())
        )
```

#### 2. Client 조회 시 Person 필터링

```python
# app/modules/client/repository.py
class ClientRepository:
    async def get_with_person(self, client_id: int) -> dict:
        """Client와 Person 함께 조회 (삭제된 Person 필터링)"""
        result = await self.session.execute(
            select(Client, Person)
            .outerjoin(Person, and_(
                Client.person_id == Person.id,
                Person.deleted_at.is_(None)  # 삭제 안 된 Person만
            ))
            .where(Client.id == client_id)
        )

        row = result.first()
        if not row:
            return None

        client, person = row
        return {
            "client": {
                "id": client.id,
                "name": client.name,
                "contact_phone": client.contact_phone,
            },
            "person": {
                "id": person.id,
                "name": person.name,
                "phone": person.phone,
            } if person else None  # 삭제된 경우 null
        }
```

#### 3. CenterMember 조회 시 Person 필터링

```python
# app/modules/center/repository.py
class CenterMemberRepository:
    async def get_members_by_center(self, center_id: int) -> list[dict]:
        """센터 구성원 목록 조회 (삭제된 Person 필터링)"""
        result = await self.session.execute(
            select(CenterMember, Person)
            .outerjoin(Person, and_(
                CenterMember.person_id == Person.id,
                Person.deleted_at.is_(None)  # 삭제 안 된 Person만
            ))
            .where(CenterMember.center_id == center_id)
        )

        members = []
        for member, person in result:
            members.append({
                "id": member.id,
                "center_id": member.center_id,
                "role_id": member.role_id,
                "person": {
                    "id": person.id,
                    "name": person.name,
                    "phone": person.phone,
                } if person else None  # 삭제된 경우 null
            })

        return members
```

---

### 응답 예시

#### Person 삭제 전

```json
{
  "client": {
    "id": 100,
    "name": "김철수",
    "contact_phone": "010-1234-5678"
  },
  "person": {
    "id": 10,
    "name": "김철수",
    "phone": "010-1234-5678"
  }
}
```

#### Person 삭제 후

```json
{
  "client": {
    "id": 100,
    "name": "김철수",
    "contact_phone": "010-1234-5678"
  },
  "person": null
}
```

---

### 주의사항

**GDPR 준수**:
- Person.deleted_at 설정 시 개인정보 마스킹/삭제 추가 고려
- Phase 2: 30일 후 Person 완전 삭제 (CASCADE 처리)

**UI 가이드**:
- person: null 인 경우 "탈퇴한 회원" 표시
- Client 정보는 그대로 표시 (상담 기록 보존)

---

## Person 마스킹 설정 변경 시 캐싱

### 문제 정의

**시나리오**: Account.privacy_mask_enabled 설정 변경 시, 기존 캐시된 Person 정보가 잘못된 마스킹 상태로 제공될 수 있음

**발생 조건**:
```python
# 초기 상태
Account(id=1, privacy_mask_enabled=True)
Person(id=10, name="김철수", phone="010-1234-5678")

# Redis 캐시
cache["person:10:masked"] = {"name": "김**", "phone": "010-****-5678"}

# 설정 변경
PATCH /accounts/me
{
  "privacy_mask_enabled": false
}

# 문제: 캐시된 마스킹 정보가 여전히 사용됨
GET /centers/1/clients/100  # person_id=10
→ {"person": {"name": "김**", "phone": "010-****-5678"}}  # ❌ 마스킹 해제되어야 함
```

**핵심 문제**:
1. 마스킹 설정 변경 시 캐시 무효화 필요
2. 여러 센터에서 조회한 캐시 동시 무효화
3. 캐시 키 설계 (마스킹 여부 포함)

---

### 전략 비교

#### 전략 A: 캐시 무효화 (Cache Invalidation)

**개요**: 마스킹 설정 변경 시 관련 캐시 전체 삭제

**구현**:
```python
# Account 수정 Handler (캐시 무효화)
async def update_account_handler(
    data: AccountUpdate,
    current_account: Account,
    uow: UnitOfWork,
    cache: RedisCache,
):
    """Account 수정 (캐시 무효화)"""
    async with uow:
        account_repo = uow.repo(AccountRepository)

        # Account 업데이트
        if data.privacy_mask_enabled is not None:
            await account_repo.update(current_account.id, {
                "privacy_mask_enabled": data.privacy_mask_enabled
            })

            # 캐시 무효화 (Person 관련 모든 캐시 삭제)
            if current_account.person_id:
                await cache.delete_pattern(f"person:{current_account.person_id}:*")

        await uow.commit()
        return {"message": "설정이 변경되었습니다"}
```

**장점**:
- ✅ 구현 단순
- ✅ 즉시 반영
- ✅ 데이터 일관성 보장

**단점**:
- ❌ Redis 필요
- ❌ 캐시 패턴 삭제 오버헤드

**적용 시나리오**: Redis 사용, 마스킹 설정 변경 빈도 낮음

---

#### 전략 B: 캐시 키에 마스킹 여부 포함

**개요**: 캐시 키에 마스킹 설정 포함, 설정 변경 시 자동으로 다른 캐시 사용

**구현**:
```python
# Person 조회 Service (캐시 키에 마스킹 포함)
class GetPersonService:
    async def execute(
        self,
        person_id: int,
        viewer_account_id: int,
        cache: RedisCache
    ) -> PersonResponse | PersonMasked:
        """Person 조회 (캐시 키에 마스킹 포함)"""
        # 마스킹 여부 확인
        target_account = await self.account_repo.get_by_person(person_id)
        is_owner = target_account and target_account.id == viewer_account_id
        should_mask = target_account and target_account.privacy_mask_enabled and not is_owner

        # 캐시 키 (마스킹 여부 포함)
        cache_key = f"person:{person_id}:masked={should_mask}"

        # 캐시 조회
        cached = await cache.get(cache_key)
        if cached:
            return PersonMasked(**cached) if should_mask else PersonResponse(**cached)

        # DB 조회
        person = await self.person_repo.get(person_id)
        if not person:
            raise HTTPException(404, "Person을 찾을 수 없습니다")

        # 마스킹 처리
        if should_mask:
            result = PersonMasked(
                id=person.id,
                name=self._mask_name(person.name),
                phone=self._mask_phone(person.phone),
                birth=person.birth,
                gender=person.gender
            )
        else:
            result = PersonResponse.model_validate(person)

        # 캐시 저장 (TTL 60초)
        await cache.set(cache_key, result.model_dump(), ttl=60)

        return result
```

**장점**:
- ✅ 캐시 무효화 불필요
- ✅ 자동으로 올바른 캐시 사용
- ✅ 성능 우수

**단점**:
- ❌ 캐시 중복 저장 (masked=True, masked=False 각각)
- ❌ 메모리 사용량 증가

**적용 시나리오**: Redis 메모리 충분, 마스킹 설정 변경 빈도 높음

---

#### 전략 C: 캐시 사용 안 함 (Always DB)

**개요**: Person 조회 시 항상 DB 조회, 캐시 없음

**장점**:
- ✅ 구현 최소화
- ✅ 데이터 일관성 100%
- ✅ Redis 불필요

**단점**:
- ❌ 성능 저하 (매번 DB 조회)

**적용 시나리오**: MVP 단계, Person 조회 빈도 낮음

---

### 권장 전략: 전략 C (캐시 사용 안 함)

**이유**:
1. **MVP 단계 적합**: 구현 최소화, 데이터 일관성 보장
2. **Person 조회 빈도**: CenterMember, Client 조회 시에만 발생 (빈도 낮음)
3. **PostgreSQL 성능**: JOIN 캐시로 충분히 빠름
4. **확장 경로**: Phase 2에서 전략 A 또는 B로 전환 가능

**구현 예시**:
```python
# Person 조회 Service (캐시 없음)
class GetPersonService:
    async def execute(
        self,
        person_id: int,
        viewer_account_id: int
    ) -> PersonResponse | PersonMasked:
        """Person 조회 (DB만 사용)"""
        person = await self.person_repo.get(person_id)
        if not person:
            raise HTTPException(404, "Person을 찾을 수 없습니다")

        # 마스킹 여부 확인
        target_account = await self.account_repo.get_by_person(person_id)
        is_owner = target_account and target_account.id == viewer_account_id
        should_mask = target_account and target_account.privacy_mask_enabled and not is_owner

        # 마스킹 처리
        if should_mask:
            return PersonMasked(
                id=person.id,
                name=self._mask_name(person.name),
                phone=self._mask_phone(person.phone),
                birth=person.birth,
                gender=person.gender
            )

        return PersonResponse.model_validate(person)
```

---

## CenterMember 센터별 별칭 관리 (Phase 2)

### 문제 정의

**시나리오**: 한 Person이 여러 센터의 CenterMember로 등록된 경우, 센터별로 다른 호칭/별칭을 사용하고 싶음

**발생 조건**:
```python
Person(id=10, name="김철수")
CenterMember(id=1, person_id=10, center_id=1)  # A센터: "철수님"
CenterMember(id=2, person_id=10, center_id=2)  # B센터: "김 선생님"
CenterMember(id=3, person_id=10, center_id=3)  # C센터: "Dr. Kim"
```

**기대 동작**:
- A센터 구성원 목록: "철수님" 표시
- B센터 구성원 목록: "김 선생님" 표시
- C센터 구성원 목록: "Dr. Kim" 표시
- 별칭 미설정 시 Person.name 사용

---

### 전략: display_name 필드 추가

**구현**:

#### 1. CenterMember 모델 확장

```python
# app/modules/center/models.py
class CenterMember(Base):
    __tablename__ = "center_members"

    person_id: Mapped[int] = mapped_column(ForeignKey("persons.id"), nullable=False)
    center_id: Mapped[int]
    role_id: Mapped[int]

    # Phase 2: 센터별 별칭
    display_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
```

#### 2. Migration

```python
# alembic migration
def upgrade():
    op.add_column('center_members', sa.Column('display_name', sa.String(100), nullable=True))

def downgrade():
    op.drop_column('center_members', 'display_name')
```

#### 3. CenterMember 조회 로직

```python
# app/modules/center/repository.py
class CenterMemberRepository:
    async def get_members_by_center(self, center_id: int) -> list[dict]:
        """센터 구성원 목록 조회 (별칭 우선 표시)"""
        result = await self.session.execute(
            select(CenterMember, Person)
            .join(Person, CenterMember.person_id == Person.id)
            .where(CenterMember.center_id == center_id)
            .where(Person.deleted_at.is_(None))
        )

        members = []
        for member, person in result:
            members.append({
                "id": member.id,
                "center_id": member.center_id,
                "role_id": member.role_id,
                "person": {
                    "id": person.id,
                    "name": member.display_name or person.name,  # 별칭 우선
                    "phone": person.phone,
                }
            })

        return members
```

#### 4. CenterMember 수정 API

```python
# app/modules/center/schemas.py
class CenterMemberUpdate(BaseModel):
    display_name: str | None = Field(None, max_length=100)

# Handler
async def update_member_handler(
    center_id: int,
    member_id: int,
    data: CenterMemberUpdate,
    uow: UnitOfWork,
):
    """CenterMember 별칭 수정"""
    async with uow:
        member_repo = uow.repo(CenterMemberRepository)

        member = await member_repo.get_by_id_and_center(member_id, center_id)
        if not member:
            raise HTTPException(404, "구성원을 찾을 수 없습니다")

        # 별칭 업데이트
        await member_repo.update(member.id, {"display_name": data.display_name})

        await uow.commit()
        return {"message": "별칭이 수정되었습니다"}
```

---

### 사용 예시

#### 별칭 설정

```http
PATCH /centers/1/members/1
{
  "display_name": "철수님"
}

→ CenterMember(id=1, display_name="철수님")
```

#### 조회 시 별칭 표시

```http
GET /centers/1/members

→ {
  "items": [
    {
      "id": 1,
      "person": {
        "id": 10,
        "name": "철수님",  # display_name 우선
        "phone": "010-1234-5678"
      }
    }
  ]
}
```

#### 별칭 해제

```http
PATCH /centers/1/members/1
{
  "display_name": null
}

→ CenterMember(id=1, display_name=None)

# 조회 시 Person.name 사용
GET /centers/1/members
→ {"person": {"name": "김철수"}}  # Person.name
```

---

## Account 통합 시 Person 병합

### 문제 정의

**시나리오**: 동일인이 여러 소셜 로그인으로 가입하여 중복 Account 생성, 이를 통합하면서 Person도 병합 필요

**발생 조건**:
```python
# 초기 상태
Person(id=10, name="김철수", phone="010-1111-1111")
Account(id=1, email="user@naver.com", provider="naver", person_id=10)

Person(id=20, name="김철수", phone="010-1111-1111")
Account(id=2, email="user@kakao.com", provider="kakao", person_id=20)

# 통합 요청
POST /accounts/merge
{
  "primary_account_id": 1,
  "secondary_account_id": 2
}
```

**기대 동작**:
1. Account(id=2)를 Account(id=1)에 통합
2. Person(id=20)을 Person(id=10)에 병합
3. Client, CenterMember person_id 업데이트

---

### 전략: 주 Account 유지 + 부 Person 병합

**구현**:

```python
# app/modules/auth/handlers/merge_accounts.py
async def merge_accounts_handler(
    data: MergeAccountsRequest,
    current_account: Account,
    uow: UnitOfWork,
):
    """Account 통합 (Person 병합)"""
    async with uow:
        account_repo = uow.repo(AccountRepository)
        person_repo = uow.repo(PersonRepository)
        client_repo = uow.repo(ClientRepository)
        member_repo = uow.repo(CenterMemberRepository)

        # 1. Account 확인
        primary = await account_repo.get(data.primary_account_id)
        secondary = await account_repo.get(data.secondary_account_id)

        if not primary or not secondary:
            raise HTTPException(404, "Account를 찾을 수 없습니다")

        if primary.id != current_account.id:
            raise HTTPException(403, "본인의 Account만 통합할 수 있습니다")

        # 2. Person 병합 (primary Person 유지)
        primary_person_id = primary.person_id
        secondary_person_id = secondary.person_id

        if secondary_person_id:
            # Client person_id 업데이트
            await client_repo.update_person_id(
                old_person_id=secondary_person_id,
                new_person_id=primary_person_id
            )

            # CenterMember person_id 업데이트
            await member_repo.update_person_id(
                old_person_id=secondary_person_id,
                new_person_id=primary_person_id
            )

            # secondary Person 삭제
            await person_repo.soft_delete(secondary_person_id)

        # 3. secondary Account 삭제
        await account_repo.soft_delete(secondary.id)

        await uow.commit()
        return {"message": "Account가 통합되었습니다"}

# Repository
class ClientRepository:
    async def update_person_id(self, old_person_id: int, new_person_id: int) -> None:
        """Client person_id 일괄 업데이트"""
        await self.session.execute(
            update(Client)
            .where(Client.person_id == old_person_id)
            .values(person_id=new_person_id)
        )
```

---

### 주의사항

**중복 Client 처리**:
- 동일 센터에 중복 Client 생성 가능
- UI에서 병합 또는 하나 선택하도록 안내

**데이터 정합성**:
- 트랜잭션으로 원자적 처리
- 실패 시 전체 롤백

---

## Person 변경 이력 추적 전략

### 문제 정의

**시나리오**: 규정 준수 또는 감사 목적으로 Person 정보 변경 이력 추적 필요

**발생 조건**:
```python
# Person 수정
Person(id=10, name="김철수", phone="010-1111-1111")
→ Person(id=10, name="이철수", phone="010-9999-9999")

# 추적 필요
- 누가 (account_id)
- 언제 (changed_at)
- 무엇을 (field_name)
- 어떻게 (old_value → new_value)
```

---

### 전략 비교

#### 전략 A: Audit Log 테이블

**개요**: 별도 테이블에 변경 이력 저장

**구현**:
```python
# PersonAuditLog 모델
class PersonAuditLog(Base):
    __tablename__ = "person_audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    person_id: Mapped[int] = mapped_column(ForeignKey("persons.id"), nullable=False)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    field_name: Mapped[str] = mapped_column(String(50), nullable=False)
    old_value: Mapped[str | None] = mapped_column(String(200), nullable=True)
    new_value: Mapped[str | None] = mapped_column(String(200), nullable=True)
    changed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

# Person 수정 Service (Audit 로깅)
class UpdatePersonService:
    async def execute(
        self,
        person_id: int,
        data: PersonUpdate,
        account_id: int
    ) -> Person:
        person = await self.repo.get(person_id)
        if not person:
            raise HTTPException(404, "Person을 찾을 수 없습니다")

        # Audit Log 생성
        update_data = data.model_dump(exclude_unset=True)
        for field, new_value in update_data.items():
            old_value = getattr(person, field)
            if old_value != new_value:
                await self.audit_repo.create({
                    "person_id": person_id,
                    "account_id": account_id,
                    "field_name": field,
                    "old_value": str(old_value) if old_value else None,
                    "new_value": str(new_value) if new_value else None,
                    "changed_at": datetime.utcnow()
                })

        # Person 업데이트
        updated = await self.repo.update(person_id, update_data)
        return updated
```

**장점**:
- ✅ 상세한 이력 추적
- ✅ 감사 목적 충족
- ✅ 쿼리 가능

**단점**:
- ❌ 추가 테이블 관리
- ❌ 저장 오버헤드

---

#### 전략 B: updated_at만 기록

**개요**: 변경 시각만 기록, 상세 이력 없음

**장점**:
- ✅ 구현 단순
- ✅ 오버헤드 최소

**단점**:
- ❌ 상세 이력 추적 불가

---

### 권장 전략: 전략 B (MVP) → 전략 A (Phase 2)

**MVP**: updated_at만 기록
**Phase 2**: Audit Log 테이블 추가 (규정 준수 필요 시)

---

## 대량 Person 데이터 마이그레이션

### 문제 정의

**시나리오**: 기존 시스템에서 수천~수만 건의 Person 데이터 마이그레이션

**발생 조건**:
- 기존 시스템 데이터 import
- CSV 파일 업로드
- 대량 회원 가입 (기업 계약)

---

### 전략: Bulk Insert + 트랜잭션 분할

**구현**:
```python
# app/modules/person/services/bulk_import.py
class BulkImportPersonService:
    async def execute(self, data: list[PersonCreate]) -> dict:
        """대량 Person import (배치 처리)"""
        batch_size = 1000
        total = len(data)
        imported = 0
        failed = []

        for i in range(0, total, batch_size):
            batch = data[i:i + batch_size]

            try:
                async with self.uow:
                    # Bulk insert
                    persons = [p.model_dump() for p in batch]
                    await self.repo.bulk_create(persons)

                    await self.uow.commit()
                    imported += len(batch)

            except Exception as e:
                failed.append({"batch": i, "error": str(e)})

        return {
            "total": total,
            "imported": imported,
            "failed": len(failed),
            "errors": failed
        }

# Repository
class PersonRepository:
    async def bulk_create(self, persons: list[dict]) -> None:
        """Bulk insert"""
        await self.session.execute(insert(Person), persons)
```

**장점**:
- ✅ 성능 우수 (배치 처리)
- ✅ 부분 실패 허용

**단점**:
- ❌ 트랜잭션 분할로 완전 원자성 불가

---

## 엣지 케이스 요약

### 기본 검증 (1-16)

| # | 엣지 케이스 | 검증 위치 | HTTP 코드 | 에러 메시지 |
|---|------------|----------|----------|------------|
| 1 | 이름 없이 생성 | Pydantic | 422 | 이름은 필수입니다 |
| 2 | 잘못된 전화번호 | Pydantic | 422 | 올바른 전화번호 형식이 아닙니다 |
| 3 | 잘못된 성별 | Pydantic | 422 | 성별은 male 또는 female이어야 합니다 |
| 4 | 미래 생년월일 | Service | 400 | 생년월일은 오늘 이전이어야 합니다 |
| 5 | 타인 Person 수정 | Handler | 403 | 본인의 정보만 수정할 수 있습니다 |
| 6 | 센터에서 Person 수정 | Handler | 400 | Person 정보는 본인만 수정 가능합니다 |
| 7 | 삭제된 Person 수정 | Repository | 404 | Person을 찾을 수 없습니다 |
| 8 | Person 직접 삭제 | - | 404 | Not Found |
| 9 | Account 삭제 시 Person 삭제 | Handler | 204 | - |
| 10 | 삭제된 Person과 Client 조회 | Repository | 200 | person: null |
| 11 | 마스킹 설정 조회 | Service | 200 | 김\*\*, 010-\*\*\*\*-5678 |
| 12 | Account 없는 Person | Repository | 200 | - |
| 13 | Person 없는 Account | Handler | 201 | person: null |
| 14 | 여러 Account (소셜) | Handler | 200 | - |
| 15 | 여러 센터 Client | Repository | 200 | - |
| 16 | 연결 승인 전 조회 | Repository | 200 | person: null, link_request: {...} |

### 복잡한 시나리오 (17-26)

| # | 엣지 케이스 | 권장 전략 | 적용 시나리오 |
|---|------------|----------|-------------|
| 17 | CenterMember Person 동기화 | JOIN 기반 | MVP, 센터 < 100명 |
| 18 | Client-Person 독립성 | 완전 독립 정보 관리 | 모든 단계 |
| 19 | 멀티센터 동시 수정 경합 | READ COMMITTED + 낙관적 잠금 | MVP |
| 20 | ClientLinkRequest 동시 승인 | 비관적 잠금 (FOR UPDATE) | MVP |
| 21 | Person Soft Delete 참조 | Soft Delete + 참조 유지 | GDPR 준수 |
| 22 | 마스킹 설정 캐싱 | 캐시 사용 안 함 (Always DB) | MVP |
| 23 | CenterMember 별칭 | display_name 필드 | Phase 2 |
| 24 | Account 통합 Person 병합 | 주 Account 유지 + 부 Person 병합 | Phase 2 |
| 25 | Person 변경 이력 | updated_at (MVP) → Audit Log (Phase 2) | 규정 준수 |
| 26 | 대량 데이터 마이그레이션 | Bulk Insert + 트랜잭션 분할 | 데이터 import |

---

## 참고 문서

- **메인 도메인**: `/docs/person/domain.md`
- **의사결정 기록**: `/docs/person/decision-log.md`
- **시나리오**: `/docs/person/scenarios.md`
- **Auth 엣지 케이스**: `/docs/auth/edge-cases.md`
- **Subscription 엣지 케이스**: `/docs/subscription/edge-cases.md`
