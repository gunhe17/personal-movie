# behavior 전환 — 모듈 순회 loop

전 모듈을 behavior 패턴(`server.use_*` flow + tx-free handler)으로 전환하는 **모듈 단위 loop**. 레이어 통일 loop([api-refactor.md](api-refactor.md))과 별개 — 이쪽은 인증·tx 배선 전환 + 그 김에 레이어 위반 정리.

정본 규칙: [behavior.md](../rules/api/behavior.md)(flow·Context·scope) · [eventing.md](../rules/api/eventing.md)(이벤트, 인프라 라이브 후) · 레퍼런스 실코드 `app/behavior`·`app/worker/event`. 결정 이력 메모리 `behavior-event-migration`.

## 목표 · 완료 정의

- **목표**: 전 모듈 라우터를 behavior flow(`server.use_*`)로 전환 — **인증·tx를 flow가 소유, handler는 tx-free**. (이벤트 `emit`은 인프라 라이브 후 event-pass = 별도 phase, 지금 안 함.)
- **모듈 완료**: router가 `use_*`만(레거시 `current_*`/`get_uow` 0) + 단독 핸들러 명시 commit 제거 + import·boot·**라이브 smoke**(401/403/422/200, 500 아님) 통과 + 모듈당 커밋 + 체크박스·커서 갱신.
- **전체 완료**: 아래 체크리스트 전 항목이 `[x]`(완료)·`[~]`(부분/예외 명시)·`[!]`(보안검토 대기) 중 하나. event-pass는 인프라 라이브 후 2회차.

## ⚠ 매 사이클 먼저: 이 문서를 읽어라

**컨텍스트가 길어지면 맥락을 잃는다.** 모든 사이클은 **이 문서를 처음부터 읽고 시작**한다 — 목표·불변식·flow선택·플래그·아래 **커서(다음 모듈)**를 확인한 뒤 착수. 끝나면 체크박스 + 커서를 갱신해 다음 사이클이 이어받게 한다. 이 문서가 진행 상태의 **단일 진실원천**.

## 커서 (현재 위치 — 매 사이클 갱신)

> **완료(라이브 401 검증)**: platform_admin 19/19 · center 모듈 전체 · assessment 8 · subscription(+`_auth()` 인라인·`ctx.ctx.uow`버그 수정) · (이전) schedule/llm/messaging/notification/voucher/client/counseling/form/billing/document/field_note/upload/institution + 보안게이트 + foundation.
>
> **audit 버그 수정 완료(cross-cutting, 메모리 behavior-audit-fix)**: `require_audit()` 액션 신설(`ctx.audit`=ctx.uow 공유) → subscription + platform_admin 13모듈(50 ep) `Depends(get_audit_logger)`→`require_audit()` 전환(유실 버그 fix, probe 검증). 인프라클라: subscription toss→factory 이동. **잔여**: credential/voucher의 `get_storage_client`(router-body presigned URL) → handler 이관 후속.
>
> **다음(소수·특수, codemod 부적합)**: ① **`ai_lab` 완료**(7 서브라우터 전부 + root). router-tx→`handlers/` 추출, 전 엔드포인트 use_admin(require_admin_auth, require_admin_role(*SUPER_PLUS)), 부모 dep 제거, tx-free. run_batch_compare는 체크포인트 commit 유지. 부수 수정: get_experiment_comparison NameError, run_chain의 죽은 EXPERIMENT_TYPES→build_experiment_types. **me·support 완료**. **behavior auth/tx 마이그레이션 = 전 모듈 완료(Depth 1).** 영구 예외: agent-SSE/field_note-WS(get_aow), me/get_my_permissions(current_center, permissions_version 필요). **다음 단계 = event-pass(2회차)** — 인프라(eventing 테이블·워커) 라이브 후 emit 추가([eventing.md], 미착수). 잔여 비behavior: `app/dependencies` 슬림화(인증 resolver 잔여 소비자 0 확인 후 삭제 가능), credential/voucher storage Depends→factory(후속).
>
> **support = 별도 빌드아웃 사이클**: owning 모듈 `platform_admin/inquiry`(models+repo만)·`faq`(models만)에 facade/service 없음 → 크로스모듈 read(FAQ published list·Inquiry by sender_email)·write(create Inquiry)를 owning 모듈에 신설([cross-module-write.md](../rules/api/cross-module-write.md) §2) + application handler + email scope(account_id→email, [behavior.md](../rules/api/behavior.md) §2) 해소 후 use_account. 단순 rewiring 아님 — 두 빈 모듈 빌드아웃.
>
> **잔여 current_account 소비자**: support(router). **AccountContext**: support, application/handlers/center/list_user_centers. **current_center 소비자**: me(router), agent-legacy.
>
> **`_auth()` 헬퍼 전량 제거 완료(2026-06-26)**: 47개 잔여 라우터 일괄 인라인(~288 call sites, codemod). 코드베이스에 `def _auth` 0개. ruff 정본 레이아웃, boot+smoke(401) 검증.
>
> **결정 대기(코드 내 `# TODO: 결정 필요`)**: update_person 소유권 · subscription get_plans 무인증 · center_application reviewer_person_id placeholder.
>
> **도구**: codemod = `.claude/loop/codemod.py`(center/admin-gate/admin-role/admin-keep-dict 변형 + ast dup-ctx fix). **주의: codemod가 만든 `_auth()` 헬퍼는 안티패턴 — 신규 변환은 인라인 형태로.** 라이브 검증: `pnpm dev:api`(:3502) 재가동 후 smoke(401).

