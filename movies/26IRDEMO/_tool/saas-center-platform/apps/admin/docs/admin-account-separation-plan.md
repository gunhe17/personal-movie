# Admin Account 분리 계획서

## 1. 배경 및 목적

### 현재 문제점

- 플랫폼 어드민과 일반 센터 사용자가 동일한 `account` 테이블 사용
- 어드민 역할 구분 필드 없음 → 아무 계정이나 어드민 로그인 가능
- JWT에 역할 정보 없음 → 권한 검증 불가
- 2FA 코드 하드코딩 ("123456")
- 센터 인증 취약점이 어드민까지 영향 (공격 표면 공유)

### 목표

- 어드민 전용 `admin_account` 테이블 + 도메인 모듈 신설
- 역할 기반 접근 제어 (RBAC): `super_admin`, `admin`, `customer_service`
- 어드민 인증 흐름을 센터 인증과 완전 분리
- 향후 어드민별 권한 세분화 기반 마련

---

## 2. 역할 정의

| 역할        | 코드명             | 설명               | 주요 권한                    |
| ----------- | ------------------ | ------------------ | ---------------------------- |
| 슈퍼 관리자 | `super_admin`      | 플랫폼 최고 관리자 | 모든 기능 + 어드민 계정 관리 |
| 관리자      | `admin`            | 일반 플랫폼 관리자 | 센터 관리, 통계, 모니터링    |
| CS 담당자   | `customer_service` | 고객 지원 담당     | 센터/사용자 조회, 문의 처리  |

---

## 3. 신규 모델: `AdminAccount`

### 위치

```
apps/api/app/modules/platform_admin/admin_account/
├── models.py           # AdminAccount, AdminRefreshToken 엔티티
├── schemas.py          # Pydantic DTO + 비밀번호 정책 검증
├── repository.py       # AdminAccountRepository, AdminRefreshTokenRepository
└── services/
    ├── login_admin.py                  # 로그인 (실패카운트+잠금)
    ├── create_admin_refresh_token.py   # RefreshToken 생성
    ├── validate_admin_refresh_token.py # RefreshToken 검증
    ├── create_admin.py                 # [Phase 3] 계정 생성
    ├── update_admin.py                 # [Phase 3] 계정 수정
    └── delete_admin.py                 # [Phase 3] 계정 삭제
```

### 테이블 스키마 (admin_accounts)

| 컬럼               | 타입                 | 설명                                          |
| ------------------ | -------------------- | --------------------------------------------- |
| id                 | UUID (PK)            | 고유 식별자                                   |
| email              | VARCHAR(255), UNIQUE | 로그인 이메일                                 |
| password           | VARCHAR(255)         | bcrypt 해시                                   |
| name               | VARCHAR(100)         | 이름                                          |
| role               | VARCHAR(30)          | `super_admin`, `admin`, `customer_service`    |
| is_active          | BOOLEAN              | 활성 상태 (기본: true)                        |
| token_version      | INTEGER              | 토큰 무효화용 버전 (기본: 0)                  |
| failed_login_count | INTEGER              | 연속 로그인 실패 횟수 (기본: 0, 성공 시 리셋) |
| locked_until       | TIMESTAMP            | 계정 잠금 해제 시각 (null이면 잠금 아님)      |
| last_login_at      | TIMESTAMP            | 마지막 로그인                                 |
| created_at         | TIMESTAMP            | 생성일                                        |
| updated_at         | TIMESTAMP            | 수정일                                        |
| deleted_at         | TIMESTAMP            | 소프트 삭제                                   |

### 테이블 스키마 (admin_login_histories)

| 컬럼             | 타입         | 설명                                                  |
| ---------------- | ------------ | ----------------------------------------------------- |
| id               | UUID (PK)    | 고유 식별자                                           |
| admin_account_id | UUID (FK)    | 어드민 계정 참조                                      |
| ip_address       | VARCHAR(45)  | 접속 IP (IPv6 포함)                                   |
| user_agent       | TEXT         | 브라우저/OS 정보 (원본)                               |
| device_type      | VARCHAR(20)  | `desktop`, `mobile`, `tablet` (파싱)                  |
| browser          | VARCHAR(50)  | 브라우저명 (파싱: Chrome, Safari 등)                  |
| os               | VARCHAR(50)  | OS명 (파싱: Windows, macOS 등)                        |
| login_status     | VARCHAR(20)  | `success`, `failed_password`, `failed_2fa`, `blocked` |
| failure_reason   | VARCHAR(100) | 실패 사유 (실패 시만)                                 |
| created_at       | TIMESTAMP    | 로그인 시도 시각                                      |

