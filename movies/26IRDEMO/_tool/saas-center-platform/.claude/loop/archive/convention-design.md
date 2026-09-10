# 컨벤션 설계 loop — 설계 먼저, 실행은 한 번

계층별 표현·컨벤션·어휘를 통일한다. 방식: 먼저 전 계층의 구체 설계를 예시 코드로 문서화하고, 완료·승인되면 그 설계대로 한 번만 리팩토링한다. 계층 간 리플을 코드 만지기 전에 설계로 다 푸므로 이중 터치·재방문이 없다.

> ## ⚑ 새 세션 이어받기 (먼저 읽어라)
>
> **상태(2026-07-07): 설계 → 실행(Step 1~4) → 검수(14/14 문서·~420 발견) → 수정슬라이스(P0~P3 소진) → buildout 소진 완료. 남은 = Step 5(사용자) + 이월 + 분리4 이니셔티브.**
> - **수정슬라이스 SSOT = [inspection-findings.md](convention-design/inspection-findings.md) §종합 우선순위** — P0(스코프·실버그)·P1 판정(전건 닫힘)·P2 기계적·P3 문서 전부 해소. buildout(§08 producer ledger·§09 Client) **전건 완료**: 내담자 SMS send-key(Redis SET NX)·9-4 Person/Member Client 슬라이스·emit 없는 producer 설계정본 전환(assessment refuse/noshow/revert + support 문의 + bulk 초대, notify→reaction).
> - **판정으로 닫힌 것**: 9-4 큰 모듈 Client = **phantom**(진짜 cross-module read는 파일럿+answer_inquiry로 소진) · behavior-audit-fix = **완료**(get_audit_logger 버그 구조적 제거, 잔여 ai_lab만=분리4) · notice emit = 이미 done(stale였음).
> - **저가치 layering 폴리시 = 소진(2026-07-07, 사용자 지시)**: application handler raw repo → facade(notice·voucher·client read·subscription·answer_inquiry write) + AIFacade `*args,**kwargs`→명시 시그니처. **부수로 실버그 2건 적발·수정**: ① member 초대 inviter 이름 항상 "관리자"(invited_by=account_id인데 get_person 조회, 452ad7869) ② subscription `update_in_center` center_id 누락 → cron/change_plan 분기 실행 시 TypeError(c173257b5, 유닛이 repo mock이라 은폐됐던 것).
> - **남은 작업**: ① Step 5(main 머지 — 사용자 몫) ② 이월(X1 1566·X2 소급·2-A 저우선 — hook이 신규·수정 코드 점진 수렴, 소급은 별 cosmetic 슬라이스) ③ 분리4 이니셔티브(agent rebuild·field_note·billing·ai_lab — loop 밖, Step 5 후 해금). **in-scope buildout = 소진.**
> - 라이브버그 1건은 이미 수정·커밋됨(assessment 예외 500 → `fix` 커밋 f8eb383).
> - 계층별 설계 = [convention-design/](convention-design/)`NN-*.md`. 실행 전 예외·결정 상세 = [execution-walkthrough.md](convention-design/execution-walkthrough.md).
> - 설계 여정(sweep→top-down 감사→13·14·15 신설→적대검토→재설계→워크스루→결정)의 전 기록은 **git 히스토리**(docs 커밋 0cbad4d 및 그 이전)와 각 NN 파일 안 정정 주석에 있다 — 이 문서는 최종 상태만 담는다.

## 작업 규율 (설계 사이클에서 검증된 것 — 실행에도 그대로)

- 명백한 것(rule-확정·기왕결정·keeper)은 질문 없이 결정·기록. **모호한 것만** 사용자에게 — 반드시 실코드(file:line)+쉬운 설명 동반.
- **에이전트·survey 발견 = 검증 전 미확정.** 근거 grep으로 ground-truth 후 반영. (이 loop에서 오판 다수 실증: audit() 0→61, stream 유실 오판, 유령작업 등.)
- **"비파괴" 주장은 의심.** 비파괴라던 것 다수가 행위변경으로 판명(admin 값비대칭·role casing·포맷터 벡터드리프트). 파괴성은 실코드로 재분류.
- **tx 래퍼 언랩 기준 = 모양이 아니라 호출자.** behavior 경유로만 호출되는 핸들러만 언랩(cron 호출 핸들러 언랩 = 조용한 쓰기 유실).
- **결정의 사실 기반이 바뀌면 자동 연장 금지.** 스코프가 커지면(예: 멀티모달 1→3 서브시스템) 그 결정을 재확인.
- 기존 결정과 교차확인 — 이 문서의 결정 표 + [architecture-refactor.md](archive/architecture-refactor.md) + 메모리.

## 두 산출물 분리 (SSOT — [claude-files.md](../rules/claude-files.md))

