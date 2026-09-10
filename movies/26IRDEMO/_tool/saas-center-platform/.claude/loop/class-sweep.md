# 결함 클래스 전역 스윕 loop (3회차 — 표본 감사 파생)

2026-07-08 계층별 랜덤 10파일 표본 감사(90파일)에서 발견된 결함 클래스를 검출기로 확장해 전 코드베이스를 스윕한다. 파일 단위 재정독이 아니라 **클래스 단위 검출→히트 정독→수정→커밋 1사이클**. 무중단 — 세션이 끊겨도 이 문서의 진행표로 이어간다.

> ## ⚑ 새 세션 이어받기
> - 진행률 = §진행표(상태 열이 SSOT). `[대기]`인 다음 클래스부터.
> - baseline: boot **577** · **339 passed/59 skipped** · **e2e 50 passed**(`bash scripts/run_e2e.sh` — 2026-07-08 복구, b093fe01a. 7-06~07 잔재 4건 수정으로 50 error→50 passed). 커밋 규약·git 제약 = [full-inspection.md](full-inspection.md) 동일(로컬 커밋만, push 금지, 한글 prefix, Co-Authored-By: Claude Opus 4.8 (1M context)).
> - 기왕 판정 준용(재작업 금지): X1/X2/2-A 이월·agent 모듈=rebuild 소관·레거시 tx 래퍼 보류·`_legacy_payment` 묘비·`app.core.type` 2줄 import 관례(~150파일)는 **스윕 제외**.
> - 검출기 스크립트는 scratchpad(소실됨) — §검출기 재작성 레시피로 복원.

## 진행표

### 1부 — 확정 클래스 (판별 불요, 즉시 집행)

| # | 클래스 | 규모 | 상태 | 해시 |
|---|--------|------|:----:|------|
| 1-1 | 이중 `@typecheck` 잔재 (global_document repo:41) | 1건 | `[완료]` | b0c3e5563 |
| 1-2 | 미사용 `logger = get_logger()` | 14건(agent 1 제외) | `[완료]` | 705623b22 |
| 1-3 | `uow._session` 관통 → `uow.session`/`uow.repo()` | 13곳 | `[완료]` | 5eb7d8560 |
| 1-4 | `Mapped[str]` ↔ DateTime/Time 타입 주석 거짓말 | 8파일 22컬럼 | `[완료]` | dd4f55ff9 |
| 1-5 | `{verb}_by` reference 마커 부재 | 4파일(billing 3·ai_lab 1) | `[완료]` | 155f61cef |
| 1-6 | field_note 이중 조립기 (`build_detail_response`→`.build()` 통합) | 1건 | `[완료]` | 547fe348b |
| 1-7 | 죽은 `list_by_participant` (counseling·assessment participant repo) | 2건 | `[완료]` | 7cce9ee4f |
| 1-8 | 진짜 중복 from-import (동일 심볼 재수입 — AST 판별 6파일) | 6파일 | `[완료]` | 0bd76d1e1 |

### 2부 — 검출기 신설 클래스

| # | 클래스 | 검출 방법 | 상태 | 해시 |
|---|--------|-----------|:----:|------|
| 2-1 | schemas↔models Enum 값집합 중복 정의 | AST 값집합 대조 — 3건(counseling session/case·client link) 인용 전환 | `[완료]` | 907f7cc71 |
| 2-2 | 죽은 repo/facade 공개 메서드 | **집행 완료(사용자 승인 2026-07-08 '모두 삭제')** — 재스캔 58 + for_lab 은닉 2 + 2차 고아 2 = 61건 삭제, SecurityFacade 파일째, -995줄. 묘비 1 제외. 생존 확인 for_lab 2메서드 유지 | `[완료]` | a62ba6670 |

### 2-2 죽은 공개 메서드 인벤토리 (참조 0 — 2026-07-08 스캔, agent 모듈 제외)

삭제 보류 사유: ① field_note facade 11건은 lab 연동 이관·최근 재구성과 겹침 ② 규모(59)가 커 일괄 삭제는 파괴적 배치 — 사용자 결정 후 집행. 재스캔은 §검출기 레시피.

