# 세션 종합 기록 + 의사결정 원장 (2026-06-30)

브랜치 `tmp-new-refactor-module-v4`. 리팩토링(Router→Handler→Facade→Service→Repository 재구성 +
behavior 인증/tx + eventing outbox) 반영 직전 마지막 검증 세션. **이 문서 하나로 한 일 전부 +
결정 필요한 것 전부**를 처음부터 끝까지 정리한다. (전 스위트 41 passed, migration drift 없음.)

---

# PART 1. 이 세션에서 한 일 (처음부터 끝까지)

## 1.1 머지 충돌 해결 — `stash → pull origin main → stash pop` (충돌 7건)

stash pop 시 7개 파일 충돌. 각 해결:

| # | 파일 | 충돌 | 해결 |
|---|---|---|---|
| 1 | `application/handlers/field_note/__init__.py` | `__all__` 목록 | import 블록이 9개 핸들러 전부 import → `__all__`도 9개 union |
| 2 | `application/handlers/schedule/list_schedules.py` | `session_id` 정의 | upstream의 `session_id` 정의 유지(생성자에서 사용 — 없으면 NameError) |
| 3 | `modules/assessment/assessment_case/repository.py` | 메서드 재구조화 | 리팩토링판(`list_in_center_with_page`/`_build_conditions`/`next_case_code`) 채택 + main의 **담당자 다중선택 `.split(",")`** 이식 |
| 4 | `modules/center/facade/member_facade.py` | import | `resolve_member_default_avatar`(upstream)+`MemberAtomic`(stash) 유지, 중복 `Member` import 제거 |
| 5 | `modules/center/member/services/create_member_from_invitation.py` | `create(dict)` vs `add()` | 리팩토링판 `repo.add()` 채택 + main의 **`profile_image_url`(기본 아바타)** 이식. 동반: member `repository.add`에 `profile_image_url` 파라미터 추가 |
| 6 | `modules/field_note/field_note/router.py` | import 2 + 라우트 1 | 리팩토링판 채택(`create_field_note_handler` application으로 이동, `get_field_note_detail_handler` 사용), 미사용 `get_uow`/`UnitOfWork` 제거 |
| 7 | `modules/schedule/schemas.py` | deleted by them | 삭제 수용(`schedule/schedule/schemas.py`로 이동) + main의 **`session_id` 필드**를 새 위치 `ScheduleListItem`에 이식 |

> 이식한 upstream 기능 3개(리팩토링과 충돌해 수동 보존): 담당자 다중선택 / 멤버 기본 아바타 / 홈카드 회기 직접이동(session_id).
> **미해결 잔여: `stash@{0}`가 자동 삭제 안 돼 그대로 남음(D-2).**

## 1.2 발견·수정한 회귀 (명백 — 앱/워커/테스트가 100% 깨졌거나 레이어 모순)

검증을 돌리는 과정에서 드러난 치명적 결함. "당연한 것만" 수정 원칙으로 처리.

| # | 회귀 | 근본 원인 | 수정 | 검증 |
|---|---|---|---|---|
| R-1 | **앱 import 실패(순환 import)** | `modules/field_note/field_note/handlers/get_field_note.py`가 application 패키지를 초기화 도중 import → `get_field_note_detail_handler` 미바인드 → `app.main` ImportError(앱 100% 다운) | 구체 서브모듈 경로(`...get_field_note_detail`)에서 직접 import | 앱 정상 기동(432 paths/580 endpoints) |
| R-2 | **이벤트 워커 100% 깨짐** | `modules/event/event/repository.py`의 `func.make_interval(secs=...)` ×3 — SQLAlchemy `func`는 kwarg 거부 → statement 빌드 TypeError → claim/fail/claim_stale(sweeper) 전부 실패 | positional `make_interval(0,0,0,0,0,0,N)` | 라이브 DB로 렌더 확인 + test_13 소비경로 통과 |
| R-3 | **`GET /clients/with-relations` 매 호출 500** | 응답 스키마 `ClientWithRelationsSummary.code: str`(피처 a1414481가 모델 nullable=False+스키마에 추가)인데 `profile_facade.py` 빌더만 `code` 누락 | 빌더에 `code=client.code` 추가 | endpoint_health read 5xx=0 |
| R-4 | **전 pytest collection 불가** | `module_for_test`(이벤트 reaction pilot) + `application/reactions/{auto_tag_widget,verify_widget}.py`가 워킹트리에서 삭제됐는데 `tests/conftest.py`·`application/events/dispatch.py`가 여전히 import (미완성·미커밋 삭제) | 삭제분을 HEAD에서 복구(스코프 한정) | 전 테스트 수집 정상 |

