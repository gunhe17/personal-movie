# 아키텍처 리팩토링 실행 loop

[todo/api/architecture-refactor.md](../todo/api/architecture-refactor.md)(결정 원장·절차)를 **슬라이스 단위로 안전하게 집행**하는 loop. 감사 증거는 [AUDIT-2026-06-29.md](../../AUDIT-2026-06-29.md). 레이어 통일 loop([api-refactor.md](api-refactor.md))의 7-게이트를 빌리되, 이 캠페인의 **의존 순서·eventing 3단계·verify-as-acceptance**를 강제한다.

## ⚠ 매 사이클 먼저: 이 문서 + todo + 커서를 읽어라

컨텍스트가 길어지면 맥락을 잃는다. **모든 사이클은 이 문서 → todo → 아래 커서를 읽고 시작**한다. 끝나면 커서·todo 체크박스를 갱신해 다음 사이클이 이어받게 한다. 이 문서가 진행의 **단일 진실원천**.

---

## 불변식 (모든 사이클)

- **규칙 먼저(hard gate).** todo §0(규칙 문서 반영)이 끝나기 전엔 그 규칙에 의존하는 코드 캠페인 착수 금지 — 특히 §4(eventing)는 service.md §2·eventing.md §2/§4/§10·facade.md §2④가 갱신된 뒤에만. 규칙이 정본.
- **한 슬라이스 = 한 커밋(로컬).** 한 사이클은 작업 하나(한 모듈 또는 한 파일군). `push`/`fetch`/`reset` 금지(hook 차단).
- **verify = acceptance.** 각 task의 verify grep(todo에 명시)이 **0이 될 때까지** 그 슬라이스는 미완. 커밋 전 반드시 grep 재실행.
- **회귀 가드.** 슬라이스 커밋 전 그 모듈의 **다른 verify도 깨지지 않았는지** 확인(한 축 고치다 다른 축 위반 유발 금지).
- **막히면 멈추고 기록.** 의도·범위·결정 불확실 시 추측 대신 정지 → todo에 `[!]`로 사유. 특히 미결정(F1/F2·M1/M2·A4)에 닿으면 진행하지 않는다.
- **surgical.** 이번 슬라이스 범위만. Edit 전 Read. 인접 코드 "개선" 금지(그 모듈의 명백한 대상 위반·나레이션 주석은 제외).

---

## 작업 큐 (4 페이즈 — 전역 괄호 + 모듈 본문)

순수 모듈 단위는 전역 의존(규칙 선행·eventing 재배선/teardown)에서 깨진다. **모듈 본문은 모듈 단위로 묶되, 전역 작업은 앞뒤 괄호로** 분리한다.

### Phase A — 전역 선행 (모듈 본문 전 반드시)

| # | 작업 | 단위 | verify(0 목표) |
|---|------|------|---------------|
| A1 | **§0 규칙 반영** | 5 문서(1 사이클) | 5 문서에 G1-G5 문구 |
| A2 | **§4 eventing 스캐폴드** | event 모듈(`*Atomic` 네이밍·`AuditAtomic` DTO·레지스트리·부팅 가드) | `query_audit→AuditAtomic`, 레지스트리 등록+assert |

### Phase B — 모듈 본문 (모듈당 1 패스 = 파일 한 번만 터치)

한 모듈을 잡으면 그 모듈에 해당하는 **module-local task 전부**를 한 패스에 끝낸다(handler/service/repo/router 재방문 0). 선행 = A1·A2.

module-local task = **S1/SC2(§1) · emit 마이그(§4-A) · repo 드리프트(§5) · root `__init__`(§6-1) · route desc(§7)**.

| 모듈 | 해당 task | 메모 |
|------|----------|------|
| **client** | emit(파일럿 잔여) · SC2(4) · route(2) | 파일럿 정본 — `*Event`→`*Atomic`·마커 service 이동 먼저 |
| **voucher** | S1(9) · SC2(4) · include_deleted(2) · find_active(2) · root init | 최다 중첩 — 묶음 효과 큼 |
| **platform_admin** | S1(13) · SC2(5) · find_active(2) · root init · route(form/voucher) | 대형, 서브라우터별로 쪼갬 |
| **billing** | S1(15) · SC2(7) | 최다 S1 |
| **center** | S1(1) · SC2(8) · route(1) | |
| **assessment** | S1(1) · SC2(8) | |
| **counseling** | SC2(6) · route(1) | |
| **notice** | S1(4) · SC2(2) · find_active(1) | |
| **document** | include_deleted(2) | repo만 |
| **person** | SC2(2) | |
| **form** | SC2(1) · root init | |
| **auth** | S1(1) | |
| **llm** | root init | |
| **ai_lab · notification** | route(각 1·2) | |
| (그 외 emit 대상 모듈) | emit 마이그만 | §4-A 88핸들러 = 전 mutating 모듈 |

- **모듈 패스 순서:** client(정본) → document/auth/person/form(소형) → notice/center/counseling/assessment → voucher → billing → platform_admin(대형, 서브라우터 분할). 쉬운 것 먼저, 복합/배치 뒤로.
- 대형 모듈(platform_admin·billing)은 **서브모듈/서브라우터 단위로 쪼개** 한 사이클 = 한 슬라이스 유지.

### Phase C — 전역 장벽 (모든 모듈 emit 완료 후)

| # | 작업 | 선행 | verify |
|---|------|------|--------|
| C1 | **§4-B 재배선** (web router·agent facade_registry → list_activity) | Phase B emit **전량** | 활동로그 live read |
| C2 | **§4-C teardown** (activity_log 묘비화 + facade.md 레퍼런스 교체 G5) | C1 | activity_log=legacy/model.py만, security/audit.py 삭제 |

### Phase D — 전역 codemod / cross-module (독립, 아무때나·우회로)

| # | 작업 | 단위 | verify |
|---|------|------|--------|
| D1 | **§6-2 서브모듈 빈 `__init__` 삭제** | codemod 1 | depth≥2 빈 `__init__` 0 |
| D2 | **§3 dtos 정리** | codemod 1 | dtos 디렉토리·파일·import 0 |
| D3 | **§2 A1/A2 cross-module** | 파일당 | application/handlers foreign import 0 (A3는 A2서 해소) |

