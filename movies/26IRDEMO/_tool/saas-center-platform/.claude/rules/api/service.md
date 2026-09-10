---
paths:
  - "apps/api/app/modules/**/services/**/*.py"
  - "apps/api/app/modules/**/handlers/**/*.py"
---

# Service / Handler — use-case 설계 + 스타일

use-case 한 동작 = service 파일 하나. service는 **한 repo를 받아 비즈니스 흐름을 돈다** — tx 경계도, HTTP 변환도, 타 모듈 접근도 갖지 않는다(전부 위/옆 레이어). handler가 그 service를 UoW 트랜잭션에 감싸 호출한다.

루트: 주석 규약 [apps/api/CLAUDE.md](../../../apps/api/CLAUDE.md) "주석·docstring" · repo 계약 [persistence-repository.md](persistence-repository.md) · 모듈 경계 [package-init.md](package-init.md) · 크로스모듈 [cross-module-write.md](cross-module-write.md).

---

## 이 문서

| 섹션 | 핵심 규칙 |
|------|----------|
| 파일 구조 | 한 use-case = 한 파일. `class {Verb}{Noun}Service` + `__init__(repo)` + `async def execute(*, ...)` |
| 시그니처 | **primitive in / Model out**. `*` 배치=X2(식별 앞·값 뒤). service는 Model·Response를 만들지 않는다 |
| 본문 | phase 마커(소문자 한 단어) + 단계 사이 빈 줄. 나레이션 주석 금지 |
| repo 접근 | `self.repo` 하나 — 자기 소유 모듈 repo. 다중·크로스는 facade/application |
| 변형 | pure-logic(sync·repo 없음) / policy(fallback은 service) / orchestration(facade) |
| 경계 | tx·commit은 behavior([behavior.md](behavior.md))/레거시는 handler. 직렬화는 handler. service는 흐름만 |
| handler | service 호출 + atomic 수집 + event 1회 emit + 직렬화. tx는 behavior 소유 |

---

## 1. 파일 구조 — 한 use-case = 한 파일

`{module}/{submodule}/services/{verb}_{noun}.py`. 파일 하나에 동작 하나, 클래스 하나.

```python
# good: 예시 — services/create_widget.py (한 use-case = 한 파일)
from app.core.type import uuid_str

from ..models import Widget
from ..repository import WidgetRepository


class CreateWidgetService:
    def __init__(self, repo: WidgetRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        center_id: uuid_str,
        name: str,
        owner_member_id: uuid_str | None = None,
    ) -> Widget:
        # verify
        await self.repo.verify_name_available(center_id=center_id, name=name)

        # return
        return await self.repo.add(
            center_id=center_id,
            name=name,
            owner_member_id=owner_member_id,
        )
```

- 클래스명 `{Verb}{Noun}Service`, 메서드는 항상 `execute` — 파일명(`{verb}_{noun}`)이 동작을 말한다.
- repo는 생성자 주입(`self.repo`). handler가 `uow.repo(Repo)`로 만들어 넘긴다(§7).
- 모듈 docstring·클래스 docstring 없음([apps/api/CLAUDE.md](../../../apps/api/CLAUDE.md) 주석 규약).

## 2. 시그니처 — kwarg-only · primitive in / Model out

`execute` 인자는 **primitive**(`uuid_str`/`str`/`utc_dt`/`unset`), Model을 받지 않는다. `*` 배치는 repo와 동일(X2): **필수 식별/스코프(id·center_id)만 `*` 앞**, 값·필터·옵션은 `*` 뒤 kwarg-only. 식별만 있으면 `*` 생략.

```python
# good: 식별(widget_id·center_id) 앞 / 값은 * 뒤 (X2), primitive
async def execute(
    self,
    widget_id: uuid_str,
    center_id: uuid_str,
    *,
    name: str = unset,
    status: str = unset,
) -> Widget:
    # return
    return await self.repo.update_in_center(
        widget_id=widget_id,
        center_id=center_id,
        name=name,
        status=status,
    )
```

