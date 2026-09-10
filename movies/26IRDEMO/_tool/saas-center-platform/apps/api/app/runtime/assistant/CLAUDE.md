# assistant 런타임 — 컨텍스트 노트

대화형 tool-use 어시스턴트(구 agent·new_agent — 컷오버 2026-07-23, 구현이 SSOT).
쿼리 표면 계약(봉투·필터 유도·투영)의 정본은 [.claude/rules/api/agent-query.md](../../../../../.claude/rules/api/agent-query.md) — 여기 재서술하지 않는다.

## 지도

| 층 | 파일 | 역할 |
|---|---|---|
| 표면 | `modules/assistant/` | `/centers/{id}/assistant/conversations` · conversation/turn 모델 · facade |
| 셸 | `application/handlers/assistant/stream_assistant_turn.py` | verify → write-ahead INSERT+emit+커밋 → 프로필 → 엔진 SSE |
| 셸 | `.../resume_assistant_turn.py` | claim → (취소/gate 실행/ask 답) → 엔진 재합류 |
| 엔진 | `engine.py` | 조립 루트 + 터미널 저장 + usage 과금 + 히스토리(도구 흔적 복원) + 429 폴백 |
| 루프 | `loop.py` | while: LLM→tool→피드백. 가드 소유, 프롬프트 리터럴 0 |
| 실행 | `execute.py` | Executor(시그니처 검사 호출·권한 사실 피드백) + prefill + run_write |
| 카탈로그 | `catalog.py` | ToolSpec 수집 + `_in_scope()` + group_by enum/when 주입 |
| 실행 보조 | `group_by_dims.py` · `execute` G-impl A | 적격 dim 표 · list→bucket (handler B는 직접) |
| 컨텍스트 | `context.py` / `prompts.py` | SYSTEM(바이트 불변)+FK블록 / context_block(동적) / GUARDS |
| 어댑터 | `llm.py` | provider 유일 창구("anthropic" 이 파일 밖 금지) + wire 코덱 |

프론트는 전부 `agent` 명명(`features/agent/`, `agent.action.ts`) — API·테이블은 `assistant`. 어휘 불일치 주의.

## 핵심 계약

- **저장 = 턴 1행**(`assistant_turns.events` JSONB), 쓰기 턴당 2회: write-ahead INSERT(셸) + 터미널 UPDATE(엔진). hop 중 DB 0 — 메모리 버퍼, SSE 단절도 shield flush(ABANDONED). usage만 별도 축 — hop마다 gateway 즉시(돈은 쓴 순간, 대화는 끝난 순간).
- **HITL 1-gate**: ask/write_confirm → `Paused`(bookmark = wire 스냅샷+prior_returns) → `checkpoint_waiting`. 재개 claim = `WHERE status='paused'` UPDATE 한 문장이 이중실행 방어. **write 실행은 resume 셸 `_run_gate`가 유일 지점**(`emit_actor_type("agent")`, actor_id는 member 유지). 취소도 done 완주. (mutation 4-stage는 폐기 — 대화 못하는 selector의 보상장치였음.)
- **도구 스코프 = query 24 + prefill + ask_user**. 직접 write·비-query read 전면 제외(`_in_scope`). `request_form`은 정의 보존·스코프 제외(2026-07-27 — 값 수집이 prefill 화면 일원화를 침식). 권한 밖 도구는 노출 유지하고 Executor가 "권한 없음"을 사실로 피드백, denied 목록은 context 권한 줄(없으면 거짓 거절 — D12).
- **prefill = page_path 마커, 읽기 허용·쓰기 금지**: `page.navigate` + `page.set_fields` 이벤트. 값0이어도 폼 있으면 set_fields 발송(도착 페이지 편집 상태 진입이 이 이벤트에 발화). 핸들러가 시그니처에 `uow`를 선언하면 주입되고 코루틴이면 await(2026-08-11) — 대상 특정을 모델 판단에 맡기면 오선택이 남는다(일지 회기 40% 미완료 선택 실측). 저장은 여전히 사용자 화면에서만. 대상을 하나로 못 좁히면 `{"error": {reason, choices?, next}}` 반환 → is_error로 사실 피드백(모호함은 모델이 ask_user로 사용자에게). 빈 화면 열고 "열었습니다"는 거짓 보고.
- **SYSTEM 바이트 불변**(캐시 프리픽스) — 동적 값은 전부 context_block: 주간 달력 요일 맵(모델 날짜 산술 ±1 제거), 권한 줄 상시, 프로필 600자 예산. FK 블록은 relations.py 라이브 추출(sorted 결정성).
- **히스토리에 도구 흔적 복원 필수**(rows 상위 3·500자 절삭) — 텍스트 쌍만 남기면 지난 턴이 "무조회 즉답 시범"으로 보여 오케 모델이 모방(오선택 0/5→5/5 실측, 멀티턴 오염의 근원 — 구 laguna 관측, 모델 무관 유지).

