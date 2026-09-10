# E2E 결과 — 이벤트 구조 + 전 엔드포인트 검증 (2026-06-30)

브랜치 `tmp-new-refactor-module-v4`. 리팩토링(Router→Handler→Facade→Service→Repository 재구성 +
behavior 인증/tx + eventing outbox) 이후, **추가된 이벤트 구조가 동작하는지**와 **모든 엔드포인트가
의도대로 동작하는지**를 검증하는 e2e를 구현하고 한 번에 실행한 기록.

## 최종 실행

```
bash scripts/run_e2e.sh        # *_test DB 강제, 세션 1회 reset+seed
→ 47 passed (0:01:10)
```

신규 5개 파일 포함 전 스위트 GREEN. 결정(A~E) 실행 결과는 [SESSION-LEDGER-2026-06-30.md](SESSION-LEDGER-2026-06-30.md) PART 4.

> **갱신(결정 실행 후):** F-1·F-2 수정됨, F-3 기능 제거됨. 신규 테스트 test_16(워커 라이프사이클),
> test_17(skip 쓰기 42), test_15 확장(update/delete CRUD) 추가. test_15 확장이 **F-4(신규)**
> 를 발견 — 아래 §3 참조.

---

## 1. 추가한 테스트

### `test_13_eventing_outbox.py` — 이벤트 구조 양성 검증 (4)
실제 HTTP 쓰기를 보내고 outbox 테이블을 직접 조회해 단언한다.

| 테스트 | 검증 내용 |
|---|---|
| `test_wired_write_persists_event_and_atomic` | `POST /clients/` → `events`('client_created') 1행 + `event_atomics` 1행(entity_name=client, act=created, entity_id=생성 id, sequence=0, payload.data). emit이 비즈데이터와 **같은 tx**로 적재됨을 증명. |
| `test_batch_write_groups_atomics_under_one_event` | 배치 등록(보호자+자녀+관계) → atomic 다건이 **한 event_group_id** 아래로, sequence 0..N-1 연속. |
| `test_read_does_not_emit` | GET(읽기)은 `events` 행 수 불변 — 읽기는 이벤트를 만들지 않음. |
| `test_dispatch_lifecycle_marks_event_succeeded` | worker 소비 경로(`use_event_action` claim → `dispatch` → succeed)가 pending → **succeeded**로 종결. |

결론: **emit→outbox(events+event_atomics)→consume(claim/succeed) 경로가 동작함을 확인.** 반응(reaction)은
현재 pilot(widget) 2개만 등록돼 있고 실도메인 이벤트엔 반응이 없어 dispatch가 즉시 succeed(설계대로).

### `test_14_endpoint_health.py` — 전 엔드포인트 헬스 스윕 (1)
OpenAPI의 `/api/v1` 모든 메서드를 호출(이번 실행 350건). 안전 가드로 시드 훼손 없이 라우트 도달성·배선을 확인.

- **읽기(GET) 5xx = 0** 하드 게이트 (이번 실행 통과).
- 쓰기: center_id만 실제값, 그 외 path id는 DUMMY로 채워 변이 전 404/422 차단. body `{}`.
  비-center 쓰기/파괴적 bulk(42건)는 skip(세션 계정·시드 보호).
- 쓰기 5xx는 "계약 갭 findings"로 분류(빈-body가 surface한 것이라 일괄 결정 대상 — 아래 §3).
- 리포트: `_endpoint_health_report.md` / `.json`.

### `test_15_emit_wiring.py` — 쓰기 emit 배선 검증 (1, 12 probe)
test_14 스윕은 빈-body/DUMMY-id라 emit 도달 전 404/422로 끊긴다. 여기선 **실제 최소 생성 →
2xx(=emit 통과)** 로, "라우터가 emit하는데 start_event_group() 미배선 → 성공 쓰기에서 500"
회귀(test_10 경고 클래스)를 flow 테스트가 안 건드린 발행 모듈로 확장 검증.