repo 31: form_signature.find_latest_by_instance_and_field · role.find_global_by_code · permission.list_by_codes · credit_rate_config.list_history · refresh_token.hard_delete_by_token_hash · person_credential.list_by_persons · program_member.count_by_program/find_by_program_and_member · member_invitation.exists_duplicate_pending · document.find_by_checksum · assessment_case.find_by_case_code · send_link.find_by_verification_code · assessment_session_participant.remove_one · center_assessment.exists_active · case_participant.list_client_ids/list_assistant_ids · assessment_task.count_by_case_and_status · assessment.list_public · subscription.list_expired_paid_all_centers/list_expired_trials_all_centers · voucher_extraction.find_by_document_id · voucher_document.list_by_global_document · counseling_session_participant.remove_by_session_and_participant · counseling_case.list_by_counselor_with_page · counseling_note.find_by_session · admin_invitation.find_latest_by_email · admin_refresh_token.revoke_all_by_account · admin_center.find_center_including_terminated · platform_setting.find_by_key · field_note.list_statuses_by_task_ids_in_center · _legacy_payment.list_many_in_center(묘비)

facade 28: schedule.list_schedules_with_summary · role.get_permission_codes · security.detect_and_lock_if_suspicious · notification.find_active_push_tokens_by_accounts · member.list_centers_by_person · center_application.approve_application_with_response · document.upload_document_with_log · assessment.list_assessments_for_agent · assessment_package.update_package_with_response · assessment_case.complete_case · subscription.create_free/get_plan · counseling_case.get_case_participants/create_case_with_response · counseling_note.get_note_with_response/update_note_with_response · field_note 11건(get_field_note_by_schedule_with_response·get_field_note_statuses_with_response·upload_audio_chunk_with_response·add_entry_with_response·finish_recording_with_response·get_audio_download_info·link_schedule_with_response·list_field_notes_for_lab·get_field_note_detail_for_lab·get_merged_audio_bytes + pipeline.prepare_summary_with_response) · price_list.get_active_for_use

### 2회차 사이클 (시드 20260709 — 표본 100파일, 1회차 표본·agent 제외)

| # | 클래스 | 규모 | 상태 | 해시 |
|---|--------|------|:----:|------|
| 2R-1 | 도달 불가 `if x.deleted_at` 분기(base 자동 필터 뒤) | 4건 — including_deleted 로드 경로는 정당 유지 | `[완료]` | 5fdef143b |
| 2R-2 | `Mapped[str]` ↔ Date 컬럼 (1-4 잔여 변형) | billable 2건 | `[완료]` | be52f8579 |
| 2R-3 | `utc_now()` 재발명 (`datetime.now(timezone.utc).replace(tzinfo=None)`) | 21파일 27곳 + `_now()` 래퍼 인라인 | `[완료]` | 214952b6f |
| 2R-4 | `get_*`가 `X \| None` 반환 (이름-계약 — find_ 정명) | 서비스 11파일(클래스 12)·facade 메서드 15·호출처 연쇄, 78파일. 제네릭 토큰은 파일·패턴 한정 치환(라우터 엔드포인트명·핸들러 모듈명·form/jinja 동명 충돌). tuple 내부 Optional·`*_or_none`·raise형·agent 제외 | `[완료]` | e64111bbf |

2회차 표본 커버리지: service·module handler·facade·repo·model·application 정독 완료 / router·schema·runtime·infra 10건씩은 다음 사이클로 이월(검출기성 클래스는 전역 스윕이 이미 커버). 2R-4 검출기: services의 `get_*.py` execute → `| None` / facade `get_*` 메서드 → `| None` (tuple 내부 Optional·`*_or_none` 명시형은 제외).

### 4회차 사이클 (2회차 이월 표본 — router 10·schema 10·runtime/infra 소형 13 정독)

| # | 클래스 | 규모 | 상태 | 해시 |
|---|--------|------|:----:|------|
| 4R-1 | 모듈 내 동명 클래스 중복 정의 — AST 완전 동일만 통합 | Weekday(3)·ParticipantType(2)·CenterMemberSummary(2) → 정본 인용 | `[완료]` | 6b21b6c46 |

- 검출기: 모듈별 top-level ClassDef 이름 수집 → 2회+ 그룹 15 → `ast.dump` 대조 → IDENTICAL 3만 집행.
- **동명이형 9그룹 = 판정 대장행**(아래). router 10 정합(form 일부 미배선=기지 계열A), schema 10 정합(assessment enum 위치=2-A류), infra·runtime 소형 13 정합.
- 미정독 잔여(컨텍스트 예산): form_generation/service.py·voucher_document/extraction/service.py·new_agent/loop/pause.py·counseling_note/prompt.py·tool_loader.py·email admin_invitation.py·platform_admin schemas 3 — 다음 사이클 선두.

### 5회차 사이클 (이월 잔여 9파일 정독 완료 — 2회차 표본 100% 커버)

