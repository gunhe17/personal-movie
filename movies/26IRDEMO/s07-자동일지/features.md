# s07 자동 상담 일지 — 10분, 그리고 가방 속 녹음기

장면이 약속한 것: `scenes9.html` §07 — 필드노트에서 서식을 고르면 초안이 만들어지고, **상담사가 이미 쓴 본문 끝에 이어붙는다**(덮어쓰지 않는다).
**배역: 회기 축.** 이하준 C00002 1회기 — 시드 필드노트 3건이 이 케이스의 회기에 붙어 있다.

## 흐름 (웹)

1. 회기 상세 — `?session=` 딥링크로 바로 연다(`counseling/status/[id]/+page.svelte:538`)
2. `일지 초안 생성` → **그 자리에서** 돈다("전사 분석 중…"). 시트를 여는 옛 경로가 아니다 —
   `onGenerateNoteDraft`가 주어지면 인라인(`InlineJournalEditor.svelte:79-80`)
3. 초안이 일지 칸에 채워진다. **빈 칸은 조용히 채우고, 이미 쓴 칸이 있으면 한 번만 물어본다**(`:248-283`)
4. `초안 N건 보기`에 이력이 남는다

## 코드에서 확인한 것

| | 근거 |
|---|---|
| 서식 5종 | `field-note/constants.ts:93-108` — 기본·SOAP·DAP·BIRP·가족센터 |
| 인라인 생성 조건 | `SessionDetailPanel.svelte:642` — `fieldNoteService && fieldNoteId`이 있어야. 없으면 옛 시트 경로 |
| 초안은 덮어쓰지 않는다 | `InlineJournalEditor.svelte:218` — "본문 끝에 이어붙인다" |
| 필드노트는 회기가 아니라 **schedule에 붙는다** | `counseling/status/[id]/+page.svelte:79` — 전문가앱이 일정을 골라 녹음하기 때문 |
| 회기가 없으면 거절 | `generate_counseling_note.py:52-56` — "이 일정에 연결된 상담 회기가 없습니다" |

## 초안 본문은 어디서 오나 — 스텁이 아니라 **진짜 LLM 호출**이다

4.6초에 끝나니 스텁일 거라고 의심했지만 아니었다. 경로를 끝까지 따라가면 OpenAI다.

| 단계 | 파일 |
|---|---|
| 핸들러 → dispatch | `handlers/field_note/generate_counseling_note.py` |
| embedded 모드라 큐 없이 즉시 실행 | `handlers/field_note/enqueue_pipeline_dispatch.py:18-27` (`AI_WORKER_MODE` 기본 `embedded` → `get_worker_batch_dispatcher()`가 `None`) → **event 워커 프로세스가 그 자리에서 실행** |
| 프롬프트 · JSON 요청 | `runtime/field_note/counseling_note/service.py:44-77` · 프롬프트 5종은 `…/prompt.py`(`NOTE_TEMPLATE_REGISTRY`) |
| 실제 호출 | `AIFacade.generate_json` → `AIGateway.generate_json`(`gateway/ai_gateway.py:130-168`) → `_get_llm_client`(`:568-576`) → `openai_client(gpt-4o-mini)` |
| 증거 | `llm_calls` 표에 매 리허설마다 한 줄이 쌓인다 — `model=gpt-4o-mini-2024-07-18`, `purpose=field_note_generate_note`, `latency_ms` 1.4~3.2초. **스텁이면 이 행이 안 생긴다** |

`quick()`의 기본 `temperature=0.3`(`infrastructure/llm/openai/client.py:47`)이라 **테이크마다 문안이 달라진다.**
기본 프롬프트가 뽑던 세 칸은 한 문장씩이었다 — 예: 진행 내용 = "친구에게 인사하기 시도를 두 번 했으며, 운동 계획을 세웠다."

### 촬영용으로 결정적으로 만든 자리 — 제품이 이미 갖고 있었다

`AIGateway.resolve_config`는 **호출마다** `production_ai_configs`를 읽어 `system_prompt`와 `model_name`을 덮는다
(`gateway/ai_gateway.py:36-77`, `module='field_note'` · `pipeline_step='counseling_note'`). ai_lab이 프롬프트를 운영에 올리는 그 통로다.

그래서 **제품 코드를 고치지 않고, 프로세스를 재시작하지도 않고** 본문을 고정했다 —
`_scripts/s07-setup.sql`이 그 행 하나를 넣는다. 프롬프트는 "아래 JSON을 한 글자도 바꾸지 말고 그대로 출력한다"이고,
LLM은 받아쓰는 역할만 한다. 파이프라인 · 초안 이력(`counseling_note_ai_drafts`) · `counseling_notes` upsert는 전부 진짜 경로다.

