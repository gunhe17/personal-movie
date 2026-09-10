# 계층 5 — Facade 설계 `[설계완료]`

정본 rule: [facade.md](../../rules/api/facade.md). 상위 인덱스: [convention-design.md](../convention-design.md).

survey: **85-90% 준수**, 이탈 5모듈(agent·field_note·assessment·counseling·messaging) 집중.

## Keeper (이미 결정 / 정당 예외) — 재작업 없음

- **agent facade tx/commit + context-bound `__init__`** (agent_facade·turn_store_facade, 6메서드): agent mutation 엔진이 handler 없이 facade 직접 호출 → **facade.md 명시 P3 브리지 예외**. P3 이관까지 keeper.
- **task_facade → ScheduleFacade·RoomFacade (facade→facade)**: **F1 = ARCHITECTURE EX-13 인정**(read enrichment). 위반 아님.
- **messaging/agent facade docstring**: 정보성(비자명 제약: "발송 클라 프로세스 싱글톤"·"턴 영속 브리지") → keeper(M2 기준).

## 기계적 (비파괴)

- **비-Facade 데이터클래스 2개** `SessionWithParticipants`(assessment_session_facade)·`CounselingSessionWithParticipants`(counseling_session_facade) → **schemas.py 이동**(facade 파일은 부적절, schema.md §4).

---

## 5-1. pipeline_facade 상태머신 인라인 (1번) `[설계완료]`

`prepare_transcribe/refine/summary/diarize/note` 5메서드가 동일 골격 복붙 + facade에 도메인 규칙 인라인. 세 조각으로 정확히 분해:

| 조각 | 성격 | 내용 |
|------|------|------|
| **P1** 상태머신 → Service | **behavioral** | 상태 전이 가드("전사 끝나야 보정"·"진행중이면 거부")를 facade→Service로. rule: facade=얇은 조립 |
| **P2** 5복붙 → step 테이블 | behavioral(P1 내) | 골격 5회 반복, 가드·메시지만 차이 → `STEP_DEFS` 테이블 1개 |
| **P3** `_with_response` 오칭 | **naming** | 5개가 Response 아닌 `_step_response` dict 반환 → `_with_response` 뗌 |

**목표 설계:**
```python
# field_note/pipeline/services/prepare_pipeline_step.py
STEP_DEFS = {
  "transcribe": StepDef(require=[("status", COMPLETED)],
                        reject_if={"transcribe_status": PROCESSING},
                        target={"transcribe_status": PROCESSING, "processing_status": PROCESSING, "processing_step": "transcribing"}),
  "refine":     StepDef(require=[("transcribe_status", COMPLETED)],
                        reject_if={"refine_status": PROCESSING}, target={"refine_status": PROCESSING}),
  "diarize":    StepDef(require=[("transcribe_status", COMPLETED)],
                        reject_if={"diarization_status": (COMPLETED, PROCESSING)}, target={"diarization_status": PROCESSING}),
  "summary":    StepDef(require=[("status", COMPLETED), ("transcribe_status", COMPLETED)],
                        reject_if={"summary_status": GENERATING→PROCESSING}, target={"summary_status": ...}),
  "note":       StepDef(require=[("status", COMPLETED), ("schedule_id", NOT_NULL), ("transcribe_status", COMPLETED)],
                        reject_if={"note_status": PROCESSING}, target={"note_status": ...}, extra=template_type 검증),
}
class PreparePipelineStepService:
    async def execute(self, *, field_note_id, center_id, step: PipelineStep) -> StepResult:
        # load → verify(STEP_DEFS[step]) → transition → StepResult
```
- facade `prepare_*` 5메서드 → **얇아짐**(Service 위임) 또는 **1개**(step 인자). 로직 0.
- 반환 = `StepResult`(계산 Result DTO — status/step/message, Response 아님, [schema.md](../../rules/api/schema.md) §4) → `_with_response` 이름 제거. 진짜 Response 내는 `prepare_summary_with_response`·`start_pipeline_with_response`만 그 이름 유지.
- **③/2-A 연계**: 가드·전이가 status 값(`completed`/`processing`) 사용 → Enum 전환과 같은 슬라이스에서 `PipelineStatus.COMPLETED` 등으로.
- **note step 비대칭**: schedule_id 필수 + template_type 검증이 추가 → StepDef에 `require`(schedule_id NOT_NULL) + `extra` 훅. 테이블이 못 담는 특례는 훅으로.

