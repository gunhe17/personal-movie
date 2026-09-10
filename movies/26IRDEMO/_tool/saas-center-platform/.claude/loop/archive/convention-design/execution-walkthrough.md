# 실행 전 워크스루 — 계층 9~15 (2026-07-05 착수)

> 목적: 각 계층 워크리스트를 **실제 구현하는 흐름으로** 실파일을 밟아, 워크리스트가 예상 못 한 **예외 사례**와 **사용자 의사결정 필요 지점**을 실행 전에 수집한다. 설계(NN-layer.md)가 "무엇을"이라면 이 문서는 "하려고 보니 뭐가 걸리나".
> 방법: 계층별 병렬 조사(9·10 / 11 / 12~15) → 핵심 주장 직접 검증 → 예외·결정 큐 등재. 이 loop의 규율대로 **에이전트 발견은 검증 전 미확정**.

## 진행 상태

| 계층 | 워크스루 | 비고 |
|------|:-------:|------|
| 9 cross-module | **완료·검증됨** | foreign read=Person·Member·Center 3종 — batch 필수·서브모듈 경계 결정 필요. §9 |
| 10 behavior | **완료·검증됨** | 단순래퍼 압도적이나 멀티커밋 12+reject 6 변형 화이트리스트 필요. §10 |
| 11 AI 호출 | **완료·검증됨** | 옵션2 성립 조건 2건 발굴(스트리밍 STT·diarize 과금) — 아래 §11 |
| 12 runtime R1 | **완료·검증됨** | repo에 update 계열 0 — facade+primitive 동시 net-new. §12 |
| 13 core | **완료·검증됨** | 대부분 값-동일 치환(곧장). blocker=STAFF·enum통합·bare datetime 3건. §13 |
| 14 worker | **완료·검증됨** | 전 항목 결정 종속 — hook owner 로직 개조·주석 위치·helper 처분. §14 |
| 15 infra | **완료·검증됨** | ghost·print·email base 즉시 가능. cache 싱글톤만 구조 변화. §15 |

## §9 cross-module — 워크스루 결과 (검증 완료)

**foreign READ는 전부 `application/handlers/`에, 대상은 Person·Member·Center 3종뿐.** 필요한 Client = `PersonClient`·`MemberClient`·`CenterClient` 3개(get + `list_by_ids`).

