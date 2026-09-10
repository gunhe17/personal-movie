# Person 도메인 설계 의사결정 기록

> 제1원칙 기반 질문-답변을 통한 Person 도메인 설계 의사결정 과정

---

## 의사결정 일자

2026-01-13

---

## 의사결정 방식

**제1원칙(First Principles) 접근**:
1. 근본 개념부터 정의 (Person의 책임과 역할)
2. 비즈니스 요구사항을 구체적 시나리오로 검증
3. 여러 옵션 제시 후 트레이드오프 분석
4. 명시적 의사결정 및 근거 기록

---

## 질문 1: Person의 책임 범위

### 질문
Person 엔티티가 담당해야 하는 책임은 무엇인가요?

### 옵션
- **옵션 A**: 인적 정보만 (이름, 전화번호, 생년월일)
- **옵션 B**: 인적 정보 + 연락처 정보 (주소, 이메일)
- **옵션 C**: 인적 정보 + 개인 설정 (알림 설정, 언어 설정)

### 결정
**옵션 A: 인적 정보만**

### 근거
- Person은 **추상적 개념** - 실제 사람을 나타내는 메타 정보
- Account에 email 존재 → Person에 email 중복 불필요
- Client에 연락처 정보 존재 → Person에 주소 중복 불필요
- 알림 설정은 Account의 책임 (로그인 기반 설정)
- **단일 책임 원칙**: Person은 인적 정보 식별만 담당

### 구조
```python
Person:
  - name: 이름 (필수)
  - phone: 전화번호 (필수)
  - birth: 생년월일 (선택)
  - gender: 성별 (선택, male 또는 female만)
```

---

## 질문 2: Person 필수 필드

### 질문
Person 생성 시 어떤 필드가 필수인가요?

### 옵션
- **옵션 A**: name만 필수 (최소한의 정보)
- **옵션 B**: name + phone 필수 (식별 가능)
- **옵션 C**: name + phone + birth 필수 (완전한 정보)

### 결정
**옵션 B: name + phone 필수**

### 근거
- **상담센터 운영**: 연락처는 필수 (상담 일정, 긴급 연락 등)
- **실용성**: 전화번호 없이는 상담 서비스 제공 어려움
- **birth 선택**: 성인 상담 시 생년월일 불필요한 경우 고려
- **개인정보 최소화**: 필요한 정보만 수집 (gender는 선택)

### 필드 정의
```python
Person:
  - name: Mapped[str]  # 필수
  - phone: Mapped[str]  # 필수
  - birth: Mapped[date | None]  # 선택
  - gender: Mapped[str | None]  # 선택 (male, female)
```

---

## 질문 3-1: Person-Account 관계

### 질문
Person과 Account의 관계는?

### 옵션
- **옵션 A**: 1:1 필수 (모든 Person은 Account 보유)
- **옵션 B**: 1:1 선택적 (Person.account_id nullable)
- **옵션 C**: 1:N (한 Person이 여러 Account - 소셜 로그인)

### 결정
**옵션 B: 1:1 선택적**

### 근거
- Account는 Person 없이 존재 가능 (시스템 관리자)
- Person은 Account 없이 존재 가능 (아동 내담자)
- 소셜 로그인: 동일 Person에 여러 provider 지원은 Account 레벨에서 처리
  ```python
  Account(email="user@naver.com", provider="naver", person_id=10)
  Account(email="user@kakao.com", provider="kakao", person_id=10)
  ```

### 구조
```python
# Account → Person (단방향 FK)
class Account(Base):
    person_id: Mapped[int | None] = mapped_column(
        ForeignKey("persons.id"),
        nullable=True
    )

# Person (FK 없음, relationship만)
class Person(Base):
    account: Mapped["Account"] = relationship(back_populates="person")
```

---

## 질문 3-2: Person → Account 역방향 FK

### 질문
Person 테이블에 account_id FK가 필요한가요?