## 가드 — 전부 텍스트 지적+재요청

화면 의도·날조 가드(open_screen·_SCREEN_INTENT·_claims_screen_done)는 제거됐다(2026-08-11) — 전부 "도구 0콜 턴" 조건인데 현행 표면에서 36회 발동 0, 두 가드 off 페어드도 전 축 무변화(E13·E14). 모델 교체로 0콜 턴이 돌아오면 재도입 후보.

- tool_choice=any는 직결에선 유효, OpenRouter 경유 Claude에선 무시. **경유 Gemini에선 도구 多면 400** — messenger가 경유 비-Claude면 any→auto 다운그레이드(guard-any-toolchoice-400). 강제 효과는 어차피 경유서 없다.

| 가드 | 트리거 | 처방 |
|---|---|---|
| wrap_up | 빈 최종답(도구0·텍스트0) | 1회 재요청 (글리치 27%→0) |
| requery | 멀티턴 무조회 데이터 단정(건수·"없습니다") | 1회 재요청, 빈 재답이면 원답 유지 |
| unknown/duplicate | 미등록 도구·동일 tool+args 반복 | is_error 피드백 자기교정 |
| hop 소진(8) | — | tool_choice=none 마무리, 부분 결과 정상 종료 |
| 429 | AnthropicProviderError에 "429" | 안내문으로 정상 DONE(그 외 장애는 관통) |

## 모델 — gemini orchestrator (2026-08, laguna 제거)

- `NEW_AGENT_LLM_MODEL = "google/gemini-3.1-flash-lite"`(config 기본) · OpenRouter 경유. group_by E2–E5·표면 실측과 동일 계열.
- responder(2단 응답자) 제거(2026-08-11) — 오케가 gemini가 되며 같은 모델 이중 호출이라 비활성 상태였고 실행 경로가 없었다. 계보·페어드 수치는 `.claude/loop/assistant.md`, 코드는 `git show c1f95cf60:apps/api/app/runtime/assistant/responder.py`.
- 롤백: `NEW_AGENT_LLM_MODEL=poolside/laguna-s-2.1` (+ Poolside 키·직결 계약 knowledge/laguna). laguna는 문장 품질이 약해 responder 재도입 검토가 따라온다.
- **reasoning off · max_tokens 2048 동결** — thinking ON은 비용↑·이득 불명(구 laguna 동결 유지).
- Anthropic 전용(bm25 tool search·defer) 사용 불가 → `native_search=False` 전 도구 평載.
- 서버 `group_by` 재도입(G-impl) — 선언 dim 분할 요약. 미선언·즉흥은 병렬 tool_call.

## 실험 교훈 (기각 계보 — 다시 밟지 말 것)

- **재현되는 효과는 cover↔ranking 트레이드오프 하나뿐**: 흡수 필터 추가 = cover +40%p 동시에 sibling 도구 -20%p(카탈로그 confusability) — **문구·gloss·커널로 못 고침**. 흡수 확장(J4·J5) 전 client 골든으로 회귀 비용 측정 필수.
- 기각: 그래프 프롬프트 주입(2회 — 조회 전 "없음" 날조 유발, 순해악) · 서버 그래프 스티치 · 거절 도구(recall 10%) · composite 28도구 · 문구로 순위 튜닝 · max_tokens 상향 · keywords 보강.
- 판정 방법론: **페어드(같은 런) 비교만 유효**(baseline 런간 드리프트 25~40%p), N≤10 순위 판정 무의미. 전 수치 mock·N=5~10 — 프로덕션 기대치 아님.
- 오답 1차 처방은 TOOL schema/boundaries — system 프롬프트 소설 아님. 마크다운 목록 위반은 프롬프트-저항 → 프론트 렌더러가 흡수.

## 문서 신뢰도

- `docs/agent-architecture.md` = 미실현 비전(멀티에이전트 조직) — **코드 유도 금지**.
- `docs/new-agent-rebuild.md` = 구 계획, 명명 폐기(new_agent→assistant) — 설계 통찰만 유효.
- 설계 정본 3부작 = 리포 루트 `agent-flow.md`·`agent-resume-flow.md`·`agent-implementation.md`. 이 노트 포함 어떤 문서와 코드가 충돌하면 **코드가 정본**.
