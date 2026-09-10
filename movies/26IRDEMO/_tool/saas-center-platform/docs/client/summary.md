# Client 도메인 Summary (Client.role 기반)

> 핵심 개념 및 정책 요약 (Client.role 기반 설계)

---

## 🎯 핵심 개념

### 센터별 독립 관리
내담자(Client)는 **센터별로 완전히 독립**되어 관리. Person과의 연동은 인증/식별 목적만.

### Client.role 기반 설계 (90/10 원칙)
- **모든 인물은 Client**: 내담자, 보호자 모두 Client 엔티티
- **role 필드로 구분**: `"client"` (내담자), `"guardian"` (보호자), `"both"` (보호자 + 내담자)
- **90% 보호자**: `role="guardian"`, `person_id=NULL` (정보만, 앱 미사용)
- **10% 보호자**: `person_id` 설정 → 앱 사용 가능

### Phase 1 목표
1. Client CRUD (role 필드 포함)
2. 부모-자녀 관계 관리 (ClientRelation)
3. 형제 관계 관리 (SiblingRelation, 양방향 자동)
4. Person-Client 연동 (ClientLinkRequest)
5. Role 전환 (guardian → both, both → client)
6. Subscription 쿼터 검증
7. 상태 관리 (active, inactive, archived)

---

## 📦 핵심 엔티티 (5개)

### 1. Client (내담자 및 보호자)
- 센터별 독립 엔티티 (center_id 필수)
- **role 필드로 구분**: `"client"`, `"guardian"`, `"both"`
- Person 연동 선택적 (person_id nullable)
- 상태: `active → inactive → archived`
- **데이터 동기화 없음**: Person 변경이 Client에 영향 없음
- **UUID Primary Key**: 글로벌 고유성 보장

```python
class Client(Base):
    id: Mapped[str]  # UUID
    center_id: Mapped[int]
    person_id: Mapped[str | None]  # Person 연동 (선택)

    # 역할 구분
    role: Mapped[str]  # "client" | "guardian" | "both"

    # 기본 정보
    name: Mapped[str]
    birth_date: Mapped[date | None]
    gender: Mapped[str | None]  # "male" | "female"

    # 연락처
    phone: Mapped[str | None]
    email: Mapped[str | None]
    address: Mapped[str | None]

    # 상태 관리
    status: Mapped[str]  # "active" | "inactive" | "archived"
```

**핵심 기능**:
- 전화번호로 `role="guardian"` Client 검색 (순차 등록 시 재사용)
- Role 전환: `guardian → both`, `both → client`
- 자녀 여러 명 연결 가능 (ClientRelation)

---

### 2. ClientRelation (부모-자녀 관계)
- Client 간 M:N 관계 (parent-child)
- relation_type: `"mother"` | `"father"` | `"guardian"`
- **is_primary**: 주 보호자 1명만 허용
- **양방향 자동 생성**: (child→parent, "parent") + (parent→child, "child")
- 센터 간 관계 금지

```python
class ClientRelation(Base):
    id: Mapped[str]  # UUID
    from_client_id: Mapped[str]
    to_client_id: Mapped[str]
    relation_type: Mapped[str]  # "mother", "father", "guardian", "child", "parent"
    is_primary: Mapped[bool]  # 주 보호자 여부
```

**핵심 정책**:
- is_primary=true는 1개만 (child당)
- 같은 보호자를 여러 자녀에게 연결 가능
- CASCADE 삭제: Client 삭제 시 ClientRelation도 삭제

---

### 3. SiblingRelation (형제 관계)
- Client 간 형제 관계 (직접 연결)
- **양방향 자동 생성**: (A, B) + (B, A) 동시 생성
- **relation_detail 자동 추론**: 생년월일 + 성별 → "older_brother", "younger_sister" 등

```python
class SiblingRelation(Base):
    id: Mapped[str]  # UUID
    client_id: Mapped[str]
    sibling_id: Mapped[str]
    relation_detail: Mapped[str | None]  # 자동 추론
```

**relation_detail 자동 추론 예시**:
- 첫째 (2015-03-15, female) ↔ 둘째 (2018-07-10, male)
- → "older_sister" ↔ "younger_brother"

---

### 4. ClientLinkRequest (연동 요청)
- Person → Client 연동 승인 프로세스
- 전화번호 자동 매칭 → 센터 수동 승인
- 상태: `pending → approved/rejected`
- 승인 시 Client.person_id 설정

```python
class ClientLinkRequest(Base):
    id: Mapped[str]  # UUID
    center_id: Mapped[int]
    person_id: Mapped[str]
    phone: Mapped[str]
    status: Mapped[str]  # "pending" | "approved" | "rejected"
```

---