- **D는 Phase B와 병행 가능** — 모듈 본문이 막히면 D로 우회(선행조건 없음). 단 D3는 owning 모듈 facade 메서드(Phase B §1 연계)가 있어야.

---

## 한 사이클 = stop-and-report

```
0. 읽기   : 이 문서 + todo + 커서. 다음 슬라이스 1개 선택(큐 순서·선행조건 확인).
1. plan   : 이 슬라이스가 건드릴 파일·범위 명시. 한 모듈/파일군으로 한정되는가? 넓으면 쪼갠다.
2. intent : 기존 코드·테스트로 "이 코드가 보장할 것" 한 줄. 불명확하면 멈추고 기록.
3. design : todo의 목표형태 + 해당 rule 컨벤션으로 변경 형태 결정. 크로스모듈이면 cross-module-write §2.
4. impl   : surgical. Edit 전 Read. 변경 라인이 전부 이 슬라이스에 추적되는가.
5. test   : 스코프 한정 pytest(바뀐 모듈만). 없으면 추가. green.
6. verify : **검토·검증 프로토콜**(아래) 3층 전부 통과 + task별 acceptance 충족. 고위험(eventing)은 독립검증.
7. confirm: 2단계 의도와 결과 대조. 부합 → 로컬 커밋(슬라이스 경로만) → 커서·체크박스 갱신. 불일치 → 되돌리고 기록.
```

게이트 실패 시 다음 단계로 가지 않고 멈춰 기록한다(추측 금지).

---

## 검토·검증 프로토콜 (작업 단위별 — gate 6)

**grep==0(제거)만으로 부족하다.** 위반이 사라져도 동작이 바뀌면 회귀다. 슬라이스마다 3층 + 정성검토 + task별 acceptance를 **전부** 충족해야 커밋.

### 3층 검증 (모든 슬라이스 공통)

| 층 | 질문 | 방법 |
|---|------|------|
| **제거(정량)** | 위반이 사라졌나 | todo verify grep == 0 |
| **동치(보존)** | 동작이 그대로인가 | 스코프 pytest green + characterization(응답 shape·route snapshot 동일, 주석만 바꿨으면 docstring 제거 후 AST 대조) |
| **회귀** | 다른 축을 깼나 | 그 모듈 **다른 task의 verify grep도 0 유지** + importlib boot + 고아 import/심볼 0 |

### 정성 검토 (커밋 전 self-review, 3층과 별개)

- **surgical** — 변경 라인이 전부 이 task에 추적되나(인접 "개선" 0).
- **안티패턴 역체크** — 그 rule의 **안티패턴 절**을 새로 유발했나(아래 task별 함정 칸).
- **intent** — grep 통과가 아니라 rule **의도**에 맞나(우회·꼼수 아닌가).

### task별 acceptance (슬라이스 = 아래 한 줄 전부 충족)

| task | 제거 verify | 동치/보존 | 고유 함정(review) |
|------|------------|----------|------------------|
| **§0 규칙** | 문구 존재 | 타 rule과 모순 0 | 안티패턴 절·상호참조도 갱신(`*Event`→`*Atomic`, facade-creates-marker 제거) |
| **§4 스캐폴드** | AuditAtomic·레지스트리·부팅 assert 존재 | query_audit 타입 변경 후 `list_activity` 컴파일 | emit이 `EVENT_REACTIONS` import(역참조) = **즉시 fail** |
| **§4-A emit(모듈)** | `@audit_log` 0 | 라이브 smoke 500 아님 + **활동로그 read에 그 act 노출** | service=atomic(facade 아님)·bulk=1 event·payload 민감값 0·updated=exclude_unset·같은 tx(별 세션 아님) |
| **§1 S1/SC2** | services Response·pydantic 0 | **응답 shape 동일**(characterization — 직렬화가 handler로 이동해도 JSON 불변) | handler가 직렬화 떠안음·service primitive in·event 모듈이면 tuple |
| **§5 include_deleted** | param 0 | 두 메서드 호출처 **의도대로 분배**(active/포함) | active 기본이 deleted 누락 유발 안 함 |
| **§5 find_active** | 단일id 래퍼 0 | base 동치 **증명 후** 삭제·호출처 base로 | 무인자(effective)·복합키는 **삭제 금지** |
| **§6-1 root init** | re-export 채움 | 소비처 import 해소·boot | `__all__` 정확(노출 과/소 0) |
| **§6-2 submodule init** | depth≥2 빈 0 | importlib boot + `.pyc` 제거 후 | **모듈 루트는 삭제 금지**(그건 §6-1) |
| **§2 cross-module** | application foreign import 0 | 한 `uow` atomic 유지·테스트 | facade 메서드 **실재 확인**(추론 금지, cross-module-write §2) |
| **§3 dtos** | 디렉토리·파일·import 0 | 11 import 해소 후 컴파일 | schemas 흡수·고아 0 |

### 고위험 슬라이스 = 독립 검증 (adversarial)

§4(eventing) 슬라이스는 커밋 전 **별도 시각으로 반증 시도** — "이 emit/atomic이 유실·중복·누락되는 경로가 있나"를 적극적으로 찾는다:
- 역참조(emit→application)? · 레지스트리 등록이 **API·worker 양 프로세스** startup에 다 걸렸나? · atomic이 비즈 데이터와 **같은 tx**인가(별 세션 아님)? · 공유 핸들러(2+ 라우터)의 commit/emit 위치? · reaction 있는데 terminal succeeded로 박히나(부팅 가드)?
- 하나라도 의심되면 **커밋 보류 + 기록**. 통과해야 커밋.

---

## eventing 캠페인 특수 게이트 (#2-#5, 최고 위험)

