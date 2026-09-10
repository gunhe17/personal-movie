# facade 정합 스윕 — 계층 규칙 위반 해소 + 기계 감사화

목표: [facade-layer-violations.md](../../facade-layer-violations.md)(전 facade 77곳 조사, 위반 38곳)를
해소하고, 계층 규칙을 지시가 아닌 **기계 감사**로 전환한다.
모체 = [function-call-selection](function-call-selection.md)의 D13/D14 작업 중 사용자가 계층 위반
3종(facade→facade·모듈→runtime·모듈→application)을 직접 발견한 데서 출발.

> ## ⚑ 새 세션 이어받기 (먼저 읽어라)
> - **P0~P4 전 단계 완료(2026-07-14). 게이트 전종 통과. 이니셔티브 종결.**
> - SSOT = 이 파일. 작업 목록 = 레포 루트 `facade-layer-violations.md`(조사 원본 — 상태는 이 파일이 정본).
>   규칙 정본 = [facade.md](../rules/api/facade.md)·[eventing.md](../rules/api/eventing.md) §4·[service.md](../rules/api/service.md)·[agent-query.md](../rules/api/agent-query.md).
> - §판정 대장이 정본 — 재질문 금지.
> - 상태 확인: `cd apps/api && uv run python -m app.core.tool_registry`(228) +
>   `uv run python scripts/audit_query_filters.py`(갭 0 — 필터·투영·계층·facade 경계·**repo 위임** 5축) +
>   `uv run pytest tests/unit -q` + e2e `bash scripts/run_e2e.sh`(54 — **test DB `imomtae_test` 공유라 병렬 세션 실행과 겹치면 시드 deadlock 대량 오탐**, 조용한 창에서만 신뢰).
> - 전체 **미커밋**(tmp-agent-1) — 다른 이니셔티브 미커밋(query 스윕·member-profile)과 혼재. 커밋 분리는 사용자 소관.

## 판정 대장 (재질문 금지)

