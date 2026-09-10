---
paths:
  - "apps/api/app/modules/**/facade/**"
---

# Facade — 모듈 외부 표면

facade는 모듈의 **외부 경계**다 — application handler(크로스모듈 조율)와 자기 모듈 handler가 진입하는 단 하나의 표면. 자기 모듈 service들을 UoW에 엮어 호출하고, 타 도메인 모듈의 내부(`service`/`repository`/`model`)는 건드리지 않는다.

루트: 모듈 경계 [package-init.md](package-init.md) · 크로스모듈 쓰기 [cross-module-write.md](cross-module-write.md) · service 흐름 [service.md](service.md). 레퍼런스 [form/facade](../../../apps/api/app/modules/form/facade/).

---

## 이 문서

| 섹션 | 핵심 규칙 |
|------|----------|
| 위치·형태 | 모듈 루트 `facade/`. `class {Noun}Facade` + `__init__(uow)`. 메서드 = `uow.repo` + `Service` + `execute` |
| 두 반환 | 엔티티 반환(application handler용) / Response 반환(`*_with_response`, 자기 모듈 handler용) |
| 조율 범위 | 자기 모듈 형제 서브모듈 여럿은 조율(한 aggregate). 타 도메인 모듈은 비접근 |
| 경계 | tx·commit 안 함(uow 받음). 크로스모듈 write는 application handler |

---

## 1. 위치 · 형태

모듈 루트 `facade/`에 산다(서브모듈 아님 — 외부 경계라 루트). `__init__(uow)`로 UoW를 받고, 메서드마다 repo를 취득해 service를 호출한다.

```python
# good: uow 주입 → uow.repo → Service → execute
class OperatingTimeFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def initialize_default_operating_times(self, *, center_id: str) -> None:
        repo = self._uow.repo(OperatingTimeRepository)
        await BulkUpdateOperatingTimesService(repo).execute(
            center_id=center_id,
            rows=DEFAULT_OPERATING_TIMES,
        )
```

- 클래스명 `{Noun}Facade`, `self._uow` 보관. repo는 `self._uow.repo(Repo)`(같은 세션 공유), 비즈니스는 `Service(repo).execute(...)`에 위임 — facade는 **얇은 조립**, 비즈니스 로직을 직접 들지 않는다.
- facade가 직접 repo/service를 import해도 되는 건 **자기 모듈** 것뿐(루트 `facade`는 모듈 내부를 안다).

## 2. 두 반환 스타일

같은 facade가 호출자에 따라 두 표면을 낸다:

| 호출자 | 메서드 | 반환 |
|---|---|---|
| application handler (크로스모듈 조율) | `{verb}_{noun}` / `initialize_*` | **엔티티/Model**(상위가 추가 조립) |
| 자기 모듈 handler (HTTP) | `*_with_response` / `list_*_with_response` | **Response 스키마/DTO** |
| 자기 모듈 handler (**event 발행**) | `list_*` / `{verb}_{noun}` (tuple) | **`(atomic[s], Model[, Page])`** — service가 만든 atomic을 pass-through, emit·직렬화는 handler |

