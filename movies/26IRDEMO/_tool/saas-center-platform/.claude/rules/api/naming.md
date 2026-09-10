---
paths:
  - "apps/api/app/modules/**"
  - "apps/api/app/application/**"
---

# 명명 — 온톨로지 정합 (동사 통제어휘 + 계층 전이)

> 실측 근거: 전 모듈 서비스 파일 ~700개 동사 분포 조사(2026-07-08). 이 문서의 어휘는 발명이 아니라 **현행 지배 패턴의 성문화**다.

## 원칙

**같은 실세계 사건은 코드 어디서도 같은 이름으로 불린다.**

"상담사가 일지를 제출한다"는 URL에서 이벤트까지 **submit** 한 단어로 흐른다:
`POST /field-notes/{id}/submit` → `submit_field_note_handler` → `SubmitFieldNoteService` → event `"field_note_submitted"`.
레이어마다 이름이 갈리면(URL=finalize, service=save, event=done) 읽는 사람이 셋이 같은 사건임을 재증명해야 한다 — 그 증명 비용이 온톨로지 부채다.

두 진단이 모두 Yes면 정합: ① 도메인 전문가(상담사·관리자)가 UI에서 부르는 한국어 동작명과 대응하는가. ② 전 레이어에서 같은 단어인가.

## 소유권 — 이 문서가 정하는 것 / 위임하는 것

| 관심사 | 정본 |
|---|---|
| **동사 통제어휘 + 계층 간 동사 일관** | **이 문서** |
| **URL path 형태** | **이 문서** |
| 필드명 아키타입 (`memo`·`expires_at`·`{noun}_type`…) | [persistence-model.md §4](persistence-model.md) |
| repo 메서드 접두 (`get_`/`find_`/`list_`/`add`/`update_in_center`…) | [persistence-repository.md §2](persistence-repository.md) |
| DTO 접미 (`{Noun}Create`/`{Noun}Response`…) | [schema.md §1](schema.md) |
| 서비스 구조 (`{Verb}{Noun}Service`·`execute`·파일 1:1) | [service.md §1](service.md) |
| facade 메서드 형태 (`{verb}_{noun}`·`*_with_response`) | [facade.md §1·§2](facade.md) |
| 이벤트명 리터럴 규약 (`{entity}_{act}`) | [eventing.md](eventing.md) — 시제·어휘는 본 문서 §3 |

충돌 시 각 정본이 이긴다. 이 문서는 **그 사이를 잇는 축**(같은 동작이 레이어를 건널 때 이름이 어떻게 변형되는가)만 소유한다.

---

## 1. 명사 — 모델 클래스명이 진원지

| 레이어 | 형태 | 예 (`FieldNote`) |
|---|---|---|
| SQLAlchemy 모델 | 도메인 명사 그대로, 기술 접미 없음 | `FieldNote` (`FieldNoteEntity`·`FieldNoteModel` 금지) |
| 서비스 | `{Verb}{NounPascal}Service` | `SubmitFieldNoteService` |
| 스키마 | `{NounPascal}{역할접미}` | `FieldNoteResponse` |
| 핸들러 | `{verb}_{noun_snake}_handler` — **풀 엔티티 명사, 서브모듈 문맥 단축 금지**(디렉토리가 말해줘도 이름이 말한다). agent TOOL명 = 함수명 동일(전역 유일 식별자 — 전수 정렬 2026-07-10, 예외는 `TOOL['fn']` 탈출구) | `submit_field_note_handler` |
| URL segment | **복수 kebab-case** | `/field-notes` |
| 이벤트명 | `{noun_snake}_{verb_past}` | `field_note_submitted` |

- **명사 드리프트 금지** — 같은 엔티티를 레이어마다 다른 명사(session↔record↔item)로 부르지 않는다. 축약·약자 금지.
- 명사가 길어도 그대로 간다(`counseling_session_participant`) — 일관이 간결보다 우선.

## 2. 동사 통제어휘 (controlled vocabulary)

**이 표에 없는 동사를 새 서비스·엔드포인트에 도입하려면 loop 결정 로그에 항목을 추가하고 이 표를 갱신한다** — 어휘는 닫혀 있고, 확장은 기록을 남긴다. 한국어 글로스 = UI·도메인 전문가 언어와의 대응(온톨로지 검증 축).

### 2-A. CRUD — 엔티티 수명

