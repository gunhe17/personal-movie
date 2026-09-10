---
paths:
  - "apps/api/app/modules/**/repository.py"
  - "apps/api/app/infrastructure/persistence/**"
---

# Persistence / Repository — 설계 규칙

> 레퍼런스 [activity_log](../../../apps/api/app/modules/activity_log/) (실모듈 파일럿). 평가 원본 [guide.md](../../../apps/api/app/infrastructure/persistence/guide.md).
> 공유 base = [infrastructure/persistence/new_repository.py](../../../apps/api/app/infrastructure/persistence/new_repository.py)(`PostgresRepository[M]`·`Page`) — **유일 base**(전 모듈 110개 상속). ratchet 이행 완료, 구 `BaseRepository` 제거됨(2026-06-24). 파일명의 `new_` 접두는 vestigial(rename 보류).
> agent query 표면 환산기 = [infrastructure/persistence/agent_query.py](../../../apps/api/app/infrastructure/persistence/agent_query.py)(`resolve_sort`·`normalize_limit`·`merge_fields`·`to_dicts` — `offset_page`와 같은 결의 경계 번역, 2026-07-29 core에서 이전). 어휘 계약은 [naming.md](naming.md)·[agent-query.md](agent-query.md) 소유.
> 레이어: Router → Handler → (Facade) → Service → Repository → DB. 트랜잭션 경계 = UoW(Handler 소유). Repository는 commit 안 한다(flush만).
> **Entity-free**: SQLAlchemy Model이 도메인 데이터(roadmap "매핑 레이어 불필요" 유지). 차용분은 네이밍 + query sugar뿐 → 소비처 변경 0. 실모듈은 건드릴 때마다 점진(§8).

## 1. 타입 구조 — `PostgresRepository[M]`

Entity 개념 없음 — SQLAlchemy Model(M)이 도메인 데이터다. repo는 Model in / Model out.

```python
# good: module repo 선언 = 한 줄
class WidgetRepository(PostgresRepository[Widget]):
    model = Widget
```

- instance + 주입 session 유지(`UoW.repo(X)` 호환). classmethod + per-call session(레퍼런스 형태)은 미채택 — 호출 규약 전면 변경이라 비용 큼(§8).
- Model을 그대로 반환하니 소비처(service/handler·schema의 `model_validate`)는 변경 0.
- 쓰기: command는 **primitive 인자**로 받아 repo가 Model을 구성/조립(§9). service는 primitive만 넘긴다(Model 미구성). command 표면 = `add`·`update_in_center`·`remove_in_center`.
- `add`는 PK를 받지 않는다 — BaseModel이 생성. **호출자가 PK를 지정**해야 하는 경우(상위에서 발급한 id를 그대로 PK로 박는 client-assigned identity)는 `add`에 `id=` 옵션을 끼워넣지 말고 **별도 메서드 `add_with_id`로 분리**(§9). 한 메서드가 "자동 PK / 외부지정 PK" 두 의도를 섞지 않게.

## 2. 메서드 그룹 + 네이밍

repo 본문은 세 그룹: `# command` / `# query` / `# helpers`.

지배 원칙: **이름만 보고 `(예외 여부 · 개수 · 반환 형태)`를 예측할 수 있어야 한다.** 접두 1개 = 의미 1개 — "시그니처 봐야 앎"·특례 금지.

### read — 단건 (부재 행동으로 갈림)

| 접두 | 반환 | 부재 시 |
|---|---|---|
| `find_*` | `Model \| None` | None (호출자가 분기) |
| `get_*` | `Model` | raise `EntityNotFoundException` (404) |
| `exists_*` | `bool` | — |
| `verify_*` | `None` | 위반 시 raise (중복·조건) |

`get_`·`find_`는 **단건 전용** — raise/None 부재 약속은 단건에서만 의미를 갖는다. 컬렉션이면 절대 쓰지 않는다.

### read — 컬렉션·집계 (개수/형태를 이름이 고지)

