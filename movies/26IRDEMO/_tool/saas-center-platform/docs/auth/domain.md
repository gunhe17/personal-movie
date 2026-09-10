# Auth 도메인 설계

> 인증(Authentication) 및 권한(Authorization) 관리 도메인

---

## 목차

1. [도메인 개요](#도메인-개요)
2. [서브모듈 구조](#서브모듈-구조)
3. [Core Schemas (Models)](#core-schemas-models)
4. [Pydantic Schemas (DTOs)](#pydantic-schemas-dtos)
5. [비즈니스 규칙](#비즈니스-규칙)
6. [API 엔드포인트](#api-엔드포인트)
7. [참고 문서](#참고-문서)

---

## 도메인 개요

### 책임 범위

**Auth 모듈**은 다음을 담당합니다:
- **인증(Authentication)**: 사용자 신원 확인 (로그인, 로그아웃, 토큰 관리)
- **권한 정의(Authorization Definition)**: 글로벌 권한 및 역할 관리 (Permission, Role)
- **비밀번호 관리**: 비밀번호 변경, 재설정
- **보안**: Rate limiting, 로그인 시도 제한

**센터별 권한 할당은 Center 모듈에서 관리** (CenterMember - 권한 복사 정책).

---

## 서브모듈 구조

```
apps/api/app/modules/auth/
├── account/              # 계정 관리
│   ├── models.py         # Account, PasswordHistory
│   ├── schemas.py
│   ├── repository.py
│   └── services/
│       ├── signup.py
│       ├── login.py
│       ├── password.py
│       └── lock_pin.py   # PIN 설정/검증
│
├── token/                # 토큰 관리
│   ├── models.py         # RefreshToken
│   ├── repository.py
│   └── services/
│       ├── jwt.py
│       └── refresh.py
│
├── permission/           # 권한 정의 (글로벌)
│   ├── models.py         # Permission, Role, RolePermission
│   ├── schemas.py
│   ├── repository.py
│   └── services/
│       ├── permission.py
│       └── role.py
│
├── handlers/
│   ├── login.py
│   ├── signup.py
│   ├── password.py
│   ├── lock_pin.py       # POST /auth/set-lock-pin, POST /auth/verify-lock-pin
│   ├── permission.py     # GET /auth/permissions
│   └── role.py           # GET /auth/roles
│
└── router.py             # 모든 auth API 통합
```

### 인증 방식

**Hybrid 방식 (JWT + Refresh Token in DB)**:
- **Access Token (JWT)**: Stateless, 짧은 만료 (15-30분)
- **Refresh Token**: DB 저장, 긴 만료 (7-30일)
- 로그아웃 시 Refresh Token 무효화 가능
- 토큰 탈취 시 즉시 차단 가능

### 멀티테넌시 지원

- 로그인 후 센터 전환 API 제공
- JWT에는 현재 센터 정보만 포함
- 센터 전환 시 JWT 재발급

---

## Core Schemas (Models)

### Account (계정)

**로그인 정보 및 인증 주체**

```python
from sqlalchemy import String, Integer, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

class Account(Base):
    __tablename__ = "accounts"

    # Primary Key
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Authentication
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password: Mapped[str] = mapped_column(String(255), nullable=False)  # 해시 저장

    # Account Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Social Login (Phase 2)
    provider: Mapped[str] = mapped_column(
        String(20),
        default="email",
        nullable=False
    )  # email, kakao, naver, google
    provider_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Lock PIN (간편 인증)
    lock_pin: Mapped[str | None] = mapped_column(
        String(4),  # 4자리 숫자
        nullable=True
    )
    lock_pin_duration_minute: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True
        # null = 재접속 시 항상 PIN 요구
        # 30 = 30분 동안 PIN 입력 없이 사용 가능
    )

    # Timestamps
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )
```

**주요 변경사항**:
- `person_id` 제거 → Person이 Account를 참조 (FK 제약 없음, 모듈 간 독립성)
- `password_hash` → `password`로 필드명 단순화 (해시 저장은 동일)
- `password_history` 제거 → 별도 `PasswordHistory` 테이블로 분리
- `two_factor_enabled`, `two_factor_secret` 제거 → Phase 1에서 제외
- `lock_pin`, `lock_pin_duration_minute` 추가 → 간편 인증 지원

**모듈러 모놀리스 설계**:
- 모든 FK 제약 제거 (모듈 간 독립성 확보)
- 데이터 무결성은 애플리케이션 레벨에서 관리
- 향후 마이크로서비스 전환 용이

### RefreshToken (리프레시 토큰)

**장기 토큰 관리 및 로그아웃 지원**

```python
class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    # Primary Key
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Account Reference (FK 제약 없음)
    account_id: Mapped[int] = mapped_column(Integer, nullable=False)

    # Token
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)

    # Device Information
    device_info: Mapped[str | None] = mapped_column(String(500), nullable=True)  # User-Agent
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)  # IPv6 지원

    # Expiration
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
```

**참고**: `account_id`는 FK 제약 없이 정수로만 저장. CASCADE 삭제는 애플리케이션에서 처리.

### LoginAttempt (로그인 시도 기록) - Optional

**보안 감사 및 분석용 (Redis로 대체 가능)**

```python
class LoginAttempt(Base):
    __tablename__ = "login_attempts"

    # Primary Key
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Account
    email: Mapped[str] = mapped_column(String(255), nullable=False)

    # Result
    success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    failure_reason: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Context
    ip_address: Mapped[str] = mapped_column(String(45), nullable=False)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Timestamp
    attempted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
```

### PasswordHistory (비밀번호 이력)

**비밀번호 재사용 방지용**

```python
class PasswordHistory(Base):
    __tablename__ = "password_histories"

    # Primary Key
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Account Reference (FK 제약 없음)
    account_id: Mapped[int] = mapped_column(Integer, nullable=False)

    # Password
    password: Mapped[str] = mapped_column(String(255), nullable=False)  # 해시 저장

    # Timestamp
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
```

**사용 방법**:
- 비밀번호 변경 시 이전 비밀번호를 이 테이블에 저장
- 최근 3개 비밀번호와 비교하여 재사용 방지
- 오래된 이력은 유지하거나 삭제 가능 (정책에 따라)
- Account 삭제 시 애플리케이션 레벨에서 PasswordHistory도 함께 삭제

### Permission (권한 정의)

**글로벌 권한 정의 (시스템 전체에서 관리)**

```python
class Permission(Base):
    __tablename__ = "permissions"

    # Primary Key
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Permission Identity
    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    # 예: "client:read", "counseling:create", "schedule:delete"

    # Display
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Categorization (UI 그룹핑)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    # 예: "client", "counseling", "assessment", "schedule", "billing"

    # New Permission Tracking
    is_new: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # 새 권한 추가 시 true로 설정, 배포 후 알림용
    added_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )
```

### Role (역할 정의)

**글로벌 역할 정의 (프리셋 역할)**

```python
class Role(Base):
    __tablename__ = "roles"

    # Primary Key
    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Role Identity
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    # 예: "center_admin", "counselor", "receptionist"

    # Display
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # 예: "센터 관리자", "상담사", "접수직원"
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )
```

### RolePermission (역할-권한 연결)

**N:M 관계 테이블**

```python
class RolePermission(Base):
    __tablename__ = "role_permissions"

    # Composite Primary Key (FK 제약 없음)
    role_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    permission_id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Timestamp
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
```

**설명**:
- 역할(Role)과 권한(Permission)은 N:M 관계
- FK 제약 없이 정수로만 저장 (모듈 독립성)
- 역할을 수정하면 연결된 권한만 변경 (기존 센터 멤버에게 영향 없음 - 복사 정책)
- 새 권한이 시스템에 추가되면 `Permission.is_new=true` 설정
- 센터별 멤버 권한 할당은 Center 모듈 (`CenterMember`)에서 관리
- CASCADE 삭제는 애플리케이션 레벨에서 처리

---

## Pydantic Schemas (DTOs)

### Authentication Schemas

#### LoginRequest

```python
from pydantic import BaseModel, EmailStr, Field

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)
```

#### LoginResponse

```python
from datetime import datetime

class AccountSummary(BaseModel):
    id: int
    email: str
    is_verified: bool
    created_at: datetime

    model_config = {"from_attributes": True}

class PersonSummary(BaseModel):
    id: int
    name: str
    phone: str | None

    model_config = {"from_attributes": True}

class LoginResponse(BaseModel):
    account: AccountSummary
    person: PersonSummary | None  # 시스템 관리자는 None
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int  # seconds (1800 = 30분)
```

#### RefreshTokenRequest

```python
class RefreshTokenRequest(BaseModel):
    refresh_token: str
```

#### SwitchCenterRequest

```python
class SwitchCenterRequest(BaseModel):
    center_id: int = Field(..., gt=0)
```

#### SwitchCenterResponse

```python
class CenterSummary(BaseModel):
    id: int
    name: str
    role_name: str
    permissions: list[str]

    model_config = {"from_attributes": True}

class SwitchCenterResponse(BaseModel):
    center: CenterSummary
    access_token: str  # 새 JWT (center_id, role, permissions 포함)
    token_type: str = "Bearer"
    expires_in: int
```

### Password Management Schemas

#### ChangePasswordRequest

```python
class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(
        ...,
        min_length=10,
        description="최소 10자, 대소문자, 숫자, 특수문자 포함"
    )
```

**참고**: 비밀번호 찾기 기능은 제공하지 않습니다. 센터 관리자가 직접 비밀번호를 재설정하거나, 다른 인증 방식을 사용합니다.

### Lock PIN Schemas

#### SetLockPinRequest

```python
class SetLockPinRequest(BaseModel):
    lock_pin: str = Field(..., pattern=r"^[0-9]{4}$", description="4자리 숫자")
    lock_pin_duration_minute: int | None = Field(
        None,
        ge=1,
        le=1440,  # 최대 24시간
        description="PIN 유효 시간 (분), null = 재접속 시 항상 PIN 요구"
    )
```

#### VerifyLockPinRequest

```python
class VerifyLockPinRequest(BaseModel):
    lock_pin: str = Field(..., pattern=r"^[0-9]{4}$")
```

#### VerifyLockPinResponse

```python
class VerifyLockPinResponse(BaseModel):
    message: str
    access_token: str
    token_type: str = "Bearer"
    expires_in: int
```

### Account Management Schemas

#### SignupRequest (회원가입)

```python
from pydantic import BaseModel, EmailStr, Field

class PersonCreate(BaseModel):
    """Person 생성 정보 (회원가입 시 포함)"""
    name: str = Field(..., min_length=1, max_length=100)
    phone: str | None = Field(None, pattern=r"^01[0-9]-\d{3,4}-\d{4}$")
    birth_date: date | None = None
    gender: str | None = Field(None, pattern=r"^(male|female|other)$")

class SignupRequest(BaseModel):
    """회원가입 요청 (일반 사용자)"""
    email: EmailStr
    password: str = Field(..., min_length=10)
    person: PersonCreate  # Person 정보 (필수)

class SignupResponse(BaseModel):
    """회원가입 응답"""
    account: AccountSummary
    person: PersonSummary
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int
```

**회원가입 처리 순서** (Account → Person):
1. **Account 먼저 생성** (email, password)
2. **Person 생성** (name, phone, birth_date, gender, **account_id 할당**)
3. RefreshToken 생성
4. JWT 발급

**참고**:
- Person 모듈은 `account_id` 필드로 Account를 참조 (FK 제약 없음)
- Account 삭제 시 애플리케이션 레벨에서 Person도 함께 삭제 처리
- 모듈 간 독립성 확보로 향후 마이크로서비스 전환 용이

**시스템 관리자 생성 (내부용)**:
```python
class AccountCreate(BaseModel):
    """Account 직접 생성 (시스템 관리자용, 내부 API)"""
    email: EmailStr
    password: str = Field(..., min_length=10)
    # 시스템 관리자는 Person 없이 Account만 생성
```

#### AccountUpdate

```python
class AccountUpdate(BaseModel):
    email: EmailStr | None = None
    is_active: bool | None = None
```

#### AccountResponse

```python
class AccountResponse(BaseModel):
    id: int
    email: str
    is_active: bool
    is_verified: bool
    provider: str
    lock_pin_duration_minute: int | None  # lock_pin은 보안상 제외
    last_login_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

### Permission & Role Schemas

#### PermissionResponse

```python
from datetime import datetime

class PermissionResponse(BaseModel):
    """권한 응답 (단일 권한 정보)"""
    id: int
    code: str
    name: str
    description: str | None
    category: str
    is_new: bool
    added_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

#### PermissionSummary

```python
class PermissionSummary(BaseModel):
    """권한 요약 (목록용)"""
    id: int
    code: str
    name: str
    category: str

    model_config = {"from_attributes": True}
```

#### RoleResponse

```python
class RoleResponse(BaseModel):
    """역할 응답 (권한 포함)"""
    id: int
    code: str
    name: str
    description: str | None
    permissions: list[PermissionSummary]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

#### RoleSummary

```python
class RoleSummary(BaseModel):
    """역할 요약 (목록용)"""
    id: int
    code: str
    name: str
    description: str | None

    model_config = {"from_attributes": True}
```

#### PermissionsByCategory

```python
class PermissionsByCategory(BaseModel):
    """카테고리별 권한 그룹핑 (UI용)"""
    category: str
    category_name: str  # 예: "client" → "내담자 관리"
    permissions: list[PermissionSummary]
```

#### PermissionCreate (Phase 2)

```python
class PermissionCreate(BaseModel):
    """권한 생성 (PLATFORM_ADMIN 전용)"""
    code: str = Field(..., pattern=r"^[a-z_]+:[a-z_]+$")
    # 예: "client:read", "counseling:create"
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    category: str = Field(..., min_length=1, max_length=50)
    is_new: bool = True  # 새 권한은 기본적으로 true
```

#### PermissionUpdate (Phase 2)

```python
class PermissionUpdate(BaseModel):
    """권한 수정 (PLATFORM_ADMIN 전용)"""
    name: str | None = None
    description: str | None = None
    is_new: bool | None = None  # 알림 확인 후 false로 변경
```

#### RoleCreate (Phase 2)

```python
class RoleCreate(BaseModel):
    """역할 생성 (PLATFORM_ADMIN 전용)"""
    code: str = Field(..., pattern=r"^[a-z_]+$")
    # 예: "center_admin", "counselor"
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    permission_ids: list[int] = Field(default_factory=list)
```

#### RoleUpdate (Phase 2)

```python
class RoleUpdate(BaseModel):
    """역할 수정 (PLATFORM_ADMIN 전용)"""
    name: str | None = None
    description: str | None = None
    permission_ids: list[int] | None = None  # 권한 전체 교체
```

---

## 비즈니스 규칙

### 1. 계정 생성 규칙

| 규칙 | 설명 |
|------|------|
| **Account 먼저 생성** | Account 생성 → Person 생성 (account_id 할당) |
| **이메일 고유성** | `email`은 시스템 전체에서 unique |
| **Person 연결** | 일반 사용자는 Person 필수, 시스템 관리자는 Person 없음 |
| **비밀번호 정책** | 최소 10자, 대소문자, 숫자, 특수문자 필수 |
| **초기 상태** | `is_active=true`, `is_verified=false` |
| **Provider** | 기본값 `email` (Phase 2: `kakao`, `naver`, `google`) |

**트랜잭션 처리**:
```python
async def signup(data: SignupRequest, uow: UnitOfWork):
    async with uow:
        # 1. Account 먼저 생성
        account = await account_repo.create({
            "email": data.email,
            "password": hash_password(data.password)  # password 필드
        })

        # 2. Person 생성 (account_id 할당)
        person = await person_repo.create({
            "account_id": account.id,  # FK 연결
            "name": data.person.name,
            "phone": data.person.phone,
            "birth_date": data.person.birth_date,
            "gender": data.person.gender
        })

        # 3. RefreshToken 생성
        refresh_token = await refresh_token_repo.create({...})

        await uow.commit()

        # 4. JWT 발급
        access_token = create_access_token(account)

        return SignupResponse(
            account=AccountSummary.model_validate(account),
            person=PersonSummary.model_validate(person),
            access_token=access_token,
            refresh_token=refresh_token.token,
            ...
        )
```

**변경사항**:
- 순서 역전: Account → Person (이전: Person → Account)
- Person에 `account_id` 추가 (FK 제약 없음)
- `password_hash` → `password` 필드명 변경
- 모든 FK 제약 제거 (모듈러 모놀리스 설계)

**CASCADE 삭제 처리** (애플리케이션 레벨):
```python
async def delete_account(account_id: int, uow: UnitOfWork):
    """Account 삭제 시 관련 데이터 모두 삭제"""
    async with uow:
        # 1. RefreshToken 삭제
        await refresh_token_repo.delete_by_account_id(account_id)

        # 2. PasswordHistory 삭제
        await password_history_repo.delete_by_account_id(account_id)

        # 3. Person 삭제 (다른 모듈)
        await person_repo.delete_by_account_id(account_id)

        # 4. Account 삭제
        await account_repo.delete(account_id)

        await uow.commit()
```

### 2. 비밀번호 정책

```python
PASSWORD_POLICY = {
    "min_length": 10,
    "require_uppercase": True,
    "require_lowercase": True,
    "require_digit": True,
    "require_special": True,
    "special_chars": "!@#$%^&*",
    "prevent_reuse": 3,  # 최근 3개 비밀번호 재사용 금지
}
```

**검증 규칙**:
- 길이: 10자 이상
- 대문자 최소 1개
- 소문자 최소 1개
- 숫자 최소 1개
- 특수문자 최소 1개 (`!@#$%^&*`)
- 최근 3개 비밀번호와 다름 (PasswordHistory 테이블 조회)

**비밀번호 재사용 검증 로직**:
```python
async def check_password_reuse(account_id: int, new_password: str) -> bool:
    """최근 3개 비밀번호와 비교"""
    # PasswordHistory 테이블에서 최근 3개 조회
    recent_passwords = await password_history_repo.get_recent(
        account_id=account_id,
        limit=3
    )

    # 새 비밀번호와 비교
    for history in recent_passwords:
        if verify_password(new_password, history.password):
            return True  # 재사용

    return False  # 사용 가능
```

**비밀번호 변경 시 이력 저장**:
```python
async def change_password(account_id: int, new_password: str, uow: UnitOfWork):
    async with uow:
        # 1. 이전 비밀번호를 PasswordHistory에 저장
        current_account = await account_repo.get(account_id)
        await password_history_repo.create({
            "account_id": account_id,
            "password": current_account.password  # 현재 해시 저장
        })

        # 2. Account의 password 업데이트
        await account_repo.update(account_id, {
            "password": hash_password(new_password)
        })

        await uow.commit()
```

### 3. JWT Payload 구조

```json
{
  "account_id": 1,
  "person_id": 10,
  "email": "user@example.com",
  "center_id": 1,
  "plan": "pro",
  "role_id": 5,
  "role_name": "상담사",
  "permissions": [
    "client:read",
    "client:create",
    "counseling:read"
  ],
  "exp": 1234567890,
  "iat": 1234567000
}
```

**설명**:
- 로그인 직후: `center_id`, `plan`, `role_id`, `permissions` 없음
- 센터 전환 후: 센터 정보 + 플랜 정보 포함
- 매 API 호출마다 DB 조회 방지 (성능 최적화)

**필드 설명**:

| 필드 | 설명 | 재발급 시점 |
|------|------|-----------|
| `account_id` | 계정 ID (불변) | - |
| `person_id` | Person ID (불변) | - |
| `email` | 이메일 (불변) | - |
| `center_id` | 현재 선택된 센터 ID | 센터 전환 시 |
| `plan` | 현재 센터의 구독 플랜 | 센터 전환 시, 플랜 변경 시 |
| `role_id` | 센터 내 역할 ID | 센터 전환 시, 역할 변경 시 |
| `role_name` | 역할 이름 (UI 표시용) | 센터 전환 시, 역할 변경 시 |
| `permissions` | 권한 목록 (RBAC) | 센터 전환 시, 권한 변경 시 |
| `exp` | 만료 시간 (Unix timestamp) | 매 재발급 시 |
| `iat` | 발급 시간 (Unix timestamp) | 매 재발급 시 |

### 4. Refresh Token 관리

| 속성 | 설명 |
|------|------|
| **만료 기간** | 7-30일 (설정 가능) |
| **저장 방식** | DB에 해시 저장 (원본 토큰은 클라이언트만 보유) |
| **디바이스 추적** | `device_info` (User-Agent), `ip_address` 기록 |
| **로그아웃** | 해당 토큰 DB에서 삭제 |
| **전체 로그아웃** | 해당 계정의 모든 토큰 삭제 |

### 5. Rate Limiting (IP 기반)

```python
RATE_LIMIT = {
    "max_attempts": 5,
    "window_seconds": 900,  # 15분
    "lockout_duration": 900,  # 15분 차단
}
```

**Redis 키 구조**:
```
login_attempts:{ip_address} = 3  (TTL: 900초)
login_lockout:{ip_address} = 1   (TTL: 900초)
```

**동작 방식**:
1. 로그인 실패 시 `login_attempts:{ip}` 증가
2. 5회 실패 시 `login_lockout:{ip}` 설정 (15분)
3. 15분 후 자동 해제 (TTL)
4. 성공 시 `login_attempts:{ip}` 삭제

### 6. 권한 및 역할 관리

#### 권한(Permission) 관리

| 규칙 | 설명 |
|------|------|
| **글로벌 관리** | 모든 권한은 시스템 전체에서 하나로 관리 |
| **Code 고유성** | `code`는 unique (예: `client:read`) |
| **카테고리 그룹핑** | UI에서 도메인별로 그룹핑하여 표시 |
| **새 권한 추적** | 새 권한 추가 시 `is_new=true`, 센터 알림용 |
| **복사 정책** | 멤버 초대 시 권한 복사 (Center 모듈에서 처리) |

**권한 코드 네이밍 규칙**:
```
{domain}:{action}

domain: client, counseling, assessment, schedule, billing, center, system
action: read, create, update, delete, approve, export, ...

예시:
- client:read (내담자 조회)
- counseling:create (상담 생성)
- assessment:approve (검사 승인)
- schedule:delete (일정 삭제)
- billing:export (결제 내역 내보내기)
```

#### 역할(Role) 관리

| 규칙 | 설명 |
|------|------|
| **프리셋 역할** | 미리 정의된 역할 (예: 센터장, 상담사, 접수직원) |
| **N:M 관계** | Role ↔ Permission (RolePermission 테이블) |
| **복사 정책** | 멤버 초대 시 역할의 권한 목록을 복사 |
| **역할 수정** | 역할 수정해도 기존 멤버 권한 변경 없음 |
| **신규 멤버** | 신규 멤버는 수정된 역할의 최신 권한 받음 |

**기본 역할 예시**:
```python
ROLES = {
    "platform_admin": {
        "name": "플랫폼 관리자",
        "description": "전체 시스템 관리 권한",
        "permissions": ["*"]  # 모든 권한
    },
    "center_admin": {
        "name": "센터 관리자",
        "description": "센터 전체 관리 권한",
        "permissions": [
            "client:*",
            "counseling:*",
            "assessment:*",
            "schedule:*",
            "billing:read",
            "center:update"
        ]
    },
    "counselor": {
        "name": "상담사",
        "description": "상담 및 검사 진행",
        "permissions": [
            "client:read",
            "client:create",
            "counseling:read",
            "counseling:create",
            "assessment:read",
            "assessment:create",
            "schedule:read"
        ]
    },
    "receptionist": {
        "name": "접수직원",
        "description": "고객 응대 및 일정 관리",
        "permissions": [
            "client:read",
            "client:create",
            "schedule:read",
            "schedule:create",
            "billing:read"
        ]
    }
}
```

#### 새 권한 처리 플로우

```
1. 신기능 개발 → 새 권한 추가 (is_new=true)
   예: Permission.create({
     code: "billing:export",
     name: "결제 내역 내보내기",
     category: "billing",
     is_new: true
   })

2. 센터 접속 시 새 권한 알림 표시
   GET /auth/permissions?is_new=true
   → 센터 관리자에게 알림

3. 센터 관리자가 멤버별로 새 권한 부여 여부 결정
   → Center 모듈에서 CenterMember.permissions 업데이트

4. 알림 확인 후 is_new=false 설정 (선택적)
   PATCH /auth/permissions/{id} { is_new: false }
```

### 7. JWT 재발급 시점 및 정책

| 시점 | 변경 필드 | 트리거 | 담당 모듈 |
|------|----------|--------|----------|
| **로그인** | 전체 발급 | `POST /auth/login` | Auth |
| **센터 전환** | `center_id`, `plan`, `role_id`, `permissions` | `POST /auth/switch-center` | Auth |
| **플랜 변경** | `plan` | `POST /subscription/upgrade` | Subscription |
| **역할 변경** | `role_id`, `role_name`, `permissions` | 센터 관리자가 멤버 역할 변경 | Center |
| **토큰 갱신** | `exp`, `iat` | `POST /auth/refresh` | Auth |

**플랜 변경 시 JWT 재발급 예시**:
```python
# app/modules/subscription/handlers/upgrade_handler.py
async def upgrade_handler(...):
    async with uow:
        # 플랜 업그레이드
        await subscription_repo.update(subscription.id, {"plan": "pro"})
        await uow.commit()

    # JWT 재발급 (새 plan 포함)
    new_token = await create_access_token({
        "account_id": auth.account_id,
        "center_id": auth.center_id,
        "plan": "pro",  # 업데이트된 플랜
        "role_id": auth.role_id,
        "permissions": auth.permissions
    })

    return {"access_token": new_token, ...}
```

### 8. 센터 전환 플로우

```
1. 로그인: POST /auth/login
   → JWT (account_id, person_id, email만 포함)
   → Refresh Token

2. 접근 가능한 센터 목록: GET /auth/my-centers
   → [{ id: 1, name: "A센터", role: "상담사", plan: "free" }, ...]

3. 센터 전환: POST /auth/switch-center
   body: { "center_id": 2 }
   → 새 JWT 발급 (center_id, plan, role_id, permissions 포함)

4. API 호출 시 JWT에서 center_id, plan, permissions 추출하여 권한 검증
```

### 9. Core 권한 검증 데코레이터

Auth 도메인은 Core 레이어에 2가지 권한 검증 데코레이터를 제공합니다:

#### 1. `@require_permission` - RBAC (Role-Based Access Control)

**용도**: 센터 내 역할 기반 권한 검증

```python
# app/core/permissions.py
from functools import wraps
from fastapi import HTTPException

def require_permission(required_permissions: list[str]):
    """
    센터 내 권한 검증 데코레이터

    Args:
        required_permissions: 필요한 권한 목록 (OR 조건)

    Example:
        @require_permission(["client:read", "client:create"])
        async def get_clients(...):
            # JWT의 permissions에 "client:read" OR "client:create" 있어야 접근 가능
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            auth = kwargs.get("auth")  # Depends(get_current_user)로 주입

            # JWT에서 permissions 추출
            user_permissions = set(auth.permissions)
            required = set(required_permissions)

            # 교집합 확인 (OR 조건)
            if not user_permissions.intersection(required):
                raise HTTPException(
                    status_code=403,
                    detail={
                        "message": "Insufficient permissions",
                        "required": list(required),
                        "current": list(user_permissions)
                    }
                )

            return await func(*args, **kwargs)
        return wrapper
    return decorator
```

#### 2. `@require_plan` - PBAC (Plan-Based Access Control)

**용도**: 구독 플랜 기반 기능 제한

```python
# app/core/permissions.py
def require_plan(allowed_plans: list[str]):
    """
    구독 플랜 검증 데코레이터

    Args:
        allowed_plans: 허용된 플랜 목록 (OR 조건)

    Example:
        @require_plan(["pro", "enterprise"])
        async def generate_ai_report(...):
            # JWT의 plan이 "pro" OR "enterprise"여야 접근 가능
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            auth = kwargs.get("auth")

            # JWT에서 plan 추출
            current_plan = auth.plan

            # 플랜 검증
            if current_plan not in allowed_plans:
                raise HTTPException(
                    status_code=402,  # Payment Required
                    detail={
                        "message": "This feature requires a higher plan",
                        "current_plan": current_plan,
                        "required_plans": allowed_plans,
                        "upgrade_url": "/subscription/upgrade"
                    }
                )

            return await func(*args, **kwargs)
        return wrapper
    return decorator
```

#### 데코레이터 조합 사용

```python
# app/modules/assessment/router.py
@router.post("/ai-report")
@require_plan(["pro", "enterprise"])  # 플랜 검증 먼저
@require_permission(["assessment:create"])  # 권한 검증
async def generate_ai_report(...):
    """
    AI 보고서 생성
    - Pro 이상 플랜 필요
    - assessment:create 권한 필요
    """
    pass
```

**검증 순서**:
1. `@require_plan`: 플랜 검증 (402 Payment Required)
2. `@require_permission`: 권한 검증 (403 Forbidden)

**에러 응답 차이**:
- 402: 플랜 업그레이드 필요 → `/subscription/upgrade`로 유도
- 403: 권한 부족 → 센터 관리자에게 권한 요청 안내

### 10. Lock PIN 관리

| 속성 | 설명 |
|------|------|
| **형식** | 4자리 숫자 (`^[0-9]{4}$`) |
| **저장** | 해시 저장 (bcrypt) |
| **용도** | 앱 재접속 시 간편 인증 |
| **유효 시간** | `lock_pin_duration_minute` 설정 (null = 항상 요구) |

**동작 방식**:
1. 사용자가 PIN 설정 (`POST /auth/set-lock-pin`)
2. 앱 재접속 시 PIN 입력 요구
3. PIN 검증 성공 시 새 JWT 발급
4. `lock_pin_duration_minute` 동안 PIN 재입력 불필요 (클라이언트 추적)

**보안**:
- PIN은 해시 저장 (bcrypt)
- API 응답에서 PIN 노출 금지
- 5회 실패 시 계정 잠금 (선택적)

### 11. 계정 상태 관리

| 상태 | 설명 | 동작 |
|------|------|------|
| `is_active=true` | 활성 계정 | 로그인 가능 |
| `is_active=false` | 비활성 계정 | 로그인 불가, 재활성화 필요 |
| `is_verified=true` | 이메일 인증 완료 | 모든 기능 사용 가능 |
| `is_verified=false` | 이메일 인증 미완료 | 일부 기능 제한 (선택적) |

---

## API 엔드포인트

### Authentication

#### 로그인

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "StrongPassword123!"
}
```

**응답 (200 OK)**:
```json
{
  "account": {
    "id": 1,
    "email": "user@example.com",
    "is_verified": true,
    "created_at": "2026-01-13T10:00:00Z"
  },
  "person": {
    "id": 10,
    "name": "김철수",
    "phone": "010-1234-5678"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 1800
}
```

**에러 (401 Unauthorized)**:
```json
{
  "detail": "Invalid email or password"
}
```

**에러 (429 Too Many Requests)**:
```json
{
  "detail": "Too many login attempts. Please try again in 15 minutes."
}
```

#### 로그아웃

```http
POST /auth/logout
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**응답 (200 OK)**:
```json
{
  "message": "Logged out successfully"
}
```

#### 전체 디바이스 로그아웃

```http
POST /auth/logout-all
Authorization: Bearer {access_token}
```

**응답 (200 OK)**:
```json
{
  "message": "Logged out from all devices"
}
```

#### Access Token 재발급

```http
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**응답 (200 OK)**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 1800
}
```

**에러 (401 Unauthorized)**:
```json
{
  "detail": "Invalid or expired refresh token"
}
```

### Center Switching

#### 접근 가능한 센터 목록

```http
GET /auth/my-centers
Authorization: Bearer {access_token}
```

**응답 (200 OK)**:
```json
{
  "centers": [
    {
      "id": 1,
      "name": "A센터",
      "role_name": "상담사",
      "is_current": true
    },
    {
      "id": 2,
      "name": "B센터",
      "role_name": "센터장",
      "is_current": false
    }
  ]
}
```

#### 센터 전환

```http
POST /auth/switch-center
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "center_id": 2
}
```

**응답 (200 OK)**:
```json
{
  "center": {
    "id": 2,
    "name": "B센터",
    "role_name": "센터장",
    "permissions": [
      "client:read",
      "client:create",
      "client:update",
      "client:delete",
      "counseling:read",
      "counseling:create"
    ]
  },
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 1800
}
```

**에러 (403 Forbidden)**:
```json
{
  "detail": "You do not have access to this center"
}
```

### Password Management

#### 비밀번호 변경

```http
POST /auth/change-password
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "current_password": "OldPassword123!",
  "new_password": "NewPassword123!"
}
```

**응답 (200 OK)**:
```json
{
  "message": "Password changed successfully"
}
```

**에러 (400 Bad Request)**:
```json
{
  "detail": "Password must contain at least one uppercase letter"
}
```

**에러 (400 Bad Request - 재사용)**:
```json
{
  "detail": "This password was recently used. Please choose a different password."
}
```

**참고**: 비밀번호 찾기 기능은 제공하지 않습니다. 센터 관리자가 직접 사용자 비밀번호를 재설정할 수 있습니다.

### Lock PIN Management

#### PIN 설정

```http
POST /auth/set-lock-pin
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "lock_pin": "1234",
  "lock_pin_duration_minute": 30
}
```

**응답 (200 OK)**:
```json
{
  "message": "Lock PIN set successfully"
}
```

**에러 (400 Bad Request)**:
```json
{
  "detail": "PIN must be exactly 4 digits"
}
```

#### PIN 검증

```http
POST /auth/verify-lock-pin
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "lock_pin": "1234"
}
```

**응답 (200 OK)**:
```json
{
  "message": "PIN verified successfully",
  "access_token": "eyJhbGciOiJIUzI1NiIs...",  # 새 토큰 발급
  "token_type": "Bearer",
  "expires_in": 1800
}
```

**에러 (401 Unauthorized)**:
```json
{
  "detail": "Invalid PIN"
}
```

#### PIN 제거

```http
DELETE /auth/lock-pin
Authorization: Bearer {access_token}
```

**응답 (200 OK)**:
```json
{
  "message": "Lock PIN removed successfully"
}
```

### Permission & Role Management

#### 권한 목록 조회 (Phase 1)

```http
GET /auth/permissions
Authorization: Bearer {access_token}
```

**Query Parameters**:
- `is_new`: boolean (optional) - 새 권한만 필터링

**응답 (200 OK)**:
```json
{
  "items": [
    {
      "id": 1,
      "code": "client:read",
      "name": "내담자 조회",
      "description": "내담자 정보 조회 권한",
      "category": "client",
      "is_new": false,
      "added_at": "2026-01-01T00:00:00Z",
      "created_at": "2026-01-01T00:00:00Z",
      "updated_at": "2026-01-01T00:00:00Z"
    },
    {
      "id": 15,
      "code": "billing:export",
      "name": "결제 내역 내보내기",
      "description": "결제 내역 엑셀 내보내기",
      "category": "billing",
      "is_new": true,
      "added_at": "2026-01-13T10:00:00Z",
      "created_at": "2026-01-13T10:00:00Z",
      "updated_at": "2026-01-13T10:00:00Z"
    }
  ],
  "total": 2
}
```

#### 권한 목록 조회 (카테고리별 그룹핑)

```http
GET /auth/permissions/grouped
Authorization: Bearer {access_token}
```

**응답 (200 OK)**:
```json
{
  "categories": [
    {
      "category": "client",
      "category_name": "내담자 관리",
      "permissions": [
        {
          "id": 1,
          "code": "client:read",
          "name": "내담자 조회",
          "category": "client"
        },
        {
          "id": 2,
          "code": "client:create",
          "name": "내담자 생성",
          "category": "client"
        }
      ]
    },
    {
      "category": "counseling",
      "category_name": "상담 관리",
      "permissions": [
        {
          "id": 5,
          "code": "counseling:read",
          "name": "상담 조회",
          "category": "counseling"
        }
      ]
    }
  ]
}
```

#### 역할 목록 조회 (Phase 1)

```http
GET /auth/roles
Authorization: Bearer {access_token}
```

**응답 (200 OK)**:
```json
{
  "items": [
    {
      "id": 1,
      "code": "center_admin",
      "name": "센터 관리자",
      "description": "센터 전체 관리 권한",
      "permissions": [
        {
          "id": 1,
          "code": "client:read",
          "name": "내담자 조회",
          "category": "client"
        },
        {
          "id": 2,
          "code": "client:create",
          "name": "내담자 생성",
          "category": "client"
        }
      ],
      "created_at": "2026-01-01T00:00:00Z",
      "updated_at": "2026-01-01T00:00:00Z"
    },
    {
      "id": 2,
      "code": "counselor",
      "name": "상담사",
      "description": "상담 및 검사 진행",
      "permissions": [
        {
          "id": 1,
          "code": "client:read",
          "name": "내담자 조회",
          "category": "client"
        }
      ],
      "created_at": "2026-01-01T00:00:00Z",
      "updated_at": "2026-01-01T00:00:00Z"
    }
  ],
  "total": 2
}
```

#### 역할 상세 조회 (Phase 1)

```http
GET /auth/roles/{role_id}
Authorization: Bearer {access_token}
```

**응답 (200 OK)**:
```json
{
  "id": 1,
  "code": "center_admin",
  "name": "센터 관리자",
  "description": "센터 전체 관리 권한",
  "permissions": [
    {
      "id": 1,
      "code": "client:read",
      "name": "내담자 조회",
      "category": "client"
    }
  ],
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-01T00:00:00Z"
}
```

#### 권한 생성 (Phase 2 - PLATFORM_ADMIN 전용)

```http
POST /auth/permissions
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "code": "billing:export",
  "name": "결제 내역 내보내기",
  "description": "결제 내역을 엑셀로 내보내기",
  "category": "billing",
  "is_new": true
}
```

**응답 (201 Created)**:
```json
{
  "id": 15,
  "code": "billing:export",
  "name": "결제 내역 내보내기",
  "description": "결제 내역을 엑셀로 내보내기",
  "category": "billing",
  "is_new": true,
  "added_at": "2026-01-13T10:00:00Z",
  "created_at": "2026-01-13T10:00:00Z",
  "updated_at": "2026-01-13T10:00:00Z"
}
```

**에러 (403 Forbidden)**:
```json
{
  "detail": "PLATFORM_ADMIN permission required"
}
```

#### 권한 수정 (Phase 2 - PLATFORM_ADMIN 전용)

```http
PATCH /auth/permissions/{permission_id}
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "name": "결제 내역 엑셀 다운로드",
  "is_new": false
}
```

**응답 (200 OK)**:
```json
{
  "id": 15,
  "code": "billing:export",
  "name": "결제 내역 엑셀 다운로드",
  "description": "결제 내역을 엑셀로 내보내기",
  "category": "billing",
  "is_new": false,
  "added_at": "2026-01-13T10:00:00Z",
  "created_at": "2026-01-13T10:00:00Z",
  "updated_at": "2026-01-13T10:05:00Z"
}
```

#### 역할 생성 (Phase 2 - PLATFORM_ADMIN 전용)

```http
POST /auth/roles
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "code": "analyst",
  "name": "데이터 분석가",
  "description": "통계 및 데이터 분석 전용",
  "permission_ids": [1, 5, 10, 15]
}
```

**응답 (201 Created)**:
```json
{
  "id": 5,
  "code": "analyst",
  "name": "데이터 분석가",
  "description": "통계 및 데이터 분석 전용",
  "permissions": [
    {
      "id": 1,
      "code": "client:read",
      "name": "내담자 조회",
      "category": "client"
    },
    {
      "id": 15,
      "code": "billing:export",
      "name": "결제 내역 엑셀 다운로드",
      "category": "billing"
    }
  ],
  "created_at": "2026-01-13T10:00:00Z",
  "updated_at": "2026-01-13T10:00:00Z"
}
```

#### 역할 수정 (Phase 2 - PLATFORM_ADMIN 전용)

```http
PATCH /auth/roles/{role_id}
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "name": "선임 데이터 분석가",
  "permission_ids": [1, 5, 10, 15, 20]
}
```

**응답 (200 OK)**:
```json
{
  "id": 5,
  "code": "analyst",
  "name": "선임 데이터 분석가",
  "description": "통계 및 데이터 분석 전용",
  "permissions": [
    {
      "id": 1,
      "code": "client:read",
      "name": "내담자 조회",
      "category": "client"
    },
    {
      "id": 20,
      "code": "system:analytics",
      "name": "시스템 분석",
      "category": "system"
    }
  ],
  "created_at": "2026-01-13T10:00:00Z",
  "updated_at": "2026-01-13T10:10:00Z"
}
```

**참고**:
- 역할 수정 시 `permission_ids`는 **전체 교체** (기존 권한 모두 삭제 후 새로 연결)
- 기존 센터 멤버의 권한은 영향받지 않음 (복사 정책)
- 신규 멤버만 수정된 역할의 권한 받음

#### 역할 삭제 (Phase 2 - PLATFORM_ADMIN 전용)

```http
DELETE /auth/roles/{role_id}
Authorization: Bearer {access_token}
```

**응답 (204 No Content)**

**에러 (400 Bad Request)**:
```json
{
  "detail": "Cannot delete role with active members"
}
```

---

## 참고 문서

- **의사결정 기록**: `/docs/auth/decision-log.md` - 설계 질문-답변 및 근거
- **엣지 케이스**: `/docs/auth/edge-cases.md` (예정)
- **시나리오**: `/docs/auth/scenarios.md` (예정)
- **프로젝트 설정**: `/CLAUDE.md` - 개발 규칙 및 아키텍처 패턴
