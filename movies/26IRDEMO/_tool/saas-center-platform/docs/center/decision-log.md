# Center 도메인 설계 의사결정 기록

> 제1원칙 기반 질문-답변을 통한 Center 도메인 설계 의사결정 과정

---

## 의사결정 일자

2026-01-14

---

## 의사결정 방식

**제1원칙(First Principles) 접근**:
1. 근본 개념부터 정의 (Center의 책임과 역할)
2. 비즈니스 요구사항을 구체적 시나리오로 검증
3. 여러 옵션 제시 후 트레이드오프 분석
4. 명시적 의사결정 및 근거 기록

---

## Center 도메인 범위

Center 모듈은 다음을 담당합니다:
- **센터 기본 정보**: 이름, 주소, 연락처, 로고 등
- **상담실(Room)**: 센터 내 상담 공간 관리
- **운영 시간(OperatingHour)**: 운영/휴게/휴무 통합 관리
- **멤버십(Membership)**: 센터-직원 소속 관계 관리 (시간 기반, 권한 정책 연동)

---

## 질문 1: Center 기본 정보

### 질문
Center 엔티티에 어떤 정보를 포함하나요?

### 옵션
- **옵션 A**: 최소 정보 (name, code만)
- **옵션 B**: 기본 정보 (name, code, phone, address)
- **옵션 C**: 상세 정보 (name, code, phone, address, description, logo_url 등)

### 결정
**옵션 C: 상세 정보**

### 근거
- 센터 브랜딩을 위해 logo_url, description 필요
- 클라이언트 앱/웹에서 센터 정보 노출 시 활용
- 검색 및 필터링을 위한 충분한 메타데이터 제공

---

## 질문 2: 센터 코드 체계

### 질문
센터 코드(center_code)는 어떻게 관리하나요?

### 옵션
- **옵션 A**: 자동 생성 (UUID 또는 랜덤 문자열)
- **옵션 B**: 센터가 직접 지정 (unique constraint)
- **옵션 C**: 하이브리드 (자동 생성 + 변경 가능)

### 결정
**옵션 A: 자동 생성**

### 근거
- 코드 충돌 방지 (unique constraint 관리 불필요)
- 직원 초대 시 센터 코드로 연결하므로 예측 불가능한 값이 보안상 유리
- 센터가 직접 지정하면 "좋은 코드" 선점 문제 발생

---

## 질문 3: Center 생성 방식

### 질문
새로운 Center는 어떻게 생성되나요?

### 옵션
- **옵션 A**: 회원가입 시 센터 함께 생성 (센터장 = 첫 번째 직원)
- **옵션 B**: 플랫폼 관리자가 센터 생성 후 센터장 지정
- **옵션 C**: 둘 다 지원

### 결정
**옵션 B: 플랫폼 관리자가 센터 생성 후 센터장 지정**

### 근거
- 센터 생성은 플랫폼 비즈니스 관점에서 관리 필요 (계약, 결제 등)
- 무분별한 센터 생성 방지
- 센터 정보 검증 후 생성 (사업자 등록증 등)

---

## 질문 4: 센터 삭제 정책

### 질문
센터 삭제 시 어떻게 처리하나요?

### 옵션
- **옵션 A**: Soft Delete (deleted_at)
- **옵션 B**: 비활성화만 (is_active = false)
- **옵션 C**: Hard Delete + 관련 데이터 CASCADE

### 결정
**옵션 A: Soft Delete**

### 근거
- 상담 기록, 결제 내역 등 법적 보존 필요
- 복구 가능성 유지
- 데이터 무결성 보장 (Foreign Key 참조 보호)

---

## Room (상담실) 관련 질문

---

## 질문 5: Room 필수 정보

### 질문
Room 엔티티에 어떤 정보를 포함하나요?

### 옵션
- **옵션 A**: 최소 정보 (name만)
- **옵션 B**: 기본 정보 (name, capacity)
- **옵션 C**: 상세 정보 (name, capacity, description, is_active, equipment 등)

