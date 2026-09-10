# agent query tool loop — 반복 절차

new_agent의 read tool을 facade query 포트 기반으로 재구축하고, 권한을 TOOL에 기록한다. 설계 권위: [docs/new-agent-rebuild.md](../../docs/new-agent-rebuild.md). 한 반복 = 한 단계(또는 한 모듈) = 한 로컬 커밋. 게이트 실패 시 멈추고 기록(추측 진행 금지 — [apps/api/CLAUDE.md](../../apps/api/CLAUDE.md) §1).

매 반복은 이 파일의 진행 현황을 갱신하고 시작·종료한다 — 체크박스와 로그가 다음 반복의 유일한 인수인계다.

---

## 확정 설계 (변경 불가 계약)

- **권한은 신규 정책 0** — 각 라우트의 `require_permission(Permission.X)` 코드를 그대로 TOOL에 옮긴다. row scope도 서버 그대로: `access_level` → `owner_scope`(None=전체 / member_id=본인).
- **TOOL 필드 2개 추가**: `permission`(진입 코드, 멤버십만이면 None) · `agent_exposed`(생략=True, 은퇴 read만 False).
- **owner_scope는 INJECTED** — LLM 안 채움. 핸들러가 적용, 포트별 3패턴:

| 패턴 | 포트가 표현하는 owner | 적용 위치 | 예 |
|---|---|---|---|
| A | 담당자 필터(member_ids) | 핸들러 | `query_schedule`: `member_ids=[owner_scope]` |
| B | owner_scope/counselor_id 직접 | 핸들러→포트 | `query_counseling`: `counselor_id=owner_scope` |
| C | 소유 필드 없음 → cross-module 역산 | application handler | `query_client`: `_resolve_assigned_client_ids` 재사용 |

- **평면 read만 은퇴** — 합성/집계/특수 read(list_schedules 캘린더·`*_metrics`·`*_detail`·파일·get_me)는 유지.

---

## 진행 현황 (매 반복 갱신)

### 단계

| # | 단계 | 상태 | 진척 |
|---|---|---|---|
| 1 | loader | [x] | demo 그린 |
| 2 | registry | [x] | 156개 수집 확인 |
| 3 | context | [x] | permissions·owner_scope 배선 |
| 4 | permission 부여 | [x] | 121 노출 + 35 제외 |
| 5 | query 핸들러(포트 보유) | [x] | 6종(schedule·counseling·assessment·member·notice·activity) |
| 6 | query_client(패턴 C) | [x] | 담당 케이스 역산, 테스트 3건 |
| 7 | 포트 없는 모듈 결정 | [x] | 6모듈 전부 "유지"(아래) |
| 8 | 평면 read 은퇴 | [x] | flow 10 + flat list 7 제외 |
| 9 | loop 배선 | [x] | read 60 + ask_user 배선, 게이트 그린 (write는 후속 — 결정 로그) |

노출 tool 현재: 111개(read always-load 60 / write defer 51) + ask_user + prefill 6. 46개 제외(admin 35 + flow 10 + builder 1).

### 10. 모듈 write 표면 확장 (2026-07-02 사용자 방향 정정 — 진행 중)

사용자 규칙: **agent 호출 대상 = 모든 handler − query류 − 지원 불필요 모듈**. module handlers 384개에 TOOL이 이미 있으나(커밋 f1281e8d9) 구형 계약(permission·agent_exposed 없음)이라 미노출이었음. 분해: write/action 220 + read/query 164(제외 — query 포트가 커버).

