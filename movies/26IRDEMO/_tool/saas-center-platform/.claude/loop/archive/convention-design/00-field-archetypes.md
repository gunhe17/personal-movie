# 필드 아키타입 — 어휘·명명 divergence 결정 원장

908개 필드(고유 477) 전수 분석에서 "같은 역할, 다른 패턴" 포착. 상위 인덱스: [convention-design.md](../convention-design.md). 계층 2(Model) 설계에 편입.
실행 진행률은 하단 **§실행 대장**이 SSOT — 상태 열만 갱신한다.

상태: `[대기]` 결정 전 · `[확정]` 정본 결정 · `[보류]` 나중.
파괴성: `비파괴`(표기만) · `파괴`(컬럼 리네임=마이그+소비처).

| # | 역할 | 패턴 변형 | 정본 제안 | 파괴성 | 상태 |
|---|------|----------|----------|:------:|:----:|
| ① | 만료 시각 | `expires_at`(다수) · `expired_at`(assessment 2) | **`expires_at`** | 파괴(2건) | `[확정]` |
| ② | 전사 상태 | `transcribe_status`(field_note) · `transcript_status`(audio) | **`transcript_status`**(명사) | 파괴 | `[확정]` |
| ③ | 상태 저장 값(파이프라인) | none/pending/idle · processing/generating/started | **pending/processing/completed/failed** | 파괴(마이그+프론트) | `[확정]`(=2-B) |
| ④ | 타임스탬프 어휘 이탈 | `membered_at` · `notification_sent_at` · `verification_*_at` | **접두 제거·표준 동사** | 파괴 | `[확정]` |
| ⑤ | 행위자 참조 | `*_by: str`(비마커) · `*_id→ref`(마커) | **감사행위자=`{verb}_by`+account / 도메인역할=`{role}_id`+member. 마커 필수** | 혼합(아래) | `[확정]` |
| ⑤′ | 참조 마커 규약(전체) | `info={"ref": "<모델명>"}` (120곳) | **`info={"reference_table_name": "<테이블명 복수>"}`** | 비파괴(코드만) | `[확정]` |
| ⑥ | 종류 판별자 | `kind`(credential) · bare `type` · `*_type`(28) | **`*_type`** | 파괴 | `[확정]` |
| ⑦ | 서식 종류(template 아키타입) | `template_type` · `note_template_type` · `default_template_type` | **이름=`template_type` 통일, 값은 도메인별** | 파괴 | `[확정]` |
| ⑧ | 에러 내용 | `error` · `error_message` · `notification_error` | **`error_message`** | 파괴 | `[확정]` |
| ⑨ | 자유 메모 | `note` · `notes` · `memo` | **`memo`** (note=정식엔티티 전용) | 파괴 | `[확정]` |
| ⑩ | 범용 JSON | `meta` · `data` · `extra` · `payload` · `raw_response` | **`meta`=범용백(무변경), 목적성 payload는 keeper** | 비파괴 | `[확정]` |
| ⑪ | 비정규화 스냅샷 | `*_summary` · `*_snapshot` | **각 모듈 내 일관이면 유지(무변경)** | 비파괴 | `[확정]` |
| ⑫ | 순번/정렬 | `*_number` · `*_index` · `sequence` · `*_order` | **넷 유지, 선택 기준만 규약화** | 비파괴 | `[확정]` |
| ⑬ | on/off 플래그 | `is_*`(다수) · `channel_*` · `supports_*` | **`is_*` 정본 + supports_/channel_ 정당 패턴 인정** | 비파괴 | `[확정]` |
| ⑭ | 다형 참조 | `reference_id`/`item_id`/`participant_id`/`source_id`/`entity_id`... + `*_type`/`entity_name` | **`{concept}_id`+`{concept}_type` 쌍 + `reference_type_field` 마커** | 혼합 | `[확정]` |

결정은 하나씩 아래에 근거·정본을 적어 `[확정]`으로 갱신한다.

---

## 결정 로그

### ① 만료 시각 = `expires_at` `[확정]`
미래 만료 기한이므로 미래시제 `expires_at`. 대상 리네임: assessment `send_link.expired_at`·`send_result.expired_at` → `expires_at`(+ 마이그, 소비처 grep). 다른 `revoked_at`은 별개(취소 사건, 유지).