| 접두 | 반환 | 용도 |
|---|---|---|
| `list_*` | `list[Model]` (빈 = `[]`) | Model 목록 |
| `list_*_with_page` | `tuple[list[Model], Page]` | 페이지네이션(§3) |
| `list_*_ids` | `list[str]` / `set[str]` | id 컬렉션 (cross-module 조립용 §6.2) |
| `count_*` | `int` | 개수 |
| `aggregate_*` (또는 접미 `*_summary`/`*_stats`/`*_breakdown`/`*_map`) | `dict` / `tuple` / `list[dict]` | 통계·그룹핑·맵 등 파생 집계 (admin read-model §6.3 포함) |

컬렉션 부재 규칙:
- 항상 `[]` 반환 — **`list \| None` 금지**(모호성을 반환타입에 전가).
- "스코프가 존재하냐"는 **별도 `get_*`/`exists_*` 호출**로 검증 — `list_`가 떠안지 않는다(스코프드 컬렉션은 무효 스코프에서 자연히 `[]`로 수렴 §7).
- "공집합이 곧 오류"인 불변식은 service `verify_*`(repo `list_`는 여전히 `[]`).

### read — lifecycle-state 가시성 (§7 테넌시와 대칭 차원)

soft-delete 상태는 1급 차원이다. **active(미삭제)가 기본** — base sugar(`_find`/`_filter`/…)가 자동으로 `deleted_at IS NULL`을 얹는다.

| 상태 | 네이밍 | 비고 |
|---|---|---|
| active(기본) | 평범하게 `find_*`/`get_*`/`list_*` | 이름에 **`active` 안 붙인다** — 기본을 특별한 척 표기 금지 |
| 삭제 포함 | 접미 `*_including_deleted` | 탈출구(복구·감사). `*_all_centers`(§7)와 대칭 |
| 삭제분만 | 접미 `*_deleted_only` | 드뭄 |

- `find_active(id)`처럼 base 기본 동작과 동일한 래퍼는 **신설 금지** — base `find_by_id`/`get_by_id`를 그대로 쓴다(중복 래퍼는 삭제).
- 삭제 가시성을 `include_deleted: bool` 파라미터로 토글하지 말 것 — 차원을 **이름**으로 드러낸다(`find_by_id` vs `find_by_id_including_deleted`).

### command (쓰기)

| 접두 | 용도 |
|---|---|
| `add` / `add_with_id` | create (PK 자동 / 외부지정 §9) |
| `update_in_center` · `update_in_place` (글로벌 `update`) | 필드 수정 — primitive + `unset` (§10) |
| `remove_in_center` · `remove_by_id` | soft delete |
| `increment_*` | 원자적 상대 변경 (`x = x + 1`) |
| `next_*` | 다음 시퀀스 값 발급 (`int`/`str`, base `_next_seq` 위임). 동시성 필요 시 락은 별개(§10) |

`find_*_for_update`(None) · `get_*_for_update`(raise) = 락 읽기(§10).

### 폐기 (미허용 접두 → 대체)

`sum_`→`aggregate_`/`count_` · `search_`→`list_`(검색도 컬렉션) · `check_`→`exists_`/`verify_` · `mark_`/비원자 `set_`→`update_*` · 물리 `delete_`→`remove_*`(soft) 또는 replace-패턴 명시 주석. 허용 접두라도 **반환이 계약과 어긋나면 위반**(`get_`이 None/dict/list, `find_`가 list/dict 반환 등).

- 예외: `event/**` 아웃박스 repo의 `mark`/`claim`/`succeed`/`fail`류는 [eventing.md](eventing.md)가 정본인 도메인 어휘 — 위 폐기 접두 규칙 대상 아님(워커 인프라).