---

## 한 모듈 = 1 사이클 (stop-and-report)

```
0. 읽기   : 이 문서를 읽는다 — 목표·불변식·flow선택·플래그·커서. 컨텍스트 길어도 여기서 맥락 복원.
1. 점검   : 구조(router/handler/service/repo/facade) + 위반신호 스캔
           (raw SQL in router·foreign model 생성·router-tx·@audit_log·BackgroundTasks·핸들러가 ctx객체 받는지·공유여부·no-auth)
2. 정리   : raw SQL→repo · 인라인 로직→handler/service · 크로스모듈 write→application handler+owning facade
3. 전환   : router→use_*(인증주체) · 단독 핸들러 tx-free(명시 commit 제거; 공유는 유지) · one-call-unit 체이닝
4. 검증   : import + boot + **라이브 smoke**(서버 :3502 --reload 자동반영 → 엔드포인트 호출: 401/403/422/200=정상, 500=깨짐 → /tmp/api-dev.log 확인)
5. 게이트 : 통과 → 체크박스+커서 갱신 → `git commit -- <module paths>` → 다음. 막히면 멈추고 [!] 기록(추측 금지)
```

한 사이클 = 한 모듈 = 한 로컬 커밋. git push/fetch/reset 금지(hook 차단).

## 불변식 (전 모듈 공통)

