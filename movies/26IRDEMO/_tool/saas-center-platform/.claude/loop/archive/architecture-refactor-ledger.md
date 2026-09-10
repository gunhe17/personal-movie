# 아키텍처 리팩토링 — 결정 원장 + 실행 절차

2026-06-29 rules↔코드 전수 감사(16 규칙 문서, 원본 스냅샷 [AUDIT-2026-06-29.md](../../../AUDIT-2026-06-29.md)) 후 MISMATCH를 결정·절차화한다. 규칙(`.claude/rules/api/`)이 정본 — 코드 캠페인 전에 규칙부터 갱신한다.

상태: `[결정]` 방침확정·미착수 · `[진행]` · `[완료]`.

실행 단위: **한 모듈/슬라이스 = 한 iteration = 한 로컬 커밋**([loop/api-refactor.md](../../loop/api-refactor.md)). 대량 일괄 금지.

작업 순서(의존): **§0 규칙 반영 → §4 eventing 캠페인(§1 S1·§2 A3 흡수) → §1 나머지 S1/SC2 → §5·§6·§7 기계적 정리 → §3 dtos**.

---

## 0. 규칙 문서 선반영 (코드 전 필수) — `[완료: 2026-06-29, 커밋 f78447a]`

G1-G5(eventing) 결정은 규칙이 정본이므로 **코드 캠페인 전에** 규칙 문서부터 갱신한다. 5개 문서, surgical edit.

| 문서 | 추가/변경 | 출처 |
|------|----------|------|
| `service.md` §2 | event-emitting service는 `tuple[{Module}Atomic, Model]` 반환 — "Model out" 순수성을 **event op에 한해** 완화(정본화) | G3 |
| `eventing.md` §2 | ~~reaction 없는 이벤트 = emit이 `status="succeeded"` terminal~~ → **superseded(2026-07-15): emit은 항상 pending, reaction 판정은 worker 소유.** 하위 event 모듈이 application reaction 지식을 갖지 않는다 | G1 |
| `eventing.md` §4 | **service=atomic 생성 / handler=event emit / facade=pass-through**. bulk=한 event + N atomics. 마커 네이밍 `{Module}Atomic` | G3 |
| `eventing.md` §10 | `query_audit` → `AuditAtomic` DTO 반환(application model-free). updated `payload.input` = `exclude_unset=True` 델타 | G2·G4 |
| `facade.md` §2④ | facade는 service가 만든 `(atomic, Model)` tuple **pass-through**(생성·emit 아님)로 명확화 | G3 |

**verify:** 각 문서에 위 문구 존재 + 안티패턴 절 갱신(`*Event`→`*Atomic`, facade-creates-marker 표현 제거).

---

## 1. Service 순수성 (S1 + SC2) — `[완료: S1·SC2 전량, 글로벌 grep==0]`

**문제:** service가 HTTP를 앎. 규칙 §2 위반. (감사 2026-06-29: 수치 불변)
- S1: service가 Response 반환 — 43파일. **[완료: 글로벌 grep==0].** 완료=center(92552b2)·billing 15(price_list f210fbc·payment 0fcd920·_legacy a2d9907·billable 0b66778)·voucher 9(c195ed5)·platform_admin 13(7서브모듈 34a972f·3f253b1·4bd63a1·a05b048·855f82c·2e73b10·f9cf8db)·notice 4(917619f)·assessment 1(86700fa). `grep model_validate\|Response( .../services == 0` 전 모듈.
  - **정본 원칙(2026-06-29, service.md §2.1):** 직렬화(`model_validate`/`*Response()`)는 facade `*_with_response`/application handler에서만. service는 Model/`tuple[list[Model],Page]`/scalar/계산Result만. 작업=service 안 직렬화 호출을 위 레이어로 이동(계산Result=model_validate 없는 DTO는 그대로). 캐리어는 `*Response` 대신 Model 임베드. enrichment(타 엔티티 조회+세팅)도 facade로(facade.md §3 형제 서브모듈 조율).
- SC2: service가 pydantic 인자 수령 — 48파일. **진행:**

