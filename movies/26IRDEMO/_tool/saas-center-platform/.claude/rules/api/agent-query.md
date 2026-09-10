# agent query — 총체 쿼리 표면 계약

agent 노출 조회(`query_*` handler)의 표면 규약. 어휘·유도 규칙의 정본은 [naming.md](naming.md)
(query 동사·정렬 어휘·필터 유도 규칙), 이 파일은 **반환 봉투와 정합 구조**를 소유한다.

## 형태 계약 (빌드타임 강제)

- `query_*` = 전 필드 optional(`fields` 포함, `required=[]`) + `fields` 파라미터 필수(트림 레버) + write 권한 불가 — `core/tool_loader.validate()`. fields 미지정 = **아키타입 완결 투영**(투영 완결 §), 지정 = 큰 목록 토큰 트림. 완결 기본이라 core 정보 보려 fields를 추측할 필요 없다.
- 필터는 모델 필드 아키타입 + **선언 관계**에서 유도([naming.md](naming.md) 유도 규칙표) — tool별 발명 금지.
  커버리지는 `scripts/audit_query_filters.py`가 감사(갭 0 유지).

## 봉투(envelope) 계약 — 반환 형태

query handler는 행 배열이 아니라 봉투를 반환한다:

```python
{"rows": [...], "aggregate": {"count": int | None, "exact": bool, ...}}
```

- `rows` — 행 배열(fields 절삭·limit 적용). 기존 계약 그대로. group 모드에서는 **그룹 행**(아래 group_by §).
- `aggregate.count` — 필터 조건의 전체 건수(엔티티 행 기준). **행 절삭과 무관하게 참이어야 한다.**
  group 모드에서는 “그룹 개수”가 아니라 **필터에 걸린 원자 행 총수**(또는 exact 하한) — 그룹별 값은 rows[].count.
- `aggregate.exact: false` = count가 하한(행이 상한에 걸림) — 거짓 숫자 대신 미확정 고지.
- 수치 합계(`{noun}_sum`)는 수치 아키타입 필드 보유 엔티티만, 발화 실측 후 추가(유도 규칙).
- LLM 대면 계약: TOOL `output`에 봉투 형태 명시 + system 원칙 "합계·건수는 aggregate·(group 시 rows[].count)를
  읽는다 — 행을 세지 않는다".

## group_by — 선언된 분할 요약 (2026-08-03 재정립)

### 철학 (한 줄)

group_by는 **모델 실패 보정이 아니라**, “엔티티 E를 차원 D로 나눠 metric을 본다”는
**1급 질문 형태**를 서버가 결정론으로 답하는 API다.
병렬 tool_call은 **dim이 없거나 즉흥 탐색**할 때의 경로로 남긴다.

2026-07-25 전면 group_by(차원별 복제)는 폐기 유지. 재도입은 **형태 고정 + 구현 시 판정 가능한 조건**만.
계보: group-by-aggregate-plan · labs `gemini31-fanout-coverage` (효과 증거일 뿐 허가 조건 아님).

### 질문 3분면 (먼저 가른다)

| 분면 | 질문 예 | 정본 | group_by |
|---|---|---|---|
| A. 한 집합 요약 | 미납 총 몇 건 | `aggregate` (group 없음) | 쓰지 않음 |
| B. 수렴 (N→1) | 박지우 회기 수 | 관계 흡수·역조인 | 쓰지 않음 |
| C. 분할 요약 (1→N 버킷) | 상태별·종류별 건수 | **선언 dim이면 group_by** / 미선언이면 병렬 | 여기만 |

C가 아니면 group_by 설계를 시작하지 않는다.

### 왜 병렬만으로 부족한가 (설계 시 알 수 있는 구조 이유)

병렬 = “그룹 목록 구하기 → 그룹마다 query”. 구현 전에 보이는 취약점:

1. **완전 분할이 두 단계** — 1단계(축 나열)가 필터 습관·누락이면 전체가 조용히 틀어짐  
2. **0건 버킷** — 사실 테이블만 보면 안 나옴; 제품이 “없는 종류도 0”을 원하면 SQL/축 테이블 조인이 필요  
3. **hop·토큰** — |D|가 커질수록 병렬은 구조적으로 비쌈 (모델 실력과 무관)