- **Depth 1만 지금** — behavior(인증·tx)만. **event `emit` 추가 금지**: eventing 테이블/워커 **라이브 미검증**이라 없는 테이블 INSERT = 런타임 깨짐. `@audit_log`는 **독립 세션**(AsyncSessionLocal)이라 그대로 유지(behavior tx 무관). emit·`@audit_log`→event_atomic은 인프라 라이브 후 **event-pass**(별도 phase).
- **tx-free = 명시적 `await uow.commit()` 제거가 전부.** `UnitOfWork.__aexit__`는 정상종료 시 commit 안 함(예외만 rollback) → handler의 `async with uow:`는 commit 없는 **no-op 가드**. behavior `transactional_uow`가 flow에서 commit하므로, **write 핸들러의 `await uow.commit()`만 제거**하면 됨. 긴 read 핸들러의 `async with uow:`는 no-op이라 그대로 둬도 안전(dedent 불필요).
- **scope = 식별 키만**([behavior.md](../rules/api/behavior.md) §2 scope 규약) — `Context`는 `uow`·`person_id`·`center_id`·`actor_id`·`permissions`·`owner_scope`·`event_group_id`. `email` 등 profile은 안 담음(키로 owning 모듈 조회).
- **공유 핸들러는 commit 유지.** 핸들러가 **2+ 라우터에서 호출**되면(레거시 호출자 존재 가능) tx-free로 만들지 않는다 — 레거시 호출자가 그 commit에 의존. behavior 라우터에선 `__aexit__` no-op이라 그 commit은 early-commit(이후 transactional_uow 최종 commit은 no-op)으로 **양쪽 안전**. **단독 호출 핸들러만 commit 제거.** 전 모듈 전환 후 event-pass에서 flip. (점검 시 `grep -rln handler …/router.py | wc -l`로 호출 라우터 수 확인.)
- **핸들러가 `ctx`객체(CenterContext)를 받으면 주의.** behavior `Context`는 필드명이 다름(`member_id`→`actor_id`)이고 `access_level`/`account_id`/`email`/`permissions_version`는 **없음**. 핸들러가 쓰는 필드가 behavior Context로 커버되면 호출부에서 `ctx.actor_id` 등으로 매핑해 전환, 광범위하면 handler를 primitive로 리팩토링(범위 크면 [!] 플래그).
- **scope authz 필드**: `permissions`·`owner_scope`·`role_code`는 authz 파생값이라 scope에 있음(profile 아님). 인라인 role/owner 게이트는 `ctx.role_code`/`ctx.owner_scope`로 **보존**(권한코드 신설 금지 — 기존 체크 그대로).
- **one-call-unit** — 단일사용 facade/repo/service는 `await Facade(uow).method(...)` 체이닝(중간 변수 금지). 다회 사용은 변수 유지.
- **surgical** — 이번 모듈 범위만. Edit 전 Read. 인접 코드 "개선" 금지(단, 그 모듈의 명백한 레이어 위반·나레이션 주석은 정리 대상). **엔드포인트 docstring/summary 동어반복도 제거**(`"""플랜 변경 거절 (SuperAdmin 전용)."""`처럼 핸들러명/역할게이트 재진술 — [router.md](../rules/api/router.md)). 비자명한 소비자 계약만 한 줄 유지.
- **어려운 의사결정은 멈추지 않는다** — 인증 배선 외 도메인/로직 판단(소유권 검사·권한 모델 등)은 **`# TODO: 결정 필요. {내용}` 주석**을 코드에 남기고 안전한 기본값으로 계속 진행. 루프를 막지 않는다.
- **`_auth()` 로컬 헬퍼 금지 + 레이아웃 강제** — endpoint가 `Depends(server.use_*( server.require_*(), ... ))`를 **파라미터에서 직접** 선언하되 `Depends(`·`use_*(`·각 `require_*()`를 **각 줄에**(붙임 금지). magic trailing comma 필수(없으면 ruff/black가 한 줄로 접음), 정규화는 `ruff format` ([behavior.md](../rules/api/behavior.md) §5). codemod가 심은 `def _auth(...)`는 암묵 파이프라인 안티패턴 — 그 모듈 손댈 때 인라인 제거. 사용자 결정(2026-06-26).
- **`app/dependencies` 제거 = 점진적, dependencies/ 슬림 유지**(사용자 결정 2026-06-26). 인증 resolver(`current/account·center·admin`·`common/context`)는 [behavior/action/](../../apps/api/app/behavior/action/)에 이미 복제됨 → 마지막 레거시 소비자(auth·support·role_permission·me·agent-legacy 라우터 + voucher/billing **ctx-object 핸들러**) 전환 시 **파일별 삭제**. 비인증 유틸(`get_aow`(SSE)·`audit_logger`·`client_info`·`current_bot` gate)은 behavior Action이 아니므로 **슬림 dependencies/에 잔존**. behavior와 dependencies의 `_resolve_access`/`_check_plan` 중복은 dependencies가 죽을 때 자연 소멸(죽는 모듈에 cross-import 걸지 말 것).

