# 웹 agent → assistant 스택 이식 플랜

옛 `agent`(plan/skill/replan 다단계) 웹 챗을 새 `assistant`(flat 반응형 루프) 백엔드 계약에 맞춘다.
설계 정본: [agent-flow.md](../../../agent-flow.md) · [agent-resume-flow.md](../../../agent-resume-flow.md) · [agent-implementation.md](../../../agent-implementation.md).

## 0. 배경

백엔드는 컷오버 완료(`구 agent 스택 전면 제거 — assistant 컷오버 완료`), 웹은 옛 `/agent` 경로 + 옛 SSE 계약에 잔존.
현재 `/agent` UI는 이 백엔드에 대해 **404로 죽어 있음**(`POST …/agent/conversations` → 없음).

**이식 ≠ 포팅.** 옛 다단계 plan/skill/replan UI를 **걷어내고** flat-loop 3핵심 이벤트
(`completion_delta`·`step_tool_result`·`checkpoint_waiting`=selection)에 맞추는 **축소 작업**이다.
순삭제 가능 ~450–500줄(§4).

## 1. 계약 델타 (old → new)

### 1-1. 엔드포인트

| 기능 | 옛 웹 호출 | 새 백엔드 | 조치 |
|---|---|---|---|
| 대화 생성 | `POST …/agent/conversations` | `POST …/assistant/conversations` | 프리픽스 |
| 목록 | `GET …/agent/conversations` | `GET …/assistant/conversations?page&size` | 프리픽스 |
| 상세·복원 | `GET …/conversations/{id}/messages` | `GET …/assistant/conversations/{id}` → `{…, turns:[…]}` | 경로+형태 |
| 삭제 | `DELETE …/agent/conversations/{id}` | `DELETE …/assistant/conversations/{id}` | 프리픽스 |
| 스트림(턴) | `POST …/conversations/{id}/stream` `{message}` | `POST …/assistant/conversations/{id}/stream` `{message}` | 프리픽스 |
| 재개 | `POST …/conversations/{id}/resume/stream` `{input,is_form}` | `POST …/assistant/conversations/{id}/resume` `{input,is_form,cancelled}` | 경로+body |
| 제목 수정 | `PATCH …/conversations/{id}` `{title}` | 미마운트 → **PATCH 라우트 신설**(결정 (b)) | 백엔드 5파일 + 프리픽스 |
| 토큰 사용량 | `GET …/conversations/{id}/tokens` | 없음(웹 호출처 0 = 死) | **삭제** |

### 1-2. SSE 이벤트

| 옛 (웹 `SSEEventType`) | 새 (assistant) | 조치 |
|---|---|---|
| `progress` | `progress` | 유지 |
| — | `completion_delta` | **신규** — 답변 토큰 델타(실시간 타이핑) |
| `plan_created` · `step_started` · `step_completed` | — | **삭제**(사전 계획 없음, 반응형 루프) |
| `step_tool_call` | `step_tool_call` (prefill 전용: `page.navigate`/`page.set_fields`, 단방향) | 유지(의미 축소 — `page.*`만) |
| `step_tool_result` | `step_tool_result` (`display`: card 1건 / table N건) | 유지 |
| `checkpoint_waiting` | `checkpoint_waiting` (question + `input.options` selection) | 유지(form-mode 제거) |
| `checkpoint_replan` · `checkpoint_reset` | — | **삭제**(replan/reset 없음) |
| `conversation_done` | `conversation_done` (`{message}`만) | 유지(output 분기 제거) |
| `conversation_error` | `conversation_error` | 유지 |

### 1-3. 저장·복원

| | 옛 | 새 |
|---|---|---|
| conversation | `display_plan`·`vars`·`meta` 보유 | **껍데기** — `id·title`만 |
| 단위 | messages(`message_type`·`display_message`) | **turns** — `{user_message, events[], completion, status}` |
| 복원 재료 | `GET …/messages` → `AgentMessage[]` | 상세 응답 `turns[]` |

복원 = `turns` 순회 → 턴마다 **user_message 버블 + `events[]`를 라이브 SSE와 동일 핸들러로 재생 + completion**.
`events`가 곧 `step_tool_result`/`checkpoint_waiting`/… 저장본이라 라이브·복원이 한 코드 경로로 수렴.

### 1-4. HITL

| | 옛 | 새 |
|---|---|---|
| 입력 모드 | text · **form(다필드)** · selection | **selection 전용**(engine `_checkpoint_event`가 `{type:selection,options}`만 방출) |
| 확인/취소 | 자유 텍스트 판정 | 프론트 구조화 플래그 `cancelled`(버튼) — ask 자유텍스트는 모델이 접음 |
| replan/reset | 있음 | 없음 |

## 2. 작업 범위 (파일별)

삭제 근거 상세 = 이 세션의 ponytail-review(옛 스택 전용 machinery). 요약:

