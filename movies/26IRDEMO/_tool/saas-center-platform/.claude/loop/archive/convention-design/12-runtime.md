# 계층 12 — Runtime 관장 `[설계완료]`

정본 rule: (신설 예정) `runtime.md`. 상위: [convention-design.md](../convention-design.md).

`app/runtime/**`(실행 엔진 — agent·form·voucher_document)는 **paths-앵커 규칙이 0개**라 호출 규약이 미정의였다. 계층 11(AI 호출)에서 발견 → runtime 전반 규약으로 신설. 계층 11의 꼬리.

## 12-0. 전수 조사 (ground-truth grep)

### 지형 (6 패키지)
| 패키지 | 규모 | 정체 |
|----|----|------|
| **agent** | 45파일 7145줄 | 구세대 런타임. domain `*_agent_facade` 대부분 의존 |
| **new_agent** | 14파일 1426줄 | v5 세대. `agent_stream_v5`·`agent_resume_v5`만 사용 |
| **voucher_document** | 30파일 3629줄 | lab 4단계 문서가공. `__init__`이 자체 의존표면 선언(logger/storage/llm.gateway/voucher_extraction) |
| **form_template** | 6파일 501줄 | form AI 추출 |
| **form_generation** | 2파일 290줄 | NL→FormSchema |
| **pipeline** | **0파일 (빈 디렉토리)** | dead |