### 테이블 스키마 (admin_refresh_tokens)

> 어드민 전용 RefreshToken. 기존 refresh_tokens 테이블과 완전 분리.

| 컬럼             | 타입                 | 설명                                    |
| ---------------- | -------------------- | --------------------------------------- |
| id               | UUID (PK)            | 고유 식별자                             |
| admin_account_id | VARCHAR(36)          | 어드민 계정 참조                        |
| token_hash       | VARCHAR(255), UNIQUE | 토큰 해시 (SHA-256, 원본 저장 안함)     |
| device_info      | VARCHAR(500)         | User-Agent                              |
| ip_address       | VARCHAR(45)          | 발급 시 IP                              |
| expires_at       | TIMESTAMP            | 만료 시각                               |
| used_at          | TIMESTAMP            | 토큰 사용 시각 (일회용 검증)            |
| parent_token_id  | VARCHAR(36)          | 이전 토큰 ID (토큰 패밀리 추적)        |
| created_at       | TIMESTAMP            | 발급 시각                               |
| updated_at       | TIMESTAMP            | 수정 시각                               |
| deleted_at       | TIMESTAMP            | 소프트 삭제                             |

### 테이블 스키마 (admin_sessions)

> 현재 활성 세션(접속 기기) 관리용. RefreshToken 발급 시 생성, 로그아웃/만료 시 삭제.

| 컬럼                    | 타입        | 설명                                 |
| ----------------------- | ----------- | ------------------------------------ |
| id                      | UUID (PK)   | 고유 식별자                          |
| admin_account_id        | UUID (FK)   | 어드민 계정 참조                     |
| admin_refresh_token_id  | UUID (FK)   | 연결된 AdminRefreshToken ID          |
| ip_address              | VARCHAR(45) | 접속 IP                              |
| device_type             | VARCHAR(20) | `desktop`, `mobile`, `tablet`        |
| browser                 | VARCHAR(50) | 브라우저명                           |
| os                      | VARCHAR(50) | OS명                                 |
| last_active_at          | TIMESTAMP   | 마지막 활동 시각 (토큰 갱신 시 갱신) |
| created_at              | TIMESTAMP   | 세션 생성 시각                       |

### 기존 Account 테이블과의 차이

- `provider`, `provider_id` 제거 → 어드민은 이메일 로그인만
- `is_verified` 제거 → 어드민은 super_admin이 직접 생성
- `lock_pin` 제거 → 어드민에 불필요
- `name` 추가 → Person 테이블 의존 제거 (어드민은 Person 불필요)
- `role` 추가 → 역할 기반 접근 제어

---

## 4. 인증 흐름 변경

### 현재 흐름 (변경 전)

```
POST /admin/auth/login
  → LoginService (account 테이블 조회, 어드민 검증 없음)
  → pending_token 발급

POST /admin/auth/verify-2fa
  → 하드코딩 "123456" 검증
  → access_token + refresh_token 발급
```

### 변경 후 흐름

```
POST /admin/auth/login
  → AdminLoginService (admin_accounts 테이블 조회)
  → is_active + locked_until 검증
  → 실패 시 failed_login_count 증가 (5회→30분잠금, 10회→비활성화)
  → Rate Limiting (IP: 5회/분, Email: 10회/분)
  → pending_token 발급 (role, token_type: "admin" 포함)

POST /admin/auth/verify-2fa
  → pending_token 검증 (token_type: "admin" 확인)
  → 2FA 코드 검증 (TODO: 이메일/SMS 연동)
  → access_token 발급 (role 포함) + admin_refresh_tokens에 refresh_token 발급

POST /admin/auth/refresh
  → admin_refresh_tokens에서 해시 검증
  → 새 access_token 발급 (refresh_token은 유지)
```

### JWT 페이로드 변경

**현재:**

```json
{
  "account_id": "uuid",
  "person_id": "uuid",
  "email": "admin@example.com",
  "type": "admin_2fa_pending"
}
```

**변경 후:**

```json
{
  "admin_account_id": "uuid",
  "email": "admin@example.com",
  "role": "super_admin",
  "type": "admin_2fa_pending",
  "token_type": "admin",
  "account_token_version": 0
}
```