| # | 클래스 | 규모 | 상태 | 해시 |
|---|--------|------|:----:|------|
| 5R-1 | update_in_center가 get 선행 검증 후에도 `X \| None` 반환 — §10 gold form(assert+비Optional) 통일 | 11 repo | `[완료]` | 0f7d9855e |
| 5R-2 | `find_soft_deleted_*` → `*_deleted_only` 접미 정명 | 1건+호출처 1 | `[완료]` | 542042975 |

- 이월 9파일(form_generation·voucher extraction service·pause·tool_loader·prompt·email 템플릿·platform_admin schemas 3) 전부 정합 — tool_loader는 demo() self-check 보유, 엔진 2종은 facade/gateway 주입 규약 준수.
- document `include_deleted` 파라미터는 HTTP→정명 repo 분기 브리지로 정당 판별(오탐 정정).

### 6회차 사이클 (시드 20260710 — 표본 54파일, 계층당 6)

| # | 클래스 | 규모 | 상태 | 해시 |
|---|--------|------|:----:|------|
| 6R-0 | 2R-4 잔여 보완 — role facade `get_role_with_version`·`get_role_by_center_and_code` 메서드 개명 누락(서비스 클래스만 됐었음) | 19곳 | `[완료]` | bf0b20cfd |
| 6R-1 | `get_analysis.py` 한 파일 2클래스 분리(find_latest_analysis·list_analyses) — 2R-4 검출기 잔존 0 확인 | 1파일→2 | `[완료]` | 74c9c264c |
| 6R-2 | services 한 파일 N-Service 분리 (한 use-case=한 파일) | 9파일 중 8파일 21클래스 분리(21파일 생성·소비처 10 재배선). **prepare_pipeline_step(2)는 스텝 DSL 공유라 보류**(판정: _-prefix 공유 모듈 추출 여부). handler 계층 동일 검출 0 | `[완료]`(1 보류) | 63d7cf64d |

- 6회차 표본 소견: service·handler·application·repo 트리아지 정합(restore-on-re-create 모범 확인). profile_facade(806줄) = 모듈 내 조율 정당. list_devices 핸들러 나레이션 주석 3건=3부류.
- **판정 대장 추가**: `*_with_response`가 atomic도 반환하는 하이브리드 tuple(profile_facade batch_create·member_invitation create 등 다수 확립) — facade.md ④(비직렬화 tuple)와 ①(Response 단독) 어느 쪽도 아닌 제3형. 규칙 갱신(하이브리드 공인) vs 코드 정리 결정 필요.

### 8회차 사이클 (시드 20260710 표본 잔여 — facade 5·router 6·schema 6·runtime 6·infra 6)

| # | 클래스 | 규모 | 상태 | 해시 |
|---|--------|------|:----:|------|
| 8R-1 | `find_`/`search_`가 컬렉션(list/set/dict) 반환 — `list_`/`aggregate_` 정명 | **facade 16메서드 + 서비스 27클래스(파일 rename 동반)** — 검출기: facade async find_/search_ → list/set 반환 · services Find*/Search*Service.execute → list/set/dict. 제외: profile_facade.search_with_response(기존 list_with_response와 이름 충돌 — HTTP 검색 표면 keeper) | `[완료]` — 서비스 26클래스·27파일 rename + facade 19토큰, 79파일. 검출기 잔존 0 | f00ab60ad |

- 소견: program_facade에 `create_program`(atomic discard, "미발행" 주석)과 `create`(atomic 반환) 중복 래퍼 병존 — 기지 eventing 잔여(emit 없는 producer ~16곳) 계열, 배선은 eventing 이니셔티브 소관.
- billable·resource·form_send facade 정합.
- 10회차: 표본 잔여(runtime 6·infra 6·router 6·schema 6) 정독 종결 — **전부 정합, 신규 클래스 0** (Track B executor keeper 문서화·멱등 skip·fail-open 근거 모범, 스키마 docstring 4건=3부류). 시드 20260710 표본 100% 커버. 수확 체감 뚜렷 — 이후 사이클은 신규 시드 표본 or 사용자 결정 항목.

### 11회차 사이클 (시드 20260711 — 고수확 계층 30파일)

| # | 클래스 | 규모 | 상태 | 해시 |
|---|--------|------|:----:|------|
| 11R-1 | behavior `_resolve_access` 공개 승격(소비 3곳의 사설 관통 해소) + dict 반환 facade `find_*` 7건 `aggregate_*` 정명(8R-1 검출망 보완) | 13파일 | `[완료]` | 71c5478d8 |

