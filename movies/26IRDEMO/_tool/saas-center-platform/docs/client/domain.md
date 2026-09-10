# Client 도메인 설계

> 내담자(Client) 및 보호자 관리 도메인 (Client.role 기반)

---

## 핵심 개념

### 센터별 독립 관리
- Client는 **센터별로 완전히 독립**되어 관리
- Person 연동은 인증/식별 목적만 (데이터 동기화 없음)
- 같은 Person이 여러 센터에서 다른 이름/전화번호 가능

### Client role 기반 관리
- **Client.role 필드**로 역할 구분
  - `"client"`: 상담 대상 (내담자)
  - `"guardian"`: 보호자 (정보만, 앱 미사용 또는 앱 사용)
  - `"both"`: 보호자이면서 내담자 (두 역할 병행)
- **Person 연동 일관성**: 앱 사용 시 항상 `Client.person_id` 설정
- **전화번호 기반 재사용**: 형제 등록 시 보호자 Client 중복 입력 방지

---

## 도메인 엔티티 (5개)

### 1. Client (내담자/보호자 통합)

```python
class Client(Base):
    """내담자 및 보호자 - 센터별 독립 관리"""
    id: Mapped[str]                    # UUID
    center_id: Mapped[int]             # 센터 ID
    person_id: Mapped[str | None]      # Person 연동 (nullable)

    # 역할 구분
    role: Mapped[str]                  # "client" | "guardian" | "both"

    # 기본 정보
    name: Mapped[str]
    birth_date: Mapped[date | None]
    gender: Mapped[str | None]         # "male" | "female"

    # 연락처 (센터 소유)
    phone: Mapped[str | None]
    email: Mapped[str | None]
    address: Mapped[str | None]

    # 상태 관리
    status: Mapped[str]                # "active" | "inactive" | "archived"

    # 메모
    memo: Mapped[str | None]

    # 타임스탬프
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]
    deleted_at: Mapped[datetime | None]
```

**핵심 규칙**:
- center_id 필수 (다중 테넌시)
- person_id는 nullable (앱 미사용 보호자는 NULL)
- role 필드로 역할 구분:
  - `"client"`: 상담 대상 (내담자만)
  - `"guardian"`: 보호자만 (앱 사용/미사용 모두 포함)
  - `"both"`: 보호자이면서 내담자 (두 역할 병행)
- 연락처는 센터가 직접 관리 (Person 변경에 영향 없음)
- 상태 전이: active ↔ inactive ↔ archived

**role별 사용 케이스**:
```python
# role="guardian", person_id=NULL
# → 앱 미사용 보호자 (정보만 저장)
Client(role="guardian", person_id=None, phone="010-1111-1111")

# role="guardian", person_id=P1
# → 앱 사용 보호자 (자녀 상담 기록 조회 가능)
Client(role="guardian", person_id="P1", phone="010-1111-1111")

# role="client", person_id=NULL
# → 아동 내담자 (앱 미사용)
Client(role="client", person_id=None, name="김아이")

# role="both", person_id=P1
# → 보호자이면서 본인도 상담받음
Client(role="both", person_id="P1", phone="010-2222-2222")
```

---

### 2. ClientRelation (보호자-자녀 관계)

```python
class ClientRelation(Base):
    """Client 간 관계 (보호자-자녀, 형제 등)"""
    id: Mapped[str]                    # UUID
    center_id: Mapped[int]             # 센터 ID

    # 관계
    client_id: Mapped[str]             # Client FK
    related_client_id: Mapped[str]     # Client FK (관계 대상)

    # 관계 유형
    relation_type: Mapped[str]         # "guardian" | "child"
    relation_detail: Mapped[str | None]  # "mother" | "father" | "grandmother" | "social_worker" | ...
    is_primary: Mapped[bool]           # 주 보호자 여부 (guardian만)

    # 타임스탬프
    created_at: Mapped[datetime]
```

**핵심 규칙**:
- **guardian-child 관계**: relation_type으로 역할/방향 구분
  - `"guardian"`: client_id가 자녀, related_client_id가 보호자
  - `"child"`: client_id가 보호자, related_client_id가 자녀
- **relation_detail**: 보호자의 실제 관계 (nullable, guardian만 사용)
  - **혈연 관계**: `"mother"`, `"father"`, `"grandmother"`, `"grandfather"`, `"aunt"`, `"uncle"`
  - **비혈연 보호자**: `"social_worker"`, `"foster_parent"`, `"legal_guardian"`, `"caregiver"`
  - `null`: 미지정 (기타 보호자)
