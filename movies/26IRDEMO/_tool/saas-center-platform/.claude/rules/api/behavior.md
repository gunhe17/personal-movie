---
paths:
  - "apps/api/app/behavior/**"
  - "apps/api/app/core/behavior.py"
---

# behavior — 요청·이벤트 파이프라인

요청·이벤트소비의 **트랜잭션 경계·생명주기**를 소유한다. handler는 behavior가 연 `Context`(ctx) 안에서 **tx 없이 작업만** 한다. 모든 단계(인증·센터·권한·기능·이벤트)는 **Action**이고, endpoint가 bare action(`authenticate()`·`require_membership()` 등)으로 **명시 선언**한다 — 고정/암묵 파이프라인 없음. ps `behavior/` 이식.

- **server**(facade `behavior`) = HTTP 요청: requires apply → 순서대로 act → `Context` yield → (커밋 후) dispatch.
- **worker** = 이벤트 소비: claim → run → succeed/fail.

루트: handler tx [service.md](service.md) · 이벤트 흐름 [eventing.md](eventing.md). SSE/WS는 `behavior.stream`(아래).

---

## 이 문서

| 섹션 | 핵심 |
|------|------|
| 구조 | `action/`(resolver + Require*) · dsl(bare 팩토리) · server · worker · core 추상 |
| core 추상 | Memory·Action·Context·Behavior |
| Action | apply(활성화)·act(집행). Require* ↔ bare 팩토리 |
| server flow | requires apply → `if is_active` act → Context |
| endpoint | bare action으로 모든 단계 명시 선언 |
| worker | Act(claim/succeed/fail) + use_event_action |

---

## 1. 구조

```
behavior/
├── action/
│   ├── account.py    AccountContext(resolver) + RequireAuthentication + RequireAppAuthentication(내담자 앱 JWT aud=client_app — [global-module.md](global-module.md))
│   ├── admin.py      AdminIdentity(resolver) + RequireAdminAuth + RequireAdminRole
│   ├── center.py     CenterContext(resolver) + RequireCenter + helper
│   ├── event.py      EventGroupContext(resolver) + RequireEventGroup + Event + RequireDispatch
│   ├── feature.py    RequireFeature
│   ├── gate.py       RequireGate (machine entry — webhook/cron verify)
│   ├── permission.py RequirePermission
│   ├── quota.py      RequireQuota (AI 크레딧 사전 게이트 — AIFacade.verify_quota+기간정산, [ai-calling.md](ai-calling.md))
│   ├── rate_limit.py RequireRateLimit
│   ├── dispatcher.py RequireTaskDispatcher + RequireBatchDispatcher (워커 잡 디스패처 주입)
│   └── act.py        Act — 워커 이벤트 lifecycle (서버 파이프라인 아님)
├── dsl.py            bare action 팩토리(authenticate/require_membership/with_dispatcher/... → Require*)
├── server.py         ServerMemory + Server(request/request_unscoped/request_admin/stream/stream_unscoped)
├── worker.py         use_event_action / use_cron_action
└── common/exception.py  UnauthorizedError·ForbiddenError
```

- resolver = `*Context`(dataclass + `.setup`, 인증·멤버십 해석), action = `Require*`, helper = `_*`.
- resolver `*Context`는 core `Context`(핸들러가 받는 `ctx`)와 다른 것 — 헷갈리지 말 것.

## 2. core 추상 ([core/behavior.py](../../../apps/api/app/core/behavior.py))

| 타입 | 역할 |
|------|------|
| `Memory` | 파이프라인 컨텍스트 베이스. `activate`/`is_active`(활성 action 집합). 실행 맥락별 서브클래스가 쓸 키를 **타입 속성**으로 정의 |
| `Action` | 단계. `apply(memory)` 기본 = `activate(type(self))`. `act`는 각 action이 정의 |
| `Context` | 핸들러 scope **마커 베이스**(빈 클래스). 필드는 Behavior 주체별 서브클래스가 소유 — 서버 요청은 `ServerContext`([server.py](../../../apps/api/app/behavior/server.py)) |
| `ServerContext(Context)` | **center flow**(`request`/`stream`)가 yield — 멤버십 해석 완료라 `center_id`·`account_id`·`person_id`·`actor_id`·`role_code`·`permissions`·`permissions_version`·`access_level`가 **non-optional 보장**(`owner_scope`만 semantic null)·`event_group_id`·요청 메타 `ip`/`user_agent`(접근 기록용 — 2026-07-28 `get_client_info` Depends 수렴). **식별 키 + authz 파생 + 요청 메타만**(profile 아님). endpoint는 `ctx: ServerContext` |
| `UnscopedContext(Context)` | **request_unscoped**(center에 대한 unscope — account/machine)가 yield — center 필드 없음. `person_id`·`account_id`(account면 채움, machine은 None)·`event_group_id`. endpoint는 `ctx: UnscopedContext` |
| `AdminContext(Context)` | **request_admin**(플랫폼 운영자 flow)가 yield — RequireAdminAuth 뒤라 `admin_account_id`·`email`·`role` **non-optional 보장**(center 없음)·`ip`·`event_group_id`. endpoint는 `ctx: AdminContext` |
| `Behavior` | Server·Worker 베이스 |