- **결정성 실측**: 같은 프롬프트로 두 번 돌려 `counseling_notes.content` JSON이 **완전히 동일**했다(키 7개 전부, 문자 단위).
- 시드를 다시 만들면 이 행도 사라진다 → 리허설·촬영 전 `s07-setup.sql`을 돌리는 것이 곧 이 행을 넣는 것이다.
- 남는 위험: 호출 자체는 네트워크·OpenAI 키에 의존한다(예전과 같은 조건). 촬영 당일 키가 죽으면 스낵바가 안 뜨고 `until`이 60초에서 던진다.
- 코드에 스텁 분기를 넣는 쪽(`MESSAGING_DRY_RUN` 방식)은 **event 워커 재시작이 필요해서** 하지 않았다(다른 작업이 같은 프로세스를 쓴다).

### 화면에 채워지는 세 칸 (정본은 `_scripts/s07-setup.sql`)

전사 12세그먼트(`_scripts/s06-setup.sql`)에 있는 사실만 쓴다. 관찰(보고·행동)과 개입·계획을 나눠 적었고, 진단·과장은 넣지 않았다.

| 칸 | 초안 키 | 길이 | 본문 |
|---|---|---|---|
| 상담 목표 | `main_topic` | 107자 | 또래에게 먼저 다가가는 행동을 실제 상황에서 시도해 보게 하고, 시도 뒤 남는 불편한 감정을 아동이 스스로 다룰 수 있게 돕는다. 기분 조절에 쓸 수 있는 신체활동은 아동이 직접 고르게 한다. |
| 진행 내용 | `progress` | 268자 | 과제 점검 — 학교에서 친구에게 인사하기를 두 번 시도했고, 한 번은 상대가 듣지 못한 것 같았다고 보고했다. 그때의 감정을 '좀 창피했어요'로 표현하며 그대로 지나갔다고 했다. 감정을 명명해 되돌려 주고 결과보다 시도 자체를 강화하자 아동이 먼저 인형놀이를 요청했고, 먼저 말을 거는 역할을 제안하자 '제가요?'라며 주저한 뒤 수락했다. 후반부 신체활동과 기분을 설명하자 스스로 축구를 꺼내며 '아빠랑은 못 하니까 혼자 공 차기라도'라고 덧붙였고, 주 3회 공 차기로 합의했다. |
| 다음 상담 내용 | `next_goal` | 142자 | 공 차기는 횟수만 확인하고 성패로 다루지 않는다. 인형놀이에서 맡은 '먼저 말 거는 역할'을 인사 다음 한 마디까지 확장하고, 반응을 얻지 못했을 때 쓸 대처를 놀이 안에서 미리 연습한다. 아버지와 함께하지 못한다는 언급은 아동이 다시 꺼낼 때 따라간다. |

화면에 안 보이는 키도 같이 채운다 — `mood` · `intervention`(6개 배열) · `homework`("주 3회 공 차기") · `raw_notes`.
`private_notes`는 작성자 전용이라 초안이 건드리지 않는다(`InlineJournalEditor.svelte:229`).

### 세 칸은 한 화면에 다 안 들어온다 (실측)

일지 스크롤 영역은 y 263~798(clientHeight 535)인데, 빈 칸도 최소 높이 108이라 **다음 상담 내용은 스크롤 전 843부터 시작한다.**
본문을 아무리 줄여도 세 칸이 한 화면에 같이 서지 않는다(짧은 초안이던 t02도 마찬가지였다).

그래서 진행 내용을 6줄에서 5줄로 줄이고(311자 → 268자), 조작에 **아래로 한 번**을 넣었다.
스크롤 뒤 실측 — 상담 목표 271~379 · 진행 내용 451~595 · 다음 상담 내용 667~775. **세 칸 전부 화면 안**이고 첫 칸 라벨만 위로 살짝 잘린다.

## 제품 버그 — 찾아서 고쳤다

**증상.** `POST generate-counseling-note` → `200 {"status":"started"}`. 그 뒤 UI는 `GET .../ai-drafts`를 계속 폴링하고
화면은 **"전사 분석 중…"에서 멈춘다.** 45초를 기다려도 일지는 안 써지고 **오류도 토스트도 없다.**