| 모듈 | SC2 | 상태 |
|------|-----|------|
| auth | 1 | ✅ 3c19ce9 |
| person | 2 | ✅ 1b43dd0 |
| form | 1 | ✅ 7a47965 |
| counseling | 6 | ✅ 9b75468 |
| center | 8 | ✅ b5e35de·3f52ee8 |
| assessment | 8 | ✅ f4692e3 (analyze 2종 case+primitive) |
| billing | 7 | ✅ f45f812(price_list 2)·1a4ae58(payment 1)·1afeb7a(_legacy 2)·38f83d3(billable 2, no-schema items→list[dict]) |
| platform_admin | 5 | ✅ a83c81a(cs_memo 2)·dba7752(admin_account_management 3) |
| voucher | 4 | ✅ 306cd06(client_voucher 2)·ab648c5(center_voucher 2) |
| client | 4 | ✅ 725b052(relations 2)·0837e38(profile 2, event tuple+changed delta) |
| notice | 2 | ✅ 3db0ca3 (S1 완료 후 SC2) |

**SC2 전량 완료 (글로벌 grep==0). S1(43)도 전량 완료.** §1 Service 순수성 done.

**목표 형태:**
```python
# service: primitive in / Model out  (단 event-emitting이면 tuple[Atomic, Model] — §0)
async def execute(self, *, title: str, content: str, ...) -> Notice:
    return await self.repo.add(...)

# handler: pydantic 언패킹 + 직렬화
async def create_notice_handler(data: NoticeCreate, ..., uow):
    notice = await CreateNoticeService(uow.repo(NoticeRepository)).execute(title=data.title, ...)
    return NoticeDetailResponse.model_validate(notice)
```

**절차(모듈당 1 iteration):**
1. service `execute` 시그니처를 primitive in으로(pydantic 인자 → 필드 언패킹). `data: XCreate` 제거.
2. service 반환을 Model out으로(Response/`model_validate` 제거). event 모듈이면 `tuple[Atomic, Model]`(§4).
3. handler가 언패킹 + 직렬화(`Response.model_validate`) 떠안음.
4. 모듈 테스트 갱신 → green.

**verify(모듈별):**
- `grep -rln "model_validate\|Response(" app/modules/<m> --include="*.py" | grep /services/ | wc -l` == 0
- `grep -rn "data: [A-Za-z]*\(Create\|Update\|Request\)" app/modules/<m> --include="*.py" | grep /services/ | wc -l` == 0

**대상:** billing · platform_admin · voucher · notice · center · assessment · counseling · client · person · form · auth.
**연계:** behavior 미전환 모듈은 behavior 전환과 합쳐 handler 1회만 수정. eventing 흡수(§4) 모듈은 §4와 합쳐 처리(handler를 두 번 안 건드림).

---

## 2. Application handler 레이어 우회 (A1-A3) — `[완료: 2026-06-29 — write-only 재정의, 위반 0]`

**결정(2026-06-29, 사용자):** §2는 **write-cross-module(owning facade 우회 쓰기)에만 적용**([cross-module-write.md](../../rules/api/cross-module-write.md) 최상단 "쓰기에만" 명문과 일치). 블런트 grep(`repository|services|.models import`, 37건)은 read·같은모듈·admin-read를 과다집계 → verify 재정의.
- **D1 read-enrichment 인정:** application 핸들러가 write 후 알림/감사용으로 foreign 데이터(member·person·center 이름·수신자)를 `find/list`로 조회 = 규칙 허용 "application id-조립 read". 위반 아님.
- **D2 같은 모듈 인정:** application/handlers/X가 modules/X repo/service 직접 호출(subscription extra-write 등) = 한 도메인 orchestration. 위반 아님.
- **D3 admin read-model 인정:** application이 platform_admin repo를 `find/list`로 읽음 = read-model 예외(§6.3).