**scope 축 ↔ flow**: scope = **center(테넌트)에 묶이는가**. 각 scope 레벨은 `request_*`(transactional)·`stream_*`(SSE 수동커밋) 쌍으로 같은 타입을 yield한다.

| scope | 묶임 | request | stream | yield |
|---|---|---|---|---|
| center | 테넌트 + 멤버 신원 + authz | `request` | `stream` | `ServerContext` |
| unscoped | center 없음 (account 신원 / machine gate) | `request_unscoped` | `stream_unscoped`(미구현) | `UnscopedContext` |
| admin | 플랫폼 운영자 토큰 (center 없음) | `request_admin` | — | `AdminContext` |

- `UnscopedContext`의 "unscoped"는 **center에 대한 unscope**다 — 비센터 요청. account 인증이면 `person_id`·`account_id`가 채워지고(그래서 필드가 있음), machine이면 None. account를 별도 타입으로 가르지 않는다 — 같은 비센터 scope이고 person_id 보장은 타입체커(CI 미적용)용 IDE 편의뿐이라 near-duplicate 타입 값을 못 함(사용자 결정).
- **admin은 별도 타입(`AdminContext`)으로 가른다** — account/machine과 **필드셋이 disjoint**(admin_account_id/email/role vs person_id/account_id)라 한 타입에 다 Optional로 쌓으면 주체를 못 말한다. center의 `ServerContext`처럼 non-optional 신원 보장. 감사는 handler emit(actor_type='admin'), `audit()`는 레거시(request_unscoped) 전용.

**scope 내용 규약**: `Context`는 **식별 키 + 테넌시 + tx + 상관키 + authz 파생값**을 담는다 — 모든 핸들러가 공통으로 쓰는 요청 좌표. `email` 같은 **profile/서술 데이터는 안 담는다**(account 모듈 소유 + 대부분 핸들러가 불필요 + staleness). **authz 파생값**(`role_code`·`permissions`·`owner_scope`·`permissions_version`·`access_level`)은 RequireCenter가 role 해석에서 산출 → scope에 포함(profile 아님). 단일 소비처(`me/get_my_permissions`가 auth scope를 프론트로 echo)뿐이어도, 그 기능이 **behavior 경계**(인증 해석 결과 노출, 비즈니스 아님)면 Context/action으로 둔다(사용자 결정 2026-06-26). 필요한 핸들러가 키(`account_id` 등)로 owning 모듈에서 조회한다. email이 **JWT claim이라 이미 디코드돼 있어도**, 또 **조회 키로 쓰이는 경우**(예: support의 email-keyed inquiry 조회)도 scope에 안 담고 `account_id`→email로 해소 — 한 모듈의 키잉 사정에 universal scope를 굽히지 않는다(사용자 결정).

- **`AdminContext`는 예외** — `email`·`role`을 담는다(위 email-금지는 center/account flow 규약). admin write는 거의 다 actor의 role(owner-scope authz)·email(created_by 스냅샷·감사)을 필요로 하고, admin 신원은 작아 near-duplicate 조회를 매 write마다 하는 게 손해. resolver `AdminIdentity`가 토큰에서 셋 다 디코드 → `AdminContext`로 pass-through(사용자 결정).

## 3. Action — apply / act

- **apply(memory)** = 활성화(`memory.activate(type(self))`). 설정 있는 action(`RequirePermission`/`RequireFeature`)은 override해 config도 주입(`m.required_codes = self.codes`).
- **act(memory)** = `@classmethod async`, **순수 집행**(검사 없음). resolver는 act 안에서 호출해 결과를 memory에(`m.center = await CenterContext.setup(...)`).
- **apply 검사는 flow가 명시**(`if memory.is_active(X)`) — act 안에 넣지 않는다.
- 식별 키 = **클래스 자체**(`type(self)`/`X`) — 문자열 이름 없음.
- Action 클래스는 `Require*`(불변). 선언용 팩토리는 [dsl.py](../../../apps/api/app/behavior/dsl.py)의 **bare 함수** — 의도를 드러내는 이름이라 클래스명과 1:1 아님(`RequireCenter`↔`require_membership`, `RequireAuthentication`↔`authenticate`, `RequireRateLimit`↔`throttle`, `RequireDispatch`↔`dispatch_events`). flow는 클래스로 매칭하니 이름은 무관.

