---
paths:
  - "apps/api/app/modules/event/**/*.py"
  - "apps/api/app/application/events/**/*.py"
  - "apps/api/app/application/reactions/**/*.py"
  - "apps/api/app/application/handlers/activity/**/*.py"
  - "apps/api/app/worker/**/*.py"
  - "apps/api/app/infrastructure/persistence/unit_of_work.py"
---

# Eventing — 도메인 이벤트 아웃박스 + 워커

도메인 사실을 일급 이벤트로 기록하고, 반응(알림·감사·무거운 처리)을 tx 밖에서 유실 없이·재시도 가능하게 실행한다. **producer는 데이터와 같은 tx로 handler 사건 event를 정확히 한 번 emit하고 부수효과는 직접 호출하지 않는다** — 워커가 반응으로 처리.

코드 예시: [documents/eventing/](../../documents/eventing/README.md). 결정이력: [layer-conformance](../../loop/archive/layer-conformance.md)(종결). tx 경계 [service.md](service.md)·[application.md](application.md).

---

## 이 문서

| 섹션 | 핵심 |
|------|------|
| 2-트랙 | 도메인 이벤트(LISTEN/NOTIFY) + AI 잡(Redis). Track B는 진입점 아닌 실행 백엔드 |
| 아웃박스 | `emit`(INSERT+`pg_notify`)은 비즈데이터와 같은 tx. 전달 = NOTIFY + sweeper |
| 테이블 | `events`(lifecycle) · `event_atomics`(사실+payload) · `event_reactions`(반응 결과) |
| producer | service=atomic / handler=event / facade=pass-through. 마커 `*Atomic`. emit은 항상 pending(reaction 판정은 워커) |
| consumer | claim(lease) → combine → 반응(fan-out) → finalize. `transactional_uow` |
| 멱등성 | 순수 DB = tx+체크포인트. 외부 횡단만 멱등 필요. 재시도 = sweeper+backoff |
| reject | 거부하되 흔적 보존 = `reject(exc)`(현재 tx commit + raise) |
| 매핑 | 중앙 `EVENT_REACTIONS` dict. 반응 = 워커가 트리거하는 application handler(facade만) |
| behavior | producer=server `behavior.request`(tx 소유·tx-free handler). consumer=worker `use_event_action` |
| activity_log 흡수 | `@audit_log` 폐기 → atomic이 audit 정본. read = event_atomics 직접 조회 + 표현 재구성. §10 |

---

## 1. 2-트랙

| | Track A · 도메인 이벤트 | Track B · AI 잡 |
|---|---|---|
| 큐 | PostgreSQL LISTEN/NOTIFY | Redis Stream(`ai:jobs`) |
| 무게 | ms~수초(알림·감사·메일) | 수십초~분(STT·LLM), progress 필요 |
| rule | 본 문서 | 기존 [infrastructure.md](infrastructure.md) 유지 |

- **단일 진입점 = Postgres outbox.** 모든 비동기는 `emit`(in-tx)으로 들어온다. Track B는 **병렬 진입점이 아니라 실행 백엔드** — reaction이 enqueue할 때만.
- **요청 핸들러는 Track B로 직접 dispatch 금지** — reaction만(§4). 이로써 AI 잡도 at-least-once·재시도(커밋-후-dispatch 유실 갭 제거).

## 2. 아웃박스

`emit`은 **event 모듈 handler**(`modules/event/event/handlers/emit.py`) — 타 모듈 핸들러가 직접 호출. **요청당 `event_group_id`로 `events` 한 행을 plain INSERT하고, 그 handler 실행에서 수집한 `event_atomics`를 INSERT한다.** 같은 그룹의 두 번째 non-empty emit은 PK 충돌로 전체 tx가 실패한다. **emit은 pg_notify 하지 않는다.**

