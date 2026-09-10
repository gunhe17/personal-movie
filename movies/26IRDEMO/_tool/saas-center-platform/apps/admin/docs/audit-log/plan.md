# 어드민 감사 로그 (Audit Log) - 구현 플랜

> 플랫폼 어드민 계정들의 활동 이력을 기록하고 조회하는 기능.
> 기존 `activity_log` 모듈(센터 내부 사용자용)과 **완전히 분리된 별도 도메인**.

---

## 도메인 분리 근거

| 구분 | 기존 `activity_log` | 어드민 `audit_log` |
|-----|--------------------|--------------------|
| 행위자 | 센터 직원 (member) | 플랫폼 어드민 계정 |
| 테넌트 | center_id 기준 (멀티테넌트) | platform-wide (단일) |
| 대상 | 검사/상담/일정 등 센터 도메인 | 센터 관리, 계정 관리, 공지, 검사도구 등 |
| 엔드포인트 | `/centers/{id}/activity-logs` | `/admin/audit-logs` |
| 위치 | `app/modules/activity_log/` | `app/modules/platform_admin/audit_log/` |

---

## 백엔드 설계

### 모듈 위치

```
app/modules/platform_admin/
└── audit_log/
    ├── __init__.py
    ├── models.py
    ├── repository.py
    ├── schemas.py
    ├── router.py
    ├── dependencies.py    ← AuditLogger Dependency
    └── handlers/
        ├── __init__.py
        └── list_audit_logs.py
```

> Facade 없음 — 조회 전용 단순 모듈

### 모델 설계

```python
class AdminAuditLog(BaseModel):
    __tablename__ = "admin_audit_logs"

    admin_account_id: str    # 행위자 어드민 ID
    admin_email: str         # 행위자 이메일 (비정규화, JOIN 방지)
    action: str              # "center_application.approved"
    target_type: str         # "center_application", "admin_account" 등
    target_id: str           # 대상 UUID
    summary: str             # 사람이 읽을 수 있는 요약
    ip_address: str | None
    extra: dict | None       # JSONB: 변경 상세 (선택적)
    # created_at → BaseModel 상속
```

**설계 원칙**: append-only (INSERT만, UPDATE/DELETE 금지)

### AuditLogger Dependency

Handler마다 `audit.log(summary=...)` 한 줄만 추가하면 되도록 설계.
`admin_account_id`, `ip_address` 등 공통 필드는 Dependency가 자동으로 채움.

```python
# dependencies.py

class AuditLogger:
    def __init__(self, request: Request, current_admin: dict, uow: UnitOfWork):
        self._request = request
        self._admin = current_admin
        self._uow = uow

    async def log(
        self,
        action: str,           # "center_application.approved"
        target_type: str,      # "center_application"
        target_id: str,        # UUID
        summary: str,          # "센터 신청 '행복상담센터' 승인"
        extra: dict | None = None,
    ) -> None:
        repo = AdminAuditLogRepository(self._uow._session)
        await repo.create(
            admin_account_id=self._admin["admin_account_id"],
            admin_email=self._admin["email"],
            action=action,
            target_type=target_type,
            target_id=target_id,
            summary=summary,
            ip_address=self._request.client.host if self._request.client else None,
            extra=extra,
        )


async def get_audit_logger(
    request: Request,
    current_admin: dict = Depends(get_current_admin),
    uow: UnitOfWork = Depends(get_uow),
) -> AuditLogger:
    return AuditLogger(request, current_admin, uow)
```

### Handler 적용 패턴

```python
# Router에서 Depends 주입
@router.post("/{application_id}/approve")
async def approve_application(
    application_id: str,
    uow: UnitOfWork = Depends(get_uow),
    audit: AuditLogger = Depends(get_audit_logger),   # 추가
    background_tasks: BackgroundTasks,
):
    return await approve_admin_application_handler(
        application_id, uow, audit, background_tasks
    )

# Handler에서 summary 한 줄만 작성
async def approve_admin_application_handler(
    application_id: str,
    uow: UnitOfWork,
    audit: AuditLogger,
    background_tasks: BackgroundTasks,
) -> dict:
    async with uow:
        result = await approve_center_application_app_handler(...)

        await audit.log(
            action="center_application.approved",
            target_type="center_application",
            target_id=application_id,
            summary="센터 신청 승인",
        )
        await uow.commit()
    return result
```

**핵심**: Handler는 `summary` 한 줄만. `admin_account_id`, `ip_address`는 자동.
같은 트랜잭션 안에서 기록 → 비즈니스 로직 실패 시 로그도 함께 롤백.

### 기록 대상 행위 목록

