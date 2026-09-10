# API 리팩토링 E2E 결과 — 2026-06-30

리팩토링 이전 도메인 동작을 기준(ground truth)으로 한 E2E를 리팩토링된 코드에 실행한 결과.
실행: `bash scripts/run_e2e.sh` (DB=`imomtae_test`, seed 후 ASGI 인메모리 호출).

- 기준선(00–05)은 리팩토링 이전 커밋(HEAD)에 들어 있던 E2E — 이전 도메인 기대를 인코딩.
- 06–09는 리팩토링 중 추가됨(미추적). 10은 본 작업에서 추가한 이벤팅 회귀 프로브.

## 총평

**27 passed / 6 failed (33 tests).** 6건의 실패는 전부 **하나의 근본 원인 = 미완의 eventing/behavior 이행**이며, 두 표면으로 나타난다. 도메인 로직 자체의 회귀가 아니라 **이벤트 배선(wiring) 누락**이다. 읽기·인증·admin 표면·이미 배선된 쓰기(`client/profile`)는 모두 통과.

## 실패 6건 → 근본 원인 2계열

### 계열 A — emit 라우터에 `start_event_group()` 미배선 (4건 중 3 e2e)

`emit()`은 `event_group_id: uuid_str`(=str)을 요구한다. 이 값은 라우터가 `behavior.request(... start_event_group() ...)`을 선언했을 때만 `ctx.event_group_id`에 채워진다. 선언이 없으면 None → 핸들러의 `emit(...)`이 `app/core/type.py:52`의 `@typecheck`에 걸려 `DevelopError` → 500.

- `tests/e2e/test_02 ::test_create_family_with_relations_flow` — `POST /clients/{id}/relations` (`client/relation/router.py` 미배선)
- `tests/e2e/test_03 ::test_schedule_create_and_conflict_flow` — `POST /schedules`
- `tests/e2e/test_10 ::test_probe_create_room_eventing_regression` — `POST /rooms` (`center/room/router.py` 미배선)

**대조군(통과)**: `test_10 ::test_control_create_client_emits_ok` — `client/profile/router.py`는 `start_event_group()`+`dispatch_events()` 배선됨 → 201. `test_10 ::test_control_create_program_ok` — application 핸들러 경로가 emit하지 않아 201. → 원인이 "이벤팅 설계"가 아니라 "라우터별 배선 누락"임을 동적으로 격리.

**브레드스(정적 전수)**: `emit()` 호출처 약 95곳(거의 모든 모듈) vs `start_event_group()` 선언 라우터 **3개뿐**(`agent/conversation`, `client/profile`, `module_for_test/widget`). 즉 이 세 라우터 밖의 **emit하는 모든 쓰기 엔드포인트가 동일하게 깨진 상태**다. E2E가 커버하는 건 그중 일부일 뿐 — 실제 회귀 면적은 훨씬 넓다.

### 계열 B — `create_schedule_with_conflicts` 파사드 arity 불일치 (3건)

`CreateScheduleService.execute`가 eventing 관례대로 **3-튜플 `(ScheduleAtomic, Schedule, list[Schedule])`**을 반환하도록 바뀌었으나(`schedule/schedule/services/create_schedule.py:50`), 파사드 `create_schedule_with_conflicts`는 그 결과를 **그대로 pass-through하면서 반환타입은 여전히 `tuple[Schedule, list[Schedule]]`로 선언**(`schedule/facade/schedule_facade.py:184`). 이를 소비하는 크로스모듈 application 핸들러가 `schedule, conflicts = await ...`로 **2개만 언팩** → `ValueError: too many values to unpack (expected 2)`.

- `tests/e2e/test_04 ::test_individual_assessment_full_flow` — `application/handlers/assessment/create_individual.py:76`
- `tests/e2e/test_05 ::test_counseling_intake_full_flow` — `application/handlers/counseling/create_case_with_sessions.py:176`
- `tests/e2e/test_05 ::test_counseling_intake_requires_write_permission` — 동일 지점

## 통과로 확인된 보존 동작 (27건 발췌)

- 인증/권한 경계: 로그인, 토큰 가드, 비멤버 차단, counselor 초대 거부 등 (`test_00`, `test_01`)
- 읽기·시드 정합: seed 가족관계/내담자 조회, 중복검사, 소프트삭제, 주보호자 삭제 금지 (`test_02`)
- 입력 검증 경계: 일정 end<start 거부, 잘못된 assessment 거부 (`test_03`, `test_04`)
- admin 표면 전체: 바우처 CRUD, 센터신청 승인/반려, form/voucher 추출 확정 플로우 (`test_06`–`test_09`)
- 배선된 쓰기: `create_client`(이벤트 emit 정상) (`test_10` 대조군)

## 수정 방향 (참고 — 도메인=이전 기준, 구조=리팩토링 기준)

본 작업은 **결과 정리**까지이며 수정은 미적용. 방향만 기록:

- **계열 A**: emit하는 각 라우터의 `behavior.request(...)`에 `start_event_group()`(+커밋후 `dispatch_events()`)을 선언. 정본 패턴은 `client/profile/router.py`와 `.claude/rules/api/behavior.md` §5. 약 90여 엔드포인트 전수 점검 필요.
- **계열 B**: `eventing.md` §4 "facade는 pass-through". `create_schedule_with_conflicts`의 반환타입을 3-튜플로 맞추고, 소비 application 핸들러(`create_individual`, `create_case_with_sessions`)가 `atomic`을 수집해 자신의 그룹 `emit`에 포함 + 해당 라우터에 `start_event_group()` 배선.

## 재현

```bash
cd apps/api
bash scripts/run_e2e.sh -q                       # 전체
bash scripts/run_e2e.sh -k eventing_regression   # 계열 A 격리(프로브)
```