**dispatch(notify)는 behavior.request가 커밋 뒤에.** server의 `RequireDispatch`(behavior.request 커밋 후 act)가 `Event.dispatch_event(event_group_id)` → `pg_notify('event_group', {group_id})`(별도 세션). 커밋된 뒤에만 도달(롤백 시 skip)이라 유실 갭이 생기나 **sweeper가 보강** — `pending`(+lease 만료 `claimed`)을 주기 재-NOTIFY(APScheduler). `event_group_id`는 `RequireEventGroup`이 요청당 발급([behavior.md](behavior.md) §4).

> ps와 같음(커밋후 dispatch). in-tx pg_notify(갭 없음)와의 트레이드오프는 sweeper로 메움.

**emit은 reaction 유무를 모른다 — 항상 `pending`.** emit은 사실(atomic)만 기록하고 `events`는 `pending`으로 넣는다. "이 이벤트에 반응이 있나"는 워커(`dispatch`, application — `EVENT_REACTIONS`를 정당하게 봄)가 판정 — 반응 없으면 succeed, 있으면 실행(§5). 아래 레이어(emit)가 위 레이어(application) 지식을 끌어오는 우회(레지스트리·주입)를 두지 않는다.

> audit-only(반응 없음, 대다수)도 워커가 한 번 claim→succeed 한다(churn). 이게 측정으로 병목이 되면 그때 최적화(호출처가 dispatch 필요를 명시하는 식)를 넣는다 — 미리 terminal/레지스트리를 두지 않는다(추측성 최적화 회피).

## 3. 테이블

`app/modules/event/` 3 서브모듈, `event*` 패밀리(서브모듈·클래스 단수, 테이블 복수). UUID PK·soft-delete·FK 없음. `center_id`·`actor_id` **nullable**(플랫폼/인증은 null; RLS 없어 반응이 명시 전달). `act`·`entity_name`·`name`은 **plain str**(VO 미사용). 전체 스키마 [schema.md](../../documents/eventing/schema.md).

- **`events`** = dispatch lifecycle만(**payload 없음**): `name`(라우팅)·status(pending→claimed→succeeded/failed)·`attempts`(JSONB 로그)·`max_attempts`·`claimed_at`(lease)·`succeeded/failed_at`·`next_attempt_at`(backoff). 재시도 캡은 도메인(`fail`)이 소유.
- **`event_atomics`** = 사실+데이터(불변, append-only): `event_id`·`sequence`·`act`·`entity_name`·`entity_id`·`payload`(그 엔티티 평문, **민감값 금지**)·`actor_id`. 반응 데이터·엔티티 감사 둘 다의 출처.
- **`event_reactions`** = 반응 결과: `event_id`·`reaction`(=반응 `__name__`)·`ok`·`error`. UNIQUE(event_id, reaction). §6 재개 체크포인트.

> **ps와 분기**: ps는 payload를 `Event.payload`로 병합, 우리는 atomic에 저장 + dispatch가 읽기 시점 combine(§5). 데이터 위치(audit=per-atomic)와 읽기 모양 분리.

> **`@audit_log` 대체**: `event_atomics`가 audit 정본(act·entity_name·entity_id·actor). 저장 자체가 audit이라 audit 반응 불필요 — 전체 설계(write·read·보존)는 §10.

## 4. producer

**발행 책임 = service는 atomic, handler는 event, facade는 pass-through.** handler는 tx 경계를 갖지 않는다([behavior.md](behavior.md) §4, [service.md](service.md) §7).

| 레이어 | 책임 |
|--------|------|
| **service** | **atomic 생성** (mutation 1 = 사실 1). `1 execute = 1 atomic`. read/list service는 atomic 없음 |
| **handler** | **event emit** (유일 주체). atomic들을 묶어 한 event명으로. 단건=atomic 1, **bulk=한 event + N atomics** |
| **facade** | service 조립 + atomic **pass-through** (마커 생성·emit 안 함) |