**검증(2026-06-29):** 37건 전수 분류 결과 **foreign-도메인 write-bypass 0건**. 실제 write(approve_credential·assign·unassign·update_notice·change_plan 등)는 **이미 owning facade 경유**(PersonFacade·AssessmentFacade·NoticeFacade·SubscriptionFacade). foreign repo는 전부 read-enrichment, write 호출(`update_in_center`)은 subscription·field_note = 자기 도메인. 직접 `session.add(ForeignModel)` 0. ai_lab model import은 반환타입 annotation. → **코드 변경 없음.**

**재정의 verify:** "application 핸들러가 **타 도메인** 엔티티를 repo/model 직접 **write**(owning facade 우회)" == 0. (read-enrichment·같은도메인·admin-read는 정상.) A3 EventAtomic은 §4 G2에서 별도 해소.

---

## 3. `dtos/` 정리 (SC1) — `[완료: 2026-06-29, 커밋 98b1556]`

**완료:** 빈 dtos/ 8개(pycache뿐, git 미추적) 물리 삭제 · facade/dtos.py 3개(assessment·counseling·institution) → **facade/schemas.py rename**(사용자 결정 ⓐ co-located, 서브모듈 분산 ⓑ 대신) · import 11곳 `.dtos`→`.schemas`. verify: dtos.py 0·.dtos 0·dtos 디렉토리 0·boot OK·unit 21.

**현황(감사 2026-06-29, 불변):** 빈 `dtos/` 디렉토리 8(pycache만) + `facade/dtos.py` 3 + import 11곳. codemod 1회 규모.

**절차:**
1. 빈 `dtos/` 8개 삭제: counseling/counseling_case · document/(document·document_access·share_token) · institution · person · role/(permission·role_permission).
2. `facade/dtos.py` 3개(assessment·institution·counseling) 내용을 각 모듈 `schemas.py`로 이동.
3. import 11곳 갱신(`.dtos import` → `.schemas import` 또는 모듈 re-export).

**verify:** `find app/modules -type d -name dtos | wc -l` == 0 AND `find app/modules -name dtos.py | wc -l` == 0 AND `grep -rn "\.dtos import\|\.dtos\." app --include="*.py" | wc -l` == 0.

---

## 4. activity_log → event_atomics 흡수 + eventing 발행 원칙 — `[완료: 2026-06-30 — A emit(글로벌 @audit_log 0)·B read 재배선·C teardown. 커밋 e1cbac9~3323f72]`

**문제:** `@audit_log`(잔여 88핸들러, 별도 세션 fire-and-forget)가 `activity_logs`에 별도 쓰기 → 유실 실증([behavior-audit-fix] 메모리). `event_atomics`와 이중 audit.

**결정(2026-06-29):** `event_atomics`가 audit 정본. `@audit_log` 폐기, handler가 `emit`(integral — 같은 tx). read는 `event_atomics` 직접 조회 + 표현(category/summary/actor_name) **read 시점 재구성**(fact만 lean). **신규만 대체** — backfill·drop 없음. 정본 [eventing.md](../../rules/api/eventing.md) §10.

### 4-1. 발행 원칙 (G3 — 신설 정본, facade-wrap 폐기)

| 레이어 | 책임 |
|--------|------|
| **service** | **atomic 생성**(mutation 1 = 사실 1). `1 execute = 1 atomic`. mutating service만, read/list는 atomic 없음 |
| **handler** | **event emit**(유일 주체). atomic들을 묶어 한 event명으로. 단건=atomic 1, **bulk=한 event + N atomics** |
| **facade** | service 조립 + atomic **pass-through**(생성·emit 안 함) |

- 마커 클래스 = `{Module}Atomic`(was `*Event`) — emit `atomics=` 파라미터 + `event_atomics` 테이블과 정합.
- payload: created/deleted=`{"data": dump}`, updated=`{"input": exclude_unset 델타, "result": dump}`, read act=`{}`.

### 4-2. 핸들러당 전환 패턴 (정본 = client 파일럿, G3 적용)

