# 도메인 정제 loop — 모듈별 온톨로지 정합 + 불필요 동작 제거

모듈 단위로 ① 도메인 내용을 정독하고 ② 불필요한 동작을 제거하고 ③ 필드·메서드·URL·이벤트 명명을 온톨로지 정합시킨다.
목표: 도메인 전문가의 언어와 코드 이름이 일치하고, 같은 사건이 전 레이어에서 같은 단어로 불린다.

> ## ⚑ 새 세션 이어받기 (먼저 읽어라)
> - 진행률 = §진행표(상태 열이 SSOT). `[대기]`인 다음 모듈부터 §사이클대로.
> - **정본 규칙 = [rules/api/naming.md](../rules/api/naming.md)**(동사 통제어휘·계층 전이) + [persistence-model.md §4](../rules/api/persistence-model.md)(필드 아키타입). 레이어별은 rules/api/* paths-앵커 자동 로드.
> - baseline(2026-07-09 갱신): boot **579**(member /status→activate·deactivate 분리로 +1) · unit 277 passed · integration(test_activity_audit) 44 passed. 이보다 나빠지면 커밋 금지.
> - 파일럿(schedule·client) 완료 — **적용 모드**: 결정 로그 D1~D7 준거로 판정, 새 패턴만 로그 추가.
> - **루프 종료(2026-07-09)** — 전 모듈 [완료]/[제외], 대장 [대기] 0. 후속 ①~③도 실행 완료(커서 참조) — 잔여 = counseling analysis carve-out(Track B 봉투 범용화 선행, eventing-design 소관)과 main 반영·마이그 3건 배포(사용자 소유).
> - 판정 대장: 8건 해소(2026-07-08 일괄 슬라이스), `[대기]` 3건만 잔존(agent 관할·schedule raw SQL·person admin 엔드포인트) — 새 발견은 적재만 하고 진행.
> - 파괴적 발견(§파괴성 등급 B·C)은 즉시 고치지 말고 §판정 대장 기록 후 계속.
> - 통제어휘에 없는 동사가 필요하면: §결정 로그에 근거 기록 → naming.md §2 갱신 → 그 다음 사용.

## 두 산출물 분리 ([claude-files.md](../rules/claude-files.md) 규약)

| 문서 | 담는 것 |
|------|---------|
| [naming.md](../rules/api/naming.md) | 일반화된 어휘·패턴 (모듈명·파일명 구체 대상 안 씀) |
| 이 파일 | 프로세스 + 진행표 + 판정 대장 + 결정 로그 + 전역 어휘 대장 |

## 작업 규율 (convention-design loop에서 검증된 것)

- **grep·survey 발견 = 검증 전 미확정.** 정독으로 ground-truth 후 판정 (1회차 loop에서 오판 다수 실증).
- **"비파괴" 주장은 의심** — URL·응답 필드는 프론트 3앱 계약이다. 파괴성은 실코드(프론트 grep 포함)로 재분류.
- **기왕 판정 준용 (재작업 금지)**: keeper·carve-out·묘비·이월(X1·X2·2-A) = [convention-design.md](convention-design.md) §확정 의사결정 준거. `mark_completed`류 파이프라인 서비스 = runtime.md R1 keeper(naming.md §5).
- **명백한 것은 질문 없이 결정·기록. 모호한 것만 사용자에게** — 반드시 실코드(file:line) + 쉬운 설명 동반.
- **동작 제거는 호출 0 증명 후**: web·admin·mobile 3앱 + `application/handlers` + worker·cron·seed + **tests** grep 전부 0이어야 제거. 죽은 코드만 검증하는 characterization 테스트는 코드와 함께 제거(client 파일럿 실증). 하나라도 애매하면 판정 대장.
- **타 이니셔티브 소관 발견은 그 이니셔티브 문서에 인계 섹션으로 기록** — 그 작업자가 반드시 보는 위치에 file:line 목록(선례: [new-agent-rebuild.md §인계 항목](../../docs/new-agent-rebuild.md)). 대장에는 `[이관]` + 포인터만. (사용자 지시 2026-07-08)
- **판정 권한 분배 (사용자 위임 2026-07-08)**: 규칙이 정답을 주는 건 A급은 물론 **B·C급도 프론트 동반 슬라이스로 즉시 실행**(승인 불요). 방향이 정량 분석으로 명확한 어휘·마이그 결정도 실행(2026-07-09 추가 위임). 단 ① 규칙 경계를 무디게 하는 **예외 선정**(keeper 명문화류)과 ② 제품 지식 필요 판단은 단독 결정 금지 — 정량 근거와 함께 대장 기록만, 사용자 언급 시 함께 판정. 예외 확정 시 3중 명문화(규칙 예외 표 + 코드 주석 + 대장) 선례 준수.

## 파괴성 등급 — 등급별 커밋 단위

| 등급 | 대상 | 동반 작업 | 처리 |
|:---:|---|---|---|
| **A** 코드-only | 서비스 클래스·파일명, facade·handler 메서드명, 내부 동사 | 백엔드 grep 잔재 0 | 사이클 내 즉시 수정 |
| **B** 계약 | URL path, 응답 필드명, 이벤트명(reaction 매핑) | 프론트 3앱 동반 수정 = 같은 커밋, API-FLOW.csv 행 갱신 | 판정 대장 → 승인 후 별도 슬라이스 |
| **C** 스키마 | 컬럼 리네임·값 변경 | alembic 마이그 + 프론트 + 소비처 = 1커밋 | 판정 대장 → 승인 후 별도 슬라이스 ([00-field-archetypes 실행 대장](convention-design/00-field-archetypes.md) 규약 동일) |

## 사이클 (모듈당 1커밋, A등급 기준)

1. **정독** — models → repository → services → facade → handlers → router → events 순. 작은 모듈=전부, 큰 모듈=서브모듈 배치. grep만으로 판정 금지.
2. **도메인 요약** — 엔티티·관계·핵심 사건을 3~5줄로 진행표 옆에 남긴다(다음 모듈 판정의 문맥).
3. **어휘 감사** — §체크리스트. naming.md §4 기계 검사 먼저, 히트만 정독.
4. **동작 필요성 감사** — 라우터 전 엔드포인트에 대해 호출 존재 증명(규율 5번). 죽은 서비스·얇은 위임 파사드도.
5. **판정 분리** — A등급 즉시 수정 / B·C등급 판정 대장 기록 / 새 동사 필요 = 결정 로그.
6. **게이트** — boot 578 + pytest baseline green + 구 이름 grep 잔재 0 (D7: 식별자+kwarg+리터럴 3형태).
7. **커밋** — `refactor(api): {module} 도메인 정제 (domain-refinement)` → 진행표 갱신. 위반 0이면 `[깨끗]` 부기만.

## 체크리스트 (모듈당)

**명사** — 모델명 = 서비스·스키마·핸들러·URL·이벤트의 명사와 동일한가. URL = 복수 kebab인가.
**동사** — 통제어휘 밖 동사 없는가(naming.md §2). check_/save_/manage_/process_ 없는가. create↔add 의미 맞는가(§2-C 판정). 상태전이가 update로 위장 안 했는가. 서비스↔파사드↔핸들러 동사 일치하는가. 명사 단독 파일명 없는가.
**필드** — persistence-model §4 아키타입 14항 (memo·expires_at·{noun}_type·error_message·타임스탬프·{verb}_by 마커·reference_table_name 마커).
**repo** — 접두-반환 계약 일치(get_=raise·find_=None·list_=[]). 폐기 접두 없는가.
**URL** — 상태전이 = `POST …/{verb}` segment인가. PATCH body status 위장 없는가.
**이벤트** — `{noun}_{verb_past}`·cancelled 철자·명사가 모델명과 일치하는가.
**동작 필요성** — 호출 0 엔드포인트·죽은 서비스·서비스 1개만 감싸는 잉여 파사드 메서드.

## 전역 어휘 대장 (사전 조사 2026-07-08 — 모듈 도달 시 정독 검증 후 처리)

survey 발견 = 미확정. 해당 모듈 사이클에서 ground-truth 후 수정/keeper 판정.

| 모듈 | 대상 | 위반 혐의 | 예상 등급 |
|------|------|----------|:---:|
| ai_lab | `manage_prompts.py` | manage = 금지 동사, 동작별 분리 필요 | A |
| form | `value/services/save_answers.py` | save → upsert 혐의 (의미 확인) | A |
| llm | `check_quota.py` | check 3분법 위반 → verify/is/get | A |
| center | `check_operating_status.py` · `check_working_status.py` | check → get_*_status 혐의 | A |
| counseling | `check_active_participant.py` | check → verify/exists 혐의 | A |
| ai_lab | `set_reference_segments.py` | set → 도메인 동사 검토 | A |
| subscription | `set_quota_exceeded.py` | set → 상태전이 동사 검토 | A |
| messaging | `set_default_template.py` | UI "기본 지정"과 대응이면 keeper (naming.md §5) | 판정 |
| llm | `add_llm_call.py` | 로그 생성 = create 혐의 (add는 멤버십 전용) | A |
| assessment | `scoring.py`류 명사 파일명 유무 | `{verb}_{noun}` 위반 스캔 | A |
| field_note | `diarization`·`summary` 명사 파일명 | 〃 (⚠ 인계분 확인 선행) | A |
| 전역 | validate_* 6건 | 해소 — 각 모듈 사이클에서 개별 판정 완료(D3 결·validate_duplicate_clients·삼형제 정명·voucher _validate_dates=결과 검증 정당) | `[해소]` |
| 전역 | duplicate/clone/copy 혼용 | 해소 — 모듈 내 단일 사용 확인(form=clone·role=copy·client=duplicate), 모듈 간 상이는 규칙 허용 범위 | `[해소]` |
| counseling·assessment | 출결 값 no_show vs noshow | 판정(사용자 2026-07-09): 방향㉮ — 어휘를 no_show로 정정(D14), assessment 값·이벤트·URL 마이그(b2d3f4a5c6e7) | `[해소]` |
| schedule | validate 삼형제 | 판정(사용자 2026-07-09): 정명 실행 — validate_single→validate_schedule(URL /validate), validate_batch→validate_recurring_schedules(URL /validate-recurring, 반복 정직), validate_dates→validate_schedule_dates(URL 유지). 서비스·핸들러·facade·app·웹 동반 | `[해소]` |
| 전역 | 구간 경계 아키타입 | 판정(D15⑤): persistence-model §4 명문화 완료 — 예정 구간=bare start/end, 발생 사건={verb_past}_at | `[해소]` |
| schedule | 응답 `counselor_name`/`counselor_color` ← 모델 `member_id` | meeting/block 일정 소유자도 counselor로 표기 — 명사 드리프트 관찰(실해 낮음, 관찰만) | 관찰 |
| 전역 | 다건 연산 URL 형태 | 판정(사용자 2026-07-09): batch 통일 — naming.md URL 형태 명문화, 7 URL 교체(center-assessments·send-links·invitations·cs-memos /bulk→/batch, billing /bulk-delete→/batch-delete, counseling /bulk-update→/batch-update+validate) + 웹/admin/e2e 동반 | `[해소]` |

## 판정 대장 (B·C등급 — 사용자 승인 대기)

2026-07-08 사용자 지시("모두 순수하게 실행")로 규칙-준거 8건 일괄 실행. 남은 `[대기]` = 규칙만으로 판정 불가 3건.

| 모듈 | file:line | 내용 | 필요한 결정 | 상태 |
|------|-----------|------|------------|:----:|
| assessment | facade/task_facade.py | ScheduleFacade/RoomFacade 직접 호출 → schedule_ids 반환 + application handler 조립으로 재배치 | — | `[해소]` |
| counseling·center·schedule | `*_agent_facade` 크로스 facade 호출 일체 | agent rebuild 소관 판정(사용자 2026-07-08) — [new-agent-rebuild.md §인계 항목](../../docs/new-agent-rebuild.md)에 file:line 목록 이관. 컷오버 시 자동 해소, 생존분은 그때 재배치 | `[이관]` |
| schedule | repository.py `_CANCELLED_ONLY_SCHEDULE_IDS` | 판정(사용자 2026-07-08): **keeper 명문 예외** — persistence-repository §6 예외 표 + 코드 주석에 근거·확장 금지·성능 대응 경로(center 스코프) 명시 | — | `[keeper]` |
| client | URL `/clients/duplicate-check` | → `/validate-duplicates` + DTO ValidateDuplicateClients* 정명(웹 동반) | — | `[해소]` |
| client | URL `/clients/search` | 정독 재판정: GET /clients 흡수 **부적합** — 응답 형태 상이(bare list vs 페이지 envelope) + list는 owner_scope(본인 담당만) 필터라 검사 플로우 본인확인(센터 전체 완전일치)이 오식별됨. 별도 표면 keeper | — | `[keeper]` |
| client | batch/bulk 3종 | create_clients·import_clients_from_excel·update_client_with_relations 정명, URL 2종 교체(이벤트 3종 소비 0 확인). 컬렉션 `/batch` URL은 전 모듈 관용이라 유지 — **전역 URL 다건 형태 통일은 별건**(아래 전역 대장) | — | `[해소]` |
| client | link_request.processed_at | → `reviewed_at` (alembic a1c2e3f4b5d6, 프론트 소비 0) | — | `[해소]` |
| person | `PUT /persons/{id}` | → PATCH (웹 patchUpdatePerson 동반) | — | `[해소]` |
| person | router.py POST `/persons`·GET `/persons`·GET·DELETE `/persons/{id}` | 판정(사용자 2026-07-08): **유지 + 스코프 축소** — GET /{id}에 본인 제한(IDOR 가드, update와 동일) 추가. admin 3종(POST·목록·DELETE)은 ADMIN_PLUS 운영 표면으로 존치 | — | `[해소]` |
| person | recipient_resolver·default_avatars | Person/MemberClient(read 표면) 전환, PersonRef에 phone·gender 확장 | — | `[해소]` |
| field_note | PATCH /{id}/finish·/link-schedule·/link-task | 판정(사용자 2026-07-09): 정본화(POST) + 모바일 즉시 수정 — 라우터 3·모바일 3·웹 1·e2e 동반. speaker-map은 필드 수정이라 PATCH 유지 | `[해소]` |
| person | credential `metadata` 필드 | → `meta` (요청·응답·TOOL·웹·admin 동반, DB 컬럼명 불변) | — | `[해소]` |

## 결정 로그 (이 루프에서 새로 확정된 어휘·규칙 — naming.md 반영 후 요약)

| 날짜 | 결정 | naming.md 반영 |
|------|------|:---:|
| 07-08 | D1 다건 연산 = 복수명사(`delete_schedules`), `_batch` 접미 폐기. `bulk_`는 전건교체 계약(BulkUpdateOperatingTimes)만 | §2-A 비고 |
| 07-08 | D2 삭제 포함 조회 접미 = `including_deleted`(repo 기존)로 service/facade 정렬. `include_deleted` 표기 폐기 | repo 규칙 기존 |
| 07-08 | D3 충돌 조회 = `list_conflicting_schedules`(조회 어휘). validate_*는 HTTP 검증 표면(Response 조립)에만 | §2-E 결 |
| 07-08 | D4 facade 이벤트 반환 = plain name이 tuple 반환(`_with_atomic` 접미 폐기). entity-only 중복 변형 제거, 호출자가 tuple 언팩 | facade.md ④ 기존 집행 |
| 07-08 | D5 스코프 검증 = repo `get_in_center` 404 수렴(인라인 403 제거) — document 판정(2026-07-08 승인) 준용, 프론트 403 분기 0 실측 | full-inspection 준용 |
| 07-08 | D6 unset 관통 — None→unset 손변환 금지, omit/null 판정은 HTTP 경계 `model_fields_set` 한 곳 | persistence-repository §10 + service.md 안티패턴 |
| 07-08 | D7 리네임 잔재 grep = 식별자+kwarg(`old=`)+문자열 리터럴(`"old"`) 3형태 — note→memo 잔재 TypeError 3건 실증 | naming.md §4 |
| 07-09 | D16 이월 2건 해소 — ① mark_login_notification_notified=§5 keeper 확정(reaction 워커의 전달 결과 기록 — 이미 outbox reaction 구조였음) ② notify_unread_members→remind 정명 + **발송을 BackgroundTasks에서 outbox reaction으로 전환**(routes.py notice_notify_remind → notify_notice_remind_handler; 사용자 문답으로 await 검토 후 reaction 정본 채택 — 재시도가 쿨다운 유령 마커 해소·event_ref 멱등·알림 fan-out 단일 경로). `remind` 어휘 추가 | §2-B·§5 |
| 07-09 | D15 소소 어휘 일괄(사용자 위임 결정): ① set_quota_exceeded→start_quota_grace(start=진행 구간 개시로 일반화) ② include_deleted bool 파라미터는 현상 유지 — D2 사정범위는 메서드명 접미까지(파라미터 표기 불포함) ③ outbox 이벤트 명사=모델명 수렴(counseling_ 접두 복원, 히스토리 마이그 c3e4f5a6b7d8; notification event_type의 무접두 체계는 자체 일관이라 불변) ④ mark_login_notification_notified·notify_unread_members는 eventing 재검토로 이월 ⑤ 구간 경계 아키타입 persistence-model §4 명문화(리네임 0) | §2-B·§4 |
| 07-09 | D14 출결 철자 `no_show` 수렴(사용자 승인 방향㉮) — 어휘를 지배 실측(counseling·agent·web·billing)에 정정, assessment만 마이그(b2d3f4a5c6e7: 세션 status·이벤트명·atomic act·알림 event_type). URL /noshow→/no-show, 프론트 정규화기는 양철자 수용이라 무중단 | §2-B |
| 07-09 | D13 `warn`(운영자 경고 발송 — 상태 무변경 감사 사건)·`change`(자격증명·정책값의 이력형 교체 — change_password/change_rate/change_plan 지배 실측) 성문화 | §2-B |
| 07-09 | D12 `rollback` 성문화 — promote(프로덕션 승격)의 반대어, ai_lab 구성 이전 버전 복귀. 취소 철회(revert-cancel)와 별개 사건 | §2-B |
| 07-09 | D11 인증·구독 사건어 성문화 — `login`/`logout`·`rotate`(토큰 회전)·`upgrade`/`downgrade`·`reserve`(예약 발효). 전부 현행 지배 패턴 | §2-B |
| 07-09 | D10 `finish` 추가 — 녹음·스트리밍 종료. 레코더 프로토콜(start/pause/resume/finish)이 모바일 WS 실계약이라 complete로 대체 시 프로토콜만 이탈. REST PATCH /finish의 메서드 문제는 별건(대장) | §2-B |
| 07-09 | D9 현행 사건어 3종 성문화 — `intake`(접수, UI "상담 접수하기" 대응·URL /intake 기존)·`start`(파이프라인 개시, atomic .started 기존)·`apply`(최종상태 diff 반영, apply-edits 기존). 발명이 아니라 지배 패턴 성문화, 드리프트는 handler쪽 정명(create_case_with_sessions→intake_case) | §2-B |
| 07-08 | D8 `request` 동사 추가 — 권한자에게 심사·처리를 청함(응답=approve/reject). credential `request_verification` = keeper: UI "검증 요청" 대응 + URL·handler·service·`requested_at` 전 레이어 동일. submit(작성자 확정 요청)과 구분: request는 심사 개시 청구 | §2-B |

## 진행표

**파일럿 = 처음 2모듈 (schedule → client)** — 규칙 귀납 모드: 판정마다 결정 로그 적극 기록, naming.md 보강. 3번째 모듈부터 확립된 규칙 적용 모드.

⚠ = 분리 이니셔티브 인계분 보유([00-field-archetypes §분리 인계분](convention-design/00-field-archetypes.md)) — 그 슬라이스(컬럼 리네임 등)는 건드리지 않고 어휘·동작 감사만.

| 모듈 | py | 상태 | 도메인 요약 / 주요 변경 |
|------|---:|:----:|-----------|
| **파일럿** | | | |
| schedule | 30 | `[완료]` | 일정=센터의 시간·장소·담당자 예약 단위(assessment/counseling/meeting/block), 세션이 schedule_id로 연결. **실버그 3**: ① null=비우기 소실(웹 room 해제 무시→unset 관통 수정) ② assessment update_case `note=` TypeError ③ agent specs `"note"` 필드 2곳. 리네임: get_schedules_by_ids→list_*, _batch 접미 폐기, _with_atomic 폐기(entity 중복 변형 제거), list_conflicts→list_conflicting_schedules, ValidateSingle→ListConflictingSchedules 서비스. 제거: include_deleted 죽은 사슬(repo+service+facade), ScheduleSummary(죽은 스키마), ScheduleDetailResponse(중복→Response 통합), update_schedule_fields/member(무스코프 변형→스코프드 통합). N+1 delete 루프→remove_by_ids 벌크. ScheduleType→models.py. 403→404 수렴(D5) |
| client | 113 | `[완료]` | Client=통합 연락처(1인 1레코드, role=client/guardian/both), 관계 2종(guardian쌍방향 미러·sibling)+link_request(person↔client 연결 승인 플로우)+favorite(person 소유)+resource(다형 junction). **제거**: 죽은 핸들러 7(guardian/sibling 개별 — "하위호환" 주석과 달리 마운트·호출 0, characterization 테스트 1 동반 제거). **리네임**: Get→List 5(guardians/children/siblings/primary_guardian_relations/favorite_client_ids — get이 컬렉션 반환), get_relations→list_relations, get_clients_full→list_clients_by_ids, duplicate_check→validate_duplicate_clients(3분법, URL은 대장), favorite repo remove→hard_delete 정직화(물리삭제인데 soft 어휘). DTO dataclass화. **keeper**: ClientFacade.get_clients_by_ids=9-4 설계 준거(get_by_ids+map), ClientRelation 모델명(guardian/child 쌍방향이라 generic 정당). **관찰**: batch_update emit이 start_event_group 없이 즉석 uuid4(eventing 계열A 잔여) |
| **핵심 엔티티** | | | |
| person | 50 | `[완료]` | Person=계정(account) 1:1 실인물(이름·전화·생년·성별·is_certified 캐시), PersonCredential=학력/경력/자격증(credential_type) + 검증 생명주기(unverified→pending→verified/rejected, 본인 request_verification·admin approve/reject·reviewed_* 감사). **실버그 1**: stats.py `CredentialStatus` 미임포트 NameError — credential 보유자의 GET /persons/me/credentials 전량 500 잠복. **D6 수정 2**: person·credential update의 if-not-None 필터 → unset 관통(null=비우기 복원; person 핸들러+update_my_member+update_member 3경로, credential 핸들러 1경로). **리네임**: facade find_by_account→find_person_by_account·list_by_name→list_persons_by_name(명사 누락), PersonClient.get→find_by_id(get=raise 계약 위반), PersonSummary→PersonItem, UpdateAttachmentService.set/clear_attachment→Upload/DeleteAttachmentService(핸들러 동사 정합, 1파일 1 use-case). **제거**: CredentialSummary·VerificationStatus alias(사용 0). **enum**: CredentialType·Gender→models.py str,Enum(§4, Literal·validator 대체). **keeper**: request_verification(D8), get_persons_by_ids(9-4 준거), recompute_certification(is_certified 캐시 동기화 — 형제 서브모듈 UPDATE, 모듈 내 aggregate 허용) |
| person_profile | 7 | `[완료]` | PersonProfile=센터×멤버 유일 LLM 장기 프로필(content JSONB, version=분석 횟수, analyzed_at=stale 기준). facade 전용 모듈(router 없음) — agent 컨텍스트·프로필 스냅샷·사용분석 3 핸들러가 소비. **리네임(명사 드리프트)**: Find/UpsertProfileService→Find/UpsertPersonProfileService(축약), facade find/upsert_long_term→find/upsert_person_profile(모델명과 무관한 agent 메모리 어휘가 표면 점령). **keeper**: upsert(진짜 있으면-갱신-없으면-생성), 전 서비스·facade 호출 실재. **관찰**: version이 잠금 아닌 분석 횟수 카운터(이름-의미 경계 사례, 실해 없음) |
| center | 227 | `[완료]` | Center=테넌트 루트(센터·멤버·상담실·프로그램·운영/비운영시간·근무/비근무시간·초대·노트설정·me). **상태전이 위장 수정(B)**: PATCH /members/{id}/status → POST /{id}/activate·/{id}/deactivate 분리(핸들러·서비스·facade·TOOL 2분할, 웹 postActivate/DeactivateMember 동반, boot 578→579). **check 3분법**: Check{Operating,Working}StatusService(1클래스 2 use-case) → List AvailableSlots + Get{Operating,Working}Status 4서비스 분리(_slots.py 헬퍼), facade check_slot/get_available_slots_with_response → get_*_status/list_available_slots_with_response, app check_room_slot→get_room_slot_status(+RoomSlotStatusResponse). **D1**: sync_members→bulk_assign_members(전건교체+restore-on-re-add=bulk 계약, 멤버십=assign). **폐기 어휘**: facade soft_delete_all_by_person→delete_members_by_person. **keeper**: PUT operating/working-times(전건교체=PUT 정직), 모델 아키타입·이벤트명 위반 0, program-members·non-working-times는 agent 표면(permission TOOL)으로 호출 실재 |
| **상담 운영** | | | |
| assessment | 245 | `[완료]` | Assessment=검사 운영(케이스·참여자·세션·세션참여자·task·세트·패키지·센터검사·발송링크/결과·채점엔진). **취소 철회 어휘 수렴(B)**: rollback↔revert 혼용 정리 — 세션(revert-cancel)이 정본, case·task의 /rollback URL→/revert-cancel, Rollback*Service→RevertCancel*, 벌크 계열(rollback_tasks/sessions_by_case)→revert_cancel_*, repo rollback_by_session_ids→update_attendance_to_scheduled(저장 연산 정직화), 웹 rollbackCase/Task→revertCancelCase/Task 동반. revert_task(완료 철회)와는 별개 사건으로 구분 유지. **§2-F**: scoring.py→calculate_scores.py(ScoringService→CalculateScoresService). **keeper**: remove_case_participant(멤버십 제외=remove 정당), attend/noshow/cancel/complete/submit/refuse URL 전부 어휘 내. 아키타입·폐기 접두 0. **관찰**: 이벤트 명사 case_completed(assessment_ 접두 탈락), POST /send-link 단수(정본은 복수), /individual·/batch·/bulk = 전역 다건 URL 건 계열. no_show 수렴은 방향 충돌로 대장 [대기] | 
| counseling | 133 | `[완료]` | Counseling=상담 케이스(참여자·회기·회기참여자·노트·종단분석). 접수(intake)로 케이스+회기 탄생, 회기 생명주기(cancel/revert·bulk-update)·출결·노트·분석 파이프라인. **D9 성문화**: intake·start·apply 어휘 추가 — handler 드리프트 정명 create_case_with_sessions→intake_case(URL /intake·UI "상담 접수하기"가 정본). **리네임**: collect_case_data→build_case_data(§2-F 조립). **제거**: CheckActiveParticipantService+repo.exists_active_participant(호출 0 죽은 사슬). **keeper**: initialize_session_participants(facade.md initialize_* 형태), revert/leave/upsert/aggregate 전부 어휘 내. 모델 아키타입·이벤트 시제·폐기 접두 위반 0. **관찰**: 이벤트 명사 접두 비일관(counseling_note_created vs case_analysis_created — counseling_ 접두 유무), no_show 철자 분기는 assessment 사이클에서 값 수렴 슬라이스로 |
| field_note | 75 | `[완료]` | FieldNote=상담 녹음 노트(오디오·엔트리·화자맵·파이프라인 transcribe→refine→summary·task/schedule 연결·추천). **코드 수정 0** — 발견 전부 이관/keeper/대기: ① pipeline 명명 위반(summary_execution.py 명사파일·save_summary·facade mark/set/clear_audio_*)은 6-status 슬라이스와 같은 표면 → [fieldnote roadmap §인계](../../docs/fieldnote/field-note-enhancement-roadmap.md) 이관 ② finish=D10 keeper(레코더 프로토콜, 모바일 WS 계약) ③ PATCH /finish·/link-schedule 메서드 교체(정본 POST)는 배포된 모바일 구버전 즉시 브레이크 → 제품 판단 대장 [대기]. 모델 아키타입·이벤트 위반 0 |
| **문서·서식** | | | |
| document | 65 | `[완료]` | Document=센터 문서고(업로드·다운로드URL·공유토큰·다운로드 카운트·복구). **위반 0 — [깨끗]**: 동사(upload·validate·restore·increment) 전부 어휘 내, repo는 *_including_deleted 정렬 완료, 이벤트·아키타입 정상. **관찰**: HTTP·서비스 파라미터 `include_deleted`(bool) 표기 — D2 폐기 표기의 사정범위를 파라미터까지 확장할지 어휘 결정 필요(agent TOOL 필수 입력이라 교체는 B급) |
| form | 85 | `[완료]` | Form=서식(템플릿·버전·인스턴스·값·서명·발송). **정명**: save_answers 사슬 전체→upsert_answers(실체=bulk_upsert 멱등 저장 — 서비스·핸들러·facade·라우터 함수·ValuesSave→ValuesUpsertRequest, URL /answers 불변). clone_template=복제 3어 모듈 내 유일 keeper. mark_completed/failed=§5 R1 keeper. 이벤트·아키타입 위반 0 |
| voucher | 66 | `[완료]` | Voucher=바우처(센터/내담자 바우처·추출 파이프라인·확정). **정명**: append_artifact_document→add_artifact_document(추출 산출물 문서를 목록에 소속=2-C add), facade append_extraction_artifact→add_extraction_artifact(runtime 소비처 2곳 동반). mark_*·get_for_update=규약 내. 이벤트·아키타입 위반 0 |
| **커뮤니케이션** | | | |
| messaging | 38 | `[완료]` | Messaging=발송(SMS/알림톡)+메시지 템플릿(시스템 기본/센터 커스텀·기본 지정·미리보기). **정명**: ensure_system_templates→initialize_system_templates(부트스트랩 멱등 시드), RenderTemplateService.render→execute(§1 execute 고정), PUT /{id}→PATCH·PUT /set-default→POST(상태전이, 웹 patch/postMessageTemplate 동반). **keeper**: set_default_template=§5 확정(웹 set-default UI 대응), render(§2-F)를 preview 사건과 send 사건이 공유(전이 아닌 소비 — 정당) |
| notification | 50 | `[완료]` | Notification=인앱 알림(읽음·전체읽음·미읽음 수·푸시토큰 등록/해제·설정 upsert)+reaction 수신처. **위반 0 — [깨끗]**: mark_as_read/read-all=§5·§3 규칙 예문 그대로 keeper, register/unregister(푸시토큰)=2-C 정당, 이벤트 notification_read/all_read 정상 |
| notice | 14 | `[완료]` | Notice=플랫폼 공지(운영자 작성·센터 열람, cross-module-write §5 ①번 배치). **위반 0 — [깨끗]**: 순수 CRUD 5서비스 전부 어휘 내 |
| **인증·권한** | | | |
| auth | 57 | `[완료]` | Auth=계정·토큰(rotate)·로그인 알림·비밀번호 이력. **정명**: record_login→create_login_notification(로그 생성=create), check_email→get_email_availability(3분법, URL /email-availability — 프론트 소비 0이라 무손상, e2e 갱신). **D11**: login/logout·rotate 성문화. **관찰**: facade mark_login_notification_notified(mark_ — reaction 내부 상태 기록, R1 결 판정 필요) |
| role | 46 | `[완료]` | Role=센터 역할·권한 매핑·역할 배정. **위반 0 — [깨끗]**: copy_role=복제 3어 모듈 내 유일, assign/find/list 전부 규약 내 |
| **과금·운영** | | | |
| subscription | 49 | `[완료]` | Subscription=구독(플랜 업그레이드/다운그레이드 예약·전환·쿼터 유예·만료). **정명**: facade mark_expired→expire_subscription(expire 어휘 내, roll_center_period·테스트 동반). **D11**: upgrade/downgrade·reserve 성문화. **관찰**: set_quota_exceeded(상태전이 어휘 미정 — exceed/enter_grace 후보)·transition_status(FSM 실행기 generic명) — 도메인어 결정 필요 시 대장 |
| billing | 72 | `[완료]` | Billing=청구(빌러블·항목·결제 반영·발송·가격표). **위반 0 — [깨끗]** (어휘: apply_payment_totals=D9 apply 결, bulk_delete=관용, send·complete 정상. ⚠ notes→memo·sent_at·service_id 컬럼 슬라이스는 billing 이니셔티브 소유라 미접촉) |
| platform_admin | 182 | `[완료]` | PlatformAdmin=운영자 대시보드(계정·2FA·센터 관리/경고/정지·CS메모·FAQ·문의·공지 read-model·credential 심사·감사). **정명**: bulk_delete_memos→delete_memos(D1 복수명사, 서비스·핸들러·라우터). **D13**: warn(경고 발송)·change(자격증명/정책 이력형 교체) 성문화. **관찰**: notify_unread_members(notify=reaction 전용 규약과 경계 — 운영자 능동 리마인드, eventing 재검토 시 판정). 크로스모듈 JOIN=read-model 허용(§6.3) 범위 내 |
| support | 3 | `[완료]` | Support=공개 FAQ·문의 접수(엔티티는 platform_admin 소유, 공개 read+create 표면). **위반 0 — [깨끗]** |
| institution | 19 | `[완료]` | Institution=외부 기관(학교 등) CRUD. **위반 0 — [깨끗]** |
| **AI·LLM** | | | |
| llm | 38 | `[완료]` | LLM=크레딧(잔액·차감·초기화·환산율 이력)·게이트웨이(사전 게이트)·호출 기록. **정명**: check_quota→verify_quota(3분법 raise 계약, facade/gateway precheck_quota→verify_quota 전 사슬), add_llm_call→create_llm_call(로그 생성=create), init_credit 사슬→initialize_credit(축약 금지 — 서비스·핸들러·facade·호출자 6곳). **관찰**: ChangeRateService(이력형 교체 — changed_by 필드와 짝이라 관찰만), lazy_reset_credit(지연 정산 특수어) |
| ai_lab | 78 | `[완료]` | AiLab=운영자 실험실(프롬프트 버전·프로덕션 구성 promote/rollback·실험 실행·샘플). **정명**: ManagePromptsService(1클래스 4 use-case)→Create/Update/DeletePromptVersion·ImportProductionPrompts 4서비스 분리, set_reference_segments→update_reference_segments(핸들러 동반), prompt_suggestion→generate_prompt_suggestion(§2-F generate, 핸들러·URL 함수 동반), diarization_accuracy→calculate_diarization_accuracy(compute→calculate). **D12**: rollback=promote 반대 성문화. ⚠ notes→memo 컬럼은 이니셔티브 소유 미접촉 |
| ~~agent~~ | 49 | `[제외]` | rebuild 이니셔티브 소관 (docs/new-agent-rebuild.md) |
| **인프라·잡** | | | |
| upload | 7 | `[완료]` | Upload=이미지 업로드/삭제. **위반 0 — [깨끗]** |
| activity | 2 | `[완료]` | Activity=활동 조회 라우터(구현은 application). **위반 0 — [깨끗]** |
| activity_log | 3 | `[완료]` | 레퍼런스 모듈 — legacy/model.py 묘비 외 규칙과 어긋남 0 |
| event | 13 | `[완료]` | Event=outbox 인프라. mark_reaction·mark/claim/succeed/fail = eventing.md 정본 keeper(§5). 어긋남 0 |

## 커서

> **2026-07-09 — D14 잔재 보정(후속 Q&A에서 발견).** 3형태 grep을 3앱 재실행해 실버그 2 적발·수정: ① api `AssessmentSessionAtomic.noshow` 호출 잔존(팩토리는 no_show로 리네임됨 — POST /no-show가 AttributeError 500; e2e probe는 404 선행분기라 미검출, 단위 테스트 신설로 가드) ② mobile 노쇼 URL `/noshow` 잔존(라우트는 /no-show만 — 404) + SESSION_STATUS_LABELS `noshow` 키(라벨 미표시). 부수: web toBackendNoShowKey(호출 0·구철자 반환) 제거, 낡은 주석 정정. 교훈: B급 "프론트 3앱 동반"에서 mobile이 빠졌고, D7 grep도 웹만 돌았다 — 계약 변경 게이트는 3앱 전부에 3형태 grep.
> **2026-07-09 — 후속 ①~③ 실행 완료.** ① 프론트 3앱 타입체크: 루프발 오류 = web 1건(messageTemplate import 경로 파손, 99e5ca30b 오염분) 수정. admin 0·mobile 0. 루프 이전 기존 오류 잔존(보고만): web 11(ScheduleDetailResponse/SessionParticipant `.note` 잔재 4·activity-log note/memo 중복 키 1·credentials `kind` 5·billing never 1), mobile 6(Ionicons·bottom-tabs 타입 3·assessment ScheduleSummary.memo 2). ② e2e 전 스위트 50 passed·실회귀 0 — 스위프 spec 잔여 드리프트 1건(emit 배선 probe message-template PUT→PATCH) 수정. ③ notice update 게시 fan-out → outbox reaction 전환(`notice_updated` 그룹 + `notice.published` atomic source 필터 — 그룹명은 첫 emit이 소유하므로 별도 이벤트 대신 조건부 atomic, notify_notice_published_handler 신설, event_ref 멱등 유지). **counseling analysis는 의도적 미전환** — 무거운 LLM은 Track A 반응 직접 실행 금지(eventing.md 안티패턴)이고 JobMessage 봉투가 field_note 전용이라 reaction→Track B enqueue seam(봉투 범용화, eventing-design 소관) 선행 필요. application.md §3 갱신.
> **2026-07-09 — field_note 완료(코드 수정 0 — 인계·keeper·대기 분류).** 다음 = **document**.
> **2026-07-09 — assessment 완료.** rollback→revert-cancel 수렴(URL 2·서비스·facade·벌크·웹 동반), scoring→calculate_scores, no_show 방향충돌 대장 기록. 다음 = **field_note**.
> **2026-07-09 — center 완료.** 상태전이 위장(members/{id}/status) 분리·check 3분법 4서비스·sync→bulk_assign·soft_delete 어휘 정리. boot 579로 baseline 갱신(+1 의도). 다음 = **counseling**(133 py).
> **2026-07-08 — 판정 대장 일괄 해소(사용자 승인).** 8건 실행: PATCH /persons(#8)·client 표면 전환(#10)·metadata→meta(#11)·validate-duplicates(#4)·batch/bulk 정명(#6)·reviewed_at 마이그(#7)·task_facade 재배치(#1)·search keeper 재판정(#5). 대장 잔존 3건(counseling agent 관할·schedule raw SQL·person admin 엔드포인트) + 전역 어휘 대장에 "다건 URL 형태" 전역 건 신설. 전 슬라이스 boot 578·baseline green.
> **2026-07-08 — person_profile 완료.** 명사 드리프트 정리(Profile 축약·long_term 표면 어휘 → person_profile 수렴, 호출자 6곳). 위반 소량이라 대장 추가 없음. 다음 = **center**(227 py — 서브모듈 배치 권장).
> **2026-07-08 — person 완료(적용 모드 1호).** 실버그 1(stats NameError)·D6 2건 수정, D8(`request`) 어휘 추가, 판정 대장 +4(계 11).
> **2026-07-08 — 파일럿 2/2 완료(schedule 70257a1e5 · client c7b6a1ad2).** boot 578·전 스위트 green. 파일럿 종료 — 적용 모드 전환.
> 파일럿 학습(적용 모드에서 준거): ① 리네임 잔재 = kwarg·리터럴까지 grep(D7) ② facade 중복 변형(entity/atomic 쌍)=plain name tuple 통일(D4) ③ 무스코프 내부 변형은 호출자가 center_id 보유 시 스코프드 통합 ④ "하위 호환" 주석 = 죽은 코드 의심 신호, 호출 0 증명은 tests 포함 ⑤ 이름-계약 거짓말(remove인데 물리삭제, get인데 컬렉션)은 grep보다 정독에서 나옴.
> 파일럿 학습: ① 리네임 잔재는 kwarg·리터럴까지(D7) — 과거 note→memo 슬라이스 잔재 3건이 이 모듈 감사에서 적발됨 ② facade 중복 변형(entity/atomic 쌍)은 응집 신호 — plain name tuple로 통일(D4) ③ 무스코프 내부 서비스 변형은 대부분 호출자가 center_id 보유 — 스코프드로 통합 가능.