- **X1**: 정의에 파라미터가 있으면 각 파라미터를 한 줄에 하나(`self`·`*` 포함) + trailing comma, 닫는 `)`는 다음 줄. self-only·무인자만 인라인. **호출부는 대상 아님**(포매터 기본, trailing comma 시 유지) — 짧은 guard 호출 인라인 허용. **X2**: `execute`의 `*` 배치는 repo와 동일(필수 식별만 앞, 값·옵션은 뒤 — [persistence-repository.md](persistence-repository.md) §2).
- 타입은 공용 시맨틱 별칭 [core/type.py](../../../apps/api/app/core/type.py): id=`uuid_str`, 타임스탬프=`utc_dt`, omit-vs-null=`unset`. `@typecheck`는 repo 몫 — service엔 안 붙인다.
- **반환은 Model(또는 그 파생)**, Response 스키마가 아니다. 직렬화는 handler.

반환 형태:

| use-case | 반환 |
|---|---|
| 단건 create/get/update/delete | `Model` |
| 컬렉션 + 페이지 | `tuple[list[Model], Page]` ([persistence-repository.md](persistence-repository.md) §3) |
| 스칼라 조회 | `int`/`bool`/`str` |
| pure-logic(§5) | 계산 결과(`dict`/원시값) |
| **event 발행** 단건(behavior 전환) | `tuple[{Module}Atomic, Model]` — atomic 생성([eventing.md](eventing.md) §4). "Model out" 순수성을 event op에 한해 완화 |
| **event 발행** 목록/read | `tuple[list[{Module}Atomic], list[Model], Page]` — atomic 다건 생성(레퍼런스 `activity_log` list) |
| **event 발행** 벌크 command | `tuple[list[{Module}Atomic], int]` — 영향 건수 + atomic 다건(예: `MarkAllAsRead`) |

### 2.1 직렬화 소유 — 레이어 규칙 (S1)

S1은 타입 분류가 아니라 **레이어 소유**로 가른다. 직렬화(`model_validate`/`*Response(...)`로 Model→HTTP DTO)는 **위 레이어 한 곳에서만** 일어난다([facade.md](facade.md) §2 "직렬화 위치 — 네 경로"가 정본):

> **직렬화는 facade `*_with_response`(자기 모듈 HTTP) 또는 application handler(크로스모듈)에서만. repository·service·entity-반환 facade는 직렬화하지 않는다.**

