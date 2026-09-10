# Client 도메인 엣지 케이스

> Client.role 기반 설계의 복잡한 시나리오 및 엣지 케이스

---

## 핵심 원칙

1. **보호자 재사용**: 형제 등록 시 phone + role 기반 검색으로 중복 입력 방지
2. **양방향 관계**: SiblingRelation/ClientRelation 모두 양방향 생성
3. **주 보호자 1개**: is_primary=true는 child당 1개만
4. **Client 독립성**: Person 변경이 Client에 영향 없음
5. **90/10 원칙**: role="guardian" Client의 90%는 person_id=null, 10%만 앱 사용

---

## 1. 형제 순차 등록

### 케이스 1-1: 첫째 등록 후 둘째 등록 (보호자 재사용)

```python
# 첫째 등록
POST /centers/1/clients
{
  "name": "김엄마",
  "role": "guardian",
  "phone": "010-1111-1111"
}
# → Client(id="uuid-mom", role="guardian") 생성

POST /centers/1/clients
{
  "name": "김첫째",
  "role": "client",
  "birth_date": "2015-01-01",
  "gender": "male"
}
# → Client(id="uuid-1", role="client") 생성

POST /client-relations
{
  "client_id": "uuid-1",
  "related_client_id": "uuid-mom",
  "relation_type": "parent",
  "is_primary": true
}
# → 양방향 자동 생성: (uuid-1→uuid-mom, parent) + (uuid-mom→uuid-1, child)

# 둘째 등록 (보호자 재사용)
GET /clients/search?phone=010-1111-1111&role=guardian
# → 기존 Client(id="uuid-mom", role="guardian") 발견 ✅

POST /centers/1/clients
{
  "name": "김둘째",
  "role": "client",
  "birth_date": "2018-06-15",
  "gender": "female"
}
# → Client(id="uuid-2", role="client") 생성

POST /client-relations
{
  "client_id": "uuid-2",
  "related_client_id": "uuid-mom",  # 재사용
  "relation_type": "parent",
  "is_primary": true
}

POST /sibling-relations
{
  "client_id": "uuid-1",
  "sibling_id": "uuid-2"
}
# → 양방향 자동 생성: (uuid-1, uuid-2) + (uuid-2, uuid-1)
# relation_detail 자동 추론: "younger_sister", "older_brother"
```

**핵심**: phone + role="guardian" 검색 → 재사용 → SiblingRelation 양방향 생성

---

### 케이스 1-2: Client 검색 실패 (전화번호 불일치)

```python
# 첫째 등록 시 Client phone: "010-1111-1111"
# 둘째 등록 시 검색: "010-1111-2222" (오타)

GET /clients/search?phone=010-1111-2222&role=guardian
# → 검색 결과 없음

# 문제: 보호자 Client 중복 생성 위험
Client(id="uuid-mom-1", role="guardian", phone="010-1111-1111")  # 첫째
Client(id="uuid-mom-2", role="guardian", phone="010-1111-2222")  # 둘째 (중복!)
```

**처리 방법**:
1. UI에서 유사한 이름 검색 제공 ("김엄마" 검색)
2. 기존 role="guardian" Client 목록 표시
3. 센터 관리자가 선택 또는 새로 생성

---

### 케이스 1-3: 같은 전화번호로 여러 보호자 Client 존재

```python
# 상황: 두 가정이 우연히 같은 전화번호 사용 (드물지만 가능)
Client(id="uuid-1", role="guardian", name="김엄마", phone="010-1111-1111", center_id=1)
Client(id="uuid-2", role="guardian", name="박엄마", phone="010-1111-1111", center_id=1)

GET /clients/search?phone=010-1111-1111&role=guardian
# → 2개 결과 반환

# 문제: 어느 Client인지 확인 필요
```

**처리 방법**:
- 이름으로 추가 필터링
- UI에서 선택 옵션 제공
- 센터별 UNIQUE(center_id, phone, role) 제약 고려 (선택)