- **is_primary**: 주 보호자 지정 (자녀당 1개만, guardian만)
- **양방향 관계 필수**: (A→B, guardian) + (B→A, child) 모두 생성
- **센터 간 관계 금지**: client와 related_client 모두 같은 center_id
- **자기 참조 금지**: client_id ≠ related_client_id

**관계 패턴**:
```python
# 엄마 ↔ 자녀 (양방향)
ClientRelation(
    client_id=child,
    related_client_id=mom,
    relation_type="guardian",
    relation_detail="mother",
    is_primary=True
)
ClientRelation(
    client_id=mom,
    related_client_id=child,
    relation_type="child",
    relation_detail=None  # child 방향은 detail 불필요
)

# 아빠 ↔ 자녀 (양방향)
ClientRelation(
    client_id=child,
    related_client_id=dad,
    relation_type="guardian",
    relation_detail="father",
    is_primary=False
)
ClientRelation(
    client_id=dad,
    related_client_id=child,
    relation_type="child",
    relation_detail=None
)

# 할머니 ↔ 손자 (양방향)
ClientRelation(
    client_id=grandchild,
    related_client_id=grandma,
    relation_type="guardian",
    relation_detail="grandmother",
    is_primary=False
)
ClientRelation(
    client_id=grandma,
    related_client_id=grandchild,
    relation_type="child",
    relation_detail=None
)

# 사회복지사 ↔ 아동 (비혈연 보호자)
ClientRelation(
    client_id=child,
    related_client_id=social_worker,
    relation_type="guardian",
    relation_detail="social_worker",
    is_primary=True
)
ClientRelation(
    client_id=social_worker,
    related_client_id=child,
    relation_type="child",
    relation_detail=None
)
```

---

### 3. SiblingRelation (형제자매 관계)

```python
class SiblingRelation(Base):
    """형제자매 관계 (양방향 저장)"""
    id: Mapped[str]                    # UUID
    center_id: Mapped[int]             # 센터 ID

    # 관계
    client_id: Mapped[str]             # Client FK
    sibling_id: Mapped[str]            # Client FK (형제자매)

    # 관계 상세
    relation_detail: Mapped[str | None]  # "older_brother" | "younger_sister" | ...

    # 타임스탬프
    created_at: Mapped[datetime]
```

**핵심 규칙**:
- **양방향 저장**: (A, B) + (B, A) 모두 생성
- **relation_detail 자동 추론**: birth_date + gender로 "형", "누나", "동생" 등 판단
- **센터 내에서만**: 같은 center_id만 허용
- **자기 참조 금지**: client_id ≠ sibling_id

**자동 추론 로직**:
```python
def infer_relation_detail(from_client: Client, to_client: Client) -> str:
    """생년월일 + 성별로 관계 자동 추론"""
    is_older = from_client.birth_date < to_client.birth_date

    if from_client.gender == "male":
        return "older_brother" if is_older else "younger_brother"
    elif from_client.gender == "female":
        return "older_sister" if is_older else "younger_sister"
    else:
        return "sibling"  # 성별 불명
```

**예시**:
```python
# 첫째 (2015-03-15, female) ↔ 둘째 (2018-07-10, male)
SiblingRelation(
    client_id=첫째,
    sibling_id=둘째,
    relation_detail="older_sister"  # 첫째 입장
)
SiblingRelation(
    client_id=둘째,
    sibling_id=첫째,
    relation_detail="younger_brother"  # 둘째 입장
)
```

---

### 4. ClientLinkRequest (Person-Client 연동 요청)

```python
class ClientLinkRequest(Base):
    """Person이 Client와 연동 요청"""
    id: Mapped[str]                    # UUID
    center_id: Mapped[int]             # 센터 ID
    person_id: Mapped[str]             # Person FK

    # 매칭 정보
    phone: Mapped[str]                 # 매칭 키 (Person.phone)
    client_id: Mapped[str | None]      # 승인 시 설정

    # 상태
    status: Mapped[str]                # "pending" | "approved" | "rejected"

    # 타임스탬프
    requested_at: Mapped[datetime]
    processed_at: Mapped[datetime | None]
```

**핵심 규칙**:
- Person이 앱에서 센터 코드 + 전화번호로 연동 요청
- 센터는 전화번호로 Client 검색 → 후보 제시
- 센터 관리자가 수동 승인/거부
- 승인 시: Client.person_id 설정
- **1 Person = 1 Client (센터당)**: 중복 연동 금지

---

### 5. ClientUnlinkLog (연동 해제 이력)