```python
# 1. events.py 마커 (service 옆)
@dataclass(frozen=True, kw_only=True)
class ClientAtomic:
    @classmethod
    def created(cls, *, client: Client) -> tuple["ClientAtomic", Client]: ...
    def payload(self) -> dict: ...   # created={"data":dump}

# 2. service = atomic 생성 (repo 변경 직후)
class CreateClientService:
    async def execute(self, *, center_id, ...) -> tuple[ClientAtomic, Client]:
        return ClientAtomic.created(client=await self.repo.add(...))

# 3. handler = event emit (단건)
async def create_client_handler(*, event_group_id, center_id, data, uow, actor_id):
    atomic, client = await CreateClientService(uow.repo(ClientRepository)).execute(...)
    await emit(uow, "client_created", event_group_id=event_group_id,
               atomics=[atomic], center_id=center_id, actor_id=actor_id)
    return ClientResponse.model_validate(client)

# 3-bulk. handler = atomic N개 수집 → event 1개
async def bulk_create_clients_handler(*, event_group_id, center_id, rows, uow, actor_id):
    svc = CreateClientService(uow.repo(ClientRepository))
    atomics = []
    for row in rows:
        a, _ = await svc.execute(center_id=center_id, ...); atomics.append(a)
    await emit(uow, "clients_bulk_created", event_group_id=event_group_id,
               atomics=atomics, center_id=center_id, actor_id=actor_id)
```

- facade 있는 모듈: facade가 service의 `(atomic, model)`을 **전달만**(handler가 emit). facade는 마커 생성 안 함.
- handler tx-free(behavior가 커밋). router에 `start_event_group()`/`dispatch_events()` + `event_group_id`/`actor_id` 전달.

### 4-3. 3단계 순서 (어기면 활동로그 화면 빈 페이지)

- **A. emit 마이그(88 핸들러)** — `@audit_log` 제거 + 4-2 패턴. `event_atomics` 채움. 모듈별 점진. **진행: client(profile)·schedule·role·field_note·messaging·document(44eeb022)·voucher(bf63cb44·17612279). 남은 @audit_log = 55데코/7모듈**(center 15·counseling 8·client 8·assessment 8·form 7·billing 7·agent 2). **agent 보류**(AI런타임 7콜사이트 공유+기존 *Event 리네임).
- **B. 재배선** — web `activity_log` router·agent `facade_registry` → `list_activity`. **반드시 A 후**.
- **C. teardown** — `activity_log` 라이브(router·facade·service·handler·repo·schemas·events·agent_facade) 삭제 + 모델→`modules/activity_log/legacy/model.py` + 등록 import 3곳(env.py·init-schema.py·lifecycle.py). 테이블·과거 데이터 보존(drop 없음). **+ facade.md 레퍼런스를 `activity_log/facade`→live 모듈(client/profile)로 교체(G5)**.

### 4-4. 하위결정 (2026-06-29 확정)

- **G1 emit terminal — superseded(2026-07-15).** reaction 없는 이벤트도 emit은 항상 `pending`; worker가 `EVENT_REACTIONS`를 보고 무반응이면 succeed한다. 아래의 registry 설계는 구현하지 않으며 [eventing.md](../../rules/api/eventing.md) §2가 정본이다.
  - **역참조 금지(핵심 함정):** emit(event 모듈)이 `EVENT_REACTIONS`(application)를 직접 import = 역참조 안티패턴. 해법 = event 모듈이 레지스트리(`set[str]`) 소유, application이 **`EVENT_REACTIONS` 정의 바로 옆에서** `register_reacting_names(EVENT_REACTIONS.keys())` 호출(방향 application→event). emit은 자기 모듈 레지스트리만 조회. 단일 파일·단일 문장이라 드리프트 출처 단일.
  - **누락 가드(2차 함정):** 등록이 emit하는 **모든 프로세스(API·worker)** startup에서 실행돼야. 누락 시 reaction 이벤트가 `succeeded`로 박혀 유실. lifecycle/startup에 묶고 **부팅 가드**(`EVENT_REACTIONS.keys() ⊆ 등록집합` assert).