- **3단계 순서 절대 — A(emit) → B(재배선) → C(teardown).** 어기면 활동로그 화면 빈 페이지. **B는 A 전량 완료 후, C는 B 후.** 부분 A 상태로 B/C 착수 금지.
- **G3 패턴 고정**(todo §4-2): service=atomic 생성(`tuple[*Atomic, Model]`), handler=event emit, facade=pass-through. facade가 마커 만들면 안 됨.
- **bulk = 한 event + N atomics.** handler가 atomic 수집 후 emit 1회. service N회 호출하되 event는 1개.
- **G1 역참조 가드.** emit이 `EVENT_REACTIONS` 직접 import = 역참조 → 즉시 정지. 레지스트리(application→event 등록)만 조회. 부팅 가드(`keys() ⊆ 등록집합` assert) 없으면 #2 미완.
- **emit 마이그 verify(모듈당):** `grep @audit_log <module>` == 0 + 라이브 smoke(해당 엔드포인트 200/4xx, 500 아님) + 활동로그 read에 그 act 노출 확인.
- **공유 핸들러 주의.** 2+ 라우터가 부르는 핸들러는 commit/emit 위치 신중(behavior tx 소유). `grep -rln <handler> .../router.py | wc -l`로 호출 라우터 수 확인.

---

## 커서 (현재 위치 — 매 사이클 갱신)