| 동사 | 한국어 | 뜻 | 비고 |
|---|---|---|---|
| `create` | 생성·등록 | 새 엔티티 탄생 | repo `add`로 전이(§3) |
| `get` | 단건 조회 | 1건, 부재=404 | |
| `find` | 단건 조회(부재 허용) | 1건, 부재=None — 호출자 분기 | get의 쌍 — repo 접두와 동일 시맨틱(부재가 정상 상태인 조회: 주 보호자 부재 등). 2026-07-10 등재 |
| `list` | 목록 조회 | 컬렉션 | 검색·필터 포함(`search_` 금지) |
| `update` | 수정 | **필드 값 변경** | 생명주기 이동이면 상태전이 동사(§2-B)로 — CRUD 위장 금지 |
| `delete` | 삭제 | soft delete | repo `remove_in_center`로 전이 |
| `restore` | 복구 | soft delete 해제 | |
| `upsert` | 저장(멱등) | 있으면 갱신, 없으면 생성 | 의도가 진짜 upsert일 때만 — create가 실제 upsert면 위반 |
| `duplicate` / `clone` / `copy` | 복제 | 기존을 원본으로 새 엔티티 | 모듈 내 하나로 통일(셋 혼용 금지) |
| `initialize` | 초기 구성 생성 | 개설 시 시드성 일괄 생성(역할·운영시간·검사 등) | [facade.md](facade.md) §2·[application.md](application.md) 기정식 — 표 누락분 소급(2026-07-10) |
| `record` | 계량·이력 기록 | 사용량·횟수 등 계량 사실 기록(다운로드 수·LLM 사용량) | 원자 증가는 repo `increment_*`로 전이 — service 표면은 record. 2026-07-10 등재 |
| `query` | 유연 조회 | 다중 필터·필드 선택형 조회 (agent 도구 표면) | list(고정 형태 목록)와 구분 — eventing.md query_audit 기정식 소급. 2026-07-10 등재 |
| `reorder` | 순서 변경 | 표시 순서 전건 재배열(드래그) | UI "순서 변경". 2026-07-10 등재 |

- **다건 연산 = 복수명사**(`delete_schedules(ids)`) — `_batch` 접미·`bulk_` 접두 마커 불요, list 인자가 이미 고지한다. `bulk_`는 단건 반복과 계약이 다른 전건교체(`bulk_update_operating_times`)에만.
- **query(총체 쿼리)의 형태 계약**(전 필드 optional·`fields` 필수·write 권한 불가)은 `core/tool_loader.validate()`가 빌드타임 강제 — 표시는 `query_` 접두가 정본, 별도 마커 필드 없음. 2026-07-13 등재.

#### 쿼리 표면 정렬 어휘 (`sort` 파라미터 — 2026-07-13 등재)

agent 쿼리 표면의 정렬 값은 UI 정렬 토글의 한국어와 대응하는 **합성 어휘**(기준+방향 한 단어)를 쓴다.
SQL 어휘(`asc`/`desc`·`order_by`)는 표면 금지 — §3 원칙("repo 경계에서만 어휘가 바뀐다")의 정렬판으로,
handler가 도메인 값→저장 방향으로 1회 전이한다.

| 값 | 한국어 | 뜻 |
|---|---|---|
| `latest` | 최신순 | 대표 시간축 내림차순. **시간 엔티티 기본값** — tool output에 "기본 정렬: 최신순" 계약 명시 |
| `oldest` | 오래된순 | 대표 시간축 오름차순 |
| 수치(순번 제외) `{noun}_low`·`{noun}_high` | 가격 낮은·높은순 | **완결** — 수치 아키타입(순번 `*_number/_index/_order`·version 제외)마다 자동. `resolve_sort`가 컬럼 매핑 |
| 사건 시점축 `{event}_earliest`·`{event}_latest` | 임박·여유순 | **완결** — 시점 필터 완결이 연 사건축(`issued`·`due`·`valid_until`·`published` 등)마다 자동. `earliest`=이른 시점 먼저(asc), `latest`=늦은 시점 먼저(desc). 대표축은 무표 `latest`/`oldest`가 이미 커버 — 사건축만 접두. `resolve_sort`가 컬럼 매핑 |

