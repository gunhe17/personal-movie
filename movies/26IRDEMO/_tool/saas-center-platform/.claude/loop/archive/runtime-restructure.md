# runtime 재구성 loop — 문법 통일 + field_note 엔진 분리

runtime(agent·new_agent 제외 전부)을 **하나의 파일 문법**으로 정렬하고, field_note의 무거운 실행 로직(AI 오케스트레이션)을 `runtime/field_note`로 분리한다. 분리가 만드는 복잡도(facade 표면·재배선·잔재)의 정리까지가 이 loop의 완료 조건이다.

> ## ⚑ 새 세션 이어받기 (먼저 읽어라)
>
> **설계는 전건 확정(2026-07-07, 사용자) — 재논의 금지, 집행만 한다.** 방향성·결은 [convention-design.md](convention-design.md) loop에서 주입된 것으로 간주(같은 작업 규율 계승).
> - 진행 상태 = §커서. 슬라이스 순서 = §집행 계획 Step 1~5.
> - baseline: `cd apps/api && uv run pytest -q -p no:cacheprovider` → **332 passed, 59 skipped** · boot `uv run python -c "from app.main import app; print(len(app.routes))"` → **577**. 슬라이스마다 재확인.
> - 현재 브랜치(tmp-agent-v10) 로컬 커밋만. git push/fetch/pull/reset 금지. 커밋은 한글 prefix + `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
> - agent 보고 불신 — 발견은 직접 grep/read로 재확인, 인라인 처리가 안정적(검증된 규율).

## 확정 설계 ① — runtime 파일 문법 (고정 어휘)

**루트 슬롯** (전부 optional, 있으면 반드시 이 이름):

| 파일 | 역할 | 언제 |
|------|------|------|
| `constants.py` | job_type 키 | 워커형만 |
| `executor.py` | 워커 진입점 `process_{job}()` — 자체 세션(Track B leaf keeper, [runtime.md](../rules/api/runtime.md) §3) | 워커형만 |
| `service.py` | 요청형 진입점 — tx/AI 주입, application handler만 호출 | 단일 엔진 모듈만 |
| `runner.py` | 다단계 상태 전이 러너 | 다단계 모듈만 |
| `prompts.py` | 공용 프롬프트 + 카탈로그(`get_production_prompts`) | 필요 시 |
| `{stage}/` | 실행 단계 = **항상 폴더** | 단계가 있는 모듈 |
| 명사 유틸 파일 | 공용 순수 유틸(단계 소유 불명일 때만 루트) | 최소화 |

**단계 폴더 내부** (진입은 반드시 `service.py`):

| 파일 | 역할 |
|------|------|
| `service.py` | 단계 진입, 유일 public — `{Verb}{Noun}Service.execute`(도메인 [service.md](../rules/api/service.md)와 같은 꼴) |
| `schemas.py` | 단계 DTO |
| `prompt.py` | 단계 전용 프롬프트 (voucher `pdf_to_markdown/prompt.py` 선례) |
| 명사 헬퍼 | `render.py`·`parser.py`·`text_diarize.py` 등 — **단계 밖 import 금지** |

**심볼 규약**: 워커 진입 = `process_{job_type}` 함수 · 단계 진입 = `~Service.execute` · 진입 두 종의 호출자는 application 레이어뿐(JOB_HANDLERS 또는 application handler) — **모듈이 runtime을 import하면 위반**([runtime.md](../rules/api/runtime.md) §4).

## 확정 설계 ② — field_note 경계 (무엇이 남고 무엇이 가나)

| 위치 | 무엇 | 왜 |
|------|------|-----|
| **module 잔류** | models·repo·schemas·`prepare_step` 상태머신·HTTP 핸들러·facade·전사 합성 규약(`merge_chunk_transcripts`·`build_transcript_text`·`load_segments`)·`merge_audio_chunks` | DB 계약 + 도메인 데이터 규약 |
| **runtime 이동** | `execute_transcribe/diarize/refine/summary`(pipeline_facade에서)·LLM 응답 파싱(`parse_analysis`·`ground_quote_timestamps`·`apply_refined_text`·`build_refine_prompt*`)·커버 판정·전략 분기·`silence_detection`·워커 executor 7종(`process_*`·`transcribe_chunk_background`)·`PipelineInfraService`(→runner)·프롬프트 전부(`pipeline/prompts.py`)·`get_production_prompts` 카탈로그 | 실행 엔진 자산 |
| **facade 신설** (엔진의 유일한 DB 통로) | §확정 설계 ③ | R1 — runtime은 facade만 |

**field_note 목표 트리**:
```
runtime/field_note/
├── constants.py executor.py runner.py
├── prompts.py               # 카탈로그(get_production_prompts) + RECOMMENDATION 등 단계 밖 프롬프트
├── transcribe/   service.py · chunk.py(transcribe_chunk 실시간 청크 전사)
├── refine/       service.py · prompt.py
├── summary/      service.py · prompt.py
├── diarize/      service.py · prompt.py · text_diarize.py · speaker_roles.py
└── counseling_note/ service.py · prompt.py(+NOTE_TEMPLATE_REGISTRY)
```

**세부 확정**:
- `process_*` 7종이 함께 이동하는 이유 = module→runtime import 금지(엔진만 옮기면 module 핸들러가 runtime을 import하게 됨). module의 `step_*.py`엔 HTTP 핸들러만 잔류.
- `counseling_note/service.py`는 `CounselingNoteFacade`를 **직접** 호출(runtime→application 역행 금지 — 기존 `save_generated_counseling_note` application handler 우회 제거. application handler는 HTTP측 조율만 유지).
- prompts가 runtime으로 갈 수 있는 근거 = module 잔류 소비처였던 `FieldNoteFacade.get_production_prompts`의 호출자가 application handler 2곳뿐(`get_lab_metadata`·`field_note_prompts`) → 카탈로그 함수째 runtime `prompts.py`로 이동, 호출자 import 전환(application→runtime 허용). `generate_recommendation`(application)도 runtime prompts import로 전환.
- runner의 raw `update(FieldNote)` SQL은 이동하며 **facade 경유로 정화**(runtime의 model import 금지). 자체 세션은 Track B keeper라 유지. **정화 예외 1**: 기존 raw update는 note 부재 시 조용한 no-op이었다 — runner의 상태 마킹은 try/except log로 감싸 "마킹 실패가 executor를 죽이지 않는" 기존 의미 보존.
- `field_note/schemas.py`의 `_parse_analysis_value`는 별개 함수(응답 직렬화용) — 건드리지 않는다.
- `tests/unit/field_note/test_summary_parse_analysis.py` → import 경로를 runtime으로 갱신(파일 위치는 `tests/unit/runtime/`로 이동).
- 행위보존이 원칙 — 이동은 코드 동형, 변경은 "정화"로 명시된 것만(runner facade 경유·counseling_note facade 직접).

## 확정 설계 ③ — PipelineFacade 신설 thin 메서드 (~14, 각 1~4줄 위임)

| 메서드 | 위임 |
|--------|------|
| `find_note(field_note_id, center_id)` | note_repo.find_in_center |
| `list_audios(field_note_id)` | ListAudiosService |
| `load_merged_transcript(field_note_id)` | merge_chunk_transcripts(list_audios) |
| `merge_audio_bytes(audios, storage)` | merge_audio_chunks 위임(부분집합 병합용 — extras) |
| `set_statuses(field_note_id, center_id, **fields)` | note_repo.update_in_center |
| `save_diarize_result(audio_id, diarize_result, stt_model)` | TranscribeExecutionService |
| `mark_audio_merged(audio_id)` | audio_repo.update_in_place(stt_model_used="whisper-1-merged") |
| `clear_audio_transcript(audio_id)` | update_in_place(diarized_transcript=None) |
| `set_audio_transcript(audio_id, *, text, model)` | update_in_place(transcript·transcript_status="completed"·stt_model_used) — **repo update_in_place에 `transcript` 컬럼 추가 필요** |
| `set_audio_status(audio_id, *, transcript_status)` | update_in_place |
| `load_refine_segments(field_note_id)` | RefineExecutionService.load_segments |
| `save_refined_transcript(field_note_id, center_id, refined_json, model)` | RefineExecutionService |
| `load_summary_context(field_note_id, center_id)` | get + audios + entries + build_transcript_text + build_segments → dict{field_note, transcript_text, segments, entries} |
| `save_summary(field_note_id, center_id, *, summary_text, model, analysis_json)` | SummaryExecutionService |

엔진 시그니처 규약: 단계 service는 `(facade, *, ai, storage, field_note_id, center_id, member_id)` 꼴 주입 — AI는 `create_ai_facade()`(executor가 취득), DB는 facade, 파일은 storage.

## 확정 설계 ④ — 타 runtime 델타

| 모듈 | 델타 |
|------|------|
| **voucher_document** | 기준점, 사실상 무변경. `processing_spec.py`·`quote_snapping.py` 소비처 실측 → 단일 단계 소유면 그 폴더로, 공용이면 루트 잔류. `REFACTORING_PLAN.md` 스테일 확인 후 삭제 |
| **form_template** | `service.py`·`render.py`·`schema_extraction.py` → `extraction/` 폴더화(내용 무변경). 타입 정정: `schema_extraction.py` AIGateway 어노테이션→AIFacade, `service.py`의 `FormExtraction` 모델 import→TYPE_CHECKING |
| **form_generation** | **호출 역방향 해소**: `modules/form/template/handlers/generate_draft.py`가 runtime import 중(위반) → `application/handlers/form/generate_form_draft.py` 신설, form router 재배선, 모듈 핸들러 제거(TOOL dict 있으면 application으로 승계). 인라인 `_SYSTEM_PROMPT` → `prompts.py` 추출. AIGateway 타입 어노테이션→AIFacade |
| **rule** | [runtime.md](../rules/api/runtime.md)에 §골격(파일 문법 표 + 진입 2종 + 심볼 규약) 추가 — paths-앵커로 신규 runtime(agent rebuild 포함) 자동 강제 |

## 집행 계획 (Step 1~5 — 슬라이스마다 boot 577 + 전 스위트 green + 커밋)

```
Step 1  field_note 신설 (최대 슬라이스, 3커밋)
  1a  facade 표면: thin 메서드 14 + audio repo transcript 컬럼(update_in_place) → boot/tests → 커밋
  1b  runtime/field_note 패키지 신설(목표 트리)·엔진 이동(facade 경유 재배선)·executor/runner/prompts·
      JOB_HANDLERS 9줄 재배선·module 잔재 삭제(process_*·pipeline_infra·prompts·facade execute_*와
      고아 서비스 static)·application handlers 3곳(prompts·counseling_note) 전환·테스트 경로 이동 → 커밋
  1c  경계 검증 grep(§완료 게이트) + 커서 부기 → 커밋(docs)
