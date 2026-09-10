# 첫 로그인 비밀번호 변경 강제 플랜

> 시드로 생성된 관리자 계정의 초기 비밀번호 보안 문제 해결

---

## 배경

- 시드 스크립트에 초기 비밀번호가 하드코딩되어 있음
- 첫 로그인 시 비밀번호 변경을 강제하여 초기 비밀번호를 일회용으로 처리

## 판단 기준

- `AdminAccount.last_login_at IS NULL` → 첫 로그인으로 판단
- 별도 컬럼 추가 불필요

---

## 1. `last_login_at` 갱신 시점 이동

**현재**: login Step 1에서 `last_login_at` 갱신 → verify-2fa에서는 이미 값이 set된 상태

**변경**: verify-2fa 성공 시점으로 이동
- `login.py`에서 `last_login_at` 갱신 제거
- `verify_2fa.py`에서 토큰 발급 직전에 갱신
- 2FA까지 완료해야 "로그인 성공"으로 간주하는 게 의미적으로 정확

---

## 2. 2FA 응답에 `must_change_password` 추가

**파일**: `apps/api/app/modules/platform_admin/auth/handlers/verify_2fa.py`

- `last_login_at` 갱신 전에 `is None` 여부 확인
- 응답에 `must_change_password: bool` 포함

```json
{
  "admin_account": { ... },
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "Bearer",
  "expires_in": 1800,
  "must_change_password": true
}
```

---

## 3. 비밀번호 변경 API

**경로**: `POST /admin/auth/change-password` (인증 필요)

**Request**:
```json
{
  "current_password": "...",
  "new_password": "...",
  "new_password_confirm": "..."
}
```

**Response**:
```json
{
  "success": true,
  "message": "비밀번호가 변경되었습니다."
}
```

**검증 규칙** (기존 `schemas.py` 비밀번호 규칙 재사용):
- 최소 12자, 대문자/소문자/특수문자 포함, 연속 숫자 금지
- 현재 비밀번호와 동일하면 거부

**구현 파일**:
- `auth/schemas.py` — Request/Response 스키마
- `auth/handlers/change_password.py` — Handler
- `admin_account/services/change_password.py` — Service
- `auth/router.py` — 엔드포인트 추가

---

## 4. Frontend (apps/admin)

### 비밀번호 변경 페이지
- **경로**: `/change-password`
- 현재 비밀번호 + 새 비밀번호 + 확인 입력
- 비밀번호 규칙 안내 표시
- 변경 완료 후 대시보드로 이동

### 리다이렉트 로직
- `verify-2fa` 응답에서 `must_change_password` 확인
- `true`이면 `/change-password`로 리다이렉트

### API 프록시
- `POST /api/auth/change-password` → 백엔드 프록시

---

## 5. 구현 순서

1. `last_login_at` 갱신 시점 이동 (login → verify-2fa)
2. 비밀번호 변경 API 생성 (Backend)
3. 2FA 응답에 `must_change_password` 추가
4. 프론트엔드 비밀번호 변경 페이지 + 리다이렉트