- 대표 시간축("무엇의 최신인가")은 파라미터가 아니라 output 계약 문구로 명시.
- 도메인 서수(회기 번호 등)는 정렬이 아니라 필터로 — "첫 회기" = `session_number` 조건, `oldest` 아님.
- **정렬 완결**(2026-07-20, 옛 '실측 후 등재' opt-in 폐기 · 2026-07-31 사건축 3원 확장): sort는 필터·투영처럼 아키타입 유도 — `latest`/`oldest`(대표축, 모든 query) + 수치 `_high/_low`(순번 제외) + **사건축 `{event}_earliest/_latest`**(시점 필터 완결이 연 사건축마다). **`limit⇒sort`**(절삭-선행 금지 표면판 — 정렬 없는 limit=임의 첫 행). 배선 정본 = `infrastructure/persistence/agent_query.resolve_sort`(2026-07-29 core에서 이전), 감사 = `sort_completeness_gaps`. 이름(자유텍스트)은 정렬 아님 — 동명이인 모호.
- **시점 필터 완결 ↔ 사건축 정렬 완결 = 완전 대칭**(2026-07-21 필터 / 2026-07-31 정렬): 시점축은 **거를 수 있으면 정렬도 할 수 있어야** 한다(투영 완결 "거르면 보여야"의 정렬판). 대표 시간축(`date_from/to` created 무표)은 필터 + 무표 `latest/oldest`. 사건축(`{event}_from/to`: issued·due·valid_until·published 등)은 필터 + `{event}_earliest/_latest`. 유도원이 하나(사건축 필터 = 사건축 정렬) — 한쪽만 열면 비대칭(정렬은 쓰는데 필터 못 씀 = 알림 '이번주' 에러 / 거르는데 정렬 못 함 = e9 U2 대표축 오용 실측 0/5). 감사 = `date_filter_completeness_gaps` + `sort_completeness_gaps`(짝). `created_at`은 SYSTEM이라 커버리지 제외되나 대표 축은 예외 요구. 절제 = **필터가 연 축만** 따라감(새 축 아님 — 필터가 이미 감수한 폭). e9 실측: 사건축 정렬 추가가 대표축·수치 정렬 무열화(confusability 0), calling 10/10.

#### 쿼리 필터 유도 규칙 (2026-07-13 등재)

총체 쿼리의 **필터와 기본 출력**은 tool별 발명이 아니라 **모델 필드 아키타입에서 기계적으로 유도**한다
(발명 여지 제거 = 어휘 드리프트·누락·환각 파라미터의 구조적 차단, lab 실측 59→78%).
한 아키타입이 "어떻게 거를까"(필터)와 "무엇을 보여줄까"(기본 출력)를 함께 정한다.

| 필드 아키타입 | 필터 형태 | 기본 출력 | 어휘 규약 |
|---|---|---|---|
| 분류 (status·`{noun}_type`·role) | 동명 param | 포함 | enum + UI 한국어 gloss 필수 ('진행 중'→active) |
| 시점 (`{사건}_at`·`{noun}_date`) | `{사건}_from` / `{사건}_to` 쌍 | 포함(대표 시점) | 축 이름 = 도메인 사건명(issued·due·hire). created는 무표 `date_from/to` |
| 수치 (amount·price·duration·count) | `{noun}_min` / `{noun}_max` 쌍 | 포함(정의값) | |
| 이름·코드 (name·code) | 동명 param 부분매칭 | 포함 | '호칭 제거' gloss |
| 짧은 텍스트 (memo·description·title) | `keyword` 하나로 통합(원칙) | opt-in(fields로만) | boundaries에 검색 대상 명시. 필드 특정 발화가 지배적일 때만 동명 param |
| 참조 (`{entity}_id`) | `{entity}_id` + `{entity}_ids` 쌍 | 포함 + name(D14) | "이름은 해당 query로 id 확인 후" 체이닝 gloss. `accounts`·`admin_accounts` 참조는 제외(신원 계층 WAIVER) |
| 소유 관계 테이블 far-side (참여자·담당 다형) | far-side별 `{far}_id` + `{far}_ids` 쌍 | 이름 투영(D14) | facade가 관계 테이블 역조인 흡수(케이스→참여자→`client_id`). 이름 필터 금지 — [agent-query.md](agent-query.md) 관계 필터 완결 |
| 불리언 (is_*·has_*) | 동명 param | 포함 | |
| 본문·파생·시스템 (schema·transcript·checksum·*_url) | 필터 없음 | 제외 | 질의 무의미 + 스키마 토큰 낭비 |

