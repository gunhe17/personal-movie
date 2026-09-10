# s07 자동 상담 일지 — 10분, 그리고 가방 속 녹음기

장면이 약속한 것: `scenes9.html` §07 — 필드노트에서 서식을 고르면 초안이 만들어지고, **상담사가 이미 쓴 본문 끝에 이어붙는다**(덮어쓰지 않는다).
**배역: 검사 축 — 윤도현.** 개인상담 C00003 1회기(2026-09-09 16:00–16:50) — **s06이 녹음·전사를 남긴 바로 그 회기**다.

> **2026-09-10 이동.** 이전 판은 이하준(회기 축 · 놀이치료 C00002)이었다. s06이 검사 축(윤도현)으로 옮겨간 뒤
> s07이 그대로 남으면 **"방금 녹음한 그 회기"의 일지가 다른 아이 이름으로 나온다.** 둘은 한 회기를 앞뒤로 쓰는 한 쌍이라
> 같이 옮겼다. s05·s08·s09는 이하준 그대로다 — 필드노트를 경유하지 않는다(보호자 변경요청 · 담당 범위 · 바우처 차감).

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
| **시작 시각이 미래면 일지가 통째로 안 열린다** | `InlineJournalEditor.svelte:145-150` `isBeforeStart` — `new Date(session.start) > Date.now()`. 참이면 `아직 진행되지 않은 회기예요` 안내만 그리고 **출결도 일지도 `일지 초안 생성` 버튼도 없다**(:541-557) |

### 회기 시각이 이 장면을 막았다 (2026-09-10 실측 · s06-setup.sql을 고쳤다)

s06이 처음 만든 회기는 **오늘(2026-09-10) 16:00–16:50**이었다. 그런데 `schedules.start`는 **naive**로 저장되고
이 화면은 그 값을 **로컬(KST) 벽시계로 그대로 파싱**한다(`new Date('2026-09-10T16:00:00')`). 14:25에 리허설을 돌리면
그 회기는 아직 시작하지 않은 회기다 — `status=completed`이고 출결이 `attended`여도 `isBeforeStart`가 시각만 보고 일괄 차단한다.
**버튼이 없으니 셀렉터가 30초 타임아웃**으로 죽었다(종료 코드 2).

`status=completed`인 회기의 시작 시각이 미래인 것 자체가 어긋난 데이터다. 그래서 `s06-setup.sql`의 회기를
**2026-09-09 (수) 16:00–16:50**으로 옮겼다 — 방과 후 벽시계는 그대로 두고 날짜만 하루 당겼다. 이러면 몇 시에 돌리든 지난 회기다.
그리고 그게 s07의 이야기와도 맞는다 — **어제 마친 회기의 일지가 아직 비어 있다.**

같은 값을 화면 표시에는 `formatUtcToKst`가 다시 +9h 해서 읽으므로 이 화면의 시각 표기는 `2026-09-10 (목) 01:00 ~ 01:50`이다.
시드의 모든 회기가 같은 어긋남을 갖는다(`counseling.py:230`의 10:00 회기도 19:00으로 표시된다) — **제품 버그로 기록만 하고 고치지 않았다**(scene-prep §7).

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

전사 **23세그먼트**(`_scripts/s06-setup.sql` — 윤도현 C00003 1회기)에 있는 사실만 쓴다. 관찰(보고·행동)과 개입·계획을 나눠 적었고, 진단·과장은 넣지 않았다.
**1회기라 과제 점검이 아니라 라포 형성과 첫 과제 합의가 축이다.** 마인드봄 종합보고서(`_tool/mindbom/apps/api/scripts/seed_content.py` `REPORT_BODIES`)의
소견("정서를 표현하기보다 혼자 감내하는 대처")·제언 ①③과도 어긋나지 않게 썼다.