### 결정
**옵션 B + memo 필드: 기본 정보 + 자유 형식 메모**

### 근거
- name, capacity는 필수 정보
- memo 필드로 유연한 추가 정보 기록 (장비, 특이사항 등)
- 과도한 구조화보다 실용적 접근

### 필드 구조
```python
Room:
  - id: UUID (PK)
  - center_id: UUID (FK)
  - name: str (NOT NULL)
  - capacity: int (NOT NULL, default=1)
  - memo: str | None (nullable)
  - is_active: bool (default=True)
  - created_at, updated_at, deleted_at
```

---

## 질문 6: Room 개수 제한

### 질문
센터당 Room 개수 제한이 있나요?

### 옵션
- **옵션 A**: 제한 없음
- **옵션 B**: 센터 플랜별 제한 (무료: 1개, 기본: 5개, 프로: 무제한)
- **옵션 C**: 고정 제한 (예: 최대 10개)

### 결정
**옵션 A: 제한 없음**

### 근거
- 플랜별 제한은 Phase 2에서 구독 모델 도입 시 고려
- Phase 1에서는 기능 우선 구현
- 대형 센터의 다수 상담실 지원 필요

---

## 질문 7: Room 삭제 시 일정 처리

### 질문
Room 삭제 시 해당 Room의 예약된 일정은 어떻게 처리하나요?

### 옵션
- **옵션 A**: 삭제 불가 (미래 예약 존재 시)
- **옵션 B**: Soft Delete (예약은 유지, 신규 예약 불가)
- **옵션 C**: 다른 Room으로 자동 이전

### 결정
**옵션 B: Soft Delete**

### 근거
- 기존 예약은 유지하여 고객 혼란 방지
- 신규 예약은 불가하도록 is_active=false 또는 deleted_at 설정
- 과거 상담 이력의 Room 참조 보존

---

## OperatingHour (운영 시간) 관련 질문

---

## 질문 8~11: 운영 시간 통합 모델링

### 질문
운영 시간, 휴게 시간, 휴무일, 공휴일을 어떻게 모델링하나요?

### 결정
**통합 OperatingHour 테이블로 모든 케이스 처리**

### 근거
- 단일 테이블로 운영/휴게/휴무/공휴일 모두 표현 가능
- `is_operate` 플래그로 운영/비운영 구분
- 유연한 조합: 특정 날짜, 특정 요일, 특정 주차 등

### 테이블 구조

```sql
CREATE TABLE operating_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID REFERENCES centers(id),

  -- 날짜 조건 (모두 nullable, 조합으로 사용)
  year INT,           -- 2026 (특정 연도)
  month INT,          -- 1 (특정 월)
  day INT,            -- 1 (특정 일)
  monthweek INT,      -- 1 (1주차, 2주차 등)
  weekday VARCHAR(3), -- 'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'

  -- 시간 범위
  start_time TIME NOT NULL,  -- 09:00
  end_time TIME NOT NULL,    -- 18:00

  -- 운영 여부
  is_operate BOOLEAN NOT NULL DEFAULT true,

  -- 사유 (휴무 시)
  reason TEXT,  -- '신정', '점심시간', '매주 월요일 휴무' 등

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 사용 예시

```sql
-- 1. 기본 운영 시간 (월~금 09:00-18:00)
INSERT INTO operating_hours (center_id, weekday, start_time, end_time, is_operate)
VALUES
  ('{center_id}', 'mon', '09:00', '18:00', true),
  ('{center_id}', 'tue', '09:00', '18:00', true),
  ('{center_id}', 'wed', '09:00', '18:00', true),
  ('{center_id}', 'thu', '09:00', '18:00', true),
  ('{center_id}', 'fri', '09:00', '18:00', true);