> R-4는 "복구"라는 임의 판단이 들어감 → **삭제 의도였는지 확인 필요(B)**.

## 1.3 추가한 검증 테스트 (3개 파일)

### `test_13_eventing_outbox.py` — 이벤트 구조 양성 검증 (4)
실제 HTTP 쓰기 → outbox 테이블 직접 조회 단언.
- `test_wired_write_persists_event_and_atomic`: `POST /clients/` → `events`('client_created')+`event_atomics`(entity=client, act=created, seq=0, payload.data) 같은 tx 적재.
- `test_batch_write_groups_atomics_under_one_event`: 배치 → atomic 다건이 한 event_group, seq 0..N-1 연속.
- `test_read_does_not_emit`: GET은 events 행 수 불변.
- `test_dispatch_lifecycle_marks_event_succeeded`: worker(`use_event_action` claim→`dispatch`→succeed)가 pending→succeeded.

### `test_14_endpoint_health.py` — 전 엔드포인트 헬스 스윕 (1, 350 probe)
`/api/v1` 전 메서드 호출. **GET 5xx=0 하드 게이트.** 쓰기는 center_id만 실제값+DUMMY id+빈body로 변이 차단. 결과: read 5xx=0, write 계약갭 1(F-1), skip 42.

### `test_15_emit_wiring.py` — 쓰기 emit 배선 검증 (1, 12 probe)
실제 최소 생성 → 2xx(=emit 통과)로 "발행하는데 미배선 → 500" 회귀를 flow 미커버 모듈로 확장. **12 probe 전부 2xx, emit_wiring_5xx=0.** 검증: room·member_invitation·member_non_working_time·center_non_operating_time·role(admin)·message_template·form_template·price_list·assessment_set·assessment_package·center_assessment(bulk)·counseling_note.

## 1.4 최종 실행

```
bash scripts/run_e2e.sh                         → 41 passed (0:01:01)
.venv/bin/python scripts/check_migration_drift.py → 드리프트 없음 ✅
```
산출 리포트: `_emit_wiring_report.md` · `_endpoint_health_report.md` · `_pure_sweep_report.md` · `_app_sweep_report.json`.
상세: [RESULTS-eventing-and-endpoints-2026-06-30.md](RESULTS-eventing-and-endpoints-2026-06-30.md).

---

# PART 2. 의사결정 원장 (전부 — 빠짐없이)

각 항목: 성격 · 근거 · 옵션 · 권고 · 상태.

## A. 코드 버그지만 "어느 레이어가 정답이냐" 결정 필요

### A-1 (F-1) · `POST /assessment-cases/{id}/assessment-sessions` 빈 body 500
- 근거: 요청 스키마·서비스 = `schedule_id: str | None`(선택) / DB(`nullable=False`)·repo `@typecheck`(`uuid_str`) = 필수 → None이면 DevelopError(500).
- 핵심 질문: **검사 세션이 일정 없이 생성될 수 있나?**
- 옵션: (a) 스키마 `schedule_id: str` 필수화 → 빈 body=422 (1줄, 유효호출 무영향). (b) 진짜 선택이면 모델 nullable=True 마이그레이션+repo `| None`(범위 큼).
- 권고: **(a)** (DB가 nullable=False라 "필수"가 사실).
- 상태: 미수정(기록만).

### A-2 (F-2) · `GET /admin/ai-usage/calls` 500
- 근거: 응답 `LlmCallItem.session_id: str`인데 실데이터 None. **R-3(clients/with-relations)과 동일 클래스.**
- 옵션: `session_id: str | None`로 완화(1줄).
- 권고: 적용(R-3와 같은 판단). 상태: 미수정(일괄결정 지시로 보류).

### A-3 (F-3) · `GET /schema` 500
- 근거: OpenAPI 뷰어 static(`/docs/schema-viewer.html`) 부재. **도메인 API 아님, 코드 회귀 아님(환경).**
- 옵션: 파일 동봉 / 없으면 404 가드 / 그대로 둠. 권고: 그대로 둬도 무방. 상태: 미수정.

## B. 삭제 의도 확인 (R-4 — 내가 임의 복구)
- 근거: `module_for_test`+widget reactions가 워킹트리 삭제돼 있었으나 conftest/dispatch가 참조 → collection 불가라 HEAD 복구.
- 질문: **의도된 삭제였나?**
  - 아님(미완성) → 복구 유지(현재). 끝.
  - 맞음 → conftest model 등록 import + dispatch.py `EVENT_REACTIONS`(widget pilot)까지 제거해 완결. 단 등록 reaction 0개가 됨.