- 어휘·gloss·쌍 형태의 정본은 **이 표** — TOOL 스키마 조각은 각 handler 인라인(공유 파일 금지, [application.md](application.md) §1-1). 드리프트는 감사 스크립트가 검사.
- **관계 필터 완결**(2026-07-16): 필터 유도원은 자기 필드뿐 아니라 **선언된 관계 전부** — 위 참조 행(자기 FK)·소유 관계 테이블 far-side·다형 마커. 반쪽 노출(counselor_id만·client_id 없음)=슬롯 혼동 함정. 흡수는 far-side **id**만 — junction 스칼라(멤버십 `is_active`)는 흡수 아님(활성 고정, [agent-query.md](agent-query.md) 관계 불리언). 판정 계보는 [agent-query.md](agent-query.md) Cross-entity 필터.
- **투영 완결**(2026-07-20): "기본 출력" 열이 계약 — 필터 가능한 핵심 스칼라(수치·분류·시점·이름)는 기본 출력에 **포함**, 본문은 opt-in, 파생·시스템은 제외. "거를 수 있으면 볼 수 있어야 한다"(price로 거르는데 price가 안 보이던 결함). 상세 [agent-query.md](agent-query.md) 투영 완결.
- **안정 식별자 이중키**(2026-07-20): 참조 대상이 UUID 외 **안정·유일 코드**(enum=`role_code`, 업무=`case_code`)를 가지면 그 코드로도 필터(handler가 code→id 해소). **enum 코드는 분류가 참조를 이긴다** — `role_id` 컬럼이라도 `role_code` 노출(raw id 금지). 자유 텍스트 이름은 여전히 표시만 — **코드=유일이라 필터 안전, 이름=동명이인 모호라 금지**. 감사 `CODE_REFERENCE`가 강제(업무 코드는 발화 실측 후 등재).
- **파생 생명주기 분류**(2026-07-20): 상태가 컬럼이 아니라 타임스탬프로 **계산**되면(초대 pending/accepted/expired = `accepted_at`·`expires_at`+now) 모델에 `AGENT_DERIVED_STATUS` enum을 선언해 `status` 필터를 분류로 노출한다(repo가 계산, 컬럼 없음). 감사가 이 마커를 분류 유도원으로 인식 — 선언 없이 합성 불리언(`has_unpaid`류)으로 노출 금지.
- **커스텀 봉쇄**(surjectivity, 2026-07-20): 커버리지(누락 0, forward)의 짝 — 감사 `custom_param_gaps`가 **모든 TOOL param이 아키타입/레버에서 유도되는지**(유도표 밖 param=발명=갭) 역검사한다. 수치를 시점 어휘(`price_from` = `_from/_to`)로 노출·수치에서 합성한 불리언(`has_unpaid`)·컬럼 없는 합성 상태 등 발명 파라미터를 구조적으로 차단. 자기 PK 배치(`id`/`ids`)는 브리지 랜딩 레버로 등재.
- 커버리지는 감사 스크립트(`scripts/audit_query_filters.py`)가 모델×규칙 vs TOOL diff로 검사 — 필터·투영·**커스텀**(양방향).

### 2-B. 생명주기·상태전이 — 도메인 사건

"저장"이 아니라 "제출", "삭제"가 아니라 "취소"라면 그 단어가 정본. UI 버튼의 한국어가 판정 기준이다.

