# 계층 9 — Cross-module Write 설계 `[설계완료]`

정본 rule: [cross-module-write.md](../../rules/api/cross-module-write.md). 상위: [convention-design.md](../convention-design.md).

survey(grep 검증): **cross-module WRITE 위반 = 0.** architecture-refactor §2(2026-06-18) 정리 완전 실현 — **무변경 계층.**

## 9-1. 정합 (무변경 — write 정본 달성)
- **§3 금지신호 전부 0**: 타모듈 repo/service를 write 목적으로 import 0 · `session.get(ForeignModel)`+mutate 0 · `ForeignModel(...)` 생성 0 · admin이 타모듈 Model write 0.
- **cross-module write = application handler → owning facade → service → repo** 정상 라우팅(§1). 검증: credential approve(`PersonFacade.approve_credential`)·subscription(toss webhook→`SubscriptionFacade`)·center application(admin→`CenterFacade`) 전부 owning facade 경유.
- `session.add`류는 전부 **자기 모듈 엔티티**(llm→LlmCall·admin→FAQ 등), foreign 아님.

## 9-2. cross-module import 74건 = 전부 READ (계층 9 대상 아님)
§3의 "모듈간 import 0"은 **write + 도메인간 read**에 적용. 74 import는 read라 두 부류로 이미 흡수됨:

| 부류 | 수 | 처리 | 파괴성 |
|------|:--:|------|:-----:|
| **admin read-model JOIN** (§6.3/EX-2 keeper) | ~65 | **영구 예외** — platform_admin 대시보드가 Center/Member/Client/… JOIN. 유지. 3-3(base-less 3개→`JoinablePostgresRepository`)이 형태 정리 | 비파괴(3-3) |
| **도메인간 read-enrichment** (6-2 D1 scope) | ~8 | **6-2에서 결정됨** — foreign repo read → owning facade read. 여기서 재결정 안 함 | 비파괴(6-2) |

- 예: `answer_inquiry`가 알림용 member 조회로 `MemberRepository` import(자기 inquiry는 own repo로 write) = 6-2 D1. · `llm.aggregate_top_credit_users`·`subscription.list_all_with_credit` = admin read-model(§6.3 keeper).

## 9-3. 실행 후 잔여 (end state)
- 6-2 실행(도메인간 read→client, 9-4)으로 read-enrichment ~8 + foreign `uow.repo` 26 소멸.
- **admin read-model JOIN(~65)은 잔존** — §6.3 정당 예외라 제거 대상 아님. "cross-module import 0"의 예외는 admin read-model뿐.

## 9-4. `{Module}Client` 신설 — cross-module 직접 repo 완전 금지 `[확정: 사용자 2026-07-03]`

**결정: cross-module에서 타 모듈 `repository`/`models`/`services` 직접 **READ** 접근 완전 금지. cross-module READ는 `{Module}Client`(DTO 반환) 경유.** 6-2 D1("foreign facade read, entity 반환")을 **강화** — entity 노출까지 제거(anti-corruption).

> **범위 = READ 전용 (edge case 조사 결과, §9-5).** cross-module WRITE는 client로 옮기지 않는다 — write facade가 `(atomic, model)`을 반환하고 handler가 그 atomic으로 `emit`(event_group_id=요청 스코프, handler 소유)하므로, DTO client로 바꾸면 atomic 흐름·eventing이 깨진다. WRITE는 facade 경유(§1) 유지(이미 "직접 repo"가 아님). **client = cross-module READ, facade = 자기모듈 + write(atomic).**

### Client 형태
- 위치: `modules/{m}/client.py` (facade 옆, 모듈 루트 public 표면).
- `class {Module}Client: __init__(uow)`. **받은 uow**로 자기 모듈 facade/service 호출 → **published DTO** 변환 반환(자체 세션 안 엶 — 같은 tx 원자성).
- **반환 = DTO**(frozen dataclass/BaseModel, 내부 Model 아님). 선례: `AuditAtomic`(event)·`InstitutionSummary`(institution) → 전 모듈 승격. DTO는 세션 detached라 commit 후 직렬화도 안전(MissingGreenlet 회피).

### 역할 경계 (facade vs client)
| 표면 | 소비자 | 반환 | 용도 |
|---|---|---|---|
| **Facade** | 자기 모듈 handler + application handler(**write 조율**) | entity / `(atomic, model)` / `*_with_response` | 자기모듈 + cross-module **write**(atomic→emit) |
| **Client** (신설) | **타 모듈·application handler**(cross-module **read**) | **DTO** | cross-module **read**만 |
- cross-module-write.md §1(write 조율=owning facade)은 **불변** — write는 facade 유지(atomic 흐름). client는 read 대체만.

### 엄격 금지 + 강제
- **cross-module READ에서** `from app.modules.B.(repository|models) import`(B≠A) · `uow.repo(BRepository)` — **완전 금지.**
- **hook**(pre-commit AST): module·application handler 파일에서 foreign `uow.repo(...)` / foreign repository·model import(read 목적) 감지 시 실패. (write 조율의 owning facade 호출은 허용.)
- **유일 예외 = admin read-model JOIN(§6.3)**: 진짜 JOIN projection은 client로 불가 → `JoinablePostgresRepository`(3-3)에 격리, foreign **model** import만 허용(repository 아님), read 전용.

