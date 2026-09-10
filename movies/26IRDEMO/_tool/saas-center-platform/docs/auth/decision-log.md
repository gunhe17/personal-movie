# Auth 도메인 설계 의사결정 기록

> 제1원칙 기반 질문-답변을 통한 Auth 도메인 설계 의사결정 과정

---

## 의사결정 일자

2026-01-13

---

## 의사결정 방식

**제1원칙(First Principles) 접근**:
1. 근본 개념부터 정의 (Authentication vs Authorization)
2. 비즈니스 요구사항을 구체적 시나리오로 검증
3. 여러 옵션 제시 후 트레이드오프 분석
4. 명시적 의사결정 및 근거 기록

---

## 질문 1: Auth 모듈 범위

### 질문
Auth 모듈이 담당해야 하는 범위는?

### 옵션
- **옵션 A**: 인증만 (Authentication only)
- **옵션 B**: 인증 + 시스템 권한 (Auth + System-level Authorization)
- **옵션 C**: 인증 + 인가 통합 (모든 권한 관리)

### 결정
**옵션 B: 인증 + 시스템 권한**

### 근거
- 인증(Authentication)은 Auth 모듈의 핵심 책임
- 시스템 기본 권한(슈퍼관리자 등)은 Auth 모듈에서 관리
- 센터별 커스텀 권한은 Center 모듈에서 관리 (멀티테넌시 격리)
- 관심사의 명확한 분리

### 구조
```
modules/
  ├── auth/
  │   ├── login/         # 인증
  │   ├── password/      # 비밀번호 관리
  │   ├── token/         # JWT, Refresh Token
  │   └── permission/    # 시스템 기본 권한 (선택적)
  └── center/
      ├── role/          # 센터별 역할
      └── permission/    # 센터별 권한
```

---

## 질문 2-1: Account-Person 관계

### 질문
Account가 Person 없이 존재할 수 있나요?

### 옵션
- **시나리오 A**: 플랫폼 관리자 (Person 없음)
- **시나리오 B**: 센터 구성원 (Person 1:1 필수)

### 결정
**존재하지 않을 수도 있음**

### 근거
- 시스템 관리자 (슈퍼관리자)는 센터에 속하지 않음 → Person 불필요
- 센터 구성원은 Person 필수 (인적 정보 필요)
- `Person.account_id` 필드로 Account와 1:1 관계 (FK 제약 없음, 모듈러 모놀리스)

### 시나리오
```python
# 시스템 관리자
Account(id=1, email="admin@platform.com")
→ 플랫폼 관리 권한만, 센터 접근 불가
→ Person 레코드 없음

# 센터 구성원
Account(id=2, email="counselor@example.com")
  ↑ 1:1
Person(id=10, name="김상담", account_id=2)
```

---

## 질문 2-2: 로그인 응답 정보

### 질문
로그인 시 반환되는 정보는?

### 옵션
- **옵션 A**: Account만
- **옵션 B**: Account + Person
- **옵션 C**: Account + Person + Center 정보

### 결정
**옵션 B: Account + Person**

### 근거
- Frontend에서 사용자 이름 표시 필요 (Person.name)
- Center 정보는 센터 전환 API로 별도 획득 (멀티테넌시)
- 최소한의 정보만 반환 (불필요한 데이터 전송 방지)

### 응답 형태
```json
{
  "account": {
    "id": 1,
    "email": "user@example.com",
    "created_at": "2026-01-13T10:00:00Z"
  },
  "person": {
    "id": 10,
    "name": "김철수",
    "phone": "010-1234-5678"
  },
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 1800
}
```

---

## 질문 3-1: 인증 방식

### 질문
인증 방식은?

### 옵션
- **옵션 A**: JWT (Stateless)
- **옵션 B**: Session (Stateful)
- **옵션 C**: Hybrid (JWT + Refresh Token in DB)

### 결정
**옵션 C: Hybrid (JWT + Refresh Token in DB)**

### 근거
- **Access Token (JWT)**: Stateless, 짧은 만료 (15-30분)
- **Refresh Token**: DB 저장, 긴 만료 (7-30일)
- 로그아웃 시 Refresh Token 무효화 가능
- 토큰 탈취 시 즉시 차단 가능
- 확장성 + 보안성 균형