| 문서 | 담는 것 | 언제 |
|------|---------|------|
| [rules/api/*](../rules/api/) | 일반화된 패턴·이유 (짧게, 1패턴=1파일) | canonical 확정 시 |
| 이 파일 | 프로세스 + 최종 인덱스 + 실행 계획 | 실행 슬라이스마다 갱신 |
| `convention-design/NN-*.md` | 계층별 구체 설계 — before→after 예시코드·리플·워크리스트 | 설계 시 생성·누적 |
| [execution-walkthrough.md](convention-design/execution-walkthrough.md) | 실행 전 예외 대장(§9~§15 전건 검증) + 의사결정 D1~D19 최종 | 실행 중 예외 발견 시 추가 |

## 설계 원칙 (실행 시 대조 기준)

- 실제 파일 기준 — `module/file:line` 근거 + before→after 코드.
- 리플을 끝까지 적는다 — 상위 caller 영향 계층·파일까지 명시.
- 파괴적 변경 분리 — 마이그/프론트 계약 건드리는 변경은 비파괴와 분리 표기, 별도 슬라이스.
- canonical 불명 = 멈추고 사용자.

---

## 계층 인덱스 — 최종 상태

| 순 | 계층 | 설계 파일 | 정본 rule | 핵심 결정 (최종) |
|----|------|----------|----------|------|
| 1 | Schema/DTO | — `[생략]` | [schema.md](../rules/api/schema.md) | 소비처(router/handler)가 DTO 소유. 2-A Enum→DTO도 소비처 작업 |
| 2 | Persistence Model | [00](convention-design/00-field-archetypes.md)·[02](convention-design/02-persistence-model.md) | [persistence-model.md](../rules/api/persistence-model.md) | 어휘 아키타입 14항목(⑤′ reference_table_name·⑭ 다형·2-A enum 전역·⑤″ _by_name 제거) + 구조 C/E/F |
| 3 | Repository | [03](convention-design/03-repository.md) | [persistence-repository.md](../rules/api/persistence-repository.md) | base `_get`/`_insert`·JoinablePostgresRepository(admin read-model)·기계적 3건 |
| 4 | Service | [04](convention-design/04-service.md) | [service.md](../rules/api/service.md) | X2 `*`·phase 전면·docstring 제거·파일분리·execute rename(~20, 4-D 분할 포함) |
| 5 | Facade | [05](convention-design/05-facade.md) | [facade.md](../rules/api/facade.md) | 로직→Service·Model mutate→repo update(8 facade)·Service 우회 ~35 |
| 6 | Application | [06](convention-design/06-application.md) | [application.md](../rules/api/application.md) | 크로스도메인 read→9-4 client(D1 뒤집기 supersede)·side-effect→BG·tx래퍼=계층10 |
| 7 | Router | [07](convention-design/07-router.md) | [router.md](../rules/api/router.md) | 주 타깃 이미 정합. field_note 이중 behavior 병합·인라인가드 3·agent 변형 keeper |
| 8 | Eventing | [08](convention-design/08-eventing.md) | [eventing.md](../rules/api/eventing.md) | ~98% 정합. 위반 4건 기계적. Track B enqueue-seam은 별 이니셔티브 |
| 9 | Cross-module | [09](convention-design/09-cross-module.md) | [cross-module-write.md](../rules/api/cross-module-write.md) | `{Module}Client` = READ 전용 DTO(경계=top-module). 실측: Person·Member·Center 3개 + batch 필수 |
| 10 | Behavior/Server | [10](convention-design/10-behavior.md) | [behavior.md](../rules/api/behavior.md)·[server.md](../rules/api/server.md) | tx래퍼 제거 ~480(호출자 기준)·admin 3겹 언탱글 ~140(라벨맵 선행)·carve-out=멀티커밋 4·reject=정본 |
| 11 | AI 호출 | [11](convention-design/11-ai-calling.md) | (신설) `ai-calling.md` | AIFacade(non-uow)→AIGateway→infra/llm. 옵션2 완전단일화 + **transcribe_stream 신설(D1)**·diarize 과금 흡수(D2)·record_external_call 제거(12파일) |
| 12 | Runtime | [12](convention-design/12-runtime.md) | (신설) `runtime.md` | R1만 실작업 = voucher_extraction·form.extraction **facade+service net-new**(mark_completed/failed/append). R2·R3 비-agent 0(오분류 정정). agent=rebuild 별건 |
| 13 | core 커널 | [13](convention-design/13-core.md) | (신설) `core.md` | permission만 core SSOT. **role=3축 각 모듈 소유**(RoleCode+STAFF·참여자 enum·AdminRole+LEGACY). feature=DB 동적(core는 오타가드만). 예외=7종 상속 규칙(버그 수정됨) |
| 14 | worker consumer | [14](convention-design/14-worker.md) | (신설) `worker.md` | 2-Track+스케줄러 축. tx 2정본(cron→`use_cron_action`, **계층10 선행**)·shutdown 저우선·**retry=Track A outbox 일원화**(enqueue-seam 선행) |
| 15 | infrastructure | [15](convention-design/15-infrastructure.md) | [infrastructure.md](../rules/api/infrastructure.md) 강화 | DB세션 무소유 불변식·ghost 3 삭제·settings 경계화(4계열)·봉인 예외=대상 계열만(storage/anthropic/cache/worker)·messaging keeper |

## 완전 커버리지 매트릭스 (미소유 표면 0)

| 영역 | py | 소유 계층 |
|------|---:|----------|
| `modules/**` 1824 · `application/**` 244 | | 2~9 |
| `infrastructure/**` 100 | | 15 · 3(persistence) · 11(llm/stt) |
| `runtime/**` 98 | | 12 (agent=rebuild 별건) |
| `behavior/**` 18 · `server/**`+main 7 | | 10 |
| `worker/**` 17 | | 14 |
| `core/**` 12 | | 13 |
| `agents/`·`security/`·`infrastructure/agent/` | 0 | ghost — 삭제 대상([15-7](convention-design/15-infrastructure.md)) |

## 가로지르는 규약 (cross-cutting)

| 결정 | 요지 | 상세 |
|------|------|------|
| **X1** 파라미터 폭발 | 정의 파라미터 한 줄에 하나+후행콤마(self-only는 인라인). 호출부 대상 아님. hook 신설 필요(현재 미실장) | — |
| **X2** `*` 배치 | 앞=필수 식별/스코프(id·center_id), 뒤=나머지(값·필터·옵션). repo·service 통일. repo §2·service §2 rule 개정 동반 | — |
| **X3** 별도 세션 | 핸들러의 두 번째 세션은 동시 커밋-스트림 분리(`side_uow`)만 정당. 요청밖=emit(워커)·내구성=reject | [12-5](convention-design/12-runtime.md) |
| ⑤′ 참조 마커 | `info={"reference_table_name": "<테이블명 복수>"}`. relations.py·ref_resolver 동반. center_id는 대상 아님(TENANT_ID) | [00](convention-design/00-field-archetypes.md) |
| ⑭ 다형참조 | `{concept}_id`+`{concept}_type`+`reference_type_field` 마커 | [00](convention-design/00-field-archetypes.md) |
| 2-A enum 전역 | 닫힌 값집합 → `str, Enum` + 파라미터 Enum 타이핑 + typecheck. DB=값 | [00·02](convention-design/00-field-archetypes.md) |
| 예외 규칙 | 신규 도메인 예외 = 매핑된 7종 상속(bare DomainException 금지). 안전망 400 등록됨 | [13-2](convention-design/13-core.md) |
| 강제 현실 | typecheck만 실동작. 9-4 hook=advisory(차단 아님, worker 확장 시 owner 로직 개조). X1 hook 미실장 | [13·14](convention-design/14-worker.md) |

## 확정 의사결정 대장 (전건 닫힘)

사용자 확정 4건 + 필터 해소 15건. 전체 근거·선택지는 [execution-walkthrough.md](convention-design/execution-walkthrough.md).

| # | 결정 |
|---|------|
| D1 | 라이브 스트리밍 STT = 게이트웨이 `transcribe_stream()` 신설(예외 인정 안 함 — 옵션2 완전 성립, 스트리밍 quota 배선 포함) |
| D3 | 멀티커밋 4파일(run_batch_compare·delete_relation·finish_recording·create_analysis) = carve-out 명시 + 후속 분해. reject 6=정본, SAVEPOINT=호환 |
| D10′ | `RoleCode`에 STAFF 추가(접수/행정 역할 실존) + role_permission STAFF 세트 |
| D17 | temp_admin_id = 보류·문서화 — 계층 10 admin 이관에서 이중구현 정리와 함께(그때까지 심사자 기록 오염 인지) |
| 해소 15 | D2 diarize 과금=transcribe 흡수 · D4 경계=top-module · D5 언랩=AST+호출자 화이트리스트 · D6 tx 제거 먼저 · D7 agent 유예 · D8=D1 귀결(전부 이주) · D9 이산 메서드 · D11 지역 enum · D12 잠재버그 확인 · D13 handler 신설 · D14 hook 개조 · D15 cache 유예 · D16 계열 예외+7종 상속 · D18 별건 · D19 갭 유지 |

---

## 전체 절차 (진입점 — 여기서 시작)

```
Step 0  선행 정리(loop 밖)  tmp-agent-v6 착지·머지 → 깨끗한 베이스
Step 1  Phase 0 무위험      결정·테스트 불요, 즉시
Step 2  Phase 1 저위험      독립 국소 슬라이스
Step 3  Phase 2 본작업      module-major 스윕 + tx 언랩 + admin 이관 (behavioral)
Step 4  Phase 3 net-new     R1·AI 게이트웨이·cron/retry·rule 4 신설
Step 5  완료 게이트          → 분리 이니셔티브 해금(agent rebuild 등)
```

각 Step은 앞 Step 완료가 진입 게이트(예외: Phase 0은 베이스만 있으면 Step 0과 병행 가능 — 겹침 없음). 슬라이스 공통 규율은 §스코프와 규율.

### 실행 현황 (2026-07-06 — tmp-agent-v7에서 실행, 사용자 지시로 Step 0 머지 생략)

**완료(커밋됨)**: Phase 0 전체 · Phase 1 전체 · tx 언랩 199+cron 3 · admin 이관 전 모듈(3겹 언탱글+emit 감사, 92파일) · temp_admin_id 수정 · use_cron_action+xact lock · rule 4 신설+X1/9-4 hook · ⑤′ 마커 119곳 · X2 rule 정정 · 5-4 facade mutate 6곳 · 4-D trial/free 분할 · 4-E rename 2. R1(extraction facade)·최종 게이트 진행 중.

**이월 대장 (이 run에서 의도적으로 남김 — 근거 포함)**:

| 이월 | 규모 | 이유 |
|------|------|------|
| X1 소급 폭발 | collapsed def **1566**(설계 추정 16의 100배) | 사실 기반 변경 → 재확인 규율. hook이 신규·수정 코드를 수렴시키므로 소급은 별도 cosmetic 슬라이스 |
| X2 `*` 소급 삽입 | execute ~463 + repo add/list | 호출부 kwargs 동반 대량 변경 — rule은 정정됨, 소급은 module-major 후속 |
| ~~어휘 파괴 마이그~~ **완료(2026-07-06)** | 17 슬라이스 | [00 §실행 대장](convention-design/00-field-archetypes.md) 전건 `[완료 <hash>]` — rule §4 반영·①~⑨ 리네임·③2-A Enum·⑭ 다형마커·⑤″·⑤-b 값수렴 포함. 잔여 소액은 00 완료 노트(2-A read-필터 ~20·entity_name=T2 이월) |
| 4-E 분할형 | message_template list/get·update_attachment·check_*_status·execute_or_none 등 6+ | 다중 메서드 = 4-D 분할 필요(rename 아님) |
| ⑤ `_by` 마커 누락분 | ~10 컬럼 | 참조 대상이 제각각(admin/member/person·String(10)도 존재) — 컬럼별 시맨틱 검증 필요, 맹목 마킹 금지 |
| 계층 2~8 module-major 잔여 | base `_get`/`_insert`·Joinable base·S1 직렬화·phase 마커 스윕 등 | 각 NN 워크리스트 — 후속 슬라이스 |
| pre-auth 라우트 의심 | admin login·verify-2fa·refresh·accept-invitation에 authenticate_admin 걸림 | **기존 상태**(이관이 만들지 않음) — 제품 확인 필요 |
| messaging admin emit 무dispatch·actor=None | 행위보존 유지 | ctx 신원 싣기는 별도 결정 |

### 스코프와 규율 (모든 Step에 적용 — 먼저 읽기)

**본 스윕이 건드리지 않는 것:**

| 구분 | 대상 | 취급 |
|------|------|------|
| **분리 4** (사용자 확정) | **agent**(`modules/agent`·`runtime/{agent,new_agent}`, rebuild 예정) · **field_note**(파이프라인·스트리밍·executor 7 — 돈+실시간) · **billing/정산**(`modules/billing`·크레딧 차감·정산 — 돈. 플랜/feature 설정은 스윕 유지) · **ai_lab**(내부 도구) | 스윕 전면 제외 → Step 5 후 자기 이니셔티브(가져가는 작업은 아래 분리 이니셔티브 표) |
| **carve-out** | 멀티커밋 잔여 2(delete_relation·create_analysis) · BG `AsyncSessionLocal` 9 · stream 라우트(behavior.stream+side_uow) · `_legacy_payment`(묘비) · cron `shutdown(wait=False)`(멱등 의도) · realtime `reclaim=None`(이중과금 방지, 주석 필수) | 실행 중 손대지 않음 |
| **T1 보호** | messaging 실발송 경로(알림톡/SMS — 오발송=고객 영향) | 스윕 포함하되 characterization 선행 + 독립 슬라이스 |
| **T2 발판** | eventing outbox · behavior DSL · UoW | 소비만, 개조 금지(개조는 seam·14-C 별건) |

**슬라이스 규율:** 슬라이스별 브랜치 · behavioral은 characterization 테스트 선행 · verify = 설계 예시와 동치 + 스코프 pytest green + boot(파괴적은 라우트 스냅샷 DIFF=0) · module-major(모듈당 Model→Router 한 슬라이스, 1 커밋) · "실행 시 확인" 항목(datetime.now 맥락·2커밋 핸들러 정독)은 그 파일 열 때 수행.

### Step 0 — 선행 정리 (loop 밖, 네 몫)

tmp-agent-v6의 기능 작업(agent v6·admin 화면 등) 마무리 → 커밋 정돈 → 머지. **게이트: main 안정 + 작업 트리 클린.** (이 loop 문서 최종본 커밋 포함.)

### Step 1 — Phase 0: 무위험 (결정 불요)

| 작업 | 계층 |
|------|------|
| ghost 3개 삭제(app/agents·app/security·infra/agent) + pyc 청소 | 15 |
| storage print→logger·반환 애너테이션 | 15 |
| RoleCode 치환 13곳 + STAFF 추가(D10′) + permission 예시 스테일 | 13 |
| 수치·스테일 정정(문서) | — |

**완료 게이트:** boot + 기존 테스트 green (신규 테스트 불요).

### Step 2 — Phase 1: 저위험 국소 (독립 슬라이스, 순서 자유)

| 작업 | 계층 | 비고 |
|------|------|------|
| PersonClient·MemberClient·CenterClient 신설(get+`list_by_ids` **batch 필수**) → credential 쌍 파일럿 | 9 | batch 없으면 notify_notice N+1 퇴행 |
| `require_admin_role`→`require_role` 49곳 in-place + `get_current_admin` 중복 제거(3겹 스택 한정) | 10 | 전 라우트 behavior 보유 검증됨 |
| global_document write reroute(save_*.py — facade 기존) | 12 | |
| AdminRole 단일 SSOT+LEGACY · 참여자 raw 15곳 지역 enum · datetime.now 3건(잠재버그 확인 D12) | 13 | |
| email base ABC · settings 경계화(token/jwt·scheduler·email — cache 유예 D15) | 15 | |
| SDK 예외 봉인 4계열(계열 예외+7종 상속, D16) | 15 | behavioral(예외 경로) |

**완료 게이트:** Client 파일럿(credential 쌍) 동작 확인 — Phase 2의 9-4 잔여 대체 전제.

### Step 3 — Phase 2: 본작업 (behavioral — characterization 동반)

| 작업 | 계층 | 선행 |
|------|------|------|
| 계층 2~8 워크리스트 module-major 집행(어휘 마이그·enum·repo base·facade 로직이동·X1/X2) — 분리 4 제외 ~25모듈 | 2~8 | 각 NN 워크리스트 |
| tx 래퍼 언랩 ~480 — AST 자동 + **호출자 기준** 화이트리스트(제외: cron 3·carve-out) | 10 | — |
| admin flow 이관 ~140 = labels.py 라벨맵 + `request_admin`+`emit(actor=admin)` 한 슬라이스 + **temp_admin_id·이중구현 해소(D17)** | 10 | 라벨맵 먼저 |
| 9-4 Client 잔여 대체 + hook worker 확장(owner 로직 개조, advisory) | 9·14 | Step 2 파일럿 |

**완료 게이트:** cron 핸들러 3개 tx-free 포함(→ 14-A 해금) · 감사 화면 summary 정상(라벨맵 검증).

### Step 4 — Phase 3: net-new·신설 (별 슬라이스)

| 작업 | 계층 | 선행 |
|------|------|------|
| R1: voucher_extraction·form.extraction **facade+service+update primitive 신설**(mark_completed/failed/append_artifact) | 12 | — |
| AIFacade + generate_multimodal(**voucher/form 분**) + record_external_call 제거(voucher/form 분만) | 11 | — (D1·D2·잔여 record는 분리 이니셔티브) |
| cron → `use_cron_action`(xact락) | 14-A | **Step 3의 cron tx-free** |
| retry Track A outbox 일원화(reaction 멱등성 선언) | 14-C | **enqueue-seam(별건) 완성 후** — seam 미완이면 이 항목만 이월 |
| rule 신설 4(core.md·worker.md·runtime.md·ai-calling.md) + X1 hook 신설 | 13·14·12·11 | 해당 실행 후 |

### Step 5 — loop 완료 게이트 → 분리 이니셔티브 해금

**완료 판정:** Phase 0~3 전 슬라이스 머지 + rule 4 신설(paths 앵커 활성) + 전체 pytest green + 라우트 스냅샷 DIFF=0(파괴 슬라이스 제외분 반영). 이때부터 분리 이니셔티브가 **완성된 컨벤션 플랫폼 위에서** 착수 가능:

| 이니셔티브 | 가져간 작업 (loop에서 인계) |
|------|------|
| **agent rebuild** | **태어날 때부터 canonical**(최종 rules·behavior·AIFacade·Client 사용, 사후 리팩터 없음) · 자체 LLM client 2곳→게이트웨이(D7) · **record_external_call 최종 제거** · router 4변형 정리(7-7) · 이중 런타임 통폐합(R4) · side_uow 유지(X3) |
| **field_note** | ~~전건 완료(2026-07-07)~~ — D1 `transcribe_stream`(90debddde)·D2→bill_diarize(8a12dbf48)·ws_handler record 제거(D1에 포함)·pipeline_facade 로직이동 5-1(a94c33f6d)+5-4(174156c88)·finish_recording=기해소 확인·text-diarize raw 흡수(bc6a74f12)·11-5 역참조(331da0045) |
| **billing/정산** | webhook settings 경계화·credit facade increment(5-4)·TOCTOU 문서화(D19) |
| **ai_lab** | run_batch_compare 이벤트 분해(D3)·raw 텍스트 흡수 4파일·experiment 스윕 |
| (기타 별건) | Track B enqueue-seam(8-4 — 14-C 전제) · cache 싱글톤 factory(D15) · staging system_admin 마이그 · **runtime 재구성 = 별도 loop [runtime-restructure.md](archive/runtime-restructure.md)**(문법 통일 + field_note 엔진 분리, 2026-07-07 설계 확정) |

- 분리 = 영구 면제 아님 — 각 이니셔티브가 **같은 설계 문서**를 자기 시점에 적용. rules는 그동안에도 자동 로드.
- **record_external_call 완전 제거의 최종 시점** = agent·field_note 이니셔티브 완료 후(본 스윕에선 voucher/form 분만).

---

## 커서

> **2026-07-07(4차 세션) — field_note 이니셔티브 인계분 전건 소진.** ① **D1 집행**(90debddde): 게이트웨이 `transcribe_stream`+`StreamingTranscription`(quota 사전체크→transport 취득→fed-bytes 길이 환산·`record_usage` 멱등 기록), ws_handler AIFacade 경유 전환(AIGateway 직접·record_external_call·raw provider 취득 제거, quota 초과=WS error). 유령 세션 eviction은 close()만(기존 무과금 보존). FIELD_NOTE_STT_STREAMING=FREE_PURPOSES라 현재 체크는 no-op이지만 유료화 시임 확보. **record_external_call 소비처 잔존 = agent 2곳뿐**(rebuild 소관). ② **11-5 역참조 해소**(331da0045): normalize_diarize+hallucination_filter → `infrastructure/stt/common/` 이동(게이트웨이→field_note 역참조 제거, 소비처 5 재배선). ③ **판정 — tx 언랩 안 함**: `async with uow` 래퍼는 field_note 밖에도 275파일 잔존하는 레거시-허용 패턴(application.md §2 명문, 메인 스윕도 의도적 잔류)이고, field_note 유일의 dispatcher 핸들러들은 **커밋-선행-dispatch가 load-bearing**(언랩 시 워커가 미커밋 상태를 읽는 race) — 모듈만 일괄 언랩할 근거 없음. docstring/phase/X1/X2 소급도 전역 이월과 동일하게 hook 수렴 위임. 검증: 슬라이스마다 boot 577 + 전 스위트 green(**332 passed**/59 skipped). **field_note 남은 것 = 없음(이니셔티브 종결). 전체 남은 것 = Step 5(사용자 머지)·분리3(agent rebuild·billing·ai_lab)·이월(X1/X2/2-A).**