group_by는 위 구조 문제를 **한 호출·한 결과 집합**으로 접는다.  
(모델이 병렬을 잘해도, C형 1급 질문에는 group_by가 더 맞는 API일 수 있다.)

### 이중 경로 (병존)

| 상황 | 경로 |
|---|---|
| dim이 `ALLOWED_GROUP_BY`에 있음 | 모델은 `group_by=dim` 1회 (정본) |
| dim 미등재·즉흥 조합 | 병렬 tool_call (정본) |
| 전체 한 숫자 | `aggregate` only |

group_by 추가 = 병렬을 삭제하는 것이 아니라 **그 dim의 정본을 서버로 옮기는 것**.

---

### 구현 판정 — 모듈 (코드 작성 시, lab 불필요)

#### M0. 소유

세는 **원자 행**의 `query_{entity}` 모듈만 구현한다.  
묶는 축 모듈에 집계 도구를 만들지 않는다.  
(예: 종류별 내담자바우처 건수 → `query_client_voucher`, not center_voucher 전용 도구.)

#### M1. 이 모듈에 group 경로를 둘 조건 (전건)

| # | 조건 |
|---|---|
| M1-1 | agent `query_*` list+aggregate 봉투가 이미 있다 |
| M1-2 | 센터 안 **다행** 엔티티 (0~1행 설정성 제외) |
| M1-3 | 분면 **C** 질문이 이 엔티티에 대해 성립한다 (기획·화면·운영 질문으로 문장 가능 — 실행 실측 불필요) |
| M1-4 | 분면 B(흡수 합계)로 이미 해결되지 않는다 |
| M1-5 | 아래 **D 전건을 통과한 dim ≥ 1** |

통과 시에만 그 모듈에 `group_by` 파라미터·handler group 분기(application 조합) 추가.  
전 모듈 빈 슬롯 배포 금지.

#### M2. dim 하나 (구현 단위, 전건 — 스키마·대칭만)

| # | 조건 | 확인 |
|---|---|---|
| D1 | 자기 FK · 닫힌 스칼라(enum/bool/status) · 선언 관계 **1홉** far-side | 모델·naming 유도 |
| D2 | 행→버킷 **다대일** (다대다는 관계 엔티티 query로) | ER |
| D3 | 키 = uuid 또는 닫힌 enum (memo/keyword 금지) | 컬럼 |
| D4 | **필터 대칭**: 동일 축으로 list 필터 가능 (`{dim}_id` / enum). group-only 축 금지 | TOOL·audit |
| D5 | metric 기본 = 원자 행 `count` (sum은 수치 필드 있을 때만) | 아키타입 |
| D6 | where는 list/aggregate와 **동일 제조** | repo |
| D7 | 대표 질문 1문 스펙 가능: “{entity}를 {dim}별로 건수” | PR 문장 |

D 전건 = 그 dim을 `ALLOWED_GROUP_BY`에 넣는다.  
**모델 실패율·lab 통과율은 dim 허가 조건이 아니다.**

#### M3. 제품 완비 선택 (0건 버킷) — 구현 시 고를 것

| 모드 | 의미 | 언제 |
|---|---|---|
| `nonempty` (기본) | 사실 행이 있는 버킷만 | 대부분 |
| `domain` | 축 도메인 전부, 없으면 count=0 | “종류 목록 대비 현황”이 제품 요구일 때 (축 테이블·enum 도메인 필요) |

모드를 dim 메타에 고정하고 TOOL/output에 명시. 호출마다 바꾸지 않음.

#### M4. 필터 (is_active 등)

- group 모드도 list와 **같은 필터**를 받는다.  
- “증명용으로 필터 제거”를 제품 기본으로 두지 않음.  
- 필터는 분할 **전** 행 집합을 줄인다 → 그 부분집합을 dim으로 나눈다.

#### M5. 모듈 산출물

