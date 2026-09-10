# layer-conformance — handler·service 계층 스윕 (facade-conformance 후속)

목표: [handler-layer-violations.md](../../handler-layer-violations.md) · [service-layer-violations.md](../../service-layer-violations.md)의
전 항목 해소. facade는 [facade-conformance](facade-conformance.md)에서 종결(감사 5축 포함).

> ## ⚑ 새 세션 이어받기 (먼저 읽어라)
> - **사용자 결정 3건(2026-07-14, 재질문 금지)**:
>   **W1 = Atomic 미반환 102곳 전부 추가**("모두 추가해줘" — 모듈 선별 아님).
>   **W2 = legacy tx 전량 새 패턴**(`async with uow` 123 제거 + `commit()` 44 정리. 특수 4곳
>   [upload_form/voucher_extraction 조기커밋 · bulk_create_member_invitations 루프커밋 · generate_counseling_note 이중커밋]은 tx-free 재설계 + 판정 기록).
>   **W3 = a(docstring — 다른 작업하면서 같이) + b(A3 enum import 12 규칙대로 재설계) + c(datetime.now 1·login.py 리네임 go)**.
> - 상태 확인 게이트: `cd apps/api &&` boot(`python -c "import app.main"`) + `uv run pytest tests/unit -q`
>   + `uv run python -m app.core.tool_registry`(228) + `uv run python scripts/audit_query_filters.py`(5축 갭 0).
>   e2e는 조용한 창에서만(imomtae_test 공유 — 병렬 실행 시 시드 deadlock 오탐).
> - **세션 한도**: 2026-07-14 저녁 에이전트 5기 일괄 사망(21:50 리셋). 대량 fan-out 전 한도 상태 감안,
>   에이전트에게는 "e2e 금지·대상 파일 밖 무수술" 명시.
> - unit의 `tests/unit/agent/test_new_agent_dispatch.py` 2 errors는 **function-call 세션 소관**(`enrich_rows` 인라인 회귀 미완) — 이 스윕에서 건드리지 않음.
> - 전체 미커밋(tmp-agent-1) — 타 이니셔티브 미커밋과 혼재, 커밋 분리는 사용자 소관.

## 판정 대장

| # | 판정 | 내용 |
|---|------|------|
| L1 | Atomic 추가 형태 | eventing.md §4 — service `(atomic, model)` 반환, facade pass-through, handler emit. 라우터 미전환이면 emit 배선까지 |
| L2 | tx 새 패턴 | handler tx-free. `async with uow:` 껍데기 제거, 맨끝 `commit()` 제거. **라우터가 legacy `get_uow`면 commit 제거 금지**(동작 파괴) — 파일별 라우터 모드 확인 선행 |
| L3 | A3 enum import 해소 | 문자열 치환 금지 — 분기·검증 로직을 owning facade/service로 하강 |
| L4 | ai_lab STT transport 직접 전사 | ai-calling.md 명시 잔존(별 이니셔티브) — 무수술 keeper |
| L5 | authz 분리 형태 (2026-07-14 집행) | actor 게이트 = handler가 capability bool(`can_access_all=actor_role in SUPER_PLUS`)로 번역해 전달, 소유권 불변식은 service 잔류. **대상 보호 불변식**(target.role)은 도메인 어휘(`AdminRole.SUPER_PLUS` — SSOT는 admin_account/models)로 표현하고 service 잔류 |
| L6 | platform_admin 공개 표면 | 서브모듈 단일파일 `facade.py`(inquiry·faq 선례). 신설: notice(AdminNoticeFacade+REMIND_ACTS 재export)·audit_log(AdminAuditFacade)·admin_account(AdminAccountFacade)·center(AdminCenterFacade) |
| L7 | 모듈 상수의 application 소비 | facade 파일 재export가 공개 경로(REMIND_ACTS·SLOT_MINUTES 선례) — private `_`모듈 직접 import 금지 |
| L8 | 이관 시 타 모듈 repo 동반 수렴 | B1 이관하면 그 핸들러의 타 모듈 repo 직접 호출도 owning facade 메서드로 함께 수렴(안 하면 A1 재생산) |
| L9 | W1에서 emit seam 없는 호출처 | mutation service는 항상 `(atomic, model)` 반환. event_group_id 없는 내부/워커 호출처는 `# 미발행 — <이유>` 주석과 함께 atomic discard(task_facade 선례) — 발행 여부는 후속 개별 결정. **재검토 미결(2026-07-15)**: 사용자가 discard 사유 5종 전부 반박(통로는 uuid 발급/ctx 전달로 신설 가능·볼륨은 미측정 추측·파생/대표사건은 제품 판단) — 승격 여부 결정 대기, `grep -rn "# 미발행" apps/api/app`이 회수 목록 |
| L11 | onupdate 만료 + atomic payload 직렬화 | ORM mutate+flush 후 인스턴스는 onupdate 컬럼(updated_at)이 만료 — emit payload의 sync 직렬화에서 MissingGreenlet. bulk 전이는 `UPDATE…RETURNING`으로 전 컬럼 적재 행 반환이 정본(schedule restore_by_ids 회귀 실증, e2e test_04) |
| L10 | 운영자 도구 TOOL 이관 규약 | platform_admin→application 이관 시 TOOL에 `"agent_exposed": False` 명시(모듈 측 permission 필터가 사라져 validate 대상이 되므로) — registry 228 불변 |

