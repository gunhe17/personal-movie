# Center 도메인 엣지 케이스

> 센터 관리에서 발생 가능한 엣지 케이스 및 해결 전략

---

## 목차

1. [초대 만료 처리](#1-초대-만료-처리)
2. [동일 이메일 중복 초대](#2-동일-이메일-중복-초대)
3. [동시 초대 수락 요청](#3-동시-초대-수락-요청)
4. [멤버 권한과 JWT 동기화](#4-멤버-권한과-jwt-동기화)
5. [운영 시간 우선순위 충돌](#5-운영-시간-우선순위-충돌)
6. [상담실 삭제 시 기존 예약 처리](#6-상담실-삭제-시-기존-예약-처리)
7. [센터 코드 충돌](#7-센터-코드-충돌)
8. [멤버 effective_to 시간 기반 접근 제어](#8-멤버-effective_to-시간-기반-접근-제어)
9. [역할 변경과 권한 처리](#9-역할-변경과-권한-처리)
10. [마지막 관리자 제거](#10-마지막-관리자-제거)

---

## 1. 초대 만료 처리

### 상황
초대 만료 후 사용자가 가입 시도

### 결정
**옵션 A: 만료 초대 엄격 차단 (재초대 필요)**

### 근거
- 보안 강화 (오래된 초대 악용 방지)
- 관리자가 초대 상태 명확히 제어
- 만료 시 새 초대 요청 필요

---

## 2. 동일 이메일 중복 초대

### 상황
동일 이메일로 대기 중인 초대가 있을 때 재초대 시도

### 결정
**옵션 D: 자동 덮어쓰기 (Upsert)**

### 근거
- 단일 API 호출로 처리 (기존 초대 취소 + 재초대 불필요)
- 항상 최신 초대 정보 유지
- 중복 데이터 없음
- UX 단순 (재초대 = 그냥 다시 초대)

### 구현
```sql
-- center_id + email에 unique 제약조건 (대기 중인 초대만)
CREATE UNIQUE INDEX idx_invitation_pending_email
ON member_invitations (center_id, email)
WHERE accepted_at IS NULL;
```

```python
# Handler에서 upsert 처리
existing = await invitation_repo.get_pending_by_email_and_center(email, center_id)
if existing:
    # UPDATE: role_id, employment_type, expires_at 갱신
    await invitation_repo.update(existing.id, {
        "role_id": data.role_id,
        "employment_type": data.employment_type,
        "expires_at": datetime.now() + timedelta(days=7)
    })
else:
    # INSERT: 새 초대 생성
    await invitation_repo.create({...})
```

---

## 3. 동시 초대 수락 요청

### 상황
동일 초대로 여러 탭/디바이스에서 동시 가입 시도

### 결정
**옵션 C: 낙관적 잠금 (accepted_at 확인)**

### 근거
- FOR UPDATE 잠금 대비 성능 우수
- 실제 동시 수락은 드문 케이스
- accepted_at 확인으로 충분히 방어 가능

### 구현
```python
async def join_center_handler(...):
    # 1. 초대 조회
    invitation = await invitation_repo.get_by_email_and_center(email, center_id)

    # 2. 이미 수락됨 확인
    if invitation.accepted_at:
        raise HTTPException(400, "Invitation already accepted")

    # 3. Member 생성 + 초대 수락 (동시에)
    # Unique 제약조건 (center_id + person_id)이 최종 방어선
    await member_repo.create({...})
    await invitation_repo.update(invitation.id, {"accepted_at": now()})
```

---

## 4. 멤버 권한과 JWT 동기화

### 상황
센터 관리자가 멤버 권한 변경 → 멤버의 기존 JWT와 불일치

### 결정
**Auth 도메인에서 결정 예정**

### 참고
- `/docs/auth/edge-cases.md` 참조

---

## 5. 운영 시간 우선순위 충돌

> **TODO**: 도메인 구조 고민 중

---

## 6. 상담실 삭제 시 기존 예약 처리

### 상황
미래 예약이 있는 상담실 삭제 시도

### 결정
**옵션 B: 경고 표시 후 삭제 허용 (requires_confirmation 반환)**

### 근거
- 관리자가 상황을 인지한 후 결정 가능
- 기존 예약 데이터는 유지 (room_id 참조는 남음)
- 비활성화(is_active=false) 권장으로 유도
- 삭제 시에도 기존 일정의 상담실 정보 조회 불가 경고

### 구현
```python
async def delete_room_handler(room_id: str, confirmed: bool = False, ...):
    # 1. 미래 예약 확인
    future_schedules = await schedule_repo.get_future_by_room(room_id)

    # 2. 미래 예약이 있고, 확인되지 않은 경우 경고 반환
    if future_schedules and not confirmed:
        return {
            "requires_confirmation": True,
            "warning": {
                "message": "이 상담실은 현재 일정에 사용되고 있어요",
                "description": "삭제하면 기존 일정에서 상담실 정보가 사라질 수 있어요. 기존 일정을 유지하려면 상담실을 비활성화 해주세요",
                "upcoming_count": len(future_schedules)
            }
        }

    # 3. Soft Delete (확인 후 또는 미래 예약 없을 때)
    await room_repo.update(room_id, {"deleted_at": now()})
```

### 삭제 vs 비활성화 비교

| 방식 | 기존 예약 | 신규 예약 | 목록 표시 | 용도 |
|------|----------|----------|----------|------|
| **삭제** (deleted_at) | room_id 참조 유지, 상담실 정보 조회 불가 | 불가 | 미표시 | 완전 제거 |
| **비활성화** (is_active=false) | 유지 + 상담실 정보 조회 가능 | 불가 | 표시 (비활성 상태) | 일시 중단 |

---

## 7. 센터 코드 충돌

### 상황
센터 생성 시 랜덤 코드 충돌

### 결정
**옵션 A + B: Unique 제약 + 자동 재시도 + 시퀀스 기반 보안 강화**

### 근거
- 랜덤 코드로 예측 불가능성 확보 (보안)
- Unique 제약조건으로 최종 보장
- 재시도로 충돌 해결

### 구현
```python
import secrets
import string

class GenerateCenterCodeService:
    MAX_RETRIES = 5

    def _generate_code(self) -> str:
        """8자리 랜덤 코드 생성 (대문자 + 숫자, 혼동 문자 제외)"""
        # O, 0, I, 1 제외 (혼동 방지)
        alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        return ''.join(secrets.choice(alphabet) for _ in range(8))

    async def execute(self, repo: CenterRepository) -> str:
        for attempt in range(self.MAX_RETRIES):
            code = self._generate_code()
            existing = await repo.get_by_code(code)
            if not existing:
                return code

        raise RuntimeError("Failed to generate unique center code")
```

```sql
-- DB 제약조건
ALTER TABLE centers ADD CONSTRAINT centers_code_unique UNIQUE (code);
```

---

## 8. 멤버 effective_to 시간 기반 접근 제어

### 상황
effective_to 설정된 멤버가 해당 시점 이후 API 요청

### 결정
**옵션 A + C: API 요청 시 확인 + JWT 만료 시 자연 차단**

### 근거
- API 요청 시 정확한 시점 차단 (A)
- JWT 재발급 시 추가 확인으로 보강 (C)
- 배치 작업 불필요

### 구현
```python
# app/core/dependencies.py
async def get_current_auth_with_member_check(token: str, session: AsyncSession):
    payload = decode_access_token(token)

    if payload.get("center_id"):
        now = datetime.now(timezone.utc)

        # 활성 멤버 조회 (시간 기반)
        member = await member_repo.get_active_at_time(
            person_id=payload["person_id"],
            center_id=payload["center_id"],
            at_time=now
        )

        if not member:
            raise HTTPException(403, "Your membership has expired")

    return AuthContext(**payload)
```

---

## 9. 역할 변경과 권한 처리

### 상황
멤버 역할 변경 시 기존 커스텀 권한 처리

### 결정
**옵션 B: 역할 변경 시 권한도 새 역할 기본값으로 재설정**

### 근거
- 역할에 맞는 권한 자동 적용
- 이전 역할의 불필요한 권한 잔존 방지
- 관리자 의도가 명확 (역할 = 권한 세트)

### 구현
```python
async def update_member_handler(member_id: str, data: MemberUpdate, ...):
    update_data = data.model_dump(exclude_unset=True)

    # 역할 변경 시 권한도 새 역할 기본값으로 재설정
    if data.role_id:
        role = await role_repo.get(data.role_id)
        role_permissions = await role_repo.get_permissions(role.id)
        update_data["permissions"] = [p.code for p in role_permissions]

    await member_repo.update(member_id, update_data)
```

---

## 10. 마지막 관리자 제거

### 상황
센터의 유일한 관리자 권한 제거 또는 퇴사 처리 시도

### 결정
**옵션 A: 차단 (최소 1명 관리자 유지 필수) + 센터 삭제 유도**

### 근거
- 관리자 없는 센터 방지
- 센터 운영 불가 상태 예방
- 정말 필요하면 센터 삭제/비활성화로 유도

### 구현
```python
async def update_member_handler(member_id: str, data: MemberUpdate, ...):
    member = await member_repo.get(member_id)

    # 관리자 역할에서 다른 역할로 변경 시
    if data.role_id and is_admin_role(member.role_id) and not is_admin_role(data.role_id):
        admin_count = await member_repo.count_admins(member.center_id)
        if admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Cannot remove the last administrator",
                    "action": "Assign another administrator first, or deactivate the center"
                }
            )

    # effective_to 설정 (퇴사 처리) 시에도 동일 체크
    if data.effective_to and is_admin_role(member.role_id):
        admin_count = await member_repo.count_active_admins(member.center_id)
        if admin_count <= 1:
            raise HTTPException(400, "Cannot remove the last administrator")
```

---

## 기본 엣지 케이스

| # | 엣지 케이스 | HTTP 코드 | 설명 |
|---|------------|----------|------|
| 1 | 존재하지 않는 센터 코드 | 404 | 센터 가입 시 코드 검증 |
| 2 | 이미 수락된 초대 | 400 | accepted_at 확인 |
| 3 | 초대 없이 가입 시도 | 400 | 이메일로 초대 조회 |
| 4 | 이미 센터 멤버 | 409 | 중복 멤버 확인 |
| 5 | 존재하지 않는 역할 | 400 | role_id FK 검증 |
| 6 | 유효하지 않은 권한 코드 | 400 | permissions 테이블 확인 |
| 7 | 삭제된 센터 접근 | 403 | deleted_at 확인 |
| 8 | 비활성 상담실 예약 | 400 | is_active 확인 |
| 9 | 잘못된 weekday 값 | 422 | enum 검증 |
| 10 | 시간 범위 오류 | 400 | start_time < end_time |

---

## 참고 문서

- **메인 도메인**: `/docs/center/domain.md`
- **시나리오**: `/docs/center/scenarios.md`
- **의사결정 기록**: `/docs/center/decision-log.md`
- **Auth 엣지 케이스**: `/docs/auth/edge-cases.md`