- `account_id` → `admin_account_id` (센터 토큰과 구분)
- `person_id` 제거 (어드민은 Person 불필요)
- `role` 추가
- `token_type: "admin"` 추가 (토큰 혼용 방지)
- `account_token_version` 추가 (토큰 무효화 지원)

---

## 5. 구현 단계

### Phase 1: Backend - 모델 및 마이그레이션 ✅ 완료

1. ✅ `AdminAccount` 모델 생성 (`platform_admin/admin_account/models.py`)
2. ✅ `AdminAccountRepository` 생성 (`get_by_email`, `get_by_token_hash`, `get_active_by_account`, `revoke_all_by_account`)
3. ✅ `AdminRole` 정의 (`super_admin`, `admin`, `customer_service`)
4. ✅ Alembic 마이그레이션: `admin_accounts` + `admin_refresh_tokens` 테이블 생성
5. ✅ 시드 스크립트: 초기 super_admin 계정 생성 (`scripts/seed_admin_account.py`)

### Phase 2: Backend - 인증 서비스 분리 ✅ 완료

1. ✅ `AdminLoginService` 생성 (admin_accounts 테이블 전용)
   - 로그인 실패 시: `failed_login_count += 1`
   - 5회 연속 실패: `locked_until = now + 30분` (자동 잠금)
   - 10회 연속 실패: `is_active = false` (super_admin 해제 필요)
   - 로그인 성공 시: `failed_login_count = 0`, `locked_until = null` 리셋
   - 로그인 시도 시: `locked_until` 확인 → 잠금 중이면 거부
2. ✅ `admin_login_handler` 수정 → AdminLoginService 사용 + Rate Limiting (IP 5회/분, Email 10회/분)
3. ✅ `admin_verify_2fa_handler` 수정 → admin_account_id 기반
4. ✅ JWT 페이로드에 `role`, `token_type: "admin"` 추가
5. ✅ `AdminRefreshToken` 별도 테이블 생성 (기존 refresh_tokens와 완전 분리)
   - `CreateAdminRefreshTokenService` (5디바이스 제한, 7일 만료)
   - `ValidateAdminRefreshTokenService` (해시 검증, used_at/expires_at 확인)
6. ✅ `get_current_admin` 의존성 함수 생성 (`platform_admin/auth/dependencies.py`)
7. ✅ `require_admin_role("super_admin")` 역할 가드 의존성
8. ✅ `admin_refresh_handler` 생성 (`POST /admin/auth/refresh`)
9. ✅ 비밀번호 정책 검증 함수 (`validate_admin_password` — 12자+대소문자+특수문자+연속숫자 불가)

### Phase 3: Backend - 어드민 계정 관리 API ⬜ 미구현

1. CRUD 엔드포인트 (super_admin만 접근)
   - `POST /admin/accounts` - 어드민 계정 생성
   - `GET /admin/accounts` - 목록 조회
   - `GET /admin/accounts/{id}` - 상세 조회
   - `PATCH /admin/accounts/{id}` - 수정 (역할 변경 등)
   - `DELETE /admin/accounts/{id}` - 비활성화/삭제
2. 비밀번호 변경/초기화 엔드포인트
3. 내 정보 조회/수정 (`GET /admin/me`, `PATCH /admin/me`)

> **필요 파일**: `services/create_admin.py`, `services/update_admin.py`, `services/delete_admin.py`, `handlers/`, `router.py`

### Phase 3.5: Backend - 로그인 기록 및 접속 기기 관리 ⬜ 미구현

1. `AdminLoginHistory` 모델 생성
2. `AdminSession` 모델 생성
3. 로그인 시도 시 기록 저장 (성공/실패 모두)
   - User-Agent 파싱 → device_type, browser, os 추출
4. 로그인 성공 시 세션 생성 (RefreshToken 발급과 연동)
5. 토큰 갱신 시 `last_active_at` 업데이트
6. 로그아웃 시 세션 삭제
7. API 엔드포인트:
   - `GET /admin/me/sessions` - 내 활성 세션(접속 기기) 목록
   - `DELETE /admin/me/sessions/{id}` - 특정 기기 강제 로그아웃
   - `GET /admin/me/login-history` - 내 로그인 기록 (페이지네이션)
   - `GET /admin/accounts/{id}/login-history` - 특정 어드민 로그인 기록 (super_admin)