### 동작 방식
```
1. 로그인: Access Token (JWT) + Refresh Token (DB 저장) 발급
2. API 호출: Access Token으로 인증
3. Access Token 만료: Refresh Token으로 재발급
4. 로그아웃: Refresh Token DB에서 삭제
```

---

## 질문 3-2: Refresh Token 저장

### 질문
Refresh Token을 DB에 저장하나요?

### 옵션
- **옵션 A**: Refresh Token DB 저장
- **옵션 B**: Refresh Token 저장 안 함 (Stateless)

### 결정
**옵션 A: Refresh Token DB 저장**

### 근거
- 로그아웃 기능 구현 가능 (DB에서 삭제)
- "모든 디바이스에서 로그아웃" 기능 지원
- 토큰 탈취 시 무효화 가능
- 보안 우선 (Stateless보다 안전)

### 테이블 구조
```python
RefreshToken:
  - id: PK
  - account_id: Integer (Account 참조, FK 제약 없음)
  - token: 토큰 해시 (unique)
  - device_info: 디바이스 정보 (User-Agent)
  - ip_address: IP 주소
  - expires_at: 만료 일시
  - created_at: 생성 일시
```

---

## 질문 4-1: 멀티테넌시 인증

### 질문
한 Account가 여러 센터에 접근할 때?

### 옵션
- **옵션 A**: 로그인 시 센터 선택 필수
- **옵션 B**: 로그인 후 센터 전환 API
- **옵션 C**: JWT에 모든 센터 포함

### 결정
**옵션 B: 로그인 후 센터 전환 API**

### 근거
- 로그인과 센터 선택을 분리 (관심사 분리)
- 센터 전환 시 재로그인 불필요 (UX 개선)
- JWT 크기 최소화 (현재 센터만 포함)
- 센터별 권한을 동적으로 로드

### API 흐름
```
1. POST /auth/login
   → JWT (account_id, person_id만 포함)

2. GET /auth/my-centers
   → 접근 가능한 센터 목록 반환

3. POST /auth/switch-center
   body: { "center_id": 2 }
   → 새 JWT 발급 (center_id, role, permissions 포함)

4. API 호출 시 center_id 기반 권한 검증
```

---

## 질문 4-2: JWT Payload

### 질문
JWT Payload에 무엇을 포함할까?

### 옵션
- **옵션 A**: 최소 정보 (account_id만)
- **옵션 B**: Account + Person
- **옵션 C**: Account + Person + Center + Role

### 결정
**옵션 C: Account + Person + Center + Role**

### 근거
- 매 API 호출마다 DB 조회 방지 (성능)
- 권한 검증을 JWT만으로 처리 가능
- 센터 전환 시에만 JWT 재발급 (자주 발생하지 않음)

### JWT Payload 구조
```json
{
  "account_id": 1,
  "person_id": 10,
  "email": "user@example.com",
  "center_id": 1,
  "role_id": 5,
  "role_name": "상담사",
  "permissions": [
    "client:read",
    "client:create",
    "counseling:read",
    "counseling:create"
  ],
  "exp": 1234567890,
  "iat": 1234567000
}
```

---

## 질문 5-1: Password 저장 방식

### 질문
Password 저장 방식은?

### 옵션
- bcrypt
- Argon2
- PBKDF2

### 결정
**bcrypt (FastAPI 표준)**

### 근거
- FastAPI 생태계에서 가장 널리 사용됨
- `passlib` 라이브러리 지원
- 검증된 알고리즘 (느린 해싱으로 brute-force 방어)
- Salt 자동 포함

### 구현
```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# 해싱
hashed = pwd_context.hash("plain_password")

# 검증
pwd_context.verify("plain_password", hashed)
```

---

## 질문 5-2: Password 정책

### 질문
Password 정책은?

### 옵션
- **옵션 A**: 기본 정책 (최소 8자)
- **옵션 B**: 강력한 정책 (보안 중심)
- **옵션 C**: 센터별 커스텀 정책

### 결정
**옵션 B: 강력한 정책 (보안 중심)**

