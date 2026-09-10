# PURE 레이어 스윕 결과 — 의사결정용 (2026-06-30)

대상: PURE-LAYER-API-2026-06-30.md의 124개(흐름이 Router→Handler→Service→Repository).
하네스: tests/e2e/test_11_pure_layer_sweep.py + _pure_sweep_specs.py (견고 단일 루프, 호출별
try-wrap이라 한 건 실패가 루프를 멈추지 않음). 원자료: _pure_sweep_report.{md,json}.

## 집계 (refined run)

- 총 호출 **120**, ok **111**, server_error **6**, client(4xx) **3**, harness_error 0.
- server_error 6건 → **제품 회귀 3계열**. client 3건 → 전부 하네스측(제품 아님).
- (1차 run에서 나온 admin 403 22건/analysis 500 3건은 하네스 갭이라 보정 후 사라짐:
  super_admin 토큰 사용 + 지연등록 테이블 생성. 아래 "하네스 보정" 참고.)

---

## 제품 회귀 (수정 후보) — 6 엔드포인트 / 3 계열

### 계열 A — emit 라우터에 start_event_group() 미배선 (4건)
`event_group_id: <class 'str'> 필요 (실제: NoneType)` — 기존 RESULTS 문서의 계열 A와 동일 근본원인.
- POST `/centers/{cid}/clients/{client_id}/relations` (relation_create)
- POST `/centers/{cid}/clients/link-requests` (link_request_create)
- PATCH `/centers/{cid}/center-assessments/{assessment_id}` (center_assessment_update)
- POST `/centers/{cid}/counseling/cases/{case_id}/analysis/` (analysis_create)

수정 방향: 각 라우터 `behavior.request(...)`에 `start_event_group()`(+커밋후 `dispatch_events()`).
정본 = client/profile/router.py. (전체 계열 A 면적은 ~90 라우터, RESULTS 문서 참고 — 여기선 그중 4개가 PURE에서 실측됨.)

### 계열 C — assessment 세션 repo가 schedule_id=None 거부 (1건, 신규)
- POST `/centers/{cid}/assessment-cases/{case_id}/assessment-sessions` (session_create)
- 본문: `schedule_id: <class 'str'> 필요 (실제: NoneType)`
- 원인: [assessment_session/repository.py:24](apps/api/app/modules/assessment/assessment_session/repository.py#L24) `add(..., schedule_id: uuid_str, ...)` — 비대면(online) 세션은 schedule이 없어 None인데 `add`의 타입이 비옵셔널 `uuid_str` → @typecheck 거부. (column은 nullable, 같은 파일 line 96은 `uuid_str | None`로 이미 옵셔널.)
- 수정 방향(도메인=이전 기준): `add`의 `schedule_id`를 `uuid_str | None = None`로. 단순 1줄. 무결정.

### 계열 D — field-note 오디오 업로드가 dispatcher를 잘못 호출 (1건, 신규)
- POST `/centers/{cid}/field-notes/{field_note_id}/audio` (fn_audio_upload)
- 본문: `get_task_dispatcher() missing 1 required positional argument: 'background_tasks'`
- 원인: [infrastructure/worker/factory.py:11](apps/api/app/infrastructure/worker/factory.py#L11) `get_task_dispatcher(background_tasks)`로 시그니처가 바뀌었는데, 오디오 경로의 호출처가 인자 없이 직접 호출(Depends 주입 아님 → conftest override도 안 먹음). 호출처 정확 위치는 수정 전 1회 trace 필요.
- 수정 방향: 호출처가 `background_tasks`를 전달하도록(또는 Depends 주입 경로로). 호출처 확인 후 결정.

---

## 하네스측(제품 아님) — 참고만

- person_update PUT 401: PUT /persons/{id}는 admin 토큰 비수용(self/center auth) — 하네스 헤더 불일치.
- fn_finish 422: finish 바디 스키마 미공급(하네스 바디 누락).
- pipeline_reload_vectors 422: 파일 업로드 필요(하네스가 빈 바디).
- (보정 완료) counseling_case_analyses 테이블 없음 → **제품 아님**. 모델이 지연 import(라우터 함수 내 import)라 conftest `create_all` 시점 미등록 → e2e DB에 테이블 누락. 프로덕션은 마이그레이션 `a3f2e7b8c910`이 생성하므로 정상. 하네스에서 모델 명시 import 후 create_all 재실행으로 해소.

---

## 하네스 보정 내역(제품 코드 미수정)

1차 run 35개 4xx의 대부분은 하네스 갭이었고 다음으로 보정:
- /admin/* 403 대량 → admin(role=admin) 토큰을 super_admin(imomtae@insighter.co.kr)로 교체.
- persons/role-permissions 401 → admin 토큰 헤더로 라우팅.
- share-token/upload/field-note-statuses 422 → 필요한 query/form 파라미터(center_id·category·entity_id·schedule_ids·duration) 공급.
- counseling analysis 500(테이블 없음) → 지연등록 모델 import + create_all.

재현: `bash scripts/run_e2e.sh -k pure_layer_sweep -s`

---

## 수정 결과 (2026-06-30, 배치 결정 후)

승인: 계열 A(전체) + C + D. 수정 후 PURE 스윕 **server_error 6 → 1**, 전체 e2e **6 fail → 3 fail**.

- **계열 A — 적용 완료**. `event_group_id=ctx.event_group_id`를 넘기는 라우터 엔드포인트(34개 라우터, ~73개 엔드포인트)에 `start_event_group()`+`dispatch_events()` 배선. relation/link_request/center_assessment_update/analysis_create 등 모두 200대로 통과. (검증: 5 codemod 에이전트, 엔드포인트당 event_group_id 1:1 매칭, py_compile green.)
- **계열 D — field_note만 적용 완료**. audio_upload·finish_recording을 `Depends(get_task_dispatcher)` 주입으로(직접 호출 제거 → conftest override도 동작). **잔여**: 동일 버그가 `field_note/pipeline/router.py`(7), `ai_lab/feature_test/router.py`(4)에도 있음 — 사용자가 D를 "field-note 한정"으로 지정해 미적용. 후속 결정 필요.
- **계열 C — 취소(revert)**. 재조사 결과 회귀 아님: 모델 `schedule_id`는 pre/post 모두 `nullable=False`(필수). 리팩토링의 `@typecheck schedule_id: uuid_str`가 오히려 정확. 1차 500은 **하네스가 `schedule_id=None`(무효 입력)을 보낸 것**이 원인. repo 변경 되돌리고 하네스 바디를 유효 값으로 교정. (잔여 관찰: 요청 스키마는 `str | None`인데 컬럼은 NOT NULL → None 입력 시 422 아닌 500. pre-existing, 회귀 아님. 스키마를 required로 좁히는 개선은 별도 판단.)

## 잔여(미승인/신규) — 후속 결정 대상

- **계열 B** (3 flow 실패, 미승인): `create_schedule_with_conflicts` 파사드가 3-튜플 반환인데 호출처 5곳이 2-튜플 언팩. test_04/test_05. 수정 방향은 RESULTS 문서 참고.
- **계열 D 잔여 11곳**: pipeline(7)+feature_test(4) 동일 `get_task_dispatcher()` 오호출.
- **신규**: `GET /api/v1/admin/ai-usage/calls` → `LlmCallItem` 응답검증 500(session_id/tokens 등 null). admin 표면이 super_admin 토큰으로 도달 가능해지며 노출. 회귀 여부 미확인.