`ALLOWED_GROUP_BY`(handler 상수) · handler 모드 분기 · TOOL enum(열린 dim만) · when/description · 필터 대칭(D4).

#### 구현 방식 (G-impl) — application 조합

agent group 경로 = **기존 list/aggregate 결과 조합**.  
SQL `GROUP BY`·`JOIN`·집계 전용 repo/tool 신설 금지. (모듈 admin 통계 SQL은 agent query와 공유하지 않음.)

> **예외 — `app/query/` 슬라이스**([query.md](query.md), 2026-08-20): 이 금지의 사유는 *집계 전용
> repo/facade 신설로 레이어가 부는 것*이다. `app/query/`는 그 레이어 자체가 없는 읽기 전용 구역이라
> 사유가 소멸한다 — 거기서는 **SQL `GROUP BY`·`JOIN`이 정본**이다. 형태 계약(기존 `query_{entity}` +
> `group_by` enum·`ALLOWED_GROUP_BY`·dim 조건 D1~D7·필터 대칭 D4·봉투 키)은 **그대로 적용**된다.
> 집계 전용 **도구** 신설 금지도 그대로.

| 패턴 | 방법 | exact | 배선 |
|------|------|-------|------|
| A list→bucket | 동일 filters list 1회 → dim 키 Counter | 절삭 시 false | 기본: `group_by_dims.py` + catalog enum + execute 후처리 |
| B 축×count | 축 list 후 키마다 동일 filters+키로 total | 축·count 전량이면 true | handler가 `group_by` 시그니처로 직접 (예: client_voucher×center_voucher) |

- filters/where = list와 동일(M4). metric 기본 = 원자 행 count. nonempty 기본(0건 drop).
- dim 어휘 = list 필터 키와 동일 (`center_voucher_id`, `status`, …). SSOT = `runtime/assistant/group_by_dims.py`.
- 표시명 = 행에 동반된 `*_name` 또는 PROJECTION summary.
- 새 facade/repo 없이. 축 소카디널리티·exact 필요 시만 B.

---

### 형태 계약 (유일)

- 도구 신설 금지. **기존** `query_{entity}` + `group_by: enum(화이트리스트)`.  
- 미지정 = list 모드. 지정 = group 모드.  
- dim 이름 = 필터 키와 동일. 차원마다 repo/handler 복제 금지 (2026-07-25).

```python
# group 모드 (FK dim 예: center_voucher_id)
{
  "rows": [
    {"center_voucher_id": "...", "center_voucher_name": "...", "count": int},
    ...
  ],
  "aggregate": {
    "count": int | None,   # 필터 통과 원자 행 총수 (그룹 수 아님)
    "exact": bool,
    "group_by": "center_voucher_id",
  },
}
```

list/aggregate와 키를 공유하고, rows 의미만 “원자 행 → 버킷 행”으로 바꾼다.

---

### 사후 품질 (선택, 구현 금지 사유 아님)

배선·모델 교체 후: 해당 발화 lab, h00 비열화, 오용(group 남발) 관찰.  
문제 시 1차 = description/when·가드·모델, 2차 = dim 축소.

---

### 안티패턴

- group_by = “모델이 병렬을 못 해서”의 사후 처방으로만 정당화 → 분면 C·D조건으로 정당화  
- 실패 lab 없으면 구현 금지 → 금지 아님 (M2)  
- 전 query 일괄 group_by → M1+첫 dim  
- `*_counts_by_*` 도구 · lab 도구명 승격 → 기존 query + enum  
- agent group을 SQL GROUP BY로 시작 → 모듈 레이어에선 G-impl 조합이 정본(`app/query/`만 예외, [query.md](query.md))  
- list 절삭 버킷을 exact=true로 반환 → A면 false, 또는 B로 exact 확보  
- 수렴형을 group_by로 → 흡수/JOIN  
- filter 없는 group dim · memo group · 다대다 직접 group  
- 축 모듈에 집계 query · 통계 모듈에 agent group 집중  
- 0건 정책 미문서화 후 호출마다 다른 완전성