- 페이지네이션 메서드 이름엔 `_with_page` 필수(반환이 `tuple[list, Page]`임을 드러냄).
- **인자 배치 — `*`로 필수식별/나머지 분리(X2)**: 연산 대상을 특정하는 **필수 식별/스코프**(`id`·`center_id` 등 default 없는 대상 지정 인자)만 `*` 앞, **그 외 전부**(생성/수정 필드 값·필터·옵션·페이지네이션 — 대개 default/`unset`)는 `*` 뒤(kwarg-only). 판정 한 줄: "대상을 특정하나(앞) / 연산을 채우거나 조정하나(뒤)". 식별만 있으면 `*` 생략.
- 호출은 전부 **kwargs 관례**(service·facade) → uuid positional 스왑 방지 + typecheck 작동(§9). 시그니처가 positional을 허용해도 호출 규약으로 막는다.

```python
# good: 식별(center_id)만 앞 / 필터·페이지네이션은 * 뒤
async def list_in_center_with_page(
    self,
    center_id: uuid_str,
    *,
    category: str | None = None,
    date_from: utc_dt | None = None,
    page: int = 1,
    size: int = 20,
) -> tuple[list[Widget], Page]: ...

# good: add 는 식별(center_id) 앞 / 값 필드는 * 뒤
async def add(
    self,
    center_id: uuid_str,
    *,
    name: str,
) -> Widget:
    ...
```

## 3. 페이지네이션 — `tuple[list[Model], Page]`

`Page`는 메타데이터 전용 TypedDict (items 미포함):

```python
class Page(TypedDict):
    total: int
    page: int
    size: int
    pages: int
```

- 반환 = `(items, page)` 튜플. items(직렬화 대상)와 meta(스프레드 대상)를 한 dict에 안 섞는다.
- 소비: `widgets, page = await repo...; return {"items": [Resp.model_validate(w) for w in widgets], **page}`.
- 직렬화는 handler 몫 — repo는 Model 반환.
- 메서드 이름에 `_with_page` 필수(§2).

## 4. query sugar — `where=[...]` 기반

복합 쿼리는 base가 숨기지 않고 module이 `where` 리스트로 조립한다. 모든 sugar가 soft-delete를 자동으로 얹는다.

| 헬퍼 | 용도 |
|---|---|
| `_find(where=[...])` · `_find_by(column, value)` | 단건 → `Model \| None` |
| `_filter(where=[...], order_by, descending, limit, offset)` | 목록 → `list[Model]` |
| `_count(where=[...])` | `int` |
| `_page(where=[...], page, size, ...)` | `tuple[list[Model], Page]` |
| `_scalars(stmt)` | 직접 짠 stmt(복합 JOIN 등) → `list[Model]` |

- `order_by`는 컬럼명 문자열 — module이 신뢰된 값만 넘긴다(외부 입력 직결 금지).
- `_find`/`_filter`로 안 되는 쿼리(JOIN·서브쿼리·lock)는 module이 stmt를 직접 짜고 `_scalars`로 매핑.

## 5. 에러

- `get_*`은 core `EntityNotFoundException` raise — 전역 핸들러가 이미 404로 변환(별도 배선 불필요).
- raising 여부는 이름이 드러낸다: `find`/`exists`(비-raising) vs `get`/`verify`(raising).

## 6. JOIN 정책 — 소유 모듈 내부만

조사(2026-06-18): 권위는 roadmap **결정 A**.

1. module repository는 **자기 소유 테이블(자기 aggregate + 서브모듈) 내부에서만 JOIN.** 직접 짠 stmt + `_scalars`.
2. **크로스모듈 결합은 repository JOIN 금지.** application handler가 id로 각 모듈 조회 후 Python 조립(`application/handlers/list_clients_enriched`). 모듈 간 model import·순환 0. **facade·service 호출도 application handler만** — 도메인 모듈은 타 모듈의 `facade`/`service`/`repository`/`model`을 import 안 한다([package-init.md](package-init.md) 모듈 비노출).
3. 예외: **admin/집계 read 표면(`platform_admin/*`)은 의도적 크로스모듈 JOIN 허용**(전역 read-model). 전 센터 조회는 `*_all_centers` 별도 이름 — scoped 메서드에 `center_id=None` 우회 금지.

