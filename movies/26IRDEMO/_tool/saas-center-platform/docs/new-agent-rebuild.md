# new_agent — Anthropic native tool calling 기반 재구축

> 상태: 계획 (2026-07-02) · 대상: `apps/api/app/runtime/new_agent/` (신설)

## 목적

현재 agent 파이프라인(2-step JSON 스킬 선택 + 선언적 chain 72개)은 "모델이 multi-step을 못 잇는다"는 전제의 산물이다.
Anthropic native tool calling으로 **모델이 도구를 직접 잇는 루프**를 `runtime/new_agent`에 처음부터 새로 구축하고,
기능 사이클이 온전해지는 시점에 기존 `runtime/agent`를 교체한다.

- 교체 방식은 v3→v4 전례를 따른다: **병렬 신설 → 검증 → 컷오버**. 기존 agent는 그때까지 무변경 유지.

## 재사용 (동결 — 새로 만들지 않는다)

| 자산 | 이유 |
|---|---|
| `modules/agent/*` (conversation·message·run·prompt) + `modules/llm/llm_call` | 대화 영속·run 기록·크레딧 차감은 파이프라인 방식과 무관 |
| `infrastructure/anthropic/` (Messenger·MessageResult) | 이미 구축됨 — tool_choice 등 소폭 확장만 |
| SSE Event dict **어휘·프레이밍의 형태**(계약) | 프론트 계약 — 깨면 프론트 작업이 따라옴. 단 **구현은 new_agent 자체 보유**(sse.py, 이벤트 dict 인라인) — runtime/agent 코드 참조 금지 |
| `conversation.display_plan` HITL 재개 프로토콜 | HITL은 제품 요구사항(mutation 확인·동명이인 선택) — 방식 불문 필요 |
| 도메인 **읽기** 포트: `query_*` / `resolve_agent_ref` / `lookup_agent_ref` | 네임스페이스 dict + fields 절삭이 LLM용으로 이미 최적화 — 읽기 tool 구현체로 재사용. (쓰기는 handler 직결로 변경 — 아래 "DB 접근" 참고) |
| 기존 카탈로그의 description 자산 (파라미터 규칙·예시) | tool 정의로 이식 |

## 새로 구축

- **Agent 루프**: system prompt + tools → Claude tool-use 멀티턴 루프 (기존 selector/handlers/chains/chain_runner 대체)
- **Tool 정의**: 읽기=도메인 읽기 포트, 쓰기=handler 직결 (composite chain 72개는 모델 합성으로 대체)
- **루프 정책**: max hop·토큰 상한, 프롬프트 캐싱(tools+system 고정 prefix)

## 엔진 경계 — 블랙박스 계약

new_agent는 **"ctx + 입력 → 이벤트 스트림"** 하나의 경계로 닫는다. 내부(LLM 호출 횟수·루프 방식·HITL 상태·영속)는 호출자에게 보이지 않는다. 교체 단위도, 검증 단위도 박스 통째.

```python
@dataclass(frozen=True)
class AgentContext:      # 요청 스코프에서 핸들러가 조립
    center_id: str
    member_id: str
    account_id: str | None
    aow: UnitOfWork      # 대화 영속용
    uow: UnitOfWork      # 도메인 조회/변경용

class AgentEngine(Protocol):
    # 구현체는 ctx를 생성자에서 받아 __init__에서 명시적으로 조립 — 엔진 인스턴스 = ctx 스코프
    async def run(self, *, conversation_id: str | None, message: str) -> tuple[str, AsyncIterator[dict]]: ...
    async def resume(self, *, conversation_id: str, user_input: str | dict, is_form: bool) -> AsyncIterator[dict]: ...
```

- **터미널 이벤트 불변식**: 스트림 마지막 이벤트는 반드시 `conversation_done` | `checkpoint_waiting` | `conversation_error` 중 하나. 종료 신호 = 제너레이터 종료. (`[DONE]` 프레이밍은 `to_sse` 몫 — 계약 밖)
- **엔진 의무 4개**: ① 이벤트는 기존 Event 어휘만 ② `checkpoint_waiting` 발행 전 `display_plan` 저장 ③ 엔진의 직접 영속은 **display_plan(재개 상태)과 llm 사용량(raw usage) 둘뿐** — 메시지 영속은 껍질 몫(아래 "영속 소유 3원칙") ④ 엔진 무상태 — 재개에 필요한 전부는 DB에.
- **경계를 넘는 것**: ctx, 입력, Event dict, conversation_id. **못 넘는 것**: LLM/provider 타입, tool 정의, display_plan 내부 구조, stage 개념.
- conversation 생성(id null 케이스)도 박스 안. 단 `X-Conversation-Id` 헤더 때문에 `run()`은 첫 yield 전에 id를 확정해 핸들러에 노출한다.
- 기존 agent도 이 계약의 구현체 1호로 볼 수 있다 — 컷오버 = factory/settings 스위치 전환.

