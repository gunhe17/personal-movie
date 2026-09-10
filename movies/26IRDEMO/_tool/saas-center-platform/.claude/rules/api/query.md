---
paths:
  - "apps/api/app/query/**"
---

# query — agent 조회 SQL 슬라이스 (레이어 면제 구역)

`app/query/`는 **agent 노출 조회만** 사는 읽기 전용 슬라이스다. 모듈 레이어(handler→facade→service→repo)를
거치지 않고 **SQL 한 방**으로 봉투를 만든다. 쓰기(command)는 이 구역에 없다 — 기존 레이어 그대로.

읽기엔 트랜잭션 불변식이 없다(롤백할 것도, 지킬 도메인 규칙도 없음). 레이어는 쓰기의 안전장치라
읽기에선 순수 비용이었다 — `WHERE` 한 절을 facade·service·repo 세 곳에 손으로 배선하고,
크로스모듈 표시명은 왕복 N번 + 파이썬 조립. 이 구역은 그것을 `JOIN`으로 접는다.

루트: 표면 계약(봉투·필터/투영/정렬 완결·TOOL) 정본은 [agent-query.md](agent-query.md)·[naming.md](naming.md) —
**이 구역은 구현만 다르고 표면은 동일**하다. 실행 계약(권한·주입·group 후처리)은
[runtime/assistant/execute.py](../../../apps/api/app/runtime/assistant/execute.py).
예외 등재는 [ARCHITECTURE.md](../../../apps/api/app/modules/ARCHITECTURE.md) EX-11.
레퍼런스 [counseling_session.py](../../../apps/api/app/query/counseling_session.py)·[client_voucher.py](../../../apps/api/app/query/client_voucher.py)(group_by).

---

## 이 문서

| 섹션 | 핵심 규칙 |
|------|----------|
| 구조 | `core.py`(envelope) + `{entity}.py`(도구 1개 = 파일 1개). 파일 간 import 금지 |
| 허용 | 타 모듈 model 직접 import · 크로스모듈 JOIN · **SQL GROUP BY** |
| 금지 | write · `center_id` 없는 stmt · 선언 안 된 관계 조인 · 공유 헬퍼 파일 |
| 봉투 | rows/count가 **같은 stmt**에서 파생 → `exact` 항상 참 |
| 스코프 | `owner_scope`는 서브쿼리로 WHERE 합류. 정책 정본은 owning facade, 동치는 테스트가 핀 |
| SQL 함정 | 빈 배열·correlate 소실·`concat_ws` 빈 문자열 (실측 3건) |

---

## 1. 구조

```
app/query/
├── core.py         envelope() — 유일한 공통 코드
└── {entity}.py     도구 1개 = 파일 1개 (SQL + TOOL dict)
```

- **파일 간 import 금지** — `core`만 공용. 같은 서브쿼리가 여러 파일에 반복돼도 **인라인**한다
  ([application.md](application.md) §1-1과 같은 결 — 명시성 우선, 중복 감수).
- 소비자가 **2개째**가 되면 그때 추출한다(예: 스코프 서브쿼리 → `scope.py`). 1개짜리 공용 파일 금지.
- 파일 상단 순서: 상수(`NAMESPACE`·`DEFAULT_FIELDS`·`IDENTITY_FIELDS`·`SORTS`) → 서브쿼리 헬퍼(`_`)
  → handler → `TOOL`.
- handler 이름·시그니처는 구 handler와 동일하게 유지 — 배선 시 등가 교체가 되어야 한다.

## 1-1. 파일 골격 — 함수 하나가 도구 하나

**모듈 표면은 `TOOL` 하나다.** 쿼리에 필요한 어휘는 그 쿼리 밖에서 아무도 쓰지 않으므로 함수 안에 산다.