### 접근 패턴 (runtime이 무엇을 건드리나)
1. **정합 — domain `*_agent_facade` 경유**: 모듈이 agent-facade 노출, 런타임이 호출(center 4·form 2·document 2·counseling 2 등). 깨끗한 경계.
2. **위반 — 깊은 직접 접근 26곳**: voucher_document·form_template·agent/store가 domain repo/service/model 직접.
   - `form_template/executor.py`: `uow.repo(FormExtractionRepository)`+모델([executor.py:62](../../../apps/api/app/runtime/form_template/executor.py#L62))
   - `voucher_document/executor.py`·`extraction/save_*`: `GlobalDocumentRepository`·`VoucherExtractionRepository`+`global_document.services` write([save_markdown.py:21](../../../apps/api/app/runtime/voucher_document/extraction/save_markdown.py#L21))
   - `agent/store/agent_facade.py`: agent 자기도메인 repo(정당) + `llm_call.repository`·`AddLlmCallService`(타모듈)
3. **계층 역행 — runtime → application.handlers 3곳**: `agent/context.py`·`new_agent/context/manager.py`가 `application.handlers.person_profile.{build_profile_snapshot, on_conversation_created}` 위로 import([context.py:71](../../../apps/api/app/runtime/agent/context.py#L71)).
4. **AI — llm.gateway 직접**: 계층 11로 `AIFacade` 전환(이미 결정).

### tx 모델 — 혼재
uow 파라미터 19파일 vs 자체 세션(AsyncSessionLocal) 4파일. 통일 규칙 없음.

### 이중 agent 런타임
`agent`↔`new_agent` 서로 import 0(독립). 호출처 갈림: v5 핸들러 2개만 new_agent, 나머지(v4·v3 + 전 domain agent-facade)는 구 agent. 둘 다 live.

## 12-1. 결정 (사용자 2026-07-04)

순수 아키텍처로 확정 — runtime = application handler와 동급 조립층, domain 내부 못 만짐.

| # | 갈림 | 결정 | 함의 |
|---|------|------|------|
| **R1** | runtime→domain 접근 | **facade/client 경유 강제 (예외 없음)** | write=owning facade, read={Module}Client(계층 9). repo/service/model 직접 전면 금지. **voucher_document 자체선언 해제**. 26곳 이관 |
| **R2** | runtime→application 역행 | **역행 제거 (공유로직 추출)** | `build_profile_snapshot`·`on_conversation_created`를 application 아래(domain facade)로 내림. runtime은 아래만 본다 |
| **R3** | tx 모델 | **tx 핸들 주입 (호출자가 소유, runtime은 자체 세션 안 엶)** | 핵심은 "uow만"이 아니라 **runtime이 `AsyncSessionLocal()`을 직접 안 연다**. 요청-내 두 번째 tx는 `side_uow`(=현 `aow` 리네임, §12-4) — **behavior에 안 담고 별도 `Depends`로 유지**(별개성이 곧 "예외·주의" 신호). 자체세션 여는 곳만 위반 |
| **R4** | 이중 agent | **범위 밖 (마이그레이션 별건)** | agent↔new_agent 통폐합은 v4→v5 마이그레이션 이슈. runtime.md는 "어떻게 부르나"만, 엔진 통합은 별 이니셔티브 |

## 12-2. Canonical — runtime = 조립층(application handler 동급)

runtime은 도메인 로직을 **소유하지 않는다** — 여러 모듈을 **오케스트레이션**만 한다(application handler와 같은 위치). 그래서 같은 경계 규칙:
- **아래로만 접근**: domain은 facade(write)/client(read) 경유. infra는 factory. AI는 `AIFacade`(계층 11).
- **위(application)·옆(타 runtime 내부) 참조 금지**: application handler를 import 안 함(역행). 타 runtime은 그 public `__init__` 표면만.
- **tx 안 소유**: 받은 uow로 동작(자체 세션 금지, 게이트웨이 carve-out 제외).

before→after (voucher_document 깊은 접근):
```python
# before — domain repo/service/model 직접 (runtime이 document 모듈 내부 만짐)
from app.modules.document.global_document.repository import GlobalDocumentRepository
from app.modules.document.global_document.services import SaveMarkdownService
repo = uow.repo(GlobalDocumentRepository)
await SaveMarkdownService(repo).execute(...)

# after — owning facade 경유 (write는 document 모듈이 소유)
from app.modules.document.facade import DocumentFacade
await DocumentFacade(uow).save_markdown(...)
```

before→after (계층 역행):
```python
# before — runtime이 application handler를 위로 import (context.py:71)
from app.application.handlers.person_profile.build_profile_snapshot import build_profile_snapshot

# after — 공유 로직을 domain facade(또는 client)로 내려 runtime이 아래에서 취득
from app.modules.person_profile.client import PersonProfileClient
snapshot = await PersonProfileClient(uow).build_snapshot(...)
```

## 12-3. rule 신설 설계 — `runtime.md` (붙일 골자)

```markdown
---
paths:
  - "apps/api/app/runtime/**"
---

# Runtime — 실행 엔진 조립 규칙

runtime(agent·form·voucher_document 등)은 도메인 로직을 소유하지 않는 **오케스트레이터**다.
위치·권한은 application handler와 동급 — 여러 모듈을 조율하되 내부를 만지지 않는다.

## 1. 접근 경계 (아래로만)
| 대상 | 방법 |
|---|---|
| domain write | owning `{Module}Facade` (repo/service/model 직접 금지) |
| domain read | `{Module}Client`(DTO, 계층 9) |
| AI 호출 | `AIFacade` (계층 11 — gateway/CreditOps 직접 금지) |
| infra | `{adapter}.factory.get_X()` |
| 타 runtime | 그 패키지 `__init__` public 표면만 (내부 모듈 직접 import 금지) |

## 2. 금지 (계층 역행·횡단)
- `from app.application...` import 금지 — application이 runtime을 부르지 그 역이 아니다. 공유 로직은 domain facade/client로 내린다.
- 타 모듈 `repository`/`services`/`models` 직접 import·`uow.repo(ForeignRepository)` 금지(§1).

## 3. tx
- runtime은 **주입받은 tx 핸들로 동작** — 자체 `AsyncSessionLocal()` 금지. tx는 호출자(라우터 `Depends`)가 소유.
- 핸들 둘: `uow`(`get_uow`, 단일커밋 — 동기요청·도메인 dispatch) · `aow`(`get_aow`, 즉시커밋 — SSE 스트리밍 자기-persistence). 둘 다 주입, **혼용 금지**(agent 자기 persistence=aow, 도메인 mutation=uow).
- 예외: AI 게이트웨이(자체세션, 계층 11)는 runtime 밖 llm 모듈 소유. 앱부트 factory 배선(`startup`)도 요청흐름 tx 아님.

## 4. public 표면
- 각 runtime 패키지는 `__init__`에 공개 API 고정(PEP 562 지연 노출 관례). 외부는 루트에서만 import.
```

강제: R1(foreign repo/service/model)·R2(application import)는 pre-commit AST hook 대상(계층 9 hook 확장).

## 12-4. R3 정밀화 — `uow` / `side_uow` (요청-내 두 번째 tx) `[확정: 사용자 2026-07-04]`

R3의 "uow 주입"이 agent를 깨지 않는다 — **agent의 `aow`는 이미 R3 정합**. 실측:
- `aow`는 라우터가 `Depends(get_aow)`로 **주입**([router_v5.py:46](../../../apps/api/app/modules/agent/conversation/router_v5.py#L46)) — runtime의 aow 자체생성 grep = **0**. R3의 "runtime이 세션 안 엶" 이미 충족.
- **`get_aow` == `get_uow` (구현 동일)** — provider는 그냥 `AsyncSessionLocal`로 UoW 하나 yield([unit_of_work.py:64](../../../apps/api/app/infrastructure/persistence/unit_of_work.py#L64)). "즉시커밋"은 provider가 아니라 **agent facade의 `@_tx` 데코레이터**(메서드 성공 시 `aow.commit()`, [turn_store_facade.py:34](../../../apps/api/app/modules/agent/facade/turn_store_facade.py#L34))가 손수 한다. `aow`의 본질 = "요청 안에서 request uow와 별개인 **두 번째 독립 세션**".
- `compose.py`가 `aow`+`uow` **둘 다 주입받음**([compose.py:48-49](../../../apps/api/app/runtime/agent/compose.py#L48)): `aow`=자기 persistence(즉시커밋), `uow`=도메인 tool dispatch(단일커밋). "두 세션 혼용 금지"([unit_of_work.py:58](../../../apps/api/app/infrastructure/persistence/unit_of_work.py#L58)).

### 결정 — `aow` → `side_uow` 리네임, behavior 밖 유지 (별개성 = 경고)

- **`get_aow`/`aow` → `get_side_uow`/`side_uow`** (agent 색깔 제거, docstring "요청 내 두 번째 독립 tx"로 일반화). provider 코드 변경 없음(이미 `get_uow`와 동일).
- **behavior에 안 담는다 — 별도 `Depends(get_side_uow)` 유지가 의도.** 일반화된 아키텍처(behavior가 `ctx.uow` 소유)에 **일부러 안 넣어** "이건 아키텍처 밖 예외, 주의해서 써라"를 표면화. 핸들러가 `side_uow`를 별도 주입받는 그 어색함 자체가 경고 신호.
- **범위 = 요청-내 두 번째 tx만.** 요청-후 BG(`_process_analysis`·pipeline·`_mark_failed`)는 `Depends` 세션이 이미 닫혀 못 씀 → 자기 시점에 새로 엶. 이 리네임으로 안 없어짐 = eventing/Track B 별건(8-4).

| tx 핸들 | 커밋 | 흐름 | 소유 | 아키텍처 |
|---|---|---|---|---|
| `uow` (`get_uow`) | 단일(behavior.request) | 동기 요청 + 도메인 dispatch | behavior(`ctx.uow`) | 일반 |
| `side_uow` (`get_side_uow`, 구 aow) | 호출자 즉시(`@_tx`) | 요청-내 두 번째 독립 tx (SSE 등) | 별도 `Depends`(behavior 밖) | **예외(별개성=주의)** |

- **이중핸들 스트림 시그니처(side_uow+uow)는 정본** — 위반 아님. "두 세션 혼용 금지"의 물리적 표현.
- **R3 진짜 타깃 = runtime이 `AsyncSessionLocal()` 직접 여는 곳**([form_template/executor.py:59](../../../apps/api/app/runtime/form_template/executor.py#L59)·[voucher_document/executor.py:64](../../../apps/api/app/runtime/voucher_document/executor.py#L64)·[new_agent/context/manager.py:117](../../../apps/api/app/runtime/new_agent/context/manager.py#L117)) → 주입 핸들로. `agent/startup.py:89`(앱부트 factory 배선)은 **keeper**.

## 12-5. 별도 세션(두 번째 tx) 기준 (cross-cutting = X3) `[확정: 사용자 2026-07-04]`

"요청 uow와 별개의 두 번째 세션"을 언제 여는가. 전 핸들러 실측 + eventing/reject 패턴 반영 후 **최소화 방향으로 재구조화** — 핸들러가 여는 정당한 별도 세션은 사실상 **agent 하나뿐**.

### 핵심 — 대부분의 "두 번째 tx"는 별도 세션이 아니라 다른 패턴으로 흡수된다
| 겉보기 사유 | 실제 정답 | 핸들러가 별도 세션? |
|---|---|:--:|
| **요청 밖 무거운 작업** (BG AI잡·알림) | **emit → 워커**가 반응 실행. 워커 tx는 프레임워크(`transactional_uow`)가 소유 | ❌ (핸들러는 emit만, 세션은 워커것) |
| **주 tx 취소돼도 남을 기록** (로그인 카운터·감사) | **reject**(같은 세션 commit+raise, [unit_of_work.py:48](../../../apps/api/app/infrastructure/persistence/unit_of_work.py#L48)) / **같은-tx emit**(audit integral, [eventing §10](../../rules/api/eventing.md)) | ❌ (같은 세션) |
| **동시에 커밋 리듬이 다른 두 쓰기 스트림** | **별도 세션이 유일하게 정당** — agent `side_uow`(턴 즉시커밋) vs `uow`(도메인 원자커밋). 한 세션이면 eager 커밋이 진행중 도메인 mutation 조기커밋 → 원자성 붕괴 | ✅ **유일** |

### 기준 (재구조화 — "별도 세션을 여느냐" 관점)
- **요청 밖 실행** → 별도 세션 열지 마라. **emit** (워커가 tx 소유). ← 구 기준1 흡수
- **취소돼도 남을 기록** → 별도 세션 열지 마라. **reject**(같은 세션) or 같은-tx emit. ← 구 기준3 흡수
- **동시 커밋-스트림 분리** → **별도 세션 정당**(agent `side_uow`가 유일 사례). ← 구 기준2만 진짜
- **그 외 전부** → 요청 `uow`.

즉 **핸들러가 두 번째 세션을 여는 정당한 이유 = agent 같은 "동시·이질 커밋 스트림" 단 하나.** 별도 세션은 사실상 agent의 특권.

### 추가 원칙 — tx 핸들은 하드코딩 말고 주입
함수가 `AsyncSessionLocal()`을 **직접 열지 말고 tx 핸들을 파라미터로 받는다.** 그래야 호출 문맥이 tx를 결정.

### 실측 위반 (지금 정리 대상)
| 위반 | 정답 | 슬라이스 |
|---|---|---|
| BackgroundTasks 3건 (notice·create_analysis·on_conversation) | emit → 워커 반응 | eventing/Track B 이관(8-4, [create_analysis:89](../../../apps/api/app/modules/counseling/counseling_case_analysis/handlers/create_analysis_handler.py#L89) 자인) |
| counseling fetch 2건 | 호출처 uow 사용(순수 read, 세 기준 다 불성립) | 계층 6-4 |
| runtime 자체세션 (form_template·voucher·new_agent) | 주입 uow | R3 |

- 강제: 문맥 판정이라 hook 어려움 → 규약+리뷰. `AsyncSessionLocal` 직접 open은 hook로 flag(정당사유=동시 커밋-스트림 분리 주석 요구).

---

## 12-6. 비-agent 적대검토 정정 (2026-07-05) `[사용자: agent 제외 작업]`

agent/new_agent 제외하고 voucher_document·form_template·form_generation·pipeline만 실코드 재검토(agent는 rebuild 중, R4). 결과:

- **R1 = 실재하나 파괴성 과소계상.** "26곳 agent-inflated" 가설은 **기각** — 비-agent 위반 **6파일·14 import·5 `uow.repo()`**(voucher_document·form_template) 실재. **단 write 타깃 모듈에 facade/service가 없다** — `voucher/voucher_extraction`·`form/extraction`은 **models+repository만**(services·facade 0). "owning facade 경유"는 **net-new 도메인 구축**(import swap 아님). 워크리스트 "26곳 이관" 라벨이 규모를 은폐. (`global_document`은 `services` 有 → reroute OK, form_template 부분이관됨.)
- **R2 = 비-agent 적용점 0.** `from app.application` grep = 비-agent 0건. "역행 3곳"은 전부 agent/new_agent context → **범위 밖, 할 일 없음**.
- **R3 = voucher/form self-session 오분류.** [voucher_document/executor.py:64](../../../apps/api/app/runtime/voucher_document/executor.py#L64)·[form_template/executor.py:59](../../../apps/api/app/runtime/form_template/executor.py#L59)는 **Track B leaf executor**(`JOB_HANDLERS["voucher_extract"]=process_extract`) — Redis Stream 워커가 `dispatch_job`(uow **미주입**)로 부른다. 요청 `Depends` 세션이 없어 **"주입 uow"가 물리적 불가**. 이건 R3 위반이 아니라 **계층 14(worker) executor-내부 tx 패턴(14-1 b)**·eventing 8-4 소관.
  - **문서 자기모순**: §12-4가 `:64`(main)를 R3 타깃으로 넣으면서 `:151`(`_mark_failed`, 같은 파일)은 keeper로 인정. main tx 롤백 후 status=failed 마킹은 **오염 세션 재사용 불가→새 세션 구조적 필수**라 주입으로 못 없앤다. peer 7개(field_note transcribe·diarize·summary 등)도 동일 self-session = Track B 표준.
  - **정정: 진짜 R3(요청-내 runtime이 세션 여는 것) 비-agent 위반 = 0.** voucher/form 4곳은 R3에서 빼고 **계층 14/8-4로 이관**.
- **R4 = agent 제외 깨끗함.** 비-agent 4패키지가 agent/new_agent import 0. 유일 cross-runtime = form_template→voucher_document/pdf_to_markdown(둘 다 in-scope).
- **pipeline/**: 디렉토리 부재(dead 제거 이미 완료/무대상).

**비-agent 순 결론**: 실제 할 일 = **R1(voucher_extraction·form.extraction facade/service 신설 + reroute)** 뿐. R2·R3·R4·pipeline = 할 일 0(오분류/범위밖/완료).

## 실행 워크리스트 (계층 12)

| 작업 | 대상 | 파괴성 |
|------|------|:-----:|
| R1 깊은 접근 → facade/client **(비-agent 확정)** | voucher_document·form_template **실측 4파일**(executor 2·service 2 — save_* 분은 기이관). **read 잔여 5건 해소(2026-07-07, P1-2차 B)**: FormExtractionFacade `find_extraction`/`set_image_document`·VoucherFacade `find_extraction_including_deleted`·GlobalDocumentFacade `get_many_including_deleted` 신설, executor·service reroute, `is_completed` 모델 프로퍼티로 Status enum import 제거, service.py ORM 직접 대입(image_document_id) 제거. agent 분은 R4/rebuild | **behavioral**(경로 변경, 로직 동일) |
| ~~R2 역행 제거~~ | 비-agent **적용점 0**(전부 agent context, 범위밖) | — |
| ~~R3 자체세션 → uow 주입~~ (비-agent) | voucher/form self-session은 **Track B leaf executor tx → 계층 14/8-4 소관**(R3 아님). `_mark_failed`는 새 세션 구조적 필수. 비-agent 진짜 R3 위반=0. **new_agent 분은 rebuild** | — (오분류 정정) |
| R3 `aow` → `side_uow` 리네임 | `get_aow`/`aow` → `get_side_uow`/`side_uow` (unit_of_work·router_v5·router_legacy·compose·agent facade). behavior 밖 유지 | 비파괴(리네임) |
| ~~dead 제거~~ | `runtime/pipeline/` 부재(이미 완료/무대상) | — |
| rule 신설 | `runtime.md`(paths: app/runtime/**) + hook 확장(계층 9) | 문서+hook |

**비-agent 정정 요약(§12-6)**: 실제 할 일 = **R1(voucher_extraction·form.extraction facade/service 신설)** 뿐. R2(0)·R3(오분류→계층14)·pipeline(부재) = 할 일 없음. agent/new_agent 분은 R4/rebuild 별건.

## 리플
- **계층 9 연계**: R1의 read=`{Module}Client`·write=facade는 계층 9 정본 그대로. hook도 계층 9 것 확장(runtime 파일 포함).
- **계층 11 연계**: runtime AI 호출=`AIFacade`는 계층 11에서 결정, 여기선 §1에 인용만.
- **R4 범위 밖**: agent↔new_agent 통폐합은 별 이니셔티브(마이그레이션). runtime.md는 호출 규약만.
- **파괴성**: R1·R2·R3 전부 behavioral(로직·tx·write 소유 이동) → characterization 테스트 동반 별 슬라이스. dead 디렉토리만 비파괴.