- **G2 query_audit = `AuditAtomic` DTO** — event 모듈이 `AuditAtomic` dataclass(`id·act·entity_name·entity_id·actor_id·payload·created_at`+center_id)를 public 표면(`modules/event` re-export)에 노출. `query_audit` → `tuple[list[AuditAtomic], Page]`. `list_activity`는 **모델 아닌 이 계약만 import** → **A3 해소**(§2). `EventAtomic`→`AuditAtomic` 매핑은 query_audit handler가 자기 모듈에서(repo는 Model out 유지).
- **G4 updated 델타** — `payload.input`은 `model_dump(exclude_unset=True)`(호출자가 실제 바꾼 필드만, 옛 전체 덤프 아님). client 이미 정답, widget 레퍼런스 정렬.
- **center_id 비정규화 = 보류** — 현재 `events` JOIN 충분. read 스케일 실증 시 `event_atomics.center_id`+인덱스(이른 최적화 회피).

**verify:**
- `grep -rn "@audit_log\|from app.security.audit" app --include="*.py" | wc -l` == 0 (캠페인 종료)
- `find app/modules/activity_log -name "*.py"` == `legacy/model.py`만 + `app/security/audit.py` 삭제
- `grep -rn "class [A-Za-z]*Event\b" app/modules/*/*/events.py | wc -l` == 0 (`*Atomic` 리네임 완료)

---

## 5. Repository 드리프트 (신규 — 2026-06-29 감사) — `[완료: §5-1 document(4dcac55)+voucher(d5007c4), §5-2 전량]`

[persistence-repository.md](../../rules/api/persistence-repository.md) §7 위반. 기계적 정리.

### 5-1. `include_deleted: bool` 토글 → 이름으로

soft-delete 가시성을 파라미터로 토글하지 않고 **이름**으로 드러낸다(`find_*` vs `find_*_including_deleted`).

**대상 4파일 전량 완료:** ~~document/document · document/global_document~~(4dcac55) · ~~voucher/voucher · voucher/voucher_document~~(d5007c4). voucher.list_many_by_ids는 dead(호출처 0)라 toggle만 제거+삭제는 별도 판단.

**절차(파일당):** `include_deleted: bool` 분기 메서드를 두 메서드로 분리(`X` active 기본 / `X_including_deleted`). 호출처를 의도에 맞게 분배. **verify:** `grep -rn "include_deleted" app/modules/<m>/repository.py | wc -l` == 0.

### 5-2. `find_active(id)` base 중복 래퍼 → base 사용

`_find(where=[M.id==id])`는 base `find_by_id`와 동일(active는 자동). 중복 래퍼 삭제, 호출처를 `find_by_id`/`get_by_id`로.

**대상(base 중복 확정) — 전량 완료:** ~~notice/notice~~(d90dc3b) · ~~platform_admin/notice~~·~~platform_admin/cs_memo~~(5f02f47 — find_active만) · ~~voucher/client_voucher~~·~~voucher/center_voucher~~(734cc9e — find_active+get_active 둘 다).
- **교정/판별:** get_active 동치 여부가 모듈마다 다름 — **platform_admin(notice·cs_memo)=keeper**(커스텀 한국어 메시지, base 동치 아님, find_active만 제거) / **voucher(client·center)=둘 다 제거**(메시지가 base `{model.__name__} not found`와 정확 동치). 메시지=동작이므로 동치일 때만 get_active 삭제.
- **잔여 판정 완료(둘 다 keeper):** center/center `get_active(id)` = 커스텀 메시지("센터를…")+이미 base find_by_id 내부 호출(제거할 래퍼 없음) · voucher/voucher_extraction `get_active(id)` = `find_by_id_all_states` 후 deleted 필터+커스텀 메시지(다른 로직). 둘 다 base 동치 아님 → 유지. **§5-2 완전 종결.** **제외(삭제 금지):** llm/credit_rate_config `find_active()`(무인자) · assessment/assessment_case_participant `find_active(복합키)`.
**제외(위반 아님 — 삭제 금지):** llm/credit_rate_config `find_active()`(무인자, effective config) · assessment/assessment_case_participant `find_active(복합키)`. center/center·voucher/voucher_extraction `get_active(id)`는 **개별 확인 후** 판정(base 동치면 삭제).