| 패턴 | 위치 | 허용 |
|---|---|---|
| 소유-내부 JOIN | `voucher/center_voucher`, `counseling/*_participant` | 허용 |
| 크로스모듈 JOIN = admin 표면 | `platform_admin/*`만 (구 `subscription.list_all_with_credit`·`llm.aggregate_top_credit_users`는 2026-07-28 platform_admin/{subscription,ai_usage}로 이관) | 허용(read-model) |
| 크로스모듈 도메인 enrichment | `application/handlers/list_clients_enriched` | repo JOIN 금지 → application 조립 |
| **명문 예외 — schedule 취소충돌 서브쿼리** | `schedule/schedule/repository.py` `_CANCELLED_ONLY_SCHEDULE_IDS` (세션 2테이블 raw SQL) | 허용(승인 2026-07-08). 충돌 판정("세션 전부 취소된 일정은 충돌 아님")은 타모듈 세션 상태가 본질 입력인데, 호출이 반복일정 루프(×N)라 application 조립 시 +2N 왕복 + 판정 로직이 application으로 새는 역위반. 이 1곳 한정 — 확장 금지, 성능 이슈 시 서브쿼리에 center 스코프 추가로 대응 |

read-model 페이지네이션: admin/집계 표면이 dict·tuple-row를 페이징할 땐 `*_with_page` 네이밍을 쓰되 **`tuple[list, int]`(total) 반환 허용** — page 메타는 전용 response 빌더가 계산한다(§3 `Page`는 Model 목록용). Model 목록 페이지네이션은 §3대로 `tuple[list[Model], Page]`.
## 7. 스코프 — 테넌시 · 소유 (같은 차원)

- `center_id` 보유 모델은 scoped 조회(`where=[Model.center_id == center_id, ...]`) — 타 센터 = None/404 수렴(채택 2). center 검증 분기 불필요.
- 진짜 다센터 소비처만 `*_all_centers` 탈출구. 비-scoped(center_id 없는 감사로그 등)는 그대로.
- **소유(`person_id`·`account_id`·`created_by`)도 같은 차원이다** — "본인 것만"은 꺼낸 뒤 `if row.owner != me: raise`가 아니라 **WHERE 절**로 건다. 남의 행 = None/404 수렴(존재 여부도 안 흘림). 분기는 빼먹을 수 있고 빼먹어도 테스트·린트가 조용하다.
  - 단건 스코프드 조회 = `get_by_{scope}`(raise) / `find_by_{scope}`(None) — §2 접두 계약 그대로. 2축이면 `get_owned`(레퍼런스 notification_setting: center+account).
  - 센터 API의 row-level 본인필터는 `ServerContext.owner_scope`가 정본([behavior.md](behavior.md) §2) — repo가 필터값으로 받는다. `owner_scope`가 없는 flow(`UnscopedContext`·`AdminContext`)가 손코딩이 새는 자리였다.
  - 레퍼런스: credential `get_by_person` · center_application/refresh_token `get_by_account` · notification_setting `get_owned` · ledger `_visible`(다층 가시성 술어).
  - **스코프가 아닌 것은 그대로 분기** — "볼 수 있는 것 중 고칠 수 있는 것"(편집권 계단)은 정책이지 스코프가 아니다(레퍼런스 client_app 기록: 가시성=WHERE / 편집권=handler 분기).

## 8. 차용 범위

이 규칙 = **A·B 채택(Entity-free)**. C·D 미채택.

| 단계 | 내용 | 상태 |
|---|---|---|
| A. 네이밍(`find`/`get`/`exists`/`with_page`) + B. query sugar(`where=[...]`) | module-local, Model 반환 | 채택 — 호출처 영향 0 |
| C. Entity in/out(`mapper`/`to_model`) | 엔티티 43+개 + 소비처 전수 | 미채택 — roadmap "매핑 레이어 불필요" 유지 |
| D. classmethod + per-call session | `UoW.repo()` 깨짐 | 미채택 |

실모듈 차용: base는 `new_repository.py`로 승격 + 모듈 단위 ratchet — **완료**(110 모듈, 구 `BaseRepository` 제거 2026-06-24). facade가 외부 경계 → 시그니처 고정하면 소비처(audit·router·application) 무손상.