### 옵션
- **옵션 A**: 필요 (양방향 FK)
- **옵션 B**: 불필요 (단방향 FK + relationship)

### 결정
**옵션 B: 불필요**

### 근거
- **Account → Person 단방향으로 충분**: Account에서 Person 참조
- **순환 참조 방지**: 양방향 FK는 데이터 정합성 복잡도 증가
- **SQLAlchemy relationship으로 해결**:
  ```python
  class Person(Base):
      account: Mapped["Account"] = relationship(back_populates="person")

  # 역방향 조회
  person.account  # Account 객체 자동 조회
  ```
- **데이터베이스 무결성**: 한 방향 FK만으로 충분

---

## 질문 4-1: Person-Client 관계

### 질문
Person과 Client의 관계는?

### 옵션
- **옵션 A**: 1:1 (한 Person은 한 센터에만 Client)
- **옵션 B**: 1:N (한 Person이 여러 센터에 Client)
- **옵션 C**: 독립적 (Client는 Person 없이 존재 가능)

### 결정
**옵션 C: 독립적 (1:N 관계 지원)**

### 근거
- **멀티센터 지원**: 한 Person이 여러 센터 이용 가능
  ```python
  Person(id=10, name="김철수")
  Client(id=100, center_id=1, person_id=10)  # 서울센터
  Client(id=200, center_id=2, person_id=10)  # 부산센터
  ```
- **센터 독립성**: Client는 센터 내부 데이터, Person 연결은 선택적
- **유연성**: Client 생성 시 Person 없이도 가능 (나중에 연결)

### 구조
```python
class Client(Base):
    person_id: Mapped[int | None] = mapped_column(
        ForeignKey("persons.id"),
        nullable=True  # Person 없이도 Client 생성 가능
    )
```

---

## 질문 4-2: Client.person_id nullable

### 질문
Client.person_id를 nullable로 유지해야 하나요?

### 옵션
- **옵션 A**: nullable=False (Person 필수)
- **옵션 B**: nullable=True (Person 선택)

### 결정
**옵션 B: nullable=True**

### 근거
- **시나리오 B 지원** (Client 등록 후 회원가입):
  ```
  1. 센터에서 Client 생성 (person_id=null)
  2. 보호자가 앱 다운로드 후 회원가입
  3. Person 생성 → Account 생성
  4. ClientLinkRequest로 연결 승인
  5. Client.person_id 업데이트
  ```
- **센터 독립성**: Client는 센터 내부 데이터, Person 연결은 선택적
- **유연성**: Account 없는 내담자(아동) 관리 가능

---

## 질문 5: Person 생성 시점

### 질문
Person은 언제 생성되나요?

### 옵션
- **옵션 A**: Account 생성 시 자동 생성 (회원가입)
- **옵션 B**: Client 생성 시 자동 생성 (내담자 등록)
- **옵션 C**: 명시적 생성 후 연결 (독립적)

### 결정
**옵션 A: Account 생성 시 자동 생성**

### 근거
- **일관성**: Account와 Person은 항상 함께 생성
- **단순성**: Person 독립 생성 API 불필요
- **시나리오 지원**:
  - 시나리오 A (멤버 초대): Person + Account 함께 생성
  - 시나리오 B (Client 후 회원가입): 회원가입 시 Person 생성
  - 시나리오 C (직접 회원가입): Person + Account 함께 생성

### 시나리오별 흐름
```python
# 시나리오 A - 센터 멤버 초대
POST /centers/1/members
{
  "email": "staff@example.com",
  "person": { "name": "김직원", "phone": "010-1234-5678" },
  "role_id": 3
}
→ Person 생성 → Account 생성 → CenterMember 생성

# 시나리오 B - Client 등록 후 회원가입
1. POST /centers/1/clients
   { "name": "김아이", "contact_phone": "010-1111-1111" }
   → Client 생성 (person_id=null)

2. POST /auth/signup
   { "email": "parent@example.com", "person": { "name": "김보호자" } }
   → Person 생성 → Account 생성

3. POST /centers/1/client-link-requests
   { "client_id": 100, "person_id": 10 }
   → 센터 승인 후 Client.person_id 업데이트

# 시나리오 C - 직접 회원가입
POST /auth/signup
{ "email": "user@example.com", "person": { "name": "김철수" } }
→ Person 생성 → Account 생성
```