## 코드모드 도구 (`/tmp/codemod.py`) + 한계

clean center-CRUD 라우터 일괄 변환용(`current_center`→use_auth). **한계 — 아래는 수동/제외**:
- **혼합 인증 라우터**(한 파일에 center + `current_account`/`current_admin`): account/admin 엔드포인트엔 ctx 없어 `uow`→`ctx.uow`가 깨짐 → 수동.
- **system/no-auth 엔드포인트**(ctx 없이 `uow`만, 예: `center/...register_center_holidays`): 코드모드가 uow 제거→`*,` dangling + `ctx` 미정의로 깨짐 → 수동(use_public() 또는 게이트, 또는 `# TODO: 결정 필요.`).
- **router-level `dependencies=[Depends(current_center(feature=))]`**: 인라인 use_auth+require_feature로(counseling_case_analysis 참고).
- 검증: import-check(`importlib`) + 라이브 reload + smoke. **codemod 후 항상 import-check**(syntax/NameError 잡음). 깨지면 `git checkout -- <router>`로 복원(uncommitted라 안전).

## 라이브 모니터 (검증 4단계)

- 서버: `pnpm dev:api`(uvicorn `--reload` :3502) 백그라운드 가동. DB는 docker postgres :3501(이미 up). 로그 `/tmp/api-dev.log`.
- 파일 저장 → WatchFiles 자동 reload. 변환 후 **로그 tail에서 reload 성공 + "Application startup complete"** 확인(에러면 그 모듈 깨짐).
- **smoke**: 변환 엔드포인트 호출(`curl` 없으면 venv python `urllib`). 토큰 없으니 `use_auth/account/admin`→**401**, `use_public`+gate(dev)→**200**. **500/404면 배선 깨짐** → 고치고 재확인.

## flow 선택 (인증 주체별)

| 인증 주체 | flow | require_* | 비고 |
|---|---|---|---|
| center 멤버십 | `use_auth` | authentication·center·permission_version·permission(·feature) | `center_id` path param. `ctx.center_id`·`actor_id`·`owner_scope` |
| account(센터 무관) | `use_account` | authentication | center_id 없음(필요시 Query). `ctx.person_id` |
| admin 토큰 | `use_admin` | admin_auth·admin_role(*roles) | center 없음. 신원 불필요시 `ctx.uow`만 |
| machine(webhook·bot) | `use_public` | gate(verify) | 무신원. 기존 검증 콜러블 재사용(`verify_toss_webhook`·`current_bot`) |
| pre-auth(login·signup) | `use_public()` (gate 없음) | — | 토큰 없음 — tx만. 미신설(auth 모듈 턴에) |

---

## 모듈 체크리스트

전환 완료 = `[x]`. 부분/예외 = `[~]`. 미착수 = `[ ]`. **보안검토필요(무인전환 보류) = `[!]`**. 괄호=router 수.

> **무인 전환 보류 플래그 `[!]` (사용자 검토 필요)** — 인증 의미가 불명확한 곳. 무인으로 추측 안 함:
> - `role/permission`·`role/role`(4 ep) — **NO-AUTH**(`POST /permissions` 생성 포함). 공개 의도인지 갭인지 불명.
> - `assessment/assessment`(2 ep) — NO-AUTH(전역 검사 카탈로그 read?).
> - `person/persons`(5 ep) — NO-AUTH(person 조회/생성).
> - `llm/init_credit` — 인라인 role_code 게이트(`ADMIN`/`MANAGER`)는 `ctx.role_code`로 전환 완료(권한코드 신설 아님, 기존 체크 보존).