- 상태: 복구 적용됨(되돌리려면 결정 필요).

## C. 검증 커버리지 — 머지 전 더 볼지

### C-1 · emit 미-probe 2건
- `center_voucher`(e2e seed에 voucher 카탈로그 없음), `share_token`(document 멀티파트 업로드 선행). 코드 결함 아님(픽스처 한계). 결정: seed/픽스처 보강할지.

### C-2 · 워커 프로세스·실 도메인 reaction 미검증
- 이벤트는 outbox에 pending 적재, 소비는 테스트가 수동 구동(claim→succeed). 실제 LISTEN/NOTIFY 워커 루프·sweeper·실 reaction은 e2e 미실행. **등록 reaction은 widget pilot 2개뿐(실 도메인 반응 0, 부수효과는 핸들러 인라인).** 결정: 머지 기준이 "emit→outbox까지면 충분"인가, 워커+실반응 end-to-end도 봐야 하나.

### C-3 · emit 검증이 CREATE만 ⚠️
- test_15는 생성(*_created)만 2xx로 통과시킴. **수정(*_updated)·삭제(*_deleted)** emit 경로는 flow 테스트가 우연히 건드린 일부(client/case/schedule update) 외 **체계적 미검증.** room_updated/deleted·document_updated/deleted·voucher·form·template·role·message_template update/delete 등 다수. 같은 "미배선→500"이 update/delete에 남아있을 수 있음. 결정: test_15를 update/delete까지 확장할지.

### C-4 · 헬스 스윕에서 42개 쓰기 skip
- 안전상 비-center 쓰기(auth·자기계정) + resource-id 없는 파괴적 bulk 42건을 호출 안 함 → 미검증. 결정: 격리 픽스처로 검증할지.

### C-5 · eventing 내부 실패 경로 미검증
- happy-path(emit→outbox→claim→succeed)만. **실패→backoff→fail, `dispatch_events()` pg_notify, sweeper(claim_stale)** 미검증(make_interval만 고치고 동작 미실행). 결정: 후속 검증할지.

## D. 상태/프로세스

### D-1 · 전부 미커밋 ⚠️
- 직전 세션(1948 staged + 632 untracked) + 이번 세션(R-1~R-4 수정 4파일·테스트 3·문서 2·module_for_test 복구)이 **하나도 커밋 안 됨.** 결정: 커밋 시점·단위·메시지(web/api prefix 한글 규약).

### D-2 · 머지 충돌 stash 잔존
- `stash@{0}`(이 세션 첫 pop 충돌분)이 자동 삭제 안 돼 남음. 해결분은 워킹트리에 있어 중복 → drop 가능. 결정: drop 여부.

## E. 잔여 TODO / 위생 (참고)
- **E-1 quickLinks GAP**: 프론트 바로링크 미동작(`getAssessmentSendLinksByCenterId` → 백엔드 verification_code 설계와 불일치). 옵션 (a)백엔드 센터목록 신설 (b)프론트 재설계 (c)폐기. "필요없는 todo"라 하셨으나 기술적 미해결.
- **E-2 unit-suite 하네스 debt**: `pytest tests/unit` 풀 실행 6 errors(공유 fixture `_tables_created`+TRUNCATE 순서). 기능 무관.
- **E-3 test_10 전제 노후**: room을 "미배선=회귀(201 기대)"로 단언하는데 지금은 배선됨 — 통과하나 전제가 낡아 오해 소지.
- **E-4 `datetime.utcnow()` deprecation** 2곳(`get_client_signals.py`·`counseling/list_cases.py`). 경고만.

---

# PART 3. 우선순위 권고 (머지 직전 기준)

1. **D-1 커밋** — 모든 변경이 미커밋. 먼저 안전하게 묶기.
2. **C-3 update/delete emit 검증** — CREATE만 봤으므로 가장 큰 실질 갭. test_15 확장으로 닫을 수 있음.
3. **A-1·A-2 적용** — 각 1줄 명백 개선(F-1 (a), F-2 nullable).
4. **B 확정** — module_for_test 삭제 의도였는지.
5. **C-1/C-4/C-5, A-3, E-\*** — 후속(머지 후 가능).

> A·B 확정 + C-3 확장이면 "쓰기 emit 배선 + 알려진 500"이 사실상 다 닫힘. C-2(워커 end-to-end)·E는 머지 후 후속으로 두는 게 합리적.

---

# PART 4. 결정 실행 결과 (사용자 지시 반영)