## summary 투영 — 행은 궁금증 단위로 조인된 결과 (2026-07-14, 놀이터 실사용 실측)

사용자 궁금증("이번주 상담 일정")은 엔티티 하나가 아니라 이름들이 붙은 단위다. 조인을
**도구 표면이 아니라 행 내용에** 둔다 — 도구 수·파라미터는 불변, 행만 풍부해진다
(도구 분화는 옛 28개 폭발 = selection 정확도 붕괴로 폐기된 길, D2).

- **행 키 네임스페이스는 agent 표면의 것** (2026-08-13): `to_dicts(entities, fields, namespace)`가
  `{namespace}.{field}`로 찍는다(`client.name`·`session.id`). 근거는 둘 — 한 컨텍스트에 여러 도구
  결과가 섞이면 `name`이 누구 것인지 갈라야 하고, 중간 결과를 잇는 배선이 그 키로 조인한다
  (`p["participant.counseling_case_id"]`). **비-agent 소비자는 `namespaced=False`로 끈다** —
  맨 키(`name`)가 나온다. 접두는 곧 모듈 어휘라 기관 무관 표면에선 누수다.
  전 `query_*` facade가 이 플래그를 받는다(기본 `True` = agent 동작 불변).
- **참조 1개 = 키 정확히 2쌍**: 기본 투영의 nav 참조 `{ref}_id`에는 `{ref}_name`을 동반.
  곁가지 금지 — 곁가지 = **본문·파생 필드**(memo·transcript·url)이지 정의값(수치·분류)이 아니다.
- **투영 완결** (2026-07-20): 기본 투영도 필터처럼 **아키타입에서 유도**한다([naming.md](naming.md) 유도표
  '기본 출력' 열). 수치(price·amount·count)·분류·시점·이름·불리언·참조 = 기본 포함, 본문 텍스트 =
  opt-in(fields로만), 파생·시스템 = 제외. "거를 수 있으면 볼 수 있어야 한다" — 필터·투영이 한
  아키타입에서 함께 유도(관계 필터 완결의 스칼라판). 필터엔 있는데 기본 출력에 없으면 갭 — 감사가
  유도표 vs 기본 투영을 대조. price_list.unit_price 누락이 첫 사례.
- **name = 그 엔티티의 정본 표시 문자열(합성 허용)** — owning 모듈이 정의.
  name 컬럼(client·member·room·program) / case_code(케이스) / 합성(schedule =
  `"MM-DD HH:MM · {title}"`). 정의 계보는 person_profile `build_profile_snapshot.py`의 앵커 표시 규칙.
- **소유**: owning facade의 배치 메서드 `get_{entity}_summaries_by_ids(ids) -> dict[id, name]`
  (값 = 정본 표시 문자열)가 표시 계약의 SSOT. 모델 메서드 불가 — client·member 이름은 person 경유(자기 테이블에 없음).
- **조립 위치 = query handler 본문 인라인** (2026-07-14 확정 — 회색지대 해소 + 공유 파일 금지).
  크로스모듈 표시명 조립은 각 handler가 **자기 본문에서** owning summary들을 배치 소비해 병합한다.
  공유 헬퍼/레지스트리 파일(`_projection.py`류 SPECS·resolver 모음)은 금지 — 같은 연쇄가 여러
  handler에 반복돼도 인라인한다(중복 감수, 명시성 우선 — 사용자 결정 2026-07-14).
  모듈 agent facade는 자기 모듈 데이터 + **모듈 내부 해소만** 반환하며 타 모듈 facade를
  import하지 않는다([facade.md](facade.md) §3 facade→facade 금지 — agent 표면도 예외 아님).
- **감사 계약 = handler 파일의 `PROJECTION` 상수** — `{표시명: 원천 id 컬럼}` dict(기본·identity
  투영만, opt-in 제외). `scripts/audit_query_filters.py` D14 축이 모델 참조 마커와 대조한다.
  fields 보강(원천 id 동반, D13 쌍)·해소 연쇄는 상수 곁 본문 코드 소유 — 상수는 데이터, 로직 없음.