### 기반 (완료)
- [x] `behavior/` 4 flow(use_auth·account·admin·public) + Context/ctx + scope 규약 + email=query 결정
- [x] `module_for_test`(1) — 레퍼런스(신 API)
- [x] `activity_log`(1) — read 전환(use_auth)
- [x] `notice`(1) — account-only 첫 소비자(use_account)
- [x] `platform_admin/audit_log` — admin 첫 소비자(use_admin)
- [x] `subscription` webhook+internal — public 첫 소비자(use_public). **admin+center 잔여 → 아래**
- [x] `schedule`(1) — center-CRUD 첫 모듈(use_auth, 9 ep)
- [~] `agent`(2) — conversation **라우터 분리**: behavior(read·delete) 전환 / 스트리밍·create·patch·tokens는 `router_legacy.py`(SSE=get_aow 유지)

### Phase 1 — 클린 center-CRUD (use_auth)
- [x] `role`(4) — permission/role reads use_account, POST /permissions use_admin.
- [x] `role_permission`(1, 8 ep) — center 마운트(`/centers/{cid}/roles`). current_center→use_auth(require_permission), 5 write 핸들러 commit 제거(create/update/assign + app delete/bulk). current_center/CenterContext 소비자 제거. 라이브 401 검증
- [x] `client`(6) — 5 router(32 ep) use_auth(codemod), router-only(handler commit 유지)
- [x] `counseling`(5) — 5 router(36 ep) use_auth(codemod); case_analysis feature gate 인라인
- [x] `form`(4) — form/template/send use_auth(codemod)
- [x] `llm`(1) — role_code scope 필드 추가, init_credit 인라인 게이트 보존
- [x] `messaging`(2) — message_template 8 ep use_auth(WRITE_CENTER), 핸들러 공유라 commit 유지
- [x] `notification`(3) — 3 router use_auth(+account_id scope), 4 write tx-free, push_token은 notifications 하위
- [x] `voucher`(3) — center+client_voucher use_auth, ctx-object 핸들러는 behavior Context로 동작(center_id/account_id만 사용); download(C급) 포함
- [x] `billing`(4) — billable/payment/price_list/legacy use_auth(codemod), ctx-object 핸들러 OK
- [~] `assessment`(10) — 큼. `assessment/assessment`(2) NO-AUTH `[!]`. send_result token(verify_send_result)→public/gate. 나머지 center
- [x] `document`(4) — document/document_access use_auth, share_token 혼합(use_auth+use_public 토큰), download C급 포함
- [~] `field_note`(3) — field_note/pipeline use_auth(+feature gate). **WebSocket(ws_handler) 제외**(유지)
- [~] `center`(14) — **혼합·수동 필요**: 순수 center 서브라우터(member·program·room·operating_time류 9개) + **system no-auth 엔드포인트**(register_center_holidays 등, codemod 깨짐 → 수동/게이트) + account(me·center_application·member_invitation) + ctx-object(me). **코드모드 불가 — 서브라우터/엔드포인트별 수동**. 미착수(복잡)

### Phase 2 — 클린 account/admin
- [x] `person`(2) — /persons gated(admin/account 혼합). **credential 서브라우터 완료**(8 ep current_account→use_account; create/update/request_verify commit 제거, delete/upload/delete_attachment는 S3 cleanup 전 commit 필요라 유지=early-commit 안전; download StreamingResponse는 eager-load라 안전). current_account/AccountContext 소비자 제거
- [x] `upload`(2) — use_account
- [x] `institution`(1) — use_account(라우터레벨→엔드포인트별)
- [x] `platform_admin`(19) — use_admin 전환 완료. cat2(7)는 get_current_admin(handler dict용)+role decorator 레거시 유지, ctx.uow는 behavior — admin. account·ai_usage·assessment·center·credential·cs_memo·form·notice·notice_read·platform_settings·voucher 등. **read-model raw SQL은 sanctioned(EX-2)** — 정리 대상 아님