- 신규 소형 표본(service 6·handler 6·application 6·repo 5) 정합 — 트리아지 0히트, upload/notice의 `_`-prefix 공유 헬퍼 모범.

### 12회차 사이클 (규칙 verify 스윕 5종 전수 실행)

| # | 클래스 | 규모 | 상태 | 해시 |
|---|--------|------|:----:|------|
| 12R-1 | 사설 심볼 크로스 경계 관통 — `_validate_file`/`_resolve_ext` 공개 승격 + `_PlanConfigCache` → 공개 `invalidate_plan_config_cache()` 신설 | 4곳(7파일) | `[완료]` | d4eb3768c |

- verify 스윕 결과: S1 service 직렬화 0 · emit 가드 안티패턴 0 · facade→facade(모듈 간) 0 · 크로스모듈 repo/model/service 직접 import 0(도메인 모듈 간) · application의 모듈 내부 import 46건은 Enum 인용·admin read-model(EX-2)·기검수 용인 드리프트로 판별(전면 facade화는 설계 판정 — 대장 항목 아님, 기왕 판정 준용).
- platform_admin form/voucher의 `_file_validation` 두 사본은 화이트리스트 정책이 달라 **의도적 상이**(중복 아님) 확인.

### 13회차 사이클 (신규 검출기 3종 — mutable default·print·except-pass)

| # | 클래스 | 규모 | 상태 | 해시 |
|---|--------|------|:----:|------|
| 13R-1 | 부트 경로 print()(이모지 포함) → logger 전환 | registry 2파일 3곳 — demo/CLI print 5곳은 정당 | `[완료]` | f1e7953e5 |

- mutable default 인자 0. except-pass 35건은 3-4로 등록(판별 정독).

### 14회차 사이클 (3-4 except-pass 전건 판별)

| # | 클래스 | 규모 | 상태 | 해시 |
|---|--------|------|:----:|------|
| 14R-1 | S3 첨부 정리 실패 완전 침묵 → logger.warning(관측 신호) | credential 4곳 | `[완료]` | 10cf0a431 |

### 3부 — 대모수 정독 클래스 (범위 사용자 결정 대기)

| # | 클래스 | 모수 | 상태 |
|---|--------|------|:----:|
| 3-1 | `description=` 재진술 (router param·Field) | 1,142 출현 | `[범위 미정]` |
| 3-2 | except 내 `raise ... from` 누락 | 13건 전건 부착(15회차) | `[완료]` b388e6359 |
| 3-3 | 장식 배너 | 11파일 82줄(순수 56 삭제·라벨 26 plain화) | `[완료]` b388e6359 |
| 3-4 | `except: pass` 침묵 삼킴 | 35건 전건 판별 완료(14회차) — 30건 정당(좁은 예외 fallback·temp 정리·스트림 종료·근거 주석 keeper), credential S3 정리 실패 4곳 warning 추가(10cf0a431), plan_config 1건 주석 有 keeper | `[완료]` |

### 15회차 사이클 — 3부 소형 종결

**자율 집행 가능 범위 소진 선언(2026-07-08 15:15)**: 1부 8·2-1·2R-1~4·4R-1·5R-1~2·6R-0~2·8R-1·11R-1·12R-1·13R-1·14R-1·15R-1 전건 완료(코드 커밋 27). 남은 것 전부 사용자 결정 게이트 — ① 2-2 죽은 메서드 59 삭제 ② 3-1 description 1,142 범위 ③ 판정 대장 12건. 이후 사이클은 신규 표본 저수확 순찰만 가능.

### 16회차 사이클 — 순찰(회귀 검증 + 미방문 영역)

| # | 내용 | 상태 | 해시 |
|---|------|:----:|------|
| 16R-1 | 전 검출기 스위트 재실행 **회귀 0** · 미방문 core/behavior/worker/event 10파일 정합 · stream 워커 `__main__` 가드 추가(event 워커와 통일) | `[완료]` | df6af5a0f |
| 17R | 미방문 infra 하위(cache·hash·payment factory·stt common·server/exception) 12파일 순찰 — **전부 정합, 수정 0** (factory 단일 진입·예외 봉인·keeper 주석 규약 준수) | `[완료]` | — |
| 18R | 마지막 미방문 포켓(s3·smtp client·server 조립층 lifecycle/system/server) 순찰 — **전부 정합, 수정 0. 전 영역 순찰 완주** — 이후 사이클은 검출기 스위트 회귀 체크 모드 | `[완료]` | — |

## 판정 대장 (수정 보류 — 사용자/설계 결정 대기)