**진짜 원인.** 핸들러가 `client_ids`를 계산해 놓고 **dispatch params에 넣지 않았다**
(`generate_counseling_note.py:60` 계산 → `params={...}`에 누락). 그래서 워커가 부르는
`process_counseling_note(client_ids=None)` → `GenerateCounselingNoteService`의
`for client_id in client_ids:` **upsert 루프가 빈 채로 돈다**(`counseling_note/service.py:88-97`).

일지는 한 건도 안 써지는데 **파이프라인 단계는 completed로 찍힌다** — 루프가 0회 돌았을 뿐 예외는 없기 때문이다.
그래서 `field_notes.note_status = completed`인데 결과물이 없고, UI는 영원히 폴링한다.

**고친 것.** `params`에 `"client_ids": client_ids` 한 줄. 왜 필요한지 주석으로 남겼다.

**검증.** 되돌린 시드 위에서 다시 돌려 그 회기의 `counseling_notes` 행이 갱신됐다
(생성 `19:13:45` → 갱신 `19:13:58`, 내용이 AI가 쓴 것으로 교체). `note_status = completed`.

### 헤매게 만든 것

`_COUNSELING_NOTE`의 `status_field`가 **`note_status`**라, 워커 로그에 찍히는
`Step note_status completed`가 곧 상담일지 단계다. 다른 단계인 줄 알고 "상담일지는 실행조차 안 됐다"고 오판했다.

### 옛 기록 (추적 과정)

**증상.** `POST /field-notes/{id}/generate-counseling-note` → `200 {"status":"started"}` (40ms).
그 뒤 UI는 `GET .../ai-drafts`를 계속 폴링하고 화면은 "전사 분석 중…"에서 멈춘다.
45초를 기다려도 `counseling_note_ai_drafts`는 **0건**이고, **오류도 토스트도 없다.**

**추적한 것.**

| 확인 | 결과 |
|---|---|
| LLM 키 | `.env`에 `ANTHROPIC_API_KEY`·`OPENAI_API_KEY` **있음** |
| Redis 큐 | `XLEN ai:jobs` = **0** — 큐에 들어가지도 않았다 |
| `AI_WORKER_MODE` | 기본 `embedded` — 큐 대신 `JOB_HANDLERS[job_type]`을 즉시 실행하는 경로(`enqueue_pipeline_dispatch.py:18-27`) |
| 이벤트 경로 | `field_note_pipeline_requested` → `enqueue_pipeline_dispatch_handler`(`events/routes.py:225-235`) |
| 이벤트 워커 | 떠 있음(batch 프로세스, concurrency=16). 로그에 `Step note_status completed`는 있으나 **`counseling_note`은 없다** |
| 워커/API 로그 | `counseling_note`·`anthropic`·`ERROR` **한 줄도 없음** |

즉 요청은 접수되고 `note_status`까지는 진행되는데, **`field_note_pipeline_requested` 반응이 실행되지 않는다.**
LLM 문제가 아니라 이벤트 디스패치 문제로 보인다.

**다음에 볼 곳** — `dispatch_events()`가 요청 종료 시 실제로 이 이벤트를 내보내는지, `events` 테이블에 행이 쌓이는지,
`Event.dispatch_event`가 조용히 실패하는지(`runtime/field_note/runner.py:223-229`에 그 예외를 삼키는 자리가 있다).

초안이 실제로 만들어지는 것이 이 장면의 전부라, 데이터로 초안을 심어두고 화면만 보여주는 우회는 하지 않았다.
버그를 고치는 쪽이 맞았다 — 영상이 약속하는 기능이 실제로 동작해야 한다.

## 촬영 (막힘 해소 뒤)

| | |
|---|---|
| 조작 | `_scripts/s07-draft.mjs` |
| 시작 | `/counseling/status/<C00002 caseId>?session=<1회기 sessionId>` |
| 전제 | 시드 필드노트가 그 회기의 schedule에 붙어 있을 것(시드가 이미 한다) |

리허설 실측: **7단계 12.7~13.3초 · 서버 오류 0 · 종료 코드 0** (2026-09-10, 초안 본문 고정 + 스크롤 추가 후).
`일지 초안 생성` 클릭에서 스낵바까지 **6.1~6.6초**가 걸린다(`until`이 그만큼만 기다린다).
DB 확인 — 그 회기의 일지가 새 본문으로 갱신되고 `note_status = completed`, 초안 이력 1건.

**이번 사이클에서 제품 코드는 고치지 않았다.** 본문은 `production_ai_configs` 행(데이터)으로만 바꿨다 — `_scripts/s07-setup.sql`.

수정 전에는 같은 리허설이 "깨끗하다"로 통과했다. **DB 확인이 아니었으면 버그를 못 봤다.**