### 5. ClientUnlinkLog (연동 해제 이력)
- 연동 해제 추적 (audit trail)
- 재연동 시 정책 판단 근거

```python
class ClientUnlinkLog(Base):
    id: Mapped[str]  # UUID
    client_id: Mapped[str]
    person_id: Mapped[str]
    reason: Mapped[str | None]
    unlinked_at: Mapped[datetime]
```

---

## 🔑 핵심 정책 (반드시 숙지)

### 1. Client 독립성
- ✅ 센터별 완전히 독립 (name, phone 등 센터 소유)
- ✅ Person 연동은 인증/식별 목적만
- ❌ Person 변경이 Client에 영향 없음
- ⚠️ 같은 Person이 여러 센터에서 다른 이름/전화번호 가능

### 2. Client.role 90/10 원칙
- ✅ 90% 보호자: `role="guardian"`, `person_id=NULL` (정보만)
- ✅ 10% 보호자: `role="guardian"`, `person_id` 설정 (앱 사용)
- ✅ Role 전환: `guardian → both`, `both → client`
- ❌ Role 전환 금지: `client → guardian`, `client → both`
- ✅ 전화번호 기반 재사용 (GET /clients/search?phone=...&role=guardian)

### 3. ClientRelation 관계 관리
- ✅ is_primary=true는 1개만 (주 보호자)
- ✅ 같은 보호자를 여러 자녀에게 연결 가능
- ❌ 센터 간 관계 금지 (같은 center_id만)
- ✅ CASCADE 삭제 (Client 삭제 → ClientRelation 삭제)
- ✅ 양방향 자동 생성: (child→parent, "parent") + (parent→child, "child")

### 4. 형제 관계 관리
- ✅ 양방향 자동 생성 (A↔B)
- ✅ relation_detail 자동 추론 (birth_date + gender)
- ❌ 자기 참조 관계 금지
- ⚠️ 센터 내에서만 관계 설정 가능

### 5. 연동 프로세스
- ✅ 1 Person = 1 Client (센터당)
- ✅ 전화번호 자동 매칭 → 실패 시 수동 선택
- ✅ 센터 승인 필수 (ClientLinkRequest)
- ❌ 같은 센터 내 중복 연동 금지

### 6. 상태 전이
- ✅ active ↔ inactive ↔ archived
- ❌ active → archived 직접 전이 금지 (inactive 경유 필수)
- ✅ archived → active 재활성화 가능
- ⚠️ inactive 6개월 → archived 자동 전환 (배치)

### 7. 삭제 정책
- ✅ 소프트 삭제 (deleted_at) 기본
- ❌ 관련 Counseling/Assessment 존재 시 하드 삭제 금지
- ✅ ClientRelation은 CASCADE 삭제
- ✅ SiblingRelation은 CASCADE 삭제
- ⚠️ `role="guardian"` Client 삭제 시 자녀 관계 확인 필요

### 8. Subscription 쿼터
- ✅ Free: 10명, Starter: 50명, Pro: unlimited
- ✅ 생성 전 쿼터 검증 필수
- ⚠️ **모든 Client 카운트** (role 무관, deleted_at=NULL만)
- ❌ 초과 시 생성 불가 (QUOTA_EXCEEDED)

---

## 🚀 주요 API

### Client
```
POST   /centers/{center_id}/clients              # Client 생성 (role 포함)
GET    /centers/{center_id}/clients              # 목록 조회 (role 필터 가능)
GET    /centers/{center_id}/clients/search       # 전화번호 검색 (role 필터: ?phone=...&role=guardian)
GET    /clients/{id}                             # 상세 조회
PATCH  /clients/{id}                             # 수정 (role 전환 포함)
DELETE /clients/{id}                             # 삭제 (소프트)
```

### ClientRelation (부모-자녀 관계)
```
POST   /centers/{center_id}/client-relations     # 관계 생성 (양방향 자동)
GET    /clients/{id}/parents                     # 부모 조회
GET    /clients/{id}/children                    # 자녀 조회
PATCH  /client-relations/{id}                    # 관계 수정 (주 보호자 변경)
DELETE /client-relations/{id}                    # 관계 삭제 (양방향)
```

### SiblingRelation
```
POST   /centers/{center_id}/sibling-relations    # 형제 관계 생성 (양방향 자동)
GET    /clients/{id}/siblings                    # 형제 조회
DELETE /sibling-relations/{id}                   # 형제 관계 삭제 (양방향)
```

### Client-Person 연동
```
POST   /client-link-requests                     # 연동 요청 (Person)
GET    /centers/{center_id}/link-requests        # 요청 목록 (센터)
POST   /link-requests/{id}/approve               # 승인 (센터)
POST   /link-requests/{id}/reject                # 거부 (센터)
POST   /clients/{id}/unlink                      # 연동 해제
```