-- 2. 점심시간 (휴게)
INSERT INTO operating_hours (center_id, weekday, start_time, end_time, is_operate, reason)
VALUES
  ('{center_id}', 'mon', '12:00', '13:00', false, '점심시간'),
  ('{center_id}', 'tue', '12:00', '13:00', false, '점심시간'),
  ...

-- 3. 정기 휴무 (매주 일요일)
INSERT INTO operating_hours (center_id, weekday, start_time, end_time, is_operate, reason)
VALUES ('{center_id}', 'sun', '00:00', '23:59', false, '정기휴무');

-- 4. 특정 날짜 휴무 (2026-01-01 신정)
INSERT INTO operating_hours (center_id, year, month, day, start_time, end_time, is_operate, reason)
VALUES ('{center_id}', 2026, 1, 1, '00:00', '23:59', false, '신정');

-- 5. 매월 첫째주 월요일 휴무
INSERT INTO operating_hours (center_id, monthweek, weekday, start_time, end_time, is_operate, reason)
VALUES ('{center_id}', 1, 'mon', '00:00', '23:59', false, '매월 첫째주 월요일 휴무');

-- 6. 토요일 오전만 운영
INSERT INTO operating_hours (center_id, weekday, start_time, end_time, is_operate)
VALUES ('{center_id}', 'sat', '09:00', '13:00', true);
```

### 조회 우선순위 (구체적인 것 우선)

1. **특정 날짜** (year + month + day) - 가장 높은 우선순위
2. **월+주차+요일** (month + monthweek + weekday)
3. **주차+요일** (monthweek + weekday)
4. **요일** (weekday) - 기본 운영 시간

---

## 질문 12: Room별 운영 시간

### 질문
Room마다 다른 운영 시간을 가질 수 있나요?

### 옵션
- **옵션 A**: 센터 운영 시간만 (Room은 센터 시간 따름)
- **옵션 B**: Room별 운영 시간 가능 (센터 시간 내에서)
- **옵션 C**: Room별 완전 독립 운영 시간

### 결정
**옵션 A: 센터 운영 시간만**

### 근거
- Room은 센터 운영 시간 내에서만 예약 가능
- 복잡도 감소
- 예약 시 Room 가용성은 **기존 예약 여부**로 판단 (운영 시간은 센터 기준)

### 주의사항
- 예약 환경에서 이미 예약된 Room에 대한 검증 필요
- 특정 시간에 예약 가능한 Room 목록 조회 시:
  1. 센터 운영 시간 확인
  2. 해당 시간대 Room별 기존 예약 확인
  3. 예약되지 않은 Room만 반환

---

## Membership (센터 멤버십) 관련 질문

---

## 질문 13: 멤버 관리 패턴

### 질문
센터 직원을 어떻게 모델링하나요?

### 옵션
- **옵션 A**: Member 엔티티 (단순 소속 관계)
- **옵션 B**: Membership 패턴 (시간 기반 소속 + 권한 정책 분리)
- **옵션 C**: Staff + Assignment (역할과 배정 분리)

### 결정
**옵션 B: Membership 패턴**

### 근거
- 소속 기간(effective_from/to)을 명시적으로 관리
- 권한 정책(PermissionPolicy)을 별도 테이블로 분리하여 재사용 가능
- 고용 유형(employment_type) 추적으로 프리랜서, 계약직 관리 용이
- 초대 메타데이터(invitation_email 등)를 유연하게 저장

### 역할 정의
| 역할 | 설명 |
|------|------|
| **ADMIN** | 센터 관리자 (센터장), 모든 권한 |
| **MANAGER** | 운영 관리자, 일정/멤버 관리 |
| **SPECIALIST** | 상담사, 상담 업무 담당 |

### 고용 유형 정의
| 유형 | 설명 |
|------|------|
| **FULLTIME** | 정규직 |
| **CONTRACT** | 계약직 |
| **FREELANCER** | 프리랜서 (외부 상담사) |

---

## 질문 14: 멤버십-Person 관계

### 질문
Membership과 Person의 관계는?

### 옵션
- **옵션 A**: person_id 필수 (NOT NULL)
- **옵션 B**: person_id 선택적 (nullable)

### 결정
**옵션 A: person_id 필수 (NOT NULL)**

### 근거
- Membership은 이미 가입된 Person과의 소속 관계를 나타냄
- 초대 단계에서는 Membership을 생성하지 않음
- 초대 정보는 metadata.invitation_email로 저장하되, Membership 생성은 가입 후 수행

### 초대 플로우 변경
```
1. 센터장이 이메일로 초대 발송 (Membership 생성 안 함)
2. 초대받은 사람이 회원가입 (Person, Account 생성)
3. 센터 코드 입력 시 Membership 생성 (person_id = 새로 생성된 Person.id)
```

---

## 질문 15: 직원 역할 관리

### 질문
직원 역할(Role)을 어떻게 관리하나요?

### 옵션
- **옵션 A**: 고정 역할 enum
- **옵션 B**: 별도 Role 테이블 (시스템 정의)
- **옵션 C**: 센터별 커스텀 역할 가능

### 결정
**고정 역할 enum: ADMIN, MANAGER, SPECIALIST**

### 근거
- 단순한 역할 체계로 충분
- 센터별 커스텀은 복잡도 증가 (Phase 2 고려)
- 3개 역할로 대부분의 케이스 커버

### 역할 enum
```python
class MembershipRole(str, Enum):
    ADMIN = "ADMIN"          # 센터장
    MANAGER = "MANAGER"      # 운영 관리자
    SPECIALIST = "SPECIALIST"  # 상담사