**파일럿 완료 — `activity_log`** (append-only, facade-insulated). 실제로 부딪힌 함정 = 이식 체크리스트:

| 함정 | 대응 |
|---|---|
| 모델 등록 | [`app/modules/models.py`](../../../apps/api/app/modules/models.py)가 트리에서 수집 — 이동·신설에 갱신 불요. dev [`init-schema.py`](../../../infra/dev/init-schema.py)만 아직 손 목록 |
| 내부 **positional 호출**이 kwarg 관례(§2)와 충돌 | 이식 전 호출처 grep → kwarg화 |
| `@typecheck`의 `get_type_hints`가 forward-ref(`from __future__ import annotations`·지역 import)에서 **NameError**(실측 2/1634) | 해당 메서드 어노테이션이 모듈 globals에서 resolve되게 |
| handler가 **commit 후 `model_validate`** → `expire_on_commit=False` 전제(아니면 MissingGreenlet) | 세션 설정 확인(현 `AsyncSessionLocal`은 False) |
| base `add`는 flush+**refresh** → fire-and-forget 로그(반환 안 씀)엔 불필요한 SELECT | 고볼륨이면 no-refresh 변형 검토 |
| `new_repository.py`·[`core/type.py`](../../../apps/api/app/core/type.py)(`typecheck`+시맨틱 별칭)는 **동결된 core/infra에 신규 파일** | additive(파괴 0)라 허용 — 결정으로 동결 덮음 |

## 9. 타입 체크 · command

- module repo의 모든 공개 메서드는 **`@typecheck`** ([core/type.py](../../../apps/api/app/core/type.py)) — kwarg 타입을 런타임 검사, 불일치 시 `DevelopError`. **kwargs 호출만 검사**(positional 우회) — service·facade가 전부 kwargs로 부르는 관례가 전제(§2).
- 공용 시맨틱 타입은 [core/type.py](../../../apps/api/app/core/type.py): id = `uuid_str`, 타임스탬프 = `utc_dt`(naive, tzinfo=None). **새 구분을 만드는 것만** 별칭 — `uuid_str`(id↔자유텍스트), `utc_dt`(naive-UTC 규약). `list[str]`·`dict[str, Any]`는 이미 명확하고 인라인으로 충분해 별칭 안 만든다(typecheck도 `list`/`dict`까지만 보므로 별칭 이득 0). **plain alias 필수** — NewType/PEP695 `type`은 isinstance 불가라 typecheck가 스킵한다.
- command는 **Model이 아니라 primitive 인자**로 받는다 — repo가 Model을 구성/조립한다. `instance: Widget`은 "Widget이냐"만 검사되지만 primitive는 필드마다 검사된다. service는 primitive만 넘기고 Model을 만들지 않는다.

```python
# bad:  async def add(self, instance: Widget)   → typecheck가 필드를 못 본다(Widget이냐만)
# good: primitive (field만이라 * 없음 — §2)
@typecheck
async def add(
    self,
    center_id: uuid_str,
    name: str,
    owner_member_id: uuid_str | None = None,
) -> Widget:
    return await super().add(
        Widget(center_id=center_id, name=name, owner_member_id=owner_member_id)
    )
```

### client-assigned PK — `add_with_id` (별도 메서드)

호출자가 PK를 지정해야 할 때(예: 런타임이 발급한 session id를 conversation PK로). `add`에 옵셔널 `id`를 끼우지 말고 분리한다 — `add`는 gold standard 형태(자동 PK) 그대로, 외부지정 PK는 이름이 의도를 드러낸다. service가 분기(`id` 있으면 `add_with_id`, 없으면 `add`).

```python
# bad:  async def add(self, ..., id: uuid_str | None = None)  → 자동/외부지정 두 의도 혼재
# good: id를 받는 건 별도 메서드 (id는 field라 * 없음)
@typecheck
async def add_with_id(
    self,
    id: uuid_str,
    center_id: uuid_str,
    member_id: uuid_str,
) -> AgentConversation:
    return await super().add(
        AgentConversation(id=id, center_id=center_id, member_id=member_id)
    )
```