- [x] 레지스트리 확장: 파일시스템 walk(__init__ 없는 21개 폴더도 수집) + modules는 permission이 write:/delete:인 TOOL만 — **스윕이 permission을 달면 그 모듈부터 자동 노출**. 이름 중복 빌드타임 가드 추가.
- [x] client 스윕(2026-07-02): +12 노출(write:client 10 + delete:client 2 — create/update/status/batch 2종/excel/relation 2종/link 3종) → write 총 63. 판정 로그: favorite add/remove=라우터가 read:client(개인 설정)라 prefix 규칙상 비수집(사실 기입) · list_link_requests=read 의미인데 write 게이트 → 은퇴+특수 read 심사 후보 · guardian/sibling relation 4종=라우터 없음(내부, 표면은 create/delete_relation) → 은퇴 · unlink_resource=권한이 resource_type 따라 갈림(단일 코드 불가) → 은퇴. read 커버리지: 관계 조회(get_relations/children/guardians/siblings·list_with_relations)는 query_client가 못 덮음 — 특수 read 심사 후보 기록. dispatch 검증: create_client 평면 args→ClientCreate 임베드·주입·필수 필드 검증 확인.
- [x] center 스윕(+18): write:center 6 · write:member 4 · write:program 4 · write:room 3 · write:member_invitation 1. 은퇴 6: center_application 3(admin realm 온보딩) · register_center_holidays(SYSTEM API) · update_member/create_program(내부 — application이 표면).
- [x] assessment 스윕(+19): write:assessment_case 13 · delete:assessment_case 2 · write:center_assessment 3 · write:schedule 1(revert_cancel — 라우터 그대로). counseling과 동명 충돌 8종은 TOOL name을 모듈 접두어로 rename + 신규 "fn" 키로 함수명 유지(레지스트리 fn 오버라이드 지원 추가) — counseling 스윕 때 반대편도 접두어.
- [x] form 스윕(+14): write:form_instance 5 · delete:form_instance 1 · write:form_template 8. create_template → create_form_template_handler rename(messaging과 동명).
- [x] counseling 스윕(+13): write:counseling 8 · write:counseling_note 3 · write:schedule 1(revert_cancel) . assessment과 동명 6종 접두어 rename(*_counseling_session·participant).
- [x] field_note 스윕(+8): 전부 write:counseling_note(add_entry·delete·finish_recording·link_schedule·speaker_map·pipeline 3종). upload_audio_chunk=바이너리 스트림 → 은퇴.
- [x] person·notification 심사(파일 변경 0): person credential 6종·update_person·notification 6종 전부 권한 게이트 없는 멤버십 전용 write → 현 수집 규칙(write:/delete: prefix)이 구조적으로 못 걷음. person create/delete_person은 ADMIN. **구조적 갭(별도 결정)**: 멤버십 write(알림 읽음·내 설정·자격증)를 지원하려면 ① 수집 규칙을 '"permission" 키 존재 & read: 아님'으로 확장 + ② TOOL에 kind 명시(None이면 catalog가 read로 오분류 — 게이트 불변식) 필요. push_token·upload_attachment는 기기/파일 흐름이라 어차피 부적합.
- [x] document·voucher·billing·role·schedule 스윕(+16): document 3(update/delete/restore — upload_document는 UploadFile이라 은퇴) · voucher 5 · billing 4(module create_payment는 application 동명이 표면이라 은퇴 — 중복 가드가 검출) · role 3(create_permission은 ADMIN — 비수집) · schedule 1(delete).
- [x] messaging·institution 심사(파일 변경 0): 라우터가 authenticate()만(권한 게이트 없음) — 멤버십 전용 write로 구조적 갭 목록행. upload/image 2종=NO_ROUTE+파일 — 비수집.
- [x] 제외 5모듈(platform_admin·ai_lab·subscription·auth·llm — 사용자 확정): 구형 TOOL(permission 미기입) 상태 자체가 비수집 마킹 — 파일 변경 불필요, permission을 달지 않는 것이 제외 유지 조건.
- [x] 이름 충돌 rename 완료(fn 키): *_assessment/counseling_session·participant, create_form_template.
- [x] 검색 발견율 개선(2026-07-02): bm25가 도구명 언더스코어를 분리 못해 한국어-only keywords 도구(update_room·create_role)가 8회 검색에도 미발견 → **253개 TOOL keywords에 이름 유래 영문구("update room"식) 기계 추가** + SYSTEM에 영문 혼합 질의 지침. 재검증: 둘 다 첫 검색 발견.
- **스윕 완료 합계: write 51 → 151 (+100), 노출 총 211(read 60 + write 151) + ask_user + prefill 6. 커밋 6개(client→center·assessment→form·counseling→field_note→document~schedule→keywords).**
- read 제외의 전제(사용자 확인 2026-07-02): module read 164는 query 포트가 '대체'하므로 안 걷는 것 — 모듈별 스윕 때 step 8 규율 적용: 그 모듈 read가 query 포트로 커버되는지 확인하고, 못 덮는 특수 read(집계·파일 등)는 개별 심사로 노출 후보에 올린다

주: agent/get_conversation_tokens는 `Tool()` 빌더형이라 dict 수집에서 제외(156). 필요 시 dict화 별도 검토.