---

## 질문 6: Person 정보 수정 권한

### 질문
누가 Person 정보를 수정할 수 있나요?

### 옵션
- **옵션 A**: 본인만 (Account 소유자)
- **옵션 B**: 본인 + 센터 관리자
- **옵션 C**: 본인 + 센터 관리자 + 센터 직원

### 결정
**옵션 A: 본인만 (Account 소유자)**

### 근거
- **Person은 전역적**: 한 센터의 수정이 다른 센터에 영향
  ```python
  # 서울센터에서 Person.phone 수정
  Person(id=10, phone="010-1111-1111" → "010-2222-2222")

  # 부산센터의 Client도 영향받음
  Client(id=200, center_id=2, person_id=10)
  → 전화번호 변경됨
  ```
- **개인정보 보호**: 본인만 개인정보 수정 권한
- **데이터 무결성**: 충돌 방지 (센터 A 수정 vs 센터 B 수정)

### API 설계
```http
# ✅ 본인 수정
PATCH /accounts/me
{
  "person": {
    "name": "이철수",
    "phone": "010-9999-9999"
  }
}

# ❌ 센터에서 수정 불가
PATCH /centers/1/clients/100
{
  "person": { "phone": "010-9999-9999" }
}
→ 400 Bad Request: "Person 정보는 본인만 수정 가능합니다"
```

---

## 질문 7: Person 삭제 정책

### 질문
Person을 삭제할 수 있나요?

### 옵션
- **옵션 A**: Hard Delete (DB에서 완전 삭제)
- **옵션 B**: Soft Delete (deleted_at 플래그)
- **옵션 C**: 삭제 불가 (비활성화만)

### 결정
**옵션 B: Soft Delete**

### 근거
- **법적 요구사항**: 개인정보보호법 - 삭제 요청 시 처리 필요
- **상담 기록 보존**: 법적 보존 기간 동안 연결 유지
- **데이터 무결성**: Foreign Key 참조 보호
  ```python
  # Soft Delete
  Person(id=10, deleted_at="2026-01-13T10:00:00Z")

  # Client, CenterMember는 유지
  Client(id=100, person_id=10)  # person_id는 유지, 조회 시 필터링
  ```
- **복구 가능성**: 실수로 삭제 시 복구 가능

### 구현
```python
class Person(Base):
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

# Repository
async def get_active_persons(self):
    return await self.session.execute(
        select(Person).where(Person.deleted_at.is_(None))
    )
```

---

## 질문 8: Person 중복 방지

### 질문
동일 인물의 Person 중복 생성을 어떻게 방지하나요?

### 옵션
- **옵션 A**: phone unique (전화번호로 식별)
- **옵션 B**: (name, birth) unique
- **옵션 C**: 중복 허용 (센터가 판단)

### 결정
**옵션 C: 중복 허용**

### 근거
- **동명이인 존재**: 이름 + 생년월일 같은 경우 존재
- **전화번호 변경**: phone은 변경 가능 → unique constraint 부적합
- **phone nullable**: 전화번호 없는 Person 허용 → unique constraint 불가
- **센터 판단**: 센터에서 ClientLinkRequest로 연결 승인 시 중복 확인