| 동사 | 한국어 | 반대어 | 뜻 |
|---|---|---|---|
| `submit` | 제출 | `retract` | 작성자가 확정 요청 |
| `confirm` | 확정 | — | 시스템·상대가 유효 확정 |
| `approve` | 승인 | `reject`(반려·거절) | 권한자가 심사 통과 |
| `request` | 요청 | — | 권한자에게 심사·처리를 청함 (응답은 approve/reject, 예: `request_verification`). 필드 `requested_at` |
| `accept` | 수락 | `refuse`(거부) | 받은 쪽이 응함 (초대·요청) |
| `cancel` | 취소 | `revert`(취소 철회) | 예정된 것을 무름. 이벤트 과거형 = **`cancelled`**(현행 통일) |
| `complete` | 완료 | — | 진행이 끝남 |
| `activate` | 활성화 | `deactivate` | 사용 가능 상태 on/off |
| `suspend` | 정지 | `reactivate` | 일시 중단 |
| `terminate` | 해지 | — | 계약·구독의 영구 종료 |
| `lock` | 잠금 | `unlock` | 접근 차단 |
| `promote` | 승급 | `rollback`(프로덕션 구성 이전 버전 복귀 — ai_lab) | 등급·역할·구성 상승/승격 |
| `revoke` | 폐기 | — | 발급물(토큰·권한) 무효화 |
| `expire` | 만료 | — | 시간 경과 종료 (필드는 `expires_at`) |
| `attend` / `no_show` | 참석 / 노쇼 | — | 세션 레벨 출결 전이 (철자 no_show — 2026-07-09 수렴, D14). **참여자 레벨 출결 값은 별개 keeper**(판정 2026-07-10): counseling participant는 5값 `attended\|absent\|late\|excused\|no_show` — absent(불참)와 no_show(노쇼)는 구분되는 제품 어휘라 수렴 금지. assessment participant의 2값 출석은 죽은 표면으로 소멸됨(회기 단위 attend/no_show가 정본) |
| `leave` | 이탈 | — | 참여자 자진 탈퇴 |
| `login` / `logout` | 로그인 / 로그아웃 | — | 인증 세션 개시/종료 (auth 도메인 사건 그 자체) |
| `rotate` | 회전 | — | 발급물(refresh token) 재발급 교체 — 보안 표준어. HTTP 표면 `/auth/refresh`·`refresh_token_handler`는 업계 표준어 keeper(내부 검증 단계는 validate — 판정 2026-07-10) |
| `resend` | 재발송 | — | 발송물(링크·결과지·서식)의 재전송 — 이벤트 `*_resent` 기존재, 동사만 소급 등재(2026-07-10) |
| `withdraw` | 회원탈퇴 | — | 계정 자진 탈퇴 — leave(참여자 이탈)와 별개 사건(2026-07-10) |
| `upgrade` / `downgrade` | 업그레이드 / 다운그레이드 | — | 구독 플랜 등급 이동 (UI 동일어) |
| `reserve` | 예약 | — | 미래 시점 발효 예약 (reserve_downgrade) |
| `remind` | 재알림 | — | 운영자가 미열람·미응답 대상에 재차 알림 발송 (audit 액션 notice.notify_remind 실측) |
| `warn` | 경고 | — | 운영자 경고 발송 — 상태 무변경, 감사 기록 사건 |
| `change` | 변경 | — | 자격증명·정책값의 이력형 교체 (change_password·change_rate — 필드 수정 update와 구분) |
| `intake` | 접수 | — | 내담자 유입 확정 — 케이스+회기 일괄 탄생 (UI "상담/검사 접수") |
| `start` | 시작 | `complete` | 파이프라인·분석 진행 개시 (atomic `.started`) |
| `finish` | 종료 | — | 녹음·스트리밍 세션 종료 — 레코더 프로토콜 어휘(start/pause/resume/finish, 모바일 WS 계약). assistant 턴 터미널(done/paused/abandoned 3형 공용 UPDATE)에도 확장(2026-07-22) |
| `claim` | 회수 | — | 멈춘 작업의 원자적 회수 — 읽기+지우기+상태전이가 UPDATE 한 문장(조건절이 이중 실행 방어). assistant 턴 재개(2026-07-22 등재), eventing outbox `claim`과 같은 결 |
| `apply` | 적용 | — | 최종 상태를 통째로 받아 서버가 diff 계산·반영 (`apply-edits`) |
| `retry` | 재시도 | — | 실패한 파이프라인·작업의 재시작 (failed 검증 후 전이) |
| `skip` | 건너뛰기 | — | 예정된 처리(파이프라인)를 의도적으로 생략 — SKIPPED 전이 |
| `deduct` | 차감 | — | 크레딧 등 잔액에서 사용량만큼 감소 (UI "크레딧 차감") |
| `clear` | 해제 | — | 플래그·상태 표식의 해제 (quota_exceeded 등 — unlock(잠금)·deactivate(비활성)와 별개) |
| `archive` | 보관 | `activate`(복원) | 비활성 엔티티를 보관 상태로 (내담자 archived — 2026-07-10 등재, 상태전이 3분해에서) |
| `force_logout` | 강제 로그아웃 | — | 운영자가 대상의 전 세션 무효화(token_version 증가) — logout(본인 종료)과 주체가 다른 사건 |
| `roll` | 기간 롤오버 | — | 만료 기간을 다음 기간으로 굴림 (roll_center_period·roll_credit_period) |
| `transition` | 상태 강제 전이 | — | 탈출구 전용 — 운영자/시스템의 파라미터화된 전이(force·reason 동반, SUPER_PLUS류). 도메인 사건의 정상 경로는 여전히 개별 전이 동사. §3 "위장 금지"는 update로 숨기는 것을 막는 규칙이고 transition은 전이임을 선언하는 이름이라 비충돌(판정 2026-07-10) |

### 2-C. 멤버십·관계 — create/delete와 의미가 다르다

| 동사 | 한국어 | 반대어 | 뜻 |
|---|---|---|---|
| `add` | 추가 | `remove`(제외) | **기존 엔티티를 컬렉션에 소속**시킴 (참여자를 케이스에, 내담자를 즐겨찾기에). 엔티티 탄생 아님 |
| `assign` | 배정 | `unassign` | 담당·역할을 지정 |
| `link` | 연결 | `unlink` | 두 엔티티 간 참조 관계 생성 |
| `register` | 등록 | `unregister` | 외부 대상을 시스템 목록에 편입 |
| `invite` | 초대 | — | 합류 요청 발신 (수신측은 accept/refuse) |
| `merge` | 병합 | — | 중복 엔티티 통합 |

**create vs add 판정**: 이 동작으로 세상에 없던 것이 생기나(create) / 이미 있는 둘이 소속 관계를 맺나(add). `add_participant`·`add_favorite`는 정당, 로그 레코드 생성에 `add_`는 위반(→ create).