### 배치 등록
```
POST   /centers/{center_id}/clients/batch        # 보호자 + 자녀 + 관계 일괄 생성
```

---

## ⚡ 주요 비즈니스 로직

### 보호자 재사용 흐름 (순차 등록)
```
1. 센터: 전화번호로 보호자 검색 (GET /clients/search?phone=010-1111-1111&role=guardian)
2. 시스템: 기존 role="guardian" Client 반환 (존재 시)
3. 센터: 기존 보호자 선택 or 새 보호자 생성
4. 센터: 자녀 Client 생성 (role="client")
5. 센터: ClientRelation 생성 (재사용된 보호자 + 새 자녀)
```

### Role 전환 흐름
```
1. 센터: Client role 전환 요청 (PATCH /clients/{id} {"role": "both"})
2. 시스템: Role 전환 규칙 검증 (guardian → both, both → client만 허용)
3. 시스템: Client.role 업데이트
4. 결과: 보호자가 본인 상담도 받을 수 있음 (role="both")
```

### 형제 관계 생성 흐름
```
1. 센터: SiblingRelation 생성 요청
2. 시스템: 생년월일 + 성별 조회
3. 시스템: relation_detail 자동 추론 (예: "older_sister", "younger_brother")
4. 시스템: 양방향 레코드 생성 (A→B, B→A)
5. 결과: 2개 SiblingRelation 생성 완료
```

### 연동 승인 흐름
```
1. ClientLinkRequest 조회 (status=pending)
2. 전화번호 매칭 → Client 후보 제시
3. 센터 관리자 선택
4. 중복 연동 검증 (1 Person = 1 Client per center)
5. Client.person_id 설정
6. ClientLinkRequest.status = approved
```

### Subscription 쿼터 검증
```
1. Subscription 조회
2. 현재 Client 수 카운트 (deleted_at=NULL, role 무관)
3. current_count >= client_limit → 에러
4. Client 생성
```

**주의**: 모든 Client가 쿼터에 포함됨 (role 무관)

---

## 왜 Client.role 방식으로 회귀했는가?

### Guardian 독립 엔티티 방식 (포기)
```
Guardian(id=G1, name="엄마", phone="010-1111-1111", client_id=NULL)
  ↓ GuardianChildRelation
Client(id=C1, name="첫째")
```
**치명적 문제점**:
- Guardian 90%는 `client_id=NULL` (Client 미생성)
- Person 연동은 `Client.person_id`를 통해서만 가능
- **90% Guardian은 앱 사용 불가** (Person 연동 불가)

### Client.role 방식 (최종)
```
Client(id=P1, name="엄마", role="guardian", person_id=NULL)
  ↓ ClientRelation(parent)
Client(id=C1, name="첫째", role="client", person_id=NULL)
```
**장점**:
- 모든 앱 사용자는 Client (단일 Person 연동 경로)
- `role="guardian"`, `person_id=NULL` → 90% 케이스 (정보만)
- `role="guardian"`, `person_id` 설정 → 10% 케이스 (앱 사용)
- Role 전환으로 유연한 상담 지원 (`guardian → both → client`)
- 전화번호 검색 명확 (GET /clients/search?phone=...&role=guardian)

---

## 📊 데이터 무결성

### 제약 조건
```sql
-- Client
UNIQUE(center_id, person_id) WHERE person_id IS NOT NULL
UNIQUE(center_id, phone) WHERE phone IS NOT NULL AND role = 'guardian'

-- ClientRelation
UNIQUE(from_client_id, to_client_id, relation_type)
CHECK(from_client.center_id = to_client.center_id)  -- 센터 간 관계 금지

-- SiblingRelation
UNIQUE(client_id, sibling_id)
CHECK(client_id != sibling_id)  -- 자기 참조 금지

-- 주 보호자 1개만 (Application-Level)
COUNT(is_primary=true) <= 1 per child (where relation_type in ["parent", "mother", "father", "guardian"])
```

**Application Level 검증** (FK/Enum 제약 없음):
- ClientRelation 참조 무결성 (from_client_id, to_client_id → Client.id)
- role Enum 값 검증 ("client", "guardian", "both")
- relation_type Enum 값 검증
- 주 보호자 1개만 검증
- 센터 간 관계 금지 검증
- Role 전환 규칙 검증 (guardian → both → client)

---

## 🎨 프론트엔드 고려사항

