# Counseling 도메인 의사결정 기록

> First Principles 기반 주요 설계 결정 및 근거

---

## 목차

1. [Q1: 상담 유형(Counseling)이란 무엇인가?](#q1-상담-유형counseling이란-무엇인가)
2. [Q2: 상담 케이스(CounselingCase)는 왜 필요한가?](#q2-상담-케이스counselingcase는-왜-필요한가)
3. [Q3: CounselingSession과 상담 케이스의 관계는?](#q3-counselingsession과-상담-케이스의-관계는)
4. [Q4: 상담의 대상은 Client인가 Person인가?](#q4-상담의-대상은-client인가-person인가)
5. [Q5: 공동 상담(짝치료)은 어떻게 지원하는가?](#q5-공동-상담짝치료은-어떻게-지원하는가)
6. [Q6: CounselingSession과 Schedule의 관계는?](#q6-counselingsession과-schedule의-관계는)
7. [Q7: 상담 기록은 어떻게 관리하는가?](#q7-상담-기록은-어떻게-관리하는가)
8. [Q8: 상담 종결과 재개는 어떻게 처리하는가?](#q8-상담-종결과-재개는-어떻게-처리하는가)
9. [Q9: 집단상담(Group Counseling)은 어떻게 지원하는가?](#q9-집단상담group-counseling은-어떻게-지원하는가)
10. [Q10: CounselingSession 순차 번호는 어떻게 관리하는가?](#q10-counselingsession-순차-번호는-어떻게-관리하는가)
11. [Q11: 참여자(상담사/내담자) 관리는 어떻게 통합하는가?](#q11-참여자상담사내담자-관리는-어떻게-통합하는가)

---

## Q1: 상담 유형(Counseling)이란 무엇인가?

### 질문
상담 유형(개인상담, 부부상담 등)을 어떻게 관리해야 하는가?

### 옵션
- **옵션 A**: 텍스트 필드로 유형 저장
- **옵션 B**: 시스템 Enum으로 유형 정의
- **옵션 C**: 센터별 유형 관리 (Counseling 테이블)

### 결정
**옵션 C: 센터별 유형 관리**

### 근거

#### 1. 센터별 다른 유형
```
센터마다 제공하는 상담 유형이 다름:

센터 A (아동 전문):
- 개인상담, 놀이치료, 부모상담, 가족상담

센터 B (성인 전문):
- 개인상담, 부부상담, 집단상담, 심리검사 상담

센터 C (학교 상담실):
- 개인상담, 진로상담, 학업상담
```

#### 2. 유형별 관리 필요성
```
통계:
- "이번 달 개인상담 50건, 부부상담 20건"
- 유형별 매출, 효과 분석

요금 정책:
- 개인상담: 회당 10만원
- 부부상담: 회당 15만원
- 가족상담: 회당 20만원

운영:
- "집단상담은 더 이상 진행 안 함" → 비활성화
```

#### 3. Counseling 구조
```
Counseling (상담 유형):
- name: "개인상담", "부부상담", "가족상담"
- service_type: 개인/부부/가족/집단 구분
- description: 상담 목표 또는 유형에 대한 설명

센터가 유형을 직접 정의하고 관리
```

### 대안 검토

#### ❌ 대안 1: 텍스트 필드
```python
CounselingCase.type = "개인상담"  # 자유 입력
```
**문제**:
- 오타로 인한 불일치 ("개인상담" vs "개인 상담")
- 통계 집계 어려움
- 유형별 정책 관리 불가

#### ❌ 대안 2: 시스템 Enum
```python
class CounselingType(Enum):
    INDIVIDUAL = "individual"
    COUPLE = "couple"
    FAMILY = "family"
```
**문제**:
- 센터별 커스터마이징 불가
- 새 유형 추가 시 코드 배포 필요
- 모든 센터에 같은 유형 강제

### 결론
✅ **센터별 유형 관리**. 센터 자율성 + 통계 + 정책 관리.

---

## Q2: 상담 케이스(CounselingCase)는 왜 필요한가?

### 질문
"상담 케이스"의 단위는 무엇인가? 매 방문이 케이스인가, 아니면 연속된 상담 여정이 하나의 케이스인가?

### 옵션
- **옵션 A**: 방문 단위 (매번 새 케이스)
- **옵션 B**: 계약/여정 단위 (연속된 상담 여정)

### 결정
**옵션 B: 계약/여정 단위**

### 근거

#### 1. 상담의 본질
```
상담은 일회성이 아닌 과정(Process):
- 초기 면담 → 문제 탐색 → 해결 방안 → 종결
- 연속된 Session으로 구성
- 목표 달성까지의 여정

예시:
"김철수 우울증 상담" (CounselingCase)
  - Session 1: 초기 면담, 호소 문제 파악
  - Session 2: 심층 탐색
  - Session 3: 해결 방안 논의
  - ...
  - Session 10: 종결
```

#### 2. 케이스 단위의 장점
```
추적성:
- 같은 내담자의 상담 이력 추적
- Session별 진행 상황 파악
- 목표 달성 여부 평가

통계:
- 평균 상담 Session 수
- 종결률, 중도 탈락률
- 유형별 상담 효과
```

#### 3. CounselingCase 구조
```
CounselingCase (상담 케이스 = 계약 단위):
- counseling_id: 상담 유형 참조 (FK → Counseling)
- description: 케이스별 추가 설명
- total_sessions: 계획된 총 회기 수
- status: ACTIVE, COMPLETED, CANCELLED

하나의 상담 유형(Counseling)에 여러 케이스(CounselingCase)가 속함
```

### 대안 검토

#### ❌ 대안 1: 방문 단위
```
매 방문마다 새 케이스 생성:
- CounselingCase(id=1, date="2026-01-01")  # Session 1
- CounselingCase(id=2, date="2026-01-08")  # Session 2
- CounselingCase(id=3, date="2026-01-15")  # Session 3
```
**문제**:
- 연속성 파악 불가 (어떤 케이스가 연결된 것인지?)
- 케이스 단위 통계 불가
- 실무와 불일치 (상담사는 케이스 단위로 관리)

### 결론
✅ **계약/여정 단위**. 상담 케이스는 연속된 여정, Session은 케이스에 속함.

---

## Q3: CounselingSession과 상담 케이스의 관계는?

### 질문
CounselingSession(상담 일정 기록)은 상담 케이스(CounselingCase)에 어떻게 속하는가?

### 옵션
- **옵션 A**: Session 정보를 케이스에 포함 (단일 엔티티)
- **옵션 B**: Session를 별도 관리 (케이스-Session 분리)

### 결정
**옵션 B: 케이스-Session 분리**

### 근거

#### 1. 개별 상담 방문 기록 관리
```
각 CounselingSession마다 기록해야 할 정보:

순차 번호: 1, 2, 3, ... (방문 순서 추적)
상태: 예약됨, 완료, 노쇼, 취소
Schedule 연동: 예약 일시 정보
상담 기록: Document 도메인에 위임
```

#### 2. Schedule 연동
```
각 CounselingSession은 Schedule과 연동:

CounselingSession 1 ← Schedule (2026-01-15 10:00)
CounselingSession 2 ← Schedule (2026-01-22 10:00)
CounselingSession 3 ← Schedule (2026-01-29 10:00)

일정 취소 → CounselingSession은 유지, 일정 연결만 해제
```

#### 3. 상태 분리
```
케이스 상태 (CounselingCase.status):
- ACTIVE: 상담 진행 중
- COMPLETED: 종결
- CANCELLED: 취소

CounselingSession 상태:
- SCHEDULED: 예약됨
- COMPLETED: 완료
- NO_SHOW: 노쇼
- CANCELLED: 취소

케이스가 ACTIVE여도 개별 CounselingSession은 NO_SHOW일 수 있음
→ 독립적인 상태 관리 필요
```

#### 4. 관계 구조
```
Counseling (상담 유형)
    ↓ 1:N
CounselingCase (상담 케이스)
    - counseling_id FK → Counseling
    ↓ 1:N
CounselingSession (상담 일정 기록)
    - counseling_case_id FK → CounselingCase
```

### 대안 검토

#### ❌ 대안 1: 단일 엔티티
```
CounselingCase에 Session 정보 포함:
- sessions: [{number: 1, content: "...", ...}, ...]
```
**문제**:
- 개별 조회/수정 복잡
- Schedule 연동 불가 (FK 관계 설정 불가)
- 상태별 관리 어려움

### 결론
✅ **케이스-Session 분리**. 개별 상담 방문 기록 관리 + Schedule 연동 + 독립적 상태.

> **참고**: 결제/청구 단위(회기)는 별도 Billing 도메인에서 관리합니다.

---

## Q4: 상담의 대상은 Client인가 Person인가?

### 질문
상담 기록에서 "누가 상담받았는가"를 어떻게 저장하는가?

### 옵션
- **옵션 A**: Client 참조 (센터별 내담자)
- **옵션 B**: Person 참조 (전역 신원)

### 결정
**옵션 A: Client 참조**

### 근거

#### 1. Client vs Person vs Member 설계 원칙

| 항목 | Client (내담자) | Member (센터 멤버) |
|------|----------------|-------------------|
| **Person 연동** | 선택적 (`person_id` nullable) | 필수 (`person_id` NOT NULL) |
| **정보 소유** | 센터가 자체 필드 보유 (`name`, `contact_phone`) | Person 정보 참조만 (자체 필드 없음) |
| **정보 변경** | 센터가 독립적으로 수정 | Person 수정 시 자동 반영 |

```
Client:
- 센터별로 독립적인 엔티티
- person_id는 NULL 가능 (연동 전 내담자도 상담 가능)
- 센터가 정보 소유 및 관리 (name, contact_phone 등)

Person:
- 전역 신원 (앱 로그인, 계정 관리)
- Client와 연동 시에만 관계 형성
- 연동되지 않은 내담자도 존재함
```

#### 2. Client 참조가 필수인 이유
```
시나리오: 아동 내담자
- 아동은 앱 계정이 없음 (Person 없음)
- 센터가 직접 Client 생성하여 관리
- Client.person_id = NULL 상태로 상담 진행

시나리오: 방문 상담 (일회성)
- 보호자가 앱 가입 없이 전화 예약
- 센터가 Client만 생성 (name, contact_phone)
- Person 연동 없이 상담 기록 관리

→ Person 참조 시 이런 내담자의 상담 기록 불가
```

#### 3. Multi-Tenancy 격리
```
같은 Person이 여러 센터 이용 시:

센터 A:
- Client(id=10, person_id=100, name="김아이", notes="센터 A 메모")
- CounselingCase(client_id=10, center_id=A)

센터 B:
- Client(id=20, person_id=100, name="김아이(별칭)", notes="센터 B 메모")
- CounselingCase(client_id=20, center_id=B)

→ Client.id로 참조 (center_id 중복 불필요)
→ Client가 이미 센터별로 격리됨
→ 각 센터는 자기 센터 Client의 상담만 조회
```

#### 4. Client 도메인과의 관계
```
조회 시:
- CounselingCase → CounselingCaseParticipant(type="client") → Client.id
- Client.center_id로 센터 격리 (RLS)
- 필요 시 Client.person_id로 Person 정보 JOIN

스키마:
CounselingCase → CounselingCaseParticipant(participant_type="client", participant_id)
                                                           ↓
                                               Client(id, center_id, person_id)
                                                           ↓ optional
                                                        Person(id)
```

### 대안 검토

#### ❌ 대안 2: Person 참조
```python
CounselingCase.person_id → Person.id
```
**문제**:
- Person 없는 내담자 (아동, 일회성 방문) 상담 기록 불가
- Client.person_id가 nullable인 설계와 충돌
- center_id를 별도로 관리해야 함 (중복)

### 결론
✅ **Client 참조**. 센터별 독립 엔티티 + Person 연동 없이도 상담 가능.

---

## Q5: 공동 상담(짝치료)은 어떻게 지원하는가?

### 질문
한 상담 케이스에 여러 상담사와 여러 내담자가 참여할 수 있는가?

### 핵심 개념

**짝(Pair)** = 상담사 1명 + 내담자 1명 (1:1 담당 관계)
**짝치료** = 여러 짝이 함께 참여하는 상담

### 옵션
- **옵션 A**: 단일 짝 (상담사 1명 + 내담자 1명)
- **옵션 B**: 다중 짝 지원 (여러 상담사 + 여러 내담자)

### 결정
**옵션 B: 다중 짝 지원 (짝치료)**

### 근거

#### 1. 짝치료 시나리오
```
부부상담:
- 상담사 A ↔ 남편 (짝 1)
- 상담사 B ↔ 아내 (짝 2)

가족상담:
- 상담사 A ↔ 부모 (짝 1, 2)
- 상담사 B ↔ 아동 (짝 3)

슈퍼비전:
- 수련 상담사 ↔ 내담자 (짝)
- 지도 상담사 (관찰자, 짝 없음)
```

#### 2. 다대다 관계의 필요성
```
상담사 관점:
- 1명이 여러 내담자 담당 가능 (가족상담 시 부모 모두 담당)

내담자 관점:
- 1명에게 여러 상담사 가능 (주 상담사 + 보조 상담사)

→ N:M 관계 테이블로 짝 관리
```

#### 3. 상담사 변경
```
시나리오:
- Session 1-5: 상담사 A ↔ 내담자
- Session 6~: 상담사 A 휴직, 상담사 B가 인계

→ 기존 짝(A) 이력 유지 + 새 짝(B) 추가
→ 변경 이력 추적 가능
```

### 대안 검토

#### ❌ 대안 1: 단일 담당
```
CounselingCase.counselor_id = 상담사 1명
```
**문제**:
- 공동 상담 불가
- 상담사 변경 시 이력 소실
- 실무 요구사항 미충족

### 짝 관계의 표현 방식

CounselingCaseParticipant 테이블로 통합 관리:

```
표현 방식:
- CounselingCaseParticipant: 케이스에 참여하는 모든 참여자 (상담사 + 내담자)
  - participant_type="counselor" → 상담사
  - participant_type="client" → 내담자
- Document.uploader_id: 기록 작성자 (담당 상담사)

예시 (짝치료):
- CounselingCaseParticipant:
  - (type="counselor", id=상담사A)
  - (type="counselor", id=상담사B)
  - (type="client", id=내담자1)
- Document (상담사 A 작성) → "A가 이 Session에서 기록함"
- 담당 관계 메모 → CounselingCase.description 또는 Session 메모로 관리

장점:
- 단일 테이블로 모든 참여자 관리
- Document 인프라 재사용
- Session마다 유연한 담당 변경 가능
- 참여 이력 추적 (assigned_at/unassigned_at)
```

### 결론
✅ **다중 짝 지원**. N:M 관계 테이블 + Document로 짝 관계 표현.

---

## Q6: CounselingSession과 Schedule의 관계는?

### 질문
CounselingSession(상담 일정 기록)과 Schedule(일정)의 관계는?

### 옵션
- **옵션 A**: CounselingSession에 일정 정보 포함
- **옵션 B**: CounselingSession과 Schedule 분리, 연동
- **옵션 C**: Schedule 없이 CounselingSession만 관리

### 결정
**옵션 B: CounselingSession과 Schedule 분리, 연동**

### 근거

#### 1. Schedule 연동의 필요성
```
실무 흐름:
1. 상담 예약 → Schedule 생성
2. Schedule에 맞춰 상담 진행
3. 완료 후 CounselingSession 기록 작성

Schedule 정보:
- scheduled_at: 예약 일시
- duration: 상담 시간
- 상담실, 알림 설정 등
```

#### 2. Schedule 삭제 시 처리
```
Schedule 취소 시:
- Schedule 삭제
- CounselingSession은 유지 (기록 보존)
- CounselingSession-Schedule 연결만 해제

이유:
- "취소된 상담"도 기록으로 남겨야 함
- 노쇼, 취소 통계 필요
```

#### 3. Schedule 없는 CounselingSession
```
과거 기록 입력:
- 이미 진행된 상담 기록 입력
- Schedule 없이 CounselingSession만 생성 가능
- schedule_id = NULL
```

### 대안 검토

#### ❌ 대안 1: CounselingSession에 일정 포함
```
CounselingSession.scheduled_at = "2026-01-15 10:00"
```
**문제**:
- Schedule 도메인과 중복
- 일정 변경 시 양쪽 동기화 필요
- 캘린더 통합 어려움

#### ❌ 대안 3: Schedule 없이 CounselingSession만
```
Schedule은 별도, CounselingSession과 연동 없음
```
**문제**:
- 예약-상담 연결 추적 불가
- 실무 흐름과 불일치

### 결론
✅ **CounselingSession-Schedule 분리 연동**. Schedule 삭제 시 CounselingSession 보존 + 과거 기록 지원.

---

## Q7: 상담 기록은 어떻게 관리하는가?

### 질문
상담 기록(내용, 요약, 메모)은 어디에 저장하고, 누가 볼 수 있는가?

### 옵션

#### 옵션 A: CounselingSession 필드로 관리
```python
class CounselingSession(Base):
    content: Mapped[str]        # 상담 내용
    summary: Mapped[str]        # 상담 요약
    private_memo: Mapped[str]   # 비공개 메모
```
- **장점**: 단순한 구조
- **단점**: 공동 상담 시 여러 상담사의 private_memo 관리 불가 (1:N 필요)

#### 옵션 B: 별도 CounselingRecord 테이블
```python
class CounselingRecord(Base):
    session_id: Mapped[int]
    counselor_id: Mapped[int]   # 작성자
    content: Mapped[str]
    is_private: Mapped[bool]
```
- **장점**: 상담사별 기록 분리
- **단점**: 중복 스키마 (접근 제어 로직 재구현 필요)

#### 옵션 C: Document 도메인에 위임 (역방향 조회)
```python
# CounselingSession에는 document_ids 필드 없음
# Document가 entity_type + entity_id로 Session을 참조
class Document(Base):
    entity_type: Mapped[str]  # "counseling_session"
    entity_id: Mapped[str]    # session_id
```
- **장점**: Document의 access_level 재사용, 파일 첨부도 동일 방식, 도메인 간 결합도 낮음
- **단점**: 조회 시 역방향 쿼리 필요

### 결정
**옵션 C: Document 도메인에 위임 (역방향 조회 방식)**

### 근거

#### 1. 공동 상담 시 다대다 관계 해결
```
문제:
- 여러 상담사 × 여러 기록 = 복잡한 관계
- 상담사 A의 비공개 메모 vs 상담사 B의 비공개 메모

해결:
- 각 기록을 Document로 생성
- Document.uploader_id = 작성 상담사
- Document.access_level로 공개 범위 결정
```

#### 2. Document access_level 재사용
```
공식 기록 (센터 공유):
- Document(entity_type="counseling_session", entity_id=session_id)
- access_level="center"
- 같은 센터 상담사 모두 열람 가능

비공개 메모 (작성자만):
- Document(entity_type="counseling_session", entity_id=session_id)
- access_level="private"
- uploader_id=상담사A → 상담사 A만 열람

보호자 공유용 요약:
- access_level="public"
- JWT 서명된 URL로 외부 공유
```

#### 3. 스키마 구조 (역방향 조회)
```python
class CounselingSession(Base):
    # document_ids 필드 없음 - Document에서 역방향 조회
    pass

# Document 테이블 (Document 도메인)
class Document(Base):
    entity_type: Mapped[str]    # "counseling_session"
    entity_id: Mapped[str]      # session_id (UUID)
    uploader_id: Mapped[str]    # 작성 상담사
    access_level: Mapped[str]   # "private" | "center" | "public"
    category: Mapped[str]       # "counseling_goal" | "counseling_content" | ...
    content: Mapped[str | None] # 텍스트 콘텐츠 (상담일지용)
```

**조회 방식**:
```python
# Session에 연결된 Document 조회
documents = await document_service.get_by_entity(
    entity_type="counseling_session",
    entity_id=session_id,
    viewer_id=auth.member_id,  # private 필터링용
)
```

#### 4. 실제 사용 예시
```
Session ID="session-100" (부부상담, 상담사 A+B 공동 진행)

Documents (역방향 조회로 찾음):
1. 상담 목표 (센터 공유)
   - entity_type="counseling_session", entity_id="session-100"
   - access_level="center", category="counseling_goal"
   - content="불안 증상 완화"

2. 상담 내용 (센터 공유)
   - entity_type="counseling_session", entity_id="session-100"
   - access_level="center", category="counseling_content"
   - content="내담자의 자동적 사고 패턴 탐색..."

3. 상담사 A 개인 메모
   - entity_type="counseling_session", entity_id="session-100"
   - access_level="private", category="counseling_private_memo"
   - uploader_id=상담사A → A만 열람

4. 상담사 B 개인 메모
   - entity_type="counseling_session", entity_id="session-100"
   - access_level="private", category="counseling_private_memo"
   - uploader_id=상담사B → B만 열람

# CounselingSession에는 document_ids 없음
# Document.entity_id로 역방향 조회
```

### 대안 검토

#### ❌ 대안 1: CounselingSession 필드로 관리
```python
CounselingSession.content = "상담 내용"
CounselingSession.private_memo = "비공개 메모"
```
**문제**:
- 공동 상담 시 여러 상담사의 private_memo 분리 불가
- 1:N 관계가 되어 스키마 복잡도 증가
- 접근 제어 로직 별도 구현 필요

#### ❌ 대안 2: 별도 CounselingRecord 테이블
```python
class CounselingRecord(Base):
    session_id, counselor_id, content, is_private
```
**문제**:
- Document 도메인과 중복 (접근 제어, 버전 관리 등)
- 파일 첨부 시 또 다른 테이블 필요
- 일관성 없는 구조

### 결론
✅ **Document 도메인에 위임**. 접근 제어 재사용 + 다대다 해결 + 파일 첨부 통합.

---

## Q8: 상담 종결과 재개는 어떻게 처리하는가?

### 질문
종결된 상담 케이스를 다시 진행할 수 있는가?

### 옵션
- **옵션 A**: 종결 후 재개 불가 (새 케이스 생성)
- **옵션 B**: 종결 후 재개 가능 (같은 케이스 유지)

### 결정
**옵션 B: 종결 후 재개 가능**

### 근거

#### 1. 재개 시나리오
```
시나리오 1: 종결 후 재발
- 우울증 상담 Session 10 종결
- 6개월 후 증상 재발
- 기존 케이스 재개 (이력 연속성)

시나리오 2: 추가 상담 필요
- 목표 달성 후 종결
- 새로운 이슈 발생
- 기존 케이스에 Session 추가
```

#### 2. 케이스 유지의 장점
```
이력 연속성:
- 과거 Session 기록 참조 용이
- 진행 경과 한눈에 파악
- 통계 연속성 (같은 케이스로 집계)

vs 새 케이스 생성:
- 이력 분리 → 과거 기록 별도 조회 필요
- 통계 분리 → 같은 내담자 상담이 2건으로 집계
```

#### 3. 상태 전이
```
허용되는 전이:
- ACTIVE → COMPLETED (종결)
- ACTIVE → CANCELLED (취소)
- COMPLETED → ACTIVE (재개)
- CANCELLED → ACTIVE (재개)

종결/취소 후 재개:
- 상태만 ACTIVE로 변경
- 기존 Session 기록 유지
- 새 Session 추가 가능
```

### 대안 검토

#### ❌ 대안 1: 재개 불가
```
종결 후 새 케이스만 생성 가능
```
**문제**:
- 같은 내담자 상담 이력 분리
- 케이스 단위 통계 왜곡
- 실무 요구사항 미충족

### 결론
✅ **재개 가능**. 이력 연속성 + 통계 일관성 + 실무 유연성.

---

## Q9: 집단상담(Group Counseling)은 어떻게 지원하는가?

### 질문
상담사 1명 + 내담자 다수인 집단상담은 짝치료 모델로 지원 가능한가?

### 결정
**기존 N:M 관계 테이블로 지원**

### 근거

```
집단상담 vs 짝치료:

짝치료:
- 상담사 N명 ↔ 내담자 M명
- 각 상담사가 특정 내담자 담당 (짝 개념)

집단상담:
- 상담사 1명 ↔ 내담자 다수
- 모든 내담자가 같은 Session 참여 (그룹 개념)

→ 짝 개념 없이도 N:M 관계 테이블로 표현 가능
```

```
집단상담 케이스:
- CounselingCaseParticipant:
  - (type="counselor", id=상담사A)
  - (type="client", id=내담자1)
  - (type="client", id=내담자2)
  - ...
  - (type="client", id=내담자10)
- 그룹명/설명: CounselingCase.description 활용

출석 관리:
- CounselingSessionParticipant로 세션별 출석 기록
- 10명 중 7명만 출석 → 7명만 status="attended"
- 결석자 → status="no_show" 또는 "excused"
```

### 결론
✅ **기존 모델 확장**. N:M 관계 테이블 + Document로 집단상담 지원.

---

## Q10: CounselingSession 순차 번호는 어떻게 관리하는가?

### 질문
CounselingSession의 순차 번호(1, 2, 3...)를 어떻게 할당하는가?

### 옵션
- **옵션 A**: 자동 순차 번호
- **옵션 B**: 수동 지정 (빈 번호 허용)
- **옵션 C**: 번호 없음 (날짜 순 정렬)

### 결정
**옵션 A: 자동 순차 번호**

### 근거

```
실무 요구:
- "오늘 3번째 상담 진행했습니다"
- "총 10번 중 7번까지 완료"
→ 명확한 번호가 방문 순서 추적에 필수

자동 할당:
- session_number = max(케이스 내 CounselingSession) + 1
- 첫 CounselingSession = 1

취소/노쇼 처리:
- 3번 취소 → session_number = 3 유지, status = CANCELLED
- 다음 CounselingSession → session_number = 4 (결번 없음)
→ 번호 재사용/재정렬 없음, 이력 추적 명확
```

### 대안 검토

#### ❌ 대안 2: 수동 지정
- 과거 기록 입력 시 편리하지만 중복 번호 위험

#### ❌ 대안 3: 번호 없음
- "몇 번째 방문인지" 직관적이지 않음, 통계/보고서 작성 어려움

### 결론
✅ **자동 순차 번호**. 결번 없이 순차 증가, 취소/노쇼도 번호 유지.

---

## Q11: 참여자(상담사/내담자) 관리는 어떻게 통합하는가?

### 질문
상담 케이스의 상담사와 내담자를 별도 테이블(CounselingCounselors, CounselingClients)로 관리할 것인가, 단일 Participant 테이블로 통합할 것인가?

### 옵션
- **옵션 A**: 별도 테이블 (CounselingCounselors + CounselingClients)
- **옵션 B**: 통합 테이블 (CounselingCaseParticipant + participant_type)

### 결정
**옵션 B: 통합 테이블 (CounselingCaseParticipant)**

### 근거

#### 1. 기존 구조의 문제점
```
별도 테이블 방식:
- CounselingCounselors: 케이스별 상담사 목록
- CounselingClients: 케이스별 내담자 목록

문제점:
1. 스키마 중복 (assigned_at, unassigned_at 등 동일 필드)
2. 출석 관리 시 또 다른 테이블 필요 (SessionAttendance)
3. 조회 시 여러 테이블 JOIN 필요
4. 상담사/내담자 변경 이력 관리 로직 중복
```

#### 2. 통합 Participant 모델
```
CounselingCaseParticipant:
- counseling_case_id (FK)
- participant_type: "client" | "counselor"
- participant_id: clients.id 또는 center_members.id
- assigned_at: 참여 시작일
- unassigned_at: 참여 종료일 (NULL = 현재 참여 중)

장점:
1. 단일 테이블로 모든 참여자 관리
2. 변경 이력 추적 통합 (assigned_at/unassigned_at)
3. 조회 쿼리 단순화
4. 확장 용이 (새 participant_type 추가 가능)
```

#### 3. 세션별 출석 관리
```
CounselingSessionParticipant:
- counseling_session_id (FK)
- participant_type: "client" | "counselor"
- participant_id
- status: ATTENDED | NO_SHOW | EXCUSED | LATE
- assigned_at / unassigned_at

케이스 참여와 세션 출석 분리:
- CounselingCaseParticipant: 케이스 전체 참여 여부
- CounselingSessionParticipant: 개별 세션 출석 여부

집단상담 시나리오:
- 케이스 참여자 10명 중 오늘 7명만 출석
- 각 세션별 출석/불참 기록 가능
```

#### 4. 상담사 변경 이력
```
시나리오: 상담사 A → 상담사 B 인계

CounselingCaseParticipant:
1. (case_id=1, type="counselor", id=A, assigned_at=1월1일, unassigned_at=3월1일)
2. (case_id=1, type="counselor", id=B, assigned_at=3월1일, unassigned_at=NULL)

→ 단일 테이블에서 변경 이력 조회 가능
→ unassigned_at IS NULL로 현재 담당자 필터링
```

### 대안 검토

#### ❌ 대안 1: 별도 테이블 유지
```python
class CounselingCounselors(Base):
    counseling_case_id, counselor_id, assigned_at, unassigned_at

class CounselingClients(Base):
    counseling_case_id, client_id, assigned_at, unassigned_at
```
**문제**:
- 스키마 중복
- 출석 관리 시 SessionCounselorAttendance + SessionClientAttendance 또 분리 필요
- 조회/통계 쿼리 복잡도 증가

### 관계 구조
```
Counseling (상담 유형)
    ↓ 1:N
CounselingCase (상담 케이스)
    ↓ 1:N
CounselingCaseParticipant (케이스 참여자)
    - participant_type: "client" | "counselor"
    - participant_id → clients.id 또는 center_members.id

CounselingCase
    ↓ 1:N
CounselingSession (상담 세션)
    ↓ 1:N
CounselingSessionParticipant (세션 출석)
    - participant_type: "client" | "counselor"
    - participant_id
    - status: ATTENDED | NO_SHOW | EXCUSED | LATE
```

### 결론
✅ **통합 Participant 테이블**. 스키마 단순화 + 이력 관리 통합 + 출석 관리 확장.

---

## 요약

| 의사결정 | 핵심 이유 | 대안 |
|----------|----------|------|
| **센터별 상담 유형 관리 (Counseling)** | 센터 자율성, 커스터마이징 | ❌ Enum (유연성 부족) |
| **계약/여정 단위 케이스 (CounselingCase)** | 연속된 상담 여정, 추적성 | ❌ 방문 단위 (연속성 없음) |
| **케이스-Session 분리** | 개별 상담 방문 기록 관리, Schedule 연동 | ❌ 단일 엔티티 (관리 어려움) |
| **Client 참조** | 센터별 독립 엔티티, Person 연동 없이도 상담 가능 | ❌ Person (연동 없는 내담자 불가) |
| **짝치료 (다중 짝)** | N:M 관계, 부부/가족상담 지원 | ❌ 단일 짝 (짝치료 불가) |
| **CounselingSession-Schedule 분리 연동** | Schedule 삭제 시 기록 보존 | ❌ 포함 (중복, 동기화) |
| **Document 도메인 위임** | 접근 제어 재사용, 다대다 해결 | ❌ Session 필드 (공동 상담 미지원) |
| **종결 후 재개 가능** | 이력 연속성, 통계 일관 | ❌ 재개 불가 (이력 분리) |
| **집단상담 N:M 모델** | 기존 모델 확장, 별도 처리 불필요 | ❌ 별도 모델 (불필요한 복잡성) |
| **자동 순차 번호** | 방문 순서 추적, 결번 없음 | ❌ 수동/번호 없음 (추적 어려움) |
| **통합 Participant 테이블** | 스키마 단순화, 이력 관리 통합, 출석 확장 | ❌ 별도 테이블 (중복, 복잡성) |

> **참고**: 결제/청구 단위(회기)는 별도 Billing 도메인에서 관리합니다.

---

**작성일**: 2026-01-15
**Version**: 2.0