- **관계 필터 완결** (2026-07-16 개정, 옛 '필터 동결(+0)' 폐기): 엔티티에 **선언된 관계 전부**를
  id 필터로 노출한다 — 유도원 셋(① 자기 FK 마커 ② 소유 관계 테이블 far-side ③ 자기 다형 마커,
  [naming.md](naming.md) 유도표). `accounts`·`admin_accounts` 참조는 제외(신원 WAIVER).
  이름 필터는 여전히 금지 — 앵커는 id, 이름은 1홉 확인·행 표시. 다홉(자기 소유 아님)은
  자동 아님 = 리스트 투영 유지(J4류). 반쪽 노출(counselor_id만·client_id 없음)=슬롯 혼동 함정.
- **관계 불리언은 흡수 아님 — 활성 고정** (2026-07-21): 소유 관계 테이블에서 흡수하는 건 far-side
  **id**뿐이다. junction 자기 스칼라(멤버십 `is_active`)는 유도원 셋 밖 — 필터로 노출하지 않고
  **활성-고정**한다(facade 기본 `active_only=True`, 파라미터 없음). `center_assessment.is_active`
  (query_assessment)·`case_participant.is_active`(participant bridge) 동일 처리 — 한쪽만 스위치로
  펴면 규칙 밖 커스텀이 된다(옛 `query_assessment.active_only` 제거, participant와 일관). 비활성
  조회 수요는 미실측 — 생기면 그 junction의 bridge 도구(주제 조회)가 정본이지 엔티티 query 필터가 아니다.
- **스코프-락 고지 의무** (2026-07-21, negative 완결): 필터를 일부러 막으면(발행분만·활성-고정·다홉 미지원)
  그 잠금을 tool `boundaries`에 **명시**한다 — "무엇을 못 하나 + 대안 경로". waiver·활성고정·다홉부재는
  감사 면제일 뿐 모델엔 침묵 → 못 하는 걸 "했다" 거짓 나레이션·없는 파라미터 환각·placeholder flail의 원인.
  positive(파라미터)만큼 negative(락)도 선언해야 모델이 정직하게 답한다. 감사 = `scope_lock_declaration_gaps`
  (`SCOPE_LOCKS` 도구별 고지 부분문자열 대조). 다홉 락은 boundaries에 대안 경로(`query_client`·`client_id`)까지 적는다.
- **유도 범위 = 1홉 nav만**. 2홉 전이 유도 금지(투영 폭발). 다홉·1:N 리스트 필드
  (`client_names`)는 자동 유도가 아니라 **발화 실측 후 개별 등재**(J4가 첫 등재).
  자동 유도=1홉 한정 / 수동 등재=홉 무관 — 등재제가 곧 예외 절차.
- 합성 name에 구운 정보(시각 등)는 표시용 — 데이터 질문은 재조회가 정본(봉투 원칙과 동결).

### 행 적재 판정 — 관계 그래프 기준 (2026-07-14 확정, 사용자 결정 D14)

포함 여부는 값의 성격 해석이 아니라 **테이블 간 선언된 관계**로 판정한다:

1. **선언된 관계만 관계다** — 마커 간선(reference_table_name·다형 reference_tables) +
   관계 테이블(참여자·가족·품목·담당). 미선언 다형은 관계 없음 = 미포함이며,
   **마커를 다는 순간 포함 대상에 자동 편입**된다(포함 논쟁 → "마커 달 것인가"라는 작업 단위로 치환).
2. **정본 경로면 홉 수 무관 포함** — 행 엔티티의 "누가·무엇·어디"를 정의하는 선언 경로.
   schedule→내담자(회기→케이스→참여자 3단)가 선례. 형태는 (id,name) 쌍 / 1:N 이름 리스트,
   **기본 투영**에 동반(발화 빈도 무관 — 리스크 실측 완료: 파라미터 +0, 배치 IN ms급,
   행 100~190tok, 골든 36/36 유지. fields 절삭이 탈출구).