### 2-D. 전달·공개

| 동사 | 한국어 | 뜻 |
|---|---|---|
| `send` | 발송 | 메시지·알림·결과를 수신자에게 |
| `publish` | 발행 | 불특정 다수에 공개 개시 |
| `notify` | 알림 | (reaction 내부 전용 — producer는 emit만, [eventing.md](eventing.md)) |
| `upload` / `download` / `export` / `import` | 업로드 / 다운로드 / 내보내기 / 가져오기 | 파일·데이터 이동 (download 소급 등재 2026-07-10 — upload의 짝) |
| `preview` | 미리보기 | 확정 전 산출물의 비영속 미리보기 (2026-07-10 등재) |
| `prefill` | 프리필 | 에이전트가 등록/수정 화면 폼을 대신 채운다 (제출 전, 읽기 허용·쓰기 금지) — 화면-fill 도구 표면. TOOL에 `page_path` 마커, 핸들러가 fill 인터페이스 반환 (2026-07-22 등재). 대상 해소용 조회는 허용(`uow` 선언 시 주입, 2026-08-11) — 저장은 사용자 화면에서만 |

### 2-E. 검증 — 3분법 (check 금지)

| 동사 | 반환 | 뜻 |
|---|---|---|
| `verify` | `None`, 위반 시 raise | 불변식 강제 — 통과 못 하면 흐름 중단 |
| `validate` | 결과 객체(경고·위반 목록) | 판정 수집 — 호출자가 결과로 분기 (예: 일정 충돌 경고) |
| `is_*` / `exists_*` | `bool` | 사실 질의 |
| ~~`check`~~ | — | **금지** — 위 셋 중 뜻에 맞는 것으로. "현재 상태 계산"이면 `get_*_status` |

### 2-F. 계산·파생 (조회도 변경도 아닌 것)

| 동사 | 뜻 |
|---|---|
| `calculate` | 수치 산출 (점수·요금) |
| `aggregate` / `count` | 집계 (repo 계열과 동일 어휘) |
| `generate` | 콘텐츠 생성 (문서·요약·AI 산출물) |
| `analyze` / `transcribe` / `refine` | AI 파이프라인 처리 단계 |
| `run` | 두 결 등재: ① 다단계 파이프라인의 전체/재개 실행 — 개별 스텝 개시(start)와 구분(완료 스텝 skip 후 순차 실행, field_note run_pipeline). ② 단발 모델 실험 시행 — 프롬프트/모델+입력을 1회 호출해 결과 저장, 재개 없음(ai_lab run_llm/stt/chain_experiment — 유보 해제 2026-07-10, 문맥으로 갈림) |
| `compare` | 완료된 실험 결과들의 사후 비교 계산 — 품질/비용/속도 지표를 뽑아 best/lowest/fastest 요약(순수 함수, 실행 동반 없음 — ai_lab build_comparison_summary. 2026-07-10 등재) |
| `build` / `prepare` / `render` | 조립·준비·출력 형태 변환 |

- 파일명은 **항상 `{verb}_{noun}`** — 명사 단독 파일명(`scoring.py`·`summary.py`·`diarization.py`) 금지 → `calculate_score`·`summarize_*`·`diarize_*`.

### 동명 충돌 해소 규약 (2026-07-10 — 잠재 15쌍 정리에서 성문화)

기본명(`{verb}_{entity}`)의 주인은 **owning 모듈의 표준 CRUD 핸들러**다. 충돌 상대가 접미/명사 확장을 진다:

| 충돌 상대 | 처방 | 예 |
|---|---|---|
| app-layer 크로스모듈 조립본 | 의미 접미 — 단건 상세 `_detail` · 목록 조립 `_enriched` · 조립 내용 명시 `_with_{x}` | `get_member_detail`·`list_clients_enriched`·`create_program_with_members` |
| 행위자 특수(운영자) | `admin` 명사 결합 | `list_admin_accounts`·`change_admin_password` |
| 이모듈 의미 충돌 | 실제 대상의 풀 엔티티 명사 | form `list_form_templates` vs messaging `list_message_templates`, `list_global_documents` |
| 레거시 병행 표면 | `legacy` 명시 | `create_legacy_payment`(payment_records 묘비 결) |

## 3. 계층 전이표 — 한 사건, 다섯 표면

동사는 전 레이어 **불변**. 변하는 건 형태(대소문자·접미)뿐.