| 파일 | 조치 |
|---|---|
| `features/agent/chat/sse-client.ts` | **fix** — L35·L76 `/agent/`→`/assistant/`, `/resume/stream`→`/resume`; resume body에 `cancelled` |
| `hooks/actions/agent.action.ts` | **fix/delete** — 프리픽스, `/messages`→상세, 제목 PATCH 프리픽스(백엔드 라우트 신설 후 동작), 토큰 GET 삭제(死·호출처 0) |
| `features/agent/chat/types.ts` | **shrink** — `SSEEventType` 정리(+`completion_delta`, −plan/step/replan) · `PlanDisplay*`·`FormFieldDef`·`ProgressStep` 삭제 · `AgentSession`/`AgentMessage`→turn 형태 |
| `features/agent/chat/view-model.ts` | **delete/rewrite** — `mapPlanToSteps`·`updateStepStatus`·`mapStepStatus` 삭제 · `extractCheckpointWaiting` form 분기 삭제 · `mapMessageToChat` events 기반 재작성 · `formatSessionTime` 유지 |
| `stores/agent.svelte.ts` | **delete/add** — plan/step/replan 케이스 삭제 · `displayPlan`/`progressSteps`/`loadPlan` 삭제 · `currentPlanToolResultIds`+`rolledBack` 삭제 · `conversation_done` output 분기 삭제 · `completion_delta` 핸들러 추가 · `loadFromAgentMessages`→events 재생 |
| `chat/components/PlanProgress.svelte` | **delete** — plan 진행바 없음 |
| `chat/components/CheckpointForm.svelte` | **delete** — checkpoint selection 전용, 폼 재도입 계획 없음 확정 |
| `chat/components/SelectionList.svelte` | **유지** — selection checkpoint 대응 |
| `chat/components/ToolResultTable.svelte` + `tool-columns.ts`·`column-atoms.ts`·`column-renderer.ts` | **유지(LIVE)** — `step_tool_result` 테이블. 이식에서 제외, 별건 재검토(§5) |
| `features/agent/page-tools/*` · `form-tools.ts` | **유지(LIVE)** — prefill(`step_tool_call` = `page.*`) |
| `routes/(protected)/agent/**` | **fix** — plan 표시 제거, 스트리밍 텍스트·selection·복원 배선 확인 |

## 3. 단계별 실행 (verify gate)

각 Phase는 검증 통과 후 다음으로. 검증 = 실 UI([http://localhost:3504/agent](http://localhost:3504/agent), 로그인).

**Phase 0 — 엔드포인트 재배선 (404 해소)**
- `sse-client.ts`·`agent.action.ts` 경로 `agent`→`assistant`, resume `/resume/stream`→`/resume`, body `cancelled` 추가.
- verify: 로그인 → 새 대화 생성 **200** · 스트림 요청이 404 아님(발화 시 SSE 흐름 개시).

**Phase 1 — SSE 이벤트 모델 교체**
- store: plan/step/replan 케이스 삭제, `completion_delta` 핸들러 추가(답변 버블에 토큰 append), `conversation_done` output 분기 제거(→ notFound 판정 + 최종 텍스트만).
- types: `SSEEventType` 정리.
- verify: 조회 발화("상담사 목록") → **completion_delta 타이핑** + `step_tool_result` 테이블 렌더.

**Phase 2 — HITL selection 전용화**
- `CheckpointForm.svelte`·`FormFieldDef`·form-mode·`extractCheckpointWaiting` form 분기 삭제.
- resume 호출: 확인/취소 → `{input, cancelled}`, ask 선택 → `{input}`.
- verify: write 발화 → `checkpoint_waiting`(확인/취소) → 확인 시 실행·이벤트 dispatch / 취소 시 "취소했어요".

**Phase 3 — 복원 events 기반**
- `loadFromAgentMessages` 폐기 → 상세 `GET …/conversations/{id}` `turns[]` 순회, 턴별 user_message + `events[]` 재생(Phase 1 핸들러 재사용) + completion.
- verify: 대화 진행 후 **새로고침** → 화면(도구 테이블·질문/답·최종답) 복원.

**Phase 4 — 죽은 코드 삭제 + 타입 게이트**
- `PlanProgress.svelte`, plan mappers, store plan/rollback 상태, types plan/progress 잔재 제거.
- verify: `npm run check` **0 에러** · `grep -rn "plan\|replan\|skill_selection\|display_plan" features/agent` 잔재 0.

**Phase 5 — 백엔드 rename 라우트 (결정 (b), apps/api)**
- `PATCH …/assistant/conversations/{id}` `{title}` 신설 — facade `update_assistant_conversation_with_response` + module handler `update_assistant_conversation` + `AssistantConversationUpdate` 스키마 + 라우트(create/delete 패턴 미러). facade entity 메서드·service(`UpdateAssistantConversationService`)는 재사용.
- 웹 `patchAgentSession`은 Phase 0에서 프리픽스만 이동 → 이 라우트 land 시 동작.
- verify: 앱 부팅(라우트 테이블) → 사이드바 rename → 목록 반영.

## 4. net

**−450~500줄** 순삭제(옛 스택 전용):
PlanProgress 65 · CheckpointForm 183 · view-model plan/form ~110 · store plan/rollback/done ~73 · types plan/form/progress ~35.
`mapMessageToChat`·`loadFromAgentMessages` events 재작성이 추가 축소.

## 5. 결정 완료

- **제목 수정** → **(b) 백엔드 PATCH 라우트 신설**(Phase 5). auto-title([update_assistant_conversation_title.py](../../../apps/api/app/application/handlers/assistant/update_assistant_conversation_title.py))이 첫 메시지로 제목을 채우되, 수동 rename은 별도 라우트로 유지.
- **토큰 사용량** — 결정 아님. 웹 호출처 0 = 이미 死코드 → 액션·UI 삭제.
- **`is_form` / form-mode** → **삭제 확정**. ask 도구([catalog.py](../../../apps/api/app/runtime/assistant/catalog.py) `ask_user`)는 `question`+`options`(selection)만, 다필드 폼 도구 없음. 재도입은 백엔드 도구 신설이 선행 — 그때 프론트 함께.
- **`tool-columns.ts`(~1080줄)** → **(a) 유지**. LIVE이며 이식과 분리. 범용 렌더러 전환은 이식 완료 후 별건(UX 결정).

## 6. 남은 확인 (구현 중)

- **복원 events 스키마** — `AssistantTurnResponse.events`는 `list`(자유형). 재생 핸들러가 소비할 이벤트 dict 형태(=SSE와 동일)를 Phase 3 착수 시 실측 확인.