---

## 2. 보호자 role 전환

### 케이스 2-1: 보호자가 상담 필요 (부부상담)

```python
# 초기 상태
Client(id="uuid-mom", role="guardian", name="김엄마", phone="010-1111-1111", person_id=null)
Client(id="uuid-child", role="client", name="김아이")
ClientRelation(client_id="uuid-child", related_client_id="uuid-mom", relation_type="parent")

# 보호자가 부부상담 필요
PATCH /centers/1/clients/uuid-mom
{
  "role": "both",
  "birth_date": "1985-05-15",
  "gender": "female"
}

# 워크플로우:
# 1. role 변경: "guardian" → "both"
Client(id="uuid-mom", role="both", name="김엄마", ...)

# 2. 이제 보호자도 Counseling/Assessment 가능
Counseling(client_id="uuid-mom")
```

**핵심**: role 필드만 변경, ClientRelation은 그대로 유지

---

### 케이스 2-2: role 전환 후 자녀 관계 유지

```python
# 전환 전
Client(id="uuid-mom", role="guardian", person_id=null)
ClientRelation(client_id="uuid-child", related_client_id="uuid-mom", relation_type="parent")

# 전환 후
Client(id="uuid-mom", role="both", person_id=null)
ClientRelation(client_id="uuid-child", related_client_id="uuid-mom", relation_type="parent")  # 유지

# role이 "both"로 변경되어도 보호자 역할은 그대로
```

---

### 케이스 2-3: role="both" Client 삭제

```python
# 문제: role="both" Client를 삭제하면?
Client(id="uuid-mom", role="both", deleted_at="2026-01-23")
ClientRelation(client_id="uuid-child", related_client_id="uuid-mom", relation_type="parent")  # CASCADE 삭제

# 결과: 자녀의 보호자 관계가 사라짐
# 해결: 삭제 전 다른 주 보호자 지정 필요
```

---

## 3. 형제 관계 자동 추론

### 케이스 3-1: 생년월일 기반 관계 추론

```python
Client(id="uuid-1", role="client", name="김첫째", birth_date="2015-01-01", gender="male")
Client(id="uuid-2", role="client", name="김둘째", birth_date="2018-06-15", gender="female")

POST /sibling-relations
{
  "client_id": "uuid-1",
  "sibling_id": "uuid-2"
}

# 자동 추론 로직:
# uuid-1: 2015-01-01 (남성) > uuid-2: 2018-06-15 (여성)
# → uuid-1 입장에서 uuid-2는 "younger_sister"
# → uuid-2 입장에서 uuid-1은 "older_brother"

# 양방향 생성:
SiblingRelation(
    client_id="uuid-1",
    sibling_id="uuid-2",
    relation_detail="younger_sister"  # uuid-1의 동생
)

SiblingRelation(
    client_id="uuid-2",
    sibling_id="uuid-1",
    relation_detail="older_brother"  # uuid-2의 오빠
)
```

---

### 케이스 3-2: 생년월일 없는 경우

```python
Client(id="uuid-1", birth_date=null)
Client(id="uuid-2", birth_date="2018-06-15")

# relation_detail 추론 불가
SiblingRelation(
    client_id="uuid-1",
    sibling_id="uuid-2",
    relation_detail=null  # 수동 입력 필요
)
```

---

### 케이스 3-3: 삭제 시 양방향 자동 삭제

```python
# 삭제 요청
DELETE /sibling-relations/uuid-relation-1

# Service에서 양방향 모두 삭제
SiblingRelation(id="uuid-relation-1", client_id="uuid-1", sibling_id="uuid-2")  # 삭제
SiblingRelation(id="uuid-relation-2", client_id="uuid-2", sibling_id="uuid-1")  # 자동 삭제
```

---

## 4. 주 보호자 변경

### 케이스 4-1: 주 보호자 변경 (UnitOfWork)