| # | 판정 | 내용 |
|---|------|------|
| F1 | router→application handler = **정당** | cross-module-write.md §1이 정한 배선(Router→App Handler). 위반 아님 — 감사 예외 |
| F2 | turn_store commit/rollback = **명문 예외** | new_agent 대화 write-ahead 세션(aow)의 즉시 내구화 계약. facade.md §4에 등재 완료 — 코드 무수술 |
| F3 | llm/gateway/factory 역참조 = **WAIVER(기록된 부채)** | 부팅 배선 얽힘(돈 경로) — 수술 금지. 처방 = 주입 역전(app startup이 roller 주입), 별건 수술 후보 |
| F4 | 조립 위치 = query handler(application) | agent facade의 크로스모듈 이름 조립 금지 — `_projection.py` 레지스트리 소유. agent-query.md 명문화 완료 |
| F5 | flush 위반의 근본 원인 = 서비스 ORM mutate | facade flush 제거는 증상 치료 — 서비스를 primitive update로 전환하는 게 정본(P1 선례). P2에서 voucher `reset_extraction_for_retry` ORM mutate도 동일 방식(repo `update_in_place`+`started_at` kwarg 추가)으로 해소 |
| F6 | modules/agent/** = 범위 제외 | 구 agent 대화 모듈 — new-agent-rebuild에서 통째 대체 예정. 감사·훅 면제 명시 |
| F7 | read passthrough 서비스 전환 시 파일 폭발 회피 | 같은 use-case의 read 묶음은 축-파라미터 dispatch 서비스 하나로 수렴(messaging `ListDeliveryHistoryService`가 send_link/send_result/form_send 3축 흡수 — 6파일→2파일). 단건 read는 개별 서비스(깨끗 39 관례) |
| F8 | document_facade S3 오케스트레이션 = **무수술**(2026-07-14) | 업로드 흐름 = 스토리지 어댑터 + 두 서브모듈(document·document_access) 서비스 조율 — facade.md §3 조율 범위. `UploadFile` 언패킹·checksum·path 생성은 service로 내리면 primitive-in 위반(service가 HTTP 타입을 받게 됨). StorageClient 보유는 확립 패턴(task·global_document) |
| F9 | repo 직접 호출 꼬리 70곳 = **즉시 해소**(2026-07-14 사용자 결정 ①) | 조사 보고서 "깨끗 39"가 놓친 체인 형태(`self._x_repo().m()`·변수 담아 호출) — AST 재스캔 실측 70곳/11 facade. 해소 후 감사 ⑤축(AST repo 위임) 승격으로 재발 구조 차단 |
| F10 | send_result reject 이관 = **완료 확인**(사용자 결정 ②) | 실측 결과 이미 이관돼 있었음 — [verify_send_result](../../apps/api/app/application/handlers/assessment/verify_send_result.py)가 실패 emit 후 `uow.reject`. 감사 tx WAIVER 소진, facade.md 잔존 문구를 레퍼런스로 교체 |
| F11 | llm factory 주입 역전(F3) = **계속 보류**(사용자 결정 ③) | 돈 경로 + 부팅 배선 — 기록된 부채 유지 |

## 완료 로그

- **P0 (agent query 표면 — function-call-selection에서 수행, 2026-07-14)**: 조립 층 이동(`application/handlers/_projection.py` 레지스트리, 모듈 facade 크로스모듈 import 0) · `core/query_limits.py`·`core/query_projection.py` 신설 · 절삭-선행 8건 교정 · 모듈→application 역행 4곳 교정 · 감사 3축 + 훅 확장.
- **P1 High (2026-07-14)**: turn_store facade→facade 해소(AI facade를 engine이 주입) · flush 6개 제거(F5) · Atomic 생성 4 facade→service 하강 · auth `ChangePasswordService` 추출. 게이트: registry 228·감사 갭 0·boot·unit 334·e2e 54.
- **P2 (2026-07-14, 두 세션 릴레이)**: §5 Service 우회 22곳(#16~38) 전건 위임 전환 + §4 인라인 4곳(form required-field·llm credit·role·ai_lab) + §6 billing `services._helpers` 2곳 해소.
  - 전반(직전 세션): assessment 전 facade·counseling·field_note·messaging(F7 dispatch 서비스)·event·llm_call·global_document·form·form_template·member·notification·notice_agent + 서비스 다수 신설.
  - 후반(이 세션): `_helpers`→`billable/schemas.py` 공개화 · billing_agent `ListItemsByBillableService` · document `UpdateDocumentService`에 `storage_path` kwarg(직접 update 대체) · credit_facade 6곳(서비스 6개 신설: FindActiveBalance·ClearCredit·SetCreditUsed·AggregateTopCreditUsers·AggregateDailyPurposeUsage·ListRecentLlmCalls) · profile_facade 3곳(GetClientById·FindClientByNameBirth·**DeleteGuardianRelationPairService**(primary-guard 우회 양방향 삭제 — 기존 DeleteGuardianRelationService와 별개, 관계 교체·동기화 경로 전용)) · ai_lab experiment_group 5곳 · voucher_facade 전건(link/unlink/list document·get/find voucher·extraction create/reset/find/get/delete·names 배치 read·ConsumeSessionsService).
  - #35 agent/agent_facade = F6 범위 제외로 무수술.
- **P3 Low (2026-07-14)**: 모듈 docstring 2곳 삭제(ai_facade는 non-uow 계약 한 줄 주석으로, global_document는 변형 묶음 정책 한 줄 주석으로 보존) · document S3 오케스트레이션 = F8 무수술 판정 · **감사 4축 확장**: `audit_query_filters.py`에 `facade_boundary_gaps()`(facade tx flush/commit/rollback + Atomic 팩토리 호출 + `services._` private import, F2/F6=agent 모듈 skip, send_result_facade=tx WAIVER). 검출기 자가 증명(옛 위반 라인 3종 매칭·타입 어노테이션 비오탐 확인).
- **P4 꼬리 스윕(2026-07-14, 사용자 결정 ① 승인)**: F9 꼬리 70곳/11 facade 전건 Service 위임 전환 —
  subscription(27)·assessment case/session(14)·billing billable/payment/price_list(10)·voucher center/client(9)·
  counseling_session(5)·auth(3)·form_extraction(2). 병렬 에이전트 5기 + 본 세션 릴레이(subscription은 에이전트가
  서비스 신설·import까지 하고 세션 한도로 중단 → 본 세션이 본문 27곳 배선). 신설 서비스 ~40개, 기존 재사용 다수.
  검출·완료 판정 = AST 스캔(변수 담아 호출 포함) 잔여 0.
- **감사 ⑤축 승격(2026-07-14)**: `facade_repo_delegation_gaps()`(AST — facade 내 repo 직접 호출 검출,
  `Service(repo)` 전달은 비오탐, agent 모듈 F6 제외). tx WAIVER는 F10으로 소진(`FACADE_TX_WAIVERS` 빈 set).
  [persistence-repository.md](../rules/api/persistence-repository.md) §11 cascade 예시를 서비스 경유 형태로 정합.
- **최종 게이트(2026-07-14, P4 포함 재실행)**: registry 228 · 감사 5축 갭 0 · boot ok · AST 잔여 0 ·
  unit 333 passed(+2 errors는 병렬 function-call 세션의 `_projection.py` 인라인 회귀 진행 중 —
  `test_new_agent_dispatch`의 `enrich_rows` monkeypatch, 이 스윕 밖) · e2e 54 ·
  `from app.runtime` in modules(agent 제외) 0.

## 잔여 (후속 — 이 스윕의 정의된 범위 밖)

- **unit 2 errors 재확인** — `tests/unit/agent/test_new_agent_dispatch.py` 픽스처가 삭제된
  `enrich_rows`(`_projection.py` 인라인 회귀, application.md §1-1)를 monkeypatch — function-call 세션이
  그쪽 작업 마무리 시 테스트 갱신 예상. 이 스윕 소관 아님.
- **골든 36·놀이터 e2e 재실행** — function-call-selection loop 소관(사용자 지시로 이 세션 범위 제외).
- **별건 수술 후보**: llm factory 주입 역전(F3 — 사용자 결정 ③ 보류 유지) · 구 runtime chains 라벨 저하(new-agent-rebuild 컷오버로 소멸 예정).

## 게이트 (완료 조건 — 전종 통과 2026-07-14)

```bash
cd apps/api
uv run python -m app.core.tool_registry            # 228
uv run python scripts/audit_query_filters.py       # 갭 0 (필터·투영·계층·facade 경계·repo 위임 5축)
uv run python -c "import app.main; print('boot ok')"
uv run pytest tests/unit -q                        # 333+ (agent dispatch 2 errors는 function-call 세션 소관)
bash scripts/run_e2e.sh                            # 54 — imomtae_test 병렬 실행과 겹치면 deadlock 오탐
grep -rn "from app.runtime" app/modules --include="*.py" | grep -v "modules/agent/"  # 0
```

## 자산

| 파일 | 내용 |
|------|------|
| `facade-layer-violations.md` (레포 루트) | 위반 조사 원본(작업 목록) — 상태는 이 파일 완료 로그가 정본 |
| `apps/api/scripts/audit_query_filters.py` | 감사 5축(필터·투영·계층·facade 경계·repo 위임 — WAIVER 목록 포함) |
| `apps/api/app/application/handlers/_projection.py` | 크로스모듈 이름 조립 레지스트리(F4) |
| `apps/api/app/core/query_limits.py`·`query_projection.py` | agent query 공용 유틸 정본 |
| `.claude/hooks/check_cross_module_import.py` | 모듈↔모듈 + 모듈→runtime + agent facade 축 |