```

---

## 질문 16: 직원 권한 관리

### 질문
직원 권한(Permission)을 어떻게 관리하나요?

### 옵션
- **옵션 A**: 역할에 직접 권한 내장
- **옵션 B**: PermissionPolicy 테이블로 분리 (FK 참조)
- **옵션 C**: 개인별 권한 직접 할당 (permissions JSON[])

### 결정
**옵션 C: 개인별 권한 직접 할당 (permissions JSON[])**

### 근거
- 역할(Role)별 기본 권한 프리셋이 시스템에 정의됨
- 초대 수락 시 해당 역할의 권한을 **복사**하여 Membership.permissions에 저장
- 이후 개별 Membership의 권한을 독립적으로 수정 가능
- FK 참조 방식 대비 유연성 증가 (권한 정책 변경이 기존 멤버에 영향 없음)

### 권한 복사 정책
```
1. Auth 도메인의 Role 테이블에 역할별 기본 권한 프리셋 정의
   - ADMIN: ["*"] 또는 전체 권한 목록
   - MANAGER: ["center:read", "schedule:*", "member:read", ...]
   - SPECIALIST: ["client:read", "counseling:*", "schedule:read", ...]

2. 초대 수락 시:
   - 지정된 role의 기본 권한을 조회
   - Membership.permissions에 복사
   - 이후 해당 권한은 독립적으로 관리

3. 권한 수정 시:
   - Membership.permissions 직접 수정
   - 원본 Role의 권한에 영향 없음
```

### 참고
- **Role 테이블**: Auth 도메인에서 관리 (`/docs/auth/domain.md` 참조)
- permissions 필드는 JSON 배열로 저장: `["client:read", "counseling:create", ...]`

---

## 질문 17: 직원 초대 방식

### 질문
센터에 직원을 어떻게 초대하나요?

### 옵션
- **옵션 A**: 이메일 초대 링크
- **옵션 B**: 센터 코드로 가입 시 자동 연결
- **옵션 C**: 둘 다 지원

### 결정
**이메일 초대 + 센터 코드 연결 (MemberInvitation 테이블 활용)**

### 근거
- 초대 정보(email, role_id, employment_type)를 저장할 별도 테이블 필요
- 초대받은 사람이 가입 전까지 초대 정보 보존
- 센터 코드로 초대 검증 후 Member 생성

### MemberInvitation 테이블 구조
```python
MemberInvitation:
  - id: UUID (PK)
  - center_id: UUID (FK → centers.id, NOT NULL)
  - role_id: UUID (FK → roles.id, NOT NULL)
  - email: str (NOT NULL)
  - employment_type: EmploymentType (FULLTIME, CONTRACT, FREELANCER, NOT NULL)
  - expires_at: datetime (NOT NULL)  # 초대 만료 시간
  - accepted_at: datetime | None (nullable)  # 수락 시간
  - created_at, updated_at