### 예시
```python
# bad: 타 모듈 repo 직접 (approve_credential.py:25-26)
person = await uow.repo(PersonRepository).find_by_id(pid)
members = await uow.repo(MemberRepository).list_by_person(person.id)

# good: 타 모듈 client (DTO 반환)
person = await PersonClient(uow).get(pid)                            # → PersonDTO | None
center_ids = await CenterClient(uow).list_center_ids_by_person(pid)  # → list[str]

# modules/person/client.py
@dataclass(frozen=True)
class PersonDTO:
    id: str
    name: str
    account_id: str | None

class PersonClient:
    def __init__(self, uow): self._uow = uow
    async def get(self, person_id: str) -> PersonDTO | None:
        p = await PersonFacade(self._uow).get_person(person_id)   # 내부 = facade/service
        return PersonDTO(id=p.id, name=p.name, account_id=p.account_id) if p else None
```

### 리플/파괴성
- 신규: cross-module read 노출 있는 모듈에 `client.py` + read DTO(person·center·member 우선). batch 메서드(`get_by_ids`) 포함(N+1 방지, §9-5).
- 소비처: application handler/module의 **foreign READ** `uow.repo(...)` **26곳** → `{Module}Client`. (foreign **write** facade 호출은 그대로.)
- 개정: 6-2 D1 supersede(facade read→client read, DTO) · hook 신설. cross-module-write.md §1(write=facade)은 불변.
- 파괴성: 소비처 read 변경(DTO 필드 동형이면 비파괴).

## 9-5. edge case 조사 (현재 코드 — client 범위를 read로 확정한 근거)

| # | edge | 현재 코드 | 함의 |
|---|------|----------|------|
| 🔴1 | **write+eventing atomic 흐름** | `atomic, model = Facade.write(...)` → handler `emit(atomics=[atomic])` (schedule·member·login 등) | write를 DTO client로 옮기면 **atomic이 숨어 emit 불가**(event_group_id=handler 소유). → **write는 facade 유지** |
| 🟠2 | **write 반환 entity가 이후 로직+직렬화** | approve_credential: `credential.person_id/…` + `CredentialResponse.from_orm_model(credential)` | DTO는 `from_orm_model` 불가 + 필드 다수 → write=entity(facade) |
| 🟢3 | **read는 client 매끄러움** | approve_credential `person_repo.find_by_id`·`member_repo.list_by_person` = 진짜 대체 대상 | DTO client로 치환. **DTO 세션 detached → commit 후 직렬화 안전(MissingGreenlet 이득)** |
| 🟢4 | **same-uow 원자성** | client가 받은 uow로 facade/service 호출 | 자체 세션 안 엶 → 같은 tx 보장 |
| 🟡5 | **BG bg_uow** | `update_notice.py:53` BG 본문 `bg_uow.repo(Center/Member/Person)` | `CenterClient(bg_uow)` — client가 uow 받는 계약이라 OK |
| 🟡6 | **N+1** | read-enrichment 루프(member→person) | client에 **batch 메서드**(`get_by_ids`) 필수 |
| 🟡7 | **circular import** | A client가 B client 참조 가능 | client 내부 **lazy import**(facade 사슬 안 끌어옴, 기존 관례) |

**결론: client = cross-module READ 전용(DTO). WRITE는 facade(atomic) 유지.** "직접 repo 사용 금지"의 실제 대상 = foreign READ 26곳.

---

## 실행 워크리스트 (계층 9)

| 작업 | 대상 | 파괴성 |
|------|------|:-----:|
| — | **없음** (write 정합, read는 6-2/3-3에 흡수) | — |
| rule | cross-module-write.md **무갱신** (이미 정합) | — |

**계층 9 = 무변경 확인 계층.** architecture-refactor §2에서 write 소유 정본이 이미 달성됨. read-side는 6-2(D1)·3-3(JoinableRepo)이 소유하고 여기서 재결정하지 않는다.

---

## 예시 코드 (canonical — 세 패턴을 `approve_credential.py`가 다 보여줌)

### A. cross-module WRITE 정본 (계층 9) — `approve_credential.py:29`
```python
# write = owning 모듈 facade 경유. application handler가 조율.
credential = await PersonFacade(uow).approve_credential(
    credential_id=credential_id,
    admin_account_id=admin_account_id,
)
# admin이 person 엔티티를 직접 write 안 함 — PersonFacade → PersonService → PersonRepository → Entity.
# §3 금지신호(타모듈 repo write import·session.get(Foreign)·ForeignModel(...)) 전부 회피.
```

### B. read-enrichment (6-2 D1 scope — 계층 9 대상 아님) — 같은 파일:29-37
```python
# bad(6-2): 타 모듈 repo 직접 import해 read enrichment
person = await uow.repo(PersonRepository).find_by_id(credential.person_id)
members = await uow.repo(MemberRepository).list_by_person(person.id)

# good(6-2 D1 뒤집기): owning facade read 경유 (foreign repo import 0)
person = await PersonFacade(uow).get_person(credential.person_id)
center_ids = await CenterFacade(uow).list_center_ids_by_person(person.id)
```
> write(A)는 이미 facade 경유라 계층 9 정합. read(B)의 foreign-repo import는 **6-2가 소유**(여기서 재결정 안 함).

### C. admin read-model JOIN (§6.3 keeper — 정당한 cross-module read) — `platform_admin/center/repository.py`
```python
from app.modules.center.center.models import Center
from app.modules.center.member.models import Member
from app.modules.client.profile.models import Client   # + Person·Role·Account·Subscription
# admin 대시보드 read-model: 7개 모듈 JOIN projection.
# read 전용 → §6.3/EX-2 허용(write로 확장 금지). 3-3이 JoinablePostgresRepository로 base 정리.
```