### LLM 좌석 — 중립 포트 대신 seam-ready

provider 중립 포트(중립 DTO·raw replay·이중 코덱)는 **만들지 않는다** — 최소공통분모 함정(cache_control·strict·thinking이 교집합 밖) + history 손실 변환 비용 대비, 교체 요구의 실체가 아직 없다. 대신:

- 교체 3층위로 커버: **모델** = 생성자 파라미터(이미 공짜, lab override 포함) / **프로바이더** = 아래 3파일 국소 리팩토링 / **엔진** = AgentEngine 스위치.
- provider가 스미는 코드는 엔진 내 `llm/` 2파일로 국소화: `client.py`(Messenger 호출+캐싱 배치+스키마 렌더) · `history.py`(Item↔wire 코덱). **이 패키지 밖에서 "anthropic" 금지.**
- Gemini 등 비-Claude A/B가 실제 요구로 오면 그때 이 패키지에 인터페이스를 씌운다 (seam-ready, not seam-built).

### DB 접근 — 쓰기는 handler 직결

엔진 내부 tool 실행이 DB를 읽고 쓴다. **쓰기(mutation)는 기존 handler를 직접 호출**한다 — tool = 실제 유스케이스 1:1, UI와 동일 경로라 검증·권한·이벤트 발행이 자동 일관. cross-module write 조율 주체가 원래 application handler이므로 규칙에도 부합.

| | tool 구현 | 근거 |
|---|---|---|
| 읽기 (query) | 기존 도메인 읽기 포트 (`query_*` 등) | 네임스페이스 dict + fields 절삭이 LLM 최적화 완료. handler Response가 더 나은 모듈만 점진 전환 |
| 쓰기 (mutation) | handler 직결 | 포트 이중화 제거, 유스케이스 드리프트 0 |

handler 직결의 대가로 엔진이 지는 책임 4개 — `call_handler()` 헬퍼 한 곳에 모은다:

1. **미니 behavior**: behavior 전환 핸들러는 tx-free(`event_group_id, ..., uow` 수취). 엔진이 event_group 시작 → 호출 → `uow.commit()` → dispatch(아웃박스 sweeper 지연 배달 허용)를 재현.
2. **권한 스코핑**: 핸들러는 인증 완료를 가정 — ctx의 center/member 주입 + 기존 SPECS `auth_resolver` 판단(전체 권한 vs 본인 스코프)을 tool 정의에서 재현. 권한 구멍이 생기기 가장 쉬운 지점.
3. **예외 변환**: domain exception을 경계에서 잡아 `is_error=True` tool 결과로 LLM에 반환 — 예외가 새면 터미널 불변식이 깨진다.
4. **토큰 프로젝션**: Response 전문은 verbose — 읽기 wrapper에서 필드 절삭 한 번.

## 시나리오 — 1차 범위 (설계·검증의 근거)

### 포함 21개

| 그룹 | 시나리오 |
|---|---|
| A. 조회 | S1 스몰톡(0-hop) · S2 단순 조회 · S3 경유 합성(hop N — chain 대체 증명) · S4 0건/도구 실패→is_error 피드백 · S5 멀티턴 코레퍼런스 · S26 개인화 컨텍스트(최근 내담자·사용 패턴으로 해석) |
| B. HITL | S6 동명이인→ask_user(selection) · S7 쓰기+확인 게이트 · S8 필드 누락→ask_user(form) · S9 연쇄(쓰기 후 조회 — write 후 루프 복귀의 귀결) · S10 대기 중 새 메시지→auto-cancel |
| C. 특수 | S11 프리필 6종(navigate+set_fields) · S12 hop 상한→부분 결과 마무리 · S13 연결 단절→abandoned |
| D. 루프 가드 | S14 동일 tool+args 반복 감지 · S15 unknown tool→is_error 자기교정 |
| E. 데이터 | S18 결과 잘림 마커+필드 프로젝션 |
| F. 쓰기 안전성 | S20 write 전후 단절(display_plan 클리어 원자성 + 결과 선영속) · S21 resume 중복 제출(클리어 선행) · S22 새로고침 복원 = 영속 리플레이(SSE 재개 인프라 불필요) |
| G. 장애 | S24 LLM API 장애→conversation_error (write는 resume 경로 유일이라 유실·중복 없음) |