> **2026-07-07(3차 세션 후반) — field_note 이니셔티브 착수(사용자 지시).** 표면 실측(~95파일 8.5k줄, 분리4라 스윕 미적용 상태) 후 작업 지도 확정: ① 5-1 pipeline 상태머신 ② 5-4 ORM mutate ③ D2 diarize 과금 ④ D1 transcribe_stream ⑤ module-major 잔여(tx 언랩 — 워커 호출 process_* 제외 필수, docstring/phase/X2). **집행 완료 2슬라이스**: 5-1 = PreparePipelineStepService+STEP_DEFS 신설, facade 5 prepare_* 복붙→prepare_step 단일 위임, `_note_data` 밀수 제거(app handler가 collect_note_data 별도 호출), characterization 21케이스 선행(a94c33f6d) · 5-4 = ORM mutate 12사이트 전건 repo update 전환(update_in_center 컬럼 7종 추가·audio update_in_place 신설·save_* 3서비스 primitive화·ws_handler 사후 mutate→생성 인자·고아 flush() 헬퍼 삭제)(174156c88). 검증: 슬라이스마다 boot 577 + 전 스위트 green(이제 **325 passed**/59 skipped — baseline 304+21). **D2 재확인 완료(사용자, 2026-07-07)**: 결정 당시 없던 text-diarize 경로 때문에 "transcribe 내부 흡수" 불성립 → **게이트웨이 `bill_diarize` 신설로 집행**(8a12dbf48) — 길이→합성토큰 환산·차감 게이트웨이 내부화, 3전략 공통 시임, pipeline_facade record_external_call 제거, ai-calling.md rule 갱신, 유닛 2 추가(**327 passed**). finish_recording 멀티커밋은 기해소 확인(단일 커밋+사후 dispatch — 잔여 아님). **다음 세션 = D1 transcribe_stream**(사용자 확정: 게이트웨이 스트림형 API + 스트리밍 quota 배선 + ws_handler AIFacade 경유 + record_external_call 흡수 — field_note 잔존 1곳은 ws_handler뿐) **+ ⑤ module-major 잔여**(tx 언랩은 호출자 검증 필수 — pipeline process_*는 워커 호출이라 언랩 금지, docstring/phase/X2).