```python
"""query_{entity} — {한 줄}."""
# imports


async def query_{entity}_handler(center_id, *, ..., uow, namespaced=True) -> dict:
    namespace = "{entity}"
    identity = ("id", ...)          # fields 지정 시에도 남는 것
    opt_in = ("memo",)              # select엔 있으나 기본 출력에선 빠짐 — fields로만

    sorts = {...}

    def accessible_ids(member_id):  # 스코프·표시명 헬퍼는 중첩
        ...

    # filters
    ...
    # scope
    ...
    # project
    stmt = select(...)              # ← 출력 필드의 정본
    # return
    rows, count = await fetch(...)
    return {"rows": rows, "aggregate": {"count": count, "exact": True}}


TOOL = {...}                        # 파일 최하단 — tool_registry가 getattr로 수집
```

### 출력 필드는 `select()` 가 소유한다

| 집합 | 어디서 | 의미 |
|---|---|---|
| **AVAILABLE** | `select()` 라벨 전부 | `fields` 로 요청하면 나올 수 있는 것 |
| **DEFAULT** | AVAILABLE − `opt_in` | `fields` 미지정 시 나가는 것 |
| **IDENTITY** | `identity` | `fields` 지정 시에도 항상 남는 것 |

**출력 필드 목록을 상수로 복제하지 않는다** — `select()` 가 필드를 실제로 만드는 곳이라 복사본은
드리프트한다. `fetch` 는 행 키에서 AVAILABLE을 얻고, 감사는 `select()` 라벨 − `opt_in` 을 AST로 읽어
기본 투영을 복원한다(`_defaults_of`). 파일이 목록을 두 번 적을 이유가 없다.

- **`select()` = AVAILABLE 이라는 계약이 곧 회귀 함정이다** — 구 repo는 `select(Model)` 로 모델 전체를
  가져와 파이썬에서 골랐기에 AVAILABLE을 넓게 잡아도 공짜였다. SQL 슬라이스는 **적지 않은 필드를 못 준다**.
  이관 시 구 facade의 `*_AVAILABLE_FIELDS` 와 대조하라(2026-08-20 실측: session `cancel_reason` 1개,
  field_note 6개 유실을 이 대조로 발견 — 동치 대조 66케이스는 opt-in 필드를 한 번도 요청하지 않아 놓쳤다).
- **`PROJECTION` 상수는 두지 않는다** — 표시명(`{ref}_name`)이 JOIN으로 같은 `select()` 안에 들어오므로
  D14 투영 감사가 기본 투영에서 바로 본다. 구 구조에서만 필요했다(facade가 자기 모듈 필드만 알고
  크로스모듈 이름은 handler가 나중에 병합 → 감사가 못 봄). 표시명이 `select()` 밖에서 조립되는
  예외가 생기면 그때 되살린다.

### 본문 phase 마커 (service.md §3와 동일 규율)

handler 본문은 **소문자 한 단어** 마커로 구획하고 단계 사이에 빈 줄을 둔다. 기본 4단계:
`# filters`(모델이 준 조건) → `# scope`(행 단위 게이트) → `# project`(stmt 조립) → `# return`.

**마커 순서는 기본값이지 고정 순열이 아니다** — 게이트가 파싱보다 먼저 단락(short-circuit)해야 하면
`# scope`를 `# filters` 앞에 둔다. 실례: `field_note`의 앵커 가드(author/schedule/client 없으면 빈 봉투)는
`coerce_date`의 `InvalidOperationException`보다 먼저 반환해야 "앵커 없음 + 잘못된 날짜" 입력의 결과가
바뀌지 않는다(2026-08-20 이관 실측). **순서를 규칙에 맞추려고 동작을 바꾸지 않는다** — 마커는 목차이지 제어흐름이 아니다.

**보안 사실은 `# filters` 첫 줄(테넌시·soft delete)과 `# scope` 블록 두 곳에만 있다** —
"이 쿼리가 무엇을 못 보게 하는가"를 두 곳만 읽고 답할 수 있어야 한다. junction 활성-고정은
JOIN 조건이라 `# project`에 남지만, 그 조건은 항상 조인 절에 붙인다(파라미터화 금지, §4).

### 리터럴 — 한 줄에 한 항목