### Phase 4: Frontend - 인증 흐름 수정 ✅ 완료

1. ✅ `AdminUser` 타입 — 이미 `role: string`으로 선언되어 있음
2. ✅ `extractUserFromToken()` 수정 → `admin_account_id` 추출 + `token_type: "admin"` 검증 (비admin 토큰 거부)
3. ✅ `hooks.server.ts` — `extractUserFromToken` 내부에서 token_type 검증 처리 (추가 수정 불필요)
4. ✅ `verify-2fa/+server.ts` — `AdminTokenResponse` 파싱 (`admin_account` 구조체로 변경)
5. ✅ `login/+server.ts` — 응답 인터페이스에 `role` 필드 추가
6. ✅ `refreshAccessToken` URL 수정 → `/admin/auth/refresh` + 불필요한 Authorization 헤더 제거
7. 로그인 페이지 변경 없음 (흐름 동일, 백엔드만 분리)
8. 역할별 메뉴/UI 분기 (Phase 5에서 구체화)

### Phase 5: Frontend - 역할 기반 UI ⬜ 미구현

1. 역할별 사이드바 메뉴 표시/숨김
2. 역할별 라우트 가드 (`super_admin` 전용 페이지 등)
3. 어드민 계정 관리 페이지 (super_admin 전용)

### Phase 6: Frontend - 접속 기기 및 로그인 기록 UI ⬜ 미구현

1. 내 접속 기기 목록 페이지 (`/settings/sessions`)
   - 현재 기기 표시 (기기타입 아이콘 + 브라우저/OS + IP + 마지막 활동)
   - 다른 기기 강제 로그아웃 버튼
2. 내 로그인 기록 페이지 (`/settings/login-history`)
   - 로그인 시도 목록 (성공/실패 상태, IP, 기기정보, 시각)
   - 실패 시도 하이라이트 (비정상 접근 감지 용이)
3. super_admin: 특정 어드민의 로그인 기록 조회 기능

---

## 6. 파일 변경 목록

### 구현 완료 파일

**Backend (신규 생성)**

```
apps/api/app/modules/platform_admin/admin_account/
├── __init__.py
├── models.py                               # AdminAccount, AdminRefreshToken 엔티티
├── schemas.py                              # DTO + validate_admin_password
├── repository.py                           # AdminAccountRepository, AdminRefreshTokenRepository
└── services/
    ├── __init__.py
    ├── login_admin.py                      # 로그인 (실패카운트+잠금 로직)
    ├── create_admin_refresh_token.py       # RefreshToken 생성 (5디바이스 제한)
    └── validate_admin_refresh_token.py     # RefreshToken 검증

apps/api/app/modules/platform_admin/auth/
├── dependencies.py                         # get_current_admin, require_admin_role
└── handlers/
    └── refresh.py                          # admin_refresh_handler

apps/api/scripts/seed_admin_account.py      # 초기 super_admin 시드
apps/api/migrations/versions/7936744b9eff_*.py  # admin_accounts + admin_refresh_tokens 마이그레이션
```

**Backend (수정)**

| 파일                                         | 변경 내용                                         |
| -------------------------------------------- | ------------------------------------------------- |
| `platform_admin/auth/handlers/login.py`      | AdminLoginService 사용 + Rate Limiting 추가       |
| `platform_admin/auth/handlers/verify_2fa.py` | admin_account_id 기반, AdminRefreshToken 사용     |
| `platform_admin/auth/schemas.py`             | AdminTokenResponse, AdminRefreshRequest/Response  |
| `platform_admin/auth/router.py`              | POST /refresh 엔드포인트 추가                     |
| `migrations/env.py`                          | AdminAccount, AdminRefreshToken import 추가       |
| `scripts/seed_all.py`                        | seed_admin_account 추가                           |

**Frontend (수정)**

| 파일                                        | 변경 내용                                              |
| ------------------------------------------- | ------------------------------------------------------ |
| `src/lib/server/auth.ts`                    | admin_account_id 추출 + token_type 검증 + refresh URL  |
| `src/routes/api/auth/verify-2fa/+server.ts` | AdminTokenResponse 파싱 (admin_account 구조체)         |
| `src/routes/api/auth/login/+server.ts`      | 응답 인터페이스에 role 필드 추가                       |

### 미구현 파일 (Phase 3 이후)