## 완료 로그 (2026-07-14)

- **A1 11/11**: subscription 3·assessment 1(에이전트 — ResolvePeriodService·`SubscriptionFacade.get_usage_overview`·`AssessmentSessionFacade.list_sessions_by_case` 신설) + notice·notification·support·assign·unassign 5(본세션 — L6 facade 4개 신설 경유).
- **A5 2/2**: login·create_individual_assessment의 `if atomic` emit 가드 제거(emit이 None no-op 소유 확인).
- **A6 2/2**: assign/unassign_assessment의 tx 안 notify_members → emit→reaction 전환. atomic payload에 assessment_name 추가+emit center_id 전달, reaction `notify_assessment_assigned/unassigned` 신설(+routes.py 등록, event_ref_prefix 멱등 — 기존 인라인엔 없던 멱등키 추가 = 의도된 개선 판정).
- **C(에이전트 완료)**: `_file_validation` → form/extraction·voucher/voucher_extraction의 공개 `file_validation.py` 이동 · `InitializeSystemTemplatesService` 재작성(lifecycle 호출자가 commit 소유).
- **D(에이전트+본세션 수복)**: ai_lab 1.1 4곳 — AIFacade 주입 완결(`ExperimentFacade(uow, ai=None)` storage-패턴, 소비처 7곳이 `create_ai_facade()` 전달: app run_llm/run_chain/playground_run·runtime executor·module run_stt/run_text_diarize_eval/generate_prompt_suggestion). §2 형태 전환(Compare/AggregateCosts/GeneratePromptSuggestion — `build_comparison_summary`→`CompareExperimentResultsService` 호출처 포함). A2 get_cost_summary → `ExperimentFacade.aggregate_costs` 신설.
- **1.3 authz 8/8**: L5 판정대로 — cs_memo 5(can_access_all 승격, 핸들러가 SUPER_PLUS 판정), admin_account_management 3(auth.dependencies→AdminRole 도메인 어휘). services에 auth.dependencies import 0.
- **A2 5/5**: get_cost_summary(D) · field_note 2(`ClearNoteStatusService`+`FieldNoteFacade.clear_note_status`·`list_field_notes`) · client list_favorites(`ClientFacade.build_client_signals`) · center slot(`operating_time_facade`에 SLOT_MINUTES 재export).
- **E: B1 이관 10/10 완료(2026-07-15)** — application/handlers/voucher/로: `list_global_documents`(docstring 제거) · `list_voucher_documents`(repo 2개→`VoucherFacade.verify_voucher_exists`+`list_documents_by_voucher`) · `list_voucher_extractions`(신설 `ListExtractionsService`+`VoucherFacade.list_extractions`, `_extraction.py` 헬퍼 인라인 후 원본 삭제 — §1-1) · `get_voucher_extraction`(신설 `VoucherFacade.get_extraction`). voucher router 4곳 재배선.
  잔여 6곳(2026-07-15 본세션): `get_form_extraction`(FormExtractionFacade.find_extraction 재사용) ·
  platform_settings 2(→application/handlers/platform/ 신설, PlatformSettingFacade·PlanConfigFacade+ListPlatformSettingsService 신설, get 응답 조립은 facade.list_settings_kv 경유) ·
  `warn_center`(AdminCenterFacade.warn_center 신설 + 알림 emit→reaction `notify_center_warned` 전환, routes 등록) ·
  `get_center_subscription_tab`(→subscription/, PURPOSE_LABELS·TOKENS_PER_CREDIT은 llm.schemas 공개 재export 경유 — tokens_to_credits는 ceil이라 floor 수식 대체 불가 판정) ·
  `promote_to_production`(→ai_lab/). 전 이관 TOOL에 agent_exposed False(L10). SLOT_MINUTES는 ④축 자기검출로 schemas 승격.
  게이트: boot·registry 228·감사 5축 0·관련 unit 131 pass.