```python
# 초기 상태
ClientRelation(id="rel-1", client_id="uuid-child", related_client_id="uuid-mom", relation_type="parent", is_primary=true)
ClientRelation(id="rel-2", client_id="uuid-child", related_client_id="uuid-dad", relation_type="parent", is_primary=false)

# 주 보호자 변경: 엄마 → 아빠
PATCH /client-relations/rel-1
{
  "is_primary": false
}

PATCH /client-relations/rel-2
{
  "is_primary": true
}

# 트랜잭션 처리 (Handler)
async with uow:
    rel_1.is_primary = False
    rel_2.is_primary = True

    # 검증: client_id당 is_primary=true는 1개만
    await uow.commit()
```

---

### 케이스 4-2: 주 보호자 삭제 시도

```python
# 문제: 주 보호자를 삭제하면?
DELETE /client-relations/rel-1
# rel-1: is_primary=true

# 검증 실패
{
  "detail": "Cannot delete primary guardian. Please assign another primary guardian first."
}

# 해결: 다른 보호자를 주 보호자로 변경 후 삭제
```

---

## 5. Person-Client 연동

### 케이스 5-1: 전화번호 자동 매칭 성공

```python
Person(id="person-1", phone="010-1111-1111")
Client(id="client-1", role="both", phone="010-1111-1111", person_id=null)

POST /client-link-requests
{
  "center_code": "ABC123",
  "phone": "010-1111-1111"
}

# 자동 매칭 성공
GET /centers/1/client-link-requests
# → 매칭 후보: Client(id="client-1") 표시

# 센터 승인
POST /client-link-requests/req-1/approve
{
  "client_id": "client-1"
}

# Client.person_id 설정
Client(id="client-1", person_id="person-1")
```

---

### 케이스 5-2: Person 정보 변경 시 Client 독립성

```python
# 초기 연동
Person(id="person-1", name="김철수", phone="010-1111-1111")
Client(id="client-1", role="both", person_id="person-1", name="김아이", phone="010-2222-2222")

# Person 정보 변경
Person(id="person-1", name="김철수(변경)", phone="010-9999-9999")

# Client는 영향 없음
Client(id="client-1", name="김아이", phone="010-2222-2222")  # 그대로

# 독립성 원칙: Person 변경이 Client에 자동 반영되지 않음
```

---

### 케이스 5-3: 1 Person = 1 Client (센터당) 검증

```python
Person(id="person-1")
Client(id="client-1", center_id=1, person_id="person-1")  # 이미 연동됨

# 같은 센터에 중복 연동 시도
ClientLinkRequest(person_id="person-1", client_id="client-2", center_id=1)

# 승인 시도
POST /client-link-requests/req-2/approve
{
  "client_id": "client-2"
}

# 검증 실패
{
  "detail": "Person is already linked to another client in this center"
}
```

---

### 케이스 5-4: role="client" Client는 연동 불가

```python
# 상황: 미성년 내담자가 앱에서 연동 시도
Person(id="person-1", phone="010-1111-1111")
Client(id="client-1", role="client", name="김아이", phone="010-1111-1111", person_id=null)

# 연동 요청
POST /client-link-requests
{
  "center_code": "ABC123",
  "phone": "010-1111-1111"
}

# 매칭 결과
GET /centers/1/client-link-requests
# → Client(id="client-1", role="client") 발견

# 승인 시도
POST /client-link-requests/req-1/approve
{
  "client_id": "client-1"
}

# 검증 실패
{
  "detail": "Cannot link Person to Client with role='client'. Only 'guardian' or 'both' roles are allowed."
}
```

**핵심**: role="client"는 미성년 내담자이므로 앱 사용 불가

---

## 6. 동시성 문제

### 케이스 6-1: 보호자 Client 검색 동시 요청