> **2026-07-07(3차 세션) — 잔여 전건 판단, 집행 가능 in-scope 0 확정.** tmp-agent-v10에서 baseline 재검증(boot 577 · 304 passed/59 skipped — 불변). 잔여 재판정 결과 전부 "지금 안 하는 게 맞음": ① X1 소급(1931 실측) = 증분 이득 0·900+파일 diff — hook이 편집분 자동 수렴, 일괄은 자동화 설계+사용자 결정 필요 ② X2 `*` 소급 ~463 = 호출부 kwargs 파급 behavioral — module-major 수렴에 위임 ③ 2-A Enum 타이핑 = 어노테이션만 바꾸면 거짓 계약(String은 런타임 str) — SQLEnum/TypeDecorator+마이그+레이어 역전 해소 = 설계 결정 필요 ④ toss PlanType("") 방어 = 결제 미구현이라 보류 ⑤ 분리4 = Step 5 후 해금 ⑥ Step 5 = 사용자 몫. 코드 변경 0 — 새 방향(추가 검토·특정 모듈·프론트엔드 감사 등)은 사용자 결정 대기.

> **2026-07-07(2차 세션) — buildout 소진 + ② layering + 검토 발굴 실버그 7 + center_application 하드닝.** in-scope buildout 전건 완료: 내담자 SMS send-key(Redis SET NX)·9-4 Person/Member Client(answer_inquiry+AccountClient)·emit 없는 producer 설계정본 전환 5(refuse/noshow/revert/support/bulk, notify→reaction). **판정 닫힘**: 9-4 큰 모듈 Client=phantom·behavior-audit-fix=완료(get_audit_logger 구조적 제거)·migrations=단일 head 확인·notice emit=이미 done. **사용자 지시 ② 저가치 layering 전건 집행**(notice·voucher·client·subscription·AIFacade·answer_inquiry facade 경유) — 손대니 은폐 실버그 2 적발(subscription update_in_center center_id 누락 TypeError·member 초대 inviter 이름). **검토 phase(병렬 agent 대거 rate-limit thrash→인라인 재확인)로 실버그 7 발굴·수정**: subscription_facade transition NameError·assessment_case registered_at(없는 컬럼)·update_case ×4 None-deref·center_application create/cancel account_id/person_id 불일치(엔드포인트 100% 깨짐)·update_program member_ids null·list_user_centers 신청 silent-empty. 오탐(voucher)·저우선(tombstone·toss·TOCTOU) 기각. **center_application 전체 감사**(approve/reject 정상 확인) + reviewer_person_id→reviewer_account_id 하드닝. 로컬 커밋 35, boot 577·304 tests green. **남은 = 이월(X1/X2/2-A)·분리4·Step 5·toss 방어(미구현이라 보류).**