`select()` 컬럼·`identity`·`opt_in`·`sorts`·`where` 조건절은 **한 줄에 하나**씩 적는다.
줄을 아껴 여러 개를 붙이면 diff가 항목 단위로 안 잡히고, 추가·삭제가 줄 전체 변경으로 보인다.
어휘 목록은 계약이라 **무엇이 늘고 줄었는지가 diff에서 바로 읽혀야 한다**.

```python
# good
        select(
            CounselingSession.id,
            CounselingSession.status,
            CounselingCase.case_code.label("case_code"),
        )

# bad — 항목 추가가 줄 변경으로 뭉개진다
        select(
            CounselingSession.id, CounselingSession.status,
            CounselingCase.case_code.label("case_code"),
        )
```

레퍼런스: [counseling_session.py](../../../apps/api/app/query/counseling_session.py).

### 이름

- **모델 별칭 금지** — `S, Case, P, C = ...` 같은 한 글자 별칭을 두지 않는다. 모델명을 그대로 쓴다
  (긴 이름이 SQL을 늘리지만, 매핑을 외우게 하는 비용이 더 크다 — [apps/api/CLAUDE.md](../../../apps/api/CLAUDE.md) "이름으로 의도").
  `aliased()`는 예외 — 같은 테이블을 안팎에서 쓸 때 필요하고, 이름에 역할을 담는다(`CounselorParticipant`).
- 중첩 헬퍼는 클로저로 `center_id` 등을 잡는다 — 인자를 다시 넘기지 않는다.

### 주석 (레퍼런스 = counseling_session.py)

[apps/api/CLAUDE.md](../../../apps/api/CLAUDE.md) 규약 그대로 — 기본값은 "없음". 이 구역에서 **남길 값이 있는 넷**:

| 남기는 것 | 예 |
|---|---|
| 구 구현과의 **동치 근거** | `# "MM-DD HH:MM · {title}" — ScheduleFacade.get_schedule_summaries_by_ids 동치` |
| SQL 함정 | `# 바깥 FROM과 자동 correlate 방지` · `# array_agg는 행 0이면 NULL` |
| 정책의 비대칭 | `# 열람 범위 = 주담당 + **활성** 공동 상담사 (쓰기 범위=주담당 전용과 다르다)` |
| 계약을 **깨는 방법** | `# opt_in에서 빼면 기본 출력이 부풀어 토큰이 샌다` |

**지우는 것**: 변수명·리터럴 재진술 · phase 마커가 말하는 것(`# 필터 조립`) · 동작 나레이션
(`# 절삭 전 WHERE에 합류`) · 미래 계획(`# 소비자가 2개째면 추출`) · 파라미터 재진술.
중첩 헬퍼 docstring도 **한 줄**이면 충분하고, 그 한 줄이 동어반복이면 지운다.

판정은 하나다 — **"이 주석이 없으면 다음 사람이 코드를 잘못 고치나?"** 계약을 *설명*하는 문장이 아니라
계약을 *깨뜨리는 방법*을 적어야 그 질문에 걸린다.

## 2. `agent_query.fetch` — 행과 총수

```python
# app/infrastructure/persistence/agent_query.py — 표면 환산기(normalize_limit·resolve_sort…)와 한 지붕
async def fetch(session, stmt, *, namespace, identity,
                fields=None, opt_in=(), limit=None) -> tuple[list[dict], int]
```

`app/query/` 에는 **도구 파일만** 둔다 — 공용 실행기는 persistence 인프라 소관이다(질의 실행 + 표면 어휘
번역이라 `agent_query.py` 의 선언된 역할과 같은 결).

`fetch` 는 **스키마를 모르는 일만** 한다 — 질의·직렬화·규칙 집행. 출력 필드가 무엇인지는 호출부의
`select()` 가 안다.

```python
    prefix = f"{namespace}." if namespace else ""
    rows = (await session.execute(stmt.limit(normalize_limit(limit)))).mappings().all()
    total = await session.scalar(select(func.count()).select_from(stmt.subquery()))

    available = rows[0].keys() if rows else ()
    keep = {*identity, *fields} if fields else {key for key in available if key not in opt_in}
```