| 표면 | 형태 | 예: 생성 | 예: 제출(상태전이) |
|---|---|---|---|
| URL | `POST /{nouns}` / `POST /{nouns}/{id}/{verb}` | `POST /field-notes` | `POST /field-notes/{id}/submit` |
| handler | `{verb}_{noun}_handler` | `create_field_note_handler` | `submit_field_note_handler` |
| facade | `{verb}_{noun}` (`*_with_response`) | `create_field_note` | `submit_field_note` |
| service | `{Verb}{Noun}Service` | `CreateFieldNoteService` | `SubmitFieldNoteService` |
| repo | **repo 어휘로 전이** (§소유권) | `add` | `update_in_center(status=…)` |
| event | `{noun}_{verb_past}` | `field_note_created` | `field_note_submitted` |

- **repo 경계에서만 어휘가 바뀐다** — repo는 도메인 사건이 아니라 저장 연산(add/update/remove)을 말한다. 그 외 레이어에서 동사가 바뀌면 드리프트.
- 이벤트 과거형: created/updated/deleted/submitted/confirmed/**cancelled**/assigned/restored/approved/rejected — 현행 관례 유지.

### URL 형태

```
POST   /{nouns}              생성
GET    /{nouns}              목록 (검색·필터 = query param)
GET    /{nouns}/{id}         단건
PATCH  /{nouns}/{id}         필드 수정
DELETE /{nouns}/{id}         삭제
POST   /{nouns}/{id}/{verb}  상태전이·도메인 사건 (submit·confirm·cancel…)
POST   /{nouns}/{id}/restore 복구
```

- 상태전이를 `PATCH` body의 status 값으로 위장하지 않는다 — 동사 segment로 명시.
- 동사 segment의 메서드 = POST 기본. 예외는 **소멸형 전이**(withdraw·leave — 멤버십/계정 자체가 사라지는 사건)만 REST 관례대로 DELETE 허용(`DELETE /me`·`DELETE /members/me/leave`, 판정 2026-07-10). validate·preview·export 등 안전 동사 GET/POST는 정당.
- URL 동사는 핸들러의 사건과 일치해야 한다 — `DELETE /downgrade/reserve`가 cancel을 수행(사건 정반대)하던 결함을 `POST /downgrade/cancel`로 교정(2026-07-10).
- 동사 segment는 통제어휘의 kebab-case. 복합어는 kebab(`/revert-cancel`), `mark-`·`do-`류 조동사 접두 금지.
- 컬렉션 상태전이(대상이 id 아님)는 `POST /{nouns}/{verb}`(예: `/notifications/read-all`).
- 다건 연산 URL = **`batch` 통일**(2026-07-09 결정): 다건 생성 `POST /{nouns}/batch`, 다건 동사형 `POST /{nouns}/batch-{verb}`(예: `/sessions/batch-update`, `/payments/batch-delete`). `bulk` segment 폐기 — `bulk_`는 전건교체 계약의 코드 접두로만(§2-A).
- 단건 반복/파일 유입은 별개: 엑셀 등 외부 데이터 유입은 `/import-from-{source}`(import 어휘).


## 4. 드리프트 탐지 — 기계 검사

모듈 감사 시 순서대로:

```bash
# 1. 금지·요주의 동사 서비스 (manage/save/process/handle/check + 명사 파일명)
ls {module}/*/services/ | grep -E '^(manage|save|process|handle|check|do)_|^[a-z]+\.py$'

# 2. 서비스 동사 ↔ 핸들러 동사 대조 (서비스 파일명 목록과 handlers/ 파일명 diff)
diff <(ls {module}/*/services/) <(ls {module}/*/handlers/)

# 3. 상태전이 위장: update 서비스가 status만 바꾸는지 정독
grep -l "status" {module}/*/services/update_*.py

# 4. 이벤트명 시제·명사 일치
grep -rhoE '"[a-z_]+"' --include='*.py' {module} | grep -E '_(create|update|delete|cancel)d?"'

# 5. TOOL 도구명 전역 중복 (registry 가드는 노출 도구만 — 미노출 read까지 전수, 인용부호 무관)
grep -rhoE "[\"']name[\"']: .[a-z_]+_handler" --include='*.py' app | grep -oE '[a-z_]+_handler' | sort | uniq -d

# 6. 비-POST 메서드에 얹힌 전이 동사 segment (2026-07-10 축 추가 — PATCH/DELETE/GET에 숨은 전이는 #1~#5로 안 잡힘)
#    데코레이터가 다중행일 수 있어 URL 문자열로 잡고 위 문맥행의 메서드를 본다.
#    검출 후 수동 판정: 소멸형 DELETE(§3) · 안전 동사(validate|preview|export|search|download) · 묘비(legacy_*) 는 keeper
grep -rnB3 -E '"/[^"]*/(reorder|submit|confirm|cancel|approve|reject|complete|activate|deactivate|archive|reserve|apply|retry|skip|restore)"' --include='*.py' app | grep -E '\.(patch|delete|get)\('
```

