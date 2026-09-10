# 계층 10 — Behavior / Server 설계 `[설계완료]`

정본 rule: [behavior.md](../../rules/api/behavior.md) · [server.md](../../rules/api/server.md). 상위: [convention-design.md](../convention-design.md).

**전제 정정: DSL 재설계는 이미 구현 완료(2026-06-26, 메모리 [behavior-dsl-redesign]).** MEMORY.md 포인터가 "미착수"로 stale해 오도했으나 실제 코드(`behavior/dsl.py`·`server.py`) + 메모리 본문이 완료 확인 → **정정함**. `behavior.request`가 `transactional_uow`로 커밋 소유(server.py:123). 그래서 그동안 "계층 10 결합"으로 deferred였던 정리가 **해금**됨. survey + grep 교차검증(survey `audit()` "0" → **grep 61** 정정).

## 10-1. tx 래퍼 제거 ~500 `[설계완료 — behavioral, 테스트 동반]`
- legacy self-commit 래퍼(`async with uow: ... await uow.commit()`): **application/handlers 160 + module handlers 343 = ~500**.
- behavior.request가 이미 커밋 소유 → 핸들러 self-commit은 **dead code**(`UnitOfWork` 재진입 안전하나 잉여).
- **6-1 정정**: "163"은 application만 — module handler 343 추가로 **~500**(대폭 확대).
- 제거: `async with uow:` unwrap + `await uow.commit()` 삭제 → handler tx-free([service.md](../../rules/api/service.md) §7).
- **behavioral**: 커밋 제거라 "behavior가 실제 커밋하는가" characterization 필요. **BG 본문**(`AsyncSessionLocal()`, 9곳)은 **keeper**(application.md §3 carve-out — 요청 tx 닫힌 뒤 자기 세션).

## 10-2. admin flow 이관 ~92 routes `[설계완료 — behavioral]`
현 admin 라우트 대부분이 레거시 3형태 (신 `request_admin`은 center_application 4개뿐):

| 레거시 | 수 | → 신 |
|---|--:|---|
| `request_unscoped(authenticate_admin(), audit())` | **61** | `request_admin(authenticate_admin(), require_role(*), start_event_group(), dispatch_events())` + handler `emit(actor_type="admin")` |
| `Depends(get_current_admin)` | 23 (8파일) | `request_admin(authenticate_admin(), require_role(*))` |
| `Depends(get_uow)` (messaging admin) | 8 | `request_admin(...)` |
| **`dependencies=[require_admin_role(*ADMIN_PLUS)]`** (route-dep 역할체크) | **49** | `request_admin`의 **`require_role(*)` action으로 흡수** (별도 dep 제거) |

- **예외 sweep 정정(2026-07-04)**: 원래 "3형태 ~92"는 **role-dep 49를 놓쳤음.** 실제는 한 엔드포인트에 **인증이 최대 3겹 스택**(예: [credential/router.py:55-70](../../../apps/api/app/modules/platform_admin/credential/router.py#L55) = `require_admin_role` dep + `Depends(get_current_admin)` + `behavior.request_unscoped(authenticate_admin(), audit())` 동시). 마이그레이션 = "형태 교체"가 아니라 **3겹 언탱글** — role-dep→`require_role` action, get_current_admin·authenticate_admin 중복→하나로. 실측 규모 92→~140.

- **`audit()` → `emit(actor_type="admin")`**: 레거시 AuditLogger 경로 → event_atomics 감사([eventing.md](../../rules/api/eventing.md) §10, atomic이 audit 정본). behavioral(감사 경로 변경).
- **survey 오판 정정**: "audit() 0" → grep 검증 **61**(multi-line `authenticate_admin(),\n audit()` 선언 놓침).
- **7-3 정정**: "admin auth 23"은 get_current_admin만 — audit() 61 + get_uow 8 추가로 **~92**.
- 분포: platform_admin 12모듈 + ai_lab + subscription.

## 10-3b. 라우터 본문 tx 래퍼 (예외 sweep 2026-07-04) `[설계완료]`
핸들러가 아니라 **라우터 엔드포인트 본문에** `async with ctx.uow: ... commit()` — 2곳([auth/router.py:123](../../../apps/api/app/modules/auth/router.py#L123)·[center_application/router.py:67](../../../apps/api/app/modules/center/center_application/router.py#L67)). 10-1(핸들러 tx ~500)과 **다른 위치** — 라우터는 thin해야 하니 핸들러로 이관.
- **center_application `temp_admin_id` 하드코딩 = 미완 마이그레이션·실버그**([router.py:66,82](../../../apps/api/app/modules/center/center_application/router.py#L66) `reviewer_person_id = "temp_admin_id"` + `# TODO: JWT에서 추출`) → 설계 정리와 별개로 **즉시 수정 후보**(JWT에서 실제 admin id 추출).

## 10-3. 정합 (무변경)
- **action 선언 순서 canonical**(start_event_group→authenticate→require_membership→require_permission→require_feature→dispatch_events) — **0 위반**.
- flow 5종(request 339·request_unscoped 208·request_admin 4·stream 5·stream_unscoped stub 0) 일관.
- `get_aow`(agent SSE/WS, 5)·BG `AsyncSessionLocal`(9)·`get_audit_logger` 0 — keeper/정합.

---

## 실행 워크리스트 (계층 10)

| 작업 | 대상 | 파괴성 |
|------|------|:-----:|
| tx 래퍼 제거 | ~500 handler(`async with uow`+`commit` 삭제) | **behavioral**(커밋 characterization) |
| admin → request_admin + emit(actor=admin) | **~140** routes 3겹 언탱글(61 audit()+23 get_current_admin+8 get_uow+**49 require_admin_role dep**) | **behavioral**(감사 경로) |
| 라우터 본문 tx 래퍼 → handler | auth·center_application 2 (+ temp_admin_id 하드코딩 수정) | behavioral |
| get_aow·BG session·stream keeper | 14 | 무변경 |
| rule | behavior.md audit()=deprecated 명시, admin=request_admin 정본 | 문서 |

## 리플 (계층 종결)
- **6-1 종결**: tx 래퍼 163→실측 ~500 제거(behavior 커밋 소유 확인 후).
- **7-3 종결**: admin auth 23→~92 이관.
- **8 crossover**: `audit()`→`emit(actor_type=admin)`은 eventing §10 admin-audit 이관과 동일 슬라이스.
- **실행 순서**: 계층 10은 DSL 완료로 **지금 착수 가능** — 2단 계획의 "꼬리"가 아니라 독립 실행 가능(behavior가 이미 커밋). 단 behavioral이라 characterization 테스트 동반.
