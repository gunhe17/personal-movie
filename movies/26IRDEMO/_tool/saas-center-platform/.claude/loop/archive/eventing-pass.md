# event-pass — facade pass-through + handler emit, 모듈 순회 loop

behavior 전환([behavior-migration.md](behavior-migration.md))이 "2회차"로 미뤄둔 **event-pass**를 모듈 단위로 닫는 loop. 오늘자 e2e가 진단한 결함([RESULTS-refactor-e2e-2026-06-30.md](../../apps/api/tests/e2e/RESULTS-refactor-e2e-2026-06-30.md): 계열 A 배선 누락 · 계열 B facade arity)을 실행 수정한다.

정본 규칙: [eventing.md](../rules/api/eventing.md)(§2 outbox·§4 producer 정본) · [facade.md](../rules/api/facade.md) §2(직렬화 경로) · [application.md](../rules/api/application.md) §1·§3 · [behavior.md](../rules/api/behavior.md) §4-5. 레퍼런스 [center/facade/member_facade](../../apps/api/app/modules/center/facade/member_facade.py)(`delete_member` → `tuple[MemberAtomic, Member]`) + [client/profile/router.py](../../apps/api/app/modules/client/profile/router.py)(배선 정본). 메모리 `refactor-e2e-eventing-regression`·`eventing-design`.

---

## 작업 축 3개 (P1 → P2/P3)

| 축 | 무엇 | 상태 | 게이트 |
|---|---|---|---|
| **P1. emit 배선** | service=atomic → facade=pass-through → handler=직렬화+emit → router=`start_event_group`/`dispatch_events` | **진행 중** | 없음 |
| **P2. emit→reaction 이행** | emit된 이벤트를 워커가 reaction으로 소비, 부수효과를 tx 밖으로. 끝나는 모듈에서 `BackgroundTasks`/carve-out 제거 | 미착수 | **워커 운영 + `EVENT_REACTIONS` 실모듈 등록**(현재 0건, widget뿐). 첫 파일럿=form/voucher 추출 |
| **P3. 정리/흡수** | `@audit_log`→event_atomics 일원화(§10) · **agent mutation 엔진→handler 경유 이행** | 추적만 | P1 정착 후 |

```
P1 (모듈별 emit 배선) ──┬─→ P2 (reaction; 선행: 워커+EVENT_REACTIONS, 파일럿 form/voucher)
                        └─→ P3 (audit 흡수 · agent→handler)
```
P2/P3은 그 모듈의 P1이 끝나야 의미 있다. P2는 추가로 워커 인프라 게이트.

## 목표 · 완료 정의 (P1)

- **모듈 완료**: write facade가 `(atomic[s], Model[, Page])` tuple 반환(직렬화 0) + ctx 쥔 handler가 직렬화+emit 1회 + 라우터 `start_event_group()`/`dispatch_events()` 배선 + **e2e 그린**(`run_e2e.sh`) + 모듈당 커밋 + 체크박스·커서 갱신.
- **전체 완료**: 체크리스트 전 항목 `[x]`/`[~]`(예외 명시)/`[!]`(결정 대기). P2/P3는 별도 섹션.

## ⚠ 매 사이클 먼저: 이 문서를 읽어라

컨텍스트가 길어지면 맥락을 잃는다. **모든 사이클은 이 문서를 처음부터 읽고 시작** — 목표·불변식·아래 **커서** 확인 후 착수. 끝나면 체크박스+커서 갱신. 이 문서가 진행 상태의 단일 진실원천.

---

## 불변식 (전 모듈 공통 — 확정)

1. **facade는 직렬화 안 함** — write op는 재료 tuple `(atomic, Model[, conflicts/Page])`만 반환. `model_validate`/`*Response(...)`는 handler가. 마커(atomic) 생성도 service가, facade는 pass-through.
2. **handler가 emit 1회** — `event_group_id`(ctx) 쥔 handler(크로스모듈=application, 자기모듈=모듈)가 atomic 모아 `emit(uow, "<리터럴>", event_group_id=ctx.event_group_id, atomics=[...], center_id=, actor_id=)`. **bulk=1 event+N atomics**, `if atomics` 가드 금지(빈 list면 emit no-op).
3. **크로스모듈 create는 atomic 버리지 말 것** — 소비 application handler가 atomic을 모아 자기 그룹 emit에 포함([RESULTS](../../apps/api/tests/e2e/RESULTS-refactor-e2e-2026-06-30.md) 계열 B 수정 방향). 그 모듈 사이클에서 완성.
4. **agent mutation 엔진은 P3에서 handler 경유로** — 현재 엔진([runtime/agent/mutation/engine.py](../../apps/api/app/runtime/agent/mutation/engine.py))이 facade를 직접 호출(handler 없음)해 직렬화된 Response를 기대([specs.py](../../apps/api/app/runtime/agent/mutation/specs.py) 12 spec). 그래서 **agent가 소비하는 facade 메서드는 직렬화 제거 금지** — 제거하려면 P3(엔진 이행) 선행. 그 전까지는 agent-소비 메서드에 thin 직렬화 브리지(`*_with_response`, `# TODO(P3)` 마커) 유지.
5. **ruff whole-file format 금지** — 게이트 아님([pyproject](../../apps/api/pyproject.toml), CI/pre-commit 없음). 손편집이 정본 레이아웃(magic trailing comma) 따르면 충분. 무관한 줄 reflow는 surgical 위반.
6. **surgical** — 그 모듈 write op 범위만. Edit 전 Read. 비-event read 핸들러·인접 코드 "개선" 금지.
7. **막히면 멈춘다** — 런타임 깨지는 불확실(없는 테이블·arity·agent 충돌)은 정지 후 `[!]`. 도메인 판단(이벤트명·payload·그룹핑)은 `# TODO: 결정 필요` 남기고 안전 진행.