- 결과: **12 probe 전부 2xx — emit_wiring_5xx=0, unreached=0.** 즉 검증한 12개 쓰기-발행
  라우터 모두 emit 경로가 정상 배선됨.
- 검증된 모듈(이벤트): room(room_created) · member_invitation(member_invitation_created) ·
  member_non_working_time · center_non_operating_time(non_operating_time_created) ·
  role(role_created, admin 권한) · message_template · form_template · price_list ·
  assessment_set · assessment_package · center_assessment(bulk, _updated) · counseling_note.
- 미-probe(시드 부재 — 추후 보강 대상): **center_voucher**(e2e seed에 voucher 카탈로그 없음),
  **share_token**(멀티파트 document 업로드 선행 필요). 둘 다 코드 결함이 아니라 픽스처 한계.
- 리포트: `_emit_wiring_report.md` / `.json`.

> flow 테스트(test_02~09)+test_13이 이미 커버한 발행 쓰기(client·relation·schedule·
> assessment-case/session·counseling intake/session·voucher/form 추출)와 합쳐, **주요 쓰기
> 라우터의 emit 성공 경로가 폭넓게 검증됨** — "쓰기 emit 배선이 부분만 검증됨" 갭이 해소됨.

---

## 2. 발견 + 수정한 회귀 (명백 — 코드가 모순이거나 100% 깨짐)

> 판단 기준: "앱이 안 뜨거나, 기능이 100% 깨졌거나, 레이어가 명백히 모순"인 것만 수정. 추측성 개선·디자인 변경 없음.

| # | 회귀 | 근본 원인 | 수정 | 영향 |
|---|---|---|---|---|
| 1 | **앱 import 실패(순환 import)** | [field_note/field_note/handlers/get_field_note.py](../../app/modules/field_note/field_note/handlers/get_field_note.py)가 `app.application.handlers.field_note` 패키지를 초기화 도중 import → 모듈 핸들러가 application 패키지에 역참조하며 partial-init `get_field_note_detail_handler` 미바인드. `app.main` 자체가 ImportError. | 구체 서브모듈 경로(`...get_field_note_detail`)에서 직접 import. | 앱 100% 다운 → 정상 기동(432 paths/580 endpoints). |
| 2 | **이벤트 워커 100% 깨짐** | [event/event/repository.py](../../app/modules/event/event/repository.py)의 `func.make_interval(secs=...)` ×3 — SQLAlchemy 일반 `func`는 kwarg 거부 → statement 빌드 시 `TypeError`. claim/fail/claim_stale(sweeper) 전부 실패 = 이벤트 소비 영영 안 됨. | positional `make_interval(0,0,0,0,0,0,N)` (라이브 DB로 검증). | outbox 적재는 됐으나 소비가 막혀 있던 것 → consume 경로 복구(test_13으로 증명). |
| 3 | **GET /clients/with-relations 매 호출 500** | 응답 스키마 `ClientWithRelationsSummary.code: str`(피처 a1414481가 모델 nullable=False + 스키마에 추가)인데 [profile_facade.py](../../app/modules/client/facade/profile_facade.py) 빌더만 `code` 누락 → 응답 검증 ValidationError. | 빌더에 `code=client.code` 추가. | 해당 read 복구. |
| 4 | **전 pytest collection 불가** | `module_for_test`(이벤트 reaction pilot) + `application/reactions/{auto_tag_widget,verify_widget}.py`가 워킹트리에서 삭제됐는데 [tests/conftest.py](../../tests/conftest.py)·[application/events/dispatch.py](../../app/application/events/dispatch.py)는 여전히 import(미완성 삭제, 미커밋). | 삭제된 파일들을 HEAD에서 복구(스코프 한정). | 모든 테스트 수집 불가 → 정상. |

비고: 1·2·4는 **이번 검증이 아니었으면 드러나지 않았을** 정도로 치명적(앱/워커/테스트 전면 마비). 2는 메모리상
"eventing outbox 동작·리액션 pilot" 이라던 가정과 달리 **소비측이 빌드 단계에서 깨져 있었음.**

---