### ② 전사 상태 = `transcript_status` `[확정]`
명사형(형제 diarization/summary_status·audio와 일치). 대상: `field_note.transcribe_status` → `transcript_status`. field_note 6-status 전체 품사 통일은 별건(⑬류, 미결). refine_status는 그대로 둠(이번 범위 아님).

### ③ 파이프라인 status 값 = `pending`/`processing`/`completed`/`failed` `[확정]` · 파괴
**범위 = 비동기 처리 파이프라인 status만.** 도메인 생명주기(session `scheduled`/message `sent`/subscription `active`/client status 등)는 **제외**(각 도메인 어휘 유지).
- 대상 필드: field_note `processing_status`·`transcript_status`·`refine_status`·`diarization_status`·`note_status`·`summary_status` · field_note_audio `transcript_status` · form/extraction·voucher/extraction `status`.
- 매핑: 미시작 `none`/`idle`→`pending`, 진행 `generating`/`started`→`processing`, 완료 `completed`(유지), 실패 `failed`(유지).
- 실행: alembic 데이터 마이그(기존 행 값 치환) + 프론트 status 분기 수정 동반 → 실행 phase에서 **별도 파괴 슬라이스**. 2-A(Enum 도입)와 함께: Enum 값이 이 4지가 됨.

**Enum 타입 계약 (사용자 2026-07-02):**
- **홈 = models.py 공존** (messaging `MessageType`/`MessageStatus` 선례). core/type.py 아님(도메인별). 파이프라인은 `class FieldNoteStatus(str, Enum)` 등.
- **파라미터 타입 = Enum (A안)** — repo/service 시그니처 `status: FieldNoteStatus`. `@typecheck`가 `isinstance(v, FieldNoteStatus)`로 **유효 4값만 통과**(생 문자열·오타 차단). ③의 "값 도메인을 타입으로" 실현.
- **호출처 멤버화**: 지금 생 문자열(`"completed"`) 넘기는 전 호출처를 `FieldNoteStatus.COMPLETED` 멤버로 → ③ 실행 슬라이스에 포함(파괴).
- DB/JSON 저장은 값(`"completed"`) 그대로(str-Enum) — 직렬화 무변경.
- **비-파이프라인 Enum**(messaging 등 이미 str,Enum)도 같은 계약(파라미터 Enum 타이핑) 적용.

### ④ 타임스탬프 어휘 이탈 = 접두 제거·표준 동사 `[확정]` · 파괴
- `member_invitation.membered_at` → `accepted_at` (admin_account_invitation.accepted_at과 정렬).
- `billable.notification_sent_at` → `sent_at`.
- `person_credential.verification_requested_at` → `requested_at`, `verification_reviewed_at` → `reviewed_at`.
- **연계 미확정**: 같은 credential의 `verification_reviewed_by`(⑤)·`verification_reject_reason`·`verification_status`(⑥)도 접두를 떼야 그룹이 일관(status/requested_at/reviewed_at/reviewed_by/reject_reason). ⑤·⑥에서 함께 확정.

### ⑤ 행위자 참조 = info 마커 통일 (FK 금지의 대안) `[확정]`
**근본**: 사람이 여러 겹(person→account→member) + 운영자는 별 realm(admin_account). 단일 FK로 못 묶음(정책상 FK 금지이기도). 그래서 `created_by`가 모델마다 person/account/member/admin_account/센티넬로 제각각.
- **규칙 1 — actor 기준층 = 인증 주체.** 행위자는 `account`(센터) 또는 `admin_account`(운영자). person_id/member_id로 저장하던 것은 account_id로 수렴(그건 도메인 역할이지 행위자 아님).
- **규칙 2 — 마커로 계약 표현(FK 대신).** 사람 참조 필드는 `info={"ref": <대상>}` 필수. 감사성 행위 주체는 `info={"ref": "account", "actor": True}`.
- **규칙 3 — 혼합 realm만 다형.** 한 컬럼이 account/admin/system 섞이면 event 패턴 `actor_id + actor_type`(정본). 단일 realm이면 단일 ref 마커로 충분. 센티넬("SYSTEM"/"CENTER")은 id 자리 금지 → actor_type=system, id null.
- **이름**: `_by`(행위)·`_id`(역할) 의미대로 유지. 통일은 마커·기준층에서만.
- **파괴성**: ⑤-a(마커 부착)=비파괴 즉시 가능. ⑤-b(기준층 수렴 person/member→account, 센티넬 정리)=저장값 변경이라 파괴, 실행 phase 별도 슬라이스 + 다형참조 아키타입과 연계.