> **2026-07-07 — 검수 완료 게이트 통과 + 수정슬라이스 집행 + buildout 착수.** 검수(14/14·~420발견) 후 findings §종합 우선순위대로 일괄 수정: **P0**(스코프 강제 9·실버그 5) → **P1 판정 전건 닫힘**(사용자 결정 2건+필터+P1-2차 11건 A~I+04-9 다중repo 판정) → **P2 기계적**(docstring/phase 191파일·main() dead·_service rename·Model mutate→repo ~27·find→get 11·dict→primitive 11·중복 use-case 3쌍·S1 .build 4) → **P3 문서·rule 정정**(스테일 ~30·factory 접미사 규약). 이어 **buildout**: 내담자 SMS send-key(Redis SET NX, 7006a959b)·9-4 Client Person/Member 슬라이스(answer_inquiry 이관+AccountClient 신설, 5622c6012)·emit 없는 producer 설계정본(notify→reaction) 전환 assessment 트리오(refuse/noshow/revert — 42cac996f·f1fa7a2ca·230330005). migrations 단일 head 확인(멀티 head 노트는 오기 정정). **남은 = buildout 잔여(9-4 큰 모듈 Client·producer 3종)+behavior-audit-fix(별건)+Step 5(사용자).**
>
> **2026-07-06(3) — 어휘 이월 전건 집행 + 최종 유닛 게이트 통과.** 00 §실행 대장 17/17 완료(rule 반영 55c3bacd3 → ⑤-b 52c33496a, 마이그 9개·웹/어드민/모바일 동반). Enum 전환이 실버그 2건 적발·정정(assessment delete_case 집계값 불일치), ⑤-b가 load-bearing 2곳 재배선(승인 플로우 person 해석·AI 귀속 분리)·non_operating 센티넬→is_system_registered. 최종 유닛 게이트: 드리프트 테스트 전건 정리 + conftest 자가치유 → **전 스위트 300 pass/0 fail/0 error**(9941045a6). **다음 = Step 5(main 머지) → 분리 이니셔티브 해금.**
>
> **2026-07-06(2) — 실행 phase 주행(Step 1~4 실질 완료).** 사용자 지시("모든 loop 종료까지 중단 없이")로 tmp-agent-v7에서 연속 실행. **13 슬라이스 커밋**: Phase 0(ghost·RoleCode+STAFF·storage·permission 예시) · Phase 1(Client 3+파일럿·AdminRole SSOT+LEGACY 행위보존·참여자 enum 38·datetime 3·email/token/scheduler 주입·SDK 봉인 4계열) · tx 언랩 199(호출자 기준 — agent executor·worker 커밋 소유 검증 후) · **admin 이관 전 모듈**(3겹→request_admin+emit(AdminAuditAtomic), 92파일) · cron use_cron_action(xact lock+핸들러 3 tx-free 동슬라이스)+temp_admin_id 수정 · rule 4 신설+X1 hook 신설+9-4 hook worker/runtime 확장(6케이스 검증) · ⑤′ 마커 119+X2 rule 정정 · 5-4 facade mutate 6 · 4-D trial/free 분할 · 4-E rename 2 · **R1**(extraction facade/service 신설, ORM mutation 잔재 0) · **P3-2**(멀티모달 transport→infra/llm+generate_multimodal, voucher/form record 사용처 0). 검증: 슬라이스별 compile+boot·OpenAPI 424경로·행위보존 스팟체크. **이월 대장은 §실행 현황**(X1 소급 1566=설계 추정 100배→재확인 규율·X2 소급·어휘 파괴 마이그·4-E 분할형·_by 마커·2~8 잔여·pre-auth 의심). 최종 유닛 게이트 진행 중.
>
> **2026-07-06 — 설계 완결 + 스코프·절차 확정.** 계층 2~15 설계 + 적대검토 + 워크스루 + 의사결정 19→4→0. 라이브버그 1 수정·커밋(f8eb383). **분리 4 확정**(agent rebuild·field_note·billing/정산·ai_lab — 돈·실시간·rebuild 리스크가 본 스윕에서 전부 빠짐) + **전체 절차 Step 0~5 확정**(선행 정리→Phase 0~3→완료 게이트→분리 이니셔티브 해금). **다음 = Step 0(tmp-agent-v6 착지), 그 후 Step 1은 결정 없이 즉시.** 설계 여정 로그는 git 히스토리(0cbad4d 이전)에 보존.