> ════════ §4-A emit 마이그 진행 (2026-06-29) ════════
> **DB 기동 확인:** `pnpm db:up`(Docker) → Postgres 3501. `pnpm dev:api`로 connection refused면 DB 미기동(사용자가 띄움). 통합테스트 게이트 필수.
> **✅ client/relation 완료(32e7d46) + 선행이슈 둘다(b2ff536) + agent(b3301cb).** modules/ @audit_log == 0.
> **✅ application/handlers/ @audit_log 14 전량 완료:** schedule(e563885)·counseling delete_session(50633f5)·field_note(2aa1d2e)·voucher(9ab13fe)·assessment_set(3f5eb05)·center 3(b837c1a)·billing 4(e1cbac9). 패턴: owning create/update service→atomic, facade pass-through(re-fetch 응답류는 atomic 따로 캡처), **app handler가 emit**(behavior.request 커밋, handler commit 없음), router event_group_id/actor_id. 공유 호출처 unpack-discard(bulk invitation·apply_case_edits 등). carrier(BillableCreateResult)는 facade가 임베드 billable로 atomic 생성.
> **🎉 Phase A(§4-A) 100% 완료 — GLOBAL @audit_log == 0 (modules+application+runtime). 통합테스트 46 green.**
> **🎉 Phase C 완료 — C1(ebd270e §4-B 재배선: web router·agent facade_registry → application list_activity live read, 응답 shape 동일) + C2(3d9c37c §4-C teardown: activity_log 묘비화[legacy/model.py만], read 엔드포인트 modules/activity로 이주, security/audit.py·빈 security 패키지 삭제, current_actor_id[write-only 고아] 제거, 모델등록 import 3곳 legacy.model로, facade.md G5 갱신). boot OK·라우트 스냅샷 보존·통합 46 green.**
> **✅ §4(이벤팅) 전 단계(A emit·B read·C teardown) 종료. @audit_log 잔재 0. activity_log = 테이블 묘비만.**
> **✅ 미결정 6항목 전량 종결(2026-06-30, 사용자 결정):** M1 bare unique 자연키 3건 partial index(eb0d9e9d+마이그 f3a9c1d8b204, 실 DB 재현 검증) · M2 comment= 동어반복 제거(d2bfd984) · 비-admin JOIN=유지(0b493b1c, 전제 오류—둘 다 admin read-model·load-bearing) · F1 EX-13/F2 reject 명문화/A4 EX-3 carve-out(50aa7ff8 규칙 3문서). 상세=todo §미결정. **F2 코드 전환(send_result→uow.reject)만 잔여**(behavior scope 배선 후 별도 슬라이스).
> **⏭ 다음 = 아키텍처 리팩토링 캠페인 전량 완료(§0-§7 + 미결정 6). 잔여 작업 = F2 코드 전환 1건(선택).**
> **✅ center 전량(room 7eee0c0·program da83a33·singletons 6837036·time submodules e224a6e):** 15핸들러 7서브모듈. room/program/member_non_working_time/non_operating_time CRUD + center/member/invitation singletons. **dead-but-migrated(unrouted, route는 app handler=옛부터 미감사):** program create_program_handler·member update_member_handler. **agent 회귀 수정(room 슬라이스):** event 발행 facade가 tuple 반환→agent mutation engine _dump_result에 tuple 언랩 추가 + update_note_by_id_with_response changed default None(agent 미전달).
> **✅ agent(b3301cb):** create/update_conversation 2핸들러 + delete 파일럿 정합. **skip 사유 재평가됨 — HTTP 핸들러는 표준 uow였다:** create/update handler가 `AgentFacade(ctx.uow)`를 쓰는데 그 facade `self._aow`는 **넘어온 ctx.uow(behavior.request transactional)** — delete 파일럿과 동일. `_aow` 스트리밍 우려는 **runtime store auto-create(app/runtime/agent/store/agent_facade.py)에만** 해당(거기만 get_aow 즉시커밋). AgentConversationEvent→AgentConversationAtomic 리네임(created/updated/deleted 3팩토리·payload=AgentConversationRecord dump). Create/UpdateConversationService→(atomic, model). **미발행 경로 unpack-discard:** runtime store create(`_atomic, conv`)·modules facade 스트리밍 create/update(무대입 discard) = 옛 무audit 보존. update changed=title 델타({"title":...}). **delete if-guard 제거**(emit이 빈 atomics no-op 소유, eventing.md §4 안티패턴 해소). router_legacy에 start_event_group/dispatch_events. **선행 주의(본작업 무관):** facade `update_conversation_title`(non-response) = 무콜러 dead, 이제 tuple 반환(잠재). 통합테스트 +1 lifecycle green(36)·agent unit 199.
> ════════ 사용자 결정 (2026-06-30, 다음 세션 집행) ════════
> **relation(6) = 진행 + 3 entity_name 유지:** ① 선행 SC2 버그 먼저 수정 — create/delete relation 핸들러가 schema를 primitive-kwarg service에 positional 전달(`execute(center_id, data)` vs `execute(*, center_id, client_id, ...)`), boot는 OK라 미탐지. 핸들러가 schema를 primitive로 언패킹하도록 교정. ② emit 마이그: ClientRelation/SiblingRelationAtomic에 **entity_name을 caller 주입**(service.execute가 entity_name param 받아 atomic 팩토리에 전달). 공유서비스 4개(Create/DeleteGuardian/SiblingRelationService)는 unified 핸들러(entity_name="relation") + specific 핸들러(guardian_relation/sibling_relation) 양쪽이 호출 → 핸들러가 각자 entity_name 주입. unified create/delete_relation은 routed(router.py:42,82), specific 4개 핸들러 routed 여부 확인 필요. 양방향 자동생성·composite 응답 주의. routing: 현재 router는 create_relation/delete_relation만 import(specific 4개 라우팅은 별도 확인).
> **선행 이슈 = 둘 다 고치기:** ① client/profile stale unit 11개(파일럿 후 tuple 시그니처 미반영) 현행 API로 교정. ② **typecheck unset latent: core/type.py `typecheck`가 `value is unset`이면 skip하도록 수정**(unset은 프레임워크 sentinel, 다운스트림이 `if v is not unset`로 필터 → 안전). note summary 생략·participant is_consumed 등 명시 unset 거부 문제 글로벌 해소.
> **agent = 별도 세션(아래 핸드오프 프롬프트).**
> ════════════════════════════════════════════════════
> **✅ client/link+status(1c187fb):** create_link_request(client_link_request)·update_client_status(client updated, ClientAtomic 재사용 changed={status}). 둘 비공유. **[!] client/relation 6핸들러 skip:** 선행 SC2 버그(create/delete_guardian/sibling/relation handler가 schema를 primitive-kwarg service에 positional 전달→런타임 깨짐, app boot는 OK라 미탐지) + 공유서비스(Create/DeleteGuardian/SiblingRelationService)가 caller별 3 entity_name(relation/guardian_relation/sibling_relation) + composite 응답·양방향 자동생성. **사용자 결정 필요: SC2 버그 먼저 고칠지, 아니면 entity_name 파라미터화로 진행할지.** Phase C는 이 6개 때문에 막힘(전량0 미달).
> **✅ assessment 전량(center_assessment aa544c8·task/set 7252651·session 5bc66f8):** 8핸들러 4서브모듈. center_assessment(create/update)·task(cancel/opinion)·set(delete)·session(create/update/cancel). 각 *Atomic. **공유 서비스 unpack-discard:** UpdateCenterAssessmentService→toggle facade·CancelTaskService→bulk cancel_tasks(무대입)·CreateSession(assessment)→case_facade. cancel류 act=cancelled. set payload=AssessmentSetResponse(assessment_summary 실제 JSONB컬럼). session cancel 알림 보존. **선행 reassign unit을 tuple로 교정.**
> **✅ counseling 전량(note d4fd8eb·session/participant c83b3c8·case_analysis 684f5c0):** 8핸들러 4서브모듈. note(create/update/delete) **private_notes payload 제외**(§10 민감값). session(create/update/cancel)+participant(attendance) — 알림 부수효과 보존, **공유 create_session facade가 (atomic,Session) 반환→4 application handler unpack-discard**, cancelled act=cancelled. case_analysis는 foreground 트리거 atomic(bespoke, entity_id=case_id, background 실제생성은 미감사). **선행 lat(무관):** repo update_in_center @typecheck가 명시 unset kwarg 거부(note summary·participant is_consumed 생략 시) — 프론트가 동반 전송으로 회피. case_analysis 모델 라우터 lazy-import라 테스트 create_all 위해 모듈레벨 등록 import 추가.
> **client/profile 선행 unit 11실패(무관, 본세션 무변경):** 파일럿 client eventing 마이그 후 stale(서비스 tuple 반환을 unit이 미반영). billing price_list와 동류. teardown/C 전 정리 대상.
> **✅ billing 전량(price_list 15cc0e7 + payment·billable·payment_record 846cada):** 7핸들러 4서브모듈. price_list create/update/delete·payment created·billable deleted·payment_record updated/deleted. PriceList/Payment/Billable/PaymentRecordAtomic. **payment create는 billable 갱신 cascade를 별도 audit 안 함**(payment created atomic 1개=옛 @audit_log 동치). billable/payment_record payload는 BillableResponse/PaymentRecordDetailResponse가 relationship 없어 bare record dump(enrich None). **billing/router.py:68 create_payment_handler는 application 레이어**(미마이그). 선행 stale unit(price_list SC2 data= 호출) 현행 primitive API로 교정. 통합테스트 +4 green(21).
> **✅ schedule(cf9b2b2):** delete 1핸들러. ScheduleAtomic(deleted only) service 생성·facade `delete_schedule_with_message`→`delete_schedule` tuple pass-through·handler emit("schedule_deleted")·router ctx.event_group_id/actor_id 전달. 통합테스트 `test_delete_schedule_emits_deleted_atomic` green. payload=엔티티 dump(옛 @audit_log의 `{"data":{"message":...}}` quirk→§10 정본 엔티티 평문, 의도된 redefinition). 단일 router 호출·역참조0·같은 tx 검증.
> **✅ role(4942e3e):** create/update 2핸들러(role_permission 서브모듈, entity="role"). RoleAtomic(created+updated) service 생성·facade create_custom_role*/update_custom_role* tuple pass-through(`*_with_response`도 (atomic,Response) 반환=composite 응답 모듈 적응)·handler가 `async with uow:`(레거시 tx, behavior.request 커밋) 안에서 emit. **update changed=RoleUpdate.model_dump(exclude_unset)**(G4). **CreateRoleService 공유**→init_center_roles unpack-discard(미발행). version-guard unit 2개 tuple/changed 정합 수정. payload=RoleResponse dump. **주의(선행 fragility, 본작업 무관):** UpdateRoleService→update_in_place가 description/access_level 생략 시 `@typecheck`로 unset 거부—프론트가 full RoleUpdate 보내 회피, partial update는 잠재버그.
> **✅ field_note(00681ac2):** update_speaker_map(updated)+delete(deleted) 2핸들러. FieldNoteAtomic service 생성·handler가 레거시 `async with uow:`+명시 `await uow.commit()` 안에서 emit(emit→commit 순). facade 없이 service 직접 호출. **DeleteFieldNoteService 공유**(facade.delete_field_note가 tuple discard, 그 경로는 미발행=무콜러 dead). update changed=exclude_unset(G4). 통합테스트 green(8). 테스트는 핸들러가 내부 commit하므로 별도 uow.commit() 불필요.
> **✅ messaging(5b03fe03):** message_template create/update/delete 3핸들러. MessageTemplateAtomic service 생성·facade pass-through(`*_with_response`도 (atomic,Response))·handler 레거시 async-with-uow emit→commit. **공유 핸들러 2 router: 센터 router(ctx.event_group_id/actor_id) + admin_router(get_uow, system template, behavior.request 없음→`str(uuid4())` event_group + actor_id=None).** 통합테스트 green(9).
> **✅ agent 완료(b3301cb)** — 위 ✅ 블록 참조. (이전 "보류(엉킴)" 평가는 과대; HTTP 핸들러는 표준 uow라 delete 파일럿 동형으로 직행.)
> **✅ document(44eeb022):** document update/delete/restore + share_token create = **4핸들러/2엔티티**. DocumentAtomic(updated/deleted/restored)·ShareTokenAtomic(created). facade `*_with_log`이 atomic pass-through(+document_access 접근로그 같은 tx 유지). **함정1: setattr+flush 후 `refresh` 필요**(서버 onupdate updated_at expired→atomic payload model_validate가 sync라 MissingGreenlet; client 레퍼런스가 이미 refresh). **함정2: ShareTokenResponse.token은 공유 비밀**→payload `exclude={"token"}`(옛 @audit_log는 누출, §10 민감값 금지로 의도적 수정). 통합테스트 green(10).
> **✅ voucher(client_voucher bf63cb44 + center_voucher 17612279):** client_voucher(update/delete) + center_voucher(create/update/delete) = 5핸들러/2엔티티. Client/CenterVoucherAtomic. facade `*_with_response` (atomic,Response) pass-through, `_to_response` 카탈로그 enrich은 응답 전용(atomic payload는 bare record=enrich None). create는 catalog 검증(voucher repo)·delete는 get_by_id loaded record. 전부 base repo(update_in_center RETURNING·add) loaded라 refresh 불요. update changed=exclude_unset. 통합테스트 green(12)·voucher unit 71.
> **✅ form(instance 31f6bde + template 23588b7):** form 모듈 7핸들러/3엔티티 2슬라이스. 슬라이스1=instance(create/delete)+signature(create) FormFacade, FormAtomic+SignatureAtomic, create_instance 공유 facade는 (atomic,Form) 반환→크로스모듈 3곳(create_form_send·link_voucher·link_client) unpack-discard 미발행. 슬라이스2=template 4핸들러 FormTemplateAtomic — **한 모델이 두 entity_name**(created=form_template, version_created=form_template_version)로 옛 entity_type 보존, direct-service 2개(update_draft·publish)는 handler가 service 직접+changed 전달, publish는 무바디라 {"status":"published"} 명시. TemplateResponse에 updated_at 없어 refresh 불요(document 함정 회피). 통합테스트 green(14).
> **다음:** 대형(billing7·counseling8·assessment8·client8) → center(15, 서브분할) → agent(엉킴, 마지막). 패턴 안정화됨 — 위 9슬라이스(schedule·role·field_note·messaging·document·voucher·form-instance·form-template) 동형 반복.
> **공유 핸들러(2+ router) 처리(messaging서 확립):** behavior.request 없는 router(admin get_uow)는 `event_group_id=str(uuid4())`+`actor_id=None` 직접 전달. 핸들러가 자기 tx commit(get_uow 비자동). 양 경로 다 emit(옛 데코가 양쪽 감쌌으니 보존).
> **레거시 핸들러 패턴(role서 확립):** `async with uow:`(UoW.__aexit__는 커밋 안 함, 예외시 rollback만; 실커밋은 behavior.request) 모듈은 emit을 그 블록 **안**에 둔다. 테스트는 핸들러 호출 후 `await uow.commit()`.
> ════════════════════════════════════════════════════
>
> ════════ 이어받기 핸드오프 (2026-06-29, cross-PC) ════════
> **⚠ 이 커밋들은 로컬 only.** push hook 차단이라 다른 PC pull 전 **사용자가 직접 push** 필요(나는 못 함). 마지막 코드 커밋 = `0837e38`(client/profile SC2).
>
> **§1 Service 순수성 = 전량 완료 (S1·SC2 글로벌 grep==0).** SC2 후속: notice 3db0ca3 · platform_admin(cs_memo a83c81a·admin_account_management dba7752) · voucher(306cd06·ab648c5) · billing(price_list f45f812·payment 1a4ae58·_legacy 1afeb7a·billable 38f83d3) · client(relations 725b052·profile 0837e38). **SC2 확정 결정(사용자):** no-schema — 중첩 컬렉션도 `list[dict]` 분해(billable items). 이벤트는 출력(`tuple[*Atomic,Model]`)이라 입력 SC2와 독립(client profile). update의 event delta(`changed` json)는 facade가 계산해 전달. current_admin/current_user dict는 비대상. **남은 캠페인 = §4 eventing emit 마이그(최고 위험, 3단계 A→B→C)뿐.** (§2·§3·§5·§6·§7·§1 전부 done.)
>
> **이번 세션 완결 캠페인:** §2(write-only 재정의, 코드변경0)·§3(dtos→schemas)·§5(repo 드리프트)·§6(§6-1 철회+§6-2 빈 init 93삭제)·§7(route desc no-op) + §6-1 철회. 전부 todo에 `[완료]` 반영.
>
> **§1 S1 = 전량 완료 (글로벌 grep==0).** 완료 center·billing(15)·voucher(9)·platform_admin 13(7서브모듈: cs_memo 34a972f·notice 3f253b1·admin_account_management 4bd63a1·center_assessment a05b048·center_application 855f82c·center 2e73b10·notice_read f9cf8db)·**notice 4(917619f)·assessment 1(86700fa)**. `grep model_validate\|Response( app/modules .../services == 0` 전 모듈.
>   - **확정 패턴:** facade 없는 모듈 → service Model/tuple 반환, **handler가 직렬화**(legacy `async with uow`면 커밋 전 직렬화: `response=...model_validate(m)` 후 commit, return은 블록 밖 — expire 회피). facade 있는 모듈(notice) → service Model 반환, facade pass-through, **application/소비 handler가 직렬화**(cross-module 경로 application.md §1). read-model assembly는 service가 raw(모델/dict rows/집계값) 반환·handler가 sub-schema+Response 조립. **타모듈 Model import은 admin read-model**(repo가 이미 동일 import) — hook 경고는 read라 무시 정당.
>   - **assessment 판단(사용자 결정 = 계층 일관성):** AssessmentSummary는 JSONB 스냅샷 projection(HTTP 아님)이나 **service Model-out + facade가 projection 조립**으로 통일(grep은 services/만 보므로 facade model_validate는 통과). get_assessments stale docstring 제거.
> **S1 정본 원칙(service.md §2.1 — 반드시 먼저 정독):** 직렬화(`model_validate`/`*Response()`)는 facade `*_with_response` 또는 application handler에서만. service는 Model/`tuple[list[Model],Page]`/scalar/계산Result(=model_validate 없는 DTO)만 반환.
>   - **작업 절차(모듈/서브모듈당 1슬라이스·1커밋):** ① service의 `model_validate`/`*Response()` 호출을 위 레이어로 이동(단건→Model, 컬렉션→`tuple[list[Model],Page]`, 계산형→dict/계산값) ② facade `*_with_response`가 Response 조립(+enrichment: 타 엔티티 조회·세팅도 facade로, None가드·순서 보존) ③ list service를 agent_facade도 쓰면 그 호출처 tuple-unpack 갱신(billing/voucher서 실제 발생) ④ 캐리어 DTO는 `*Response` 대신 Model 임베드(BillableCreateResult 사례) ⑤ create의 verify용 multi-repo는 유지(직렬화 아님, §4는 S1 밖).
>   - **verify(모듈별):** `grep -rln "model_validate\|Response(" app/modules/<m> --include="*.py" | grep /services/ | wc -l`==0 · `.venv/bin/python -c "import app.main"` · `.venv/bin/python -m pytest tests/unit/ -q -k <m>`.
>   - **platform_admin(13) 분류 완료:** 13개 응답 전부 router `response_model`(전부 직렬화 대상). cs_memo·notice get/list·update_role·list_unassigned = 단순 model_validate. get_center·warn_center·center_application get·notice_read(get_read_status·get_center_read_detail) = **계산/read-model assembly**(Response(...)를 dict/집계로 구성) → service는 계산값 반환, facade/handler가 Response 래핑. notice_read 2개는 service가 repo 2개(notice_repo+read_repo) 사용 — 집계라 facade로 옮길지 판단.
>   - **notice(4) = S1+SC2 복합:** create/update(SC2 data: 동반)·get(siblings 조립 130줄)·list(is_read enrich). 한 모듈 패스로 S1만 먼저(SC2는 사용자가 "S1"으로 한정).
>   - **assessment(1) get_assessments:** `AssessmentSummary`는 `AssessmentCaseResponse.assessment_summary`에 중첩(response_model) → ① 직렬화. service는 list[Assessment] Model 반환, 8개 facade 호출처가 projection(일부는 snapshot dict 빌드라 .model_dump). 호출처 많음 주의.
>   - **권장 진행:** platform_admin→notice→assessment 순. 대형은 서브에이전트 위임 가능(원칙이 service.md §2.1에 문서화됨) + 독립검증(grep0·boot·pytest) 후 커밋. voucher가 그 방식으로 처리됨(c195ed5).
> **S1 완료 후 남는 캠페인:** §4 eventing emit 마이그(최고 위험, 3단계 A→B→C) + §1 SC2 잔여(notice·client/billing/platform_admin batch).
> ════════════════════════════════════════════════════
>
> **페이즈:** Phase A(전역 선행) — **완료**. 다음 = Phase B 모듈 본문(client 먼저).
> **A1 완료(2026-06-29, 커밋 f78447a):** service.md §2(`*Atomic` tuple)·eventing.md §2(G1 terminal+등록)·§4(G3 service=atomic/handler=event/facade=pass-through, `*Atomic`, bulk)·§10(G2 AuditAtomic DTO·G4 exclude_unset)·facade.md §2④(pass-through). 검증: 옛 `*Event` 잔재 0, G1-G5 문구 존재, 상호참조 정합. (커밋은 세션 선행 staged 103파일과 번들됨 — 메시지 amend로 정정, 사용자 승인.)
> **커밋 주의(학습):** 커밋 전 `git diff --cached --stat`로 인덱스 확인 — 세션 시작 시 대량 staged 가능. `git add <명시경로>` 후 staged 셋 검증하고 commit.
> **A2 진행:** ✅ AuditAtomic DTO(G2) + eventing 파일럿 스캐폴드 **커밋(ecbe42a)** — `event_atomic/schemas.py`, `query_audit→tuple[list[AuditAtomic],Page]`, `list_activity` model-free(**A3 1건 해소**), client emit 파일럿. 검증: 통합테스트 4 passed(.venv).
> **Phase A 커밋 이력:** A1 규칙 f78447a·메타 47a3988 / A2: AuditAtomic+파일럿 ecbe42a · emit terminal+레지스트리+부팅가드 d50d571(→**60f342d에서 제거**) · 레퍼런스 *Atomic 리네임 c86de3e.
> **emit terminal 철회(60f342d):** terminal/레지스트리/부팅가드 = 미측정 churn 위한 추측성 최적화 + 레이어 우회(emit이 application 지식 끌어옴)라 **제거**. emit은 항상 pending, reaction 판정은 워커(application). churn이 측정으로 병목이면 그때 호출처-명시 방식. eventing.md §2 반영.
> **Phase B client eventing 완료(커밋):** ClientEvent→ClientAtomic 리네임 a77b2cb · 마커 facade→service 이동 e37b8d9(Create/Update/DeleteClientService가 tuple 반환, facade pass-through, batch 8곳 unpack-discard). 통합테스트 4 passed. **client = G3 정본 패턴 end-to-end 검증됨**.
> **client batch 감사 완료(cbe95e6):** 3 batch facade가 atomics 반환, handler가 한 event+N atomics emit(audit-only terminal, uuid4 event_group+ctx.actor_id). **emit 빈-atomics no-op 소유 → 호출처 `if atomics`/`if atomic` 금지**(eventing.md §4+안티패턴). 통합테스트 5 passed.
> **client route desc 검토 완료(no-op):** /signals(best-effort+권한스코프)·/list(own/all 종료·탈퇴 포함)·/status(상태전이) 셋 다 비자명 소비자 계약 = keeper. 변경 없음.
> **client 잔여(큰 슬라이스):** SC2 — Create/UpdateClientService가 `data: ClientCreate/Update` 수령. primitive-in 전환은 단건 facade + **batch 8 호출처**(ClientCreate 빌드)에 10필드 매핑, batch 무테스트라 위험. 신선한 집중에서.
> **§1 SC2 진행:** ✅ auth(3c19ce9) · person credential(1b43dd0) · form(7a47965). 패턴: service primitive-in kwarg-only, 호출처(handler/facade)가 검증된 schema 언패킹, @validator는 router 보존.
> **notice §1 = chunky(보류):** create는 단순하나 **update(unset 처리)·get(siblings 조립)·list(is_read enrich)가 S1+SC2 복합** — 신선한 집중 슬라이스로. SC2만 부분수정하면 Response-out(S1) 남아 어정쩡.
> **§1 SC2 중형 진행:** ✅ counseling 6(9b75468 — note 3·session 2·participant 1). **패턴 확장**: facade가 pydantic 빌드(검증)를 유지하고 service엔 primitive 언패킹(content=model_dump, enum=.value, unset=None→omit). 동명 클래스(assessment CreateSessionService) 주의 — counseling 파일만.
> **center SC2 완결:** ✅ bulk(b5e35de) + 나머지 7(3f52ee8 — room/center/member/nwt). generic-spread→명시 unset params + facade `**model_dump(exclude_unset)`, empty-guard 보존, 각 스키마 필드⊆params 정적매칭. **client 구조이동 회귀 교정**: create/update service tuple 반환에 unit 테스트 미언패킹이던 것 fix(7f936fa). unit 367 passed.
> **⚠ 선행 실패 1:** `tests/unit/security/test_credential_presigned.py::test_success_replaces_with_presigned`(attach_presigned_url가 '' 반환) — 본 작업 무관, 미해결.
> **⚠ 커밋 위생(2번째 사고):** `git add tests/..`가 상위디렉토리 staged→7f936fa에 validate→type 109파일 혼입(나중 정리 예정, 사용자 승인). **규칙: git add는 명시 경로만, `..` 금지. `git diff --cached --stat` 별도 호출로 확인 후 commit.**
> **assessment SC2 완결(f4692e3):** 8 서비스 — set(create/update)·case(update)·session(update)·send_link/result(create)·analyze(schedule/participant). facade가 pydantic 검증 보존+primitive 언패킹, update_set은 `**model_dump(exclude_unset, exclude={assessment_ids,center_member_ids})`, session handler가 status enum 언패킹(omit/None/value 동치). **analyze 2종 = case(Model)+primitive in**(pydantic 인자만 제거, 본문 불변). unit 17 passed. counseling 동명 UpdateSessionService 무관(별 모듈).
> **다음 SC2 후보:** notice §1(S1+SC2 복합) · client(4)·voucher/billing/platform_admin batch·대량 뒤로. (소형 SC2 소진 — auth·person·form·counseling·center·assessment 완료.)
> **§1 SC2 후속 진행(S1 완료 후):** ✅ notice 2(3db0ca3) · ✅ platform_admin/cs_memo 2(a83c81a) · ✅ platform_admin/admin_account_management 3(dba7752) · ✅ voucher/client_voucher 2(306cd06 — update는 merged 무결성 재검증 보존) · ✅ voucher/center_voucher 2(ab648c5). **패턴 재확인:** current_admin/current_user dict는 SC2 대상 아님(pydantic Create/Update/Request만), 유지. handler/facade가 schema 언패킹(create=명시 필드, update=`**model_dump(exclude_unset)` + service unset 기본값, enum=.value). @model_validator는 schema(router) 보존. **SC2 잔여 = billing 7 · client 4(batch 8 호출처 위험, 단건 facade + ClientCreate 빌드 매핑, batch 무테스트).**
> **document §5-1 완결(4dcac55):** include_deleted bool 토글 → 이름 분리. document/document·global_document repo가 active(base sugar 자동 soft-delete) + `*_including_deleted`. service는 API 토글(bool) 유지+이름 분기, Restore·runtime extraction은 including 직접. repo include_deleted 0, unit 68+71 passed. **남은 §5-1 = voucher/voucher·voucher/voucher_document(voucher 모듈 슬라이스).** §10 Model-mutate(document delete/restore)는 별개 미해결.
> **platform_admin §5-2(5f02f47):** notice·cs_memo find_active(순수 중복, get_active 내부 전용) 제거 → get_active가 base find_by_id 직접 호출. **get_active는 keeper로 교정** — 커스텀 한국어 404 메시지라 base get_by_id 동치 아님(메시지=동작 보존).
> **voucher §5-2 완결(734cc9e):** client_voucher·center_voucher의 find_active+get_active **둘 다** 삭제(get_active 메시지가 base `{model.__name__} not found`와 정확 동치). 호출처 17곳 `X_id=`→`id=` base 리네임(정규식 일괄, 멀티라인 포함), center_voucher orphan import 제거, consume_sessions_locking 테스트 get_active→get_by_id. voucher unit 71 passed. **§5-2 주 대상 전량 완료.**
> **§5-2 완전 종결(bbfa251+판정):** 잔여 2건 keeper 확정 — center/center get_active(커스텀 메시지+이미 base find_by_id 내부)·voucher_extraction get_active(find_by_id_all_states+deleted 필터, 다른 로직). 코드 변경 불필요. **§5-2 전체 done.**
> **§5 전체 완결(d5007c4):** §5-1 voucher(find_pair active+`_including_deleted`, list_many_by_ids는 dead라 toggle만 제거) + §5-2 전량. **§5(repository 드리프트) done.**
> **§7 완결(no-op):** route description 10건 전수 keeper, 코드 변경 없음.
> **§6 완결:** §6-1 철회 + **§6-2 빈 서브모듈 __init__ 93개 삭제(6170378)** — submodule 52·services/ 22·handlers/ 19, boot OK·unit 367 passed(선행 실패 1 무관). namespace package(PEP420) 동작 검증됨.
> **다음 후보(전부 비-기계적, 신선한 집중):**
> **§3 완결(98b1556):** facade/dtos.py 3개 → facade/schemas.py rename(사용자 결정 ⓐ co-located), import 11곳 .dtos→.schemas, 빈 dtos/ 8개(pycache) 삭제. dtos 표면 0, boot OK, unit 21.
> **§2 완결(no-op, 사용자 결정 write-only):** 37건 전수 분류 — foreign-도메인 write-bypass 0건. write는 이미 owning facade 경유, foreign repo는 read-enrichment(D1 인정)·같은도메인(D2)·admin-read(D3). verify를 write-cross-module로 재정의. 코드 변경 없음(§7처럼). cross-module-write.md는 이미 write-only라 규칙 변경 불요.
> **center S1 완결(92552b2):** GetNotePreferenceService Model-out(부재→기본 Response는 handler 세션내 직렬화). center S1 1건 done. **S1 잔여 42**(billing 15·platform_admin 13·voucher 9·notice 4·assessment 1).
> **S1 후보 성격:** notice 4서비스 = **S1+SC2 복합**(get_notice siblings 조립 130줄·list enrich·create/update SC2) → 한 모듈 패스로 신선한 집중. assessment get_assessments(1) = **AssessmentSummary가 내부 projection**(snapshot dict 빌드용, 8 facade 호출처가 .model_dump) — HTTP-Response 누수라기보다 projection DTO라 S1 적용 가치 재판단 필요(판단). billing/platform_admin/voucher = 대형 per-module.
> **다음 후보:** §1 S1 모듈(notice 복합 / billing·platform_admin·voucher 대형, 각 신선한 집중)·§4 eventing(최고 위험, 3단계). **완결: §2·§3·§5·§6·§7 + §6-1 철회 + center S1. 남은 건 §1 S1 42(+복합SC2)·§4뿐.**
> **notice §5-2 완결(d90dc3b):** NoticeRepository.find_active = `_find(where=[id])` = base find_by_id 정확 동치 → 래퍼 삭제, delete/update_notice 호출처 base로. find+raise(§4)·커스텀 메시지 보존. notice 단위테스트 없음(boot OK). **남은 §5-2 = platform_admin/notice·voucher/client_voucher·voucher/center_voucher·platform_admin/cs_memo.**
> **§6-1 철회(2026-06-29 사용자 결정):** "import 없으면 __init__ 없어도 됨" — re-export는 소비처가 정한다. 대상 4모듈(form·llm·voucher·platform_admin) 전부 루트 소비처 0 확인 → 빈 __init__ 유지가 정상, P1=no-op. package-init.md §2 반영("빈 __init__ 금지" → "소비처 0이면 빈/부재 허용"). **D2(§6-2 서브모듈 빈 __init__ 삭제)는 PEP420이라 여전히 유효.**
> **다음 모듈 후보(Phase B):** 기계적 잔여 = §5-2(platform_admin/notice·cs_memo, voucher/client_voucher·center_voucher 래퍼)·§7 route desc·§6-2 서브모듈 init 삭제(codemod). 또는 emit 마이그(§4-A). 복합 SC2(notice §1 S1+SC2·client batch·voucher/billing/platform_admin)는 신선한 집중에서.
> **남은 전역(Phase C·D):** C=재배선/teardown(모든 emit 후) · D=서브모듈 __init__ 75·dtos·cross-module.
> **주의:** client/agent events.py는 아직 `*Event`(Phase B에서 리네임+구조이동). activity_log events.py는 teardown까지 그대로.
> **검증 환경:** pytest는 `.venv/bin/python -m pytest`(시스템 python엔 jose 미설치).
> **모듈 본문 진입 조건:** A1·A2 완료 후. 첫 모듈 = client(파일럿 정본 — 기존 `*Event` facade-wrap을 `*Atomic` service-emit으로 전환).
> **eventing 파일럿 기존자산:** client create/update 2/4 done(옛 facade-wrap). 통합테스트 `tests/integration/test_activity_audit.py` 3 green.
> **독립 우회로(막히면):** Phase D — D1 서브모듈 __init__ / D2 dtos. 선행조건 없음, Phase A 없이도 착수 가능.
> **미결정 차단:** F1/F2·M1/M2·A4·비-admin JOIN 닿으면 정지·기록(이 loop에서 결정 안 함).

---

## 제약

- git 로컬 커밋만. push/fetch/pull/reset 금지(PreToolUse hook 차단). 원격 동기화 필요 시 사용자에게 알린다.
- 한 사이클 = 한 슬라이스 = 한 커밋. 되돌리기 어려운 대량 변경(codemod §6-2·§3)은 착수 전 규모 고지 + import/boot 검증 동반.
- 진행 상태는 **커서 + todo 체크박스**로만 갱신. AUDIT 로그는 불변(건드리지 않음).
