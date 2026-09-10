# 계층 3 — Repository 설계 `[설계완료]`

정본 rule: [persistence-repository.md](../../rules/api/persistence-repository.md). 상위 인덱스: [convention-design.md](../convention-design.md).

전 모듈 112 repository.py survey 완료. **접두 계약이 이미 95%+ 준수** — 폐기 접두(search_/check_/mark_/sum_) 0 · include_deleted 토글 0 · 단건/컬렉션 혼동 0. 이탈은 국지적·경미. 아래만 설계 대상.

## 3-1. 기계적 이탈 (즉시 수정, 파괴/비파괴 혼합) `[설계완료]`

| 대상 | 위반 | 수정 | 파괴성 |
|------|------|------|:-----:|
| `platform_admin/inquiry/repository.py:17` | `create()` (add 계약 위반) | → `add()` | 소비처만(비파괴, 테이블무관) |
| `platform_admin/faq/repository.py:13` `list_published` | 페이지네이션인데 `_with_page` 없음 | → `list_published_with_page` (반환 `tuple[list,int]`는 admin read-model 정당, §6) | 소비처만 |
| `platform_admin/inquiry/repository.py:74` `list_by_sender_email` | 동상 | → `list_by_sender_email_with_page` | 소비처만 |

## 3-2. `find_active` 2건 = keeper (수정 안 함) `[설계완료]`

Explore가 "base 중복 래퍼 삭제" 권고했으나 **§5-2에서 이미 keeper 확정**:
- `llm/credit_rate_config.find_active()` = 무인자(effective config, base find_by_id(id)와 다름).
- `assessment/assessment_case_participant.find_active(복합키)` = 복합키(단일 id 아님).
- 둘 다 base 동치 아님 → 유지. (아키텍처-refactor todo §5-2 참조.)

## 3-3. admin read-model repo → `JoinablePostgresRepository` 신설 `[설계완료]`

3개 platform_admin repo가 `PostgresRepository` 미상속, `AsyncSession` 직접 + 크로스모듈 JOIN projection:
- `platform_admin/center`(`AdminCenterRepository`) · `platform_admin/center_assessment` · `platform_admin/center_application`.
- 근거: Center·Member·Client·Person·Role·Account·Subscription import JOIN → **§6.3 admin/집계 read-model 표면**. 반환이 합성 row(`(Center, member_count, plan)`)라 단일모델 `PostgresRepository[Center]`에 안 들어감.

**결정(사용자 2026-07-02): `PostgresRepository[M]`를 확장한 두 번째 base `JoinablePostgresRepository` 신설.** base-less 임시가 아니라 정식 base로.

```python
class JoinablePostgresRepository(PostgresRepository[M]):
    # 상속: 단일모델 M의 add/find/get/list/soft-delete/@typecheck
    # 추가:
    async def _rows(self, stmt) -> list[Row]: ...                        # 합성 튜플 row
    async def _page_rows(self, stmt, *, page, size) -> tuple[list, int]: # read-model 페이지네이션(§6)
    # _scalars는 base(§4)에 이미 있음
```

- **이주**: `class AdminCenterRepository(JoinablePostgresRepository[Center])`, `model = Center`. 단일모델 기본기(`find_center`→base `find_by_id`)는 base 재사용(현 `session.get` 중복 제거), 크로스모듈 JOIN은 `_rows`/`_page_rows`.
- **덤으로 해소**: `@typecheck`·`uuid_str` 자연 적용(base 관례). `list_*_with_page` 반환 `tuple[list, int]`은 §6 read-model 정본.
- **§6 경계**: `JoinablePostgresRepository`는 **admin/read-model 표면 전용**. 도메인 repo가 이걸로 크로스모듈 JOIN하면 위반(§6.2 그대로).
- **rule 반영**: persistence-repository.md "유일 base"→**"두 base"**: `PostgresRepository[M]`(단일모델 도메인, 109) / `JoinablePostgresRepository[M]`(단일모델 + 크로스모듈 JOIN projection, admin read-model).
- **실행 확인**: center_assessment·center_application의 primary model이 단일한지(대부분 주엔티티 있음). 없으면 그 repo만 판단.

## 3-6. `super().add` 비대칭 → base protected 헬퍼 `[설계완료]`

**관찰(사용자)**: read는 전부 `self._find`/`self._get`/`self._filter`(protected sugar)인데 **`add`만 `super().add(Model(...))`**로 부모 손뻗침(비대칭). read=base 새 메서드 추가, add=base 오버라이드+super라 생김. 규모: `super().add` 99 · `super().remove_by_id` 5(유일한 super).