전 스위트 **47 passed** (test_16 ×5, test_17 ×1 추가; test_15 CRUD로 확장). migration drift 없음.

| 항목 | 지시 | 실행 |
|---|---|---|
| **A-1** (F-1) | 일정 없이 가능 | 모델 `schedule_id nullable=True` + [마이그 b1d2e3f4a5c6](../../migrations/versions/b1d2e3f4a5c6_assessment_session_schedule_id_nullable.py) + repo.add `\| None`. ✅ |
| **A-2** (F-2) | 적용 | `LlmCallItem.session_id: str \| None`. ✅ |
| **A-3** (F-3) | 기능 제거 | [system.py](../../app/server/system.py) `schema_viewer` 라우트+미사용 import 삭제(432→431 paths). ✅ |
| **B** (R-4) | 의도된 삭제 | `module_for_test` 디렉토리 삭제 + conftest import 제거. (dispatch `EVENT_REACTIONS={}`·reactions 삭제는 이미 워킹트리 상태였음). ✅ |
| **C-1** | 없어도 됨 | 미-probe(center_voucher·share_token) 그대로 둠. |
| **C-2** | 검증 | [test_16](test_16_worker_lifecycle.py): claim→succeed·반응 fan-out·체크포인트·반응실패 격리(가짜 반응 주입). ✅ |
| **C-3** | 검증 | [test_15](test_15_emit_wiring.py) create→update→delete CRUD로 확장(28 probe). **F-4 신규 발견**(아래). ✅ |
| **C-4** | 검증 | [test_17](test_17_skipped_writes.py): skip된 42 쓰기 전부 호출, 5xx=0. ✅ |
| **C-5** | 검증 | [test_16](test_16_worker_lifecycle.py): fail+backoff·sweeper claim_stale. ✅ |
| **D-1** | 커밋 안 함 | 미커밋 유지. |
| **D-2** | 그냥 둠 | stash 잔존 유지. |
| **E** | 보류 | 미처리. |

## F-4 (C-3가 발견) → ✅ 해결
`PATCH /assessment-packages/{id}` 부분 body → 500. 근본: facade가 None-기본 kwarg로 pydantic을
재구성해 `exclude_unset` 무력화 → `is_active=None`이 repo(`bool = unset`)로. 적용: facade
service 호출을 `exclude_none=True`로(package·set 둘 다). False/0 보존, None=omit. test_15 28/28 2xx.

## 문서 드리프트 → ✅ 해결
`module_for_test` 삭제 후 잔존 참조 정리:
- 활성 규칙 5개([persistence-model](../../../.claude/rules/api/persistence-model.md)·schema·package-init·service·persistence-repository) — 레퍼런스 citation을 `activity_log`(실모듈)로 교체하거나 제거.
- [ARCHITECTURE.md](../../app/modules/ARCHITECTURE.md) — 레퍼런스 라인·모듈 카탈로그 행 제거.
- eventing @-import 문서(README·consume) — "워크드 레퍼런스=module_for_test"를 실코드(`app/modules/event`·`app/behavior`·`app/worker/event`·dispatch.py)로 교체 + 현재 reaction 0개 명시.
- loop 작업로그(api-refactor·behavior-migration·eventing-pass) — 레퍼런스 포인터 교체(역사적 체크박스는 유지).
- **코드 참조 0** 확인. 잔여: settings.local.json의 grep 허용 패턴 2줄(무해, 권한 config — 미수정), behavior-migration.md:103 역사적 완료 체크박스(로그라 유지).

## E (잔여 위생) — 진행
- **E-3** test_10 전제 노후 → ✅ [test_10](test_10_eventing_regression.py)을 "쓰기 라우터 emit 배선 sanity"로 재작성. "리팩토링 이전/회귀/미배선" 프레임 제거, room은 "배선됨 → 201" 양성 체크로 정정(3 passed).
- **E-4** `datetime.utcnow()` deprecation → ✅ 10개 호출처(8파일)를 `app.core.datetime_utils.utc_now()`로 일괄 치환. **헬퍼 필요성 확인**: DB가 naive UTC(`TIMESTAMP WITHOUT TIME ZONE`) 규약이라 표준 대체 `datetime.now(timezone.utc)`(aware)는 부적합 — `utc_now()`(naive)가 정답. drop-in(동작 동일), e2e 47 green, utcnow DeprecationWarning 소멸.
- **E-1** quickLinks GAP(프론트 제품 결정) · **E-2** unit 하네스 debt(공유 fixture, 풀 실행 9 errors=순서 의존 하네스) — 보류.
