# 구독 관리 (Subscription Management) - 구현 플랜

> 플랫폼 어드민에서 센터별 구독/결제/크레딧을 관리하는 기능.

---

## Phase 구분

| Phase | 범위 | 상태 |
|-------|------|------|
| **P0** | 기본 CRUD + 상태 전이 + 다운그레이드 예약 + 결제 관리 | ✅ 완료 |
| **P1** | 감사 로그 + 대시보드 고도화 (MRR 추이, 이탈률, 플랜별 매출) | ✅ 완료 |
| **P2** | 보안 강화 + 알림 시스템 + 결제 자동화 | ⏳ 미구현 |

---

## P0 — 기본 구독 관리 (완료)

### 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/admin/subscriptions` | 구독 목록 (필터: plan, status, search, has_scheduled_downgrade) |
| GET | `/admin/subscriptions/stats` | 구독 통계 (플랜 분포, 쿼터 초과, 이탈률) |
| GET | `/admin/subscriptions/usage-overview` | AI 사용량 종합 (플랜 분포, TOP N, 기능별 사용량) |
| GET | `/admin/subscriptions/{center_id}` | 구독 상세 (구독 + 크레딧 + 변경 이력) |
| POST | `/admin/subscriptions/{center_id}/change-plan` | 플랜 변경 |
| POST | `/admin/subscriptions/{center_id}/upgrade` | 플랜 업그레이드 |
| POST | `/admin/subscriptions/{center_id}/transition-status` | 상태 전이 (active↔expired↔cancelled) |
| POST | `/admin/subscriptions/{center_id}/adjust-credit` | 크레딧 수동 조정 (add/reset) |
| POST | `/admin/subscriptions/{center_id}/schedule-downgrade` | 다운그레이드 예약 |
| DELETE | `/admin/subscriptions/{center_id}/scheduled-downgrade` | 다운그레이드 예약 취소 |
| POST | `/admin/subscriptions/{center_id}/force-apply-downgrade` | 다운그레이드 즉시 적용 |
| GET | `/admin/subscriptions/{center_id}/payments` | 결제 내역 조회 |
| POST | `/admin/subscriptions/{center_id}/cancel-payment` | 결제 취소/환불 |
| GET | `/admin/subscriptions/payment-failures` | 결제 실패 목록 |
| GET | `/admin/subscriptions/payment-stats` | 결제 통계 (MRR, 실패 건수, 플랜별 매출) |

### 프론트엔드 페이지

| 라우트 | 설명 |
|--------|------|
| `/subscription/dashboard` | 구독 대시보드 (KPI + 차트 + TOP N) |
| `/subscription/list` | 구독 목록 (필터링 + 테이블) |
| `/subscription/manage/{center_id}` | 구독 상세/관리 |

### 상태 전이 규칙 (State Machine)

```
trial → active (결제 확인 시)
active → expired (기간 만료 / 관리자 조치)
active → cancelled (해지 요청)
expired → active (재결제 / 관리자 복원)
cancelled → active (관리자 복원)
```

- `force: true` 옵션으로 비표준 전이 가능 (관리자 전용)

### 다운그레이드 예약

- 업그레이드: 즉시 적용 (결제 후)
- 다운그레이드: 현재 기간 만료 시 적용 (예약 방식)
- `reserved_plan`, `reserved_at` 필드로 예약 상태 관리
- 관리자는 예약 등록/취소/즉시 적용 가능

---

## P1 — 운영 강화 (완료)

### P1-1: 감사 로그 (Audit Logging)

구독 관련 admin write 핸들러 8개에 `AuditLogger` 주입 완료.

| 핸들러 | action | summary |
|--------|--------|---------|
| `change_plan.py` | `subscription.plan_changed` | 구독 플랜 변경 |
| `upgrade_plan.py` | `subscription.upgraded` | 구독 플랜 업그레이드 |
| `transition_status.py` | `subscription.status_transitioned` | 구독 상태 전이 |
| `adjust_credit.py` | `subscription.credit_adjusted` | 크레딧 수동 조정 |
| `admin_schedule_downgrade.py` | `subscription.downgrade_scheduled` | 다운그레이드 예약 |
| `admin_cancel_downgrade.py` | `subscription.downgrade_cancelled` | 다운그레이드 예약 취소 |
| `admin_force_apply_downgrade.py` | `subscription.downgrade_force_applied` | 다운그레이드 즉시 적용 |
| `admin_cancel_payment.py` | `subscription.payment_cancelled` | 결제 취소/환불 |