**⑤ 최종 확정 (사용자 2026-07-02, ⑤-b 프레임으로 정정):**
- **핵심 구분**: 감사 행위자 ≠ 도메인 역할 (⑤-b 참조). `_by` 통일은 **감사 행위자에만**.
- **감사 행위자** = `{verb}_by`, 기준층 = 인증 주체(`accounts`/`admin_accounts`), nullable(system=null). `created_by`·`changed_by`·`reviewed_by`·`invited_by`·`completed_by`·`promoted_by`·`triggered_by`·`submitted_by`·`answered_by` — 대부분 이미 `_by`. person/member 저장분 → account 수렴(파괴, ⑤-b).
- **도메인 역할** = `{role}_id`, 표시 대상(member/person/client) 유지. `counselor_id`·`recipient_id`·`client_id`·`member_id`, **그리고 `author_id`·`uploader_id`도 여기**(UI 표시되는 관계) → **`_id` 유지**(앞서의 authored_by/uploaded_by 리네임 **철회**).
- **마커**: `reference_table_name` (⑤′). `_by`는 이름이 이미 행위자를 말하므로 actor 키 불요.
- **혼합 realm**: event `actor_id + actor_type` 유지(정본). 센티넬("SYSTEM"/"CENTER") → actor=null.

### ⑤-b 행위자 기준층 = 감사행위자(account) vs 도메인역할(member) `[확정]` · 파괴
두 개념이 섞여 id 층(person/member/account)이 갈렸던 것. 렌즈로 분리:
| | 감사 행위자 | 도메인 역할 |
|---|---|---|
| 뜻 | 로그인한 누가 이 행을 만들/바꿨나 | 엔티티에 연결된 사람(상담사·작성자) |
| 기준층 | `account`/`admin_account`(인증 주체) | `member`/`person`/`client`(표시 대상) |
| 이름 | `{verb}_by` | `{role}_id` |
| null | 예(system=null) | 보통 아니오 |
- **다형참조 아키타입과 분리 확정**: 감사 행위자는 모델별 단일 realm(센터모듈→accounts, 운영자모듈→admin_accounts)이라 monomorphic → 마커 하나로 끝, 판별자 불필요. 진짜 다형은 event.actor(actor_id+actor_type 유지)·센티넬(→null)뿐. 일반 다형참조(participant_id/resource_id 등)는 **별개 미결**로 남음(행위자와 무관).
- **집행**: created_by 등 person/member 저장분 → account_id 수렴, 센티넬 → null. author_id/uploader_id는 리네임·기준층 변경 **없음**(도메인 역할, member 유지).

### ⑤′ 참조 마커 규약 = `reference_table_name` + 실제 테이블명 `[확정]` · 비파괴
전 `→ref` 필드에 적용(행위자 ⑤ + 일반 FK성 참조 + 다형참조). `info={...}`는 SQLAlchemy 파이썬 메타라 **DB 무관 → 마이그 불필요, 순수 코드 스윕**.
- **key**: `"ref"` → `"reference_table_name"` (정확한 의미).
- **value**: 모델명(단수 `member`) → **실제 테이블명(복수 `members`)**. `account`→`accounts`, `document`→`documents`, `assessment_case`→`assessment_cases` 등.
- **범위**: 76파일 ~120 마커.
- **소비처(반드시 동반 갱신)**: `infrastructure/persistence/relations.py`(`col.info.get("ref")`·`"ref" not in col.info` → 새 키, 값이 테이블명이 되므로 entity 해석 로직 점검) · `runtime/agent/mutation/ref_resolver.py`(ref 읽으면 갱신). grep `col.info.get("ref")` == 0로 검증.
- **verify**: boot OK · relations.py 관계 추출 동작 · `"ref"` 마커 잔재 0.
- **`center_id`는 ⑤′ 대상 아님 (예외 sweep 2026-07-04 결정)**: `relations.py`가 `TENANT_ID = {"center_id"}`로 **이미 별도 특수처리** — `info.get("ref")` 마커 경로와 분리. center_id는 멀티테넌시 스코프 컬럼(persistence-model §2)이지 "타모듈 도메인 참조"가 아니라 마커 불요. 66필드 무마커 = 정상.
- **actor `_by` 마커 누락 인스턴스** (sweep): `form/form.submitted_by`·`counseling_case_analysis.triggered_by` 등 `{verb}_by`인데 마커 없음 → ⑤ 감사행위자 마커(`reference_table_name:"accounts"`) 스윕 대상에 포함.