| 위치 | 내용 | 필요한 결정 |
|------|------|------------|
| notification_setting/repository.py:121-196 | effective-setting fallback 계단(event_type→category→`*`)이 repo 소유, service는 1줄 위임 — service.md §5 역전 | 정책을 service로 하강할지 |
| llm/facade/credit_facade.py:62 `adjust_credit` | load/verify/branch/update 비즈니스가 facade 인라인 | AdjustCreditService 분리할지 |
| assessment/facade/send_link_facade.py:15 `_validate_online_support` | 검증 인라인(repo 직접+raise) | Service 분리할지 |
| infrastructure/payment/toss/webhook.py | infra가 HTTPException 직접 raise | FastAPI 의존성 관례로 허용할지 |
| update 계열 `update_data[...]` dict 조립 + `if v is not None` 필터 (10+파일, 예: update_non_operating_time) | §10 unset 계약 미적용 — NULL-clear 불가 | unset 소급 여부(API PATCH null 의미 변경 수반) |
| auth_facade.change_password | 비밀번호 재사용 정책(최근 3개) 인라인 — 보안 경로 | ChangePasswordService 분리 여부 |
| check_room_slot.py | 타 모듈 service 클래스(CheckOperatingStatusService)를 상수(SLOT_MINUTES) 접근용 직접 import | 상수의 facade/모듈 표면 노출 방식 |
| role/permission/models.py | Permission PK가 int(전역 UUID PK 관례 이탈) | 마이그레이션 수반 — 유지/이관 |
| auth/facade/security_facade.py | `detect_and_lock_if_suspicious`가 AuthFacade `_detect_and_lock_if_suspicious`와 사본 중복 + 죽음(2-2 인벤토리와 겹침) | facade 사본 정리 방향 |
| 모듈 내 동명이형 클래스 9그룹 | AssessmentSummary(str vs Enum 필드 차)·ChangePasswordRequest·ListMatchingByDateService·DuplicateCheck{Item,Result}(schemas vs service co-located)·InstitutionSummary·AdminAccountListResponse·AdminAccountSummary(3곳)·CatalogSummary — 내용이 달라 기계 통합 불가 | 그룹별 정본 선정·필드 정합(스냅샷 str vs Enum 등) |

## 검출기 재작성 레시피

- 공통: `apps/api`에서 `glob("app/**/*.py")`, `__pycache__` 제외.
- 미사용 logger: `^logger\s*=\s*get_logger` 매치 ∧ `\blogger\.` 부재.
- 이중 데코레이터: AST `decorator_list`에서 `ast.unparse` 중복.
- uow._session: `grep -rn "uow\._session"`.
- Mapped 거짓말: `grep 'Mapped\[str' models.py` ∧ `Time|DateTime`.
- 중복 import: AST `tree.body`의 ImportFrom 모듈별 라인 수집, 2회+ — 단 `app.core.type` 2줄 관례(unset·uuid_str / typecheck 분리)와 TYPE_CHECKING 분리는 오탐이므로 **동일 심볼 재수입만** 진짜.
- raise-from: ExceptHandler(name 有) 내 `ast.Raise`에서 `cause is None` ∧ exc가 Call.
- 배너: `^\s*#\s*(={4,}|─{4,}|-{6,}|\*{4,})`.

## 커서

> **2026-07-08 — 반복 loop 가동(사용자 지시: 검증·수정 사이클 반복).** 1부 8/8 + 2-1 (커밋 9: b0c3e5563→907f7cc71) 후 2회차 사이클 2R-1~3 완료(5fdef143b·be52f8579·214952b6f). 매 커밋 boot 577 + 339/59 green.
> 3회차: 2R-4(e64111bbf). 4회차: 4R-1(6b21b6c46). 5회차: 이월 잔여 정독 종결 + 5R-1(0f7d9855e)·5R-2(542042975). 6회차: 6R-0(bf0b20cfd)·6R-1(74c9c264c). 7회차: 6R-2(63d7cf64d). 다음: 6R-2 집행 → 표본 잔여(facade 5·schema 6·runtime 6·infra 6·router 6) 정독. 다음 사이클: ① 2회차 이월 표본(router·schema·runtime·infra 각 10 — 시드 20260709 목록은 이 문서 아님, 재추출 시 시드 고정 재현) ② 시드 20260710 신규 표본. 경미 기록: counseling_case_analysis/services/get_analysis.py = 한 파일 2클래스(Find/List) 편차. 사용자 결정 대기 = 2-2(죽은 메서드 59)·3부 범위·판정 대장 10건.