---

## 검수 phase — 설계↔코드 전수 대조 (실행 후 감사)

실행이 끝난 코드가 각 계층 설계 문서와 실제로 일치하는지 **파일 단위 손검수**한다. 문서 하나 = 검수 단위 하나 = agent 하나(대형 표면은 모듈 묶음 배치로 나눠 같은 행에 누적). 검수는 **읽기 전용** — 발견은 [inspection-findings.md](convention-design/inspection-findings.md)에 기록만 하고, **전 문서 검수 완료 후 발견 대장을 일괄 슬라이스로 수정**한다(검수 중 수정 금지 — 이중 터치 방지).

**검수 규율:**
- agent는 대상 파일을 **하나씩 Read로 정독**한다 — grep 매칭만으로 정합 판정 금지(파일 나열에만 glob 허용).
- 대조 기준 = 해당 NN 설계 문서 + 정본 rule. keeper·carve-out·분리 4(agent·field_note·billing·ai_lab)는 위반이 아님 — 발견 시 "면제"로 분류.
- 발견 형식: `file:line · 설계 조항(§) · 현행 · 기대 · 파괴성(코드만/마이그/프론트)`.
- agent 발견 = 검증 전 미확정(§작업 규율) — 수정 슬라이스 착수 시 근거 재확인.