```python
class ClientUnlinkLog(Base):
    """Person-Client 연동 해제 이력"""
    id: Mapped[str]                    # UUID
    client_id: Mapped[str]             # Client FK
    person_id: Mapped[str]             # Person FK

    # 해제 정보
    reason: Mapped[str | None]         # 해제 사유
    unlinked_at: Mapped[datetime]      # 해제 시각
```

**핵심 규칙**:
- 연동 해제 시 이력 보존 (audit trail)
- 재연동 시 정책 판단 근거
- Client 삭제와 무관 (이력 보존)

---

## 비즈니스 규칙

### 1. Client role 관리

**role 전환 규칙**:
```python
# guardian → both (보호자가 상담 필요 시)
client.role = "both"

# both → client (자녀가 성년이 되어 보호자 역할 종료)
client.role = "client"
```

**제약**:
- ❌ `"client" → "guardian"` 직접 전환 금지 (의미상 불가)
- ✅ `"guardian" → "both"` 허용 (상담 추가)
- ✅ `"both" → "client"` 허용 (보호자 역할 종료)

---

### 2. ClientRelation 관리

**주 보호자 규칙**:
- 자녀당 is_primary=true는 1개만
- is_primary=true인 relation은 반드시 relation_type="guardian"
- 주 보호자 변경 시 기존 is_primary=false로 변경 (트랜잭션)

**양방향 관계**:
```python
# 생성 시 양방향 자동 생성
create_relation(child, guardian, "guardian", relation_detail="mother", is_primary=True)
→ ClientRelation(child→guardian, "guardian", "mother", is_primary=True)
→ ClientRelation(guardian→child, "child", None, is_primary=False)
```

**센터 간 관계 금지**:
```python
# 검증
if client.center_id != related_client.center_id:
    raise ValueError("Cross-center relations not allowed")
```

---

### 3. SiblingRelation 관리

**양방향 자동 생성**:
```python
create_sibling_relation(client_a, client_b)
→ SiblingRelation(client_a→client_b, relation_detail=추론)
→ SiblingRelation(client_b→client_a, relation_detail=추론)
```

**relation_detail 자동 추론**:
- birth_date + gender 기반
- 추론 불가 시 "sibling" 기본값

---

### 4. Person 연동 관리

**연동 프로세스**:
1. Person 회원가입 (앱)
2. 센터 코드 + 전화번호로 연동 요청
3. 전화번호로 Client 검색 → 후보 제시
4. 센터 관리자 승인
5. Client.person_id 설정

**중복 연동 방지**:
```python
# 검증
existing = await client_repo.get_by_person_and_center(person_id, center_id)
if existing:
    raise ValueError("Person already linked to a client in this center")
```

---

### 5. 상태 관리

**ALLOWED_TRANSITIONS**:
```python
{
    "active": ["inactive"],
    "inactive": ["active", "archived"],
    "archived": ["active"]
}
```

**상태 의미**:
- `active`: 현재 상담 중 또는 활성 상태
- `inactive`: 상담 종료, 장기 미방문 (6개월 이내)
- `archived`: 장기 미방문 (6개월 이상)

**자동 전환 (배치)**:
- inactive → archived: 6개월 경과 시

---

### 6. 삭제 정책

**소프트 삭제 기본**:
```python
# 관련 데이터 확인
has_counselings = await counseling_repo.exists_for_client(client_id)

if has_counselings:
    # 소프트 삭제만 가능
    client.deleted_at = datetime.utcnow()
else:
    # 하드 삭제 가능
    await client_repo.delete(client_id)
```

**CASCADE 삭제**:
- ClientRelation: Client 삭제 시 자동 삭제
- SiblingRelation: Client 삭제 시 자동 삭제

**유지**:
- ClientLinkRequest: 이력 보존
- ClientUnlinkLog: 이력 보존
- Counseling/Assessment: 이력 보존

---

### 7. 전화번호 기반 재사용

**순차 등록 시**:
```python
# 1. 첫째 등록 → 엄마 Client 생성 (role="guardian")
mom = Client(name="김엄마", phone="010-1111-1111", role="guardian")

# 2. 둘째 등록 → 전화번호로 엄마 검색
GET /centers/1/clients/search?phone=010-1111-1111&role=guardian
→ [mom] 반환

# 3. 기존 엄마 Client 재사용
ClientRelation(child=둘째, related_client_id=mom.id, relation_type="guardian", relation_detail="mother")
```

**장점**:
- 보호자 중복 입력 방지
- 전화번호 변경 시 한 번만 수정
- 모든 자녀 관계 조회 용이

---

## 데이터 무결성