```

### 플로우
```
1. POST /centers/{center_id}/invitations
   - 센터장이 초대 정보 입력 (email, role_id, employment_type)
   - MemberInvitation 레코드 생성 (expires_at = now + 7일)
   - 이메일 발송 (센터 코드, 초대 정보 포함)

2. POST /auth/signup
   - 회원가입 (email, password, name)
   - Person 생성
   - Account 생성

3. POST /centers/{center_code}/join
   - 센터 코드로 Center 조회
   - 가입한 email로 MemberInvitation 조회
   - 만료 여부 확인 (expires_at > now)
   - Member 생성:
     - person_id = 가입한 Person.id
     - role_id = Invitation에서 지정된 역할 ID
     - permissions = Role의 기본 권한 복사
     - employment_type = Invitation에서 지정된 유형
     - effective_from = now()
   - MemberInvitation.accepted_at = now()
```

### 초대 검증 방식
- **센터 코드 + 이메일 조합**으로 초대 검증
- 센터 코드는 Center 식별, 이메일은 Invitation 매칭
- 별도 토큰 불필요 (이메일 자체가 검증 수단)

---

## 질문 18: 멀티센터 소속

### 질문
한 직원(Person)이 여러 센터에 소속될 수 있나요?

### 옵션
- **옵션 A**: 지원 (프리랜서 상담사 등)
- **옵션 B**: 미지원 (한 센터만)

### 결정
**옵션 A: 지원**

### 근거
- 프리랜서 상담사가 여러 센터에서 근무하는 케이스 존재
- Person 1 : N Membership 관계
- 센터 전환 시 해당 Membership의 권한 정책 적용

### 구조
```
Person(id=10, name="김상담사")
  ↓ 1:N
Membership(center_id=1, person_id=10, role="SPECIALIST", employment_type="FREELANCER")
Membership(center_id=2, person_id=10, role="SPECIALIST", employment_type="FREELANCER")
```

---

## 질문 19: 멤버십 기간 관리

### 질문
멤버십의 유효 기간을 어떻게 관리하나요?

### 옵션
- **옵션 A**: 기간 없음 (탈퇴 시 삭제)
- **옵션 B**: effective_from/to로 기간 관리
- **옵션 C**: 상태 enum (active, expired, terminated)

### 결정
**옵션 B: effective_from/to로 기간 관리**

### 근거
- 소속 시작일(effective_from)은 필수, 기본값 now()
- 소속 종료일(effective_to)은 nullable (미지정 시 무기한)
- 계약 종료, 휴직 등 시간 기반 상태 관리 가능
- 과거 이력 보존 (삭제 대신 종료일 설정)

### 활성 멤버십 조회 쿼리
```sql
SELECT * FROM memberships
WHERE center_id = :center_id
  AND effective_from <= NOW()
  AND (effective_to IS NULL OR effective_to > NOW())
  AND deleted_at IS NULL;