- **service 불변식:** `execute`에 `model_validate`/`*Response(...)` 없음. service는 `Model`/`tuple[list[Model], Page]`/scalar/**계산 Result**만 반환. (계산 Result = `model_validate` 없이 계산값으로 구성하는 DTO — `ConfirmExtractionResult`·`ClientUnpaidSummary`·`ExportResult`. 직렬화가 아니므로 그대로 둔다, [schema.md](schema.md) §4.)
- **작업은 균일:** service 안의 직렬화 호출(`model_validate`/`*Response(...)`)을 **그 줄째 위 레이어로 이동**. 타입이 Response·Summary·Detail·Item 무엇이든 동일. 옮길 `model_validate`가 없으면(계산 Result) 안 건드린다.
- **캐리어(혼합형):** Result DTO가 엔티티+계산데이터를 함께 실으면 **`Model`(+primitive)을 임베드하고 `*Response`는 임베드하지 않는다** — Response 조립은 소비하는 application handler. `BillableCreateResult.response: BillableResponse`처럼 Response를 품으면 그 직렬화를 application handler로 올린다.

verify(전 모듈 균일): `grep "model_validate\|Response(\|\.build(" .../services/ == 0`. 직렬화는 `*_with_response`/application handler에만 존재. (`.build()`도 검출 대상 — service가 `*ListResponse.build(...)`로 조립하는 우회 차단.)

## 3. 본문 — phase 마커

`execute` 본문 단계를 **소문자 한 단어** 라벨로 표기, 단계 사이 빈 줄. 클래스 마커(`# command`/`# query`)를 본문 단위로 확장한 구조 마커다.

```python
# good: 라벨이 목차
# load
found = await self.repo.get_in_center(widget_id=widget_id, center_id=center_id)

# compute
next_status = "archived" if found.status == "active" else found.status

# return
return await self.repo.update_in_center(widget_id=widget_id, center_id=center_id, status=next_status)
```

- 라벨 예: `# verify` · `# load` · `# compute` · `# emit` · `# return`. 한 phase = 한 라벨.
- 나레이션 금지 — 동작을 문장으로 옮기면(`# 큐에 남은 것 수집`) 삭제([apps/api/CLAUDE.md](../../../apps/api/CLAUDE.md)). 라벨이 못 주는 why/함정만 plain 한 줄로.

## 4. repo 접근 — 하나, 자기 소유 모듈

service는 **자기 모듈 repo 하나**(`self.repo`)만 쓴다.

- must-exist 조회는 repo `get_*`(없으면 raise) — service에 `if x is None: raise` 인라인 금지([persistence-repository.md](persistence-repository.md) §5).
- unique·불변식 검사는 repo `verify_*`/`exists_*` 호출 — service가 `_count(...) > 0` 같은 쿼리 조립 안 함.
- update는 repo `update_in_center`에 primitive + `unset` 전달 — service가 Model을 로드·mutate하지 않는다([persistence-repository.md](persistence-repository.md) §10).
- 다중 테이블·다중 repo 조율은 service가 아니라 **facade**(같은 모듈 cascade) 또는 **application handler**(크로스모듈)다(§5, [persistence-repository.md](persistence-repository.md) §6·§11).
- 예외(결정 2026-07-07) — **부모/자식 단일 애그리게이트의 부속 repo**는 두 번째 주입 허용: 항목·링크가 부모 write와 한 불변식으로 얽혀(검증 루프·인터리브 upsert) facade 분해 시 비즈니스가 facade로 새는 역위반이 되는 경우만(레퍼런스 billing `Billable`+`BillableItem` 6 서비스·voucher `confirm_extraction`). 독립 애그리게이트 조합(history 기록·타 서브모듈 검증)은 여전히 facade 조율.

## 5. 변형 (경우의 수)

| 종류 | 형태 | 예 |
|---|---|---|
| 표준 (repo 1개) | `__init__(repo)` + async `execute` | create/get/list/update/delete |
| pure-logic | repo 없음, **sync** `execute`, 입력은 이미 로드된 데이터·primitive | 위험점수 계산 |
| policy/fallback | repo는 사실만 반환, **service가 정책 소유**(기본값·fallback) | 설정 부재 시 기본 환율 |
| infra 연동 | 외부 어댑터는 `factory.get_X()`로 취득([infrastructure.md](infrastructure.md)) | 메일·LLM 호출 |
| orchestration | service 아님 → facade(모듈 내)·application handler(크로스) | cascade 삭제·enrichment |

```python
# good: pure-logic — repo 없음, sync, 입력은 로드된 리스트
class CalculateRiskScoreService:
    def execute(self, recent_logins: list[LoginNotification]) -> dict:
        # 02:00-05:00 = 비정상 로그인대 (정책 근거)
        ...

# good: policy — fallback 은 service 소유, repo 는 find_active(사실)만
class GetTokensPerCreditService:
    def __init__(self, repo: CreditRateConfigRepository):
        self.repo = repo

    async def execute(self) -> int:
        # load
        config = await self.repo.find_active()

        # return (설정 부재 = 기본 정책)
        return config.tokens_per_credit if config else DEFAULT_TOKENS_PER_CREDIT
```

## 6. 경계 — service가 안 하는 것

- **tx 경계·commit 안 함** — `async with uow:`/`commit()`/`rollback()`은 behavior(전환)/handler(레거시). service에 `session.commit()` 금지.
- **Response 스키마 안 만듦** — Model 반환, handler가 `model_validate`.
- **Model 안 만듦** — repo에 primitive 전달, repo가 Model 조립(§2, [persistence-repository.md](persistence-repository.md) §9).
- **타 모듈 안 건드림** — 타 모듈 `repository`/`service`/`facade`/`model` import 금지. 크로스모듈은 application handler([cross-module-write.md](cross-module-write.md), [package-init.md](package-init.md)).

## 7. Handler — 작업 + 직렬화 (tx는 behavior)

**tx 경계는 behavior가 소유**([behavior.md](behavior.md) §4) — handler는 받은 `uow`로 service 호출 + emit + 직렬화만, `async with uow`/`commit` 없음. 직렬화는 facade 없는 단순 모듈에서 handler 몫(facade 모듈은 `*_with_response`, [facade.md](facade.md) §2).

```python
# good: 예시 — handlers/create_widget.py (behavior 전환, tx-free)
async def create_widget_handler(
    *,
    event_group_id: uuid_str,
    center_id: uuid_str,
    data: WidgetCreate,
    uow: UnitOfWork,
) -> WidgetResponse:
    widget_atomic, widget = await CreateWidgetService(uow.repo(WidgetRepository)).execute(
        center_id=center_id,
        name=data.name,
        owner_member_id=data.owner_member_id,
    )
    await emit(uow, "widget_created", event_group_id=event_group_id, atomics=[widget_atomic], center_id=center_id)

    # return
    return WidgetResponse.model_validate(widget)
```

- **service 발행 → handler 그룹 emit → behavior.request 커밋·dispatch**([eventing.md](eventing.md) §4). handler는 service들의 atomic을 모아 `emit` 한 번.
- `event_group_id`·`uow`는 behavior.request가 만든 `Context`(`ctx`)에서 라우터가 전달(`ctx.uow`·`ctx.event_group_id`, [behavior.md](behavior.md) §4·§5).
- `Response.model_validate`는 커밋 전 실행되나 `expire_on_commit=False`라 안전(behavior.request가 이후 커밋).
- **레거시 잔재**: 일부 handler에 `async with uow:` 래퍼가 남아 있다(behavior tx 안 재진입 무해 — [application.md](application.md) §2). 신규는 tx-free, 손대는 김에 제거. 옛 `get_uow` 의존성은 소진·제거됨(2026-07-28).
- request 스키마 언패킹은 handler가 — service엔 pydantic 스키마가 아니라 primitive를 넘긴다.
- **한 파일 = 한 핸들러.** 파일명은 핸들러명과 일치(`{verb}_{noun}.py` → `{verb}_{noun}_handler`). 보조·변형 핸들러(`list_*`·`get_latest_*`·`restore_*` 등)도 각자 파일로 — 한 파일에 `async def *_handler`를 둘 이상 두지 않는다. 두 핸들러가 공유하는 헬퍼는 `_`-prefix 모듈로 추출해 양쪽이 import. (이유: 핸들러 단위 탐색·도구화·diff 경계를 1:1로. service "한 use-case=한 파일"(§7 안티패턴)과 동일 결.)

---

## 안티패턴

- service나 handler가 `session.commit()`/`async with uow` → tx는 behavior 소유(명시된 stream·worker 예외만 별도 계약)
- service가 Model을 만들어 repo에 넘김(`repo.add(Widget(...))`) → primitive 전달, repo가 조립
- service가 `find_*` + `if None: raise` 인라인 → repo `get_*`([persistence-repository.md](persistence-repository.md) §5)
- service가 `_count`/`select`로 존재·쿼리 조립 → repo `exists_*`/`verify_*`/finder
- service가 Response 스키마 반환 → Model 반환, 직렬화는 위(handler 또는 facade `*_with_response`)가([facade.md](facade.md) §2)
- service가 타 모듈 repo/service/facade import → application handler([cross-module-write.md](cross-module-write.md))
- 모듈/클래스 docstring·나레이션 주석 → 삭제, phase 라벨만([apps/api/CLAUDE.md](../../../apps/api/CLAUDE.md))
- 한 파일에 동작 여러 개 / 메서드명이 `execute` 아님 → 한 use-case = 한 파일, `execute` 고정
- 한 파일에 `*_handler` 둘 이상 → 핸들러마다 한 파일(§7), 공유 헬퍼는 `_`-prefix 모듈로
- handler/service가 `v if v is not None else unset`으로 None 재해석 → unset 관통, 판정은 HTTP 경계 `model_fields_set` 한 곳([persistence-repository.md](persistence-repository.md) §10)