3. **우회·역추적 연결은 미포함** — 관계가 있어도 엔티티 정의가 아니라 컬렉션 질문
   ("내담자가 다닌 상담실들")이면 해당 query CHAIN이 정본. 자기 저장 컬럼은 형태 무관 적재 가능.
4. **집계는 관계가 아니라 관계의 요약** — 행 금지, 봉투 aggregate 소유(D6 그대로).
   행별 카운트·불리언·합계를 심으면 절삭·시점 탓 봉투 불일치(D6·D7 재발).

- 목표 상태 = 선언된 전 간선의 표시명 동반 — 커버리지는 감사 스크립트가 집행(D4와 동일 구조).
- 관련 엔티티로 **거르는** 수요(필터)도 같은 선언 관계에서 유도 — 표시(투영)와 필터(id)가
  한 관계 집합에서 함께 나온다(관계 필터 완결). 다홉만 투영 전용.

## 정합 구조 — 2계층

집계와 행이 다른 필터를 보면 봉투가 거짓말한다. 등급별 구조:

| 등급 | 구조 | count 보장 | 언제 |
|------|------|-----------|------|
| v1 handler-count | `len(rows)` + `exact` 플래그 | 상한 미달 시 정확, 도달 시 하한 고지 | 기본값 — facade/repo 무수술 |
| v2 repo 공유 WHERE | `_agent_where()` 하나가 행/집계 SELECT 양쪽에 절 공급 | 항상 정확(LIMIT 무관) | 집계 발화 수요 실측된 엔티티(승격) |

v2 표준형 (billable이 레퍼런스 — [billable/repository.py](../../../apps/api/app/modules/billing/billable/repository.py)):

```python
# repo — WHERE의 유일한 제조처
def _agent_where(self, center_id, *, <전체 필터>) -> list: ...
async def list_agent_filtered(...):   # select(...).where(*공유절).order_by().limit()
async def aggregate_in_center(...):   # select(count, sum...).where(*공유절)  ← LIMIT 없음

# handler — 필터 dict 1회 구성, 두 호출에 동일 전달
filters = dict(status=..., ...)
rows = await facade.query_x(center_id, sort=..., fields=..., **filters)
meta = await facade.aggregate_x(center_id, **filters)
return {"rows": rows, "aggregate": meta}
```

- 필터의 탄생 지점은 딱 두 곳: handler의 `filters` dict, repo의 `_agent_where` — 나머지는 전달만.
  행/집계가 다른 조건을 볼 수 있는 코드 경로를 위상적으로 제거하는 것이 목적.
- v2 승격 시 Python 후처리 필터는 전부 SQL WHERE로 하강(절삭-선행 금지와 동일 원리).

## Cross-entity 필터 — 선언 관계는 흡수, fan-out은 구현 방식만 가른다

한 엔티티를 **다른 엔티티로 필터**하는 요청("내담자의 회기")은 **선언된 관계면 흡수**한다 —
대상 query의 id 필터로 노출하고 facade가 내부 역조인(관계 필터 완결). CHAIN(모델이 query를
이어 붙임)은 기본이 아니다 — 1:N 중간결과에서 모델이 하나만 스레딩해 조용한 오답(박지우 실측:
3홉 chain 오답 → `client_id` 1홉 정답). fan-out은 **흡수하느냐**가 아니라 **어떻게**만 가른다.

### fan-out 두 유형 — 처방이 다르다 (핵심 구분)

| 유형 | 예 | 처방 |
|------|-----|------|
| **수렴형** (N개 중간결과 → 1개 답) | "박지우 회기 수"(여러 케이스→합계) | **JOIN** — facade가 N 조인·집계 |
| **발산형 / 분할 요약** | "상담사별·종류별 건수" | **dim 선언 시** 같은 query의 `group_by` (group_by §). **미선언**이면 병렬 tool_use |

수렴형은 서버 조인. 분할 요약은 선언 dim이면 서버 group, 아니면 모델 병렬 — 둘 다 정본 경로(실패 보정 관계가 아님).

### 관문 — 통로냐 주제냐 (표시는 이미 자동)