### 11. 잔여 작업 (다음 세션 시작점 — 우선순위순)

1. **read 커버리지 갭: room·program 조회 노출** (스모크 실증 2026-07-02): "3번 상담실 이름 바꿔줘"에서 모델이 update_room은 찾았지만 대상 id를 구할 room 조회 도구가 없어 좌초(검색 5회 헛발). center 모듈에 query_room 포트 존재(step 5 조사) — application read 핸들러(TOOL 포함)로 노출. program은 list_programs 있음(확인만). 같은 결의 특수 read 후보 일괄 심사: client 관계 조회(get_relations/children/guardians/siblings·list_with_relations — query_client가 못 덮음), list_link_requests(read인데 write 게이트).
2. **확장 표면 S7식 풀사이클 실 스모크**: 새 모듈 write 1종(예: update_room — room read 노출 후)으로 검색→checkpoint→확인→게이트 커밋→DB 검증. 레거시 tx 래퍼 핸들러(async with uow+commit 내부)가 게이트 commit과 공존하는지 이때 실증.
3. **멤버십 write 구조 갭 결정(사용자와)**: notification(알림 읽음 2·설정 2)·person credential 5·messaging template 4·institution 3 — 전부 권한 게이트 없는 멤버십 전용이라 현 수집 규칙(write:/delete: prefix) 밖. 지원하려면 ① 수집 규칙을 '"permission" 키 존재 & read: 아님'으로 확장 ② TOOL에 kind 명시 필드(permission=None이면 catalog가 read로 오분류 — write 게이트 불변식 위반). 부적합 확정: push_token 2(기기)·upload 계열(파일 바이너리).
4. **컷오버 체크 잔여**(docs/new-agent-rebuild.md): 경유 조회(모델 합성) · S6 동명이인 HITL 실모델 · 멀티턴 컨텍스트 · 크레딧 차감/영속 동일성. 완료: 단순 조회·mutation 1-gate·prefill.
5. **미해결 소소**: storage(submit_task)·dispatcher(generate_counseling_note) 특수 의존 None 주입(호출 시 is_error 생존 — 팩토리 주입은 필요 시) · Tool() 빌더형 get_conversation_tokens dict화 · create_share_token(NONE 라우트) 심사.

검증 명령: `uv run python -m app.core.tool_registry`(수집 수·중복·validate) · `uv run pytest tests/unit/agent -q`(40개) · 실 스모크는 scratchpad smoke_new_agent.py·smoke_s7_write_cycle.py 참고(시드: center fdf1e76a-9489-45cf-abdc-cdbc43aef623, member 93f9a751-c1a7-463d-bb8b-f76b292dedcc).

### 4. permission 부여 — 모듈별 (라우터 코드 그대로)

| 모듈 | TOOL | 완료 | 모듈 | TOOL | 완료 |
|---|---|---|---|---|---|
| assessment | 26 | [ ] | auth | 5 | [ ] |
| center | 15 | [ ] | ai_lab | 5 | [ ] |
| counseling | 14 | [ ] | role | 4 | [ ] |
| voucher | 12 | [ ] | notice | 4 | [ ] |
| billing | 12 | [ ] | support | 3 | [ ] |
| client | 10 | [ ] | form | 3 | [ ] |
| field_note | 8 | [ ] | center_assessment | 3 | [ ] |
| subscription | 7 | [ ] | account | 3 | [ ] |
| schedule | 6 | [ ] | upload | 2 | [ ] |
| member | 6 | [ ] | program | 2 | [ ] |
| credential | 2 | [ ] | llm·home·center_application·agent·activity | 1×5 | [ ] |

### 5. query 핸들러 — 포트 보유 모듈 (owner param 확인 후 패턴 확정)

포트 조사 완료 — owner param 실측:

| 모듈 | 포트 메서드 | owner param | 패턴 | 완료 |
|---|---|---|---|---|
| schedule | query_schedule | `member_ids` 있음 | A: `member_ids=[owner_scope]` | [ ] |
| counseling | query_case | `counselor_id` 있음 | B: `counselor_id=owner_scope` | [ ] |
| assessment | query_case | `counselor_id` 있음 | B | [ ] |
| center | query_member/room/program | 없음(관리조회 공용) | 공용: owner_scope 무시 | [ ] |
| notice | query_notice | 없음 | 공용 | [ ] |
| institution | query_institution | 없음 | 공용 | [ ] |
| billing | query_billable | 없음 | C 후보(담당 client 경유) or 공용 — 서버 라우터 확인 | [ ] |
| form | query_template/instance | 없음 | template=공용 / instance=C 후보 — 확인 | [ ] |
| document | query_document | 없음 | C 후보(client 경유) or 공용 — 확인 | [ ] |
| field_note | query_field_note | 없음 | 본인 작성 스코프? — 확인 | [ ] |
| notification | query_notification | recipient 본질 | special: 항상 본인 recipient | [ ] |