```python
# Thread A: 둘째 등록 시 보호자 검색
GET /clients/search?phone=010-1111-1111&role=guardian
# → 기존 Client 발견

# Thread B: 둘째 등록 시 보호자 검색 (동시)
GET /clients/search?phone=010-1111-1111&role=guardian
# → 기존 Client 발견

# 문제: 둘 다 같은 보호자 Client 재사용 → 관계 2개 생성
ClientRelation(client_id="uuid-child-2a", related_client_id="uuid-mom", relation_type="parent")
ClientRelation(client_id="uuid-child-2b", related_client_id="uuid-mom", relation_type="parent")

# 해결: DB Unique Constraint
UNIQUE(client_id, related_client_id, relation_type)
```

---

### 케이스 6-2: 주 보호자 변경 동시 요청

```python
# Thread A: 엄마 → 아빠로 변경
UPDATE is_primary=False WHERE id="rel-mom"
UPDATE is_primary=True WHERE id="rel-dad"

# Thread B: 엄마 관계 삭제 (동시)
DELETE /client-relations/rel-mom

# 문제: Thread A가 is_primary=False 설정 후, Thread B가 삭제하면 주 보호자 없음

# 해결: Service에서 트랜잭션 처리
async with uow:
    await clear_primary(client_id)
    await set_primary(new_guardian_id)
    await uow.commit()
```

---

## 7. 복잡한 가족 구조

### 케이스 7-1: 재혼 가정

```python
Client(id="uuid-child", role="client", name="김아이")
Client(id="uuid-mom", role="guardian", name="김엄마")  # 친모
Client(id="uuid-new-dad", role="guardian", name="박새아빠")  # 재혼 배우자

ClientRelation(
    client_id="uuid-child",
    related_client_id="uuid-mom",
    relation_type="parent",
    is_primary=true  # 친모가 주 보호자
)

ClientRelation(
    client_id="uuid-child",
    related_client_id="uuid-new-dad",
    relation_type="parent",
    is_primary=false  # 새아빠는 보조 보호자
)
```

---

### 케이스 7-2: 조부모 양육

```python
Client(id="uuid-grandma", role="guardian", name="김할머니")
Client(id="uuid-child", role="client", name="김아이")

ClientRelation(
    client_id="uuid-child",
    related_client_id="uuid-grandma",
    relation_type="parent",  # 또는 "grandparent" (relation_type 확장 필요)
    is_primary=true  # 조부모가 주 보호자
)
```

---

### 케이스 7-3: 위탁 가정

```python
Client(id="uuid-foster-mom", role="guardian", name="위탁엄마")
Client(id="uuid-real-mom", role="guardian", name="친엄마")
Client(id="uuid-child", role="client", name="이아이")

ClientRelation(
    client_id="uuid-child",
    related_client_id="uuid-foster-mom",
    relation_type="parent",  # 또는 "guardian"
    is_primary=true
)

ClientRelation(
    client_id="uuid-child",
    related_client_id="uuid-real-mom",
    relation_type="parent",
    is_primary=false
)

# 친모 Client는 status=inactive (선택)
```

---

## 8. 일괄 등록 엣지 케이스

### 케이스 8-1: 형제 일괄 등록 (배치 API)

```python
POST /centers/1/clients/batch
{
  "guardians": [
    {"phone": "010-1111-1111", "name": "김엄마", "relation_type": "parent"},
    {"phone": "010-2222-2222", "name": "김아빠", "relation_type": "parent"}
  ],
  "children": [
    {"name": "김첫째", "birth_date": "2015-01-01", "gender": "male"},
    {"name": "김둘째", "birth_date": "2018-06-15", "gender": "female"}
  ]
}

# 워크플로우:
# 1. Client 2명 생성 (부, 모) - role="guardian"
# 2. Client 2명 생성 (첫째, 둘째) - role="client"
# 3. ClientRelation 8개 생성 (양방향 × 4 = 8)
# 4. SiblingRelation 2개 생성 (첫째-둘째, 둘째-첫째)

# 트랜잭션: 전체 성공 or 전체 롤백
```