### 제외/축소 (후순위)

| 시나리오 | 처리 |
|---|---|
| S16 max_tokens 잘림 이어쓰기 | 잘린 대로 내보냄 (max_tokens 여유로 예방) |
| S17 refusal 전용 멘트 | 일반 오류 멘트로 수렴, 로그 보고 후속 |
| S19 인젝션 전용 장치 | 시스템 프롬프트 1줄 + 확인 게이트가 구조적 방어 — 전용 구현 없음 |
| S23 명시적 stop API | disconnect = 중지로 정의 |
| S25 mid-turn 크레딧 소진 차단 | 시작 전 체크만(현행 동일), hop당 기록으로 정산은 정확 |

핵심 설계 통찰: **기존 mutation 4-stage는 "대화 못 하는 selector"의 보상 장치** — native 루프에서 대상 탐색은 read tool, 동명이인·필드 수집은 ask_user, 남는 결정론적 보증은 **confirm-before-write 1-gate**뿐이다. 기존 mutation/ 패키지는 이식하지 않는다.

## 블랙박스 내부 — 모듈 분해

노드 6 + 지원 4. 실측(2026-07-02, 테스트 22): engine 214 · pause 198 · loop 133 · context 119+54(prompts) · llm 194(3파일) · execute 100 / support: store 250 · catalog 107 · contract 59 · sse 34 — 합 1,529줄. 호출 계층: engine → {context, loop, pause} · loop → {llm, execute} — pause는 engine의 협력자(loop은 Paused를 yield만, execute는 pause_kind 반환만).

폴더 구조 규칙 — **폴더는 내용물이 복수일 때만**. 진입점(engine)은 루트 단일 파일, `common/` = 지원 계층. 각 폴더 `__init__`은 재노출만.

```
runtime/new_agent/
├── __init__.py                  공개 표면: AgentContext·AgentEngine·get_engine·to_sse
├── engine.py                    ◆ 턴의 시작과 끝 + 조립(composition root) — 유일한 루트 로직
├── context/                     ◆ 대화 상태 읽기의 유일 경로 + 프롬프트 단일 소유
│   ├── manager.py               ContextManager: load_conversation·assemble·after_turn
│   └── prompts.py               SYSTEM·GUARDS·PromptBundle — 프롬프트 튜닝은 이 파일만
├── loop/                        ◆ 턴의 몸통과 그 부품
│   ├── loop.py                  Loop: LLM↔tool 반복 + 가드 4종, LoopStep 계약
│   ├── execute.py               Executor: read 실행·ask/write 판별 (호출자: loop)
│   └── pause.py                 Pause: display_plan 프로토콜 + 쓰기 게이트 (호출자: engine — 주제 응집으로 여기 배치)
├── llm/                         ◆ provider seam ("anthropic"은 이 안에서만)
│   │                            루트 유지 이유: history 코덱을 engine·pause도 사용 — loop 전유물 아님
│   ├── client.py history.py
└── common/                      ○ 지원 계층 — 시그니처 등장 금지
    ├── contract.py catalog.py sse.py best_effort.py
```

영속 표면은 **modules/agent/facade/turn_store_facade.py** (모듈이 자기 계약 소유) — 껍질(관찰자·write-ahead)과 엔진(display_plan·usage), context(read)가 사용.

### 영속 소유 3원칙 (2026-07-02 재정의 — store 소멸)

1. **사용자 메시지와 엔진이 출력해 사용자에게 전달되는 메시지는 모두 engine 밖에서 작성된다.** 껍질(v5 핸들러 — modules/agent 소속)이 입력을 write-ahead 저장하고, 이벤트 스트림을 관찰하며 **persist-before-yield**로 영속한다: `step_tool_result`→tool 메시지, `checkpoint_waiting`→checkpoint 메시지, `conversation_done`→completion+완료 처리.
2. **LLM은 context manager를 통해 1에서 저장된 정보를 불러와 사용한다.** context의 read는 modules/agent facade 경유.
3. **engine은 llm 사용량 같은 raw 정보만 LLM 호출 단계에서 기록한다.** modules/agent facade의 `record_llm_usage`(게이트웨이 `record_external_call` 경유 — 기존 `AgentFacade.add_llm_call` 선례) 사용.