- **W1 Atomic 104/104 완료(2026-07-15, 병렬 에이전트 7기 + 본세션 수복)**:
  center·person·role 11(수명주기 emit 합류, 캐시버스팅 discard) · field_note·form 19(파이프라인 10곳 워커 discard, 전사/요약 본문 payload 제외 민감값 판정, FieldNoteAudioAtomic 신설) ·
  subscription·billing 16(3-튜플 transition 관례 유지, admin 대표사실은 AdminAudit 중복 방지 discard, toss webhook 수제 atomic→서비스 생산 정합화, 잠복버그 2건 수정) ·
  counseling·schedule 12(delete/restore_schedules RETURNING 전환→호출처 8곳 emit, 파생 동기화 6곳 discard) ·
  auth·llm·notification·messaging 13(보안 3종·크레딧 emit 합류, 핫패스 discard, remove_by_center RETURNING) ·
  assessment 28(반응 fan-out 파괴 방지 대표사건 판정, repo RETURNING 3곳, verify_send_result 1건 판정 SKIP — reject 경로가 이미 기록, assign/unassign 잠복 AttributeError 수정) ·
  ai_lab·document·voucher 5(+W3c: datetime.now→utc_now, login.py→login_account.py 리네임 — 에이전트 테스트게이트 중 종료됐으나 코드로 완료 검증).
  **회귀 1건 수복(본세션)**: schedule `restore_by_ids` ORM-mutate가 onupdate 만료 유발(L11) → RETURNING 전환.
  게이트: W1 검출 잔여 0 · boot · registry 228 · 감사 5축 0 · **unit 335 전건**(agent dispatch 2 errors도 function-call 세션이 해소) · **e2e 54 전건**.

- **W2 legacy tx 완료(2026-07-15)**: 라우터 100% behavior.request(레거시 `Depends(get_uow)` 0 실측)라 모든 handler가 `transactional_uow`(clean-exit 자동커밋) 안에서 돎 — end-commit은 전부 잉여. 안전변환기(`scratchpad/flatten_tx.py` — `async with uow:` 블록 dedent + end-commit drop, residual 가드로 half-broken 파일 자동 skip)로:
  - commit-bearing handler 38 flatten(commit 제거) + generate_counseling_note 수동(헬퍼 커밋 포함) · read-shell handler 247 flatten(app 100+2·module 147).
  - **특수 5 보존**(다중커밋/워커 dispatch — 각 커밋에 `# tx 예외:` 마커): diarize(쿼터 실패 보상 3커밋)·upload_form/voucher_extraction(워커 조회 전 조기커밋)·bulk_create_member_invitations(초대 건별 부분성공 루프커밋)·admin_login(인증 시도 독립 보존 2커밋). list_clients(3블록 순수 read)는 cosmetic 잔여로 보류. **→ 후속(2026-07-15) 갱신: 특수 4로 축소** — invitations는 단일 tx 전환(아래 INV-tx), list_clients도 flatten 완료.
  - 게이트: boot·registry 228·감사 5축 0·**unit 335·e2e 54 전건**(3회 재실행 — commit flatten·app read·module read 각 단계). 잔여 실statement: async-with 11·commit 8 = 특수 5 + list_clients뿐.
  - **L11 판정 추가**(onupdate/RETURNING). 감사 축 후보: `await uow.commit()` in handler 검출(특수 5 WAIVER) — 후속.