| 칸 | 초안 키 | 길이 | 본문 |
|---|---|---|---|
| 상담 목표 | `main_topic` | 104자 | 자기 이야기를 꺼내도 괜찮다는 경험을 회기 안에서 먼저 만들고, 알아차린 감정을 한 단어로라도 밖에 내놓아 보게 한다. 오늘 처음 보고된 수면 곤란은 평가하지 않고 기록으로 이어서 본다. |
| 진행 내용 | `progress` | 266자 | 또래 관계는 '애들이랑 축구도 하고'라며 무리 없이 보고했으나 자기 이야기는 '별로 안 해요, 딱히 할 말이 없어서'라고 했다. 말해도 되는지 확인을 구하는 질문 앞뒤로 13초·17초의 긴 침묵이 있었다. 무엇을 말해도 된다고 허용하자 '말하면 걱정하잖아요, 엄마도 요즘 힘든데'라며 함구의 이유를 밝혔고, 참으면 된다는 대처를 반영하고 몸의 신호를 묻자 '잠이 잘 안 와요'라며 2~3주간의 수면 곤란을 처음 보고했다. 말한 적 없던 것을 오늘 말해 준 것 자체를 강화했다. |
| 다음 상담 내용 | `next_goal` | 137자 | 기분 기록은 제출 여부나 성실도로 다루지 않고 적어 온 단어 하나에서 이야기를 연다. 수면은 아동이 적은 시각으로 경과를 확인하고, 악화되면 보호자 면담과 협진 여부를 논의한다. 어머니를 걱정시키지 않으려는 마음은 아동이 다시 꺼낼 때 따라간다. |

화면에 안 보이는 키도 같이 채운다 — `mood` · `intervention`(6개 배열) · `homework`("하루 한 번, 그날 기분을 한 단어로 적기") · `raw_notes`.
`private_notes`는 작성자 전용이라 초안이 건드리지 않는다(`InlineJournalEditor.svelte:229`).

### 세 칸은 한 화면에 다 안 들어온다 (실측)

일지 스크롤 영역은 y 263~798(clientHeight 535)인데, 빈 칸도 최소 높이 108이라 **다음 상담 내용은 스크롤 전 843부터 시작한다.**
본문을 아무리 줄여도 세 칸이 한 화면에 같이 서지 않는다(짧은 초안이던 t02도 마찬가지였다).

그래서 진행 내용을 5줄에 맞추고(266자), 조작에 **아래로 한 번**을 넣었다.
스크롤 뒤 실측(윤도현 본문 · 2026-09-10) — 상담 목표 271~379 · 진행 내용 451~595 · 다음 상담 내용 667~775.
스크롤 영역은 263~798(clientHeight 535 · scrollHeight 868 · scrollTop 140)이고 **세 칸 전부 화면 안**이다. 첫 칸 라벨만 위로 살짝 잘린다.
**이하준 본문과 픽셀이 같다** — 진행 내용 글자 수를 5줄 안에 맞췄기 때문이다. 스크롤 180은 그대로 쓴다.

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
| 시작 | `/counseling/status/<C00003 caseId>?session=<1회기 sessionId>` — **id는 s06-setup을 돌릴 때마다 바뀐다**(s07-setup.sql 마지막 select가 뽑는다) |
| 전제 | 시드 필드노트가 그 회기의 schedule에 붙어 있을 것(시드가 이미 한다) |

리허설 실측: **7단계 11.5~15.7초 · 서버 오류 0 · 종료 코드 0** (2026-09-10, 윤도현 본문으로 재작성 후).
길이가 흔들리는 자리는 하나뿐이다 — `일지 초안 생성` 클릭에서 스낵바까지 **6.1~10.1초**(OpenAI 응답 시간, `llm_calls.latency_ms` 4.3~5.3초).
`until`이 그만큼만 기다리므로 조작은 안 깨지지만 **테이크 길이가 테이크마다 다르다.** 세 번 중 두 번이 6.1초였다.
DB 확인 — 그 회기의 일지가 새 본문으로 갱신되고 `note_status = completed`, 초안 이력 1건, `llm_calls` 한 줄.

**이번 사이클에서 제품 코드는 고치지 않았다.** 본문은 `production_ai_configs` 행(데이터)으로만 바꿨다 — `_scripts/s07-setup.sql`.

수정 전에는 같은 리허설이 "깨끗하다"로 통과했다. **DB 확인이 아니었으면 버그를 못 봤다.**