### 근거
- 의료/상담 데이터는 민감 정보 (개인정보보호법 준수)
- 통일된 정책으로 관리 용이
- 센터별 커스텀은 복잡도 증가 (Phase 2로 미루기)

### 정책 세부사항
```python
PASSWORD_POLICY = {
    "min_length": 10,
    "require_uppercase": True,
    "require_lowercase": True,
    "require_digit": True,
    "require_special": True,
    "prevent_reuse": 3,  # 이전 3개 비밀번호 재사용 금지
}
```

### 검증 에러 메시지
```
"Password must be at least 10 characters long"
"Password must contain at least one uppercase letter"
"Password must contain at least one lowercase letter"
"Password must contain at least one digit"
"Password must contain at least one special character (!@#$%^&*)"
"This password was recently used. Please choose a different password."
```

---

## 질문 6-1: 소셜 로그인 지원

### 질문
소셜 로그인 지원 여부?

### 옵션
- **옵션 A**: 지원 (Phase 2)
- **옵션 B**: 미지원

### 결정
**옵션 A: 지원 (Phase 2)**

### 근거
- Phase 1: 이메일 로그인만 (MVP)
- Phase 2: 네이버, 카카오, Google (보호자 앱 UX 개선)
- 센터 관리자는 이메일 로그인만 (보안)

### 향후 구조
```python
Account:
  - provider: String (email, kakao, naver, google)
  - provider_id: String (소셜 로그인 고유 ID)
  - email: String (unique)

# 소셜 로그인 시 email 매칭으로 기존 Account 연결
```

---

## 질문 6-2: 소셜 로그인 시 Person 연결

### 질문
소셜 로그인 시 Account-Person 연결?

### 옵션
- 자동 생성
- 수동 생성

### 결정
**Person 자동 생성**

### 근거
- 소셜 로그인 시 이름, 전화번호 등 정보 획득 가능
- UX 개선 (추가 입력 불필요)
- 센터 연동은 별도 프로세스 (ClientLinkRequest)

### 동작 방식
```
1. 소셜 로그인 (카카오)
   → Account 생성 (provider="kakao")
   → Person 생성 (name, phone from 카카오 API)
   → Person.account_id = Account.id 연결

2. 센터 연동 (별도)
   → ClientLinkRequest 생성
   → 센터 승인
   → Client.person_id = Person.id
```

---

## 질문 7-1: 로그인 시도 제한

### 질문
로그인 시도 제한?

### 옵션
- **옵션 A**: IP 기반 제한
- **옵션 B**: Account 기반 제한
- **옵션 C**: 제한 없음

### 결정
**옵션 A: IP 기반 제한**

### 근거
- 여러 Account에 대한 brute-force 방어
- Account 잠금은 정상 사용자도 피해 (비밀번호 찾기로 해결)
- Redis로 실패 횟수 추적 (빠른 성능)

### 정책
```python
RATE_LIMIT = {
    "max_attempts": 5,
    "window_seconds": 900,  # 15분
    "lockout_duration": 900,  # 15분 차단
}
```

### Redis 키 구조
```
login_attempts:{ip_address} = 3  (TTL: 900초)
login_lockout:{ip_address} = 1   (TTL: 900초)
```

---

## 질문 16: Foreign Key 제약 사용 여부

### 질문
모듈러 모놀리스 아키텍처에서 Foreign Key 제약을 사용할까?

### 옵션
- **옵션 A**: DB-level FK 제약 사용
  - DB가 참조 무결성 보장
  - 강력한 데이터 일관성

- **옵션 B**: FK 제약 없음, 어플리케이션 레벨 관리
  - 모듈 독립성 확보
  - 마이크로서비스 마이그레이션 용이

### 결정
**옵션 B: FK 제약 없음**

### 근거
- **모듈러 모놀리스**: 향후 마이크로서비스 분리 대비
- **모듈 독립성**: Auth, Person, Center 등 모듈 간 DB-level 의존성 제거
- **유연성**: 모듈별 독립 배포/확장 가능
- **CASCADE 삭제**: 어플리케이션 레벨에서 명시적 처리 (Handler에서 관리)