- **마커** = 순수 `{Module}Atomic`(모듈 옆, IO·타모듈 0): `payload()`(자기 평문, read act은 `{}`=로그용)+`act/act_entity_name/act_entity_id`. 팩토리는 `(atomic, model)` 반환. 네이밍 `*Atomic` — emit `atomics=` 파라미터·`event_atomics` 테이블과 정합(마커는 atomic이지 event가 아니다; event는 handler가 emit).
- **service가 atomic 생성** — repo 변경 직후 마커를 만들어 `(atomic, model)` 반환. mutation 지점이 사실의 출처.
- **예외: 크로스모듈 조율 감사 = application handler가 생성**. platform_admin 운영자 동작이 **타 모듈 facade를 조율**(notice·form·voucher·subscription 등)하면서 `AdminAuditAtomic`(감사 봉투)을 남길 때, 그 조율 핸들러는 [cross-module-write.md](cross-module-write.md) §L17대로 **`application/handlers/`** 소유이고 atomic도 거기서 생성·emit한다. 이유: `AdminAuditAtomic`은 platform_admin 소유라 `{Module}Atomic`(타모듈 0)처럼 도메인 모듈 service로 못 내린다 — 조율층(application)이 유일한 정당 위치. 선례 `approve_credential`·`terminate_center`.
- **platform_admin 자기 엔티티 CRUD**(faq·inquiry delete·plan_config·platform_settings)는 지속층 신설 완료 — service가 atomic 생성(위 원칙). answer_inquiry는 notification 조율이라 application/handlers/support로 이동.
- **facade는 pass-through** — facade 있는 모듈은 facade가 service의 `(atomic, model)`을 **전달만** 한다(마커 생성 금지). service를 여러 호출처가 재사용해도 ripple 없음.
- **handler가 그룹 emit** — service들의 atomic을 모아 `emit(uow, name, event_group_id=ctx.event_group_id, atomics=[...], center_id=, actor_id=)` **정확히 한 번**. **bulk = service N회 호출 → atomic N개 수집 → event 1개**(한 트랜잭션의 다중 사실). 다중 엔티티도 동일. 부수 사실마다 act별 event를 추가 emit하지 않는다.
- **같은 `entity.act` atomic N개는 중복이 아니다** — 각 atomic은 서로 다른 mutation 입력·대상을 나타내는 원자 사실이다. bulk와 다중 엔티티 흐름은 전량 보존하며, 동일성은 문자열 키가 아니라 실제 사실로 판단한다.
- **emit을 `if atomics`/`if atomic`으로 가드하지 않는다** — 빈 atomics·None 원소 처리는 `emit`이 소유(빈 list·None 걸러 no-op, 유령 이벤트 미생성). bulk가 전부 skip돼 atomic 0개여도, 조건부 생성 atomic이 no-op이라 None이어도 handler는 그냥 `atomics=[atomic]`으로 `emit(...)` — `if atomic`로 단건 가드하지 말 것(emit이 None을 걸러 empty로 수렴).
- **크로스모듈 워크플로 = application handler가 owning facade들의 atomic을 모두 수집해 handler 사건 event 한 번으로 emit** — session·schedule 등 facade가 돌려주는 `(atomic, …)`을 `_`로 버리지 않는다(미완 마이그레이션의 흔한 결함). 각 부수 사실은 event 이름이 아니라 atomic `entity.act`로 표현한다. 마커 없는 엔티티(`events.py` 없음)는 미발행 — 발행하려면 마커 신설(별도 결정). [cross-module-write.md](cross-module-write.md)·[application.md](application.md).
- **bulk read-mutation의 per-row atomic = repo `RETURNING`** — mark-all 류는 `UPDATE … RETURNING <Model>`로 영향 행을 받아 service가 per-row atomic을 만든다. rowcount만 반환하면 atomic 0개라 사실이 누락된다(bulk=1 event+N atomics 위반). [persistence-repository.md](persistence-repository.md).
- **이벤트명 = handler 사건 리터럴**(`"widget_created"`), 형태 `{noun_snake}_{verb_past}` — handler 동사가 [naming.md](naming.md) §3 계층 전이표대로 그대로 흐른다. emit·`EVENT_REACTIONS` 양쪽에 직접 두고 공유 상수는 안 둔다. 복합 handler의 부수 사실 이름을 event명으로 채택하지 않는다. **`notify_single_member(event_type=...)` 알림 타입과는 별개 네임스페이스** — 문자열이 같아도(`case_created` 등) emit 도메인 이벤트명과 혼동 금지.