- 엔티티 반환은 application handler가 여러 모듈 결과를 한 트랜잭션에 엮을 수 있게. Response 반환은 자기 모듈 handler가 그대로 HTTP로 내보내게.
- **직렬화(`Response.model_validate`)의 위치 — 네 경로**: ① 자기 모듈 HTTP = facade `*_with_response`(정본, 다수), handler는 thin pass-through. ② facade 없는 단순 모듈 = handler([service.md](service.md) §7). ③ 크로스모듈 = application handler가 entity-반환 facade들을 조립 후 직렬화([application.md](application.md) §1). **④ event 발행(behavior 전환) = facade가 `(atomic[s], Model[, Page])` tuple 반환(직렬화 안 함), handler가 emit + 직렬화** — atomic은 **service가 생성**([eventing.md](eventing.md) §4 service=atomic), facade는 그 tuple을 **pass-through**(마커 생성 안 함). handler가 `event_group_id`(behavior `ctx`)를 가져 emit하므로 모델·atomic을 handler로 올린다. `*_with_response` 대신 tuple 반환. 레퍼런스 [center/facade/member_facade](../../../apps/api/app/modules/center/facade/member_facade.py) `delete_member`/`deactivate_member`(`tuple[MemberAtomic, Member]`) + [application/handlers/center](../../../apps/api/app/application/handlers/center/)가 emit. 한 메서드가 두 모양을 섞지 않는다.
- **한 동작 = 한 모양** — 같은 write에 tuple 메서드와 `*_with_response`를 **둘 다** 두지 않는다. 구 agent mutation 엔진이 handler를 우회해 직렬화된 Response를 기대하던 시절의 브리지 예외는 엔진·브리지 모두 제거로 소멸(2026-08-12).
- **세션 내부 직렬화는 안전** — `model_validate`가 caller의 `async with uow:` 안(commit 전 포함)에서 일어나도 `expire_on_commit=False`(현 `AsyncSessionLocal`)라 속성이 만료되지 않는다. MissingGreenlet은 *세션 종료 후* lazy-load에서만 나므로, 세션이 열린 facade 내부 직렬화는 위험이 없다([persistence-repository.md](persistence-repository.md) §8).

## 3. 조율 범위 — 자기 모듈만

- **같은 모듈 형제 서브모듈 여럿**은 한 facade가 조율한다(한 aggregate cascade) — 예: 운영시간 facade가 `center_operating_time`·`center_non_operating_time`·`center` 서브모듈을 함께 읽는다([package-init.md](package-init.md) §1 기능 서브모듈).
- 다중 테이블 cascade 삭제도 facade가 조율 — `list_*_ids`(조회) 후 `remove_*`(→int), 한 UoW 트랜잭션([persistence-repository.md](persistence-repository.md) §11).
- **타 도메인 모듈은 비접근** — 타 모듈 `facade`/`service`/`repository`/`model` import 금지. facade→facade도 금지. 크로스모듈은 application handler(§4).

## 4. 경계 — facade가 안 하는 것

- **tx 경계·commit 안 함** — UoW를 받기만 한다. `async with uow:`/`commit()`은 server `behavior.request` 또는 worker behavior가 소유하고 handler도 tx-free다.
  - 실패 흔적 보존(인증 실패 카운터 등 "거부하되 남김")이 필요해도 facade가 `commit`하지 않는다 — 호출자가 `uow.reject(exc)`(commit+raise, 세 번째 outcome [eventing.md](eventing.md) §7). 레퍼런스: [verify_send_result](../../../apps/api/app/application/handlers/assessment/verify_send_result.py)(인증 실패 시 emit 후 `uow.reject` — 이관 완료 2026-07-14).
- **크로스모듈 write 조율 안 함** — owning 모듈 facade write 메서드를 호출해 엮는 건 application handler의 유일 책임([cross-module-write.md](cross-module-write.md) §1). facade는 자기 엔티티 write만 노출.
- **크로스모듈 read 집계 안 함**(루트 facade) — 각 모듈 조회 후 Python 조립은 application handler. 예외는 admin read-model 직접 JOIN([persistence-repository.md](persistence-repository.md) §6.3).

---

## 안티패턴

- facade에 비즈니스 로직 인라인(검증·도메인 조작) → `Service`로, facade는 얇은 조립
- facade가 타 도메인 모듈 `facade`/`service`/`repository`/`model` import → application handler([cross-module-write.md](cross-module-write.md))
- 루트 facade가 크로스모듈 write 조율 → application handler가 유일 주체
- 한 메서드가 엔티티와 Response를 섞어 반환 → `*_with_response`로 가른다
- facade에 `async with uow`/`commit()` → tx는 behavior 소유
- 모듈/메서드 docstring·`# ====` 배너 → 삭제([apps/api/CLAUDE.md](../../../apps/api/CLAUDE.md))