이 3원칙으로 구 store의 존재 이유(두 모듈을 한 메서드로 묶는 크로스모듈 쓰기)가 소멸한다 — 남는 쓰기가 전부 단일 모듈 표면 호출이 되므로:

| 구 store가 하던 일 | 새 주인 |
|---|---|
| 메시지 저장 + sequence 채번 + message type/display 계약 | **modules/agent `TurnStoreFacade`** — 계약이 소유 모듈로 |
| 저장 시점 판단 (언제 무엇을) | **껍질의 이벤트 관찰자** (persist-before-yield) |
| llm_call 기록 (크레딧) | facade `record_llm_usage` → 게이트웨이 (모듈 내 선례 패턴) |
| display_plan set/clear | pause → facade 직호출 (예외 ① — 아래) |

**예외 2개**: ① display_plan은 사용자 메시지가 아니라 재개용 내부 상태 — pause가 facade로 직접 쓴다(엔진 무상태 의무). wire_messages를 이벤트로 프론트에 흘릴 수 없으므로 관찰자에 못 태움. ② write 게이트 실행 결과는 engine이 `step_tool_result` 이벤트로 방출 — 관찰자가 저장하므로 S20 선영속이 자동 성립(persist-before-yield).

**context.py** = 프롬프트 단일 소유 + "DB 상태 → LLM 입력" 순수 조합기 + `application/handlers/person_profile/*` 직결:
- **write-ahead → get**: 입력(user message/checkpoint_answer)은 engine이 처리 전에 즉시 영속하고, `assemble(ctx, conversation_id)`은 **DB에서 get**(conversation·messages·프로필 스냅샷·오늘)해 `TurnInput{prompt_bundle, history}`로 조합한다. assemble은 읽기 전용(쓰기는 after_turn의 upsert 트리거뿐). run/resume이 균질해진다 — 둘 다 "입력 영속 → assemble → 진행"
- **loop는 프롬프트를 갖지 않는다** — `assemble(ctx)`가 `PromptBundle{system, context_block, guards}`를 반환하고 loop는 문자열 리터럴 0으로 bundle만 소비. `system`=정적 행동 규칙(캐시 프리픽스, 바이트 불변 책임도 context), `context_block`=동적(`build_profile_snapshot` 센터·최근 내담자·장기 프로필 + 오늘 날짜 — 캐시 breakpoint 뒤 배치, 배치는 llm/client), `guards`=가드 개입 문구(S12 마무리 지시·S14 반복 경고·S15 교정 안내)
- 프롬프트 소유 분할: **대화 프롬프트=context, 도구 프롬프트(description)=catalog**(스키마와 정합 유지), pause의 확인 질문·취소 멘트는 UI 카피라 pause 소유
- 턴 종료: settle 후 `after_turn()` → stale 시 `analyze_usage` 백그라운드 트리거(upsert) — `on_conversation_created` 패턴
- 후속 여지: store AgentFacade의 `agent_prompt` 테이블+`load_prompts()`로 프롬프트 DB 관리(무배포 튜닝·lab A/B) 전환이 context 한 파일 수정으로 가능