### 중복 체크 로직
```python
# Application Level (선택적)
class CheckDuplicatePersonService:
    """Person 중복 체크 (경고용)"""

    async def execute(self, name: str, phone: str | None) -> list[Person]:
        """유사한 Person 조회 (중복 가능성)"""
        if not phone:
            return []

        # phone으로 조회
        persons = await self.repo.find_by_phone(phone)
        return persons

# ClientLinkRequest 승인 시 센터에서 확인
# "이미 동일 전화번호의 Person이 있습니다. 연결하시겠습니까?"
```

---

## 질문 9-1: Person 개인정보 보호 - 암호화

### 질문
Person 테이블의 민감 정보를 어떻게 보호하나요?

### 옵션
- **옵션 A**: DB 레벨 암호화
- **옵션 B**: Application 레벨 암호화
- **옵션 C**: 하이브리드 (DB + Application)

### 결정
**옵션 C: 하이브리드 (Phase 2)**

### 근거
- **Phase 1 (MVP)**: 접근 제어만 (권한 기반)
- **Phase 2**: Application 레벨 암호화 추가
  - phone, birth 암호화
  - name은 검색 필요 → 해시 인덱스
- **DB 레벨 암호화**: 백업 파일 보호 (인프라 레벨)

### 구현 계획
```python
# Phase 1: 접근 제어만
@require_permission("person:read")
async def get_person(person_id: int):
    ...

# Phase 2: Application 암호화
from cryptography.fernet import Fernet

class Person(Base):
    phone_encrypted: Mapped[bytes | None]  # 암호화된 전화번호
    birth_encrypted: Mapped[bytes | None]  # 암호화된 생년월일

    @property
    def phone(self) -> str | None:
        if not self.phone_encrypted:
            return None
        return decrypt(self.phone_encrypted)
```

---

## 질문 9-2: Person 개인정보 보호 - 마스킹

### 질문
조회 시 마스킹을 적용하나요?

### 옵션
- **옵션 A**: 사용자 설정 기반 마스킹
- **옵션 B**: 권한 기반 자동 마스킹
- **옵션 C**: API 파라미터로 제어

### 결정
**옵션 A: 사용자 설정 기반 마스킹**

### 근거
- **사용자 선택권**: 개인정보 노출 여부를 사용자가 결정
- **Account 설정**: `privacy_mask_enabled: bool` 필드 추가
- **본인 조회 시**: 마스킹 없음 (항상 전체 정보)

### 구현
```python
# Account 테이블
class Account(Base):
    privacy_mask_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=False,  # 기본값: 마스킹 안 함
        nullable=False
    )

# Service Layer
class GetPersonService:
    async def execute(
        self,
        person_id: int,
        viewer_account_id: int
    ) -> PersonResponse:
        person = await self.repo.get(person_id)
        viewer_account = await self.account_repo.get(viewer_account_id)

        # 본인 조회: 마스킹 없음
        if person.account_id == viewer_account_id:
            return PersonResponse.model_validate(person)

        # 타인 조회: 설정에 따라 마스킹
        if viewer_account.privacy_mask_enabled:
            return PersonResponse(
                name=mask_name(person.name),  # 김**
                phone=mask_phone(person.phone),  # 010-****-5678
                birth=person.birth  # 생년월일은 마스킹 안 함
            )

        return PersonResponse.model_validate(person)
```

---

## 질문 10: Person API 설계

### 질문
Person CRUD API를 어떻게 노출하나요?

### 옵션
- **옵션 A**: 독립 API (`/persons/*`)
- **옵션 B**: Account 하위 (`/accounts/{id}/person`)
- **옵션 C**: 노출 안 함 (Account API에 포함)

### 결정
**옵션 C: 노출 안 함 (Account API에 포함)**

### 근거
- **Person은 추상적 개념**: 직접 조작 대상이 아님
- **Account의 하위 리소스**: Person은 Account를 통해서만 수정
- **단순성**: `/persons/*` API 불필요, 복잡도 감소
- **권한 명확**: Account를 통해서만 수정 가능

