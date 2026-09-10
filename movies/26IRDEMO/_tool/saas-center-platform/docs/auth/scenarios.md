# Auth 도메인 시나리오

> 인증 및 권한 관리의 실제 사용 시나리오

---

## 목차

1. [시나리오 1: 센터 관리자 회원가입](#시나리오-1-센터-관리자-회원가입)
2. [시나리오 2: 일반 사용자 로그인](#시나리오-2-일반-사용자-로그인)
3. [시나리오 3: 센터 전환](#시나리오-3-센터-전환)
4. [시나리오 4: 비밀번호 변경](#시나리오-4-비밀번호-변경)
5. [시나리오 5: 비밀번호 찾기 및 재설정](#시나리오-5-비밀번호-찾기-및-재설정)
6. [시나리오 6: 로그아웃](#시나리오-6-로그아웃)
7. [시나리오 7: Access Token 재발급](#시나리오-7-access-token-재발급)
8. [시나리오 8: Rate Limiting 발동](#시나리오-8-rate-limiting-발동)
9. [시나리오 9: 권한 및 역할 조회](#시나리오-9-권한-및-역할-조회)
10. [시나리오 10: 새 권한 추가 및 알림](#시나리오-10-새-권한-추가-및-알림-phase-2)
11. [시나리오 11: 플랜 업그레이드와 JWT 재발급](#시나리오-11-플랜-업그레이드와-jwt-재발급)
12. [시나리오 12: Pro 기능 접근 시 플랜 검증](#시나리오-12-pro-기능-접근-시-플랜-검증)
13. [시나리오 13: Quota 초과로 기능 차단](#시나리오-13-quota-초과로-기능-차단)
14. [시나리오 14: 권한 변경 후 JWT 불일치](#시나리오-14-권한-변경-후-jwt-불일치)
15. [시나리오 15: 센터 비활성화 시 접근 차단](#시나리오-15-센터-비활성화-시-접근-차단)
16. [시나리오 16: token_version으로 강제 로그아웃](#시나리오-16-token_version으로-강제-로그아웃)

---

## 시나리오 1: 센터 관리자 회원가입

### 설명
새로운 상담센터를 개설하며 센터 관리자 계정 생성

### 사전 조건
- 이메일이 시스템에 존재하지 않음
- 비밀번호가 정책을 충족함 (10자 이상, 대소문자, 숫자, 특수문자)

### HTTP 요청

```http
POST /auth/signup
Content-Type: application/json

{
  "email": "admin@seoul-counseling.com",
  "password": "SecurePass123!",
  "name": "김센터장",
  "phone": "010-1234-5678",
  "center_name": "서울심리상담센터",
  "center_code": "SEOUL001"
}
```

### HTTP 응답 (201 Created)

```json
{
  "account": {
    "id": 1,
    "email": "admin@seoul-counseling.com",
    "is_verified": false,
    "is_active": true,
    "created_at": "2026-01-13T10:00:00Z"
  },
  "person": {
    "id": 1,
    "name": "김센터장",
    "phone": "010-1234-5678"
  },
  "center": {
    "id": 1,
    "name": "서울심리상담센터",
    "code": "SEOUL001"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 1800
}
```

### 데이터베이스 변경

**persons 테이블**:
```sql
INSERT INTO persons (id, name, phone, created_at, updated_at)
VALUES (1, '김센터장', '010-1234-5678', NOW(), NOW());
```

**centers 테이블**:
```sql
INSERT INTO centers (id, name, code, is_active, created_at, updated_at)
VALUES (1, '서울심리상담센터', 'SEOUL001', true, NOW(), NOW());
```

**accounts 테이블**:
```sql
INSERT INTO accounts (
  id, person_id, email, password_hash,
  is_active, is_verified, provider, created_at, updated_at
)
VALUES (
  1, 1, 'admin@seoul-counseling.com', '$2b$12$...',
  true, false, 'email', NOW(), NOW()
);
```

**center_members 테이블**:
```sql
INSERT INTO center_members (person_id, center_id, role_id, is_active, created_at)
VALUES (1, 1, 2, true, NOW());  -- role_id=2 (센터 관리자)
```

**refresh_tokens 테이블**:
```sql
INSERT INTO refresh_tokens (
  account_id, token_hash, device_info, ip_address,
  expires_at, created_at
)
VALUES (
  1, 'hashed_token...', 'Mozilla/5.0...', '192.168.1.1',
  NOW() + INTERVAL '30 days', NOW()
);
```

### 비즈니스 규칙 적용

1. ✅ 이메일 중복 체크 (unique constraint)
2. ✅ 비밀번호 정책 검증 (10자, 복잡도)
3. ✅ Person 생성 (Account와 1:1 연결)
4. ✅ Center 생성 (새 센터)
5. ✅ CenterMember 생성 (센터 관리자 역할)
6. ✅ JWT 발급 (account_id, person_id 포함)
7. ✅ Refresh Token 생성 (30일 만료)

---

## 시나리오 2: 일반 사용자 로그인

### 설명
기존 계정으로 로그인하여 JWT 토큰 획득

### 사전 조건
- 계정이 존재하며 활성화 상태 (`is_active=true`)
- 센터가 활성화 상태 (`center.is_active=true`)
- Rate limiting 미초과 (5회 미만)

### HTTP 요청

```http
POST /auth/login
Content-Type: application/json

{
  "email": "counselor@seoul-counseling.com",
  "password": "SecurePass123!"
}
```

### HTTP 응답 (200 OK)

```json
{
  "account": {
    "id": 2,
    "email": "counselor@seoul-counseling.com",
    "is_verified": true,
    "created_at": "2026-01-10T09:00:00Z"
  },
  "person": {
    "id": 2,
    "name": "이상담사",
    "phone": "010-2345-6789"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 1800
}
```

### JWT Payload (Access Token)

```json
{
  "account_id": 2,
  "person_id": 2,
  "email": "counselor@seoul-counseling.com",
  "exp": 1705230600,
  "iat": 1705228800
}
```

**주의**: 로그인 직후에는 `center_id`, `role_id`, `permissions` 없음 (센터 전환 후 포함)

### 데이터베이스 변경

**accounts 테이블 업데이트**:
```sql
UPDATE accounts
SET last_login_at = NOW()
WHERE id = 2;
```

**refresh_tokens 테이블 삽입**:
```sql
INSERT INTO refresh_tokens (
  account_id, token_hash, device_info, ip_address,
  expires_at, created_at
)
VALUES (
  2, 'hashed_token...', 'Chrome/119.0...', '192.168.1.100',
  NOW() + INTERVAL '7 days', NOW()
);
```

**Redis (Rate Limiting)**:
```
# 로그인 성공 시 시도 횟수 삭제
DEL login_attempts:192.168.1.100
```

### 비즈니스 규칙 적용

1. ✅ 이메일로 계정 조회
2. ✅ 비밀번호 검증 (bcrypt.verify)
3. ✅ 계정 활성화 체크 (`is_active=true`)
4. ✅ 센터 활성화 체크 (`center.is_active=true`)
5. ✅ Rate limiting 체크 (Redis)
6. ✅ JWT 발급 (30분 만료)
7. ✅ Refresh Token 생성 (7일 만료)
8. ✅ last_login_at 업데이트
9. ✅ Rate limit 카운터 초기화

---

## 시나리오 3: 센터 전환

### 설명
여러 센터에 소속된 사용자가 다른 센터로 전환

### 사전 조건
- 로그인 완료 (Access Token 보유)
- 전환할 센터의 멤버십 존재
- 전환할 센터가 활성화 상태

### HTTP 요청 1: 접근 가능한 센터 목록 조회

```http
GET /auth/my-centers
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### HTTP 응답 1 (200 OK)

```json
{
  "centers": [
    {
      "id": 1,
      "name": "서울심리상담센터",
      "code": "SEOUL001",
      "role_name": "상담사",
      "is_current": false
    },
    {
      "id": 2,
      "name": "부산심리상담센터",
      "code": "BUSAN001",
      "role_name": "센터장",
      "is_current": false
    }
  ]
}
```

### HTTP 요청 2: 센터 전환

```http
POST /auth/switch-center
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "center_id": 2
}
```

### HTTP 응답 2 (200 OK)

```json
{
  "center": {
    "id": 2,
    "name": "부산심리상담센터",
    "role_name": "센터장",
    "permissions": [
      "client:read",
      "client:create",
      "client:update",
      "client:delete",
      "counseling:read",
      "counseling:create",
      "counseling:update",
      "counseling:delete",
      "assessment:manage",
      "schedule:manage",
      "billing:manage",
      "user:manage"
    ]
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 1800
}
```

### 새로운 JWT Payload (센터 전환 후)

```json
{
  "account_id": 2,
  "person_id": 2,
  "email": "counselor@seoul-counseling.com",
  "center_id": 2,
  "role_id": 1,
  "role_name": "센터장",
  "permissions": [
    "client:read",
    "client:create",
    "client:update",
    "client:delete",
    "counseling:read",
    "counseling:create",
    "counseling:update",
    "counseling:delete",
    "assessment:manage",
    "schedule:manage",
    "billing:manage",
    "user:manage"
  ],
  "exp": 1705232400,
  "iat": 1705230600
}
```

### 데이터베이스 조회

**center_members 조회**:
```sql
SELECT cm.*, r.name as role_name, r.id as role_id
FROM center_members cm
JOIN roles r ON cm.role_id = r.id
WHERE cm.person_id = 2 AND cm.center_id = 2 AND cm.is_active = true;
```

**role_permissions 조회**:
```sql
SELECT p.resource, p.action
FROM role_permissions rp
JOIN permissions p ON rp.permission_id = p.id
WHERE rp.role_id = 1;
```

### 비즈니스 규칙 적용

1. ✅ Person 존재 여부 체크 (시스템 관리자 제외)
2. ✅ 센터 존재 여부 체크
3. ✅ 센터 활성화 체크
4. ✅ 멤버십 존재 여부 체크
5. ✅ 멤버십 활성화 체크
6. ✅ 역할 및 권한 조회
7. ✅ 새 JWT 발급 (center_id, role, permissions 포함)

---

## 시나리오 4: 비밀번호 변경

### 설명
현재 비밀번호를 알고 있는 상태에서 새 비밀번호로 변경

### 사전 조건
- 로그인 완료 (Access Token 보유)
- 현재 비밀번호를 정확히 알고 있음
- 새 비밀번호가 정책 충족
- 최근 3개 비밀번호와 다름

### HTTP 요청

```http
POST /auth/change-password
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "current_password": "SecurePass123!",
  "new_password": "NewSecurePass456!"
}
```

### HTTP 응답 (200 OK)

```json
{
  "message": "Password changed successfully"
}
```

### 데이터베이스 변경

**accounts 테이블 업데이트**:
```sql
UPDATE accounts
SET
  password_hash = '$2b$12$new_hashed_password...',
  password_history = '["$2b$12$old_hash1", "$2b$12$old_hash2", "$2b$12$old_hash3"]',
  updated_at = NOW()
WHERE id = 2;
```

**비밀번호 히스토리 구조**:
```json
[
  "$2b$12$SecurePass123_hash",  // 이전 비밀번호
  "$2b$12$OldPassword456_hash",  // 2번째 이전
  "$2b$12$VeryOldPass789_hash"   // 3번째 이전
]
```

### 비즈니스 규칙 적용

1. ✅ 현재 비밀번호 검증 (bcrypt.verify)
2. ✅ 새 비밀번호 정책 검증 (10자, 복잡도)
3. ✅ 비밀번호 재사용 체크 (최근 3개)
4. ✅ 새 비밀번호 해싱 (bcrypt)
5. ✅ 히스토리 업데이트 (현재 비밀번호 추가, 최근 3개만 유지)
6. ✅ password_hash 업데이트

---

## 시나리오 5: 로그아웃

### 설명
현재 디바이스에서 로그아웃 (Refresh Token 무효화)

### 사전 조건
- 로그인 완료 (Access Token + Refresh Token 보유)

### HTTP 요청

```http
POST /auth/logout
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### HTTP 응답 (200 OK)

```json
{
  "message": "Logged out successfully"
}
```

### 데이터베이스 변경

**refresh_tokens 테이블 삭제**:
```sql
DELETE FROM refresh_tokens
WHERE token_hash = 'hashed_refresh_token...';
```

### 비즈니스 규칙 적용

1. ✅ Refresh Token 해시로 조회
2. ✅ 토큰 소유자 검증 (account_id 일치)
3. ✅ Refresh Token DB에서 삭제
4. ✅ Access Token은 그대로 유지 (만료 시까지 유효)

**주의**: Access Token은 Stateless이므로 즉시 무효화 불가. 만료 시간까지 유효하며, 중요 작업 시 추가 검증 필요.

---

## 시나리오 6: Access Token 재발급

### 설명
만료된 Access Token을 Refresh Token으로 재발급

### 사전 조건
- Access Token 만료 (exp < 현재 시간)
- Refresh Token 유효 (expires_at > 현재 시간)

### HTTP 요청

```http
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### HTTP 응답 (200 OK)

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 1800
}
```

### 새로운 JWT Payload

```json
{
  "account_id": 2,
  "person_id": 2,
  "email": "counselor@seoul-counseling.com",
  "center_id": 2,
  "role_id": 1,
  "role_name": "센터장",
  "permissions": [
    "client:read",
    "client:create",
    ...
  ],
  "exp": 1705234200,
  "iat": 1705232400
}
```

**주의**: 센터 전환 이후에 재발급한 경우 JWT에 센터 정보 포함

### 데이터베이스 조회

**refresh_tokens 조회**:
```sql
SELECT rt.*, a.id as account_id, a.person_id, a.email
FROM refresh_tokens rt
JOIN accounts a ON rt.account_id = a.id
WHERE rt.token_hash = 'hashed_refresh_token...'
  AND rt.expires_at > NOW();
```

**center_members 조회** (센터 정보 필요 시):
```sql
-- 마지막 사용한 센터 정보는 별도 저장 필요
-- 또는 기본 센터로 복원
```

### 비즈니스 규칙 적용

1. ✅ Refresh Token 해시로 조회
2. ✅ 토큰 만료 시간 체크
3. ✅ Account 활성화 체크
4. ✅ 새 Access Token 발급 (30분 만료)
5. ✅ 이전 센터 정보 포함 (있는 경우)

---

## 시나리오 7: Rate Limiting 발동

### 설명
동일 IP에서 로그인 5회 실패로 15분 차단

### 사전 조건
- 동일 IP에서 로그인 4회 실패
- 5번째 시도

### HTTP 요청 1-4: 로그인 실패 (4회)

```http
POST /auth/login
Content-Type: application/json

{
  "email": "counselor@seoul-counseling.com",
  "password": "WrongPassword"
}
```

#### HTTP 응답 1-4 (401 Unauthorized)

```json
{
  "detail": "Invalid email or password"
}
```

#### Redis 상태 (1-4회 실패 후)

```
login_attempts:192.168.1.100 = 4  (TTL: 900초)
```

### HTTP 요청 5: 5번째 시도

```http
POST /auth/login
Content-Type: application/json

{
  "email": "counselor@seoul-counseling.com",
  "password": "WrongPassword"
}
```

#### HTTP 응답 5 (429 Too Many Requests)

```json
{
  "detail": "Too many login attempts. Please try again in 15 minutes."
}
```

#### Redis 상태 (5회 실패 후)

```
login_attempts:192.168.1.100 = 5      (TTL: 900초)
login_lockout:192.168.1.100 = 1       (TTL: 900초)
```

### 15분 후 자동 해제

```
# TTL 만료로 자동 삭제
login_attempts:192.168.1.100 (deleted)
login_lockout:192.168.1.100 (deleted)
```

### 비즈니스 규칙 적용

1. ✅ 로그인 시도 전 Rate Limit 체크
2. ✅ 차단 상태 확인 (`login_lockout:{ip}`)
3. ✅ 차단 시 429 에러 반환
4. ✅ 로그인 실패 시 시도 횟수 증가
5. ✅ 5회 실패 시 차단 설정 (15분)
6. ✅ TTL로 자동 해제

---

## 시나리오 8: 권한 및 역할 조회

### 설명
센터 관리자가 멤버에게 권한 할당을 위해 시스템의 권한 및 역할 목록 조회 (Phase 1)

### 사전 조건
- 로그인 완료 (Access Token 보유)
- 센터 전환 완료 (center_id 포함)
- 센터 관리자 권한 보유

### 단계 1: 카테고리별 권한 목록 조회

#### HTTP 요청

```http
GET /auth/permissions/grouped
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### HTTP 응답 (200 OK)

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
        },
        {
          "id": 3,
          "code": "client:update",
          "name": "내담자 수정",
          "category": "client"
        },
        {
          "id": 4,
          "code": "client:delete",
          "name": "내담자 삭제",
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
        },
        {
          "id": 6,
          "code": "counseling:create",
          "name": "상담 생성",
          "category": "counseling"
        }
      ]
    },
    {
      "category": "assessment",
      "category_name": "검사 관리",
      "permissions": [
        {
          "id": 10,
          "code": "assessment:read",
          "name": "검사 조회",
          "category": "assessment"
        }
      ]
    }
  ]
}
```

### 단계 2: 역할 목록 조회 (프리셋 역할)

#### HTTP 요청

```http
GET /auth/roles
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### HTTP 응답 (200 OK)

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
        },
        {
          "id": 3,
          "code": "client:update",
          "name": "내담자 수정",
          "category": "client"
        },
        {
          "id": 4,
          "code": "client:delete",
          "name": "내담자 삭제",
          "category": "client"
        },
        {
          "id": 5,
          "code": "counseling:read",
          "name": "상담 조회",
          "category": "counseling"
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
        },
        {
          "id": 2,
          "code": "client:create",
          "name": "내담자 생성",
          "category": "client"
        },
        {
          "id": 5,
          "code": "counseling:read",
          "name": "상담 조회",
          "category": "counseling"
        },
        {
          "id": 6,
          "code": "counseling:create",
          "name": "상담 생성",
          "category": "counseling"
        }
      ],
      "created_at": "2026-01-01T00:00:00Z",
      "updated_at": "2026-01-01T00:00:00Z"
    },
    {
      "id": 3,
      "code": "receptionist",
      "name": "접수직원",
      "description": "고객 응대 및 일정 관리",
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
    }
  ],
  "total": 3
}
```

### 데이터베이스 조회

**permissions 테이블**:
```sql
SELECT * FROM permissions ORDER BY category, code;
```

**roles 테이블 + role_permissions JOIN**:
```sql
SELECT r.*, p.id as permission_id, p.code, p.name
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.id
ORDER BY r.id, p.category, p.code;
```

### 비즈니스 규칙 적용

1. ✅ 권한 목록 조회 (카테고리별 그룹핑)
2. ✅ 역할 목록 조회 (권한 포함)
3. ✅ Phase 1: 읽기 전용 (GET만 제공)
4. ✅ 센터 관리자가 멤버 초대 시 역할 선택 가능
5. ✅ 역할 선택 시 권한 목록 복사되어 멤버에게 할당 (Center 모듈)

---

## 시나리오 9: 새 권한 추가 및 알림 (Phase 2)

### 설명
시스템에 새 기능 추가 시 PLATFORM_ADMIN이 새 권한 생성, 센터에 알림 전달

### 사전 조건
- PLATFORM_ADMIN 계정 (system:admin 권한 보유)
- 새 기능 개발 완료 (예: 결제 내역 엑셀 내보내기)

### 단계 1: 새 권한 생성 (PLATFORM_ADMIN)

#### HTTP 요청

```http
POST /auth/permissions
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "code": "billing:export",
  "name": "결제 내역 내보내기",
  "description": "결제 내역을 엑셀 파일로 내보내기",
  "category": "billing",
  "is_new": true
}
```

#### HTTP 응답 (201 Created)

```json
{
  "id": 25,
  "code": "billing:export",
  "name": "결제 내역 내보내기",
  "description": "결제 내역을 엑셀 파일로 내보내기",
  "category": "billing",
  "is_new": true,
  "added_at": "2026-01-14T10:00:00Z",
  "created_at": "2026-01-14T10:00:00Z",
  "updated_at": "2026-01-14T10:00:00Z"
}
```

#### 데이터베이스 변경

**permissions 테이블 삽입**:
```sql
INSERT INTO permissions (
  code, name, description, category, is_new, added_at, created_at, updated_at
)
VALUES (
  'billing:export',
  '결제 내역 내보내기',
  '결제 내역을 엑셀 파일로 내보내기',
  'billing',
  true,
  NOW(),
  NOW(),
  NOW()
);
```

### 단계 2: 센터 관리자 로그인 및 알림 확인

#### HTTP 요청 1: 새 권한 조회

```http
GET /auth/permissions?is_new=true
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### HTTP 응답 1 (200 OK)

```json
{
  "items": [
    {
      "id": 25,
      "code": "billing:export",
      "name": "결제 내역 내보내기",
      "description": "결제 내역을 엑셀 파일로 내보내기",
      "category": "billing",
      "is_new": true,
      "added_at": "2026-01-14T10:00:00Z",
      "created_at": "2026-01-14T10:00:00Z",
      "updated_at": "2026-01-14T10:00:00Z"
    }
  ],
  "total": 1
}
```

**프론트엔드 동작**:
- 로그인 또는 센터 전환 시 자동으로 `is_new=true` 권한 조회
- 새 권한이 있으면 알림 배너 표시: "새로운 기능이 추가되었습니다. 멤버 권한 설정에서 확인하세요."

### 단계 3: 센터 관리자가 멤버에게 새 권한 부여 (Center 모듈)

**참고**: 이 단계는 Center 모듈에서 처리됨

#### HTTP 요청 2: 멤버 권한 업데이트

```http
PATCH /centers/{center_id}/members/{member_id}
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "permissions": [
    "client:read",
    "client:create",
    "counseling:read",
    "billing:read",
    "billing:export"  // 새 권한 추가
  ]
}
```

#### HTTP 응답 2 (200 OK)

```json
{
  "id": 5,
  "person_id": 10,
  "center_id": 1,
  "role_name": "센터 관리자",
  "permissions": [
    "client:read",
    "client:create",
    "counseling:read",
    "billing:read",
    "billing:export"
  ],
  "updated_at": "2026-01-14T11:00:00Z"
}
```

#### 데이터베이스 변경 (Center 모듈)

**center_members 테이블 업데이트**:
```sql
UPDATE center_members
SET
  permissions = '["client:read", "client:create", "counseling:read", "billing:read", "billing:export"]'::jsonb,
  updated_at = NOW()
WHERE id = 5;
```

### 단계 4: (선택적) is_new 플래그 해제

#### HTTP 요청 3

```http
PATCH /auth/permissions/25
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "is_new": false
}
```

#### HTTP 응답 3 (200 OK)

```json
{
  "id": 25,
  "code": "billing:export",
  "name": "결제 내역 내보내기",
  "description": "결제 내역을 엑셀 파일로 내보내기",
  "category": "billing",
  "is_new": false,
  "added_at": "2026-01-14T10:00:00Z",
  "created_at": "2026-01-14T10:00:00Z",
  "updated_at": "2026-01-14T11:30:00Z"
}
```

#### 데이터베이스 변경

**permissions 테이블 업데이트**:
```sql
UPDATE permissions
SET is_new = false, updated_at = NOW()
WHERE id = 25;
```

### 비즈니스 규칙 적용

**단계 1 (권한 생성)**:
1. ✅ PLATFORM_ADMIN 권한 체크
2. ✅ 권한 코드 중복 체크
3. ✅ 권한 생성 (is_new=true)

**단계 2 (알림 확인)**:
1. ✅ 새 권한 조회 (is_new=true 필터)
2. ✅ 프론트엔드 알림 표시

**단계 3 (권한 부여)**:
1. ✅ 센터 관리자가 멤버별로 선택적 부여
2. ✅ CenterMember.permissions JSON 업데이트

**단계 4 (플래그 해제)**:
1. ✅ is_new=false 업데이트 (선택적)

---

## 시나리오 10: 플랜 업그레이드와 JWT 재발급

### 설명
센터 관리자가 Free 플랜에서 Pro 플랜으로 업그레이드하면서 JWT에 `plan` 필드 추가

### 사전 조건
- 로그인 완료 (Access Token 보유)
- 센터 전환 완료 (center_id 포함)
- 현재 Free 플랜 구독 중

### HTTP 요청 1: 플랜 업그레이드 (Subscription 모듈)

```http
POST /subscription/upgrade
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "plan": "pro",
  "payment_method": "card"
}
```

### HTTP 응답 1 (200 OK)

```json
{
  "subscription": {
    "id": 1,
    "center_id": 1,
    "plan": "pro",
    "status": "active",
    "started_at": "2026-01-14T10:00:00Z",
    "expires_at": "2026-02-14T10:00:00Z"
  },
  "payment": {
    "id": 1,
    "amount": 99000,
    "status": "completed",
    "paid_at": "2026-01-14T10:00:00Z"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 1800
}
```

### JWT Payload 변화

**업그레이드 전 (Free 플랜)**:
```json
{
  "account_id": 1,
  "center_id": 1,
  "role_id": 2,
  "permissions": ["client:read", "client:create"],
  "token_version": 1,
  "exp": 1705230600,
  "iat": 1705228800
}
```

**업그레이드 후 (Pro 플랜)**:
```json
{
  "account_id": 1,
  "center_id": 1,
  "plan": "pro",
  "role_id": 2,
  "permissions": ["client:read", "client:create"],
  "token_version": 1,
  "exp": 1705232400,
  "iat": 1705230600
}
```

### 데이터베이스 변경 (Subscription 모듈)

**subscriptions 테이블 업데이트**:
```sql
UPDATE subscriptions
SET
  plan = 'pro',
  status = 'active',
  expires_at = NOW() + INTERVAL '30 days',
  updated_at = NOW()
WHERE center_id = 1;
```

**subscription_payments 테이블 삽입**:
```sql
INSERT INTO subscription_payments (
  subscription_id, amount, plan, payment_method, status, paid_at, created_at
)
VALUES (
  1, 99000, 'pro', 'card', 'completed', NOW(), NOW()
);
```

### 비즈니스 규칙 적용

1. ✅ 현재 구독 조회 (Free 플랜 확인)
2. ✅ 플랜 업그레이드 (Subscription 모듈)
3. ✅ 결제 처리 (Subscription 모듈)
4. ✅ **JWT 재발급** (Auth 모듈 - `create_access_token_for_center()`)
5. ✅ JWT에 `plan` 필드 추가
6. ✅ 클라이언트에 새 JWT 반환

**주의**: Subscription 모듈은 Auth 모듈의 `create_access_token_for_center()` 함수를 호출하여 JWT 재발급

---

## 시나리오 11: Pro 기능 접근 시 플랜 검증

### 설명
Free 플랜 사용자가 Pro 전용 AI 보고서 기능 접근 시도 → @require_plan 데코레이터가 차단

### 사전 조건
- 로그인 완료 (Access Token 보유)
- 센터 전환 완료 (center_id 포함)
- Free 플랜 (JWT에 `plan` 필드 없음 또는 `plan="free"`)

### HTTP 요청: AI 보고서 생성 시도

```http
POST /assessment/ai-report
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "assessment_id": 10,
  "report_type": "comprehensive"
}
```

### JWT Payload (Free 플랜)

```json
{
  "account_id": 1,
  "center_id": 1,
  "role_id": 2,
  "permissions": ["client:read", "assessment:read"],
  "token_version": 1,
  "exp": 1705230600,
  "iat": 1705228800
}
```

**주의**: `plan` 필드 없음 (Free 플랜은 기본값)

### HTTP 응답 (402 Payment Required)

```json
{
  "detail": {
    "message": "This feature requires a higher plan",
    "current_plan": "free",
    "required_plans": ["pro", "enterprise"],
    "upgrade_url": "/subscription/upgrade"
  }
}
```

### 백엔드 검증 로직

**API Handler**:
```python
from app.core.security import require_plan

@router.post("/ai-report")
@require_plan(["pro", "enterprise"])
async def generate_ai_report(
    data: AIReportRequest,
    auth: AuthContext = Depends(get_current_auth),
):
    """AI 보고서 생성 (Pro 플랜 이상)"""
    # @require_plan 데코레이터가 먼저 검증
    # 통과 시 비즈니스 로직 실행
    ...
```

**@require_plan 데코레이터** (app/core/security.py):
```python
def require_plan(allowed_plans: list[str]):
    """Plan-Based Access Control"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            auth: AuthContext = kwargs.get("auth")

            # JWT에서 plan 추출 (없으면 "free")
            current_plan = auth.plan or "free"

            # 플랜 검증
            if current_plan not in allowed_plans:
                raise HTTPException(
                    status_code=402,
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

### 비즈니스 규칙 적용

1. ✅ JWT에서 `plan` 필드 추출 (없으면 `"free"`)
2. ✅ 필요한 플랜 확인 (`["pro", "enterprise"]`)
3. ✅ 플랜 불일치 → 402 에러 반환
4. ✅ 업그레이드 URL 제공

---

## 시나리오 12: Quota 초과로 기능 차단

### 설명
Starter 플랜 사용자가 내담자 50명 제한에 도달하여 추가 생성 차단

### 사전 조건
- 로그인 완료 (Access Token 보유)
- 센터 전환 완료 (center_id 포함)
- Starter 플랜 (JWT에 `plan="starter"`)
- 현재 내담자 수: 50명

### HTTP 요청: 내담자 생성 시도

```http
POST /clients
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "name": "김신규",
  "contact_phone": "010-1234-5678"
}
```

### JWT Payload (Starter 플랜)

```json
{
  "account_id": 1,
  "center_id": 1,
  "plan": "starter",
  "role_id": 2,
  "permissions": ["client:read", "client:create"],
  "token_version": 1,
  "exp": 1705230600,
  "iat": 1705228800
}
```

### HTTP 응답 (402 Payment Required)

```json
{
  "detail": "Client limit reached (50/50). Upgrade to Pro for unlimited clients."
}
```

### 백엔드 검증 로직

**Client Handler** (app/modules/client/handlers/create_client.py):
```python
from app.core.subscription import get_plan_limit

async def create_client_handler(
    data: ClientCreate,
    auth: AuthContext = Depends(get_current_auth),
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        client_repo = uow.repo(ClientRepository)

        # 1. 현재 내담자 수 확인
        current_count = await client_repo.count_by_center(auth.center_id)

        # 2. 플랜 제한 조회
        limit = get_plan_limit(auth.plan, "clients")
        # Starter: 50, Pro: None (무제한)

        # 3. Quota 검증
        if limit and current_count >= limit:
            raise HTTPException(
                status_code=402,
                detail=f"Client limit reached ({current_count}/{limit}). "
                       f"Upgrade to Pro for unlimited clients."
            )

        # 4. 내담자 생성
        client = await client_repo.create(data.model_dump())
        await uow.commit()
        return ClientResponse.model_validate(client)
```

**플랜별 Quota 정의** (app/core/subscription.py):
```python
PLAN_LIMITS = {
    "free": {"clients": 10, "therapists": 1},
    "starter": {"clients": 50, "therapists": 3},
    "pro": {"clients": None, "therapists": None},  # 무제한
    "enterprise": {"clients": None, "therapists": None}
}

def get_plan_limit(plan: str, resource: str) -> int | None:
    """플랜별 리소스 제한 조회 (None = 무제한)"""
    return PLAN_LIMITS.get(plan, {}).get(resource)
```

### 비즈니스 규칙 적용

1. ✅ JWT에서 `plan` 추출
2. ✅ 플랜별 Quota 조회 (Starter: 50명)
3. ✅ 현재 내담자 수 확인 (50명)
4. ✅ Quota 초과 → 402 에러 반환
5. ✅ 업그레이드 안내 메시지 제공

---

## 시나리오 13: 권한 변경 후 JWT 불일치

### 설명
센터 관리자가 멤버 권한 변경 → 해당 멤버의 JWT와 DB 권한 불일치 → API 호출 시 재검증

### 사전 조건
- 상담사가 로그인 완료 (Access Token 보유)
- 센터 관리자가 해당 상담사의 권한 변경

### 단계 1: 상담사 로그인 (권한 변경 전)

#### JWT Payload
```json
{
  "account_id": 2,
  "center_id": 1,
  "plan": "pro",
  "role_id": 3,
  "permissions": [
    "client:read",
    "client:create",
    "counseling:read",
    "counseling:create"
  ],
  "token_version": 1,
  "exp": 1705230600,
  "iat": 1705228800
}
```

### 단계 2: 센터 관리자가 권한 변경

#### HTTP 요청 (Center 모듈)

```http
PATCH /centers/1/members/5
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "permissions": [
    "client:read",
    "counseling:read"
  ]
}
```

**변경 내용**: `client:create`, `counseling:create` 권한 제거

#### 데이터베이스 변경

**center_members 테이블 업데이트**:
```sql
UPDATE center_members
SET
  permissions = '["client:read", "counseling:read"]'::jsonb,
  updated_at = NOW()
WHERE id = 5;
```

### 단계 3: 상담사가 상담 생성 시도 (권한 없음)

#### HTTP 요청

```http
POST /counseling/sessions
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "client_id": 10,
  "scheduled_at": "2026-01-15T14:00:00Z"
}
```

**주의**: JWT에는 아직 `counseling:create` 권한 포함

#### 백엔드 검증 로직

**@require_permission 데코레이터** (app/core/security.py):
```python
from app.repositories.center_member import CenterMemberRepository

def require_permission(required_permission: str):
    """Permission-Based Access Control with DB recheck"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            auth: AuthContext = kwargs.get("auth")

            # 1. JWT 검증 (1차)
            if required_permission not in auth.permissions:
                raise HTTPException(status_code=403, detail="Insufficient permissions")

            # 2. DB 재검증 (2차) - 중요 작업 시
            session = kwargs.get("session")
            member_repo = CenterMemberRepository(session)
            member = await member_repo.get_by_person_and_center(
                auth.person_id, auth.center_id
            )

            if required_permission not in member.permissions:
                # JWT와 DB 불일치 감지
                raise HTTPException(
                    status_code=401,
                    detail={
                        "message": "Your permissions have been changed. Please log in again.",
                        "reauth_required": True
                    }
                )

            return await func(*args, **kwargs)
        return wrapper
    return decorator
```

#### HTTP 응답 (401 Unauthorized)

```json
{
  "detail": {
    "message": "Your permissions have been changed. Please log in again.",
    "reauth_required": true
  }
}
```

### 단계 4: 프론트엔드 처리

**클라이언트 동작**:
1. 401 에러 + `reauth_required: true` 수신
2. 사용자에게 알림: "권한이 변경되었습니다. 다시 로그인해주세요."
3. Refresh Token으로 새 Access Token 재발급
4. 또는 로그아웃 후 재로그인 유도

### 비즈니스 규칙 적용

1. ✅ JWT 권한 1차 검증
2. ✅ DB 권한 2차 검증 (중요 작업 시)
3. ✅ 불일치 감지 → 401 에러 + 재인증 요구
4. ✅ 프론트엔드에서 JWT 재발급 또는 재로그인

---

## 시나리오 14: 센터 비활성화 시 접근 차단

### 설명
센터가 비활성화되면 해당 센터 멤버의 API 접근 차단

### 사전 조건
- 상담사가 로그인 완료 (Access Token 보유)
- 센터 전환 완료 (center_id=1)
- 센터가 활성화 상태

### 단계 1: 상담사의 JWT

```json
{
  "account_id": 2,
  "center_id": 1,
  "plan": "pro",
  "role_id": 3,
  "permissions": ["client:read", "counseling:read"],
  "token_version": 1,
  "exp": 1705230600,
  "iat": 1705228800
}
```

### 단계 2: PLATFORM_ADMIN이 센터 비활성화

#### HTTP 요청 (Center 모듈)

```http
PATCH /admin/centers/1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "is_active": false,
  "deactivation_reason": "Payment failure for 30 days"
}
```

#### 데이터베이스 변경

**centers 테이블 업데이트**:
```sql
UPDATE centers
SET
  is_active = false,
  deactivation_reason = 'Payment failure for 30 days',
  deactivated_at = NOW(),
  updated_at = NOW()
WHERE id = 1;
```

### 단계 3: 상담사가 API 호출 시도

#### HTTP 요청

```http
GET /clients?center_id=1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 백엔드 검증 로직

**Auth Middleware** (app/core/dependencies.py):
```python
from app.repositories.center import CenterRepository

async def get_current_auth(
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_session),
) -> AuthContext:
    """JWT 검증 및 센터 상태 확인"""

    # 1. JWT 검증
    payload = decode_access_token(token)

    # 2. 센터 상태 확인 (center_id가 있는 경우)
    if payload.get("center_id"):
        center_repo = CenterRepository(session)
        center = await center_repo.get(payload["center_id"])

        if not center or not center.is_active:
            raise HTTPException(
                status_code=403,
                detail={
                    "message": "This center has been deactivated. Please contact support.",
                    "center_id": payload["center_id"],
                    "deactivated_at": center.deactivated_at.isoformat() if center else None
                }
            )

    return AuthContext(**payload)
```

#### HTTP 응답 (403 Forbidden)

```json
{
  "detail": {
    "message": "This center has been deactivated. Please contact support.",
    "center_id": 1,
    "deactivated_at": "2026-01-14T10:00:00Z"
  }
}
```

### 비즈니스 규칙 적용

1. ✅ JWT 검증 (기본)
2. ✅ 센터 상태 확인 (`is_active=false`)
3. ✅ 비활성화 센터 → 403 에러 반환
4. ✅ 비활성화 시각 정보 제공

---

## 시나리오 15: token_version으로 강제 로그아웃

### 설명
보안 위협 감지 시 PLATFORM_ADMIN이 특정 계정의 모든 세션 강제 무효화

### 사전 조건
- 사용자가 로그인 완료 (Access Token 보유)
- 보안 위협 감지 (예: 계정 탈취 의심)

### 단계 1: 사용자의 현재 JWT

```json
{
  "account_id": 5,
  "center_id": 2,
  "plan": "pro",
  "role_id": 3,
  "permissions": ["client:read", "counseling:read"],
  "token_version": 2,
  "exp": 1705230600,
  "iat": 1705228800
}
```

### 단계 2: PLATFORM_ADMIN이 강제 로그아웃 실행

#### HTTP 요청 (Admin API)

```http
POST /admin/accounts/5/force-logout
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "reason": "Suspicious login activity detected"
}
```

#### HTTP 응답 (200 OK)

```json
{
  "account_id": 5,
  "token_version": 3,
  "previous_version": 2,
  "invalidated_at": "2026-01-14T10:30:00Z",
  "reason": "Suspicious login activity detected"
}
```

#### 데이터베이스 변경

**accounts 테이블 업데이트**:
```sql
UPDATE accounts
SET
  token_version = token_version + 1,  -- 2 → 3
  updated_at = NOW()
WHERE id = 5;
```

**refresh_tokens 테이블 삭제**:
```sql
DELETE FROM refresh_tokens
WHERE account_id = 5;
```

### 단계 3: 사용자가 API 호출 시도

#### HTTP 요청

```http
GET /clients
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**주의**: JWT의 `token_version=2` (DB는 3으로 업데이트됨)

#### 백엔드 검증 로직

**Auth Middleware** (app/core/dependencies.py):
```python
async def get_current_auth(
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_session),
) -> AuthContext:
    """JWT 검증 및 token_version 확인"""

    # 1. JWT 검증 (서명, 만료 시간)
    payload = decode_access_token(token)

    # 2. token_version 검증 (중요 작업 시)
    account_repo = AccountRepository(session)
    account = await account_repo.get(payload["account_id"])

    if account.token_version != payload.get("token_version"):
        raise HTTPException(
            status_code=401,
            detail={
                "message": "Your session has been invalidated. Please log in again.",
                "force_logout": True
            }
        )

    return AuthContext(**payload)
```

#### HTTP 응답 (401 Unauthorized)

```json
{
  "detail": {
    "message": "Your session has been invalidated. Please log in again.",
    "force_logout": true
  }
}
```

### 단계 4: 프론트엔드 처리

**클라이언트 동작**:
1. 401 에러 + `force_logout: true` 수신
2. Access Token, Refresh Token 모두 삭제
3. 로그인 페이지로 리다이렉트
4. 알림 표시: "보안상의 이유로 로그아웃되었습니다."

### 비즈니스 규칙 적용

1. ✅ `token_version` 증가 (DB)
2. ✅ 모든 Refresh Token 삭제
3. ✅ JWT 검증 시 `token_version` 불일치 감지
4. ✅ 401 에러 + 강제 로그아웃 플래그
5. ✅ 모든 디바이스에서 즉시 세션 무효화

**장점**:
- Stateless JWT로도 강제 로그아웃 가능
- 중요 작업 시에만 DB 조회 (성능 최적화)
- 보안 위협 대응 시 즉시 무효화

---

## 시나리오 요약

| # | 시나리오 | 주요 API | 결과 |
|---|---------|---------|------|
| 1 | 센터 관리자 회원가입 | POST /auth/signup | Account + Person + Center + JWT 생성 |
| 2 | 일반 사용자 로그인 | POST /auth/login | JWT + Refresh Token 발급 |
| 3 | 센터 전환 | GET /auth/my-centers<br>POST /auth/switch-center | 새 JWT (센터 정보 포함) |
| 4 | 비밀번호 변경 | POST /auth/change-password | password_hash + history 업데이트 |
| 5 | 비밀번호 찾기/재설정 | POST /auth/forgot-password<br>POST /auth/reset-password | 이메일 발송 + 비밀번호 업데이트 |
| 6 | 로그아웃 | POST /auth/logout | Refresh Token 삭제 |
| 7 | Access Token 재발급 | POST /auth/refresh | 새 Access Token 발급 |
| 8 | Rate Limiting 발동 | POST /auth/login (5회 실패) | 15분 차단 |
| 9 | 권한 및 역할 조회 | GET /auth/permissions/grouped<br>GET /auth/roles | 카테고리별 권한 + 역할 목록 |
| 10 | 새 권한 추가 및 알림 | POST /auth/permissions<br>GET /auth/permissions?is_new=true | 새 권한 생성 + 센터 알림 |
| 11 | 플랜 업그레이드와 JWT 재발급 | POST /subscription/upgrade | plan 필드 추가된 새 JWT |
| 12 | Pro 기능 접근 시 플랜 검증 | POST /assessment/ai-report | @require_plan 검증 → 402 에러 |
| 13 | Quota 초과로 기능 차단 | POST /clients | Quota 검증 → 402 에러 |
| 14 | 권한 변경 후 JWT 불일치 | POST /counseling/sessions | DB 재검증 → 401 에러 + 재인증 |
| 15 | 센터 비활성화 시 접근 차단 | GET /clients | 센터 상태 검증 → 403 에러 |
| 16 | token_version으로 강제 로그아웃 | POST /admin/accounts/5/force-logout | token_version 불일치 → 401 에러 |

---

## 참고 문서

- **메인 도메인**: `/docs/auth/domain.md`
- **의사결정 기록**: `/docs/auth/decision-log.md`
- **엣지 케이스**: `/docs/auth/edge-cases.md`
- **Subscription 도메인**: `/docs/subscription/domain.md`
- **Subscription 시나리오**: `/docs/subscription/scenarios.md`
- **프로젝트 설정**: `/CLAUDE.md`