```

---

## 질문 20: 멤버십 종료 처리

### 질문
직원이 센터를 떠날 때 어떻게 처리하나요?

### 옵션
- **옵션 A**: Soft Delete (deleted_at)
- **옵션 B**: effective_to 설정
- **옵션 C**: 둘 다 지원

### 결정
**옵션 B: effective_to 설정 (기본) + Soft Delete (완전 삭제 시)**

### 근거
- 일반 퇴사: effective_to = 퇴사일 (이력 보존)
- 잘못된 데이터 삭제: deleted_at 설정 (완전 제거)
- 상담 이력에서 담당 상담사 참조 보존
- 통계 및 보고서에서 과거 멤버 정보 필요

### Membership 테이블 최종 구조
```python
Membership:
  - id: UUID (PK)
  - center_id: UUID (FK → centers.id, NOT NULL)
  - person_id: UUID (FK → persons.id, NOT NULL)
  - role: MembershipRole (ADMIN, MANAGER, SPECIALIST, NOT NULL)
  - permissions: list[str] (JSON[], NOT NULL)  # ["client:read", "counseling:create", ...]
  - employment_type: EmploymentType (FULLTIME, CONTRACT, FREELANCER, NOT NULL)
  - memo: str | None (nullable)
  - effective_from: datetime (NOT NULL, default=now())
  - effective_to: datetime | None (nullable)
  - created_at, updated_at, deleted_at
```

**권한 복사 정책**:
- 초대 수락 시 Role의 기본 권한을 복사하여 permissions에 저장
- 이후 개별 Membership의 권한을 독립적으로 수정 가능
- 역할 수정이 기존 멤버에게 영향 없음

### 인덱스
```sql
-- 활성 멤버십 조회 최적화
CREATE INDEX idx_membership_active ON memberships (center_id, effective_from, effective_to)
  WHERE deleted_at IS NULL;

-- Person별 멤버십 조회
CREATE INDEX idx_membership_person ON memberships (person_id)
  WHERE deleted_at IS NULL;
```

---

## 의사결정 요약표

| # | 질문 | 결정 | Phase |
|---|------|------|-------|
| **Center 기본** | | | |
| 1 | Center 기본 정보 | 상세 정보 (name, code, phone, address, description, logo_url) | Phase 1 |
| 2 | 센터 코드 체계 | 자동 생성 (UUID/랜덤) | Phase 1 |
| 3 | Center 생성 방식 | 플랫폼 관리자가 생성 | Phase 1 |
| 4 | 센터 삭제 정책 | Soft Delete | Phase 1 |
| **Room** | | | |
| 5 | Room 필수 정보 | name, capacity + memo | Phase 1 |
| 6 | Room 개수 제한 | 제한 없음 | Phase 1 |
| 7 | Room 삭제 시 일정 처리 | Soft Delete (예약 유지) | Phase 1 |
| **OperatingHour** | | | |
| 8-11 | 운영 시간 모델링 | 통합 테이블 (운영/휴게/휴무/공휴일) | Phase 1 |
| 12 | Room별 운영 시간 | 센터 운영 시간만 (예약으로 가용성 판단) | Phase 1 |
| **Membership** | | | |
| 13 | 멤버 관리 패턴 | Membership 패턴 (시간 기반 + 권한 복사) | Phase 1 |
| 14 | 멤버십-Person 관계 | person_id 필수 (가입 후 Membership 생성) | Phase 1 |
| 15 | 직원 역할 관리 | 고정 역할 enum (ADMIN, MANAGER, SPECIALIST) | Phase 1 |
| 16 | 직원 권한 관리 | permissions JSON[] (Role 권한 복사) | Phase 1 |
| 17 | 직원 초대 방식 | MemberInvitation 테이블 + 센터 코드 join | Phase 1 |
| 18 | 멀티센터 소속 | 지원 (Person 1:N Membership) | Phase 1 |
| 19 | 멤버십 기간 관리 | effective_from/to로 기간 관리 | Phase 1 |
| 20 | 멤버십 종료 처리 | effective_to 설정 (기본) + Soft Delete (완전 삭제) | Phase 1 |

---

## 참고 문서

- **Auth 도메인**: `/docs/auth/domain.md`
- **Person 도메인**: `/docs/person/domain.md`
- **Client 도메인**: `/docs/client/domain.md`
- **프로젝트 설정**: `/CLAUDE.md`