### API 설계
```http
# 1. Account 생성 시 Person 함께 생성
POST /auth/signup
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

# 2. Account 조회 시 Person 포함
GET /accounts/me
→ {
  "account": { "id": 1, "email": "..." },
  "person": { "id": 10, "name": "김철수", ... }
}

# 3. Account 수정 시 Person 수정
PATCH /accounts/me
{
  "person": {
    "name": "이철수",
    "phone": "010-9999-9999"
  }
}

# 4. Client 조회 시 Person 포함 (읽기 전용)
GET /centers/{center_id}/clients/{client_id}
→ {
  "client": { ... },
  "person": { "name": "김**", "phone": "010-****-5678" }  # 마스킹
}
```

---

---

## 질문 11: CenterMember vs Client 정보 관리 전략

### 질문
CenterMember와 Client는 Person 정보를 어떻게 관리해야 하나요?

### 배경
- **CenterMember**: 바로 Person과 연결 (회원가입 후 즉시)
- **Client**: 독립적으로 생성 후 나중에 Person 연결 (선택적)

두 엔티티의 정보 관리 주체가 달라야 하는지 검토 필요

### 옵션

#### 옵션 A: 둘 다 Person 중심
```python
CenterMember:
  person_id: int  # NOT NULL
  # name, phone 없음 → Person 참조

Client:
  person_id: int  # nullable
  # name, phone 없음 → Person 참조
  # person_id 없으면 정보 없음
```

**장점**: 일관성, 중복 없음
**단점**: Client는 Person 없이 생성 불가능 (치명적)

#### 옵션 B: 둘 다 독립적
```python
CenterMember:
  person_id: int
  name: str
  phone: str

Client:
  person_id: int | None
  name: str
  contact_phone: str
```

**장점**: 유연함
**단점**: Person 수정 시 CenterMember도 수동 업데이트 필요 (복잡성 증가)

#### 옵션 C: 하이브리드 (CenterMember는 Person, Client는 독립)
```python
CenterMember:
  person_id: int  # NOT NULL
  # name, phone 없음 → Person 참조

Client:
  person_id: int | None
  name: str
  contact_phone: str
  # Person 연결은 권한/식별용만
```

**장점**: 각 엔티티 특성에 맞는 전략
**단점**: 일관성 부족

### 결정
**옵션 C: 하이브리드 (CenterMember는 Person 중심, Client는 독립)**

### 근거

#### CenterMember → Person 중심
1. **즉시 연결**: 회원가입 후 바로 Person 생성되므로 항상 연결됨
2. **멀티센터 일관성**: Person 수정 시 모든 센터에 자동 반영 (원하는 동작)
3. **단순성**: 중복 정보 없음, Person만 수정하면 됨
4. **정보 주체**: 본인 (Account 소유자)

**구조**:
```python
class CenterMember(Base):
    person_id: Mapped[int] = mapped_column(ForeignKey("persons.id"), nullable=False)
    center_id: Mapped[int]
    role_id: Mapped[int]
    # name, phone 필드 없음!

# 조회 시 항상 Person JOIN
{
  "member": {
    "name": person.name,      # Person에서
    "phone": person.phone,    # Person에서
    "role": "센터장"
  }
}
```

#### Client → 독립적
1. **선행 생성**: Person 없이 먼저 생성 가능 (센터가 내담자 등록)
2. **별칭 지원**: Client.name ≠ Person.name 허용 ("김아이" vs "김철수")
3. **센터 관리**: 센터가 Client 정보 자유롭게 수정
4. **정보 주체**: 센터

**구조**:
```python
class Client(Base):
    person_id: Mapped[int | None] = mapped_column(ForeignKey("persons.id"), nullable=True)
    name: Mapped[str]  # Client 자체 정보
    contact_phone: Mapped[str]  # Client 자체 정보
    birth: Mapped[date | None]

# Person 연결은 권한/식별용만
{
  "client": {
    "name": "김아이",           # Client.name
    "contact_phone": "010-1111-1111"
  },
  "linked_person": {
    "id": 10,
    "name": "김철수"            # Person.name (참고용)
  }
}
```