```python
# good: 항상 도는 단계 — act는 순수, resolver 호출
class RequireCenter(Action):
    @classmethod
    async def act(cls, m: "ServerMemory") -> None:
        m.center = await CenterContext.setup(m.center_id, session=m.uow.session, account=m.account)

# good: 설정 있는 게이트 — apply가 config 주입, act가 검사
class RequirePermission(Action):
    def __init__(self, *codes: str): self.codes = codes
    def apply(self, m: "ServerMemory") -> None:
        m.activate(type(self)); m.required_codes = self.codes
    @classmethod
    async def act(cls, m: "ServerMemory") -> None:
        if "*" in m.center.permissions: return
        if not all(c in m.center.permissions for c in m.required_codes):
            raise ForbiddenError(...)
```

## 4. server — behavior.request flow

`ServerMemory(Memory)`가 파이프라인 컨텍스트 — 쓸 키를 **타입 속성으로 미리 정의**(`request·background_tasks·center_id·authorization·uow·account·center·admin·event_group_id·required_codes·required_feature·required_roles·gate·rate_limit·required_quota_purpose·dispatcher`). `session`은 `m.uow.session`으로만 닿는다(별도 키 없음).

```python
def request(self, *requires: Action) -> Callable[..., AsyncIterator[Context]]:
    async def dep(request: Request, center_id: str, authorization: str | None = Header(default=None)):
        memory = ServerMemory()
        memory.request = request; memory.center_id = center_id; memory.authorization = authorization
        for action in [*requires]:
            action.apply(memory)                              # 활성화

        if memory.is_active(RequireEventGroup):
            await RequireEventGroup.act(memory)
        async with transactional_uow() as uow:                # 요청 tx (커밋/롤백 소유)
            memory.uow = uow
            if memory.is_active(RequireAuthentication): await RequireAuthentication.act(memory)
            if memory.is_active(RequireCenter):         await RequireCenter.act(memory)
            if memory.is_active(RequirePermission):     await RequirePermission.act(memory)
            if memory.is_active(RequireFeature):        await RequireFeature.act(memory)
            if memory.is_active(RequireRateLimit):      await RequireRateLimit.act(memory)
            if memory.is_active(RequireQuota):          await RequireQuota.act(memory)
            if memory.is_active(RequireTaskDispatcher):  await RequireTaskDispatcher.act(memory)
            if memory.is_active(RequireBatchDispatcher): await RequireBatchDispatcher.act(memory)

            center = memory.center
            assert center is not None                         # RequireCenter가 먼저 채운다
            yield ServerContext(
                uow=uow,
                center_id=center.center_id, actor_id=center.member_id,
                permissions=tuple(center.permissions),
                event_group_id=memory.event_group_id,
            )
        if memory.is_active(RequireDispatch):                 # 커밋 후
            await RequireDispatch.act(memory)
    return dep
```

- **고정 파이프라인 없음** — endpoint가 넘긴 requires만 apply→active. flow는 모든 단계의 `if is_active`를 **고정 순서**로 나열(순서는 flow가 소유, 활성 여부는 endpoint가).
- tx 경계는 request가 소유 — handler는 tx 없음([service.md](service.md)).
- dispatch는 **커밋 후**(예외 시 skip) → emit은 INSERT만, notify는 `RequireDispatch`(`dispatch_events()`)가([eventing.md](eventing.md)). 갭은 sweeper 보강.

### 커밋 경계 이탈 — 되돌릴 수 있는 것만 감싼다 (INV-tx)

기본은 위 flow — **요청 끝 clean-exit 단일 커밋**. 이 기본을 벗어나는 것(조기·per-item 커밋·명시 rollback·reject)의 유일한 사유는 **효과가 tx 경계를 넘어야 할 때**다. 코드 모양·"부분 성공" 문구가 아니라 **부작용의 롤백 가능성**이 효과의 위치를 정한다:

1. **되돌릴 수 있는 DB 쓰기** → tx 안, 단일 커밋 (기본).
2. **되돌릴 수 없는 외부 효과(발송)** → tx 밖, 커밋 후 reaction + 멱등 (outbox, [eventing.md](eventing.md) §6). 사실(atomic)만 tx에 남기고 발송은 이후로.
3. **outbox로 못 미루는 예외** → 탈출한 만큼만 조기 커밋/롤백 + `# tx 예외:` 마커.