## 5. consumer

워커 진입 = behavior `use_event_action`([behavior.md](behavior.md) §6): **claim → run(yield Scope) → succeed/fail**. run 안에서 `dispatch(scope)`가 반응 라우팅:

1. **find** — `scope.uow`로 event(name) + atomics 로드, combine → `{entity.act:[payload]}` plain dict.
2. **route** — `EVENT_REACTIONS[name]`(없으면 무반응 → succeed).
3. **반응** — 반응마다 **독립 `transactional_uow`**(run+mark 한 커밋), `completed()`의 done은 skip. fan-out = `Input.from_event(combined)` list를 item마다 `run`.
4. **실패 집계** — 하나라도 실패면 dispatch가 raise → behavior가 `fail`(attempts++/backoff). 성공분 mark는 유지 → 재시도 시 skip(격리·재개).

`center_id`/`actor_id`는 claim 행에서 읽는다(NOTIFY payload 불신). 워커 프로세스 = `app/worker/event/`(asyncpg LISTEN + Pool + Lifecycle + sweeper, ps 이식), 기존 Redis(Track B) 워커와 별 프로세스(`python -m app.worker.event`).

## 6. 멱등성

재시도·sweeper로 반응은 두 번 이상 실행될 수 있다.

- **순수 DB 반응 = tx + `event_reactions`로 완결** — 커밋 전 크래시는 전체 롤백 → 깨끗한 재시도, **추가 멱등 불필요**.
- **멱등은 "외부 시스템 횡단" 반응뿐** — Track B dispatch·발송은 tx 밖 dual-write. **executor status-skip(필수)** + job_key/send-key(`SET NX`/`event_ref` — 중복 큐잉/발송 방지, 최적화). event_reactions는 *반응 resume* 담당, 횡단 중복은 못 막음.
- **재개** = `event_reactions` 체크포인트(ok 반응 skip). 핸들러 내부 스텝 분기 금지(분해/체인으로).
- **재시도** = sweeper-driven + `next_attempt_at` 지수 backoff. `fail`은 재-NOTIFY 안 함(storm 방지).
- **실패**(max_attempts 소진) = `failed` 종료, 수동 replay(성공 반응 skip).
- **반응 독립** — 이벤트 간 순서 무보장. 의존은 반응 체인.
- **payload 계약** = producer `payload()` ⊇ 반응 `Input` 필드. **규율+코드리뷰**(자동 동기화 없음; 불일치 시 `from_event` 런타임 실패라 조용한 드리프트 아님).

## 7. reject

"거부하되 보안/감사 흔적 보존"(로그인 잠금·실패카운터) = `reject(exc)` = **현재 tx commit + raise**. 정상(commit)·예외(rollback)와 구분되는 세 번째 outcome. 흔적이 요청 자신의 실패를 넘어 생존해야 하는 [behavior.md](behavior.md) INV-tx 티어3 사례.

## 8. 매핑

중앙 `EVENT_REACTIONS = {event_name: [Route]}`([application/events/routes.py](../../../apps/api/app/application/events/routes.py)). **dict가 반응 핸들러를 import → 참조=등록**(데코레이터 import-fragility 없음). 키 = **handler가 유일하게 emit한 사건 이벤트명**, 반응 식별자(체크포인트 키) = `Route.name` 또는 `handler.__name__`.

`Route(handler, source, project)` — `source`=`"{entity}.{act}"` 결합 키, dispatch가 그룹의 combined atomics에서 source 매칭 payload **마다** `handler(uow=…, center_id=…, **project(payload))` 호출(fan-out). `project`는 payload→kwargs 사영 람다(updated act는 `p["result"]`, 나머지는 `p["data"]`).