| 모듈 | 담당 시나리오 |
|---|---|
| engine.py | S10 S13 S22 |
| context.py | S5(보강) S26 |
| loop.py | S1~S3 S12 S14 S15 S24 |
| llm/* | (기반 — 시나리오 소유 없음) |
| execute.py | S4 S11 S18 |
| pause.py | S6~S9 S20 S21 |

**"지도 = 코드" 원칙**: 지도의 노드 = 클래스, 화살표 라벨 = 메서드 시그니처. **지도에 없는 이름(store 등 배관)은 모듈 간 시그니처에 등장 금지** — engine이 턴 시작에 1회 조립(composition root)하며 생성자로만 주입한다.

```
핸들러 ──▶ NewAgentEngine(ctx).run(conversation_id, message) / .resume(...)  # 조립은 __init__
engine ──▶ ContextManager.assemble(conversation_id) → TurnInput
           ContextManager.load_conversation(conversation_id)   # 모든 대화 상태 read의 유일 경로
           ContextManager.after_turn()
engine ──▶ Loop.run(bundle, items) → LoopStep 스트림            # loop는 프롬프트 리터럴 0
loop   ──▶ LoopLLM.complete(system, items, tools) → AssistantTurn
loop   ──▶ Executor.execute(call) → ToolOutcome = result | pause | events
engine ──▶ Pause.suspend(conversation_id, paused) / .take(conversation_id) / .apply(plan, input, is_form)
```

지원 계층(지도 밖 — 시그니처 금지): `contract`(경계 계약) · `catalog`(선언) · `sse`(프레이밍) · `best_effort`. DB 표면은 modules/agent `TurnStoreFacade` — engine이 생성자에서 주입. Pause의 읽기도 reader(ContextManager) 주입으로 context를 경유한다.

- `ToolOutcome`이 유일한 새 내부 타입 — loop는 outcome 종류만 보고 계속/중단/방출을 정한다 (tool별 분기가 loop에 스미지 않게).
- **쓰기 게이트가 pause.py에 있는 이유**: 게이트 발행→pending 저장→resume 실행이 한 생명주기 — S20·S21의 원자성 불변식이 한 파일 안에서 지켜진다.
- **display_plan v2 (단일 타입)**: `{type: "loop_paused", kind: "ask"|"write_confirm", tool_use_id, tool, args, wire_messages}`. resume은 한 경로 — 취소면 clear+done, 아니면 답변/실행결과를 tool_result로 주입해 루프 재개(write도 실행 후 복귀 → 모델이 완료 멘트·연쇄 조회).
- 기존 파일과의 대응: selector+parsing+prompts→llm+loop / chains+runner+resolve→모델 합성(소멸) / mutation 8파일→pause+catalog / prefill→execute+catalog.

## 원칙

1. **mutation HITL은 루프에 흡수하지 않는다** — "커밋 전 사용자 확인"은 결정론적 보증. 모델은 mutation 의도 식별까지, 이후 stage 진행은 상태머신으로 위임.
2. **프론트 무변경** — Event 스키마·checkpoint_waiting 계약 유지가 성공 조건.
3. **`runtime/agent` 참조 전면 금지 — 예외 없음.** 필요한 것은 new_agent 안에 신설한다: 영속=`store.py`(구 AgentFacade+MessagePersister에서 실사용 메서드만 통합, modules/agent 레포·서비스 직결), SSE=`sse.py`, 이벤트 dict는 유일 생성 지점에 인라인. 컷오버 시 runtime/agent 삭제에 new_agent가 걸리지 않는 것이 검증 기준(`grep runtime.agent → 0`).

## API — 표면 2개

conversation 생성을 별도 API로 두지 않는다 — 첫 턴과 후속 턴의 서버 차이는 `ConversationContext.load` 결과(빈 history vs 로드)뿐이므로, 생성은 stream에 융합한다. (부수 이득: 메시지 없는 고아 conversation이 생기지 않음. 기존 `POST /conversations` CRUD는 modules/agent에 유지 — new_agent 경로에서 안 쓸 뿐.)

| 엔드포인트 | conversation_id | 역할 |
|---|---|---|
| `POST /agent/stream` | **nullable** (body) | null이면 conversation 생성 후 턴 실행 → SSE |
| `POST /agent/resume/stream` | **필수** (body) | `display_plan` 재개 → SSE |

- conversation_id는 path가 아니라 **body** — path param은 nullable 불가, 라우트를 가르면 원점 회귀.
- 응답 헤더 `X-Conversation-Id`를 **항상** 실어준다(생성이든 echo든). 프론트는 POST SSE를 fetch로 읽으므로 스트림 시작 전에 id 확보 — Event 어휘에 타입 추가 없음.

### `POST /agent/stream` — 동작 흐름

```
요청: { conversation_id: str | null, message: str }

1. 동시 스트림 제한 (member당 1개)
2. conversation_id == null → AgentFacade.create_conversation (aow, 즉시 commit)
   != null → 존재 + center_id 검증 (불일치 = 403)
3. 크레딧 체크 (quota_checker — 잔량 0이면 전역 핸들러로 402)
4. user message **즉시 영속** (+ 첫 메시지면 auto-title) — write-ahead: 처리 전에 입력이 내구화
5. context.assemble — DB get(conversation·history·프로필) → TurnInput
6. Agent 루프: system + tools → Claude tool-use 멀티턴
   - tool_use(query 포트) → 실행 → tool_result 피드백 → 반복 (max hop 상한)
   - 동명이인 등 선택 필요 → checkpoint_waiting 발행 + display_plan 저장 → 루프 중단
   - mutation 의도 → 상태머신 위임(원칙 1) → checkpoint_waiting → 중단
   - 텍스트 응답 확정 → conversation_done
7. settle — display_plan 없으면 completed, 있으면 status 유지
8. SSE 종료: [DONE] (예외는 in-band conversation_error 후 [DONE])

헤더: X-Conversation-Id (항상)
이벤트 순서(정상): progress → (step_tool_result)* → conversation_done
이벤트 순서(HITL): progress → (step_tool_result)* → checkpoint_waiting   ← 여기서 스트림 종료
```

### `POST /agent/resume/stream` — 동작 흐름

```
요청: { conversation_id: str, user_input: str | dict, is_form: bool }

1. 동시 스트림 제한 + conversation 존재/center 검증
2. display_plan 로드 — 없으면 "확인할 작업 없음" conversation_done (에러 아님)
3. checkpoint_answer 영속
4. 취소 토큰이면 display_plan 클리어 → conversation_done
5. plan 종류로 분기:
   - query ambiguity → 선택된 id 주입 후 루프 재개
   - mutation stage → 상태머신 진행 (다음 stage checkpoint 또는 commit)
6. 이후 6~8은 stream과 동일 — resume 후에도 checkpoint가 또 나올 수 있다
   (mutation 4-stage: 대상 선택 → 폼 → 경고 → 확인)
```

- SSE 연결 단절 시: active conversation을 abandoned로 마킹(기존 v4와 동일), 스트림 슬롯 반납.
- 두 API 모두 응답/이벤트 스키마는 기존 Event 어휘 그대로 — 프론트는 URL prefix + 헤더 읽기만 변경.

## 교체 기준 — "사이클이 온전하다"의 정의

아래 시나리오가 new_agent 단독으로 관통되면 컷오버한다:

- [x] 단순 조회 ("오늘 일정") — 실모델 스모크 그린(2026-07-02)
- [ ] 경유 조회 — 모델 합성 ("박지은 선생님 담당 내담자")
- [ ] 동명이인 resolve HITL → 선택 → 재개
- [x] mutation HITL — 1-gate로 재설계(검색→호출→확인 diff→게이트 커밋), S7 실모델 그린(2026-07-02)
- [x] page prefill (navigate + set_fields) — 6종, S11 실모델 그린(2026-07-02)
- [ ] 멀티턴 컨텍스트 ("그 내담자 노트 보여줘")
- [ ] 크레딧 차감·run 기록·대화 영속이 기존과 동일하게 남는 것

컷오버: 라우터 핸들러 스위치(v5) → 안정화 → `runtime/agent` 제거.

## 인계 항목 — domain-refinement 루프에서 이관 (2026-07-08)

domain-refinement 루프가 `*_agent_facade` 계열에서 발견한 규칙 위반. agent 계열은 이 rebuild가
컷오버 시 대체·제거할 코드라 루프에서 고치지 않고 여기로 이관한다(사용자 판정 2026-07-08).
**컷오버로 해당 facade가 제거되면 자동 해소** — 만약 일부가 살아남으면 그 시점에 application 재배치 필수.

### facade→facade 직접 호출 (facade.md §3 · package-init.md 모듈 비노출 위반)

| 위치 | 위반 |
|---|---|
| `counseling/facade/counseling_agent_facade.py:233` | ScheduleAgentFacade 직접 호출 |
| `counseling/facade/counseling_agent_facade.py:532` | PersonFacade.get_persons_by_ids 직접 호출 |
| `center/facade/center_agent_facade.py:62·179·417` | PersonFacade 직접 호출 (list_persons_by_name·get_persons_by_ids) |
| `schedule/facade/schedule_agent_facade.py:130·138` | PersonFacade·(타모듈)MemberFacade 직접 호출 |
| `schedule/facade/schedule_agent_facade.py:151·157` | (타모듈)RoomFacade 직접 호출 |

- 크로스모듈 read 조립의 정본 경로: application handler 조립, 또는 read 전용 표면 `modules/{m}/client.py`
  (PersonClient·MemberClient — recipient_resolver·default_avatars 전환 선례 520ea2bd4).
- 참고: PersonFacade 메서드명이 루프에서 리네임됨(find_by_account→find_person_by_account,
  list_by_name→list_persons_by_name) — 신규 코드는 새 이름 기준.