3번째 티어의 정당 사유 — 각각 "왜 경계를 넘나":

| 사유 | 처방 | 예 |
|---|---|---|
| 발송 결과 동기 반환 계약·문자가 산출물 | tx 안 동기 발송 — 커밋은 요청 끝 1회(발송 후 롤백 = 유령 발송 감수) | send 계열([application.md](application.md) §3) |
| 다른 세션이 먼저 관측(워커·게이트웨이 쿼터) | dispatch/확인 전 커밋 | upload extraction·period_roller |
| 요청 자신의 실패를 넘어 생존(잠금·실패카운터) | reject = commit+raise | login lock([eventing.md](eventing.md) §7) |
| 커밋되면 안 되는 speculative | 명시 rollback | playground 미저장 |

- 이탈은 **탈출한 만큼만** — 필요 이상 커밋하지 않는다. "부분 성공"은 tx가 아니라 **검증 결과**로 표현([application.md](application.md) §3-1).

### center 없는 flow — behavior.request_unscoped

`request`(센터 멤버십, `center_id` path param) 외에, 비센터 요청은 **`request_unscoped` 하나**로 받고 주체는 action이 결정한다. `center_id` path param·`RequireCenter` 없음(테넌트 path 아님 — center_id 필요하면 endpoint **Query**로). stateless 게이트(gate/admin 토큰)는 tx 전, 세션 필요한 account 인증은 tx 안.

- **계정 주체** — `authenticate()`만(센터 무관: `notice`·`support`·`person`). `ctx.person_id`로 식별.
  ```python
  ctx: UnscopedContext = Depends(behavior.request_unscoped(authenticate()))
  # list_notices_handler(ctx.uow, person_id=ctx.person_id, center_id=center_id)
  ```
- **machine 주체** — 인증 주체 없는 **machine entry**(webhook·내부 cron). `gate(verify)`가 기존 검증 콜러블(`verify_toss_webhook`·`current_bot`)을 그대로 받아 실행 — behavior는 도메인 무지(toss/secret 로직은 infra 소유). 신원 없음 → `ctx.uow`만.
  ```python
  ctx: UnscopedContext = Depends(behavior.request_unscoped(gate(verify_toss_webhook)))
  # bot: behavior.request_unscoped(gate(current_bot))
  ```

### admin flow — behavior.request_admin

플랫폼 운영자(`platform_admin`·`ai_lab`)는 **`request_admin`**으로 받는다 — admin 토큰 신원(`AdminIdentity` resolver), center 없음. `ctx: AdminContext`로 `admin_account_id`·`email`·`role`(non-optional)·`ip`가 노출된다. admin 토큰은 stateless라 tx 전 검증(`authenticate_admin()` + `require_role(*roles)`).

```python
ctx: AdminContext = Depends(behavior.request_admin(
    start_event_group(),
    authenticate_admin(),
    require_role(*ADMIN_PLUS),
    dispatch_events(),
))
# handler(actor_id=ctx.admin_account_id, ip=ctx.ip, event_group_id=ctx.event_group_id, uow=ctx.uow)
```

- **감사 = handler의 `emit(actor_type="admin", ip_address=ctx.ip)`** — `event_atomics`가 감사 정본([eventing.md](eventing.md) §10). 별도 감사 테이블 없음(`admin_audit_logs`는 묘비). read는 `event`(actor_type='admin') 조회.
- **audit action은 소멸(2026-07-28 실측 확인)** — 감사는 emit 일원화 완료([eventing.md](eventing.md) §10), behavior에 audit 액션·`ctx.audit` 없음. 별도 세션 fire-and-forget 감사(`get_audit_logger`류)는 여전히 금지(유실, 검증됨).
- admin 신원이 필요 없는 read도 `request_admin(authenticate_admin())` — `ctx.uow`만 쓰면 됨.

## 5. endpoint — bare action으로 명시 선언

```python
from app.behavior import (
    behavior,
    ServerContext,
    authenticate,
    require_membership,
    require_permission,
    start_event_group,
    dispatch_events,
)
from app.core.permissions import Permission

@router.get("", response_model=ActivityLogListResponse)
async def list_activity_logs(
    center_id: str,
    ...,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_ACTIVITY_LOG),
            dispatch_events(),
        )
    ),
):
    return await list_activity_logs_handler(
        uow=ctx.uow,
        center_id=center_id,
        event_group_id=ctx.event_group_id,
        actor_id=ctx.actor_id,
        ...,
    )
```