Step 2  form_generation 역방향 해소 + prompts 추출 + 타입 정정 → 커밋
Step 3  form_template extraction/ 폴더화 + 타입 정정 2 → 커밋
Step 4  voucher_document 유틸 재배치(소비처 실측 후) + REFACTORING_PLAN.md 처분 → 커밋
Step 5  runtime.md §골격 명문화 + convention-design.md 커서에 교차 부기 → 커밋(docs)
```

## 완료 게이트 (전 Step 후 전부 통과해야 종료)

```bash
# 1. module→runtime 역방향 0
grep -rn "app.runtime" apps/api/app/modules --include='*.py'          # → 0줄
# 2. runtime의 도메인 내부 직접 접근 0 (facade·client·infra·core만 허용)
grep -rnE "from app.modules.[a-z_]+.(?!facade)[a-z_]+.(repository|services|models)" apps/api/app/runtime --include='*.py'  # agent·new_agent 제외 0
# 3. runtime→application 역행 0 (agent·new_agent 제외)
grep -rn "app.application" apps/api/app/runtime --include='*.py' | grep -v "agent"   # → 0줄
# 4. record/세션 규율: 요청형 runtime의 AsyncSessionLocal 0 (executor·runner Track B만 허용)
# 5. boot 577 · 전 스위트 green (기준 332+, 이동으로 늘 수 있음)
```

+ 각 runtime 트리가 §문법의 어휘만 사용하는지 육안 확인(ls 대조).

## 커서

> **2026-07-07 — Step 1~5 전건 집행 완료 (loop 신설 당일 소진).**
> - **1a**(039f2d117): PipelineFacade thin 통로 14 + audio repo transcript 컬럼.
> - **1b**(f9ef55aee): runtime/field_note 신설(문법 적용 24파일) — 엔진 4+counseling_note·executor 7·PipelineRunner(raw SQL→facade 정화)·prompts 전부(단계별 prompt.py+루트 카탈로그)·LLM 파싱 이동. module 잔재 삭제(pipeline_infra·prompts·process_*·facade execute_* — pipeline_facade 944→494줄). JOB_HANDLERS 재배선, application 소비처 3 전환, save_generated_counseling_note 삭제(CounselingNoteFacade 직접).
> - **2**(568486bcf): form_generation 역방향 해소 — generate_draft_handler→application/handlers/form, prompts.py 추출, AIFacade 타입 정정.
> - **3**(855a3a1f4): form_template extraction/ 폴더화 + AIGateway 어노테이션→AIFacade + FormExtraction TYPE_CHECKING.
> - **4**(f972cf83c): voucher REFACTORING_PLAN.md 삭제(분해 인벤토리가 현 트리와 불일치=스테일 실측 확인) + quote_snapping→extraction/(유일 소비처). processing_spec=4단계 공용이라 루트 잔류.
> - **5**: runtime.md §0 모듈 골격 명문화(이 커밋).
> - 검증: 완료 게이트 grep 전건 통과(module→runtime = agent 계열+0건·runtime→application 0·field_note 도메인 내부 접근 0), boot 577, 전 스위트 332 passed/59 skipped 유지.
> - **잔여 없음 — loop 종결.** agent·new_agent는 rebuild 이니셔티브 소관(이 문법이 rebuild의 태생 기준). 이후 신규 runtime은 runtime.md §0이 paths-앵커로 자동 강제.