**반응 = 워커가 트리거하는 application handler** — 타 모듈은 **facade만**([cross-module-write.md](cross-module-write.md)·[application.md](application.md)). 예외: `notification.helpers`의 알림·발송 함수는 워커 경유 handler(reaction·cron job) 본문이 직접 소비한다([worker.md](worker.md) 발송 표면 예외와 같은 결, 2026-07-28 성문화 — 인앱 생성+외부 dispatch가 한 표면). 반응이 mutation을 만들면 부모 `event_group_id`를 재사용하지 않고 신규 child group을 발급해 event를 emit한다(체인 — 커밋 뒤 dispatch, sweeper가 보강). 외부 호출은 멱등(§6, 인앱 event_ref가 send-key).

## 9. behavior

[behavior.md](behavior.md)가 트랜잭션 scope를 소유 — **producer·consumer 모두 채택**(ps `behavior/` 이식).

- **producer = server `behavior.request`** — 요청 tx + 인증·게이트(`Require*` actions) + `RequireDispatch`(커밋 후). handler는 tx-free.
- **consumer = behavior(worker)** — claim→run(dispatch)→finalize.
- 세션 레이어는 `transactional_uow`(request·워커 자동 commit) + `UnitOfWork.reject`(§7) + stream 수동 커밋(behavior.stream). 레거시 `get_uow`/`get_aow`는 소비 소진으로 제거됨(2026-07-28).

## 10. activity_log 흡수 — event_atomics가 audit 정본

`@audit_log`(구 `security/audit.py`, 별도 세션 fire-and-forget — 제거 완료)를 폐기하고 audit를 event로 일원화한다. 별도 감사 쓰기 없음 — **도메인 event가 활동 한 건이고 그 atomics가 상세 변경 내역**이다(저장 자체가 audit).

### write — integral(같은 tx)

핸들러가 emit하면 그 atomic이 audit fact다. emit은 비즈데이터와 **같은 세션·같은 tx**(§2)라 "비즈니스만 커밋되고 audit만 유실"이 Postgres tx 원자성으로 **구조적 불가** — `@audit_log`의 별도-세션 유실(`get_audit_logger`)을 닫는다([behavior.md](behavior.md) §4 `audit()`도 같은 동기). 마커 매핑:

| `@audit_log` | atomic |
|---|---|
| `action` | `act` |
| `entity_type` | `entity_name` |
| `entity_id`(param) | `entity_id` |
| `extra` | `payload` — created/deleted=`{"data":…}`, updated=`{"input":…,"result":…}`, **민감값 금지**(§3) |

- **updated `input` = `exclude_unset=True` 델타** — 호출자가 실제 바꾼 필드만(`data.model_dump(mode="json", exclude_unset=True)`). 옛 `@audit_log`의 전체 덤프와 구분 — audit가 "무엇이 바뀌었나"를 보이게.

### read — events 페이지네이션 + atomics 상세 + 표현 read 재구성

fact만 저장하고 화면용(category·summary·actor_name)은 **read에서 만든다**(저장 안 함 — atomic을 lean하게):

| 화면 필드(`ActivityLogResponse`) | 출처 |
|---|---|
| id / event_name / created_at / center_id / ip_address | event 그대로 |
| changes[] | event에 속한 mutation atomics 전량(action·entity_type·entity_id·extra·summary) |
| action / entity_type / entity_id / extra | 대표 atomic(sequence 0) 호환 필드 |
| category / summary | 대표 atomic의 `(entity_name, act)` 표현 맵 |
| actor_name | `actor_id` → Member→Person 일괄 조회 (read 시점 = **live name**, write 스냅샷 아님) |

- **조회 위치** = event 모듈 `query_audit`(필터와 페이지네이션은 distinct event 기준, 선택된 event의 mutation atomics 전량 로드) → application `list_activity`(actor_name 조립) → `ActivityLogResponse`. `total`도 event 수다.
- **`query_audit` 반환 = `AuditEvent` DTO**(ORM 아님). `AuditEvent.atomics`에 `AuditAtomic` DTO를 담아 application은 모델을 import하지 않는다.
- **AI gateway 호출은 예외 저장 경로** — 호출마다 child event를 만들지 않고 기존 `llm_calls` 행을 활동 read에서 event 모양(`llm_call_recorded`, `changes[]`)으로 병합한다. 크레딧 차감 atomic은 이 행의 `credits_charged`로 표현한다.
- **표현 맵** = `application/handlers/activity/labels.py`(기존 audit.py KO맵 이동).