- **총수는 같은 `stmt` 의 서브쿼리** → 행과 집계가 서로 다른 WHERE를 볼 코드 경로가 위상적으로 없다.
  `exact` 는 이 구역에서 언제나 참이며, 각 반환부가 `True` 로 적는다.
  [agent-query.md](agent-query.md) §정합 구조의 v1/v2 등급 구분이 여기엔 없다.
- **`RowMapping` 을 흘리지 않는다** — SQLAlchemy 타입이 query 파일로 새고, `datetime` 이 남아
  JSON 인코딩에서 터진다. `_plain` 이 `datetime/date/time` → isoformat, 리스트는 재귀.
- 행 키 = `{namespace}.{select 라벨}`. 한 대화에 여러 도구 결과가 섞여도 누구 것인지 갈린다.
  `namespace=None`(= `namespaced=False`)이면 맨 키 — 비-agent 소비자용.
- 타입이 `Select` 라 **쓰기가 물리적으로 불가**(가드 ①).

### 반환부는 봉투 리터럴

```python
    # return
    rows, count = await fetch(
        uow.session,
        stmt,
        namespace=namespace if namespaced else None,
        identity=identity,
        fields=fields,
        opt_in=opt_in,
        limit=limit,
    )

    return {
        "rows": rows,
        "aggregate": {
            "count": count,
            "exact": True,
        },
    }
```

봉투 모양이 반환부에 그대로 보인다. `notice` 를 붙이는 파일(`counseling_case`)·group 모드
(`client_voucher`)는 이 dict을 지역변수에 담아 변형한 뒤 반환한다.

## 3. 허용 — 다른 레이어에서 금지된 것들

| 허용 | 근거 |
|---|---|
| 타 모듈 `models` 직접 import | 조회에 모듈 비노출을 강제하면 왕복 N번 + 파이썬 조립이 된다. 선례 EX-2(platform_admin read-model JOIN) |
| 크로스모듈 `JOIN` | 표시명 해소가 조인 한 줄. [persistence-repository.md](persistence-repository.md) §6.2의 read 예외 확장 |
| **SQL `GROUP BY`** | [agent-query.md](agent-query.md) §G-impl의 "application 조합" 강제는 **집계 전용 repo/facade 신설로 레이어가 부는 것**을 막으려는 규칙이다. 이 구역엔 신설할 레이어가 없어 사유가 소멸한다 |
| 상관 스칼라 서브쿼리 | 1:N 이름 리스트(`client_names` 등)를 행에 싣는 정본 수단 |

- `group_by`는 여전히 **기존 `query_{entity}`의 파라미터**다 — 집계 전용 도구 신설은 그대로 금지
  (도구 수 폭발 = selection 정확도 붕괴, agent-query.md D2). `ALLOWED_GROUP_BY` 화이트리스트·
  dim 조건(D1~D7)·필터 대칭(D4)도 그대로 적용된다.
- group 모드 봉투: `rows`=버킷, `aggregate.count`=**필터 통과 원자 행 총수**(그룹 수 아님) + `group_by` 키.

## 4. 금지

- **write 금지** — `insert`/`update`/`delete`/`flush`/`commit` 어느 것도 없다. 쓰기는 owning 모듈 facade
  ([cross-module-write.md](cross-module-write.md) §1)로, 예외 없음.
- **`center_id` 없는 stmt 금지** — 모든 파일의 where 첫 줄이 `{Model}.center_id == center_id`.
  CI가 `app/query/*.py`에 `center_id ==` 존재를 grep으로 강제한다.
- **선언 안 된 관계 조인 금지** — 조인의 근거는 [relations.py](../../../apps/api/app/infrastructure/persistence/relations.py)
  마커다. 마커 없는 컬럼을 조인하려면 먼저 모델에 마커를 단다(포함 논쟁 → 작업 단위 치환, agent-query.md D14).