- **INV-tx 정립 + invitations 단일 tx 전환 (2026-07-15 후속)**: "부분 성공 = per-item 커밋"이 아니라 **부작용의 롤백 가능성**이 tx 경계를 정한다는 일반 규칙을 성문화. behavior.md `[INV-tx]` 앵커(3티어: 되돌림 DB→단일커밋 / 발송→outbox 커밋후 reaction / 예외→`# tx 예외:` 마커) 신설, application.md §3-1(batch 판정)·§3(send)·eventing.md §7(reject)이 인용(SSOT).
  - **bulk_create_member_invitations 전환**: 이메일이 reaction(email_member_invited, 커밋후 롤백가능)이라 건별 커밋 불요 = eventing.md §4 위반(bulk를 event N개로)이던 것. 검증-선행(역할) + 단일 emit(**1 event + N atomics**)로 재작성, 라우터에 start_event_group/dispatch_events 배선 + event_group_id 전달, `_create_one_safe` 삭제. characterization 테스트 갱신(`event_id` 단일 단언 추가) 통과.
  - **list_clients** 3블록 순수 read `async with uow` flatten 완료 — cosmetic 잔여 0.
  - 남은 특수 keeper 4: diarize·upload_form/voucher_extraction·admin_login(전부 발송/워커/reject = INV-tx 티어3 정당).

### L9 완료 — 미발행 discard 0 + event 활동 로그 (2026-07-15)

- 57개 `# 미발행` 경로를 같은 tx 합류, 독립 진입점 group, worker/cron group, reaction child event로 수렴했다. 마커 잔여 0.
- AI gateway 고볼륨 호출만 child event 없이 `llm_calls` 정본 read로 활동 목록에 병합한다.
- 활동 목록은 distinct event 기준 페이지네이션, `changes[]`에 mutation atomic 전량을 제공한다.
- `EventRepository`는 plain INSERT fail-fast이며 같은 group의 다중 event를 허용하지 않는다.
- 게이트: boot · registry 228 · 감사 5축 0 · unit 337 · activity integration 42 · e2e 54 · web check 0 errors.

### W3b — enum/model import (application 레이어, L3: 문자열 치환 금지·분기 하강)

현행 ~16 import (2026-07-15 실측):
- **counseling CounselingSessionStatus 4** (delete_case 상태별 카운트·update_case/apply_case_edits/validate_case_update scheduled 필터) → counseling facade에 `aggregate_started_session_breakdown`·`list_scheduled_sessions_by_case` 신설, 분기 하강.
- **assessment 2** (get_case SessionStatus·delete_assessment_case Case/Session/TaskStatus) → assessment facade에 상태 판정 하강.
- **form FormExtractionStatus 3** (retry·create_from_document·upload) → form facade 경유.
- **voucher Voucher ORM 3** (get_admin/update/create — **타입 어노테이션 전용**) → application.md §1상 entity 직렬화는 정당하나 model import는 신호; facade `*_with_response` 이관 or 어노테이션 제거.
- **billing BillableItemType 1** (build_billable_prefill_for_case — 엔티티→item_type 매핑) → billing facade/service로.
- **subscription toss_webhook** PaymentStatus·PlanType = plan_config(models 아님) — 판정 후 keeper 가능.

### W3a·c
- c(datetime·login 리네임): **완료**. a(docstring): W1/W2 패스에서 만난 파일 처리됨, 잔여는 W3b 패스에서.

### cosmetic 잔여
- `list_clients.py` 3-블록 read async-with(순수 조회, 무해) — W2 변환기 skip분. 수동 flatten 가능.
- module read-handler는 W2에서 flatten 완료. `# 미발행` 마커는 L9 회수용으로 유지.

### 마무리

- L9·W3b 후: handler/service 보고서 최종 검증 스윕 + 게이트 전종 + 이 파일·MEMORY.md 종결.

## 자산
- 조사 원본: 레포 루트 `handler-layer-violations.md`·`service-layer-violations.md`(상태는 이 파일이 정본)
- 감사: `apps/api/scripts/audit_query_filters.py`(5축) · `.claude/hooks/check_cross_module_import.py`
- facade 스윕 기록: [facade-conformance.md](facade-conformance.md)(F1~F11 판정 대장)