### ⑤″ `{actor}_by_name` 비정규화 = 제거 + read 재구성 `[확정: 예외 sweep 2026-07-04]` · 파괴
`answered_by_name`(inquiry)·`created_by_name`(cs_memo)이 actor 이름을 **작성 시점 토큰에서 박제**([create_memo.py:31](../../../apps/api/app/modules/platform_admin/cs_memo/services/create_memo.py#L31) `current_admin.get("name")`). eventing §10(actor 이름=read 재구성 live)과 충돌.
- **결정 = 제거 + read 재구성**: `AdminAccount`는 soft-delete only(hard_delete 0) → `answered_by`(id)→`AdminAccount.name` 조회가 **항상 안전**(이름 유실 불가). frozen 보존(⑪) 근거 소멸 → §10 live 지배. admin 표시면=read-model이라 JOIN 허용(§6.3).
- **keeper**: `billing/_legacy_payment.completed_by_name` = legacy 묘비, 무변경.

### ⑥ 종류 판별자 = `*_type` `[확정]` · 파괴
`{noun}_type` 관례(28개 다수)로 수렴. 대상: `person_credential.kind` → `credential_type` · `agent_message.type` → `message_type` · `agent_run.type` → `run_type`. 컬럼 리네임=마이그.
- **credential 그룹 최종형**(④+⑤+⑥ 종합): `verification_status`→`status` · `verification_requested_at`→`requested_at` · `verification_reviewed_at`→`reviewed_at` · `verification_reviewed_by`→`reviewed_by`(actor, ref admin_accounts 또는 실제 검토주체) · `verification_reject_reason`→`reject_reason` · `kind`→`credential_type`. 접두 제거로 그룹 일관.

### ⑦ 서식 종류 = `template_type` 아키타입 `[확정]` · 파괴
"템플릿(구조에 값 채워 산출)"은 하나의 아키타입 — `status`가 도메인마다 값이 다른 것과 동일 원리. **이름 통일, 값은 도메인별.**
- 이름: `field_note.note_template_type` → `template_type`(테이블이 도메인 암시, `note_` 잉여). `center_note_preference.default_template_type` → 유지(`default_`=기본값 역할 접두). `message_template.template_type` → 유지.
- 값 도메인: 일지서식 둘(field_note·center_note_preference)은 **같은 enum(`VALID_TEMPLATE_TYPES`) 공유 보장**. 메시지 종류는 별도 집합.

### ⑧ 에러 내용 = `error_message` `[확정]` · 파괴
대상: `llm_call.error` → `error_message` · `login_notification.notification_error` → `error_message`. (notification_log·messaging는 이미 error_message.)

### ⑨ 자유 메모 = `memo` `[확정]` · 파괴
**프론트 증거로 결정**(B→A 뒤집힘): 프론트가 자유텍스트를 백엔드명 무관 "메모"로 노출(billing `notes` 필드도 라벨 "메모"), "비고"는 2회뿐. "노트"(295)는 정식 Note 엔티티(상담일지/FieldNote) 라벨 → 자유텍스트와 구분됨.
- 대상: `schedule.note`·`counseling_session_participant.note`·`_legacy_payment.note`·`billing.notes`(4)·`center_voucher.notes`·`ai_lab.notes` → `memo`. 프론트 `private_notes`·라벨도 정렬.
- **유지**: `quality_note`(한정 노트=qualifier 보존). 정식 엔티티 `CounselingNote`/`FieldNote`는 `note` 유지(자유메모 아님).

### ⑩ 범용 JSON = `meta` 정본 + 목적성 keeper `[확정]` · 비파괴
둘로 갈림(하나의 아키타입 아님). **A. 범용 메타백 = `meta`**(llm_call·credential[DB col `metadata`]·agent_conversation, 이미 일관 → 무변경). **B. 목적성 payload = 도메인명 유지**: `event_atomic.payload`(계약)·`notification.data`(렌더 데이터)·`admin_audit.extra`(감사 상세, 레거시)·`input_data`/`output_data`·`signature_data`·`raw_response`. 규약: "잡동사니=meta / 목적 있는 구조화 내용=목적명".

### ⑪ 비정규화 스냅샷 = 각 모듈 내 일관이면 유지 `[확정]` · 비파괴
`_summary`(assessment ×6)·`_snapshot`(counseling ×1) 둘 다 "관련 엔티티 임베드 비정규화 복사본". 크로스모듈 강제 통일 안 함 — 각 모듈 내 일관이면 충분. (박제 vs 갱신뷰 구분은 코드가 강제 안 하고 실익 낮음.)

### ⑫ 순번/정렬 = 넷 유지 + 선택 기준 규약화 `[확정]` · 비파괴
정당한 4개 역할 — 리네임 0, 규칙만: `*_number`=업무 순번(사람이 보는 1-based) · `*_index`=0-based 배열 위치 · `sequence`=스트림/로그 내 단조 순서 · `*_order`=표시 정렬 키.

### ⑬ on/off 플래그 = `is_*` 정본 + capability/그룹 인정 `[확정]` · 비파괴
`is_*`=상태/속성 boolean 정본. 정당한 별도 패턴 인정: `supports_*`/`can_*`=능력(capability, 상태와 뉘앙스 다름) · `channel_*`=채널별 토글 그룹(묶음 접두). 리네임 없음, 규칙만 문서화.

### ⑭ 다형 참조 = `{concept}_id`+`{concept}_type` + `reference_type_field` 마커 `[확정]` · 혼합
**근거**: 판별자 값이 테이블명이 아니라 도메인 **종류**(`participant_type`=client/assistant · `source_type`=agent/counseling/field_note · `resource_type`=pre_admission). `_type`이 대상 테이블을 종류→테이블 매핑으로 **간접** 지시 → ⑤′ `reference_table_name`(단일) 못 씀. 감사행위자(단일 realm)와 대칭되는 별개 케이스.
- **패턴**: 대상 테이블이 형제 판별자로 갈리면 `{concept}_id` + `{concept}_type` 쌍.
- **concept 어휘**: 도메인 의미대로 유지(participant/resource/source/item — 서로 다름). flatten 안 함(감사행위자 논리와 동일).
- **판별자 접미 `_type`**: `EventAtomic.entity_name`→`entity_type`(단 audit 계약이라 별도 확인) · counseling `role`-as-판별자 → `participant_type` 정렬.
- **접두 일치**: `price_list.reference_id`+`service_type`(불일치) → `service_id`+`service_type`.
- **그래프 마커**: `info={"reference_type_field": "{concept}_type"}`(런타임 판별). `relations.py`를 이 마커도 읽게 확장. 종류→테이블 정적 매핑 있으면 `reference_tables`.
- **가짜 다형 강등**: `_type`이 실은 역할이고 `_id`가 항상 한 테이블이면 → 다형 아님. `{entity}_id`+`reference_table_name`(단일) + 별도 `role` 필드. **필드별 실검증은 실행 때**(participant_id가 진짜 다형(client+member)인지 등).

---

## 14개 항목 결정 요약 (2026-07-02 완료)

**파괴(컬럼 리네임/값변경 = 마이그·소비처):** ① expires_at · ② transcript_status · ③ 파이프라인 status 값 · ④ 타임스탬프 어휘 · ⑤ 감사행위자 `_by`+기준층(⑤-b) · ⑥ *_type · ⑦ template_type · ⑧ error_message · ⑨ memo.
**비파괴(코드/마커/규칙만):** ⑤′ reference_table_name 마커 · ⑩ meta 규칙 · ⑪ 스냅샷 유지 · ⑫ 순번 규칙 · ⑬ is_ 규칙.
**혼합:** ⑭ 다형참조(마커=비파괴, 접두일치/판별자 리네임=마이그).
**참조 마커 3분류(정리):** 단일 realm 참조·감사행위자 = `reference_table_name`(단일 테이블) / 다형참조 = `reference_type_field`(런타임 종류판별) / event.actor = `actor_id+actor_type`.

**집행:** (1) 일반화 규칙 → [persistence-model.md](../../rules/api/persistence-model.md) 반영, (2) 파괴 항목 → 모듈별 마이그 슬라이스. 순서·진행률은 하단 §실행 대장.

---

# rules 수정 설계 (일반화 규칙 — persistence-model.md)

결정에서 **일반화 가능한 것만** rule로. 구체 대상(어느 모듈 무슨 필드)은 rule에 안 씀 → 아래 "모듈별 수정 설계"에. persistence-model.md에 **§4 필드 명명 아키타입** 신설 + §1·§2 소폭 갱신.

## §4 신설 — 필드 명명 아키타입 (붙일 블록)

```markdown
## 4. 필드 명명 아키타입

같은 역할은 같은 이름 패턴으로. 값 집합(도메인)은 달라도 이름 패턴은 하나.

| 역할 | 패턴 | 규칙 |
|---|---|---|
| 참조(도메인 역할) | `{role}_id` + `info={"reference_table_name": "<테이블명>"}` | FK 없음 — 대상은 마커로. 값=실제 테이블명(복수). UI 표시되는 관계(counselor·author·uploader 등)는 표시 대상(members 등) |
| 감사 행위자(누가 했나) | `{verb}_by` + 마커 | 로그인 주체가 이 행을 만들/바꿈. 기준층=인증 주체(`accounts`/`admin_accounts`), nullable(system=null). person/member 저장 금지 |
| 다형 참조 | `{concept}_id` + `{concept}_type` + `info={"reference_type_field": "{concept}_type"}` | 대상 테이블이 종류 판별자로 런타임에 갈릴 때. concept은 도메인명 유지, 접두 일치, 판별자 `_type`. 단일 테이블이면 다형 아님(강등) |
| 종류 판별자 | `{noun}_type` | bare `type`·`kind` 금지 |
| 열거형 값 (닫힌 집합) | `str, Enum` (models.py 공존) + 파라미터 Enum 타이핑 | status·type·category·role·priority·channel 등. bare 리터럴·상수클래스 금지. typecheck가 유효값 강제, DB=값. 열린/외부정의 집합은 str 유지(판단) |
| 템플릿 종류 | `template_type` | 값은 도메인별. `default_template_type`=기본값 역할 접두 |
| 상태(파이프라인) | `{aspect}_status` | 값 = `pending`/`processing`/`completed`/`failed`. 도메인 생명주기 status는 자체 어휘 |
| 만료 시각 | `expires_at` | 미래 기한. `expired_at` 금지 |
| 타임스탬프 | `{verb_past}_at` | 접두 네임스페이스 금지(`verification_*_at`), 표준 동사(`accepted_at`) |
| 에러 내용 | `error_message` | `error`·`*_error` 금지 |
| 자유 메모 | `memo` | `note`/`notes` 금지. `note`는 정식 Note 엔티티 전용. 한정 노트는 `{x}_note` |
| 범용 메타백 | `meta` | 잡동사니 부가속성. 목적 있는 구조화 내용은 목적명(`payload`·`data`) |
| 순번/정렬 | `*_number`(업무순번) · `*_index`(0-based 배열) · `sequence`(스트림 순서) · `*_order`(정렬키) | 역할대로 골라 씀 |
| on/off | `is_*` | 상태. 능력=`supports_*`/`can_*`, 채널 토글 그룹=`channel_*` 허용 |
```

## §2 갱신 — 참조 마커 (기존 "타 모듈 참조 id" 행 대체/보강)

- `info={"ref": "<모델명>"}` → **`info={"reference_table_name": "<테이블명 복수>"}`** 로 규약 변경. 소비처: `infrastructure/persistence/relations.py`·`runtime/agent/mutation/ref_resolver.py`.

## §1 갱신 — 상태값 상수

- 파이프라인 status는 상수 클래스 대신 **`str, Enum`**(2-A). 값 = 4지. bare 리터럴·상수클래스 금지.

## 안티패턴 절 추가

- `expired_at`·`kind`·bare `type`·`note`/`notes`(자유메모)·`error`/`*_error`·`membered_at`류 → §4 패턴으로.

---

# 실행 대장 (진행률 SSOT)

module-major 집행용 — 슬라이스 하나 = 브랜치·마이그·커밋 하나. **진행 기록은 이 표의 상태 열이 유일**: 슬라이스 완료 시 해당 행을 `[완료 <commit>]`으로 갱신하고 다른 문서에 중복 기록하지 않는다. 진행률 = 상태 열 집계(`[대기]` grep).

상태: `[대기]` · `[진행]` · `[완료 <commit>]` · `[분리→이니셔티브]`(해당 이니셔티브가 이 설계를 자기 시점에 적용 — 집행돼도 상태는 이 표에 기록)

**공통 완료 게이트(전 슬라이스, 행별 verify는 추가분만):** 모델 + alembic 마이그 + 백엔드 소비처(repo/service/schema) + 프론트 동반 = 1커밋 · 스코프 pytest green · boot OK · 구 이름 grep 잔재 0.

## 본 후속 — 순서대로 집행 (위→아래)

순서 근거: 문서 먼저(2) → 비파괴 코드(3) → 소형 단일필드 파괴(4~7) → 복합 파괴(8~13) → 값 도메인 전환(14) → 다형참조 판정(15) → 저장값 변경 최대 범위(16~17)를 맨 뒤(15의 판정 결과에 의존).

| 순 | 슬라이스 | 내용 (항목#) | 마이그/프론트 | 추가 verify | 상태 |
|---:|------|------|:---:|------|:---:|
| 1 | ⑤′ 마커 codemod | `info={"ref":"<모델>"}` → `{"reference_table_name":"<테이블 복수>"}` 122곳 + relations.py·ref_resolver.py 갱신 | 코드만 | `"ref"` 잔재 0 | `[완료 cfa343da]` |
| 2 | rule 반영 | [persistence-model.md](../../rules/api/persistence-model.md) §4 필드 명명 아키타입 신설 + §2 마커 규약 갱신 + ⑩⑫⑬ 규칙 문서화(리네임 0) — 블록 원문은 위 "rules 수정 설계" | 문서만 | rule에 §4 존재 | `[완료 55c3bacd3]` |
| 3 | ⑤ `_by` 마커 누락분 | ~10 컬럼(form.submitted_by·triggered_by 등) — 참조 대상 제각각(admin/member/person·String(10) 존재) → 컬럼별 시맨틱 검증 후 마킹, 맹목 금지 | 코드만 | 전 `_by`에 마커 존재 | `[완료 40914e8bb]` |
| 4 | llm/llm_call | `error`→`error_message` ⑧ | 마이그 | — | `[완료 9a1ad3ce5]` |
| 5 | auth/login_notification | `notification_error`→`error_message` ⑧ | 마이그 | — | `[완료 ada056d74]` |
| 6 | assessment (send_link·send_result) | `expired_at`→`expires_at` ① ×2 | 마이그 | — | `[완료 3ef981b1b]` |
| 7 | center/member_invitation | `membered_at`→`accepted_at` ④ | 마이그 | — | `[완료 48388ce19]` |
| 8 | schedule/schedule | `note`→`memo` ⑨ | 마이그+프론트 | — | `[완료 615e6770f]` |
| 9 | counseling/counseling_session_participant | `note`→`memo` ⑨ | 마이그+프론트 | — | `[완료 6bb520a43]` |
| 10 | center/center_voucher | `notes`→`memo` ⑨ | 마이그+프론트 | — | `[완료 f4814165b]` |
| 11 | person/credential | `verification_status`→`status` · `verification_requested_at`→`requested_at` · `verification_reviewed_at`→`reviewed_at` · `verification_reviewed_by`→`reviewed_by` · `verification_reject_reason`→`reject_reason` · `kind`→`credential_type` ④⑤⑥ | 마이그+프론트 | 그룹 6필드 = 한 슬라이스(일관 접두 제거) | `[완료 9160ddf7d]` |
| 12 | form/extraction | status 값 `started`→`processing` ③ · `FormExtractionStatus` 상수→`str,Enum` 2-A | 마이그+프론트 | 생 리터럴 status 잔재 0 | `[완료 ca528518f]` |
| 13 | voucher/voucher_extraction | status 값 `started`→`processing` ③ · 상수→Enum 2-A | 마이그+프론트 | 생 리터럴 status 잔재 0 | `[완료 ca528518f]` |
| 14 | 2-A enum 전역 잔여 | 남은 닫힌-집합 필드 → `str,Enum`(models.py 공존) + 파라미터 Enum 타이핑 + 호출처 멤버화. 닫힌 집합만(⑭ 판별자는 필드별 판단) | 코드(호출처 파괴) | typecheck 유효값 강제 | `[완료 ccbbbd160]` |
| 15 | ⑭ 다형참조 | 전 다형쌍 `reference_type_field` 마커 + relations.py 확장 · `EventAtomic.entity_name`→`entity_type`(audit 계약 확인) · counseling `role`→`participant_type` · 가짜 다형 강등 판정(participant_id 등 필드별 실검증). `price_list.reference_id`→`service_id`는 billing 분리에 인계 | 혼합 | 마커 존재 · relations.py 다형 인식 | `[완료 9412e3216]` |
| 16 | ⑤″ `_by_name` 제거 | `answered_by_name`(inquiry)·`created_by_name`(cs_memo) 컬럼 drop + read 재구성(id→AdminAccount.name live). `_legacy_payment.completed_by_name`=keeper | 마이그 | 표시면 이름 정상(soft-delete only라 유실 불가) | `[완료 097bbe269]` |
| 17 | ⑤-b 행위자 기준층 | `created_by` 등 저장값 person/member→account 수렴 · 센티넬("SYSTEM"/"CENTER")→null(혼합 realm은 actor_type=system). 대상: form·center_application·non_operating_time·share_token·notice·client_voucher·center_voucher·platform_admin(notice·cs_memo·faq). billing 분은 분리 인계 | 데이터 마이그 | `_by` 저장값 = account/admin_account id만 | `[완료 52c33496a]` |

**순 14 완료 노트(ccbbbd160)**: 11필드 Enum 전환 + ~120곳 멤버화 + 실버그 2건 정정(assessment delete_case의 completed/no_show 비교 — 실값 attended/noshow라 항상 0). 잔여 소액: read-model 필터 멤버화 ~20곳(platform_admin center/center_assessment·subscription.status·member_invitation 파생상태·notification send status — 각 소유 enum 참조로), credential_type 등 Literal 별칭은 경계 검증 기능해 유지(판단).

**순 15 완료 노트(9412e3216)**: 다형 마커 7곳(participant_id 4·resource_id 2·source_id 1)+reference_tables 정적 매핑, relations.py 다형 edge 12개 추출·완전성 린트 통합. role→participant_type 리네임(87곳+마이그). **EventAtomic.entity_name→entity_type = 이월 확정** — T2 발판(eventing 개조 금지)+168 사이트·저장행 계약이라 enqueue-seam 별건에서. 가짜 다형 강등 해당 없음(전부 진짜 다형으로 판정).

**순 17 완료 노트(52c33496a)**: 6컬럼 account 수렴+조인 마이그. 승인 플로우(created_by→person 해석)·AI 귀속(member) 분리 재배선. non_operating_times 센티넬 → `is_system_registered` 신설(시스템 판별 로직 보존 — 맹목 null화였으면 유저행/시스템행 구분 소실). **본 후속 17/17 전건 완료** — 남은 어휘 작업 = 분리 이니셔티브 인계분(아래 표) + 소액 잔여(2-A read-필터 ~20곳·⑤″가 아닌 `_by` 마커의 admin 계열 확인·entity_name=T2 이월).

## 분리 이니셔티브 인계분 (본 후속에서 집행하지 않음 — [convention-design.md](../convention-design.md) 분리 4)

각 이니셔티브가 착수할 때 이 설계(항목# 결정)를 그대로 적용한다. 집행되면 상태를 여기 갱신.

| 이니셔티브 | 슬라이스 | 내용 (항목#) | 마이그/프론트 | 상태 |
|------|------|------|:---:|:---:|
| field_note | field_note/field_note | `transcribe_status`→`transcript_status` ② · `note_template_type`→`template_type` ⑦ · 6-status 값 `none`/`idle`→`pending`·`generating`→`processing` ③ · `str,Enum` 2-A | 마이그+프론트 | `[분리→field_note]` |
| field_note | field_note/field_note_audio | `transcript_status` 값 remap ③ | 마이그+프론트 | `[분리→field_note]` |
| billing | billing/billable | `notification_sent_at`→`sent_at` ④ · `notes`→`memo` ⑨ | 마이그+프론트 | `[분리→billing]` |
| billing | billing/payment·price_list·billable_item | `notes`→`memo` ⑨ · `price_list.reference_id`→`service_id`+`service_type` ⑭ | 마이그+프론트 | `[분리→billing]` |
| billing | billing/_legacy_payment | `note`→`memo` ⑨(레거시 묘비 — 집행 시 판단) · `completed_by_name` keeper ⑤″ | 마이그 | `[분리→billing]` |
| billing | ⑤-b billing 분 | `created_by` 저장값 account 수렴(본 후속 17에서 제외된 billing 모듈분) | 데이터 마이그 | `[분리→billing]` |
| agent rebuild | agent/message·agent/run | `type`→`message_type` · `type`→`run_type` ⑥ (rebuild가 태어날 때부터 canonical이면 리네임 자체가 소멸) | 마이그+프론트 | `[분리→agent]` |
| ai_lab | ai_lab/experiment_run·experiment_group | `notes`→`memo` ⑨ (`quality_note` 유지) | 마이그+프론트 | `[분리→ai_lab]` |