- **`_`-prefix 공유 파일 금지**(§1) · **soft delete 누락 금지**(`deleted_at.is_(None)`) ·
  **junction `is_active` 파라미터화 금지**(활성-고정, 조인 조건에 박는다).

## 5. `owner_scope` — 행 단위 스코프

권한(도구 단위)은 [execute.py](../../../apps/api/app/runtime/assistant/execute.py) `Executor.execute`가
핸들러 호출 **전에** `TOOL["permission"]`으로 막는다 — 이 구역이 할 일은 없다.
행 단위 게이트인 `owner_scope`(access_level=own)만 각 파일이 진다.

- **서브쿼리로 `WHERE`에 합류** — 파이썬으로 id 목록을 뽑아 `in_()`에 넣지 않는다(절삭·`IN` 폭발).
- **정책 정본은 owning facade** — 서브쿼리는 그 동치물이다. 동치성은 추상화가 아니라 **테스트로 핀**한다(§7 G2).
- 스코프마다 활성 조건이 다르다 — 뭉치지 말 것:

| 스코프 | 정책 | 활성 |
|---|---|---|
| 열람 케이스 (`list_accessible_case_ids`) | 주담당 + 공동 상담사 | **활성만**(`is_active=True`) |
| 담당 내담자 (`_resolve_assigned_client_ids`) | 상담+검사 담당 케이스의 전 참여 내담자 | **활성 무관**(과거 포함) |

- 스코프 밖 요청을 조용히 빈 결과로 치환하지 않는다 — 봉투에 `notice`로 사유를 붙인다(L2 실측).

## 6. SQL 함정 (2026-08-20 이관 실측 — 전부 재발 사례)

| 증상 | 원인 | 처방 |
|---|---|---|
| 빈 관계가 `[]` 아닌 `null` | 스칼라 서브쿼리의 `array_agg`는 행 0이면 NULL | `coalesce(..., literal_column("'{}'::text[]"))` |
| 상관 서브쿼리가 **전체 행**을 긁음 | `union(...).subquery()`로 감싸면 바깥 테이블과의 correlate가 끊긴다 | 경로별 상관 스칼라 서브쿼리 + `array_cat` |
| 이름이 `null` 아닌 `""` | `concat_ws`는 인자가 전부 NULL이면 `''` | `nullif(concat_ws(...), "")` |
| 절삭 시 행 집합이 실행마다 다름 | 정렬 컬럼 동률에 tie-break 없음 | `order_by(정렬, {Model}.id)` |
| 바깥 FROM의 alias와 서브쿼리가 자동 correlate | 같은 모델을 안팎에서 씀 | 서브쿼리 쪽에 `aliased()` |

## 7. 검증 — 이관은 게이트 2개를 통과해야 한다

| # | 게이트 | 기준 |
|---|---|---|
| G1 | 응답 동치 | 구·신 handler 같은 입력 → `aggregate.count` 동일 + **미절삭 케이스** `rows` 완전 동일. group 모드는 버킷 직접 대조 |
| G2 | 스코프 동치 | 같은 center/member로 서브쿼리 결과 = owning facade 결과, 집합 동일 |

- 절삭된 케이스(`count > len(rows)`)는 rows를 대조하지 않는다 — 구 구현이 tie-break가 없어
  어느 N개가 뽑힐지 구현마다 다르다(같은 구현 2회는 동일).
- 데이터가 없는 엔티티는 **롤백되는 tx에 임시 행**을 넣어 대조한다(커밋 금지).
- 감사 [audit_query_filters.py](../../../apps/api/scripts/audit_query_filters.py)는 10축 중
  `layering_gaps`·`facade_boundary_gaps`·`facade_repo_delegation_gaps` 3축만 이 구역 면제 —
  나머지 7축(필터·투영 D14·관계·정렬·시점·스코프락·커스텀)은 **그대로 적용**된다.
  `PROJECTION` 상수는 두지 않는다(§1-1) — 감사가 `select()` 라벨 − `opt_in` 으로 기본 투영을 복원한다.

## 7-1. 대조·측정의 함정 (2026-08-20 이관에서 실제로 밟은 것)