### 구현 방식
```python
# ✅ FK 제약 없음
class Person(Base):
    account_id: Mapped[int] = mapped_column(Integer, nullable=False)
    # NO: ForeignKey('accounts.id')

# Handler에서 CASCADE 삭제 처리
async def delete_account_handler(account_id: int, uow: UnitOfWork):
    async with uow:
        # 1. 관련 데이터 수동 삭제
        person_repo = uow.repo(PersonRepository)
        await person_repo.delete_by_account_id(account_id)

        # 2. Account 삭제
        account_repo = uow.repo(AccountRepository)
        await account_repo.delete(account_id)

        await uow.commit()
```

---

## 질문 17: Lock PIN 기능

### 질문
로그인 상태에서 임시 잠금 기능이 필요한가?

### 옵션
- **옵션 A**: 세션 타임아웃만
- **옵션 B**: Lock PIN (4자리 숫자)
- **옵션 C**: 패턴 잠금

### 결정
**옵션 B: Lock PIN (4자리 숫자)**

### 근거
- 센터 현장에서 자리 이탈 시 간편 잠금 필요
- 전체 로그아웃보다 빠른 재인증 (UX 개선)
- 4자리 숫자로 빠른 입력 가능
- 잠금 해제 유효시간 설정 가능 (사용자별)

### 구현 방식
```python
# Account 모델에 추가
class Account(Base):
    lock_pin: Mapped[str | None] = mapped_column(String(4), nullable=True)
    lock_pin_duration_minute: Mapped[int | None] = mapped_column(Integer, nullable=True)

# API
POST /auth/set-lock-pin
  body: { "pin": "1234", "duration_minute": 30 }
  → lock_pin (bcrypt 해시), lock_pin_duration_minute 저장

POST /auth/lock
  → Frontend에서 잠금 화면 표시
  → 설정된 duration 후 자동 로그아웃

POST /auth/unlock
  body: { "pin": "1234" }
  → PIN 검증 후 잠금 해제
```

### 보안 고려사항
- PIN은 bcrypt로 해싱하여 저장
- 잠금 해제 실패 5회 시 자동 로그아웃
- duration 초과 시 자동 로그아웃

---

## 의사결정 요약표

| # | 질문 | 결정 | Phase |
|---|------|------|-------|
| 1-1 | Auth 모듈 범위 | 인증 + 시스템 권한 | Phase 1 |
| 2-1 | Account-Person 관계 | Person NULL 허용 (시스템 관리자) | Phase 1 |
| 2-2 | 로그인 응답 정보 | Account + Person | Phase 1 |
| 3-1 | 인증 방식 | Hybrid (JWT + Refresh Token in DB) | Phase 1 |
| 3-2 | Refresh Token 저장 | DB 저장 | Phase 1 |
| 4-1 | 멀티테넌시 인증 | 로그인 후 센터 전환 API | Phase 1 |
| 4-2 | JWT Payload | Account + Person + Center + Role | Phase 1 |
| 5-1 | Password 저장 | bcrypt | Phase 1 |
| 5-2 | Password 정책 | 강력한 정책 (10자, 특수문자 필수) | Phase 1 |
| 6-1 | 소셜 로그인 | 지원 (Phase 2) | Phase 2 |
| 6-2 | 소셜 로그인 시 Person | 자동 생성 | Phase 2 |
| 7-1 | 로그인 시도 제한 | IP 기반 제한 (Redis) | Phase 1 |
| 8 | Role-Permission 관계 | N:M 동적 관리 | Phase 1 |
| 9 | 센터 멤버 권한 할당 | 복사 정책 (Copy) | Phase 1 |
| 10 | 새 권한 추가 처리 | 알림 + 선택적 부여 | Phase 1 |
| 11 | 역할 수정 전파 | 전파 안 함 | Phase 1 |
| 12 | 권한 UI 그룹핑 | 도메인별 그룹핑 | Phase 1 |
| 13 | Permission 모듈 위치 | Auth Sub-Module | Phase 1 |
| 14 | 권한 검증 로직 위치 | Core 패키지 | Phase 1 |
| 15 | 권한 CRUD 구분 | Phase 1 읽기 + Phase 2 CRUD | Phase 1 & 2 |
| 16 | Foreign Key 제약 사용 | FK 제약 없음 (모듈러 모놀리스) | Phase 1 |
| 17 | Lock PIN 기능 | 4자리 숫자 PIN (간편 잠금) | Phase 1 |