### 제약 조건 (Application Level)

**모듈러 모놀리스 원칙**:
- FK/Enum 제약 없음 (DB 레벨)
- Application level에서 관리

**검증 항목**:
```python
# Client
- UNIQUE(center_id, person_id) WHERE person_id IS NOT NULL
- role IN ("client", "guardian", "both")
- status IN ("active", "inactive", "archived")

# ClientRelation
- UNIQUE(client_id, related_client_id, relation_type)
- CHECK(client_id != related_client_id)
- CHECK(client.center_id = related_client.center_id)
- COUNT(is_primary=true) <= 1 per child_id

# SiblingRelation
- UNIQUE(client_id, sibling_id)
- CHECK(client_id != sibling_id)
- CHECK(client.center_id = sibling.center_id)
```

---

## 주요 시나리오

### 시나리오 1: 첫째 아동 등록

```python
# 1. 엄마 Client 생성 (role="guardian")
mom = Client(
    center_id=1,
    name="김엄마",
    phone="010-1111-1111",
    role="guardian",
    person_id=None  # 앱 미사용
)

# 2. 첫째 Client 생성 (role="client")
child1 = Client(
    center_id=1,
    name="김첫째",
    birth_date="2015-03-15",
    gender="female",
    role="client"
)

# 3. 관계 생성 (양방향)
ClientRelation(child1, mom, "guardian", "mother", is_primary=True)
ClientRelation(mom, child1, "child", None)
```

---

### 시나리오 2: 둘째 순차 등록 (보호자 재사용)

```python
# 1. 전화번호로 엄마 검색
moms = await client_repo.search_by_phone_and_role(
    center_id=1,
    phone="010-1111-1111",
    role="guardian"
)
# → [mom] 반환

# 2. 둘째 Client 생성
child2 = Client(
    center_id=1,
    name="김둘째",
    birth_date="2018-07-10",
    gender="male",
    role="client"
)

# 3. 기존 엄마와 관계 생성 (재사용)
ClientRelation(child2, mom, "guardian", "mother", is_primary=True)
ClientRelation(mom, child2, "child", None)

# 4. 형제 관계 생성 (양방향 자동)
SiblingRelation(child1, child2, "older_sister")
SiblingRelation(child2, child1, "younger_brother")
```

---

### 시나리오 3: 보호자 앱 사용 (Person 연동)

```python
# 1. 보호자 회원가입 (앱)
Person(id=P1, phone="010-1111-1111")

# 2. 연동 요청
ClientLinkRequest(
    center_id=1,
    person_id=P1,
    phone="010-1111-1111",
    status="pending"
)

# 3. 센터 승인
# 전화번호로 Client 검색 → mom 선택
mom.person_id = P1  # 연동 완료

# 4. 보호자 앱에서 자녀 상담 기록 조회 가능
# mom.person_id로 Client 조회 → ClientRelation으로 자녀 찾기
```

---

### 시나리오 4: 보호자가 상담 필요 (role 전환)

```python
# 1. 기존: role="guardian", person_id=P1
mom = Client(role="guardian", person_id=P1)

# 2. 상담 필요 → role 전환
mom.role = "both"  # guardian + client

# 3. 보호자 앱에서 본인 상담 기록 + 자녀 기록 모두 조회 가능
```

---

## Subscription 쿼터

**Client 수 제한**:
```python
# 쿼터 검증
current_count = await client_repo.count_active(center_id)
# WHERE status='active' AND deleted_at IS NULL

if current_count >= subscription.client_limit:
    raise QuotaExceededError()
```

**플랜별 제한**:
- Free: 10명
- Starter: 50명
- Pro: unlimited

**주의**:
- role 구분 없이 모든 Client 카운트
- `role="guardian"`도 쿼터에 포함

---

## 정책 결정 필요 사항

### 1. role 전환 정책
- `"both" → "client"` 전환 시점: 자녀 성년? 센터 수동?
- `"guardian" → "both"` 전환 자동 제안 여부

### 2. 보호자 Client 쿼터 포함 여부
- 현재: role 구분 없이 모든 Client 카운트
- 검토: `role="guardian"`만 있는 Client 제외?

### 3. Person 연동 없는 보호자 앱 사용
- 현재: person_id 없으면 앱 로그인 불가
- 검토: Guardian 전용 앱 인증 방식?

---

**작성일**: 2026-01-23
**Version**: 3.1 (ClientRelation 개선)
- relation_type: "parent" → "guardian" (보호자 역할 명확화)
- relation_detail 추가: 혈연/비혈연 보호자 구분 지원