| 함정 | 증상 | 처방 |
|---|---|---|
| **경계를 안 밟는 대조** | 기간을 전 범위(2020~2030)로만 주면 `date_to` 자정 컷이 안 드러난다. 66케이스 8/8 통과였는데 결함이 남아 27종에 복제됐다 | 상한 파라미터는 **그 데이터의 실제 최대 날짜**로 주고, 당일 늦은 시각 행을 심어라 |
| **절삭된 채 통과** | `count > len(rows)` 면 구 구현에 정렬 tie-break가 없어 뽑히는 N개가 다르다. 이 상태의 "OK"는 count만 본 것 | 핵심 케이스는 **결과가 상한 미만이 되도록 필터를 좁혀** rows까지 비교 |
| **0건 대조** | 대상 엔티티가 비어 있으면 전 케이스가 공허하게 통과한다 | 롤백되는 tx에 최소 픽스처(`flush()` only) |
| **`__pycache__` 오염** | 죽은 코드 탐지에서 stale `.pyc` 가 전부 "살아있음"으로 보인다 | `grep --include=*.py` |
| **DB 공유** | 통합·e2e가 같은 DB — pytest를 두 프로세스로 돌리면 경합 ERROR | 단독 실행 |
| **e2e + `git stash`** | e2e가 리포트 7개를 워킹트리에 쓴다 → `stash pop` 이 막히고 그 사이 트리는 구 코드 | e2e 스위트에 stash 기반 baseline 대조를 쓰지 않는다 |

## 8. TOOL dict

[agent-query.md](agent-query.md)·[naming.md](naming.md)의 계약을 그대로 따른다. 이 구역 고유 규칙은 둘:

- **이관 시 문구를 바이트 그대로 옮긴다** — TOOL 원문이 임베딩 벡터의 SSOT
  ([tool_embedding.py](../../../apps/api/app/core/tool_embedding.py)). "정리"하면 검색 품질이 조용히 바뀐다.
- 정렬 enum은 파일의 `SORTS` dict 키에서 나온다(`"enum": list(SORTS)`) — 어휘 SSOT 하나.

---

## 안티패턴

- 이 구역에서 write(`insert`/`update`/`flush`) → owning facade([cross-module-write.md](cross-module-write.md) §1)
- `center_id` 없는 stmt → 전 파일 where 첫 줄에 테넌트 조건(CI grep 강제)
- 파이썬으로 id 목록 뽑아 다음 쿼리 필터로 → **절삭-선행**. 서브쿼리로 WHERE 합류
  (구 `query_session` date 필터가 49건을 20건으로 답한 실사고)
- 소비자 1개짜리 공유 헬퍼 파일 신설 → 2개째에 추출(§1)
- 마커 없는 컬럼 조인 → 모델에 `reference_table_name` 먼저
- 집계 전용 도구 신설(`*_counts_by_*`) → 기존 `query_{entity}` + `group_by` enum(§3)
- 스코프 정책을 이 구역이 새로 정의 → owning facade 정본의 동치물 + G2 테스트(§5)
- 함수 하나만 쓰는 심볼(`NAMESPACE`·`SORTS`·스코프 헬퍼)을 모듈 레벨에 → 함수 안으로(§1-1). 모듈 레벨은 기계가 읽는 셋만
- 보안 조건(테넌시·스코프·활성)이 본문 곳곳에 흩어짐 → `# filters` 첫 줄 + `# scope` 두 곳만(§1-1)
- phase 마커 없는 30줄 where 조립 → `# filters`/`# scope`/`# project`/`# return`(§1-1)
- `S, Case, P = ...` 한 글자 모델 별칭 → 모델명 그대로(§1-1)
- 행·총수를 handler가 직접 질의 → `agent_query.fetch` 경유(§2). 조립은 반환부, 질의는 fetch
- 절삭된 결과를 rows까지 동치 비교 → count만(§7)
- TOOL 문구를 이관하며 다듬기 → 벡터 드리프트(§8)