**진행률 (상태 열이 SSOT — 배치 완료마다 갱신):**

| 문서 | 대상 표면 | 파일 수 | 상태 | 발견 |
|------|----------|---:|:----:|---:|
| [00+02](convention-design/00-field-archetypes.md) 어휘+Model | `modules/**/models.py` (분리 제외) | 90 | `[완료]` | 13 |
| [03](convention-design/03-repository.md) Repository | `modules/**/repository.py` | 94 | `[완료]` | 62 |
| [04](convention-design/04-service.md) Service | `modules/**/services/*.py` | 520 (≈8배치) | `[완료]` | ~195 |
| [05](convention-design/05-facade.md) Facade | `modules/**/facade/*.py` | 55 | `[완료]` | 34 |
| [06](convention-design/06-application.md) Application | `application/**` | 179 (≈3배치) | `[완료]` | ~34 |
| [07](convention-design/07-router.md) Router | `modules/**/router.py` | 86 | `[완료]` | 23 |
| [08](convention-design/08-eventing.md) Eventing | `modules/**/events.py` + `modules/event/**` | 44 | `[완료]` | 6 |
| [09](convention-design/09-cross-module.md) Cross-module | 모듈 간 import 경계 스캔 + `application/clients` | 스캔 | `[완료]` | 7 |
| [10](convention-design/10-behavior.md) Behavior/Server | `behavior/**`·`server/**`·main.py | 21 | `[완료]` | 7 |
| [11](convention-design/11-ai-calling.md) AI 호출 | `modules/llm/**`·`infrastructure/{llm,stt}/**` | 51 | `[완료]` | 9 |
| [12](convention-design/12-runtime.md) Runtime | `runtime/**` (agent·new_agent 제외) | 28 | `[완료]` | 6 |
| [13](convention-design/13-core.md) core | `core/**` | 11 | `[완료]` | 5 |
| [14](convention-design/14-worker.md) worker | `worker/**` | 13 | `[완료]` | 3 |
| [15](convention-design/15-infrastructure.md) infrastructure | `infrastructure/**` (persistence·llm·stt 제외) | 63 | `[완료]` | 19 |

**완료 게이트:** 14행 전부 `[완료]` → findings 대장을 파괴성별로 묶어 일괄 수정 슬라이스(비파괴 코드→마이그→프론트 동반 순). 수정 후 findings 행에 해소 커밋 기록.

**집행 현황(2026-07-07):** 게이트 통과 — P0~P3 슬라이스 소진, buildout 잔여만 남음(§이어받기 블록 남은 작업). 슬라이스 순서·해소 커밋 상세 = [inspection-findings.md](convention-design/inspection-findings.md) §종합 우선순위.