**패턴**: Router에서 `audit: AuditLogger = Depends(get_audit_logger)` → Handler에서 `audit.log()` → `uow.commit()` (같은 트랜잭션)

### P1-2: 대시보드 고도화

#### P1-2a: MRR 추이 API

| 항목 | 내용 |
|------|------|
| 엔드포인트 | `GET /admin/subscriptions/mrr-trend?months=6` |
| 응답 | `MrrTrendResponse { items: MrrTrendItem[] }` |
| MrrTrendItem | `{ year, month, mrr, confirmed_count }` |
| Repository | `SubscriptionPaymentRepository.get_monthly_revenue(months)` |
| Facade | `SubscriptionFacade.get_mrr_trend(months)` |

#### P1-2b: 통계 확장

**SubscriptionStatsResponse 추가 필드:**
- `churn_rate: float` — 이탈률 (%) = (이번 달 이탈 수 / 전체) × 100
- `churned_count: int` — 이번 달 이탈 건수 (expired/cancelled 전이)

**PaymentStatsResponse 추가 필드:**
- `revenue_by_plan: dict[str, int]` — 플랜별 confirmed 결제 금액

**Repository 추가 메서드:**
- `SubscriptionHistoryRepository.count_churned_this_month()` — expired/cancelled 전이 건수
- `SubscriptionPaymentRepository.sum_confirmed_by_plan(year, month)` — 플랜별 매출 집계

#### P1-2c: 프론트엔드 대시보드

**신규 컴포넌트:**
- `MrrTrendChart.svelte` — Canvas 기반 라인 차트 (requestAnimationFrame 애니메이션)

**대시보드 변경:**
- KPI 그리드 5열 → 6열: **이탈률** 카드 추가 (churn_rate > 5% 시 빨간색 경고)
- **MRR 추이** 섹션 추가 (col-span-3, 최근 6개월 라인 차트)
- **플랜별 매출** 섹션 추가 (col-span-2, 수평 바 차트 + 합계)

---

## P2 — 보안 + 알림 + 자동화 (미구현)

> ⚠️ admin route 외부 변경이 필요하여 P1에서 구현하지 않고 플래그함.
> 아래 항목들은 `apps/api/app/modules/subscription/` 내 admin route 외 코드 수정 필요.

### P2-1: 보안 강화 (CRITICAL — 우선 처리 권장)

#### 1. 내부 엔드포인트 인증

- **현황**: `POST /internal/subscriptions/process-expirations`에 인증 없음
- **위험**: 외부에서 직접 호출 시 구독 만료 처리가 임의로 실행될 수 있음
- **필요 조치**: `X-Internal-Secret` 헤더 검증 Dependency 추가
- **수정 파일**:
  - `router.py` (internal_router 부분)
  - `config.py` (INTERNAL_SECRET 환경변수)
  - 신규 `internal_auth.py` (Dependency)

#### 2. 토스 웹훅 서명 검증

- **현황**: `POST /webhooks/toss/payment`에 HMAC 서명 검증 없음
- **위험**: 위조된 웹훅으로 결제 상태 조작 가능
- **필요 조치**: Toss 웹훅 시크릿으로 HMAC-SHA256 서명 검증
- **수정 파일**:
  - `router.py` (webhook 엔드포인트)
  - `config.py` (TOSS_WEBHOOK_SECRET 환경변수)
  - 신규 `webhook_verify.py` (서명 검증 로직)

### P2-2: 알림 시스템

#### 3. 결제 실패 알림

- **현황**: 결제 실패 시 센터 관리자에게 알림 없음
- **인프라**: `EmailService`, `AlarmtalkService` 구현 완료 상태
- **필요 조치**: `toss_webhook_handler`에서 실패 시 `BackgroundTasks`로 알림 발송
- **수정 파일**: `handlers/toss_webhook.py`

#### 4. 만료 경고 알림

- **현황**: 구독 만료 7일 전 사전 알림 없음
- **인프라**: APScheduler 스케줄러 인프라 존재
- **필요 조치**:
  - Repository에 `list_expiring_soon(days=7)` 메서드 추가
  - 스케줄러 잡 등록 (매일 실행)
  - 알림 발송 로직

#### 5. 쿼터 초과 알림

- **현황**: 크레딧 한도 초과 시 알림 없음
- **필요 조치**: AI 크레딧 차감 로직에서 한도 초과 시 알림 트리거

### P2-3: 결제 자동화

#### 6. 결제 재시도