| 서브모듈 | action 값 | 설명 |
|---------|----------|-----|
| center_application | `center_application.approved` | 센터 신청 승인 |
| center_application | `center_application.rejected` | 센터 신청 반려 |
| account | `account.locked` | 센터 계정 잠금 |
| account | `account.unlocked` | 센터 계정 잠금 해제 |
| account | `account.force_logout` | 강제 로그아웃 |
| admin_account_management | `admin_account.invited` | 어드민 초대 |
| admin_account_management | `admin_account.locked` | 어드민 계정 잠금 |
| admin_account_management | `admin_account.unlocked` | 어드민 계정 잠금 해제 |
| admin_account_management | `admin_account.updated` | 어드민 계정 수정 |
| admin_account_management | `admin_account.deleted` | 어드민 계정 삭제 |
| assessment | `assessment.created` | 검사도구 등록 |
| assessment | `assessment.updated` | 검사도구 수정 |
| cs_memo | `cs_memo.created` | CS 메모 작성 |
| cs_memo | `cs_memo.updated` | CS 메모 수정 |
| cs_memo | `cs_memo.deleted` | CS 메모 삭제 |
| qna | `faq.created` / `faq.updated` / `faq.deleted` | FAQ 관리 |
| qna | `inquiry.answered` / `inquiry.deleted` | 문의 처리 |
| notice | `notice.created` / `notice.updated` / `notice.deleted` | 공지 관리 |
| voucher | `voucher.created` | 바우처 등록 |
| voucher | `voucher.updated` | 바우처 수정 |
| voucher | `voucher.deleted` | 바우처 삭제 (soft) |
| voucher | `voucher_document.created` | 바우처 자료 등록 |
| voucher | `voucher_document.updated` | 바우처 자료 수정 |
| voucher | `voucher_document.deleted` | 바우처 자료 삭제 (soft) |
| voucher | `voucher_document_link.created` | 바우처-자료 연결 |
| voucher | `voucher_document_link.deleted` | 바우처-자료 연결 해제 |
| subscription | `subscription.upgraded` | 구독 플랜 업그레이드 |
| subscription | `subscription.plan_changed` | 구독 플랜 변경 |
| subscription | `subscription.status_transitioned` | 구독 상태 전이 |
| subscription | `subscription.credit_adjusted` | 크레딧 수동 조정 |
| subscription | `subscription.downgrade_scheduled` | 다운그레이드 예약 |
| subscription | `subscription.downgrade_cancelled` | 다운그레이드 예약 취소 |
| subscription | `subscription.downgrade_force_applied` | 다운그레이드 즉시 적용 |
| subscription | `subscription.payment_cancelled` | 결제 취소/환불 |

> ⚠️ 로그인/로그아웃(`auth.login`, `auth.logout`) 포함 여부 결정 필요

### 조회 엔드포인트

```
GET /admin/audit-logs
  ?action=         # 행위 필터 (예: "center_application.approved")
  &target_type=    # 대상 타입 필터
  &admin_id=       # 특정 어드민 필터
  &date_from=      # 기간 시작 (UTC)
  &date_to=        # 기간 종료 (UTC)
  &page=1
  &size=20
```

---

## 프론트엔드 설계

### 라우트

```
src/routes/(protected)/
└── audit-logs/
    └── +page.svelte
```

### Feature 구조

```
src/lib/features/audit-log/
├── constants.ts          # action 레이블/색상 매핑
└── hooks.svelte.ts       # URL 동기화 필터 상태
```

### 페이지 레이아웃

```
┌─────────────────────────────────────────────┐
│ PageHeader "감사 로그"  · 총 N건             │
├─────────────────────────────────────────────┤
│ [액션 ▼] [대상 타입 ▼] [어드민 ▼]           │
│ [날짜 시작] ~ [날짜 끝]  [↻ 초기화]          │
├─────────────────────────────────────────────┤
│ 일시 | 어드민 | 액션 | 내용 | IP             │
├─────────────────────────────────────────────┤
│ Pagination                                  │
└─────────────────────────────────────────────┘
```

### 테이블 컬럼

| 컬럼 | 필드 | 표시 방법 |
|-----|-----|---------|
| 일시 | `created_at` | `YYYY.MM.DD HH:mm:ss` |
| 어드민 | `admin_email` | 이메일 텍스트 |
| 액션 | `action` | 뱃지 + 색상 |
| 내용 | `summary` | 텍스트 |
| IP | `ip_address` | 코드 스타일 |

### action 색상 규칙 (constants.ts)

```typescript
// action 접미사 기준으로 색상 결정
// *.approved / *.created / *.invited → green
// *.updated / *.answered             → blue
// *.rejected / *.deleted             → red
// *.locked / *.force_logout          → orange
// *.unlocked                         → gray
```

---

## 구현 순서

### Phase 1 — 백엔드

1. `admin_audit_logs` 테이블 마이그레이션
2. `AdminAuditLog` 모델 + Repository + Schema
3. `AuditLogger` Dependency 구현 (`dependencies.py`)
4. 기존 Handler에 `audit: AuditLogger` 파라미터 + `audit.log()` 추가
   - 일부 Handler는 `current_admin` 파라미터 자체가 없음 → 이번에 함께 정리
5. `GET /admin/audit-logs` 조회 엔드포인트
6. `router.py`에 audit_log 라우터 등록

### Phase 2 — 프론트엔드

1. `audit-log.action.ts` 작성 ✅
2. `audit-logs/+page.svelte` 구현 ✅
3. 사이드바 메뉴 추가 (`super_admin` 전용) ✅

---

## 미결 사항

- [ ] 로그인/로그아웃도 audit log에 포함할지 여부 - 포함하는게 좋겠지?
- [ ] 로그 보존 기간 정책 (DB 파티셔닝 or TTL) - 일단 계속 보존하면 사이드이펙트는?
- [ ] `extra` 필드에 변경 전/후 값 기록 여부 (일부 행위만 선택적으로) - 그럼 너무 작업이 많아지지 않는가?

### 결정 사항

- [x] **로그인/로그아웃 포함** — `auth.login`, `auth.login_failed`, `auth.logout` 기록. 단, `AuditLogger` Dependency 사용 불가(인증 전 시점)이므로 Handler에서 Repository 직접 호출로 기록
- [x] **로그 무한 보존** — 현재 단계에서 유지. 수백만 건 이상 시 파티셔닝 검토
- [x] **`extra` 필드는 Phase 2** — 지금은 `summary`로 충분. 특정 행위에만 선택적으로 나중에 추가
