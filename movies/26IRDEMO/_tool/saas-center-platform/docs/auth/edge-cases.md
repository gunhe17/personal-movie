# Auth 도메인 엣지 케이스

> 인증 및 권한 관리에서 발생 가능한 복잡한 엣지 케이스 및 해결 전략

---

## 목차

1. [동시 로그인 세션 관리](#동시-로그인-세션-관리)
2. [JWT-DB 권한 동기화](#jwt-db-권한-동기화)
3. [센터 전환 트랜잭션 중 상태 변경](#센터-전환-트랜잭션-중-상태-변경)
4. [Refresh Token 재사용 공격](#refresh-token-재사용-공격)
5. [권한 변경 시 활성 세션 처리](#권한-변경-시-활성-세션-처리)
6. [센터 삭제 시 멤버 세션 처리](#센터-삭제-시-멤버-세션-처리)
7. [플랜 변경과 JWT 동기화](#플랜-변경과-jwt-동기화)
8. [비밀번호 변경 중 동시 접근](#비밀번호-변경-중-동시-접근)
9. [Rate Limiting 우회 시도](#rate-limiting-우회-시도)
10. [기본 엣지 케이스](#기본-엣지-케이스)

---

## 동시 로그인 세션 관리

### 시나리오: 여러 디바이스에서 동시 로그인

**상황**: 사용자가 PC, 태블릿, 스마트폰에서 동시에 로그인하여 5개 이상의 활성 세션 보유

**핵심 질문**:
- 무제한 허용할 것인가?
- 제한한다면 몇 개까지?
- 제한 초과 시 어떻게 처리하는가?

---

### 전략 A: 무제한 허용 (Permissive)

**정책**: 모든 디바이스 로그인 허용

**구현**:
```python
# app/modules/auth/services/login.py
async def execute(self, email: str, password: str) -> LoginResponse:
    # 인증 검증
    account = await self.repo.get_by_email(email)
    if not pwd_context.verify(password, account.password_hash):
        raise HTTPException(401, "Invalid credentials")

    # 새 RefreshToken 생성 (제한 없음)
    refresh_token = await token_repo.create({
        "account_id": account.id,
        "token_hash": generate_token_hash(),
        "device_info": request.headers.get("User-Agent"),
        "ip_address": request.client.host,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=30)
    })

    return LoginResponse(...)
```

**장점**:
- ✅ 사용자 편의성 최대
- ✅ 구현 단순
- ✅ 여러 디바이스 동시 사용 가능

**단점**:
- ❌ 계정 공유 위험
- ❌ 토큰 탈취 시 영향 범위 큼
- ❌ DB 부하 증가 (많은 RefreshToken)

---

### 전략 B: 디바이스 제한 (Limited Sessions)

**정책**: 최대 5개 디바이스까지 허용, 초과 시 가장 오래된 세션 자동 로그아웃

**구현**:
```python
# app/modules/auth/services/login.py
class LoginService:
    MAX_ACTIVE_SESSIONS = 5

    async def execute(self, email: str, password: str) -> LoginResponse:
        # 인증 검증
        account = await self.repo.get_by_email(email)

        # 1. 활성 세션 수 확인
        active_tokens = await token_repo.get_all_by_account(account.id)

        if len(active_tokens) >= self.MAX_ACTIVE_SESSIONS:
            # 2. 가장 오래된 토큰 삭제
            oldest_token = min(active_tokens, key=lambda t: t.created_at)
            await token_repo.delete(oldest_token.id)

            # 3. 알림 전송 (선택적)
            await notification_service.send({
                "account_id": account.id,
                "type": "session_expired",
                "message": f"Session on {oldest_token.device_info} was logged out due to new login",
                "device_info": oldest_token.device_info
            })

        # 4. 새 RefreshToken 생성
        refresh_token = await token_repo.create({
            "account_id": account.id,
            "token_hash": generate_token_hash(),
            "device_info": request.headers.get("User-Agent"),
            "ip_address": request.client.host,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=30)
        })

        return LoginResponse(...)
```

**사용자 경험**:
```
[사용자가 6번째 디바이스에서 로그인]
→ 성공
→ 가장 오래된 세션 (예: 회사 PC) 자동 로그아웃
→ 해당 디바이스에서 API 요청 시:
  401 Unauthorized "Invalid refresh token"
→ 재로그인 필요
```

**장점**:
- ✅ 보안과 편의성 균형
- ✅ 계정 공유 어느 정도 방지
- ✅ 토큰 탈취 영향 제한

**단점**:
- ❌ 사용자가 예상치 못한 로그아웃 경험
- ❌ 디바이스 관리 UI 필요

---

### 전략 C: 명시적 디바이스 관리 (Explicit Management)

**정책**: 사용자가 직접 디바이스 목록을 관리, 제한 초과 시 로그인 차단

**구현**:
```python
# app/modules/auth/services/login.py
async def execute(self, email: str, password: str) -> LoginResponse:
    # 인증 검증
    account = await self.repo.get_by_email(email)

    # 1. 활성 세션 수 확인
    active_tokens = await token_repo.get_all_by_account(account.id)

    if len(active_tokens) >= self.MAX_ACTIVE_SESSIONS:
        # 2. 로그인 차단 + 디바이스 목록 반환
        raise HTTPException(
            status_code=403,
            detail={
                "message": "Maximum active sessions reached",
                "max_sessions": self.MAX_ACTIVE_SESSIONS,
                "active_sessions": [
                    {
                        "id": t.id,
                        "device_info": t.device_info,
                        "ip_address": t.ip_address,
                        "created_at": t.created_at.isoformat(),
                        "last_used": t.created_at.isoformat()
                    }
                    for t in active_tokens
                ],
                "action": "Please logout from another device first"
            }
        )

    # 3. 새 RefreshToken 생성
    refresh_token = await token_repo.create({...})
    return LoginResponse(...)

# app/modules/auth/handlers/revoke_session.py
async def revoke_session_handler(
    session_id: int,
    auth: AuthContext = Depends(get_current_user),
    uow: UnitOfWork = Depends(get_uow),
):
    """다른 디바이스 세션 강제 로그아웃"""
    async with uow:
        token_repo = uow.repo(RefreshTokenRepository)

        # 1. 세션 조회 (본인 세션만)
        session = await token_repo.get(session_id)
        if not session or session.account_id != auth.account_id:
            raise HTTPException(404, "Session not found")

        # 2. 현재 세션 보호 (자기 자신은 로그아웃 불가)
        current_token_id = await token_repo.get_id_by_hash(auth.refresh_token_hash)
        if session.id == current_token_id:
            raise HTTPException(400, "Cannot logout current session")

        # 3. 세션 삭제
        await token_repo.delete(session.id)
        await uow.commit()

        return {"message": f"Session on {session.device_info} logged out"}
```

**API 엔드포인트**:
```http
GET /auth/sessions → 활성 세션 목록
DELETE /auth/sessions/{session_id} → 특정 세션 로그아웃
DELETE /auth/sessions/all → 전체 세션 로그아웃 (현재 세션 제외)
```

**사용자 경험**:
```
[6번째 디바이스에서 로그인 시도]
→ 403 Forbidden
→ "최대 5개 디바이스까지 로그인 가능합니다"
→ 활성 디바이스 목록 표시:
   1. Chrome/Windows - 2026-01-14 10:00
   2. Safari/iPhone - 2026-01-13 15:30
   3. Firefox/MacOS - 2026-01-10 09:00
   ...
→ 사용자가 "Firefox/MacOS" 선택하여 로그아웃
→ 다시 로그인 시도 → 성공
```

**장점**:
- ✅ 사용자가 명확히 제어
- ✅ 예상치 못한 로그아웃 없음
- ✅ 보안 인식 향상

**단점**:
- ❌ 구현 복잡도 높음
- ❌ 사용자 액션 필요
- ❌ UI 개발 필요

---

### 전략 비교표

| 전략 | 제한 | 초과 시 | 사용자 경험 | 구현 난이도 | 보안 |
|------|------|---------|-----------|-----------|------|
| **A. 무제한** | 없음 | - | 최상 | 낮음 | 낮음 |
| **B. 자동 삭제** | 5개 | 가장 오래된 세션 삭제 | 보통 | 중간 | 중간 |
| **C. 명시적 관리** | 5개 | 로그인 차단 | 명확 | 높음 | 높음 |

---

### 권장 전략 (Phase별)

**Phase 1 (MVP)**:
- **전략 A (무제한)** 채택
- 이유: 구현 단순, 사용자 편의성 우선, 빠른 출시

**Phase 2**:
- **전략 B (자동 삭제)** 채택
- 제한: 5개 디바이스
- 알림: 로그아웃된 디바이스 정보 이메일 발송

**Phase 3**:
- **전략 C (명시적 관리)** 추가
- UI: 설정 > 보안 > 활성 디바이스 관리

---

## JWT-DB 권한 동기화

### 시나리오 1: 권한 변경 후 즉시 반영

**상황**:
1. 사용자가 로그인 → JWT에 `permissions: ["client:read"]`
2. 센터 관리자가 해당 사용자에게 `client:create` 권한 추가
3. 사용자는 여전히 기존 JWT 사용 중 (만료까지 15분 남음)

**문제점**:
- JWT에는 `["client:read"]`만 있음
- DB에는 `["client:read", "client:create"]`로 업데이트됨
- 15분간 새 권한 사용 불가

---

### 해결 전략 A: 짧은 Access Token 만료 (현재 방식)

**정책**: Access Token 만료 시간 15분으로 짧게 설정

```python
# app/core/security.py
ACCESS_TOKEN_EXPIRE_MINUTES = 15  # 15분마다 자동 갱신
```

**장점**:
- ✅ 구현 단순
- ✅ 최대 15분 내 자동 동기화

**단점**:
- ❌ 15분 지연 발생
- ❌ 긴급 권한 부여 시 불편

---

### 해결 전략 B: 강제 토큰 무효화 + 재로그인

**정책**: 권한 변경 시 해당 사용자의 모든 Access Token 무효화

**구현**:
```python
# app/modules/center/models.py
class CenterMember(Base):
    __tablename__ = "center_members"

    # 기존 필드들...
    token_version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1
    )  # 권한 변경 시 증가

# app/modules/center/services/update_member_permissions.py
async def execute(self, member_id: int, new_permissions: list[str]):
    """멤버 권한 업데이트 + 토큰 버전 증가"""
    member = await self.repo.get(member_id)

    # 1. 권한 업데이트
    await self.repo.update(member_id, {
        "permissions": json.dumps(new_permissions),
        "token_version": member.token_version + 1  # 버전 증가
    })

    # 2. 알림 전송
    await notification_service.send({
        "account_id": member.account_id,
        "type": "permissions_changed",
        "message": "Your permissions have been updated. Please re-login."
    })

# app/core/dependencies.py
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_session),
):
    """현재 인증된 사용자 조회 (토큰 버전 검증)"""
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    account_id = payload.get("account_id")
    center_id = payload.get("center_id")
    token_version = payload.get("token_version", 1)

    # 1. 계정 조회
    account = await session.get(Account, account_id)

    # 2. 멤버십 조회
    member = await session.execute(
        select(CenterMember).where(
            CenterMember.account_id == account_id,
            CenterMember.center_id == center_id
        )
    )
    member = member.scalar_one_or_none()

    # 3. 토큰 버전 확인
    if member and member.token_version != token_version:
        raise HTTPException(
            status_code=401,
            detail={
                "message": "Permissions have been updated. Please re-login.",
                "code": "TOKEN_VERSION_MISMATCH"
            }
        )

    return account
```

**JWT Payload에 `token_version` 추가**:
```json
{
  "account_id": 1,
  "center_id": 1,
  "plan": "pro",
  "role_id": 5,
  "permissions": ["client:read"],
  "token_version": 2  // 추가
}
```

**사용자 경험**:
```
[센터 관리자가 권한 변경]
→ CenterMember.token_version = 2로 증가

[사용자가 API 요청 (JWT token_version=1)]
→ 401 Unauthorized
→ "권한이 변경되었습니다. 재로그인하세요."
→ 재로그인 → 새 JWT (token_version=2, 새 permissions) 발급
→ API 요청 성공
```

**장점**:
- ✅ 즉시 반영 (0분 지연)
- ✅ 보안 강화
- ✅ 긴급 권한 변경 지원

**단점**:
- ❌ 사용자가 재로그인 필요 (불편)
- ❌ 구현 복잡도 증가

---

### 해결 전략 C: Hybrid (DB 검증 + 캐싱)

**정책**: 중요한 API는 DB 권한 확인, 일반 API는 JWT 권한 사용

```python
# app/core/permissions.py
from functools import lru_cache

@lru_cache(maxsize=1000, ttl=60)  # 60초 캐시
async def get_member_permissions(account_id: int, center_id: int) -> list[str]:
    """멤버 권한 조회 (캐시됨)"""
    member = await member_repo.get_by_account_and_center(account_id, center_id)
    return json.loads(member.permissions) if member else []

def require_permission(
    required_permissions: list[str],
    check_db: bool = False  # 중요 API는 True
):
    """권한 검증 데코레이터"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            auth = kwargs.get("auth")

            if check_db:
                # DB에서 최신 권한 확인 (캐시 활용)
                current_permissions = await get_member_permissions(
                    auth.account_id,
                    auth.center_id
                )
            else:
                # JWT 권한 사용
                current_permissions = auth.permissions

            # 권한 검증
            user_perms = set(current_permissions)
            required = set(required_permissions)

            if not user_perms.intersection(required):
                raise HTTPException(403, "Insufficient permissions")

            return await func(*args, **kwargs)
        return wrapper
    return decorator

# 사용 예시
@router.delete("/clients/{client_id}")
@require_permission(["client:delete"], check_db=True)  # 중요 API → DB 확인
async def delete_client(...):
    pass

@router.get("/clients")
@require_permission(["client:read"], check_db=False)  # 조회 API → JWT 사용
async def get_clients(...):
    pass
```

**장점**:
- ✅ 중요 API는 즉시 반영
- ✅ 일반 API는 성능 유지
- ✅ 캐싱으로 DB 부하 최소화

**단점**:
- ❌ 일관성 없음 (API마다 다른 동작)
- ❌ 캐시 관리 필요

---

### 권장 전략

**Phase 1 (MVP)**:
- **전략 A (짧은 만료)** 채택
- Access Token 만료: 15분

**Phase 2**:
- **전략 C (Hybrid)** 채택
- 삭제/수정 API는 DB 검증
- 조회 API는 JWT 사용

**Phase 3**:
- **전략 B (강제 무효화)** 추가
- 긴급 권한 변경 시 선택적 사용
- UI: "즉시 적용 (사용자 재로그인 필요)"

---

## 센터 전환 트랜잭션 중 상태 변경

### 시나리오: 센터 전환 중 센터 비활성화

**상황**:
```
T0: 사용자가 센터 B로 전환 시작
T1: Handler가 센터 B 조회 → is_active=true
T2: 다른 관리자가 센터 B 비활성화 → is_active=false
T3: Handler가 JWT 발급 (센터 B 정보 포함)
T4: 사용자가 센터 B로 API 요청 → 성공? 실패?
```

**문제점**:
- 비활성 센터로 JWT 발급됨
- 사용자가 비활성 센터 리소스 접근 가능

---

### 해결 전략 A: SELECT FOR UPDATE (Row Lock)

**정책**: 센터 조회 시 행 잠금으로 상태 변경 방지

```python
# app/modules/center/repository.py
async def get_for_update(self, center_id: int):
    """SELECT FOR UPDATE로 센터 조회 (행 잠금)"""
    result = await self._session.execute(
        select(Center)
        .where(Center.id == center_id)
        .with_for_update()  # 행 잠금
    )
    return result.scalar_one_or_none()

# app/modules/auth/handlers/switch_center.py
async def switch_center_handler(
    data: SwitchCenterRequest,
    auth: AuthContext,
    uow: UnitOfWork,
):
    async with uow:
        center_repo = uow.repo(CenterRepository)

        # 1. 센터 조회 + 잠금
        center = await center_repo.get_for_update(data.center_id)

        if not center:
            raise HTTPException(404, "Center not found")

        # 2. 활성화 상태 확인 (잠금 상태에서 안전하게 확인)
        if not center.is_active:
            raise HTTPException(403, "Center is deactivated")

        # 3. 멤버십 확인
        member = await member_repo.get_by_account_and_center(...)

        # 4. JWT 발급 (잠금 해제 전까지 center.is_active 변경 불가)
        new_token = create_access_token({
            "center_id": center.id,
            "plan": center.subscription.plan,
            ...
        })

        await uow.commit()  # 잠금 해제

    return {"access_token": new_token}
```

**장점**:
- ✅ 완전한 일관성 보장
- ✅ Race Condition 방지

**단점**:
- ❌ 성능 저하 (잠금 대기)
- ❌ 데드락 가능성

---

### 해결 전략 B: 낙관적 잠금 (Optimistic Locking)

**정책**: 센터 버전 확인으로 충돌 감지

```python
# app/modules/center/models.py
class Center(Base):
    __tablename__ = "centers"

    version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1
    )  # 상태 변경 시 증가

# app/modules/center/repository.py
async def update_with_version_check(
    self,
    center_id: int,
    data: dict,
    expected_version: int
):
    """낙관적 잠금으로 업데이트"""
    result = await self._session.execute(
        update(Center)
        .where(
            Center.id == center_id,
            Center.version == expected_version
        )
        .values(**data, version=expected_version + 1)
    )

    if result.rowcount == 0:
        raise HTTPException(
            status_code=409,
            detail="Center was modified by another request"
        )

# app/modules/auth/handlers/switch_center.py
async def switch_center_handler(...):
    async with uow:
        # 1. 센터 조회 (버전 기억)
        center = await center_repo.get(data.center_id)
        original_version = center.version

        # 2. 활성화 상태 확인
        if not center.is_active:
            raise HTTPException(403, "Center is deactivated")

        # 3. JWT 발급
        new_token = create_access_token({...})

        # 4. 센터 버전 확인 (변경되었으면 실패)
        current_center = await center_repo.get(data.center_id)
        if current_center.version != original_version:
            raise HTTPException(
                status_code=409,
                detail="Center status has changed. Please try again."
            )

        await uow.commit()

    return {"access_token": new_token}
```

**장점**:
- ✅ 잠금 없이 동시성 처리
- ✅ 성능 우수

**단점**:
- ❌ 재시도 로직 필요
- ❌ 사용자에게 재시도 요청

---

### 해결 전략 C: JWT 검증 시 센터 상태 재확인

**정책**: JWT 발급은 허용, API 요청 시 센터 상태 재확인

```python
# app/core/dependencies.py
async def get_current_user_with_center_check(
    auth: AuthContext = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """센터 활성화 상태 재확인"""
    if auth.center_id:
        center = await session.get(Center, auth.center_id)

        if not center or not center.is_active:
            raise HTTPException(
                status_code=403,
                detail={
                    "message": "Center is no longer active",
                    "action": "Please switch to another center"
                }
            )

    return auth

# 사용 예시
@router.get("/clients")
async def get_clients(
    auth: AuthContext = Depends(get_current_user_with_center_check),
):
    # 센터 활성화 보장됨
    ...
```

**장점**:
- ✅ 간단한 구현
- ✅ 실시간 상태 확인

**단점**:
- ❌ 매 API 호출마다 DB 조회
- ❌ 성능 영향 (캐싱으로 완화 가능)

---

### 권장 전략

**Phase 1 (MVP)**:
- **전략 C (JWT 검증 시 재확인)** 채택
- 캐싱 추가: 60초
- Dependency: `get_current_user_with_center_check`

**Phase 2**:
- **전략 B (낙관적 잠금)** 추가
- 센터 전환 시 버전 확인

---

## Refresh Token 재사용 공격

### 시나리오: 동시 다중 토큰 갱신 요청

**상황**:
```
공격자가 Refresh Token 탈취 → 100개의 동시 요청으로 Access Token 재발급 시도

T0: Request 1 → POST /auth/refresh
T0: Request 2 → POST /auth/refresh
T0: Request 3 → POST /auth/refresh
...
T0: Request 100 → POST /auth/refresh

모든 요청이 같은 Refresh Token 사용
```

**문제점**:
- 정상적으로는 Refresh Token은 1회만 사용되어야 함
- 100개의 Access Token이 발급될 수 있음
- 토큰 탈취 감지 불가

---

### 해결 전략 A: One-Time Use Refresh Token

**정책**: Refresh Token 사용 시 즉시 무효화하고 새 Refresh Token 발급

```python
# app/modules/auth/handlers/refresh.py
from sqlalchemy import update

async def refresh_handler(
    data: RefreshTokenRequest,
    uow: UnitOfWork,
):
    async with uow:
        token_repo = uow.repo(RefreshTokenRepository)

        # 1. Refresh Token 조회 + 삭제 (원자적 연산)
        token_hash = hash_token(data.refresh_token)

        # SELECT FOR UPDATE로 행 잠금
        refresh_token = await token_repo.get_by_token_hash_for_update(token_hash)

        if not refresh_token:
            # 토큰이 이미 사용되었거나 유효하지 않음
            raise HTTPException(
                status_code=401,
                detail={
                    "message": "Invalid or already used refresh token",
                    "code": "REFRESH_TOKEN_REUSE"
                }
            )

        # 2. 만료 확인
        if refresh_token.expires_at < datetime.now(timezone.utc):
            await token_repo.delete(refresh_token.id)
            raise HTTPException(401, "Refresh token has expired")

        # 3. 기존 토큰 즉시 삭제 (재사용 방지)
        await token_repo.delete(refresh_token.id)

        # 4. 새 Refresh Token 생성
        new_refresh_token = await token_repo.create({
            "account_id": refresh_token.account_id,
            "token_hash": generate_token_hash(),
            "device_info": refresh_token.device_info,
            "ip_address": refresh_token.ip_address,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=30)
        })

        # 5. 새 Access Token 생성
        account = await account_repo.get(refresh_token.account_id)
        access_token = create_access_token(account)

        await uow.commit()

        return {
            "access_token": access_token,
            "refresh_token": new_refresh_token.token,  # 새 Refresh Token 반환
            "token_type": "Bearer"
        }
```

**Refresh Token Rotation**:
```
기존: Refresh Token A (만료까지 30일)
↓
갱신 요청
↓
새 Refresh Token B 발급 (만료까지 30일)
기존 Token A 즉시 무효화
↓
동시 재사용 시도:
Request 1: Token A 사용 → 성공 → Token A 삭제, Token B 발급
Request 2: Token A 사용 → 실패 (Token A 이미 삭제됨)
```

**재사용 감지 및 대응**:
```python
# app/modules/auth/models.py
class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    reuse_detected: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False
    )  # 재사용 감지 플래그

# 재사용 감지 시
async def refresh_handler(...):
    refresh_token = await token_repo.get_by_token_hash(token_hash)

    if not refresh_token:
        # 토큰이 삭제되었는데 재사용 시도 → 공격 가능성
        # 해당 account의 모든 Refresh Token 무효화
        await token_repo.delete_all_by_account(account_id)

        # 보안 알림 전송
        await security_notification_service.send({
            "account_id": account_id,
            "type": "token_reuse_detected",
            "message": "Refresh token reuse detected. All sessions have been logged out.",
            "severity": "high"
        })

        raise HTTPException(
            status_code=401,
            detail={
                "message": "Token reuse detected. All sessions logged out for security.",
                "code": "SECURITY_BREACH"
            }
        )
```

**장점**:
- ✅ 재사용 공격 완벽 차단
- ✅ 토큰 탈취 즉시 감지
- ✅ 보안 최대화

**단점**:
- ❌ 클라이언트가 Refresh Token 저장 업데이트 필요
- ❌ 네트워크 오류 시 토큰 손실 위험

---

### 해결 전략 B: 사용 횟수 제한 (Usage Counter)

**정책**: Refresh Token 사용 횟수를 제한하여 재사용 감지

```python
# app/modules/auth/models.py
class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    usage_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0
    )
    max_usage: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1  # 1회만 허용
    )

# app/modules/auth/handlers/refresh.py
async def refresh_handler(...):
    async with uow:
        token_repo = uow.repo(RefreshTokenRepository)

        # 1. Refresh Token 조회 + 행 잠금
        refresh_token = await token_repo.get_by_token_hash_for_update(token_hash)

        # 2. 사용 횟수 확인
        if refresh_token.usage_count >= refresh_token.max_usage:
            # 재사용 시도 감지
            await token_repo.delete_all_by_account(refresh_token.account_id)
            raise HTTPException(
                status_code=401,
                detail="Token reuse detected"
            )

        # 3. 사용 횟수 증가
        await token_repo.update(refresh_token.id, {
            "usage_count": refresh_token.usage_count + 1
        })

        # 4. Access Token 발급
        access_token = create_access_token(...)

        await uow.commit()

        return {"access_token": access_token}
```

**장점**:
- ✅ Refresh Token 유지 (Rotation 불필요)
- ✅ 재사용 감지

**단점**:
- ❌ 1회 사용 후 폐기되어 Rotation과 차이 없음
- ❌ DB 업데이트 오버헤드

---

### 권장 전략

**Phase 1 (MVP)**:
- **전략 A (One-Time Use + Rotation)** 채택
- Refresh Token은 1회 사용 후 즉시 삭제
- 새 Refresh Token 자동 발급

**Phase 2**:
- 재사용 감지 로직 추가
- 보안 알림 시스템 구축

---

## 권한 변경 시 활성 세션 처리

### 시나리오: 관리자가 멤버 권한 즉시 삭제

**상황**:
```
T0: 사용자 A가 로그인 → JWT (permissions: ["client:delete"])
T1: 사용자 A가 여러 내담자 삭제 작업 진행 중
T2: 센터 관리자가 사용자 A의 "client:delete" 권한 제거
T3: 사용자 A가 계속 삭제 작업 시도 → 성공? 실패?
```

**핵심 질문**:
- 진행 중인 작업을 즉시 차단해야 하는가?
- 기존 JWT는 언제 무효화되는가?
- 긴급 권한 제거 vs 일반 권한 제거를 구분하는가?

---

### 전략 A: Lazy Invalidation (지연 무효화)

**정책**: Access Token 만료 시 자연스럽게 권한 변경 반영 (최대 15분 지연)

```python
# 센터 관리자가 권한 변경
async def update_member_permissions(...):
    await member_repo.update(member_id, {
        "permissions": json.dumps(new_permissions)
    })

    # 특별한 처리 없음 → 기존 JWT는 만료까지 유효
```

**사용자 경험**:
```
T0: 사용자 A → JWT (permissions: ["client:delete"], exp: T0+15분)
T2: 관리자가 권한 제거 (DB만 업데이트)
T3: 사용자 A가 삭제 시도 → 성공 (JWT 아직 유효)
...
T15: Access Token 만료
T16: Refresh → 새 JWT (permissions: ["client:read"])
T17: 삭제 시도 → 403 Forbidden
```

**장점**:
- ✅ 구현 단순
- ✅ 서버 부하 없음
- ✅ 기존 작업 중단 없음

**단점**:
- ❌ 최대 15분 지연
- ❌ 긴급 권한 제거 불가

---

### 전략 B: 즉시 무효화 (token_version 사용)

**정책**: 권한 변경 시 token_version 증가하여 즉시 무효화

```python
# JWT 검증 시 token_version 확인 (위 JWT-DB 동기화 섹션 참조)
async def get_current_user(...):
    # ...
    if member.token_version != jwt_payload["token_version"]:
        raise HTTPException(
            status_code=401,
            detail="Permissions changed. Please re-login."
        )
```

**사용자 경험**:
```
T0: 사용자 A 로그인 → JWT (token_version: 1)
T2: 관리자가 권한 제거 → token_version: 2
T3: 사용자 A가 API 요청 → 401 Unauthorized
→ "권한이 변경되었습니다. 재로그인하세요"
→ 재로그인 → 새 JWT (token_version: 2)
```

**장점**:
- ✅ 즉시 반영 (0분 지연)
- ✅ 긴급 권한 제거 가능

**단점**:
- ❌ 재로그인 강제 (불편)
- ❌ 진행 중 작업 중단

---

### 전략 C: 선택적 무효화 (Urgent vs Normal)

**정책**: 권한 변경 시 긴급 여부 선택 가능

```python
# app/modules/center/schemas.py
class UpdateMemberPermissionsRequest(BaseModel):
    permissions: list[str]
    force_logout: bool = False  # 긴급 권한 제거 시 true

# app/modules/center/handlers/update_member_permissions.py
async def update_member_permissions_handler(
    member_id: int,
    data: UpdateMemberPermissionsRequest,
    uow: UnitOfWork,
):
    async with uow:
        member_repo = uow.repo(CenterMemberRepository)
        member = await member_repo.get(member_id)

        # 1. 권한 업데이트
        await member_repo.update(member_id, {
            "permissions": json.dumps(data.permissions)
        })

        if data.force_logout:
            # 2-1. 긴급: token_version 증가 → 즉시 로그아웃
            await member_repo.update(member_id, {
                "token_version": member.token_version + 1
            })

            # 알림 전송
            await notification_service.send({
                "account_id": member.account_id,
                "type": "permissions_revoked",
                "message": "Your permissions have been immediately revoked. Please re-login.",
                "severity": "high"
            })
        else:
            # 2-2. 일반: 자연스럽게 만료 시 반영
            await notification_service.send({
                "account_id": member.account_id,
                "type": "permissions_updated",
                "message": "Your permissions have been updated. Changes will take effect soon."
            })

        await uow.commit()

        return {
            "message": "Permissions updated",
            "immediate_effect": data.force_logout
        }
```

**UI 예시**:
```
[센터 관리자 > 멤버 관리 > 권한 수정]

김철수 상담사 권한:
☑ client:read (내담자 조회)
☑ client:create (내담자 생성)
☐ client:delete (내담자 삭제)  ← 체크 해제

[저장 옵션]
( ) 자동 반영 (최대 15분 소요)
(●) 즉시 적용 (사용자 재로그인 필요)

[확인]
```

**장점**:
- ✅ 유연한 정책
- ✅ 상황에 맞는 선택 가능
- ✅ 긴급 상황 대응 가능

**단점**:
- ❌ UI 복잡도 증가
- ❌ 관리자 교육 필요

---

### 권장 전략

**Phase 1 (MVP)**:
- **전략 A (Lazy Invalidation)** 채택
- Access Token 만료: 15분

**Phase 2**:
- **전략 C (선택적 무효화)** 채택
- UI: "즉시 적용" 옵션 제공

---

## 센터 삭제 시 멤버 세션 처리

### 시나리오: 센터 삭제 시 로그인한 멤버 처리

**상황**:
```
센터 A:
- 관리자: 김관리 (현재 로그인 중)
- 멤버: 이상담, 박접수 (현재 로그인 중)

김관리가 센터 A 삭제 → 이상담, 박접수는 어떻게 되는가?
```

**핵심 질문**:
- 센터 삭제 시 모든 멤버 로그아웃 시켜야 하는가?
- JWT는 여전히 유효한데 센터가 없으면?
- 센터 삭제를 허용해야 하는가? (비활성화만?)

---

### 전략 A: 센터 삭제 금지, 비활성화만 허용

**정책**: 센터는 삭제 불가, `is_active=false`로만 설정

```python
# app/modules/center/handlers/delete_center.py
async def delete_center_handler(
    center_id: int,
    auth: AuthContext,
    uow: UnitOfWork,
):
    raise HTTPException(
        status_code=400,
        detail={
            "message": "Centers cannot be deleted. Use deactivation instead.",
            "alternative": "PATCH /centers/{id} { is_active: false }"
        }
    )

# app/modules/center/handlers/deactivate_center.py
async def deactivate_center_handler(
    center_id: int,
    auth: AuthContext,
    uow: UnitOfWork,
):
    async with uow:
        center_repo = uow.repo(CenterRepository)

        # 1. 센터 비활성화
        await center_repo.update(center_id, {
            "is_active": False,
            "deactivated_at": datetime.now(timezone.utc)
        })

        # 2. 모든 멤버의 token_version 증가 (즉시 로그아웃)
        member_repo = uow.repo(CenterMemberRepository)
        members = await member_repo.get_all_by_center(center_id)

        for member in members:
            await member_repo.update(member.id, {
                "token_version": member.token_version + 1
            })

            # 알림 전송
            await notification_service.send({
                "account_id": member.account_id,
                "type": "center_deactivated",
                "message": f"Center '{center.name}' has been deactivated. Please switch to another center."
            })

        await uow.commit()

        return {
            "message": "Center deactivated",
            "affected_members": len(members)
        }
```

**사용자 경험**:
```
[센터 관리자가 센터 비활성화]
→ 모든 멤버 token_version 증가

[멤버가 API 요청]
→ 401 Unauthorized
→ "센터가 비활성화되었습니다. 다른 센터를 선택하세요"
→ GET /auth/my-centers → 다른 센터 목록 표시
→ 센터 전환 → 새 JWT 발급
```

**장점**:
- ✅ 데이터 보존 (복구 가능)
- ✅ 감사 추적 유지
- ✅ 실수 방지

**단점**:
- ❌ 진짜 삭제 불가
- ❌ DB 공간 계속 차지

---

### 전략 B: 센터 삭제 허용 + 멤버 세션 무효화

**정책**: 센터 삭제 시 모든 멤버 세션 무효화 + 어플리케이션 레벨 CASCADE 삭제

```python
# app/modules/center/models.py
class Center(Base):
    __tablename__ = "centers"

    # FK 제약 없음 (모듈러 모놀리스)
    members = relationship(
        "CenterMember",
        back_populates="center"
    )

# app/modules/center/handlers/delete_center.py
async def delete_center_handler(
    center_id: int,
    auth: AuthContext,
    uow: UnitOfWork,
):
    async with uow:
        center_repo = uow.repo(CenterRepository)
        member_repo = uow.repo(CenterMemberRepository)
        refresh_token_repo = uow.repo(RefreshTokenRepository)

        # 1. 센터 조회
        center = await center_repo.get(center_id)
        if not center:
            raise HTTPException(404, "Center not found")

        # 2. 활성 멤버 확인
        members = await member_repo.get_all_by_center(center_id)

        # 3. 모든 멤버의 Refresh Token 삭제 (강제 로그아웃)
        for member in members:
            await refresh_token_repo.delete_all_by_account(member.account_id)

            # 알림 전송
            await notification_service.send({
                "account_id": member.account_id,
                "type": "center_deleted",
                "message": f"Center '{center.name}' has been deleted. Your account is unaffected.",
                "severity": "high"
            })

        # 4. CenterMember 명시적 삭제 (어플리케이션 레벨 CASCADE)
        await member_repo.delete_by_center_id(center_id)

        # 5. 센터 삭제
        await center_repo.delete(center_id)

        await uow.commit()

        return {
            "message": "Center deleted",
            "affected_members": len(members),
            "deleted_members": len(members)
        }
```

**사용자 경험**:
```
[센터 삭제]
→ 모든 멤버 Refresh Token 삭제

[멤버가 API 요청 (Access Token 아직 유효)]
→ 성공 (짧은 시간 동안)

[Access Token 만료 후 갱신 시도]
→ 401 Unauthorized "Invalid refresh token"
→ 재로그인 필요
→ GET /auth/my-centers → 다른 센터만 표시
```

**장점**:
- ✅ 완전한 삭제 가능
- ✅ GDPR 준수 (데이터 완전 삭제)

**단점**:
- ❌ 데이터 복구 불가
- ❌ 실수 위험 높음

---

### 전략 C: Soft Delete + 30일 유예 기간

**정책**: 센터는 soft delete, 30일 후 완전 삭제

```python
# app/modules/center/models.py
class Center(Base):
    __tablename__ = "centers"

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )  # Soft delete

# app/modules/center/handlers/delete_center.py
async def delete_center_handler(...):
    async with uow:
        # 1. Soft delete
        await center_repo.update(center_id, {
            "is_active": False,
            "deleted_at": datetime.now(timezone.utc)
        })

        # 2. 멤버 token_version 증가
        members = await member_repo.get_all_by_center(center_id)
        for member in members:
            await member_repo.update(member.id, {
                "token_version": member.token_version + 1
            })

        await uow.commit()

        return {
            "message": "Center deleted. Data will be permanently removed in 30 days.",
            "permanent_deletion_date": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        }

# 배치 작업: 30일 경과한 센터 완전 삭제
# app/tasks/cleanup_deleted_centers.py
async def cleanup_deleted_centers():
    """30일 경과한 센터 완전 삭제"""
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=30)

    deleted_centers = await center_repo.get_deleted_before(cutoff_date)

    for center in deleted_centers:
        # CASCADE 삭제
        await center_repo.delete(center.id)
        logger.info(f"Permanently deleted center {center.id}")
```

**장점**:
- ✅ 실수 복구 가능 (30일 내)
- ✅ GDPR 준수 (최종 삭제됨)
- ✅ 감사 추적 유지

**단점**:
- ❌ 복잡도 증가
- ❌ 배치 작업 필요

---

### 권장 전략

**Phase 1 (MVP)**:
- **전략 A (비활성화만)** 채택
- 센터 삭제 API 없음, 비활성화만 제공

**Phase 2**:
- **전략 C (Soft Delete + 유예 기간)** 채택
- 30일 유예 기간
- 복원 API 제공

---

## 플랜 변경과 JWT 동기화

### 시나리오: 플랜 업그레이드 중 API 요청

**상황**:
```
T0: 사용자가 Free → Pro 플랜 업그레이드 시작
T1: Subscription 업데이트: plan="pro", status="pending_payment"
T2: 결제 처리 중 (5초 소요)
T3: 사용자가 다른 탭에서 AI 보고서 생성 요청
T4: JWT에는 plan="free", DB에는 plan="pro" (pending_payment)
T5: 결제 성공 → status="active"
```

**핵심 질문**:
- T3 시점에 AI 기능 허용해야 하는가?
- JWT plan과 DB plan이 다르면 어느 것을 믿는가?
- 결제 완료 전에 Pro 기능 사용하면?

---

### 해결 전략 A: Status 기반 차단 (권장)

**정책**: `status="active"`일 때만 기능 허용

```python
# app/core/permissions.py
def require_plan(allowed_plans: list[str]):
    """플랜 검증 데코레이터"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            auth = kwargs.get("auth")

            # 1. JWT plan 확인 (기본)
            jwt_plan = auth.plan

            # 2. 중요 기능은 DB에서 최신 상태 확인
            if is_critical_feature(func):
                subscription = await get_subscription_cached(auth.center_id)

                # Status 검증 (pending_payment는 차단)
                if subscription.status != "active":
                    raise HTTPException(
                        status_code=402,
                        detail={
                            "message": "Feature temporarily unavailable",
                            "reason": f"Subscription status: {subscription.status}",
                            "action": "Please complete payment or wait for verification"
                        }
                    )

                # DB plan 사용 (최신 정보)
                current_plan = subscription.plan
            else:
                current_plan = jwt_plan

            # 3. 플랜 검증
            if current_plan not in allowed_plans:
                raise HTTPException(
                    status_code=402,
                    detail="This feature requires a higher plan"
                )

            return await func(*args, **kwargs)
        return wrapper
    return decorator

# 사용 예시
@router.post("/ai-report")
@require_plan(["pro", "enterprise"])  # is_critical_feature=True (자동 감지)
async def generate_ai_report(...):
    """AI 보고서 생성 (중요 기능 → DB 검증)"""
    pass
```

**타임라인**:
```
T0: 사용자 업그레이드 시작
T1: DB plan="pro", status="pending_payment"
T3: 사용자 AI 보고서 요청
    → require_plan 데코레이터 실행
    → DB 조회: status="pending_payment"
    → 402 Payment Required
    → "결제 처리 중입니다. 잠시 후 다시 시도하세요"
T5: 결제 성공 → status="active"
T6: 사용자 AI 보고서 재요청 → 성공
```

**장점**:
- ✅ 결제 완료 전 Pro 기능 차단
- ✅ 일관성 보장
- ✅ 악용 방지

**단점**:
- ❌ 매 요청마다 DB 조회 (캐싱으로 완화)

---

### 해결 전략 B: JWT 재발급 후 허용

**정책**: 플랜 변경 완료 후 즉시 JWT 재발급

```python
# app/modules/subscription/handlers/upgrade_handler.py
async def upgrade_handler(...):
    async with uow:
        # 1. 결제 처리
        payment_result = await payment_gateway.charge({...})

        # 2. Subscription 업데이트
        await subscription_repo.update(subscription.id, {
            "plan": "pro",
            "status": "active"
        })

        await uow.commit()

    # 3. JWT 즉시 재발급 (새 plan 포함)
    new_token = await create_access_token({
        "account_id": auth.account_id,
        "center_id": auth.center_id,
        "plan": "pro",  # 업데이트된 플랜
        "role_id": auth.role_id,
        "permissions": auth.permissions
    })

    # 4. 클라이언트에게 새 토큰 전달
    return {
        "subscription": subscription,
        "access_token": new_token,
        "message": "Upgraded to Pro plan. Please use the new access token."
    }
```

**Frontend 처리**:
```typescript
// Frontend: 업그레이드 후 토큰 즉시 교체
async function upgradeSubscription(newPlan: string) {
  const response = await api.post('/subscription/upgrade', { plan: newPlan });

  // 새 토큰 저장
  setAuthToken(response.access_token);

  // 즉시 UI 업데이트 (새로고침 불필요)
  queryClient.invalidateQueries(['subscription']);

  toast.success('Pro 플랜 업그레이드 완료! 모든 기능을 사용할 수 있습니다.');
}
```

**장점**:
- ✅ 즉시 반영
- ✅ 사용자 경험 우수
- ✅ DB 조회 불필요

**단점**:
- ❌ 클라이언트가 토큰 교체 로직 필요

---

### 해결 전략 C: Subscription 이벤트 + 실시간 알림

**정책**: 플랜 변경 시 WebSocket/SSE로 클라이언트에게 알림

```python
# app/modules/subscription/handlers/upgrade_handler.py
async def upgrade_handler(...):
    # ... 업그레이드 로직 ...

    # 실시간 이벤트 발행
    await event_service.publish({
        "type": "subscription.plan_changed",
        "center_id": auth.center_id,
        "data": {
            "old_plan": "free",
            "new_plan": "pro",
            "access_token": new_token  # 새 토큰 포함
        }
    })

    return {...}

# Frontend: SSE 연결
const eventSource = new EventSource('/api/events');

eventSource.addEventListener('subscription.plan_changed', (event) => {
  const data = JSON.parse(event.data);

  // 즉시 토큰 교체
  setAuthToken(data.access_token);

  // UI 업데이트
  queryClient.invalidateQueries(['subscription']);

  toast.success(`${data.new_plan} 플랜 업그레이드 완료!`);
});
```

**장점**:
- ✅ 실시간 동기화
- ✅ 여러 탭/디바이스 동시 업데이트
- ✅ 사용자 경험 최상

**단점**:
- ❌ SSE/WebSocket 인프라 필요
- ❌ 복잡도 높음

---

### 권장 전략

**Phase 1 (MVP)**:
- **전략 A (Status 기반 차단)** 채택
- 캐싱: 60초

**Phase 2**:
- **전략 B (JWT 재발급)** 추가
- 업그레이드 API 응답에 새 토큰 포함

**Phase 3**:
- **전략 C (실시간 알림)** 추가
- SSE/WebSocket 구현

---

## 비밀번호 변경 중 동시 접근

### 시나리오: 비밀번호 변경 중 로그인 시도

**상황**:
```
T0: 사용자가 "비밀번호 변경" 시작
T1: DB 트랜잭션 시작
T2: password_hash 업데이트 중
T3: 다른 디바이스에서 로그인 시도 (기존 비밀번호 사용)
T4: 트랜잭션 커밋
```

**핵심 질문**:
- T3 시점 로그인은 성공해야 하는가?
- 비밀번호 변경 중에는 계정 잠금해야 하는가?
- 비밀번호 변경 후 모든 세션 로그아웃 시켜야 하는가?

---

### 해결 전략 A: 비밀번호 변경 후 전체 로그아웃

**정책**: 비밀번호 변경 완료 시 모든 Refresh Token 삭제

```python
# app/modules/auth/handlers/change_password.py
async def change_password_handler(
    data: ChangePasswordRequest,
    auth: AuthContext,
    uow: UnitOfWork,
):
    async with uow:
        account_repo = uow.repo(AccountRepository)
        token_repo = uow.repo(RefreshTokenRepository)

        # 1. 현재 비밀번호 확인
        account = await account_repo.get(auth.account_id)
        if not pwd_context.verify(data.current_password, account.password_hash):
            raise HTTPException(400, "Current password is incorrect")

        # 2. 비밀번호 정책 검증
        validate_password_service = ValidatePasswordService()
        validate_password_service.execute(data.new_password)

        # 3. 재사용 검증
        if account.password_history:
            history = json.loads(account.password_history)
            for old_hash in history:
                if pwd_context.verify(data.new_password, old_hash):
                    raise HTTPException(
                        400,
                        "This password was recently used"
                    )

        # 4. 비밀번호 변경
        new_hash = pwd_context.hash(data.new_password)
        history = json.loads(account.password_history) if account.password_history else []
        history.insert(0, account.password_hash)
        history = history[:3]

        await account_repo.update(auth.account_id, {
            "password_hash": new_hash,
            "password_history": json.dumps(history)
        })

        # 5. 모든 Refresh Token 삭제 (전체 로그아웃)
        await token_repo.delete_all_by_account(auth.account_id)

        await uow.commit()

        # 6. 알림 전송
        await notification_service.send({
            "account_id": auth.account_id,
            "type": "password_changed",
            "message": "Your password has been changed. All devices have been logged out for security."
        })

        return {
            "message": "Password changed successfully. Please log in again."
        }
```

**사용자 경험**:
```
[사용자가 비밀번호 변경]
→ 성공
→ 모든 디바이스에서 강제 로그아웃
→ "비밀번호가 변경되었습니다. 다시 로그인하세요"

[다른 디바이스에서 API 요청]
→ Access Token 만료 → Refresh 시도
→ 401 Unauthorized "Invalid refresh token"
→ 재로그인 필요
```

**장점**:
- ✅ 보안 강화 (토큰 탈취 대응)
- ✅ 의도치 않은 비밀번호 변경 감지

**단점**:
- ❌ 모든 디바이스 재로그인 필요 (불편)

---

### 해결 전략 B: 현재 디바이스만 유지

**정책**: 비밀번호 변경한 디바이스만 로그인 유지, 나머지 로그아웃

```python
async def change_password_handler(...):
    async with uow:
        # ... 비밀번호 변경 로직 ...

        # 현재 디바이스의 Refresh Token만 제외하고 모두 삭제
        current_token_id = await token_repo.get_id_by_hash(auth.refresh_token_hash)

        await token_repo.delete_all_except(
            account_id=auth.account_id,
            except_token_id=current_token_id
        )

        await uow.commit()

        return {
            "message": "Password changed. Other devices have been logged out."
        }
```

**장점**:
- ✅ 현재 디바이스 재로그인 불필요
- ✅ 보안 유지

**단점**:
- ❌ 구현 복잡도 증가

---

### 해결 전략 C: 선택적 로그아웃

**정책**: 사용자가 다른 디바이스 로그아웃 여부 선택

```python
# app/modules/auth/schemas.py
class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    logout_other_devices: bool = True  # 기본값 true

# Handler
async def change_password_handler(data: ChangePasswordRequest, ...):
    async with uow:
        # ... 비밀번호 변경 ...

        if data.logout_other_devices:
            # 다른 디바이스 로그아웃
            current_token_id = await token_repo.get_id_by_hash(...)
            await token_repo.delete_all_except(auth.account_id, current_token_id)
        # else: 로그아웃하지 않음

        await uow.commit()
```

**UI**:
```
[비밀번호 변경]

현재 비밀번호: [********]
새 비밀번호: [********]
새 비밀번호 확인: [********]

☑ 다른 디바이스 모두 로그아웃 (권장)

[변경하기]
```

**장점**:
- ✅ 사용자 선택권
- ✅ 편의성과 보안 균형

**단점**:
- ❌ 보안 의식 낮은 사용자는 체크 해제 가능

---

### 권장 전략

**Phase 1 (MVP)**:
- **전략 A (전체 로그아웃)** 채택
- 보안 우선

**Phase 2**:
- **전략 C (선택적)** 채택
- 기본값: 다른 디바이스 로그아웃 (체크됨)

---

## Rate Limiting 우회 시도

### 시나리오: 분산 IP로 Rate Limiting 우회

**상황**:
```
공격자가 VPN/Proxy로 IP 변경하며 무차별 대입 공격

IP 1.1.1.1 → 5회 시도 → 차단
IP 2.2.2.2 → 5회 시도 → 차단
IP 3.3.3.3 → 5회 시도 → 차단
...
IP 100.100.100.100 → 5회 시도 → 차단

총 500회 시도 (같은 이메일)
```

**문제점**:
- IP 기반 Rate Limiting만으로는 방어 불가
- 이메일 기반 Rate Limiting 추가 필요

---

### 해결 전략: 이메일 + IP 복합 Rate Limiting

**정책**: IP당 5회, 이메일당 10회 제한

```python
# app/modules/auth/services/check_rate_limit.py
class CheckRateLimitService:
    """복합 Rate Limiting 서비스"""

    IP_MAX_ATTEMPTS = 5
    IP_WINDOW_SECONDS = 900  # 15분

    EMAIL_MAX_ATTEMPTS = 10
    EMAIL_WINDOW_SECONDS = 3600  # 1시간

    async def execute(self, email: str, ip_address: str) -> None:
        """IP + 이메일 복합 검증"""

        # 1. IP 기반 검증
        ip_lockout_key = f"login_lockout_ip:{ip_address}"
        ip_attempts_key = f"login_attempts_ip:{ip_address}"

        is_ip_locked = await self.redis.get(ip_lockout_key)
        if is_ip_locked:
            raise HTTPException(
                status_code=429,
                detail="Too many login attempts from this IP. Try again in 15 minutes."
            )

        ip_attempts = await self.redis.get(ip_attempts_key)
        if ip_attempts and int(ip_attempts) >= self.IP_MAX_ATTEMPTS:
            await self.redis.setex(ip_lockout_key, self.IP_WINDOW_SECONDS, "1")
            raise HTTPException(status_code=429, detail="Too many login attempts")

        # 2. 이메일 기반 검증
        email_lockout_key = f"login_lockout_email:{email}"
        email_attempts_key = f"login_attempts_email:{email}"

        is_email_locked = await self.redis.get(email_lockout_key)
        if is_email_locked:
            raise HTTPException(
                status_code=429,
                detail={
                    "message": "Too many failed login attempts for this account.",
                    "lockout_until": "1 hour",
                    "action": "Please reset your password or contact support"
                }
            )

        email_attempts = await self.redis.get(email_attempts_key)
        if email_attempts and int(email_attempts) >= self.EMAIL_MAX_ATTEMPTS:
            await self.redis.setex(email_lockout_key, self.EMAIL_WINDOW_SECONDS, "1")

            # 계정 소유자에게 알림
            await security_notification_service.send({
                "email": email,
                "type": "suspicious_activity",
                "message": "Multiple failed login attempts detected. Your account is temporarily locked."
            })

            raise HTTPException(
                status_code=429,
                detail="Account temporarily locked due to suspicious activity"
            )

    async def record_failure(self, email: str, ip_address: str) -> None:
        """실패 기록 (IP + 이메일)"""
        # IP 실패 기록
        ip_attempts_key = f"login_attempts_ip:{ip_address}"
        await self.redis.incr(ip_attempts_key)
        await self.redis.expire(ip_attempts_key, self.IP_WINDOW_SECONDS)

        # 이메일 실패 기록
        email_attempts_key = f"login_attempts_email:{email}"
        await self.redis.incr(email_attempts_key)
        await self.redis.expire(email_attempts_key, self.EMAIL_WINDOW_SECONDS)

    async def clear_attempts(self, email: str, ip_address: str) -> None:
        """성공 시 초기화"""
        ip_attempts_key = f"login_attempts_ip:{ip_address}"
        email_attempts_key = f"login_attempts_email:{email}"

        await self.redis.delete(ip_attempts_key)
        await self.redis.delete(email_attempts_key)
```

**Redis 키 구조**:
```
# IP 기반
login_attempts_ip:192.168.1.1 = 3 (TTL: 900초)
login_lockout_ip:192.168.1.1 = 1 (TTL: 900초)

# 이메일 기반
login_attempts_email:user@example.com = 7 (TTL: 3600초)
login_lockout_email:user@example.com = 1 (TTL: 3600초)
```

**공격 시나리오**:
```
공격자가 IP 변경하며 user@example.com 공격

IP 1.1.1.1: 5회 실패 → IP 차단 (15분)
IP 2.2.2.2: 5회 실패 → IP 차단 (15분)
총 10회 실패 → 이메일 차단 (1시간)

더 이상 IP 변경해도 로그인 불가 (이메일 차단)
```

**장점**:
- ✅ IP 변경 공격 방어
- ✅ 계정 무차별 대입 방지
- ✅ 계정 소유자 보호

**단점**:
- ❌ Redis 부하 2배
- ❌ 정당한 사용자도 차단 가능 (비밀번호 여러 번 틀린 경우)

---

## 기본 엣지 케이스

### 간단한 엣지 케이스 요약

| # | 엣지 케이스 | 검증 위치 | HTTP 코드 | 간단 설명 |
|---|------------|----------|----------|----------|
| 1 | 이메일 중복 | Handler | 409 | 회원가입 시 이메일 중복 검증 |
| 2 | 비밀번호 정책 위반 | Service | 400 | 10자 이상, 대소문자, 숫자, 특수문자 필수 |
| 3 | 비밀번호 재사용 | Service | 400 | 최근 3개 비밀번호 재사용 금지 |
| 4 | 비활성 계정 로그인 | Handler | 403 | is_active=false 계정 로그인 차단 |
| 5 | 만료된 Access Token | Dependency | 401 | JWT exp 확인 |
| 6 | 만료된 Refresh Token | Handler | 401 | expires_at 확인 후 삭제 |
| 7 | 존재하지 않는 센터 전환 | Handler | 404 | center_id 검증 |
| 8 | 권한 없는 센터 전환 | Handler | 403 | CenterMember 조회 |
| 9 | 센터 선택 안 함 | Dependency | 400 | JWT에 center_id 없음 |
| 10 | 권한 없는 API 접근 | Decorator | 403 | @require_permission 검증 |
| 11 | JWT Payload 조작 | JWT Library | 401 | 서명 검증 실패 |

---

## 엣지 케이스 우선순위

| 우선순위 | 엣지 케이스 | Phase 1 | Phase 2 | Phase 3 |
|---------|-----------|---------|---------|---------|
| **P0 (Critical)** | Refresh Token 재사용 공격 | ✅ One-Time Use | - | - |
| **P0** | 플랜 변경과 JWT 동기화 | ✅ Status 차단 | ✅ JWT 재발급 | ✅ SSE |
| **P0** | Rate Limiting 우회 | ✅ IP+이메일 | - | - |
| **P1 (High)** | 비밀번호 변경 시 세션 처리 | ✅ 전체 로그아웃 | ✅ 선택적 로그아웃 | - |
| **P1** | 동시 로그인 세션 관리 | ✅ 무제한 | ✅ 자동 삭제 (5개) | ✅ 명시적 관리 |
| **P2 (Medium)** | JWT-DB 권한 동기화 | ✅ 15분 만료 | ✅ Hybrid | ✅ 강제 무효화 |
| **P2** | 센터 전환 중 상태 변경 | ✅ JWT 재확인 | ✅ 낙관적 잠금 | - |
| **P2** | 권한 변경 시 활성 세션 | ✅ Lazy | ✅ 선택적 무효화 | - |
| **P2** | 센터 삭제 시 멤버 세션 | ✅ 비활성화만 | ✅ Soft Delete | - |

---

## 참고 문서

- **메인 도메인**: `/docs/auth/domain.md`
- **시나리오**: `/docs/auth/scenarios.md`
- **의사결정 기록**: `/docs/auth/decision-log.md`
- **Subscription 엣지 케이스**: `/docs/subscription/edge-cases.md` (참고용)