## 3. findings (결정 실행 반영)

### F-1. POST `/assessment-cases/{id}/assessment-sessions` — 빈 body 500 → ✅ 해결
- 결정: **일정 없이 생성 가능**(schedule_id 진짜 선택). 적용: 모델 `nullable=True` + [마이그레이션 b1d2e3f4a5c6](../../migrations/versions/b1d2e3f4a5c6_assessment_session_schedule_id_nullable.py) + repo.add `schedule_id: uuid_str | None = None`. drift 가드 통과. endpoint_health write 5xx=0.

### F-2. GET `/admin/ai-usage/calls` — 500 → ✅ 해결
- 적용: `LlmCallItem.session_id: str | None`. pure_layer_sweep server_error=0.

### F-3. GET `/schema` — 500 → ✅ 기능 제거
- 결정: 기능 제거. [server/system.py](../../app/server/system.py)에서 `schema_viewer` 라우트 + 미사용 import 삭제(431 paths).

### F-4. PATCH `/assessment-packages/{id}` — 부분 body 500 → ✅ 해결
- 증상(해결 전): PATCH에 `is_active` 미포함 → 422 아닌 500 (`DevelopError: is_active: bool 필요(실제 None)`).
- 근본: facade가 핸들러의 None-기본 kwarg로 `AssessmentPackageUpdate`를 **재구성**해 모든 필드가 "set" 처리됨 → `model_dump(exclude_unset=True)`가 무력화돼 `is_active=None`이 service→repo(`is_active: bool = unset`)로 전달.
- 적용: facade `update_package`/`update_set`의 service 호출을 `exclude_none=True`로 변경([assessment_package_facade.py](../../app/modules/assessment/facade/assessment_package_facade.py)·[assessment_set_facade.py](../../app/modules/assessment/facade/assessment_set_facade.py)). 미전달(None)=omit으로 거르고 `False`/`0`은 보존. test_15 emit_wiring 28/28 2xx.

---

## 4. 스윕 커버리지 요약 (이번 실행)

| 스윕/테스트 | 호출 | 결과 |
|---|---|---|
| emit_wiring CRUD (test_15, 확장) | 28 | 27 ok(create/update/delete emit 통과) + 1 = **F-4**(apkg PATCH). 미-probe 2(center_voucher·share_token) |
| worker_lifecycle (test_16, 신규 C-2·C-5) | 5 | claim/succeed · fail+backoff · sweeper claim_stale · 반응 fan-out+체크포인트 · 반응실패 격리 |
| skipped_writes (test_17, 신규 C-4) | 42 | 전부 <500 (DUMMY center→membership 4xx, 버림계정으로 auth-self) |
| endpoint_health (`/api/v1` 전 메서드) | 350 | read 5xx=0 |
| endpoint_golden / pure_layer_sweep (기존 recorder) | 167 / 121 | server_error 0 (F-2·F-3 해소 후) |
| flow 테스트 (test_02~09) | — | clients·schedule·assessment·counseling·voucher·form 실 성공 경로 GREEN |

reaction 레지스트리: `EVENT_REACTIONS = {}` (실도메인 반응 0 — 설계상 audit-only는 claim→succeed,
부수효과는 핸들러 인라인). fan-out/실패 머시너리는 test_16이 가짜 반응 주입으로 검증. 워커 프로세스 미가동
상태에서 outbox는 pending으로 적재되고 sweeper가 픽업(별 프로세스).

---

## 5. 재현

```bash
cd apps/api
bash scripts/run_e2e.sh                          # 전체
bash scripts/run_e2e.sh -k eventing_outbox       # 이벤트 구조만
bash scripts/run_e2e.sh -k emit_wiring -s        # 쓰기 emit 배선만(+요약)
bash scripts/run_e2e.sh -k endpoint_health -s    # 엔드포인트 스윕만(+요약 출력)
```
리포트 산출물: `tests/e2e/_emit_wiring_report.md`, `_endpoint_health_report.md`, `_pure_sweep_report.md`, `_app_sweep_report.json`.