```
apps/api/app/modules/platform_admin/admin_account/
├── services/
│   ├── create_admin.py     # [Phase 3] 계정 생성 서비스
│   ├── update_admin.py     # [Phase 3] 계정 수정 서비스
│   └── delete_admin.py     # [Phase 3] 계정 삭제(비활성화) 서비스
├── handlers/               # [Phase 3] CRUD 핸들러
│   ├── create.py
│   ├── list.py
│   ├── detail.py
│   ├── update.py
│   └── delete.py
└── router.py               # [Phase 3] /admin/accounts 엔드포인트

apps/api/app/modules/platform_admin/login_history/  # [Phase 3.5]
├── models.py               # AdminLoginHistory 엔티티
├── repository.py
├── services/
│   └── record_login.py     # 로그인 시도 기록 서비스
├── handlers/
│   └── list.py             # 기록 조회
└── router.py

apps/api/app/modules/platform_admin/session/        # [Phase 3.5]
├── models.py               # AdminSession 엔티티
├── repository.py
├── services/
│   ├── create_session.py   # 세션 생성
│   └── revoke_session.py   # 세션 삭제 (강제 로그아웃)
├── handlers/
│   ├── list.py             # 활성 세션 목록
│   └── revoke.py           # 특정 세션 강제 로그아웃
└── router.py
```

---

## 7. 마이그레이션 전략

### 기존 데이터 처리

- 현재 어드민으로 사용 중인 account가 있다면 → `admin_accounts`로 데이터 이전
- account 테이블에서 어드민 관련 데이터 정리 (필요시)
- RefreshToken 테이블의 기존 어드민 토큰 무효화

### 롤백 계획

- `admin_accounts` 테이블 생성은 기존 테이블에 영향 없음 (안전)
- 문제 발생 시 어드민 인증 코드만 이전 버전으로 롤백 가능

---

## 8. 보안 고려사항

1. **토큰 분리**: `token_type: "admin"` 필드로 센터 토큰과 어드민 토큰 혼용 방지 ✅
2. **역할 검증**: 모든 어드민 API에서 `get_current_admin` + `require_admin_role` 의존성 필수 ✅
3. **super_admin 보호**: 계정 생성/삭제는 super_admin만 가능
4. **비밀번호 정책**: 영문 소/대문자 + 특수문자 + 12자리 이상 + 연속된 숫자 불가 ✅
5. **로그인 보안**: 5회 실패→30분 잠금, 10회→비활성화 + Rate Limiting ✅
6. **RefreshToken 보안**: SHA-256 해시 저장, 일회용(used_at), 5디바이스 제한 ✅
7. **감사 로그**: 어드민 활동 로그 별도 테이블 (Phase 3.5)
8. **2FA 실제 구현**: 이메일/SMS 기반 OTP로 교체 (향후)

---

## 9. 우선순위 및 작업 순서

```
[1단계] Phase 1 + Phase 2 (필수, 핵심) ✅ 완료
  → admin_accounts 테이블 + 인증 분리
  → 모델, 서비스, 핸들러, JWT 수정, RefreshToken 분리

[2단계] Phase 4 (필수, 프론트 연동) ✅ 완료
  → 프론트엔드 인증 흐름 수정
  → admin_account_id 추출, token_type 검증, verify-2fa 파싱, refresh URL 수정

[3단계] Phase 3 + Phase 5 (확장) ⬜ 다음 작업
  → 어드민 계정 CRUD + 역할별 UI
  → super_admin 관리 페이지

[4단계] Phase 3.5 + Phase 6 (보안 강화) ⬜ 이후 작업
  → 로그인 기록 + 접속 기기 관리 (백엔드 + 프론트엔드)
  → 비정상 접근 탐지 기반
```

---

## 10. 결정 필요 사항

1. **RefreshToken 분리 여부** → **별도 `admin_refresh_tokens` 테이블로 완전 분리** (확정)
2. **초기 super_admin 생성 방법** → **시드 스크립트에 추가** (확정)
3. **기존 어드민 계정 이전** → **해당 없음** (기존 어드민 계정 없음)
4. **2FA 실제 구현 시점** → **별도 작업** (하드코딩 유지 후 추후 이메일/SMS OTP)
5. **비밀번호 정책** → **영문 소/대문자 + 특수문자 + 12자리 이상 + 연속된 숫자 불가** (확정)