**절차(repo당):** 메서드 본문이 base 동치인지 확인 → 동치면 삭제 + 호출처를 base로 → 테스트 green. **verify:** 대상 repo에 `def find_active`/`def get_active`(단일 id) 0.

---

## 6. package `__init__.py` 정리 (P1 + 신규) — `[완료: §6-1 철회 + §6-2 6170378]`

[package-init.md](../../rules/api/package-init.md) §2 위반.

### 6-1. 모듈 루트 빈 `__init__` → `[철회: 2026-06-29 — 소비처 0이면 빈 __init__ 유지]`

**결정(2026-06-29, 사용자):** re-export는 소비처가 정한다 — `from app.modules.{m} import X`(루트 경유) 소비처가 실재할 때만 노출. **대상 4모듈(form·llm·voucher·platform_admin) 전부 루트 소비처 0 확인**(모두 서브모듈 full-path import) → 빈 `__init__` 유지가 정상. 쓰이지 않는 공개 표면을 추측으로 만들지 않는다. [package-init.md](../../rules/api/package-init.md) §2 반영 완료. **P1 = no-op.**

### 6-2. 서브모듈 빈 `__init__` → 삭제 (PEP420) — `[완료: 2026-06-29, 커밋 6170378]`

**93개 삭제 완료**(submodule 52·services/ 22·handlers/ 19 — 실제 수치는 75 아닌 93). depth≥2 빈(주석/공백/단일docstring) `__init__` 전량 삭제, 모듈 루트 미변경(§6-1 철회). pyc 정리 후 boot OK, unit 367 passed(선행 실패 1 무관). depth≥2 빈 `__init__` 0.

---

## 7. router route-level description 잔존 (신규) — `[완료: 2026-06-29 — 10건 전수 검토, 전부 keeper]`

[router.md](../../rules/api/router.md) §2. summary는 완전 정리됨(0). route-deco 멀티라인 `description=(` **10건**만 잔존.

**판정(2026-06-29 전수):** 잔존 10건 **전부 비자명한 소비자 계약 = keeper** — counseling apply-edits(전체상태→서버 diff)·ai_lab eval(정답입력→정확도)·member credentials(본인/타인 응답 shape)·client signals(best-effort+권한)·client list(own/all 범위)·push_token×2(path-unsafe 토큰 우회·구버전 호환)·extraction×3(비동기 202+폴링·멱등 upsert). 나레이션/재진술 0. **§7 no-op**(summary 정리는 기존 완료). Query/Field desc는 손대지 않음.

---

## 미결정 → 전량 해결 (2026-06-30)

> 2026-06-30 실코드 조사 + 사용자 결정으로 6항목 전부 종결. 아래 상세는 근거 보존용.

### 결정·집행 결과

| 항목 | 결정 | 결과 |
|------|------|------|
| F1 facade→facade read | 예외 인정 | ARCHITECTURE **EX-13** 신설(50aa7ff8) |
| F2 facade commit | reject 이관 | facade.md §4 명문화(50aa7ff8) **+ 코드 전환 완료(00c26702)** — facade 순수화, handler가 uow.reject(exc), 통합테스트로 failed_attempts 영속 증명 |
| **M1 bare unique** | 자연키만 전환 | **eb0d9e9d** — accounts.email·admin_accounts.email·assessments.code partial index + 마이그 f3a9c1d8b204. 실 DB 재현 검증(삭제후 재가입 성공·활성중복 차단) |
| M2 comment= | 동어반복만 제거 | **d2bfd984** — inquiry·faq 11건 제거, 정보성(enum·비정규화·id종류) 보존 |
| A4 bg_uow | carve-out 인정 | application.md §3 명문화(50aa7ff8, EX-3 동류). event reaction 롤아웃 시 제거 대상 |
| 비-admin JOIN | **유지(분해 철회)** | 0b493b1c — 전제 오류 발견: subscription·llm **둘 다 admin 표면**(/admin/subscriptions·admin_router), subscription은 규칙 명시 허용·검색 필터에 JOIN load-bearing. 규칙 표에 llm 한 줄 추가만 |