## 한 모듈 = 1 사이클 (P1, stop-and-report)

```
0. 읽기   : 이 문서 — 목표·불변식·커서.
1. 점검   : write use-case 열거. 각각 (a) service가 (atomic, model) 반환?  (b) facade 반환형(tuple? *_with_response? entity?)
           (c) emit 위치(모듈/application/없음)  (d) 라우터 start_event_group/dispatch_events  (e) agent spec이 이 facade 메서드 소비?
2. service: 마커 없으면 신설({Module}Atomic 순수, payload()+act/act_entity_name/act_entity_id), repo 변경 직후 (atomic,model) 반환.
3. facade : write op를 (atomic, Model[, ...]) tuple로(직렬화 제거). agent-소비 메서드면 thin *_with_response 브리지 남김(불변식 4).
4. handler: ctx 쥔 handler가 직렬화 + emit 1회. 크로스모듈 create면 atomic 수집해 그룹 emit(불변식 3).
5. router : 발행 엔드포인트에 start_event_group() + dispatch_events() 배선.
6. 검증   : bash scripts/run_e2e.sh -q (해당 모듈 test) — 그린. import+boot도.
7. 게이트 : 통과 → 체크박스+커서 갱신 → git commit -- <module paths> → 다음. 막히면 멈추고 [!].
```

한 사이클 = 한 모듈 = 한 로컬 커밋. git push/fetch/reset 금지(hook 차단).

## 검증 (라이브 + e2e)

- **e2e 게이트**: `cd apps/api && bash scripts/run_e2e.sh -q`(DB=`imomtae_test`, ASGI 인메모리). 계열 A 격리=`-k eventing_regression`(test_10 프로브). `rtk pytest`로 실패만.
- 발행 write 호출 → 200 + `event_atomics` 행 증가. 계열A=`event_group_id` None(배선 누락 → @typecheck 500), 계열B=tuple arity ValueError.
- 워커(P2 검증용) `python -m app.worker.event`는 P1엔 불필요(emit=INSERT만, dispatch는 sweeper/RequireDispatch).

---

## 모듈 체크리스트 (P1)

`[x]` 완료 · `[~]` 부분/예외 · `[ ]` 미착수 · `[!]` 결정 대기. 대조 정본=`client/profile`(배선됨).

### 커서 (작업트리 재보정: 계열A 배선은 34라우터 이미 완료 → loop = decision-B 정합 중심)
- e2e baseline: **34 passed / 0 failed** (모든 사이클 후 이 게이트 유지).
- agent-소비 facade(specs 12개)는 thin `*_with_response` 브리지 유지(불변식 4). 비소비 모듈은 깨끗이 tuple화.

### 진행 중 / 완료
- [x] `schedule` — facade tuple(create/update)·handler 직렬화·라우터 배선. agent 브리지 `update_schedule_with_response` thin 유지. 크로스모듈 5곳 arity fix(atomic 보류=assessment/counseling). e2e 34/0
- [x] `messaging` — `create_template`/`update_template` tuple화, handler가 `MessageTemplateResponse.model_validate`. agent 미소비. 레거시 tx(async with uow) 유지(behavior 영역). e2e 34/0

### Phase 1 — 완료 (병렬 sweep 2026-06-30, e2e 34/0)
- [x] `center` — room/program/center/member/non_op/mnwt tuple화 + room/program agent 브리지. member_invitation create는 BFF 조립(token/email)이라 제외
- [x] `client` — update_client_status tuple화 + `update_with_response` agent 브리지(**기존 깨진 client_update 도구도 복구**). batch/bulk(다중 atomic+summary)는 범위 외 유지
- [x] `counseling` — note/session tuple화 + attendance/note agent 브리지. **decision-2 보류**(워크플로 핸들러 레거시 = emit 없음, TODO)
- [x] `assessment` — set/session tuple화 + set_update agent 브리지. **decision-2 보류**(create_individual emit 없음, TODO)
- [x] `form` — instance/signature/template/version tuple화 + deactivate/revert agent 브리지(비emit write)
- [x] `notification` — **P1 step 0였음 → 풀 배선**(NotificationAtomic 신설·service atomic·handler emit·라우터). mark_as_read/all agent 브리지. ⚠ mark_all_as_read 빈 atomic(repo가 영향행 미반환, TODO) · 이벤트명 추정
- [x] `billing` — price_list/payment/billable/legacy tuple화. 캐리어(BillableCreateResult)는 rename만. complete/bulk_delete 비emit 제외
- [x] `voucher` — center/client voucher tuple화. catalog enrichment 위해 `to_response` 헬퍼 public 승격(handler가 세션 내 호출)
- [x] `document` — 이미 decision-B 완료 상태(변경 0)
- [x] `field_note` — create_field_note tuple화
- [x] `role` / `role_permission` — write 래퍼 삭제, handler가 composite read로 직렬화