owner_scope 적용 규칙(서버 라우터와 일치): 서버 list/read 엔드포인트가 owner_scope를 적용하면 핸들러도 적용(A/B/C), 센터 공용으로 읽으면 무시. **각 query 핸들러 작성 전 해당 서버 라우터의 owner_scope 처리를 확인**한다(추측 금지).

### 7. 포트 없는 모듈 — 결정 로그

| 모듈 | 결정 | 근거 |
|---|---|---|
| subscription | 유지(전부 admin 제외) | 7개 전부 authenticate_admin → agent_exposed:False. agent query 포트 불필요 |
| credential | 유지(전부 admin 제외) | 2개 전부 admin. 불필요 |
| voucher | 유지(기존 read) | get_voucher_* 특정 read만 필요, 범용 query 포트 이득 없음. CUD는 admin 제외 |
| role | 유지(기존 read) | list_center_roles/list_role_members 2건, 범용화 이득 없음 |
| support | 유지(기존) | list_my_inquiries/list_public_faqs/create_inquiry, membership 조회 |
| program | 유지(기존 list_programs) | center_agent_facade.query_program 있으나 list_programs로 충분, 신설 보류 |

### 8. 은퇴 목록 (agent_exposed:False) — 대체 확인 시 체크, 누적

평면 read 후보(대체 포트 커버 확인 전엔 끄지 않는다):

- [ ] client: list_clients
- [ ] member: list_members · get_member
- [ ] counseling: list_counseling_cases · my_counseling_cases · my_counseling_notes
- [ ] assessment: list_cases · list_cases_by_client · get_case
- [ ] notice: list_notices · get_notice
- [ ] schedule: get_schedule_detail
- [ ] activity: list_activity

유지 확정(은퇴 금지): list_schedules · get_counseling_case_detail · get_client_metrics/signals/billing_summary/attendance_pattern · get_prep_signals · `*_delivery_history` · `*_with_brief` · get_voucher_document_file · get_me.

### 결정 · 이슈 로그 (반복 중 발견 기록)