---

## 질문 8: Role-Permission 관계 설계

### 질문
글로벌 역할(Role)과 권한(Permission)의 관계를 어떻게 설계할까?

### 옵션
- **옵션 A**: N:M 관계 (동적 관리)
  - Role ↔ RolePermission ↔ Permission
  - DB 테이블로 관리, CRUD 가능

- **옵션 B**: JSON 컬럼 (유연성)
  - Role.permissions: JSON[]
  - 스키마 자유도 높음, 검색/조인 어려움

- **옵션 C**: 하드코딩 (단순성)
  - 코드에 역할별 권한 정의
  - DB 저장 없음, 변경 시 배포 필요

### 결정
**옵션 A: N:M 관계 (동적 관리)**

### 근거
- **유연성**: 새 권한 추가 시 기존 역할에 자유롭게 할당 가능
- **확장성**: PLATFORM_ADMIN이 UI에서 역할/권한 관리 가능 (Phase 2)
- **데이터 무결성**: 어플리케이션 레벨에서 참조 무결성 보장 (모듈러 모놀리스)
- **쿼리 성능**: JOIN으로 효율적인 조회 가능
- **감사 추적**: 변경 이력 추적 용이 (created_at, updated_at)

### 테이블 구조
```python
Permission:
  - id: PK
  - code: String (unique) # "client:read"
  - name: String
  - category: String # "client", "counseling"
  - is_new: Boolean

Role:
  - id: PK
  - code: String (unique) # "center_admin"
  - name: String
  - description: String

RolePermission:
  - role_id: Integer (composite PK, FK 제약 없음)
  - permission_id: Integer (composite PK, FK 제약 없음)
```

---

## 질문 9: 센터 멤버 권한 할당 방식

### 질문
센터 멤버(CenterMember)에게 권한을 할당할 때, Role을 참조할까 Permission을 복사할까?

### 옵션
- **옵션 A**: 참조 정책 (Reference)
  - CenterMember.role_id 저장
  - 역할 수정 시 모든 멤버에게 자동 반영
  - 단순하지만 의도치 않은 권한 변경 가능

- **옵션 B**: 복사 정책 (Copy)
  - CenterMember.permissions: JSON[] 저장
  - 초대 시점의 권한 복사
  - 역할 수정해도 기존 멤버 영향 없음

- **옵션 C**: 하이브리드 (Hybrid)
  - role_id + permissions 모두 저장
  - 선택적 동기화 가능

### 결정
**옵션 B: 복사 정책 (Copy) + 선택적 동기화**

### 근거
- **권한 안정성**: 역할 수정이 기존 멤버에게 영향 없음
- **센터별 커스터마이징**: 센터 관리자가 멤버별 권한 개별 수정 가능
- **감사 추적**: 멤버 초대 시점의 권한 이력 보존
- **선택적 동기화**: 새 권한 알림 + 센터 관리자가 선택적으로 부여
- **센터 자율성**: 센터별 독립적인 권한 관리 (멀티테넌시)

### 구현 방식
```python
# Center 모듈
CenterMember:
  - id: PK
  - center_id: Integer (FK 제약 없음)
  - person_id: Integer (FK 제약 없음)
  - role_name: String # 참조용 (복사 시점 역할명)
  - permissions: JSON[] # ["client:read", "counseling:create"]
  - created_at: DateTime
```

---

## 질문 10: 새 권한 추가 시 처리 방법

### 질문
시스템에 새 기능이 추가되어 새 권한이 생길 때, 기존 센터/멤버에게 어떻게 알릴까?

### 옵션
- **옵션 A**: 자동 부여 (Auto Grant)
  - 특정 역할에 새 권한 자동 추가
  - 보안 위험 가능

- **옵션 B**: 수동 할당 (Manual)
  - 센터 관리자가 수동 권한 부여
  - 누락 가능성

