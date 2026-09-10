# Client 도메인 의사결정 기록

> First Principles 기반 주요 설계 결정 및 근거

---

## 목차

1. [Q1: Person과 Client의 관계는?](#q1-person과-client의-관계는)
2. [Q2: 왜 Person과 데이터를 동기화하지 않는가?](#q2-왜-person과-데이터를-동기화하지-않는가)
3. [Q3: 주 보호자(is_primary)는 왜 1개만 허용하는가?](#q3-주-보호자is_primary는-왜-1개만-허용하는가)
4. [Q4: 왜 센터 간 ClientRelation을 금지하는가?](#q4-왜-센터-간-clientrelation을-금지하는가)
5. [Q5: 소프트 삭제 vs 하드 삭제 선택 기준은?](#q5-소프트-삭제-vs-하드-삭제-선택-기준은)
6. [Q6: ClientLinkRequest의 승인 프로세스는 왜 필요한가?](#q6-clientlinkrequest의-승인-프로세스는-왜-필요한가)
7. [Q7: 왜 상태 전이에 규칙이 있는가?](#q7-왜-상태-전이에-규칙이-있는가)
8. [Q8: Subscription 쿼터는 어떻게 검증하는가?](#q8-subscription-쿼터는-어떻게-검증하는가)
9. [Q9: 왜 Guardian을 독립 엔티티로 설계했는가?](#q9-왜-guardian을-독립-엔티티로-설계했는가)

---

## Q1: Person과 Client의 관계는?

### 결정
**Client는 센터별로 완전히 독립**되며, Person과의 연동은 **선택적**이고 **인증/식별 목적만**.

### 근거

#### 1. 도메인 분리 (Separation of Concerns)
```
Person 도메인:
- 책임: 전역 신원 관리 (Account 생성 시 자동 생성)
- 소유: Auth 도메인
- 목적: 앱 로그인, 계정 관리

Client 도메인:
- 책임: 센터별 내담자 관리
- 소유: 센터
- 목적: 상담/검사 기록, 센터 운영
```

#### 2. Multi-Tenancy 독립성
- **센터 A**: Client(name="김철수", phone="010-1111-1111", person_id=100)
- **센터 B**: Client(name="김철수", phone="010-2222-2222", person_id=100)
- 같은 Person이 여러 센터에서 **다른 정보**를 가질 수 있음

#### 3. 실무 요구사항
```
시나리오 1: 아동 내담자 (Person 없음)
- 센터가 보호자 번호로 Client 생성
- 연동 불필요 (아동은 앱 미사용)

시나리오 2: 성인 내담자 (Person 있음)
- 보호자가 앱에서 회원가입 (Person 생성)
- 센터 승인 후 연동 (ClientLinkRequest)
```

### 대안 검토

#### ❌ 대안 1: Person이 Client 정보 포함
```python
Person(
    name="김철수",        # 전역
    phone="010-1111-1111", # 전역
    clients=[
        {"center_id": 1, "notes": "..."},
        {"center_id": 2, "notes": "..."}
    ]
)
```
**문제**:
- Person 변경 시 모든 센터에 영향 (센터 독립성 위반)
- 센터가 다른 센터의 정보 볼 수 없음 (Multi-Tenancy)

#### ❌ 대안 2: Client가 Person 데이터 동기화
```python
# Person 변경 시 모든 Client 업데이트
Person.phone = "010-2222-2222"
→ Client.contact_phone = "010-2222-2222" (모든 센터)
```
**문제**:
- 센터가 수정한 정보가 덮어씌워짐
- 센터별 다른 연락처 불가
- 동기화 로직 복잡 + 성능 이슈

### 결론
✅ **Client는 센터 소유**, Person은 인증/식별만. **데이터 동기화 없음**.

---

## Q2: 왜 Person과 데이터를 동기화하지 않는가?

### 결정
Person 변경이 Client에 **영향을 주지 않음**. 각 도메인이 완전히 독립.

### 근거

#### 1. 센터 자율성 (Center Autonomy)
```
센터가 관리하는 정보:
- name, contact_phone, address, notes
- 센터의 판단으로 수정 가능
- Person 변경과 무관

예시:
Person(phone="010-1111-1111") 변경
→ Client(contact_phone="010-2222-2222") 그대로 유지
  (센터가 다른 번호 사용 중)
```

#### 2. 정보 충돌 방지
```
충돌 시나리오:
1. Person이 앱에서 전화번호 변경 (010-1111 → 010-2222)
2. 센터가 Client 전화번호 변경 (010-1111 → 010-3333)

동기화 시 문제:
- 누구의 변경이 우선? (Last Write Wins?)
- 센터의 의도 무시됨
- 충돌 해결 로직 복잡
```

#### 3. 도메인 독립성 (Bounded Context)
```
Person 도메인:
- Account, Auth 도메인과 강결합
- 회원가입, 로그인, 프로필 관리

Client 도메인:
- Counseling, Assessment 도메인과 강결합
- 상담 기록, 검사 결과, 일정 관리

→ 두 도메인은 독립적으로 진화 가능
```

### 대안 검토

#### ❌ 대안 1: Person이 Master, Client는 Replica
```python
# Person 변경 시 자동 동기화
Person.name = "김철수"
→ Client.name = "김철수" (모든 센터)
```
**문제**:
- 센터가 수정한 내용 덮어씌워짐
- 센터별 다른 이름 불가 (예: 별명 사용)
- 동기화 실패 시 불일치

#### ❌ 대안 2: 양방향 동기화
```python
Person.phone ↔ Client.contact_phone
```
**문제**:
- 순환 의존 (Circular Dependency)
- 충돌 해결 로직 필요
- 성능 이슈 (여러 센터 동기화)

### 결론
✅ **완전히 독립**. 센터가 Client 정보를 **직접 관리**. Person은 **참조만** (person_id).

---

## Q3: 주 보호자(is_primary)는 왜 1개만 허용하는가?

### 결정
ClientRelation에서 **is_primary=true는 1개만** 허용.

### 근거

#### 1. 명확한 책임 소재
```
실무 시나리오:
- 상담 일정 변경 → 주 보호자에게 연락
- 청구서 발송 → 주 보호자에게 발송
- 동의서 서명 → 주 보호자 서명

주 보호자 2명 시:
- 누구에게 연락? (혼란)
- 동의서 2개? (비효율)
```

#### 2. 시스템 단순성
```python
# 주 보호자 조회
primary_parent = client.relations.filter(
    relation_type="parent",
    is_primary=True
).first()  # 항상 1개

# 주 보호자 2명 시
primary_parents = client.relations.filter(
    relation_type="parent",
    is_primary=True
).all()  # 여러 개 → 어느 것 선택?
```

#### 3. 법적/행정적 요구사항
```
한국 법률:
- 친권자는 부모 둘 다지만, 실무에서는 대표 1명 지정
- 학교, 병원 등도 주 보호자 1명 요구
- 비상 연락처 1순위 개념
```

### 대안 검토

#### ❌ 대안 1: 주 보호자 여러 명 허용
```python
ClientRelation(client_id=1, related_client_id=2, is_primary=True)  # 엄마
ClientRelation(client_id=1, related_client_id=3, is_primary=True)  # 아빠
```
**문제**:
- 연락처 선택 로직 복잡
- UI에서 "주 보호자" 표시 혼란
- 실무에서 불필요한 유연성

#### ❌ 대안 2: priority 순위 필드
```python
ClientRelation(client_id=1, related_client_id=2, priority=1)  # 1순위
ClientRelation(client_id=1, related_client_id=3, priority=2)  # 2순위
```
**문제**:
- 오버 엔지니어링
- 실무에서 2순위까지 관리 안 함
- 1순위만 사용 → boolean으로 충분

### 결론
✅ **is_primary=true는 1개만**. 단순하고 명확하며, 실무 요구사항에 부합.

---

## Q4: 왜 센터 간 ClientRelation을 금지하는가?

### 결정
ClientRelation은 **같은 center_id를 가진 Client만** 연결 가능.

### 근거

#### 1. Multi-Tenancy 격리 (Tenant Isolation)
```
센터 A의 Client(id=10)
센터 B의 Client(id=20)

센터 간 관계 허용 시:
ClientRelation(client_id=10, related_client_id=20)

문제:
- 센터 A가 센터 B의 정보 접근?
- 센터 B가 센터 A의 정보 접근?
- 보안 위반 (데이터 격리 원칙)
```

#### 2. 비즈니스 로직 복잡성
```
센터 간 관계 허용 시:
- 관계 조회 시 센터 권한 체크 필요
- 삭제 시 다른 센터에 영향?
- 주 보호자가 다른 센터에 있으면?

→ 로직 복잡도 급증, 버그 위험 ↑
```

#### 3. 실무 요구사항
```
실무 시나리오:
- 가족은 같은 센터에서 상담받음
- 다른 센터 이용 시 별도 등록
- 센터 간 정보 공유 불필요
```

### 대안 검토

#### ❌ 대안 1: 센터 간 관계 허용 + 권한 체크
```python
class GetClientRelationsService:
    async def execute(self, client_id: int, current_center_id: int):
        relations = await self.repo.get_all(client_id)

        # 다른 센터 관계는 제한된 정보만
        filtered = []
        for rel in relations:
            if rel.related_client.center_id == current_center_id:
                filtered.append(rel)  # 전체 정보
            else:
                filtered.append(rel.public_only())  # 제한된 정보

        return filtered
```
**문제**:
- 복잡한 권한 로직
- 실수로 다른 센터 정보 노출 위험
- 실무 필요성 낮음

### 결론
✅ **센터 간 관계 금지**. Multi-Tenancy 보안 + 로직 단순성.

---

## Q5: 소프트 삭제 vs 하드 삭제 선택 기준은?

### 결정
**기본은 소프트 삭제** (deleted_at), 관련 데이터 없을 때만 하드 삭제 허용.

### 근거

#### 1. 데이터 보존 (Data Preservation)
```
소프트 삭제 이유:
- 실수로 삭제 시 복구 가능
- 감사 추적 (Audit Trail)
- 통계 분석 (과거 데이터 포함)
- 법적 요구사항 (개인정보 보관 기간)
```

#### 2. 참조 무결성 (Referential Integrity)
```
관련 데이터 존재 시:
Client(id=1)
  ↓
Counseling(client_id=1)
Assessment(client_id=1)

하드 삭제 시:
- Counseling/Assessment 고아 레코드
- FK 제약으로 삭제 불가
- CASCADE 삭제 시 모든 이력 소실
```

#### 3. 복구 시나리오
```
실무 사례:
1. 센터가 실수로 Client 삭제
2. 관련 상담 기록 100개 존재
3. 하드 삭제 시 복구 불가
4. 소프트 삭제 시 deleted_at = NULL로 복구
```

### 대안 검토

#### ❌ 대안 1: 항상 하드 삭제
```python
await self.repo.delete(client_id)  # 물리적 삭제
```
**문제**:
- 복구 불가
- 감사 추적 불가
- 관련 데이터 처리 복잡

#### ❌ 대안 2: 별도 Archive 테이블
```python
# Client_Archive 테이블로 이동
await self.archive_repo.create(client.model_dump())
await self.repo.delete(client_id)
```
**문제**:
- 테이블 2배 (Client + Client_Archive)
- Archive 테이블도 관계 설정 필요
- 조회 로직 복잡 (UNION ALL)

### 검증 로직
```python
class DeleteClientService:
    async def execute(self, client_id: int, hard_delete: bool = False):
        # 관련 데이터 확인
        has_counselings = await self.counseling_repo.exists_for_client(client_id)
        has_assessments = await self.assessment_repo.exists_for_client(client_id)

        if (has_counselings or has_assessments) and hard_delete:
            raise ValueError(
                "Cannot hard delete client with existing counselings or assessments. "
                "Soft delete only."
            )

        if hard_delete:
            await self.repo.delete(client_id)  # 물리적 삭제
        else:
            client = await self.repo.get(client_id)
            client.deleted_at = datetime.utcnow()
            await self.repo.update(client)  # 소프트 삭제
```

### 결론
✅ **소프트 삭제 기본**, 관련 데이터 없을 때만 하드 삭제. 안전성 + 복구 가능성.

---

## Q6: ClientLinkRequest의 승인 프로세스는 왜 필요한가?

### 결정
Person → Client 연동 시 **센터 승인 필수** (ClientLinkRequest).

### 근거

#### 1. 보안 (Security)
```
승인 없이 자동 연동 시:
1. 악의적 사용자가 타인 전화번호로 가입
2. 자동으로 다른 사람의 Client와 연동
3. 민감한 상담 기록 열람

→ 심각한 개인정보 침해
```

#### 2. 정확성 (Accuracy)
```
전화번호 자동 매칭 문제:
- 동명이인 + 같은 전화번호 (가족)
- 전화번호 변경 (기존: 010-1111, 신규: 010-2222)
- 오타 (010-1234-5678 vs 010-1234-5679)

→ 잘못된 연동 위험
```

#### 3. 센터 통제권 (Center Control)
```
센터 입장:
- 내담자 정보는 센터 자산
- 연동 전 신원 확인 필요
- 연동 거부 권한 필요 (부적절한 요청)
```

### 대안 검토

#### ❌ 대안 1: 자동 연동 (승인 없음)
```python
# Person 회원가입 시 자동 매칭
Person(phone="010-1111-1111")
→ Client(contact_phone="010-1111-1111", person_id=100) 자동 설정
```
**문제**:
- 보안 위험 (타인 정보 열람)
- 잘못된 매칭 (동명이인, 오타)
- 센터 통제 불가

#### ❌ 대안 2: OTP 인증으로 자동 연동
```python
# 전화번호 OTP 인증 후 자동 연동
Person(phone="010-1111-1111") + OTP 인증
→ Client(contact_phone="010-1111-1111", person_id=100) 자동 설정
```
**문제**:
- 동명이인 문제 미해결
- 센터 통제 불가 (부적절한 요청 거부 불가)
- OTP 인프라 필요 (비용 ↑)

### 승인 프로세스 흐름
```
1. Person 회원가입 (전화번호 입력)
2. 전화번호로 Client 자동 매칭 → 후보 제시
3. ClientLinkRequest 생성 (pending)
4. 센터에 알림 (대시보드 + 이메일)
5. 센터 관리자 확인:
   - 전화번호 일치? 생년월일 확인?
   - 본인 맞으면 승인 (approved)
   - 아니면 거부 (rejected)
6. 승인 시 Client.person_id 설정
```

### 결론
✅ **센터 승인 필수**. 보안 + 정확성 + 센터 통제권.

---

## Q7: 왜 상태 전이에 규칙이 있는가?

### 결정
Client 상태는 **ALLOWED_TRANSITIONS 규칙** 준수.

```python
ALLOWED_TRANSITIONS = {
    "active": ["inactive"],
    "inactive": ["active", "archived"],
    "archived": ["active"]
}
```

### 근거

#### 1. 비즈니스 로직 명확성
```
상태별 의미:
- active: 현재 상담 중 또는 활성 내담자
- inactive: 상담 종료, 장기 미방문 (6개월 이내)
- archived: 장기 미방문 (6개월 이상)

직접 전이 금지 이유:
active → archived 불가
  ↓
inactive 거쳐야 함 (6개월 대기)
```

#### 2. 감사 추적 (Audit Trail)
```
상태 변경 이력:
active (2026-01-01)
  → inactive (2026-06-01, 상담 종료)
  → archived (2026-12-01, 6개월 경과)

active → archived 직접 전이 시:
- inactive 기간 불명확
- 감사 추적 불완전
```

#### 3. 배치 작업 설계
```
자동 전환 배치:
- inactive → archived: 6개월 경과 시
- archived → active: 재상담 시 수동 전환

직접 전이 허용 시:
- 배치 로직 복잡
- 수동 전환과 자동 전환 충돌
```

### 대안 검토

#### ❌ 대안 1: 모든 전이 허용
```python
# 어떤 상태에서든 변경 가능
Client.status = new_status  # 검증 없음
```
**문제**:
- 비즈니스 규칙 무시
- 실수로 잘못된 상태 전환
- 감사 추적 불완전

#### ❌ 대안 2: 상태 없이 flag 사용
```python
Client(
    is_active: bool,
    is_archived: bool
)
```
**문제**:
- 상태 조합 혼란 (active=True, archived=True?)
- 쿼리 복잡 (WHERE is_active AND NOT is_archived)
- Enum 타입 장점 없음

### 검증 로직
```python
class UpdateClientStatusService:
    ALLOWED_TRANSITIONS = {
        "active": ["inactive"],
        "inactive": ["active", "archived"],
        "archived": ["active"]
    }

    async def execute(self, client_id: int, new_status: str):
        client = await self.repo.get(client_id)

        if new_status not in self.ALLOWED_TRANSITIONS.get(client.status, []):
            raise ValueError(
                f"Invalid status transition: {client.status} → {new_status}. "
                f"Allowed: {self.ALLOWED_TRANSITIONS[client.status]}"
            )

        client.status = new_status
        await self.repo.update(client)
```

### 결론
✅ **ALLOWED_TRANSITIONS 규칙 준수**. 비즈니스 로직 명확 + 감사 추적 완전.

---

## Q8: Subscription 쿼터는 어떻게 검증하는가?

### 결정
Client 생성 **전**에 Subscription 쿼터 검증.

### 근거

#### 1. 사전 검증 (Fail Fast)
```
생성 전 검증:
1. Subscription 조회
2. 현재 Client 수 카운트
3. current_count >= client_limit → 에러 (402)
4. Client 생성 (쿼터 이내)

→ 불필요한 작업 방지, 즉시 에러 응답
```

#### 2. 플랜별 제한
```
Subscription Plans:
- Free: 10명
- Starter: 50명
- Pro: unlimited (999,999)

실무 요구사항:
- 플랜에 따른 기능 제한
- 업그레이드 유도 (freemium 모델)
```

#### 3. 다운그레이드 처리
```
시나리오: Pro (unlimited) → Starter (50명)

현재 Client 수: 60명

처리 방법:
1. Grace Period 30일 부여
2. 30일 내 Client 수 감소 안 하면?
   - 새 Client 생성 금지
   - 기존 Client는 유지 (서비스 중단 방지)
```

### 대안 검토

#### ❌ 대안 1: 생성 후 검증
```python
# Client 생성 후 쿼터 확인
client = await self.repo.create(data.model_dump())
if await self.is_quota_exceeded():
    await self.repo.delete(client.id)  # 롤백
    raise QuotaExceededError()
```
**문제**:
- ID 낭비 (생성 후 삭제)
- 롤백 로직 복잡
- 트랜잭션 오버헤드

#### ❌ 대안 2: 쿼터 초과 시 oldest Client 삭제
```python
if current_count >= limit:
    oldest = await self.repo.get_oldest(center_id)
    await self.repo.delete(oldest.id)
```
**문제**:
- 사용자 의도 무시 (자동 삭제)
- 데이터 손실 위험
- UX 매우 나쁨

### 검증 로직
```python
class CreateClientService:
    async def execute(self, data: ClientCreate):
        # 1. Subscription 조회
        subscription = await self.subscription_repo.get_by_center(data.center_id)

        # 2. 현재 Client 수 카운트 (deleted_at=NULL만)
        current_count = await self.client_repo.count_active(data.center_id)

        # 3. 쿼터 검증
        if current_count >= subscription.client_limit:
            raise QuotaExceededError(
                f"Client limit exceeded. Current plan allows {subscription.client_limit} clients. "
                f"Please upgrade your subscription."
            )

        # 4. Client 생성
        return await self.repo.create(data.model_dump())
```

### 에러 응답
```json
{
  "detail": "Client limit exceeded. Current plan allows 10 clients. Please upgrade your subscription.",
  "code": "QUOTA_EXCEEDED",
  "current_count": 10,
  "limit": 10,
  "upgrade_url": "/settings/subscription"
}
```

### 결론
✅ **생성 전 쿼터 검증**. Fail Fast + 플랜별 제한 + Grace Period 지원.

---

## Q9: 왜 Guardian 설계를 포기하고 Client.role로 회귀했는가?

### 최종 결정 (2026-01-23)
**Guardian 독립 엔티티 제거**, **Client.role 필드**로 보호자/내담자 구분.

### 근거

#### 1. 치명적 결함: Person 연동 불가

**Guardian 설계의 근본 문제**:
```
Guardian 90%는 client_id=NULL (Client 미생성)
  ↓
Person 연동은 Client.person_id를 통해서만 가능
  ↓
90% Guardian은 앱 사용 불가 (Person 연동 불가)
```

**구체적 시나리오**:
```python
# 초기 상태
Guardian(id="uuid-mom", phone="010-1111-1111", client_id=NULL)
Client(id="uuid-child", name="김아이")

# 보호자가 앱에서 회원가입
Person(id=1, phone="010-1111-1111")

# 연동 요청
ClientLinkRequest(person_id=1, phone="010-1111-1111")

# 문제: 매칭할 Client가 없음!
Guardian.client_id = NULL → Client 존재하지 않음
→ Person 연동 불가
→ 앱 사용 불가
```

**해결 시도 1: Guardian.person_id 추가**
```python
class Guardian(Base):
    person_id: Mapped[str | None]  # Person 직접 연동
```

**문제점**:
- 두 개의 연동 경로 (Guardian.person_id, Client.person_id)
- 프로모션 시 person_id 이동 필요 (Guardian → Client)
- 데이터 불일치 위험 (person_id가 두 곳에 존재)
- 프론트엔드 로직 복잡 (어느 경로로 연동?)

**해결 시도 2: 앱 사용자만 Client 생성**
```python
# 앱 미사용 보호자
Guardian(client_id=NULL)

# 앱 사용 보호자
Guardian(client_id="uuid-client")
Client(id="uuid-client", person_id=1)
```

**문제점**:
- 90/10 원칙 위반 (모든 앱 사용자는 Client 생성해야 함)
- Guardian 존재 이유 상실 (90%가 Client 없으면 존재 의미 없음)
- 여전히 두 경로 (Guardian만, Guardian+Client)

#### 2. Client.role 방식의 단순성

**Client.role 설계**:
```python
class Client(Base):
    role: Mapped[str]  # "client" | "guardian" | "both"
    person_id: Mapped[str | None]
```

**Person 연동 일관성**:
```
모든 앱 사용자 → Client 필요
  ↓
Client.person_id 설정 (단일 경로)
  ↓
role 구분으로 역할 표현
```

**시나리오**:
```python
# 첫째 등록
mom = Client(name="김엄마", phone="010-1111-1111", role="guardian", person_id=NULL)
child_1 = Client(name="김첫째", role="client")
ClientRelation(child_1, mom, "parent")

# 앱 회원가입 + 연동
Person(id=1, phone="010-1111-1111")
ClientLinkRequest(person_id=1, phone="010-1111-1111")
→ mom.person_id = 1  # 단일 경로, 명확

# 상담 시작 (보호자 → 보호자+내담자)
mom.role = "both"  # role만 변경, 관계 유지
```

#### 3. 전화번호 재사용 패턴

**Guardian 방식**:
```python
GET /guardians/search?phone=010-1111-1111
```

**Client.role 방식**:
```python
GET /clients/search?phone=010-1111-1111&role=guardian
```

**차이점**:
- Guardian: 별도 엔드포인트 필요
- Client.role: role 필터만 추가 (기존 엔드포인트 활용)
- **결론**: 큰 차이 없음, 오히려 Client.role이 통합적

#### 4. 90/10 원칙 재해석

**Guardian 방식**:
```
90%: Guardian만 (client_id=NULL)
10%: Guardian + Client (client_id 설정)
```

**Client.role 방식**:
```
90%: role="guardian", person_id=NULL (정보만)
10%: role="guardian", person_id=설정 (앱 사용)
또는 role="both" (상담도 받음)
```

**핵심 차이**:
- Guardian: 엔티티 분리로 표현
- Client.role: role 필드로 표현
- **효과는 동일**, Client.role이 더 단순

#### 5. 프로모션 패턴 비교

**Guardian 방식**:
```python
POST /guardians/{id}/promote
→ Client 생성 + Guardian.client_id 설정
```

**Client.role 방식**:
```python
PATCH /clients/{id}
{
  "role": "both"
}
→ role만 변경
```

**Client.role 우위**:
- API 단순 (PATCH 하나)
- 데이터 이동 없음 (role만 변경)
- 관계 유지 (ClientRelation 그대로)

### Guardian 방식이 우월했던 점 (포기한 이유)

#### ✅ Guardian의 장점들

**1. 의미적 명확성**
```
Guardian: 보호자만
Client: 내담자만
```
→ **하지만**: Person 연동 불가로 실용성 상실

**2. Client 테이블 순수성**
```
Client는 순수 상담 대상만
```
→ **하지만**: role 필드로도 구분 가능

**3. 전화번호 재사용 명확성**
```
GET /guardians/search?phone=...
```
→ **하지만**: `GET /clients/search?phone=...&role=guardian`으로 동일 효과

### 최종 판단: Person 연동 > 의미적 명확성

**우선순위**:
1. **앱 사용 가능 (Person 연동)**: 필수 기능
2. **의미적 명확성**: 개발자 편의

**결론**:
- Guardian 설계는 이론적으로 우아하지만, 실무 필수 기능(Person 연동) 불가
- Client.role 설계는 모든 기능 지원 + 단순성 확보
- **실용성 > 이론적 우아함**

### Client.role 설계 (최종)

**테이블 구조**:
```python
class Client(Base):
    id: Mapped[str]
    center_id: Mapped[int]
    role: Mapped[str]  # "client" | "guardian" | "both"
    person_id: Mapped[str | None]

    name: Mapped[str]
    phone: Mapped[str | None]
    birth_date: Mapped[date | None]
    gender: Mapped[str | None]

class ClientRelation(Base):
    client_id: Mapped[str]
    related_client_id: Mapped[str]
    relation_type: Mapped[str]  # "parent" | "child"
    is_primary: Mapped[bool]

class SiblingRelation(Base):
    client_id: Mapped[str]
    sibling_id: Mapped[str]
    relation_detail: Mapped[str | None]
```

**API 엔드포인트**:
```python
GET /clients/search?phone={phone}&role={role}  # 보호자 검색
POST /clients                                  # Client 생성 (role 지정)
PATCH /clients/{id}                            # role 전환
POST /client-relations                         # 관계 생성 (양방향 자동)
POST /sibling-relations                        # 형제 관계 (양방향 자동)
```

**비즈니스 로직**:
- 순차 등록: phone + role="guardian" 검색 → 재사용
- 배치 등록: Client(role="guardian") + Client(role="client") → ClientRelation
- role 전환: "guardian" → "both" (상담 시작)
- Person 연동: Client.person_id 설정 (단일 경로)

### 역사적 기록

**Guardian 설계 기간**: 2026-01-15 ~ 2026-01-23 (8일)

**설계 변경 이유**: Person 연동 아키텍처 결함 발견

**교훈**:
- 초기 설계 시 모든 도메인 통합 고려 필요
- Person 연동은 필수 기능 → 설계 초기부터 반영해야
- 이론적 우아함보다 실무 요구사항 우선

---

## 요약

| 의사결정 | 핵심 이유 | 대안 |
|----------|----------|------|
| **Person-Client 독립** | 센터 자율성, Multi-Tenancy | ❌ 동기화 (충돌, 복잡도) |
| **데이터 동기화 없음** | 도메인 독립, 센터 통제 | ❌ 양방향 동기화 (순환 의존) |
| **주 보호자 1개** | 명확성, 단순성 | ❌ 여러 명 (혼란, 오버 엔지니어링) |
| **센터 간 관계 금지** | Multi-Tenancy 격리 | ❌ 권한 체크 (복잡, 보안 위험) |
| **소프트 삭제 기본** | 데이터 보존, 복구 가능 | ❌ 하드 삭제 (복구 불가) |
| **연동 승인 필수** | 보안, 정확성, 센터 통제 | ❌ 자동 연동 (보안 위험) |
| **상태 전이 규칙** | 비즈니스 로직, 감사 추적 | ❌ 모든 전이 허용 (혼란) |
| **생성 전 쿼터 검증** | Fail Fast, 플랜 제한 | ❌ 생성 후 검증 (낭비) |
| **Client.role 방식** | Person 연동 일관성, 단순성, 실용성 | ❌ Guardian (Person 연동 불가) |

---

**작성일**: 2026-01-23
**Version**: 3.0 (Client.role 기반 재설계, Guardian 제거)