### 결정 반영 완료 (2026-06-30)
- **decision-2 해소** — counseling(create_case_with_sessions·add_sessions·apply_case_edits) + assessment(create_individual) 워크플로를 배선+emit. 라우터 start_event_group/dispatch_events, 핸들러 event_group_id, schedule/session atomic 수집. 발행 act: `schedule_created`·`counseling_session_created`(+apply_case_edits `counseling_session_deleted`)·assessment는 `schedule_created`. e2e 34/0.
- **notification mark_all 해소** — repo `update_all_read_in_center`가 `.returning(Notification)`로 영향 행 반환 → service가 per-row atomic N개(불변식 2 충족).
- **taxonomy = 무작업** — emit 도메인 이벤트명 98개는 이미 전부 `{entity}_{act}`로 일관. 앞서 "불일치"로 본 `session_*`/`case_*`는 `notify_single_member(event_type=...)` 알림 타입(별개 네임스페이스)이라 emit명 아님. 통일할 것 없음.

### 잔여 (새 마커 = 별도 결정, 지금 안 함)
- **case 이벤트 미발행** — counseling_case·assessment_case에 atomic 마커(events.py) 없음. case 생성/수정을 도메인 이벤트로 낼지 = 새 마커 신설 결정.
- **assessment_session 미발행** — assessment facade `create_session_with_participants`가 atomic을 의도적으로 버리고 Result DTO 반환(주석 "audit 없는 cross-module 세션 생성"). 발행하려면 facade 시그니처 변경.
- **schedule update in apply_case_edits** — `update_schedule`(plain)·`update_schedule_member`·`delete_schedules`(→int)는 atomic 미반환이라 수집 불가.

### Phase 2 — account/admin
- [ ] `person` / `credential`
- [ ] `upload`
- [ ] `institution`
- [ ] `platform_admin`(write 표면)
- [ ] `subscription`
- [ ] `notice` / `support`

### read-only (emit 없음 — 확인만)
- [ ] `activity_log` — read=event_atomics 직접 조회(§10), 자체 emit 없음

---

## P2 — emit→reaction 이행 (게이트됨)

선행 충족 전 착수 금지:
1. **reaction 워커 운영** — `python -m app.worker.event`(asyncpg LISTEN + sweeper) 실측 1회.
2. **`EVENT_REACTIONS` 실모듈 등록** — 현재 0건(widget 예시뿐). [application/events/dispatch.py](../../apps/api/app/application/events/dispatch.py).
3. **첫 파일럿 = form/voucher 추출** — params 거의 빈값 → reaction이 id로 재조회(가장 단순, 멱등 부담 적음).

모듈별 P2 완료 = 그 모듈의 부수효과를 reaction으로 옮기고 `BackgroundTasks`/`with_dispatcher()` carve-out 제거([application.md](../rules/api/application.md) §3).

## P3 — 정리/흡수 (P1 정착 후, 추적만)

- [ ] **agent mutation 엔진 → handler 경유 이행** — 엔진이 facade 직접 호출 대신 handler를 타게. 끝나면 agent-소비 facade의 `*_with_response` 직렬화 브리지(불변식 4) 전부 제거 → facade 완전 순수 통로. 12 spec/11 facade 영향([specs.py](../../apps/api/app/runtime/agent/mutation/specs.py)).
- [ ] **`@audit_log` → event_atomics 일원화**([eventing.md](../rules/api/eventing.md) §10) — 저장이 곧 audit. read=event_atomics 직접 조회 + 표현 재구성.

---

## 안티패턴

- facade가 atomic 생성/직렬화 → service가 마커, handler가 직렬화(불변식 1).
- 크로스모듈 create에서 atomic을 `_`로 버림 → 소비 handler가 수집해 emit(불변식 3).
- emit을 `if atomics:`로 가드 → 그냥 emit, 빈 처리는 no-op.
- bulk를 atomic당 event N개로 → 1 event + N atomics.
- 라우터 `start_event_group`/`dispatch_events` 누락 → @typecheck 500(계열 A).
- agent-소비 facade에서 직렬화 제거(P3 전) → 엔진 `_dump_result` 크래시(불변식 4).
- 이벤트명 공유 상수 추출 → 리터럴.
- 워커/EVENT_REACTIONS 없이 P2 착수 → 검증 불가.