- **Step 4 결과**: 121 노출(read 51 / write 70), 35 `agent_exposed:False`. agent builder형 `get_conversation_tokens` 1건은 dict 아님 → registry 자동 제외.
- **ADMIN 32건 제외**: `authenticate_admin` realm(센터 permission 게이트 없음)이라 센터 agent 호출 불가. 대상 = subscription 7·ai_lab 5·voucher CUD 3·center 관리 4(terminate/activate/suspend/restore)·center_assessment 3·center_application 1·account 3·credential 2·assessment admin 2·notice admin 2. 향후 admin agent가 생기면 재검토.
- **UNMAPPED 3건 제외(revisit)**: `create_center`(엔드포인트 없음, 온보딩), `check_room_slot`(center_agent_facade 전용 — 구 agent는 tool로 씀, 신 agent에서 노출하려면 permission 결정 필요: read:room/read:schedule 후보), `get_field_note_with_brief`(엔드포인트 없음 — facade 전용일 수 있음). 셋 다 구현된 permission 없어 보류, 필요 시 permission 부여 후 재노출.
- **Step 9 완료 (read만)**: catalog.agent_specs()가 레지스트리에서 read 60종 수집(+ask_user=61), engine 조립에서 `specs_for(ctx.permissions)` 진입 필터, Executor가 시그니처 주입 dispatch(주입=INJECTED+center_id 강제 > 모델 args > 기본값 > None, 정체성 인자는 모델 우선). 게이트: COUNSELOR owner_scope→member_ids 강제 / MANAGER 모델 필터 존중 — query_schedule_handler 실핸들러로 테스트 그린(tests/unit/agent/test_new_agent_dispatch.py 7건). 파일럿 read 2종·READ_PORTS 은퇴.
- **실 API 스모크 그린(2026-07-02, claude-haiku-4-5)**: "오늘 일정"(0건→정상 안내)·"6월 25일 일정"(2건 조회→목록 답변) 두 턴 관통 — 도구 선택·실행·완료 멘트·DB 영속(user/tool_result/completion) 확인. 스모크가 구조 갭 1건 발견: 모델의 JSON 문자열 ↔ 핸들러 datetime 시그니처 사이에 FastAPI 등가 변환 계층이 없었음(list_schedules tzinfo 크래시, 단 루프는 is_error로 생존=S4 실증). 수정=_build_kwargs에 어노테이션 기반 코어션(datetime/date, eval_str로 future-annotations 핸들러 커버). 회귀 테스트 2건 추가(31 passed).
- **write 배선 결정=defer_loading+tool search(bm25), 배선 완료(2026-07-02)**: 근거 = count_tokens 실측(read 60=60.4k tok, +write 51=127.2k — haiku 200k의 64%가 프리픽스) + 공식 문서(30~50개 초과 시 선택 정확도 저하, defer는 프리픽스 캐시 보존, GA·haiku 지원). regex 아닌 bm25 채택(FIND 텍스트가 한국어 자연어). 배선: catalog가 write spec 생성(kind=write, defer=True, confirm_label=purpose), render가 defer_loading+검색도구 주입, gate는 handler_kwargs 간접층 제거하고 공용 _build_kwargs(extra={event_group_id, actor_id, background_tasks}) — actor_id는 read에선 LLM-facing 필터(query_activity 작업자 필터)라 전역 주입 금지, write 게이트에서만 강제. dispatch에 pydantic 코어션 2종 추가(FastAPI Body-embed 등가: 평평한 args→data 모델 / dict→모델). BackgroundTasks는 게이트가 커밋 후 직접 await(HTTP 사이클 밖). 실모델 검증: 113 tools(51 defer) 요청 수용, 검색→create_schedule_handler 발견→정확한 args로 호출, input 66.4k(write 미탑재 확인). 테스트 34개.
- **write 배선 잔여 관찰**: ① bm25 한국어-only 질의("일정 생성 등록 스케줄")가 0건 — 영문 혼합 질의로 자기교정했지만 FIND 텍스트에 영문 키워드 보강 여지. ② storage(submit_task)·dispatcher(generate_counseling_note) 등 특수 의존 핸들러는 None 주입 → 호출 시 is_error로 생존(주입 팩토리 배선은 필요 시). ③ S7 풀사이클 실모델 검증 그린(2026-07-02): "주간 회의 등록" → 검색·발견 → checkpoint_waiting(diff+확인/취소, 라벨=purpose) → "확인" resume → 게이트 실행·커밋(schedules 실 row 검증 후 정리) → 완료 멘트 + DB 메시지 5개(message/form_request/checkpoint_answer/tool_result/completion). 코드 변경 없음 — 배선 그대로 통과.
- **프리필 6종 배선 완료(2026-07-02)**: S11. 필드 계약의 정본 = 웹 page-tools 등록 파일(레거시 참조 0) — client_register(평면 8필드)·counseling_receive·assessment_receive(참조형 {id,name})·operation_receive·center_info·center_program(이동만, 웹에 set_fields 미등록). common/prefill.py에 선언(kind=prefill, always-load, permission=대응 write 코드), executor가 step_tool_call 이벤트(page.navigate→page.set_fields) 방출+합성 ToolReturn(단방향 — 프론트 결과 안 돌아옴, 게이트 안 탐). 실모델: "내담자 등록 화면 열어서 채워줘" → navigate+set_fields(gender=MALE enum 정확)+완료 멘트. 테스트 37개.
- **권한 부재 신뢰 문제 해결(2026-07-02, 사용자 제기)**: 권한 필터로 도구가 숨겨지면 모델이 "기능 없음"처럼 얼버무려 서비스 신뢰 저해. 3중 방어로 해결 — ① specs_for가 권한 밖 도구를 숨기지 않고 defer 강등(프리픽스 비용 0, 검색으로 존재는 보임) ② Executor 실행 시점 권한 검사(권한 코드 명시 is_error — ground truth 백스톱, write는 checkpoint 이전 차단) ③ context_block에 "권한이 없어 사용할 수 없는 기능(권한 코드)" 목록 + SYSTEM에 "작업 시작 전 권한 대조 먼저" 규칙. 실모델 검증: 프롬프트만으론 haiku가 무시(정보 수집부터 시작)→ 규칙을 "되묻기 전에 대조"로 강화 후 그린 — 거부 시 "write:schedule 권한 없음, 관리자에게 요청" 즉답, 보유 권한 조회는 정상. 테스트 40개.
- **owner_scope 스키마 누출 1건**: `list_clients` input_schema에 owner_scope 노출돼 있던 것 제거(INJECTED이므로 LLM-facing 금지). validate가 검출.