### Phase 3 — 중(레이어 정리 동반)
- [x] `center_application`(center/) — 라우트 1곳 router-tx → handler 추출
- [x] `ai_lab`(7 서브라우터+root, 48 ep) — 서브라우터별 분할 완료. router-tx+인라인로직 → 각 서브모듈 `handlers/` 추출, 전 ep use_admin(require_admin_auth+require_admin_role(*SUPER_PLUS)), 부모 dep 제거, tx-free(run_batch_compare 체크포인트 commit 유지). production_config는 require_audit. feature_test는 thin wrapper(타모듈 핸들러 위임)
- [x] `auth`(1) — pre-auth(signup·login·check-email·refresh) → `use_public()` no-gate / me·verify-password·change-password·devices·revoke·delete_me → use_account(require_authentication). write 핸들러 commit 제거(transactional_uow), **login locked-branch commit 유지**(persist-then-raise). e2e 검증(signup 201→login 200→me 200). app.dependencies 제거 완료
- [x] `subscription`(center+admin+public; get_plans use_public TODO) — admin 표면 완전 behavior화: **죽은 `current_admin` 파라미터 19개 제거** + 역할 게이트를 `use_admin(require_admin_auth(), require_admin_role(*SUPER_PLUS))`로 접음(라우터레벨 dep 제거). `AuditLogger`만 잔존(event-pass). **주의: platform_admin cat2(7)의 get_current_admin은 핸들러가 dict를 실제 사용 → 죽은 게 아님, 그대로 유지.** 죽은 current_admin = body에서 안 읽히는 경우만 제거.

### Phase 4 — 무거움 / 경계
- [x] `support`(1) — 레이어 위반 정리 완료: raw SQL → 신설 FAQRepository/FAQFacade·InquiryRepository finder; 타모듈 Inquiry 생성 → InquiryFacade+CreateInquiryService; 크로스모듈 read/write → application handlers(list_public_faqs/list_my_inquiries/create_inquiry). email scope = account_id→email(AccountFacade, behavior.md §2). faqs use_public, inquiries/inquiry use_account. /faqs 200 검증
- [ ] `agent` 스트리밍 — **behavior 불가**(SSE 요청-끝-commit이 disconnect 시 진행 유실). `router_legacy.py` 유지(get_aow)
- [ ] `field_note/streaming` — **behavior 불가**(WebSocket). 유지

### event-pass (인프라 라이브 후 — 전 모듈 2회차)
- [ ] eventing 테이블(events·event_atomics·event_reactions) 생성 + 워커 라이브 1회 실측
- [ ] write 핸들러 service emit + `{Module}Event` 마커 + handler 그룹 emit + router `require_event()`... (현 explicit: require_event_group+require_dispatch)
- [ ] `@audit_log`(92곳) → event_atomic(저장이 곧 audit) 제거

---

## 예외 카탈로그 (behavior 적용 난이도)

| 등급 | 모듈/대상 | 사유 | 처리 |
|---|---|---|---|
| A 불가 | agent SSE·field_note WS | 요청-끝-단일커밋이 스트림 진행 유실 | `get_aow` 유지, behavior 안 씀 |
| B 혼합 | agent·center·subscription | 한 모듈에 다중 인증주체/스트리밍 | 라우터 분리 후 서브표면별 flow |
| C 전환가능(주의) | document·person 다운로드 | StreamingResponse지만 DB commit 후 S3 스트림(DB-결합 아님) | behavior + 다운로드 분리 |
| 레이어 정리 선행 | support·ai_lab·center_application | 라우터 raw SQL / router-tx / 인라인 로직 | 점검 2단계에서 정리 후 전환 |
| pre-auth | auth signup/login | 토큰 없음 | `use_public()` no-gate |
