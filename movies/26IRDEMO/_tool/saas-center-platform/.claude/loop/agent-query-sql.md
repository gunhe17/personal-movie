# agent query SQL 전환 loop — 조회 표면을 레이어 밖 SQL 슬라이스로

agent 노출 조회(`query_*` 35종)를 **handler→agent facade→service→repo 4층 배선**에서
**SQL 한 방(`app/query/`)**으로 내린다. 쓰기(command)는 기존 레이어 그대로 — CQRS의 read side만 분리.
표면 계약(TOOL dict·봉투·필터/투영/정렬 완결)은 **불변**, 내부 구현만 교체한다.

> ## ⚑ 새 세션 이어받기
> - 진행률 = §진행표(상태 열이 SSOT). `[대기]`인 다음 항목부터.
> - **전량 이관 완료**(34종 `app/query/` + tool_registry root). 잔여 = G1 전수 대조·agent facade 읽기 메서드 정리.
> - 표면 계약 정본은 [rules/api/agent-query.md](../rules/api/agent-query.md)·[naming.md](../rules/api/naming.md)·[query.md](../rules/api/query.md).
> - 실행 계약(권한·주입·group_by 후처리)은 [runtime/assistant/execute.py](../../apps/api/app/runtime/assistant/execute.py).

---

## 1. 실측 (2026-08-20)

| 항목 | 현재 |
|---|---|
| `application/handlers/*/query_*.py` 35개 | 4,990줄 |
| `modules/*/facade/*_agent_facade.py` 21개 | 3,053줄 |
| 레퍼런스 [query_session](../../apps/api/app/application/handlers/counseling/query_session.py) | 246줄 · facade 4개 왕복 · 이름 해소 3블록 인라인 |
| v2(SQL COUNT) 전환 | 6/23 진행 중 — **본 loop이 대체** |
| `owner_scope` 수용 handler | 34/35 |

**진단**: `WHERE` 한 절을 facade·service·repo 3층에 손으로 배선하고, 크로스모듈 표시명은 왕복 N번 +
파이썬 조립으로 푼다. SQL이면 `JOIN` 하나. 쓰기에는 레이어가 값을 하지만 읽기(트랜잭션 불변식 없음)에는 순수 비용.

---

## 2. 설계 — 2층

```
app/query/                       ← 레이어 면제 구역 (EX-11 등재 대상)
├── core.py         envelope()   — Select → 봉투(rows+aggregate). 유일한 공통 코드
└── {entity}.py                  — 도구 1개 = 파일 1개 (SQL + TOOL dict)
```

- 현재 5층(handler→agent facade→service→repo→model) → **2층**.
- `_`-prefix 공유 헬퍼 금지(application §1-1과 동일 결). 반복은 감수, 인라인 우선.
- 파일 간 import 금지 — `core`만 공용. 스코프 서브쿼리는 **소비자 2개째**에 `scope.py`로 추출(파일럿은 인라인).

### 2-1. `core.envelope` 계약

```python
async def envelope(session, stmt, *, namespace, default, identity,
                   fields=None, limit=None) -> dict
```

- rows = `stmt.limit(normalize_limit(limit))`, count = `select(count()).select_from(stmt.subquery())`.
- **행/집계가 같은 stmt에서 파생** → 서로 다른 WHERE를 볼 코드 경로가 위상적으로 없다.
  `exact`는 항상 `True`, **v1/v2 등급 구분이 소멸**한다(agent-query.md §정합 구조가 해결하려던 문제의 구조적 제거).
- `fields` 시맨틱은 `merge_fields`와 동일 — 미지정=기본 투영, 지정=`identity`+요청분.
  화이트리스트(`available`)는 두지 않는다 — 모르는 필드명은 행에 키가 없어 자연히 탈락.
- `namespace=None`이면 bare 키(비-agent 소비자용, 구 `namespaced=False`).
- `datetime/date/time` → `.isoformat()` (구 `to_dicts` 책임 승계).
- 타입이 `Select`라 **쓰기가 물리적으로 불가**(가드 ①).

### 2-2. 행 단위 스코프 (파일럿은 쿼리 파일 인라인)