---

## 1. tool_loader 확장 (loader)
- `INJECTED_ARGS`에 `owner_scope` 추가. `_REQUIRED_FIELDS`에 `permission` 추가.
- `validate()`: `permission != None`이면 [core/permissions.py](../../apps/api/app/core/permissions.py) `Permission` 카탈로그 대조. `agent_exposed` bool 검사.
- 게이트: `demo()` 그린 + 새 필드 누락/오타 케이스 assert 추가.

## 2. tool_registry 신설 (registry)
- `core/tool_registry.py` — `load_agent_tools()`: `hasattr(TOOL)` + `agent_exposed` 필터로 수집, `permission` prefix로 read(always-load)/write(defer_loading) split.
- 게이트: 수집 개수 = TOOL 선언 핸들러 수(은퇴 제외). 유일 수집 지점(중복 로더 금지).

## 3. AgentContext 확장 (context)
- `permissions: tuple[str,...]` · `owner_scope: str | None` 추가. 라우트 핸들러에서 `ServerContext` 값 그대로 주입.
- 게이트: 두 값이 behavior 계산분과 동일(재계산 금지).

## 4. TOOL permission 마이그레이션 (permission)
- 기존 157개 TOOL에 `permission` 부여 — 해당 use-case의 라우터 `require_permission` 코드 그대로. 라우터 없으면 소유 모듈의 read/write 코드.
- 진행: 위 모듈별 표 갱신. 한 반복 = 한 모듈.
- 게이트: 코드가 라우터와 불일치면 멈추고 로그. 임의 부여 금지(이미 구현된 권한대로만).

## 5. query 핸들러 — 포트 보유 모듈 (query-ports)
- 패턴 A/B로 owner_scope 적용해 `query_*_handler` 작성(facade query 포트 위임). 한 반복 = 한 모듈, 위 표 갱신.
- 게이트: owner_scope=member_id일 때 본인 것만 반환하는 테스트 그린.

## 6. query_client — 패턴 C (query-client)
- `_resolve_assigned_client_ids`로 담당 내담자 id 역산 후 `ids` 필터로 `ClientAgentFacade.query_client` 위임.
- 게이트: COUNSELOR가 미담당 내담자 조회 시 제외됨을 테스트로 확인.

## 7. 포트 없는 모듈 (missing-ports)
- 위 결정 로그 6모듈: query 포트 신설 or 기존 read 유지 결정 후 기록. 신설이면 5단계 형태 따름.
- 게이트: 각 모듈 결정이 로그에 남았는가.

## 8. 평면 read 은퇴 (retire)
- query_*가 필터 커버 확인된 read에 `agent_exposed: False`. 함수는 유지(HTTP 소비). 위 은퇴 목록 체크.
- 게이트: 대체 미확인이면 끄지 않는다(기능 구멍 방지).

## 9. 루프 배선 (loop-wire)
- [new_agent/engine.py](../../apps/api/app/runtime/new_agent/engine.py) `_run_stream`: `load_agent_tools` → `permissions`로 tool 필터 → tool_use dispatch(`center_id`·`owner_scope`·`uow` 주입) → domain 예외 `is_error` tool_result → 피드백 반복.
- 게이트: 시나리오 "자신의 스케줄만" 관통 — COUNSELOR/MANAGER 결과가 서버 HTTP 경로와 동일.

---

## 제약 (모든 반복)

- **git: 로컬 커밋만** — push/fetch/pull/reset 금지(hook 차단). 원격 필요 시 멈추고 알린다.
- **한 반복 = 한 단계/모듈 = 한 커밋.** 대량 일괄 금지.
- **막히면 멈추고 기록** — 권한 코드·owner_scope 정의 불확실하면 추측 대신 정지, 서버 기존 구현 확인 후 결정/이슈 로그에 남긴다.
- 진행 현황(체크박스·표·로그)을 매 반복 갱신 — 이 파일이 유일한 인수인계.