**결정(사용자 2026-07-02): self._sugar로 통일.** base가 protected 쓰기 헬퍼 제공, 모듈은 self로 호출(super 제거).
```python
# base
async def _insert(self, instance: M) -> M: ...      # 실제 persist(현 add 본문)
# module — read의 self._get과 대칭
@typecheck
async def add(self, account_id: uuid_str, name: str, ...) -> Person:
    return await self._insert(Person(account_id=account_id, name=name, ...))
```
- Model 구성(`Person(...)`)은 **명시 유지**(필드 매핑 가독성 — `_get`이 where를 명시하는 것과 대칭). base가 **kwargs로 숨기지 않음.
- remove 5건: 스코프 오버라이드분은 `self._remove_by_id`(protected) 또는 self.remove_by_id로(super 제거).
- 파괴성: 비파괴(99 add + 5 remove 내부만, 반환·시그니처 동일). base `add(instance)` public은 `_insert`로 이관/래핑.

## 3-4. 나머지 축 = 준수 (무변경)

단건/컬렉션 접두·command 네이밍·soft-delete 접미·페이지네이션 반환·update 계약(primitive+unset)·인자 배치(`*` 분리) 전부 지배적 준수. 손댈 것 없음.

## 3-5. get/find/exists 책임 경계 — base `_get` 헬퍼 `[설계완료]`

**질문**: 존재 강제(raise)·404 메시지를 repo가 어디까지?
**발견**: 59개 repo가 scoped get(`get_in_center`류)에서 `_find(where=[id,center_id]); if None: raise EntityNotFoundException(f"{Model} not found: {id}")`를 **손으로 반복** — base `get_by_id`가 단일 id만 처리해 scoped를 못 줘서. `verify_`는 repo·service 통틀어 **0건**(미사용).

**결정(사용자 2026-07-02):**
1. **계약은 repo 유지** — `find_`=None / `get_`=raise / `exists_`=bool. 존재 강제를 repo에 두는 건 옳음(호출자 boilerplate 제거, `EntityNotFoundException`=중립 core 신호, 전역 핸들러가 404 매핑. HTTP 누수 아님).
2. **base `_get` 신설** (`_find`의 raise 짝):
```python
async def _get(self, where: list, *, not_found: str | None = None) -> M:
    row = await self._find(where=where)
    if row is None:
        raise EntityNotFoundException(not_found or f"{self.model.__name__} not found")
    return row
```
→ 모듈 `get_in_center` = `return await self._get(where=[Program.id==id, Program.center_id==center_id])` 한 줄. **59 boilerplate 붕괴.**
3. **메시지 = base 제네릭**(`{Model} not found`) 기본. 커스텀은 **정보성**일 때만(권한 없음 등, §5-2 keeper 기준).
4. **`verify_` 미사용 → rule 정리** — repo 접두 목록에서 빼거나 "드묾" 명시. 실제 중복검사 패턴(exists_ + service raise)을 정본으로. (실행 때 verify_ 0 재확인.)

- 파괴성: base `_get` 신설=비파괴(신규). 59개 get_ 리팩터=비파괴(반환·시그니처 동일, 내부만). 메시지 영문↔제네릭 동일해 소비처 무영향.
- rule 반영: persistence-repository.md §4 query sugar에 `_get` 추가, §2/§5에 verify_ 정리.

---

## 실행 워크리스트 (계층 3)

| 대상 | 작업 | 파괴성 |
|------|------|:-----:|
| **infrastructure/persistence** | `JoinablePostgresRepository(PostgresRepository[M])` 신설 (`_rows`·`_page_rows`) | 비파괴(신규) |
| **platform_admin/center·center_assessment·center_application** | `JoinablePostgresRepository[M]` 이주 · session.get→base · @typecheck·uuid_str 적용 · primary model 단일성 확인 | 비파괴(소비처 무손상, 시그니처 유지) |
| **platform_admin/inquiry** | `create()` → `add()` + @typecheck | 소비처만 |
| **platform_admin/faq** | `list_published` → `list_published_with_page` | 소비처만 |
| **platform_admin/inquiry** | `list_by_sender_email` → `list_by_sender_email_with_page` | 소비처만 |
| **infrastructure/persistence** | base `_get(where=, not_found=)` 신설 (raising `_find` 짝) | 비파괴(신규) |
| **59 repo (scoped get_)** | `_find+raise` boilerplate → `_get(where=)` 한 줄. 메시지 제네릭(정보성만 커스텀) | 비파괴(내부만) |
| **rule** | "유일 base"→"두 base" · §4에 `_get` · §2/§5 `verify_` 미사용 정리 | 문서 |

전부 비파괴(테이블 무관, 시그니처/소비처만). find_active 2건은 §5-2 keeper라 제외. **실행 순서**: base 신설(`_get`+JoinableBase) → 59 get_ `_get` 리팩터 + 3 admin 이주 → 소비처 rename 3건 → rule.