### 예외 사례
| # | 위치 | 내용 |
|---|------|------|
| E1 | [notify_notice.py:111-122](../../../apps/api/app/application/handlers/notice/notify_notice.py#L111) | 이미 루프+`list_by_ids`(CHUNK 100) — Client가 `get()`만이면 **N+1 퇴행**. **batch 메서드는 첫 릴리스부터 필수**(옵션 아님) |
| E2 | notify/update_notice | **BG 세션(`bg_uow`) foreign read** — `Client(bg_uow)` 계약으로 가능하나, BG carve-out(계층 10 keeper)과 client 이관이 같은 파일 공존 |
| E3 | approve/reject_credential | 한 핸들러에 **facade(write, entity 필요)+client(read) 공존** — 기계 치환 아닌 라인 선별 |
| E4 | [list_favorites.py:17](../../../apps/api/app/application/handlers/client/list_favorites.py#L17) | `client.favorite`→`client.profile.repository` — **서브모듈 경계**(같은 top-module). cross인지 아닌지 규칙 미정 |
| E5 | get_notice·list_notices·get_cost_summary 등 10+ | application 핸들러가 **자기 도메인 repo를 facade 안 거치고 직접**(foreign 아님, application.md §4 위반) — 계층 9 범위 밖이나 같이 걷을지 |

- admin read-model JOIN(§6.3 keeper ~65)과 client 대상은 **안 겹침 확인**(설계대로).

## §10 behavior — 워크스루 결과 (검증 완료)

**분포**: `async with uow:` 519 · commit 284. 대다수 단순 래퍼(곧장 언랩). 변형: **멀티커밋 12파일**([run_batch_compare.py **4커밋** 검증](../../../apps/api/app/modules/ai_lab/experiment_group/handlers/run_batch_compare.py)) · **reject/begin_nested 6파일** · commit-후-발송/BG 2+.

### 예외 사례
| # | 위치 | 내용 |
|---|------|------|
| E1 | 멀티커밋 12 + reject 6 (~18곳) | behavior 요청-끝-단일커밋으로 **표현 불가** — 분해 or 수동세션 유지 케이스별 |
| E2 | [approve_application.py:25,47 (검증)](../../../apps/api/app/modules/platform_admin/center_application/handlers/approve_application.py#L25) | **canonical(request_admin+emit 이관 완료)조차 tx 래퍼 잔존** → admin 이관과 tx 제거는 **독립 슬라이스** 실증 |
| E3 | [center/center_application/router.py:66,82 (검증)](../../../apps/api/app/modules/center/center_application/router.py#L66) | platform_admin 쪽과 **같은 승인 이중 구현** + `temp_admin_id` 하드코딩 **실버그** |
| E4 | audit()→emit 이관 | `summary`(한국어 서술) 손실 — read 재구성이 설계지만 **`labels.py` 라벨 엔트리 선행 필수**, 누락 시 감사 화면 summary 조용히 빔 |
| E5 | stream 라우트(router_v5·legacy) | behavior.stream+aow keeper(설계 일치) |
| **E6** | cron 호출 핸들러 3개(send_schedule_reminders·send_client_schedule_reminders·apply_expired_downgrades — 검증: 호출자 cron뿐) | **모양은 "단순 래퍼"지만 언랩하면 cron 쓰기 조용히 유실**(cron `_run_locked`는 커밋 안 함, body가 커밋 소유). **언랩 기준 = 모양 아닌 호출자**("behavior 경유로만 호출"만 자동 언랩). 이 3개는 계층 14-A(cron→transactional_uow)와 한 슬라이스 |

- `require_admin_role`→`require_role` **1:1 무손실 확인**(둘 다 membership 검사). `get_current_admin` 중복 제거도 안전(AdminContext가 신원 3필드 보장).

## §11 AI 호출 — 워크스루 결과 (검증 완료)

**핵심: 옵션2 "record_external_call 완전 제거"는 voucher 멀티모달 이주만으로 성립하지 않는다.** 비-멀티모달 용례 2축이 별도 게이트웨이 확장을 요구하는데 워크리스트에 없다.

### 예외 사례
| # | 위치 | 내용 |
|---|------|------|
| E1 | [ws_handler.py:104,113](../../../apps/api/app/modules/field_note/streaming/ws_handler.py#L104) | **라이브 스트리밍 STT** — AWS Transcribe 양방향 스트림을 웹소켓이 직접 구동. 게이트웨이 `transcribe*`는 전부 batch bytes-in이라 감쌀 수 없음. `AIGateway(AsyncSessionLocal)` factory 우회 직접 생성(quota 미배선) + `record_external_call` 영수증만. transport가 infra/stt라 D2 raw-grep에도 안 잡힘 |
| E2 | runtime 3서브시스템 + [form/template/handlers/generate_draft.py](../../../apps/api/app/modules/form/template/handlers/generate_draft.py) | 멀티모달 client 소비처가 voucher 단일 아님 — **6+곳**(voucher 3·form_template 2·form_generation 1·form module handler 1). form handler는 module→runtime **역방향 import**(이주 시 정상화) |
| E3 | record_external_call 소비처 **12파일**(검증: runtime 7·agent 2·field_note 2) | 특히 [pipeline_facade.py](../../../apps/api/app/modules/field_note/facade/pipeline_facade.py) diarize **길이기반 합성토큰 과금**(내부 기록 0토큰이라 여기서 실차감) — record 제거 시 과금 경로 붕괴. agent 2곳은 자체 LLM client 사용량 통합 |
| E4 | raw 텍스트 호출 ~7파일(agent/startup·selector·ai_lab 4·pipeline text-diarize) | 문서 집계와 일치 — `run_experiment`/`generate_text` 흡수 가능(곧장 OK) |

### 수치 정정
- "AIGateway 소비처 24" → **실측 17파일**(stale). 워크리스트 수치 정정.
- D3 non-uow ↔ tx 경계: **충돌 없음 확인** — 크레딧 precheck·차감 둘 다 이미 자체세션(요청 uow와 분리). Track B executor도 게이트웨이를 uow 밖 취득이라 AIFacade(non-uow) 그대로 성립.

### 의사결정 필요 (Q1~Q5)
| Q | 질문 | 선택지 |
|---|------|--------|
| **Q1** | 라이브 스트리밍 STT(E1)를 어디에 두나 — 이 결정 없이 D2 "예외 0"·record 제거 미성립 | (i) 예외 명시(record는 라이브 스트림 한정 잔존, D2 완화) / (ii) 게이트웨이 `transcribe_stream()`(async-generator transport) 신설 — 규모 큼 |
| **Q2** | diarize 합성토큰 과금(E3) | (i) `transcribe_with_diarization`가 길이→토큰 과금 내부 흡수(D3 취지, 권장) / (ii) AIFacade 별도 과금 메서드 |
| **Q3** | agent 자체 client 2곳 | (i) experiment/override로 게이트웨이 이관(전면) / (ii) record 잔존 허용(agent rebuild까지 유예) |
| **Q4** | 멀티모달 이주 스코프 | (i) 6+곳 전부 동시(D2 완성) / (ii) voucher만 먼저(부분 — runtime에 client 잔존=D2 위반 지속) |
| **Q5** | 크레딧 precheck TOCTOU(체크→차감 사이 잔량 소진 가능, 기존 동작) | (i) 현 갭 유지(문서화만) / (ii) 예약(reserve) 도입 — 신규 설계 |

## §12 runtime R1 — 워크스루 결과 (검증 완료)

**두 repo(voucher_extraction·form.extraction)는 `add`+조회뿐 — update 계열 메서드 0(검증).** → facade + update primitive **동시 net-new**. executor write 전수 → 도출 메서드: `mark_completed(id, payload)` · `mark_failed(id, reason)` · `append_artifact_document(id, doc_id)`.

- 예외: `flag_modified`(JSONB in-place mutate)는 repo `update_fields`(UPDATE…RETURNING) 방식으로 옮기면 **불요** — 단 read-modify-write 조립(`_build_completed_payload`·artifact append)이 facade/service로 이동. `save_*.py`의 `repo._session.flush()` private 접근도 함께 소멸.
- 곧장 가능: voucher `save_*.py`의 global_document write는 **facade 이미 존재** → reroute만(form executor.py:77이 참고 패턴).

## §13 core — 워크스루 결과 (검증 완료)

**대부분 값-동일 비파괴 치환(곧장 가능)**: `role.code == "ADMIN"` 11곳 + `_ADMIN_ROLES` + role_facade 2곳 → RoleCode. permission 예시 스테일 3~4곳. **AdminRole 파생 순환 없음 확인**(auth/dependencies→admin_account.models 안전).

### 예외(blocker)
| # | 위치 | 내용 |
|---|------|------|
| E1 | [query_catalog.py:121 (검증)](../../../apps/api/app/runtime/agent/select/query_catalog.py#L121) | `_ROLE_CODE_ENUM=["COUNSELOR","MANAGER","STAFF"]` — **STAFF가 RoleCode에 없음**. agent 쿼리 도구가 존재하지 않는 role을 제시 중(드리프트 or 실존 예정?) |
| E2 | session `ParticipantType` vs case `ParticipantRole` | 값 동일(client/counselor)·클래스명·컬럼명(participant_type/role) 상이. raw 비교 ~15곳 |
| E3 | schedule_facade:277 `datetime.now().date()` · billing 2곳 | bare 로컬 tz — utc_now 치환 시 **KST 날짜 경계 하루 어긋남**(의미 변경). billing `:34` `datetime.now(KST)`는 의도적 keeper |

## §14 worker — 워크스루 결과 (검증 완료)

**전 항목이 결정 종속** — 곧장 가능 0.

| # | 발견 | 내용 |
|---|------|------|
| E1 | [check_cross_module_import.py:26 (검증)](../../../.claude/hooks/check_cross_module_import.py#L26) | `MODULE_OF_FILE`이 **modules/만 매칭** → worker 파일=owner None=**면제**. paths 추가만으론 부족 — "ownerless-but-checked" 로직 개조 필요 |
| E2 | STREAM_CONFIG(설계 예시) 실재 안 함 | 실제는 per-프로세스(realtime `__main__`=reclaim None / batch.py=ON). 주석 위치 결정 필요 |
| E3 | scheduled.py:28 `notification.helpers` import | `dispatch_single_notification`은 **대응 handler 없음** — 신설 vs helper를 인프라 프리미티브로 인정 |

## §15 infra — 워크스루 결과 (검증 완료)

**곧장 가능**: ghost 3개 삭제(빈 골격+pyc뿐 최종 확인)·storage print→logger·email base ABC 신설·settings 경계화 3계열(token/jwt·scheduler·email/smtp — 생성자 주입 국소).

### 예외
| # | 위치 | 내용 |
|---|------|------|
| E1 | cache `manager.py:55` 모듈 전역 `redis_manager` 싱글톤 | cache/factory + worker/factory **2곳이 전역을 직접 import** — factory 주입 전환은 소유권 이전(구조 변화), 단순 시그니처 아님 |
| E2 | storage `s3/client.py` | download만 core 예외로 래핑, upload/delete/list_versions는 **ClientError 누출**. 래핑 대상도 core 예외라 15-4 "자기 계약 예외"와 불일치 |
| E3 | anthropic `messages/client.py:45` | try/except 전무 — SDK 예외 전량 raw 누출 |

---

## 의사결정 큐 (사용자) — 최종 필터 적용 (2026-07-05 재검토)

> 초판 D1~D19에 "기존 결정·관례·기본값으로 풀리는가" 필터(이 loop의 규율)를 적용 — **15건 해소, 진짜 열림 4건**.

### 사용자 결정 (2026-07-05 확정 3건 + D3 심화 중)
| # | 계층 | 결정 |
|---|------|------|
| **D1** | 11 | **확정: (ii) `transcribe_stream()` 지금 신설** — 게이트웨이에 스트림형 API(async generator). 완전 단일화 + 스트리밍 quota 미배선 문제도 해소. **D8 자동 확정 = 멀티모달 6+곳 전부 이주**(옵션2 완전 성립). behavioral 별 슬라이스 |
| **D3** | 10 | **확정: (A) carve-out + 후속 분해** — 심화 재해부로 18→4 축소(reject 6=이미 정본 eventing §7·behavior 호환 / SAVEPOINT=호환+cron 소관). **진짜 blocker 4파일**(run_batch_compare 4커밋·delete_relation·finish_recording·create_analysis 각 2)은 예외 목록 명시 후 주작업(~480 단순형) 즉시 진행. run_batch_compare 분해=별 이니셔티브, create_analysis=8-4 자연 해소 가능성, 2커밋 2곳=실행 시 정독 판단 |
| **D10′** | 13 | **확정: (i) RoleCode에 STAFF 추가** — 사용자 확인(접수/행정 역할 실존). 초대 API가 STAFF 수용 시작(behavioral) + role_permission STAFF 권한 세트 정의 동반 |
| **D17** | 10 | **보류 — 문서화만(사용자)**: [center_application/router.py:66,82](../../../apps/api/app/modules/center/center_application/router.py#L66) 승인/거절 심사자가 `"temp_admin_id"` 문자열로 저장 중(감사 추적 죽음). `ctx`(authenticate_admin)에 실신원 이미 있어 수정은 몇 줄. **계층 10 admin 이관 슬라이스에서 이중 구현(platform_admin canonical과 중복) 정리와 함께 해소** — 그때까지 심사자 기록 오염 계속됨을 인지하고 보류 |

### 해소 — 기본값 확정 15건 (근거 명시, 이의 있으면 뒤집기)
| # | 확정 | 근거 |
|---|------|------|
| D2 | diarize 과금 = transcribe 내부 흡수 | 기왕 결정 D3(과금 게이트웨이 수렴)의 귀결 |
| D4 | cross-module 경계 = **top-module 기준** | hook `MODULE_OF_FILE`이 이미 top-module 판정 — 기존 강제가 결정함 |
| D5 | AST 자동 언랩 + **호출자 기준** 화이트리스트 | E6이 기준 확정(모양 기준=cron 유실) |
| D6 | tx 제거 먼저 → admin 이관은 labels.py와 한 슬라이스 | canonical 실증(독립) + 라벨 선행조건 |
| D7 | agent 자체 client = rebuild까지 유예 | 사용자 기왕 결정("agent 제외") |
| D8 | 멀티모달 스코프 = **D1의 조건부 귀결로 강등**(재검토 2차) | 옵션2는 스코프를 "voucher"로 인식하고 내린 결정 — 워크스루가 6+곳(3 서브시스템)으로 3배 확장. D1=(ii) 완전 게이트웨이면 전부 이주, D1=(i) 예외 인정이면 부분도 정합. **D1 답이 정한다** |
| D9 | R1 = 이산 메서드(mark_completed/failed/append) | 4-D one-use-case 결 + repo primitive 관례 |
| D11 | 참여자 enum 통합 불요 — 각 repo가 자기 모듈 enum 참조 | raw 15곳 정리는 지역 enum으로 충분(통합은 별개 cosmetic) |
| D12 | **잠재 버그 플래그로 재프레임**(재검토 2차): bare `datetime.now()`=서버 로컬 tz — 컨테이너 TZ=UTC면 현재 "오늘"이 **이미 UTC 날짜**(KST 의도 시 자정±9h 창에서 날짜 어긋남 진행 중일 수 있음) | 조용한 관례 치환 아님 — 실행 시 schedule_facade:277 맥락 정독 후 KST 명시(=behavioral 버그픽스) or utc 의도 확인. billing fallback 2곳은 utc_now() 무해 |
| D13 | cron 발송 = application handler 신설 | 기왕 결정 14-5("worker→modules 직접 금지, handler 정본") |
| D14 | hook = ownerless-but-checked 개조 | 단순 구현 선택(전용 분리는 중복) |
| D15 | cache 싱글톤 factory 전환 = 유예 | 구조 변화·저가치 — 필요 시점에 |
| D16 | SDK 래핑 = **계열 예외가 7종 상속**(`StorageNotFoundError(EntityNotFoundException)`) | 13-2 규칙과 합성 — 계약+HTTP 매핑 둘 다, 트레이드오프 소멸 |
| D18 | 자기-도메인 repo 직접 10+ = 별건 | surgical scope(application.md §4 별도 슬라이스) |
| D19 | 크레딧 TOCTOU = 현 갭 유지+문서화 | 예약 도입=미요청 신규 설계 |

## 곧장 가능 (무결정) — 실행 착수 즉시 가능 목록

- **§9**: PersonClient/MemberClient/CenterClient 신설(get+`list_by_ids` 필수) → credential 쌍 파일럿.
- **§10**: 단순 tx 래퍼 언랩(압도 다수) — **단 기준은 호출자**(behavior 경유만; cron 호출 3개 제외, E6) · `require_admin_role`→`require_role` 49곳(1:1 무손실 + **in-place 성립 검증**: 전 라우트가 authenticate_admin behavior 보유라 request_admin 이관 안 기다려도 됨) · `get_current_admin` **중복** 제거(3겹 스택 한정; 단독 23곳은 admin 이관 본체).
- **§11**: raw 텍스트 ~7파일 흡수 · "24→17" 수치 정정 · 11-5 역참조 제거.
- **§12**: global_document write reroute(facade 기존).
- **§13**: RoleCode 치환 11+2곳 · permission 예시 스테일 3~4곳 · AdminRole 파생(순환 없음).
- **§15**: ghost 3개 삭제 · storage print→logger · email base ABC · settings 3계열 주입.