판정 순서: ① 이름이 통제어휘에 있나 → ② 뜻이 표의 정의와 맞나(create인데 upsert?) → ③ 전 레이어 동일한가 → ④ UI 한국어와 대응하나.

### 리네임 잔재 grep — 식별자만으론 부족

필드·메서드 리네임의 완료 게이트는 `.py` 전체에서 **세 형태** 모두 0이어야 한다:

```bash
grep -rn "\b{old}\b" app tests     # 식별자 (속성·변수) — tests/scenarios 포함(4종 게이트 밖 스크립트가 잔재 온상)
grep -rn "{old}=" app tests        # kwarg 호출부 — 시그니처만 바꾸면 TypeError로 잠복
grep -rn "\"{old}\"\|'{old}'" app tests # 문자열 리터럴 — dict 키·agent specs·폼 필드
grep -rn "'{old}'" ../web/src           # 도구명·이벤트명은 프론트 계약 — web 리터럴도 잔재 대상 (표 전멸 실증 2026-07-26)
```

핸들러 리네임은 추가로: 한글 인접 참조는 `\b`가 안 걸리므로 substring 확인, `services/` 동명 파일 경로 오염 주의, tests/ stale import는 AST 스윕(`importlib.util.find_spec`)으로 검증.

실증: `note`→`memo` 컬럼 리네임(2026-07)이 kwarg(`note=`, assessment update_case)와 리터럴(`"note"`, agent specs 2곳)을 놓쳐 잠복 TypeError 3건 — 식별자 grep만 통과하고 런타임에 깨졌다.

## 5. 현행 keeper — 재론은 판정 대장으로

- **파이프라인·전달 결과 기록 `mark_completed`/`mark_failed`/`mark_login_notification_notified`** (form·voucher extraction·notification reaction) — [runtime.md](runtime.md) R1 net-new 설계(2026-07)의 의도적 어휘. repo 접두 `mark_` 금지([persistence-repository.md](persistence-repository.md) §폐기)와 별개 — 워커가 파이프라인 결과를 기록하는 내부 서비스에 한해 keeper.
- **event 아웃박스 repo의 `mark`/`claim`/`succeed`/`fail`** — eventing 도메인 어휘([eventing.md](eventing.md) 정본).
- `set_default_*`(기본 지정)·`mark_as_read`(읽음 처리) — UI 동작명과 대응이 검증되면 keeper, 아니면 대체 후보. 모듈 도달 시 개별 판정.
- ai_lab의 `run`/`compare` — **유보 해제, §2-F 등재 완료**(판정 2026-07-10: run=단발 실험 시행, compare=사후 비교 계산 — 실측 후 사용자 승인).
- URL keeper 2건(2026-07-10): 웹 자동완성 `GET /clients/search`(핸들러·facade는 list_by_filters로 정명 — URL만 웹 계약 유지) · 내부 크론 `POST /internal/subscriptions/process-expirations`(핸들러는 apply_expired_downgrades로 정명 — URL은 외부 운영 크론 호출 가능성 있는 내부 계약).

## 안티패턴

| 위반 | 정본 |
|---|---|
| `SaveFieldNote` / `ProcessPayment` / `ManagePrompts` | 도메인 동사로: `SubmitFieldNote` / `ConfirmPayment` / 동작별 분리 |
| `check_quota` / `check_*_status` | `verify_`(raise) / `validate_`(결과) / `is_`·`exists_`(bool) / `get_*_status`(조회) |
| 로그·레코드 생성에 `add_` | `create_` (add는 멤버십 전용 §2-C) |
| `create_`인데 실제 upsert | `upsert_` 명시 또는 분리 |
| 상태전이를 `update` + status body로 위장 | 상태전이 동사 + `POST …/{verb}` |
| 명사 단독 서비스 파일명 (`scoring.py`) | `{verb}_{noun}` |
| 핸들러 명사를 서브모듈 문맥으로 단축 (`get_template` — 무슨 템플릿?) | 풀 엔티티 명사 (`get_message_template`) — 동명 이모듈 충돌 실증(form vs messaging) 2026-07-10 |
| 명사 실종 핸들러 (`set_default_handler` — 무엇을?) | 대상 명사 포함 (`set_default_message_template`) |
| 같은 엔티티를 레이어마다 다른 명사로 | 모델 클래스명 하나로 |
| 통제어휘 밖 동사를 조용히 도입 | loop 결정 로그 + 이 문서 갱신 후 사용 |