**M1 선별 결과(34 bare unique 중):** 전환 3 = 자연키+soft-delete+재생성 경로 확정(accounts.email은 deactivate→remove_by_id 실증). 제외 = form_value(upsert ON CONFLICT 의존)·plan_config/platform_setting(삭제 플로우 없음)·랜덤일회성값(token_hash·storage_path·share_token·lgu_message_id, 재사용 0).

### 근거 상세 (보존)

---

### F1 — facade가 다른 모듈 facade 호출 (facade→facade)

- **위치:** `assessment/facade/task_facade.py:177-192` `get_tasks_display_info_by_ids`(읽기). `ScheduleFacade.get_schedules_by_ids` + `RoomFacade.get_rooms_by_ids` 직접 호출.
- **위반:** facade→facade 금지, 크로스모듈 조율은 application handler만([cross-module-write.md]·[application.md]). 단 **read enrichment**(task에 room_name·schedule 붙임)라 write 위반은 아님.
- **트레이드오프:** ① 예외 인정 — agent BFF read 집계가 이미 EX-11 예외. 같은 성격(타 모듈 루트 facade의 공개 read만, write 0). 코드 이동 0. ② 분해 — application handler로 올리고 task_facade는 task만 반환 후 Python 조립. 순수성↑이나 display-info 응집 깨짐·체인 복잡.
- **추천:** **예외 인정 + facade.md에 "read enrichment도 EX-11 범주" 한 줄 명문화.** 분해는 안전 이득 없이 응집만 해침.

### F2 — facade 내 직접 commit

- **위치:** `assessment/facade/send_result_facade.py` `verify_and_collect_reports` — 인증코드 실패 시 `except InvalidOperationException: await self._uow.commit(); raise`.
- **위반:** tx 경계는 behavior 소유, facade/handler는 commit 안 함([behavior.md]·[service.md]).
- **이유:** 인증 실패 `failed_attempts` 증가분 보존 필요 — 그냥 raise하면 rollback돼 실패 카운터 소실 → 무한 시도 가능. **§4 `reject()` 패턴(거부하되 흔적 보존 = 현재 tx commit + raise)과 동일 의도.**
- **트레이드오프:** ① 정당 예외로 그대로 둠. ② §4에서 생긴 `reject()`로 이관 — 단 facade 깊숙이라 `ctx`/reject 배선 끌어내려야 함.
- **추천:** **reject 패턴으로 이관**(§4서 이미 정본화한 세 번째 outcome). 단 verify_service가 behavior scope 못 받으면 보류.

### M1 — soft-delete 엔티티 bare `unique=True` (실버그 위험)

- **전제:** BaseModel이 전 엔티티 soft-delete(`infrastructure/persistence/models.py:38` `deleted_at`). bare unique는 soft-delete된 행도 값 점유.
- **올바른 패턴(center 이미 적용):** `center/center/models.py:26` `Index("uq_centers_code_active","code",unique=True,postgresql_where=text("deleted_at IS NULL"))`.
- **문제 패턴:** `assessment/assessment/models.py:14` `code unique=True`(bare) · `platform_admin/admin_account/models.py:23` `email unique=True`(bare) 등.
- **실버그:** admin_account.email이 bare unique면 **탈퇴(soft-delete) 후 같은 이메일 재가입이 DB 제약에 막힘**.
- **규모:** bare `unique=True` 컬럼 총 **34개**. 재생성 시나리오 실재(email·code류)는 원장 기준 12 후보.
- **트레이드오프:** ① partial index 전환(+마이그, center가 검증한 패턴). ② 방치 — 34개 중 다수는 재생성 없는 값이라 무해, 12개만 선별 필요.
- **추천:** **후보 선별 후 항목별 전환. 자동 일괄 금지**(재사용 안 하는 unique까지 건드림). 마이그 동반 = DB 변경이라 신중. **집행 전 12 후보 "재생성 있음/없음" 분류표 먼저.**

### M2 — model `comment=` 보존 vs 제거