- **레이아웃 강제** — `Depends(`·`behavior.request(`·각 bare action을 **각 줄에** 둔다(`Depends(behavior.request(` 한 줄 붙임 금지). 안정화에는 **magic trailing comma**가 필수: action이 1개여도 마지막 뒤 `,`, action이 없으면 `behavior.request_unscoped(),`처럼 flow 호출 뒤 `,` — 안 그러면 black/ruff(line-length 88)가 한 줄로 접어버린다. 끝나면 `ruff format`이 위 형태로 정규화(idempotent).
- 필요한 단계만 선언 — 발행 없는 순수 read면 `start_event_group`/`dispatch_events` 생략, 게이트 없으면 `require_permission`/`require_feature` 생략.
- `center_id`는 path param에서 직접(핸들러 `str`), actor·event는 `ctx`에서.

## 6. worker — 이벤트 소비

`use_event_action(event_group_id)`: claim(tx) → run(yield) → 정상 `succeed` / 예외 `fail`. `Act`(action/act.py)가 `claim`/`succeed`/`fail` lifecycle 전이를 `EventRepository`에 위임. actor/center는 NOTIFY payload(`{group_id}`)를 불신하고 **claim한 행에서 읽는다**. producer의 `RequireDispatch`(커밋 후 notify)의 반대편.

cron 잡은 `use_cron_action(lock_key=, name=)`(worker.py) — `transactional_uow` + advisory **xact** lock으로 멀티 레플리카 중 1개만 실행하고, `Scope.event_group_id`를 발급해 핸들러에 전달한 뒤 clean-exit 커밋 후 event를 dispatch한다(핸들러 tx-free 필수). 상세는 [worker.md](worker.md).

## SSE/WebSocket 스트리밍 — `behavior.stream`

문제: `request`의 `transactional_uow`는 **clean exit 자동커밋 / 예외 rollback**이라, 스트림 중간 disconnect(예외) 시 진행이 롤백된다. 해결: **`behavior.stream`** flow — `request`와 동일한 인증 파이프라인이지만 세션이 `AsyncSessionLocal`(= `get_uow` 의미, **수동 커밋·자동롤백 없음**). 스트림 핸들러가 진행을 점진 커밋하면 disconnect에도 이미 커밋된 건 보존(미커밋만 세션 close에서 정리). dispatch 없음.

```python
ctx: Context = Depends(behavior.stream(
    authenticate(), require_membership(),
    require_feature("ai_agent"),
    throttle(scope="agent", per_minute=..., enabled=...),
)),
# handler(center_id=ctx.center_id, member_id=ctx.actor_id, uow=ctx.uow, ...)
```
- behavior 불변식 확장: flow는 **auth + 세션수명**을 소유하되 **커밋정책은 transactional(request/request_unscoped) / 수동(stream)**.
- 옛 `get_aow`(agent 즉시커밋 별도 세션)는 assistant 재작성(2026-07-23)으로 소비 소진 — 정의까지 제거됨(2026-07-28). 스트림 영속은 `ctx.uow` 점진 커밋 하나로.

## 안티패턴

- handler가 `async with uow`/`commit` → tx는 request 소유(§4).
- 단일 커밋 이탈을 "부분 성공"·홉 수로 판정 → **부작용 롤백 가능성**으로(INV-tx). 되돌리면 기본, 못 되돌리면 outbox, 예외만 `# tx 예외:` 마커.
- act 안에 `is_active` 검사 → flow가 `if memory.is_active(X)`로(§3·§4).
- 고정/암묵 단계 → 모든 단계를 bare action으로 명시(§4·§5).
- action 식별을 문자열 이름으로 → 클래스 자체(`type(self)`/`X`)(§3).
- emit이 직접 `pg_notify` → `RequireDispatch`(`dispatch_events()`)가 커밋 후(§4).
- worker가 NOTIFY payload의 center/actor 신뢰 → claim 행에서(§6).
- SSE/WS를 `behavior.request`로 → disconnect 시 progress 롤백. `behavior.stream`(수동커밋 세션) + 별도 `get_aow`(SSE 절).
- 별도 세션 fire-and-forget 감사(`get_audit_logger`류) → 유실. 감사는 handler emit — 같은 tx가 정본([eventing.md](eventing.md) §10).
- 라우터에 `Depends(get_toss_client)`·`Depends(get_storage_client)` 등 **인프라 어댑터** → behavior 아님. 핸들러에서 `factory.get_X()` 호출([infrastructure.md](infrastructure.md)). 엔드포인트 시그니처는 `ctx` + HTTP 입력만.