### 보존 — 신규만 대체 (backfill 없음)

과거 `activity_logs`는 **backfill·drop 안 함**(신규만 event로). 모듈을 묘비로 축소:

- 남김: `modules/activity_log/legacy/model.py`(테이블 정의만). 삭제: router·facade·service·handler·repository·schemas·events·agent_facade.
- 모델 등록 import([env.py](../../../apps/api/migrations/env.py)·dev [init-schema.py](../../../infra/dev/init-schema.py)·[lifecycle.py](../../../apps/api/app/server/lifecycle.py)) 새 경로로(§8 함정). 테이블명 `activity_logs` 불변 → DB 마이그레이션 없음.
- live read는 event_atomics만 — 과거 행은 화면에 안 보임(필요해지면 두 출처 union).

## 안티패턴

- audit를 별도 세션/fire-and-forget으로 → 유실·거짓. emit은 같은 tx integral(§10).
- atomic에 category/summary/actor_name 저장 → fact만. 표현은 read 재구성(§10).
- **facade가 마커 생성** → service가 atomic 생성(facade는 pass-through). 마커 클래스 `*Event` → `*Atomic`(§4).
- bulk를 atomic당 event N개로 → **한 event + N atomics**(handler가 수집해 emit 1회)(§4).
- 크로스모듈 워크플로가 facade atomic을 `_`로 버리거나 act별 event를 여러 번 emit → 모두 수집해 handler 사건 event 한 번으로 emit(§4).
- bulk read-mutation이 rowcount만 반환 → `RETURNING <Model>`로 영향 행 받아 per-row atomic(§4).
- agent mutation 소비 facade에서 직렬화 제거(P3 전) → thin `*_with_response` 브리지 유지([facade.md](facade.md) §2).
- 호출처가 `if atomics:`/`if atomic:`로 emit 가드 → 그냥 `emit(...)`. 빈 처리는 emit이 no-op으로 소유(§4).
- emit이 reaction 유무를 판정(terminal/레지스트리/주입) → emit은 항상 pending, 판정은 워커(application)가(§2·§5).
- `query_audit`가 ORM `EventAtomic` 반환 → `AuditAtomic` DTO(application model-free)(§10).
- emit(INSERT)을 비즈데이터와 **다른 tx**로 → 아웃박스 깨짐. notify는 `RequireDispatch`가(§2).
- emit이 직접 `pg_notify` → dispatch는 `RequireDispatch`(커밋 후)가(§2).
- emit을 infra `UnitOfWork`/application에 → 역참조. **event 모듈 handler**(§2).
- `RequireDispatch` **누락** + sweeper 없음 → 워커가 영원히 안 깸(§2).
- handler가 `commit`/`async with uow` → tx는 behavior.request 소유([behavior.md](behavior.md)).
- 무거운 AI를 Track A 반응에서 **직접 실행** → Track B enqueue.
- 워커 진입을 비즈로직 **직접 실행**으로 → claim/재시도/감사 잃음. dispatch 경유(§5).
- combine을 claim 블록 **밖**에서 → detached-ORM. 블록 안 plain dict(§5).
- 다단계 반응에 **핸들러 내부 스텝 분기** → 분해/체인. 재개는 체크포인트(§6).
- 외부 횡단 반응 타깃이 **멱등 아님**(status-skip 없음) → 재시도 중복 실행(§6).
- 반응이 타 모듈 repo/service **직접 접근** → facade만(§8).
- 반응이 다른 반응에 **의존**(등록 순서 가정) → 독립/체인(§6).
- payload에 **민감값** → 평문만(§3).
- 멀티커밋·즉시커밋(SSE) 흐름에 `behavior.request` 강제 → 요청-끝-단일커밋이라 표현 불가. `behavior.stream` + `get_aow`(behavior.md SSE 절).