### 비즈니스 시나리오 검증

#### 시나리오 1: 구성원 전화번호 변경
```python
Person(id=10, name="김철수", phone="010-1111-1111")
CenterMember(person_id=10, center_id=1)  # A센터
CenterMember(person_id=10, center_id=2)  # B센터

# 김철수가 본인 정보 수정
PATCH /accounts/me
{ "person": { "phone": "010-9999-9999" } }

# 결과: A센터, B센터 모두 자동 반영 ✅
```

#### 시나리오 2: 내담자 정보 변경
```python
Client(id=100, name="김아이", contact_phone="010-1111-1111")

# 센터에서 연락처 변경
PATCH /centers/1/clients/100
{ "contact_phone": "010-2222-2222" }

# 결과: Client.contact_phone만 변경, Person 영향 없음 ✅
```

#### 시나리오 3: 내담자-Person 연결 후
```python
# 초기
Client(id=100, name="김아이", person_id=None)

# Person 연결 후
Client(id=100, name="김아이", person_id=10)
Person(id=10, name="김철수")

# Client.name ≠ Person.name 허용 (별칭) ✅
# 센터는 계속 "김아이"로 표시
# Person은 "김철수" (실명)
```

### 에지 케이스 처리

**CenterMember**:
- Person soft delete → CenterMember 접근 불가 (person_id FK 제약)
- 센터에서 구성원 정보 수정 불가 → 본인에게 요청

**Client**:
- Person soft delete → Client 유지, person: null
- 센터에서 Client 정보 자유롭게 수정 가능
- Person 연결은 권한 확인용

### Phase 2 고려사항

**CenterMember 센터별 별칭** (선택적):
```python
class CenterMember(Base):
    person_id: Mapped[int]
    display_name: Mapped[str | None]  # 센터별 별칭

# 조회 시
{
  "name": member.display_name or person.name,  # 별칭 우선
  "legal_name": person.name  # 실명 (참고)
}
```

---

## 의사결정 요약표

| # | 질문 | 결정 | Phase |
|---|------|------|-------|
| 1 | Person 책임 범위 | 인적 정보만 (이름, 전화번호, 생년월일) | Phase 1 |
| 2 | 필수 필드 | name만 필수, 나머지 선택 | Phase 1 |
| 3-1 | Account 관계 | 1:1 선택적 (Person.account_id nullable) | Phase 1 |
| 3-2 | 역방향 FK | 불필요 (relationship만) | Phase 1 |
| 4-1 | Client 관계 | 독립적 (1:N 지원) | Phase 1 |
| 4-2 | Client.person_id | nullable=True | Phase 1 |
| 5 | 생성 시점 | Account 생성 시 자동 | Phase 1 |
| 6 | 수정 권한 | 본인만 (Account 소유자) | Phase 1 |
| 7 | 삭제 정책 | Soft Delete (deleted_at) | Phase 1 |
| 8 | 중복 방지 | 중복 허용 (센터 판단) | Phase 1 |
| 9-1 | 암호화 | 하이브리드 (Phase 2) | Phase 2 |
| 9-2 | 마스킹 | 사용자 설정 기반 | Phase 1 |
| 10 | API 노출 | Account API에 포함 | Phase 1 |
| 11 | CenterMember vs Client 정보 관리 | 하이브리드 (CenterMember는 Person 중심, Client는 독립) | Phase 1 |

---

## 참고 문서

- **Person 도메인**: `/docs/person/domain.md`
- **Auth 도메인**: `/docs/auth/domain.md`
- **Client 도메인**: `/docs/client/domain.md`
- **Center 도메인**: `/docs/center/domain.md`
- **전체 아키텍처**: `/CLAUDE.md`