- **통로 (관계로 필터)**: 반대편 엔티티가 목적 — 대상 query에 `{ref}_id`/`{ref}_ids` **흡수**,
  facade가 관계 테이블 역조인. 새 tool 없음.
- **주제 (관계 자체가 답)**: "누가 참여·역할·이력"이면 관계가 곧 엔티티 — **BRIDGE** tool 존속.
  output에 "반환 id를 다음 query 어느 파라미터로" 명시(연쇄 레시피는 tool 소유).
- 옛 '관문 A(필터냐 표시냐)' 소멸 — 표시(투영)·필터(id)가 한 관계 집합에서 함께 나온다.
  경로가 다형참조로 숨어도 관계 테이블 마커가 곧 경로(BRIDGE 신설은 주제 조회 수요에만).

### 구현 형태

- 조인은 **기존 query의 필터 파라미터**로 노출, facade가 내부 조인 — 새 tool 최소(수 폭발=정확도 저하).
  레퍼런스: `query_session`의 `client_id`(facade가 participant로 참여 케이스 **전체** 역산→case_ids).
- bridge는 예외적 신설(참여자). 조인은 파라미터로 흡수.

### 관계별 판정 — 관계 필터 완결 적용 (2026-07-16 재판정)

| # | 관계 | 유도원 | 판정 |
|---|------|--------|------|
| J1 | 케이스→내담자 | ② case_participants far-side | **흡수** `query_case(client_id)` — 옛 CHAIN 폐기 |
| J2 | 회기→내담자 | ② participants 경유 | **흡수** `query_session(client_id)` — 완료(박지우 실측) |
| J3 | 검사케이스→내담자 | ② assessment_case_participants far-side | **흡수** `query_assessment_case(client_id)` — 옛 BRIDGE-only 폐기(bridge는 주제로 존속) |
| J4 | 일정→내담자 | 다홉(회기→케이스→참여자) | **투영만** — schedule 자기 소유 관계 아님, `client_names` 리스트. 필터는 실측 후 등재 |
| J5 | 담당 내담자(상담사→내담자) | 다홉(client 자기 소유 아님) | **owner_scope 역산 / CHAIN** — client에 counselor 관계 마커 없음 |
| J6 | 필드노트→내담자 | 다홉(schedule→case/participant) | **흡수 등재** `query_field_note(client_id)` — select_lab 실측(2026-07-22): 투영-only는 「이름 관련 노트」cover 비대칭·슬롯 오용. facade 조인 가능 시 필터·투영 대칭. 구현 전 TOOL·facade 동시. 부작용: 흡수 노출만으로 client 경로 회귀 가능 → 이름 소유 query gloss 최소 병행 후보(loop §17–18) |

교훈: 선언 관계(자기 FK·소유 관계테이블·다형)면 **흡수가 기본**. 참여자 bridge는 주제(관계 조회)
전용 존속. 다홉(자기 소유 아님)만 투영 — 필터는 실측 후 등재(J4·J6).  
**등재 조건(전역)**: 기본 투영에 far-side `*_names`가 있고 · facade 조인으로 거를 수 있으며 · 이름 조건 발화가 실측되면 → 해당 query에 `{ref}_id`/`_ids` 노출 (필터·투영 대칭). 모듈 특례 if 금지.

## 표현 규격 — LLM-대면 정의 (2026-07-30 배선, 클린룸·격리 검증 완료)

조회군의 LLM 노출 설명은 **R 템플릿 3슬롯**으로 고정(배선 = catalog `_R_DESC`, TOOL 원문은
문서·감사·임베딩용 SSOT로 불변 — 임베딩 텍스트 변경 = 벡터 드리프트 금지):

1. **what 1문장** — 엔티티+필터 축 나열형. 우연 한정어("~별로"·"~만") 금지 — 능력 부정으로
   오독됨(클린룸 실측: 한정어 하나가 집계 5/5→1/5).
2. **반환 계약** — "건수·합계는 aggregate 값을 읽는다." 전 도구 동일 문장.
3. **락** — 보유 도구만 "못 하는 것 — 대안 경로"(스코프-락 고지 의무의 표현판).