## 10. update 계약 — 한 형태로 통일

**절대 필드 수정은 단 하나의 형태**: primitive 인자 + `unset` sentinel → base `update_fields`로 위임.

```python
# good: 유일한 update 형태 (글로벌 모델은 이름만 update/update_in_place)
@typecheck
async def update_in_center(
    self,
    id: uuid_str,
    center_id: uuid_str,
    *,
    plan: str = unset,
    trial_end: utc_dt | None = unset,   # None 전달=NULL로 clear, 미전달=유지
) -> Subscription:
    await self.get_in_center(id=id, center_id=center_id)   # 404 + 센터 스코프
    updated = await self.update_fields(id, plan=plan, trial_end=trial_end)
    assert updated is not None
    return updated
```

- `unset`([core/type.py](../../../apps/api/app/core/type.py), `uuid_str`·`utc_dt`와 한곳) = **omit(미전달) vs `None`(NULL로 clear) 구분** — `if v is not None` 필터로는 NULL-clear를 표현 못 한다.
- base `update_fields(id, **fields)`가 `unset`을 걸러 `UPDATE…RETURNING` 1회. 모듈은 타입 명시 시그니처만 선언.
- **service는 Model/dict를 만들지 않는다**: read(`find`/`get`/락 필요시 `find_*_for_update`) → compute → `update_in_center(primitive)`. 필드 단위 typecheck가 전 update에 걸린다.

### 틀린 것 → 맞는 것 (폐기 대상)

| 안티패턴 | 문제 | 대체 |
|---|---|---|
| `save(record: Model)` / `save_and_refresh(record)` | service가 로드된 Model을 mutate(계약 위반), typecheck는 Model 타입만 검사 | service가 새 값 계산 → `update_in_center` primitive |
| `apply_update(id, data: dict)` · `update_fields(id, data: dict)` | dict 표면 — 필드 단위 typecheck 무력 | 타입 명시 primitive 시그니처 |
| `add`/`update`에 `if v is not None` 필터 | nullable 컬럼을 NULL로 못 비움 | `unset` sentinel |
| 중간 레이어의 `v if v is not None else unset` 재해석 | omit vs null 구분이 그 지점에서 소실 — "null=비우기"가 조용히 무시됨(schedule room 비우기 실버그 실증) | unset 관통(아래) |

### unset 관통 — omit/null 판정은 HTTP 경계 한 곳

omit(유지) vs null(비우기)은 **pydantic 경계에서 `model_fields_set`으로 한 번** 판정하고, 그 아래(handler→facade→service→repo)는 unset/None을 **그대로 관통**시킨다. 시그니처 default는 전 레이어 `unset`.

```python
# good: handler가 set된 필드만 추려 관통 — 명시 null은 None 그대로 내려가 NULL-clear
fields = {k: getattr(data, k) for k in data.model_fields_set}
await facade.update_widget(widget_id=widget_id, center_id=center_id, **fields)

# bad: None을 unset으로 되접음 — 클라이언트의 "null=비우기"가 "유지"로 둔갑
await facade.update_widget(room_id=data.room_id if data.room_id is not None else unset)
```

- non-nullable 컬럼(start/end 등)의 명시 null은 경계에서 드롭(유지로 강등) — DB NOT NULL 위반을 500으로 흘리지 않는다.
- 허용 예외: None이 "생략"을 뜻하는 비-pydantic 내부 소스(레거시 dict·옵션 인자)를 unset 시그니처에 잇는 **그 경계 1곳**의 변환. HTTP 경계에서는 금지.

### update가 아닌 별개 연산 (통일 대상 아님 — 분리가 정답)