---

### 케이스 8-2: 배치 등록 중 보호자 재사용

```python
# 상황: 첫째는 이미 등록됨, 둘째만 추가
Client(id="uuid-mom", role="guardian", phone="010-1111-1111")  # 기존

POST /centers/1/clients/batch
{
  "guardians": [
    {"phone": "010-1111-1111", "name": "김엄마"}  # 기존과 동일
  ],
  "children": [
    {"name": "김둘째", "birth_date": "2018-06-15"}
  ]
}

# 처리: phone + role 검색 → 기존 보호자 Client 재사용
```

---

## 9. 데이터 정합성 검증

### 케이스 9-1: 주 보호자 중복 검증 (배치)

```python
# 야간 배치 작업
async def validate_primary_guardians():
    """client_id당 is_primary=true가 1개만 있는지 검증"""

    # SQL:
    # SELECT client_id, COUNT(*)
    # FROM client_relations
    # WHERE relation_type = 'parent' AND is_primary = true
    # GROUP BY client_id
    # HAVING COUNT(*) > 1

    violations = await find_duplicate_primary_guardians()

    if violations:
        # 알림 전송
        await notify_admin(violations)
```

---

### 케이스 9-2: ClientRelation 양방향 일관성 검증

```python
# 검증: ClientRelation이 양방향으로 존재하는지
async def validate_bidirectional_relations():
    # (A→B, parent) 존재 시 (B→A, child) 반드시 존재
    relations = await find_all_parent_relations()

    for relation in relations:
        reverse = await find_relation(
            client_id=relation.related_client_id,
            related_client_id=relation.client_id,
            relation_type="child"
        )

        if not reverse:
            # 역방향 관계 자동 생성
            await create_reverse_relation(relation)
```

---

### 케이스 9-3: role 일관성 검증

```python
# 검증: role="client"인데 person_id가 설정된 경우
async def validate_role_person_id_consistency():
    # role="client"는 person_id=null이어야 함 (미성년자)
    violations = await db.execute(
        """
        SELECT id, name, role, person_id
        FROM clients
        WHERE role = 'client' AND person_id IS NOT NULL
        """
    )

    if violations:
        # 경고 로그 + 관리자 알림
        await notify_admin(violations)
```

---

## 10. role 전환 엣지 케이스

### 케이스 10-1: role="both" → "client" 전환

```python
# 상황: 자녀가 성인이 되어 보호자 역할 종료
Client(id="uuid-mom", role="both", person_id="person-1")
ClientRelation(client_id="uuid-child", related_client_id="uuid-mom", relation_type="parent")

# role 전환
PATCH /centers/1/clients/uuid-mom
{
  "role": "client"
}

# 워크플로우:
# 1. role 변경: "both" → "client"
# 2. ClientRelation 처리 결정:
#    - 옵션 A: ClientRelation 유지 (이력 보존)
#    - 옵션 B: ClientRelation 삭제 (보호자 역할 완전 종료)

# 권장: 옵션 A (이력 보존)
```

---

### 케이스 10-2: role 전환 금지 케이스

```python
# 금지: role="client" → "guardian" 또는 "both"
Client(id="uuid-child", role="client", name="김아이", birth_date="2015-01-01")

# 전환 시도
PATCH /centers/1/clients/uuid-child
{
  "role": "guardian"
}

# 검증 실패
{
  "detail": "Cannot transition from 'client' to 'guardian'. Invalid role transition."
}

# 이유: 미성년 내담자는 보호자가 될 수 없음 (비즈니스 규칙)
```

---

## 참고 문서

- **도메인 설계**: `/docs/client/domain.md`
- **API 명세**: `/docs/client/api.md`
- **시나리오**: `/docs/client/scenarios.md`

---

**작성일**: 2026-01-23
**Version**: 3.0 (Client.role 기반 엣지 케이스)