- **옵션 C**: 알림 + 선택적 부여 (Notification + Selective)
  - Permission.is_new = true로 표시
  - 센터 접속 시 새 권한 알림
  - 센터 관리자가 멤버별 선택 부여

### 결정
**옵션 C: 알림 + 선택적 부여**

### 근거
- **보안**: 자동 부여로 인한 의도치 않은 권한 상승 방지
- **투명성**: 센터 관리자에게 명확한 알림 제공
- **자율성**: 센터별로 권한 부여 여부 결정
- **추적성**: `is_new` 플래그로 새 권한 추적
- **점진적 도입**: 센터별 업무 상황에 맞춰 권한 부여 가능

### 동작 방식
```
1. 신기능 개발 → 새 권한 추가 (is_new=true)
   Permission.create({
     code: "billing:export",
     name: "결제 내역 내보내기",
     category: "billing",
     is_new: true
   })

2. 센터 접속 시 새 권한 알림
   GET /auth/permissions?is_new=true → 알림 표시

3. 센터 관리자 선택
   멤버별로 새 권한 부여/미부여 결정
   → Center 모듈에서 CenterMember.permissions 업데이트

4. 확인 후 (선택적)
   PATCH /auth/permissions/{id} { is_new: false }
```

---

## 질문 11: 역할 수정 시 전파 정책

### 질문
글로벌 역할(Role)의 권한을 수정하면 기존 센터 멤버에게 반영할까?

### 옵션
- **옵션 A**: 자동 전파 (Auto Propagation)
  - 역할 수정 시 모든 멤버 권한 업데이트
  - 의도치 않은 권한 변경 위험

- **옵션 B**: 전파 안 함 (No Propagation)
  - 복사 정책으로 초대 시점 권한 유지
  - 역할 수정은 신규 멤버에게만 영향

- **옵션 C**: 선택적 전파 (Selective)
  - 센터 관리자가 전파 여부 선택
  - 복잡한 UI 필요

### 결정
**옵션 B: 전파 안 함 (복사 정책 유지)**

### 근거
- **권한 안정성**: 기존 멤버 권한 보호
- **센터 자율성**: 센터별 커스터마이징 유지
- **예측 가능성**: 역할 수정이 기존 멤버에게 영향 없음
- **단순성**: 복잡한 동기화 로직 불필요
- **신규 멤버 적용**: 신규 멤버는 최신 역할 권한 받음

### 명확한 정책
```
역할 수정 → 신규 멤버만 영향
기존 멤버 → 초대 시점 권한 유지
새 권한 → 별도 알림 플로우 (질문 10)
```

---

## 질문 12: 권한 UI 그룹핑 방식

### 질문
UI에서 권한 목록을 어떻게 그룹핑해서 표시할까?

### 옵션
- **옵션 A**: 도메인별 그룹핑 (Domain-based)
  - client, counseling, assessment, schedule 등
  - 업무 영역별로 직관적

- **옵션 B**: 액션별 그룹핑 (Action-based)
  - read, create, update, delete 등
  - CRUD 중심

- **옵션 C**: 역할별 그룹핑 (Role-based)
  - 센터장, 상담사, 접수직원 등
  - 역할 중심 사고

### 결정
**옵션 A: 도메인별 그룹핑**

### 근거
- **직관성**: 업무 영역별로 권한 인지 용이
- **확장성**: 새 도메인 추가 시 자연스러운 그룹 추가
- **업무 중심**: "내담자 관리" 권한들을 한눈에 확인 가능
- **Permission.category 활용**: DB 컬럼과 일치

### UI 예시
```
내담자 관리 (client)
  ☑ 내담자 조회 (client:read)
  ☑ 내담자 생성 (client:create)
  ☐ 내담자 삭제 (client:delete)

상담 관리 (counseling)
  ☑ 상담 조회 (counseling:read)
  ☑ 상담 생성 (counseling:create)
```

---

## 질문 13: Permission 모듈 위치

### 질문
Permission과 Role 관리를 별도 Main Module로 분리할까, Auth의 Sub-Module로 둘까?

### 옵션
- **옵션 A**: 별도 Main Module
  - `apps/api/app/modules/permission/`
  - 명확한 분리

- **옵션 B**: Auth Sub-Module
  - `apps/api/app/modules/auth/permission/`
  - 인증/권한 응집도