- **위치:** `platform_admin/faq/models.py`·`inquiry/models.py` 등 18건. 예: `question ... comment="질문"`(동어반복) vs `category ... comment="카테고리: getting_started/general/technical/feature"`(enum 값 = 추론 불가).
- **쟁점:** 주석 규약([apps/api/CLAUDE.md])은 필드명 재진술 제거. 단 `comment=`는 DB 컬럼 코멘트로 스키마에 박히는 메타라 일반 주석과 성격 다름.
- **트레이드오프:** ① 동어반복 제거(`question`→"질문"). ② DB 코멘트는 운영도구 문서라 보존(단 규약 충돌).
- **추천:** **동어반복만 제거, 정보성(enum 값 설명 등) 보존.** "이 코멘트 없으면 다음 사람이 잘못 고치나?"로 18건 개별 판정. DB 코멘트라고 무조건 예외 두지 않음.

### A4 — 백그라운드 `bg_uow` carve-out

- **위치:** `application/handlers/notice/notify_notice.py:67-91`·`update_notice.py:51` `bg_uow = UnitOfWork(session); async with bg_uow: ...; await bg_uow.commit()` · `counseling/.../create_analysis_handler.py:257` `async with AsyncSessionLocal() as bg_session`.
- **위반:** application handler는 받은 uow만, 새 UoW/세션 금지([application.md] §2). 단 **BackgroundTasks 실행 = 요청 tx 닫힌 뒤라 자기 세션 필수**(요청 uow면 닫힌 세션 에러).
- **트레이드오프:** ① carve-out 인정 + 규칙에 예외 한 줄. ② `bg_uow()` 공통 팩토리로 3곳 보일러플레이트 통일.
- **추천:** **carve-out 인정 + application.md §2에 "BackgroundTasks 반응은 자기 uow 생성 — 단일-uow 예외" 명문화.** 3곳뿐이라 팩토리 이득 작음. §3(side-effect는 tx 밖)의 자연 귀결.

### 비-admin cross-module read JOIN (llm·subscription)

- **위치:** `subscription/subscription/repository.py:219,235` `.outerjoin(Center, (Center.id == Subscription.center_id) & Center.deleted_at.is_(None))` — subscription repo가 center 모듈 `Center` 모델 직접 import·JOIN.
- **위반:** 모듈 간 model import 0, 크로스모듈 read는 각자 조회 후 Python 조립([persistence-repository.md] §6). 예외는 admin/집계 표면(`platform_admin/*`)만(§6.3·EX-2).
- **쟁점:** subscription·llm은 admin 아닌데 타 모듈 JOIN. 추가 예외 인정 vs Python 조립 분해.
- **트레이드오프:** ① 예외 확대(센터명 비정규화 read-model, JOIN이 N+1보다 효율) — 단 "admin만 예외" 경계 흐려짐. ② 분해(subscription은 center_id만, application이 CenterFacade로 일괄 조회 후 조립) — 순수성↑, N+1은 batch로 회피.
- **추천:** **분해 쪽 기울되 케이스 확인 후.** "admin만 read-model JOIN" 경계는 의도적으로 좁게 유지가 모듈 격리에 좋음. subscription:219는 outerjoin이라 Python 조립 대체 가능해 보임. 단 페이지네이션·정렬이 JOIN 의존하는지 확인.

---

## 완료 (2026-06-29)

- 규칙 doc-stale 수정(코드가 정답): B1 behavior.md `send_permission_version` 참조 제거 · B2 §1 트리 action 10개 · B3 §4 의사코드+ServerMemory 키 · R1 persistence-repo `core/validate`→`core/type` · R2 "106"→"110 모듈" · R3 `_base.py` anchor 제거.
- validate.py → type.py 통합(코드, 108 import codemod).
- 16 규칙 문서 전수 감사([AUDIT-2026-06-29.md](../../../AUDIT-2026-06-29.md)) — 구조 규칙(facade/cross-module/infra/server/behavior) 정합 확인, 신규 드리프트 4종(§5·§6·§7) 발견, eventing 규칙 갭 G1-G5 결정.