권한(도구 단위)은 [execute.py:75](../../apps/api/app/runtime/assistant/execute.py#L75)가 핸들러 호출 **전에** 막는다
(`TOOL["permission"]` ∉ `ctx.permissions` → is_error). **핸들러가 할 일 없음.**
진짜 게이트는 `owner_scope`(access_level=own) — 컬럼 비교가 아니라 정책이다:

| 스코프 | 정책 (owning facade 정본) | 함정 |
|---|---|---|
| 열람 케이스 | 주담당 + **활성** 공동 상담사 (`list_accessible_case_ids`) | `active_only=True` |
| 담당 내담자 | 상담+검사 담당 케이스의 **전 참여 내담자** (`_resolve_assigned_client_ids`) | 활성 **무관**·과거 포함 |

두 스코프의 활성 조건이 **비대칭**이다 — 한 함수로 뭉치면 조용한 권한 누수/과소노출.

- SQL 서브쿼리로 `WHERE`에 합류 → **절삭 전 적용**. 현행 파이썬 id 목록 방식은 담당 케이스가
  많으면 `IN (...)` 폭발 + 상한 왜곡.
- **정책 정본은 여전히 owning facade** — 서브쿼리는 동치물이고, 동치성은 추상화가 아니라
  **테스트로 핀**한다(§5 G2).
- 파일럿이 쓰는 건 **열람 케이스 하나** — 담당 내담자는 `query_client` 이관(#4 판정 이후) 때 추가.

---

## 3. 결정 대장

| # | 결정 | 근거 |
|---|---|---|
| Q1 | 읽기만 분리, 쓰기는 기존 레이어 유지 | 읽기엔 트랜잭션 불변식이 없다. CQRS 원래 취지 |
| Q2 | `app/query/`는 model 직접 import·크로스모듈 JOIN 허용 | 기존 예외의 확장 — EX-2(platform_admin read-model JOIN)·EX-3(게이트웨이 독립 세션) 선례. 신규 원칙 아님 |
| Q3 | 봉투·TOOL·필터/투영/정렬 완결 계약 **불변** | 표면이 바뀌면 임베딩 벡터·골든·감사가 동시에 흔들린다. 구현만 교체 |
| Q4 | count = 같은 stmt의 서브쿼리 | 행/집계 필터 분기 경로 제거. v2 승격 개념 소멸 |
| Q5 | 스코프 정책은 SQL로 재표현하되 정본은 owning facade | 두 벌이 되는 건 사실 — 추상화 대신 동치 테스트로 관리(비용 최소) |
| Q6 | semantic layer/범용 컴파일러 **금지**(현 단계) | 관계 그래프([relations.py](../../apps/api/app/infrastructure/persistence/relations.py) 마커 138개)·`ontology/`가 이미 원료지만, 쿼리 5개를 손으로 쓴 뒤 반복을 보고 만든다. 선-추상화가 실패 모드 |
| Q7 | v2(SQL COUNT) 전환 **중단** | 잔여 17개가 본 loop으로 전량 대체. 이중 작업 |
| Q12 | **`date_to` 는 종일 포함** — `datetime.combine(date, time.max)`(2026-08-20) | 구 repo 전 사이트가 예외 없이 종일 포함이었다. `DateTime` 컬럼을 맨 `date` 와 비교하면 종료일 00:00 로 잘려 **하루가 통째로 빠진다**. 신 구현 10곳이 이걸 어겼고(내 파일럿 `counseling_session` 포함 — Grok이 그걸 레퍼런스로 27종에 복제) 수정. `Date` 타입 컬럼(`billable_date`·`due_date`·`hire_date`)은 원래 정상 — 감쌀 필요 없다. **의사결정 아님, 결함**: "3월 2일까지"에 3월 2일을 빼는 해석은 없다 |
| Q11 | **`limit` 미노출 도구는 구 상한을 유지**(2026-08-20) | `DEFAULT_LIMIT=20` 은 모델이 `limit` 으로 조절할 수 있을 때의 기본값이다. TOOL에 `limit` 이 없는 9종에 그 기본값을 적용하면 계약이 아니라 **손실**(모델이 볼 행이 1/10). 구 facade가 200/50을 쓴 이유가 그것 — 복원: 200(`assessment_participant`·`billable`·`case_participant`·`member_invitation`) / 50(`document`·`form_instance`·`form_template`·`notice`·`notification`) |
| Q10 | **파일 골격 = 읽는 순서**(2026-08-20) | 평가에서 드러난 결함 3건(TOOL이 185줄 아래·보안 조건 산재·phase 마커 부재)의 근원이 **규칙 누락**이었다 — query.md가 금지/허용만 말하고 "무엇이 먼저 보여야 하는가"를 말하지 않았다. §1-1 신설: 우선순위 5단(도구 정체 → 차단 경계 → 필터/투영 → 관계 → SQL 관용구) · phase 마커 4개 고정(`# filters`/`# scope`/`# project`/`# return`) · **보안 사실은 두 곳에만**(filters 첫 줄 + scope 블록) · 한 글자 모델 별칭 금지 |
| Q9 | **query 계층 rules 신설 + SQL GROUP BY 허용**(2026-08-20 사용자 결정) | [rules/api/query.md](../rules/api/query.md) 신설(paths=`apps/api/app/query/**`). [agent-query.md](../rules/api/agent-query.md) §G-impl에 예외 명시 — 금지 사유(집계 전용 repo/facade 신설로 레이어가 부는 것)가 이 구역엔 없어 소멸. 형태 계약(기존 query + `group_by` enum·`ALLOWED_GROUP_BY`·D1~D7·봉투 키)은 그대로. [ARCHITECTURE.md](../../apps/api/app/modules/ARCHITECTURE.md) EX-11 등재 |
| Q8 | 읽기 전용 세션 **분리하지 않음** | `ctx.uow` 공유 유지. `SET TRANSACTION READ ONLY`는 공유 세션과 충돌하고 별도 세션은 왕복·수명 비용. 쓰기 차단은 `Select` 타입 가드로 충분 |

---

## 4. 파일럿에 걸리는 것

| # | 항목 | 내용 |
|---|---|---|
| C1 | 주입 인자 이름 | `center_id`·`uow`·`owner_scope`·`actor_membership_id`는 **시그니처 이름 매칭**([execute.py:346](../../apps/api/app/runtime/assistant/execute.py#L346)). 틀리면 조용히 `None`. `input_schema` 노출 시 `validate()` 실패 |
| C2 | `group_by` 후처리 | handler 미소유 시 execute.py가 **행 키에서 dim 추출**. `session.status` 네임스페이스 키 유지 필수 |

> 확대 이관 시의 추가 함정(임베딩 드리프트·감사 축 면제·PROJECTION 존치·활성 고정)은 #5 판정 통과 후 여기 추가.

---

## 5. 게이트 (파일럿) — 실행 결과 2026-08-20

대조 스크립트: scratchpad `cmp_query.py` (구·신 같은 인자 8케이스 + 스코프 집합 대조).
seed 센터 `911310f1` / 회기 49건.

- **G1 7/8 OK** — count 전건 일치(49·33·49·49·49·8·30). 미절삭 케이스(client_id 8행)는 rows 완전 일치.
- **절삭 케이스는 rows 미대조** — 구 구현이 `created_at` 동률에 tie-break가 없어 어느 20개가 뽑힐지
  구현마다 다르다(같은 구현 2회는 동일 = 프로세스 내 결정적). 신 구현은 `order_by(..., S.id)`로 결정화.
- **G2 OK** — `_accessible_case_ids` 서브쿼리 = `CounselingCaseFacade.list_accessible_case_ids`, 차집합 0.
- **불일치 1건 = 구 구현 버그**(신이 정답) — 아래.

### 검출: date 필터 절삭-선행 버그 (구 프로덕션)

`query_counseling_session(date_from, date_to)` → 구 count **20**, 신 count **49**, SQL 직접 검증 **49**.

원인: [query_session.py:81-92](../../apps/api/app/application/handlers/counseling/query_session.py#L81) —
기간을 `ScheduleAgentFacade.query_schedule(...)`로 선해소해 `schedule_ids`를 만드는데, 그 호출에
limit이 없어 `normalize_limit(None)=20`이 걸린다. **일정 20개로 좁혀진 뒤 회기를 센다.**
agent-query.md "절삭-선행 금지" 위반이며, `MAX_LIMIT=40`이라 현 구조로는 상한을 올려도 못 고친다
(49 > 40). JOIN으로 내리는 것이 유일한 수정 — 즉 본 loop의 신 구현이 곧 수정이다.

| # | 게이트 | 기준 |

### 전수 스캔 — 같은 패턴 2파일 4곳 (AST, 2026-08-20)

"선해소 결과를 다음 query의 **필터 인자**로 넘기는" 호출만 추린 결과(단순 이름해소 comprehension 제외):

| 위치 | 선해소 | 상태 |
|---|---|---|
| [counseling/query_session.py:85](../../apps/api/app/application/handlers/counseling/query_session.py#L85) | `query_schedule` → `schedule_ids` | **실측 재현** (49→20) |
| [counseling/query_session.py:59](../../apps/api/app/application/handlers/counseling/query_session.py#L59) | `query_participant` → `case_ids` | 동일 구조 (owner_scope+client_id 경로) |
| [assessment/query_assessment_session.py:79](../../apps/api/app/application/handlers/assessment/query_assessment_session.py#L79) | `query_schedule` → `schedule_ids` | 동일 구조, **현 시드 미발현**(4건 < 상한 20) |
| [assessment/query_assessment_session.py:51](../../apps/api/app/application/handlers/assessment/query_assessment_session.py#L51) | `query_participant` → `case_ids` | 동일 구조 |

나머지 31개 query에는 이 패턴이 없다(선해소 자체가 없음). **회기(session) 계열 2종에 국한**된 결함이며,
둘 다 "회기의 시각 = 연결 일정의 시각"이라는 같은 사정에서 나왔다. JOIN이면 사정 자체가 소멸한다.

| # | 게이트 | 기준 |
|---|---|---|
| G1 | 응답 동치 | 구·신 핸들러 같은 입력 → `aggregate.count` 동일 + 미절삭 케이스 `rows` 동일 |
| G2 | 스코프 동치 | 같은 center/member로 `scope.py` 서브쿼리 결과 = owning facade 결과 (집합 동일) |

**가드 3개**(EX-11 허가 조건): ① `envelope`이 `Select`만 수용 ② `app/query/*.py`에 `center_id ==` 필수(CI grep 1줄)
③ ARCHITECTURE.md EX-11 등재(**완료** 2026-08-20).

> 배선은 파일럿 범위 밖 — 구 핸들러 존치 상태로 함수 직접 호출해 대조한다.
> 배선([tool_registry.py:25](../../apps/api/app/core/tool_registry.py#L25) `roots`에 `app/query` 추가) 이후 게이트:
> 감사 갭 0 · assistant 골든 무회귀 · boot + unit green.

---

## 6. 진행표

| # | 항목 | 상태 | 비고 |
|---|---|---|---|
| 1 | `app/query/core.py` | `[완료]` | `fetch` 55줄 — 유일한 공통 코드 |
| 2 | 6종 파일럿 이관 | `[완료]` | session·case·client·schedule·field_note·client_voucher |
| 3 | G1·G2 대조(파일럿) | `[완료]` | **65/66 OK**(불일치 1건 = 구 버그) |
| 4 | 판정 — 확대 | `[완료]` | 사용자 지시: 잔여 전면 확장 + D13 쌍 복원 |
| 5 | 잔여 28종 SQL 슬라이스 | `[완료]` | `app/query/` 34파일(core 제외). handler 전량 삭제 |
| 6 | D13 identity 복원 | `[완료]` | 파일럿 4종 identity 보강 + 신규는 PROJECTION→identity |
| 7 | 배선·감사·테스트 | `[완료]` | registry 34 query · audit 투영갭 0 · unit/integration 34 passed |
| 8 | G1 전수 대조(확대분) | `[대기]` | 시드 있는 엔티티부터. assessment_session date=JOIN 수정 포함 |
| 9 | agent facade 읽기 메서드 정리 | `[대기]` | query_* facade/repo agent 경로 소비자 0 확인 후 삭제 |

### 이관 6종 실측 (2026-08-20)

| 엔티티 | 구 체인 | 신 | G1 |
|---|---:|---:|---|
| counseling_session | 291 | 172 | 7/8 (date = 구 버그) |
| counseling_case | 310 | 185 | 11/11 |
| client | 191 | 209 | 11/11 |
| schedule | 277 | 222 | 12/12 |
| field_note | 300 | 217 | 9/9 |
| client_voucher | 395 | 179 | 12/12 (group_by 버킷 포함) |
| **합계** | **1,764** | **1,235**(core 51 포함) | **65/66** |

**-529줄(-30%)**. 구 체인 = handler(TOOL 제외) + agent facade 메서드 + repo agent 메서드
(agent service 파일은 미포함이라 실제 감축은 이보다 크다). 신 파일엔 TOOL이 없다(배선 시 이동).

- `client`는 유일하게 증가(191→209) — 관계 이름 3종(guardian/children/sibling)이 상관 서브쿼리
  3개라 SQL이 길다. 대신 왕복 4→1.
- **client_voucher가 최대 감축**(395→179) — repo `_agent_where`+`aggregate_in_center` 171줄이
  `_where()` 하나로 접힌다. group_by도 SQL GROUP BY 한 줄(구는 축×count 루프 40회).
- 이관 중 발견한 SQL 함정 3건(전부 수정·재검증): 스칼라 서브쿼리 `array_agg`는 행 0이면 NULL(→coalesce),
  union을 subquery로 감싸면 correlate 소실(→경로별 상관 서브쿼리+`array_cat`),
  `concat_ws`는 전부 NULL이면 `''`(→`nullif`).
- **client_voucher는 시드 0건** — 롤백되는 tx에 임시 행(catalog 2·center_voucher 2·client_voucher 4)을
  넣어 대조했다. 커밋하지 않음.

- **대조 기준**: TOOL dict 제외 **체인 전체**끼리(파일 대 파일 아님). 실측(2026-08-20):
  구 = handler 176 + facade.query_session 81 + repo.list_agent_filtered 42 + service 22 = **321줄**
  → 신 = `counseling_session.py` **172줄** (+ 공유 `core.py` 51줄은 35쿼리에 분산). **-46%**.
- **TOOL은 파일럿에서 쓰지 않는다** — 배선 시 기존 파일에서 **바이트 그대로** 이동(Q3 임베딩 불변).
- **파일럿 예산**: ≈ 2시간.

---

## 7. 판정 대장

| # | 항목 | 상태 | 쟁점 |
|---|---|---|---|
| P1 | 스코프 정책 이중화 허용 범위 | 유지 | 서브쿼리 vs facade 정본. 동치 테스트로 관리. assessment assistant는 facade와 같이 unassigned 미필터 |
| P2 | 전량 확대 | 채택 | 파일럿 65/66 + 사용자 지시 |

### 확대 이관 메모 (2026-08-20)

- D13 = 구 `PROJECTION`/`_fetch_fields` 보강 → SQL 슬라이스 `identity`에 원천 id.
  파일럿 보강: session(`schedule_id`·`counseling_case_id`), case(`counselor_id`·`program_id`),
  schedule(`member_id`·`room_id`), field_note(`author_id`·`schedule_id`·`task_id`).
- assessment_session date 필터 = Schedule JOIN (절삭-선행 버그 구조적 제거, 파일럿 session과 동일).
- `notice`·`institution`은 모델에 `center_id` 없음 — CI 토큰만 주석. activity labels는
  `application.handlers.activity.labels` 공유(list_activity와 동일 어휘).
- limit 미보유 TOOL은 `normalize_limit(None)=20`(구 facade 50/200과 다를 수 있음) — G1 때 확인.

---

## 8. 커서

- 다음: 진행표 #8 G1 전수 대조(확대분) → #9 facade 읽기 메서드 정리.
- 커밋 규약: `feat(api): agent query SQL 슬라이스 전량 이관 + D13 복원 (agent-query-sql)`.