- **옵션 C**: Center Sub-Module
  - `apps/api/app/modules/center/permission/`
  - 멀티테넌시 중심

### 결정
**옵션 B: Auth Sub-Module**

### 근거
- **응집도**: 인증(Authentication)과 권한(Authorization)은 밀접한 관계
- **단순성**: 별도 모듈 분리 대비 구조 단순화
- **관련성**: JWT 페이로드에 permissions 포함 → Auth와 강한 연관
- **표준 패턴**: 대부분의 프레임워크에서 Auth 모듈이 권한 관리 담당
- **Center 분리**: 권한 정의(Auth)와 권한 할당(Center)을 명확히 분리

### 구조
```
apps/api/app/modules/auth/
├── account/        # 계정 관리
├── token/          # 토큰 관리
├── permission/     # 권한 정의 (글로벌)
│   ├── models.py
│   ├── repository.py
│   └── services/
└── router.py
```

---

## 질문 14: 권한 검증 로직 위치

### 질문
API 엔드포인트에서 권한 검증하는 데코레이터를 어디에 둘까?

### 옵션
- **옵션 A**: Auth 모듈 내부
  - `auth/decorators.py`
  - 순환 참조 가능성

- **옵션 B**: Core 패키지
  - `app/core/permissions.py`
  - 범용 인프라 레이어

- **옵션 C**: 각 모듈에 분산
  - `client/permissions.py`
  - 도메인별 검증 로직

### 결정
**옵션 B: Core 패키지 (`app/core/permissions.py`)**

### 근거
- **순환 참조 방지**: Auth 모듈이 다른 모듈을 import할 필요 없음
- **범용성**: 모든 모듈에서 사용하는 공통 인프라
- **의존성 방향**: Core ← Modules (단방향)
- **재사용성**: 데코레이터 패턴으로 모든 엔드포인트에 적용 가능

### 사용 예시
```python
from app.core.permissions import require_permissions

@router.post("/clients")
@require_permissions(["client:create"])
async def create_client(...):
    pass
```

---

## 질문 15: 권한 CRUD 단계 구분

### 질문
권한 관리 기능을 어떻게 단계적으로 개발할까?

### 옵션
- **옵션 A**: 한 번에 모두 개발
  - 초기 개발 기간 길어짐
  - 복잡도 높음

- **옵션 B**: Phase 1 읽기 전용 + Phase 2 CRUD
  - MVP 빠른 출시
  - 점진적 기능 추가

- **옵션 C**: Phase 1 하드코딩 + Phase 2 DB
  - 초기 단순성
  - 마이그레이션 복잡

### 결정
**옵션 B: Phase 1 읽기 전용 + Seed 데이터, Phase 2 CRUD**

### 근거
- **빠른 출시**: Phase 1에서는 기본 역할/권한만 Seed로 생성
- **점진적 복잡도**: CRUD는 PLATFORM_ADMIN만 필요 (Phase 2)
- **마이그레이션 없음**: DB 스키마는 동일, 기능만 단계적 추가
- **사용자 피드백**: Phase 1 사용 경험 후 Phase 2 기능 결정

### Phase 구분
**Phase 1** (MVP):
- Seed 데이터로 기본 역할/권한 생성
- GET 엔드포인트만 제공
  - `GET /auth/permissions`
  - `GET /auth/permissions/grouped`
  - `GET /auth/roles`
  - `GET /auth/roles/{id}`
- 센터 관리자가 멤버에게 권한 할당

**Phase 2** (Advanced):
- PLATFORM_ADMIN이 역할/권한 CRUD
  - `POST /auth/permissions`
  - `PATCH /auth/permissions/{id}`
  - `POST /auth/roles`
  - `PATCH /auth/roles/{id}`
  - `DELETE /auth/roles/{id}`
- 새 권한 추가 시 `is_new=true` 알림
- 권한 검색, 필터링, 정렬

---

## 참고 문서

- **Auth 도메인**: `/docs/auth/domain.md`
- **전체 아키텍처**: `/docs/domain-architecture.md`
- **CLAUDE.md**: 프로젝트 설정 및 개발 규칙