- **현황**: 결제 실패 시 자동 재시도 없음
- **필요 조치**: 실패 후 24h/48h/72h 재시도 스케줄러

#### 7. 구독 자동 갱신

- **현황**: 기간 만료 시 자동 갱신 로직 없음
- **필요 조치**: 만료 전 자동 결제 요청 → 성공 시 기간 연장

---

## 수정 파일 목록

### P1 수정 파일 (완료)

| 파일 | 변경 내용 |
|------|-----------|
| `apps/api/.../subscription/router.py` | AuditLogger import + 8개 엔드포인트 audit 주입 + GET /mrr-trend |
| `apps/api/.../subscription/handlers/change_plan.py` | audit 파라미터 + audit.log() |
| `apps/api/.../subscription/handlers/upgrade_plan.py` | audit 파라미터 + audit.log() |
| `apps/api/.../subscription/handlers/transition_status.py` | audit 파라미터 + audit.log() |
| `apps/api/.../subscription/handlers/adjust_credit.py` | audit 파라미터 + audit.log() |
| `apps/api/.../subscription/handlers/admin_schedule_downgrade.py` | audit 파라미터 + audit.log() |
| `apps/api/.../subscription/handlers/admin_cancel_downgrade.py` | audit 파라미터 + audit.log() |
| `apps/api/.../subscription/handlers/admin_force_apply_downgrade.py` | audit 파라미터 + audit.log() |
| `apps/api/.../subscription/handlers/admin_cancel_payment.py` | audit 파라미터 + audit.log() |
| `apps/api/.../subscription/handlers/__init__.py` | mrr_trend_handler 추가 |
| `apps/api/.../subscription/handlers/mrr_trend.py` | 신규 — MRR 추이 핸들러 |
| `apps/api/.../subscription/schemas.py` | MrrTrendItem/Response + stats 확장 |
| `apps/api/.../subscription/repository.py` | get_monthly_revenue, count_churned, sum_by_plan |
| `apps/api/.../subscription/facade/subscription_facade.py` | get_mrr_trend + stats 확장 |
| `apps/admin/.../actions/subscription.action.ts` | MrrTrend 타입/액션 + stats 타입 확장 |
| `apps/admin/.../subscription/components/MrrTrendChart.svelte` | 신규 — Canvas 라인 차트 |
| `apps/admin/.../subscription/dashboard/+page.svelte` | MRR 차트 + 이탈률 KPI + 플랜별 매출 |
| `apps/admin/docs/audit-log/plan.md` | subscription 감사 행위 8개 추가 |

### P2 수정 예정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `apps/api/.../subscription/router.py` | internal_router 인증 + webhook 서명 검증 |
| `apps/api/app/core/config.py` | INTERNAL_SECRET, TOSS_WEBHOOK_SECRET |
| `apps/api/.../subscription/handlers/toss_webhook.py` | 결제 실패 알림 발송 |
| 신규: `internal_auth.py` | 내부 엔드포인트 인증 Dependency |
| 신규: `webhook_verify.py` | 토스 웹훅 HMAC 검증 |
| `apps/api/.../subscription/repository.py` | list_expiring_soon() |
| 스케줄러 잡 파일 | 만료 경고 + 결제 재시도 |

---

## 프론트엔드 컴포넌트 구조

```
src/lib/features/subscription/
├── constants.ts              # PLAN_LABELS, PLAN_KEYS, PLAN_CHART_COLORS 등
├── components/
│   ├── PlanBadge.svelte      # 플랜 뱃지 (free/starter/pro/enterprise)
│   ├── DonutChart.svelte     # 도넛 차트 (플랜 분포)
│   ├── PlanLegend.svelte     # 플랜 범례
│   └── MrrTrendChart.svelte  # MRR 추이 라인 차트 (Canvas)
```

### MrrTrendChart 사용법

```svelte
<script>
  import MrrTrendChart from '$lib/features/subscription/components/MrrTrendChart.svelte'
  import type { MrrTrendItem } from '$hooks/actions/subscription.action'

  let items: MrrTrendItem[] = [
    { year: 2026, month: 1, mrr: 500000, confirmed_count: 5 },
    { year: 2026, month: 2, mrr: 750000, confirmed_count: 7 },
    // ...
  ]
</script>

<MrrTrendChart {items} height={200} />
```

- Canvas 기반, DPR 대응
- 800ms ease-out 애니메이션
- Y축 자동 스케일링 (K/M 포맷)
- 컨테이너 너비에 반응형 대응