**실행 분류(정확히):**
- P1·P2 = **behavioral 슬라이스** — pipeline 상태 전이 characterization 테스트(각 step: precondition 거부·중복 거부·정상 전이) 작성 후 추출. 크기 문제 아니라 "테스트 동반"이 정확한 분류.
- P3 = naming, P1 슬라이스에서 자연 해소(dict 반환 메서드 이름 정정).

## 5-2. task_facade 로직 인라인 (2번) `[설계완료]`

`_sync_case_status`([:219-263](../../../apps/api/app/modules/assessment/facade/task_facade.py#L219-L263))가 task들 status를 세어 케이스 status 파생 후 저장. **두 안티패턴 중첩** — 1번보다 무거움.

| 조각 | 성격 | 내용 |
|------|------|------|
| **P1** status 파생 40줄 → Service | behavioral | rollup 상태머신(completed==total→completed, 종합보고서 없으면 processing 유지, all_finished&completed==0→cancelled...)이 facade 인라인 |
| **P2** Model mutate+flush → repo update | **behavioral(별개 위반)** | `case.status=...; case.completed_at=utc_now(); flush()` = repo §10 위반(로드 Model mutate). → `case_repo.update_in_center(primitive)` |
| **P3** `list_linkable_tasks` bulk 집계 → repo/Service | behavioral | 필터+assessment캐시+case매핑+session/schedule 루프+dict 조립이 facade에. → repo JOIN(소유모듈 §6) 또는 Service |
| **P4** `get_task` 인라인 scope-raise | 거의 기계적 | `if task.center_id != center_id: raise` → repo `get_in_center`(계층3 `_get`) |

**목표 설계:**
```python
class SyncCaseStatusService:
    async def execute(self, *, center_id, case_id) -> None:
        case = await self.case_repo.get_in_center(id=case_id, center_id=center_id)
        tasks = await self.task_repo.list_by_case(case_id=case_id)
        new_status, completed_at = self._derive(case, tasks)     # 상태머신(순수)
        if new_status != case.status:
            await self.case_repo.update_in_center(               # P2 해소: primitive
                id=case_id, center_id=center_id, status=new_status, completed_at=completed_at,
            )
```
- facade `_sync_case_status` → Service 호출로 대체(로직 0). `list_linkable_tasks` 집계 → repo JOIN. `get_task` → repo scoped get.
- **2-A 연계**: case status(`completed`/`processing`/`cancelled`/`pending`) = 도메인 생명주기(③ 값변경 제외) but Enum화 대상 = `CaseStatus`.

**실행 분류:** P1+P2 = behavioral 슬라이스(status 파생 characterization 테스트, P2는 저장방식 변경이라 테스트 필수) · P3 = repo JOIN 이동+테스트 · P4 = 계층3 `_get` 흡수.

## 5-3. counseling_session_facade (3번) `[설계완료]`

909줄이나 새 패턴 없음 — 5-4 패턴의 재발 + 경계 케이스.
- **P1 = 5-4 사례**: `case.total_sessions = total; flush()` ×2([:146](../../../apps/api/app/modules/counseling/facade/counseling_session_facade.py#L146)·[:241](../../../apps/api/app/modules/counseling/facade/counseling_session_facade.py#L241)) — create/delete_session의 비정규화 카운터 동기화. → `case_repo.update_in_center(total_sessions=)`.
- **경계(keeper)**: `find_today_sessions_per_client`·`find_latest_unlogged_per_client` 등 read 집계 = 자기모듈 데이터, 크로스모듈(schedule)은 application handler가 주입 → facade→facade 아님, read-shaping acceptable.
- **기계적**: `CounselingSessionWithParticipants` → schemas.py.

## 5-4. facade가 로드 Model mutate + flush (전 facade 공통 패턴) `[설계완료]`

**패턴**: facade가 로드된 Model 필드를 직접 바꾸고 `flush()`로 저장 — `case.total_sessions = x; flush()`(counseling ×2)·`case.status = x; flush()`(task_facade P2). **repo §10 위반**(service/facade는 로드 Model mutate 금지, primitive `update_in_center`).
- **rule-확정**(모호 아님): 전부 `repo.update_in_center(id, center_id, {field}=value)` primitive로.
- **범위 = 8 facade (예외 sweep 2026-07-04로 +2)**:
  | facade | mutate | 대체 |
  |--------|--------|------|
  | task_facade | `case.status = ` | update_in_center |
  | counseling_session | `case.total_sessions = ` ×2 | update_in_center |
  | assessment_session | `for s: s.status = "scheduled"; flush()` (bulk) | repo bulk update |
  | document | `document.storage_path = final_path` | update |
  | auth | `account.token_version += 1; account_repo._session.flush()` | **repo `increment_token_version`** (+ `_session` private 접근 제거) |
  | credit | `balance.credit_used = 0 / +=` | repo `increment_*`/update(원자적) |
  | **form_template** | `extraction.status = STARTED/FAILED`([:62,79](../../../apps/api/app/modules/form/facade/form_template_facade.py#L62)) | update |
  | **voucher** | `extraction.status = STARTED/FAILED`([:103,119](../../../apps/api/app/modules/voucher/facade/voucher_facade.py#L103)) | update |
- **legitimate flush(keeper)**: profile(remove 후)·schedule(add 후) = repo-op 후 flush, mutate 아님.
- **auth 특기**: `repo._session.flush()` = repo private 세션 직접 접근 = 추가 캡슐화 위반 → repo 메서드로.
- service에도 같은 패턴 있으면 동일 적용(계층 4 경계와 정합).

## 5-5. 나머지 (4번) `[설계완료]` — keeper/기계적
- agent facade tx/commit·context `__init__` = P3 브리지 keeper. messaging/agent docstring = 정보성 keeper. → 재작업 없음.

## 5-6. facade가 Service 없이 repo 직접 호출 `[설계완료]` (사용자 2026-07-02)

facade가 pure 패스스루 read를 repo 직접 호출(로직 0, 한 줄 위임) — messaging 다수·voucher·subscription·llm·notice·notification. 예: `get_delivery_history` → `repo.list_by_send_link_id`.
- **결정(사용자): 엄격 — 모든 facade 메서드는 Service 경유.** pure read도 Service 래퍼(facade.md §1 "uow.repo + Service" 그대로 강제, 완화 아님).
- direct-repo read(~35 호출: voucher 15·llm 8·subscription 6·messaging 4·notice/notification 각 1)를 `{Verb}{Noun}Service`로 래핑. 한 줄짜리라도 use-case로 명명.
- 멀티스텝 assembly 내 direct read(voucher_facade 루프 등)는 그 조립까지 Service로(facade 얇게).
- 파괴성: 비파괴(Service 신설 + facade가 Service 호출로, 반환·소비처 동일).

## 실행 워크리스트 갱신 — 5-6 추가
| 5-6 direct-repo → Service | ~35 facade read 호출을 Service 래핑(pure read 포함) | 비파괴(Service 신설) |

---

## 실행 워크리스트 (계층 5)

| 작업 | 대상 | 파괴성 |
|------|------|:-----:|
| 5-1 pipeline 상태머신 → Service | field_note pipeline_facade 5 prepare_* → PreparePipelineStepService + STEP_DEFS + StepResult, `_with_response` 오칭 제거 | **behavioral**(characterization 테스트) |
| 5-2 task_facade 로직 → Service/repo | `_sync_case_status`→SyncCaseStatusService(+P2 update) · list_linkable_tasks→repo JOIN · get_task→`_get` | **behavioral**(테스트) |
| 5-4 Model mutate+flush → repo update | task_facade·counseling ×2 확정 + 나머지 facade 파일별 판별 | behavioral(테스트) |
| 기계적 | 데이터클래스 2개(→schemas) | 비파괴 |
| keeper | agent P3·EX-13·정보성 docstring | 무변경 |

**분류 요약**: 이 계층은 순수 스타일이 아니라 **로직 이동(behavioral)** 이 핵심 — pipeline 상태머신·case status 파생·Model mutate. 전부 characterization 테스트 동반 슬라이스. facade 순수성(얇은 조립) 회복이 목표.