- **원자적 상대 변경**: `increment_*`·`next_sequence`(`SET x = x + 1`) — DB-side 표현. 전용 메서드.
- **락 읽기**: `find_*_for_update` — 쓰기가 아니라 질의. 그 뒤 `update_in_center`로 씀.
- **삭제**: `remove_in_center`/soft delete — 다른 동사.
- **낙관적 동시성 version-guard**(`WHERE id AND version=expected`): base 고정 WHERE로 표현 불가 → 전용 메서드.
- **벌크 전이 + 영향 행 식별**(`UPDATE…RETURNING` → `list[Model]`): 후속 cascade·사실 기록이 "어떤 행이 전이됐나"를 입력으로 요구할 때 — 사후 재조회는 방금 전이분을 기존 동상태 행과 구분 못 해 RETURNING이 원자적 정본(결정 2026-07-07, 레퍼런스 assessment_session `update_status_by_case`). 이 경우 외 벌크 command 반환은 여전히 `int`.

## 11. 삭제 — soft 기본 / 물리 예외 / cascade는 상위

`BaseModel.deleted_at` 으로 **soft delete가 보편 기본**. 물리삭제는 명시적 예외다.

### 이름·반환 (의미를 표면에)

| 동작 | 이름 | 반환 |
|---|---|---|
| 단건 soft (센터) | `remove_in_center(id, center_id)` | `Model \| None` |
| 단건 soft (글로벌) | `remove_by_id(id)` | `Model \| None` |
| 벌크 soft | `remove_<by_x>_in_center(...)` | `int` (영향 건수) |
| 단건 물리 (예외) | `hard_delete_by_id(...)` | `bool` |
| 벌크 물리 (예외) | `hard_delete_<by_x>(...)` | `int` |
| 복구 | `restore_by_id` / `restore_by_ids` | `Model\|None` / `int` |

- base `remove_by_id`(단건→`Model\|None`)·`remove_where`(벌크→`int`)가 정본 — soft는 여기에 위임.
- **`soft_delete*`·bare `remove`·soft인 `delete*` 금지** → `remove_*`. `hard_remove` → `hard_delete_*`.
- command는 **id를 받는다**(로드 Model 인자 금지 §10). soft도 마찬가지.

### 물리삭제는 3부류만 (이름이 `hard_delete_*`로 경고)

- 보안·휘발성: refresh token, password history (감사가치 없음)
- replace-pattern: 전건 삭제 후 재삽입(operating/working time, role-permission 재할당)
- 순수 junction(m2m 링크)이고 **restore-on-re-add 없는** 경우만

restore-on-re-add(소프트 삭제 행을 재추가 시 복원)가 있는 junction(program_member·session_participant)은 **soft 필수**.

### soft + unique 공존 — 둘 중 하나

soft-deleted 행이 unique 슬롯을 점유해 재생성이 깨지므로:
- **partial unique index** `postgresql_where="deleted_at IS NULL"` (다수 테이블 — 기본 권장), 또는
- **restore-on-re-create**: 생성 전 `find_including_deleted`(unique 키)로 찾아 `restore`(center_assessment).

full unique 제약 + soft 전환은 둘 중 하나 없이는 IntegrityError. 모델에 full unique가 있으면 partial로 바꾸는 **마이그레이션** 필요.

### cascade = facade 조율, repo는 단일 테이블 (결정 ⓐ)

다중 테이블 cascade는 owning facade가 조율한다. command는 rows를 반환하지 않는다 — 자식 id가 필요하면:

```python
# facade — 조회(list_*_ids) 후 삭제(remove_*→int) 시퀀스를 조율. 각 repo 연산은
# 해당 서브모듈 Service로 감싼다(facade.md §1 — repo 직접 호출 금지, 감사 ⑤축). UoW 한 트랜잭션.
session_ids = await ListSessionIdsByCaseService(session_repo).execute(case_id)
await DeleteSessionsByCaseService(session_repo).execute(case_id, center_id=center_id)   # → int
await DeleteParticipantsBySessionIdsService(participant_repo).execute(session_ids)      # → int
```

- 금지: 벌크 soft가 cascade용으로 `list[Model]` 반환(명령+조회 혼합). `list_*_ids`(조회) + `remove_*`(명령→int)로 분리.
- DB `ON DELETE CASCADE`는 FK 없음 + soft라 미사용.