- 파라미터는 유도-완전이 정본(최소화 금지) — id/ids 쌍·enum 매핑·수치 _min/_max·정렬
  레버 전부. 실측: 완전 파라미터가 변별·관계 정확도를 올림(의미 명확화), 밀도 비용 없음.
- **부분 변경 절대 금지** — 군 일부만 스타일 변경 시 완주 −45%p 실측. 변경은 24종 일괄 +
  페어드 게이트. 근거·실험 계보 정본: apps/api/labs/assistant/knowledge/tool-calling/.

## 절삭-선행 금지 (정렬·필터 공통)

`LIMIT`이 정렬·필터보다 먼저 적용되면 조용한 오답(잘린 집합의 첫 행·부분 합).
- 정렬은 절삭 전에(레퍼런스: counseling facade 절삭 전 sort 통일).
- v1 count의 `exact` 플래그가 이 원칙의 봉투판.

## 안티패턴

- 크로스모듈 표시명 해소를 공유 `_` 파일·레지스트리(SPECS/resolver 모음)로 추출 → 각 handler
  본문 인라인 + `PROJECTION` 상수(중복 감수 — 사용자 결정 2026-07-14, `_projection.py` 인라인 회귀가 선례)
- handler가 행/집계에 서로 다른 필터 인자 전달 → `filters` dict 1회 구성
- 조인 상대 **이름**을 필터로(`query_schedule(client_name=...)`) → 이름 필터 금지. id 필터는 관계 완결로 흡수, 이름은 행에만
- 선언 관계인데 필터 미노출(counselor_id만·client_id 없음) → 반쪽 = 슬롯 혼동 함정. far-side 필터 노출(관계 필터 완결)
- 안정 코드 참조에 raw id 노출(role_id) → 모델이 코드(MANAGER)를 넣어 미매칭=빈 답. `role_code` 노출+handler 해소(안정 식별자 이중키, [naming.md](naming.md)). 이름(모호)은 여전히 표시만
- 관계 summary에 곁가지 추가(참조 id+name 외) → 2키 상한. 상세는 그 엔티티 query 1홉이 정본
- 정의값(price·amount·count)이 기본 출력에 없음(필터엔 있는데) → 투영 완결 위반. 아키타입 '기본 출력'에서 유도
- 기본 투영이 불완전 → 모델이 `fields`로 값 보충하려다 필드명 추측 실패(price vs unit_price)=조용한 누락. 투영 완결로 기본이 값을 담아 추측 불요
- agent facade가 이름 해소를 자체 구현(denorm 컬럼 read·미구현 None 방치) → owning facade summary 소비
- 참조 name을 조합별 도구 신설로 해결 → 행 투영으로(도구 수 불변)
- Python으로 행 받아 합산(200건 상한에서 틀린 합계) → repo `func.sum`(v2)
- count 상한 도달인데 `exact` 미표기 → 하한을 정확 건수처럼 고지하는 거짓말
- `query_*`가 봉투 없이 bare 행 배열 반환 → 봉투 계약 (전 22곳 적용 완료 — 내부 상한이
  facade에 있는 곳은 handler에 상한 상수 주석과 함께 `exact` 판정)
- 홉 수로 흡수 판정 → 선언 관계면 흡수. fan-out은 구현 방식(수렴=facade역조인/발산=병렬)만 가름
- 수렴형 fan-out을 연쇄로 → 모델이 N개 중 하나만 스레딩 = 조용한 오답. facade 역조인으로 흡수
- 발산형 fan-out에 조인(역조인 흡수 오용) → 병렬 tool_use. 버킷 건수 서버화는 group_by §(G-impl)만
- group_by를 집계 전용 새 tool로 → 기존 query_* + `group_by` enum
- 관계를 새 composite tool로 → 옛 28개 폭발의 원인. 기존 query 필터로 흡수(도구 수 불변)
- FK 직결·이름 표시 → 필터·투영 자동 동반(관계 완결), 새 tool 아님
- 조인을 새 tool로 신설(필터 파라미터로 될 것을) → tool 수 폭발, 기존 query 필터로 흡수