### 1. Client 생성 UX
- Role 선택: "내담자", "보호자", "보호자 + 내담자" (radio button)
- 전화번호 입력 시 기존 `role="guardian"` Client 검색 자동 표시
- "기존 보호자 재사용" vs "새 보호자 생성" 선택 UI
- 생년월일 입력 시 성인/아동 자동 구분
- Subscription 쿼터 남은 수 표시 (모든 Client 카운트)

### 2. Role 관리 UX
- Role 전환 버튼 표시 (guardian → both, both → client만 허용)
- `role="client"` → 전환 버튼 비활성화 (전환 불가)
- Role 전환 시 확인 모달 (되돌릴 수 없음 경고)
- 자동 완성: 보호자 선택 시 전화번호/주소 자동 입력

### 3. 관계 관리 UX
- 주 보호자는 별도 표시 (⭐ 아이콘)
- 형제 관계는 양방향 자동 생성 표시
- relation_detail 자동 추론 결과 표시
- ClientRelation 양방향 표시 (parent ↔ child)

### 4. 연동 관리 UX
- 전화번호 매칭 후보 목록 제시
- 연동 요청 알림 (센터 관리자)
- 연동 해제 확인 모달 (ClientUnlinkLog 기록)
- `role="client"` Client는 Person 연동 불가 안내

---

## 🔧 Phase 2/3 Preview

### Phase 2
- 가족 관계 시각화 (가계도)
- Role 전환 자동 제안 (상담 기록 패턴 분석)
- 형제 관계 자동 추론 개선 (fuzzy matching)
- archived 자동 전환 배치

### Phase 3
- 복잡한 가족 구조 지원 (위탁, 입양)
- Client 이력 관리 (변경 이력, role 전환 이력)
- 외부 시스템 연동 (바우처)
- 다중 센터 통합 조회 (SaaS 관리자)

---

## 📚 상세 문서

| 문서 | 용도 |
|------|------|
| `domain.md` | 전체 설계 (엔티티, 비즈니스 규칙) - Client.role 기반 |
| `scenarios.md` | 7개 핵심 시나리오 - Client.role 기반 |
| `edge-cases.md` | 48개 예외 상황 처리 - Client.role 기반 |
| `decision-log.md` | 주요 의사결정 기록 (Q9: Guardian 포기 이유) |
| `api.md` | API 엔드포인트 상세 - Client.role 기반 |

---

## ✅ 구현 체크리스트

### P0 (필수)
- [ ] Client CRUD (role 필드 포함)
- [ ] ClientRelation CRUD (양방향 자동)
- [ ] SiblingRelation CRUD (양방향 자동)
- [ ] 보호자 전화번호 검색 (GET /clients/search?role=guardian&phone=...)
- [ ] Role 전환 (guardian → both, both → client)
- [ ] Role 전환 규칙 검증 (client → 다른 role 금지)
- [ ] 주 보호자 1개 검증
- [ ] ClientLinkRequest 승인 프로세스
- [ ] 1 Person = 1 Client (센터당) 검증
- [ ] Subscription 쿼터 검증 (모든 Client 카운트)
- [ ] 소프트 삭제 (deleted_at)
- [ ] 센터 데이터 격리 (보안)

### P1 (중요)
- [ ] 상태 전이 규칙 검증
- [ ] 센터 간 관계 검증
- [ ] 자기 참조 관계 검증
- [ ] 연동 해제 (ClientUnlinkLog)
- [ ] 전화번호 자동 매칭
- [ ] relation_detail 자동 추론
- [ ] 배치 등록 API
- [ ] role="client" Client Person 연동 금지 검증

### P2 (선택)
- [ ] archived 자동 전환 (배치)
- [ ] Role 전환 자동 제안 (상담 기록 패턴 분석)
- [ ] fuzzy matching (보호자 검색)
- [ ] 동시성 테스트

---

## 🚨 주의사항

1. **Client.role 필수** - 모든 Client는 role 필드 보유 ("client", "guardian", "both")
2. **90/10 원칙** - 대부분 `role="guardian"`, `person_id=NULL` (정보만)
3. **전화번호 재사용** - 순차 등록 시 `role="guardian"` Client 검색 후 재사용
4. **Role 전환 규칙** - guardian → both → client (단방향만 허용)
5. **주 보호자 1개** - is_primary=true는 1개만 (Application-Level)
6. **형제 양방향** - SiblingRelation은 (A, B) + (B, A) 자동 생성
7. **ClientRelation 양방향** - (child→parent) + (parent→child) 자동 생성
8. **쿼터 카운트** - 모든 Client 카운트 (role 무관, deleted_at=NULL만)
9. **센터별 독립** - 모든 Client는 center_id 보유
10. **role="client" 연동 금지** - Person 연동은 role="guardian" 또는 "both"만 가능

---

**작성일**: 2026-01-23
**Version**: 3.0 (Client.role 기반 설계)
