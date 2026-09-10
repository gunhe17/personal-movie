# 검수 발견 대장 (설계↔코드 비일치)

검수 phase의 발견 기록처 — [convention-design.md](../convention-design.md) §검수 phase가 절차·진행률 SSOT. 여기는 **발견만** 누적한다(수정은 전 문서 검수 완료 후 일괄).

**검수 완료(2026-07-06): 14/14 문서 · ~1,250파일 정독 · 발견 총 ~420건(그룹 포함).** 일괄 수정 우선순위는 §종합 우선순위 참조.

- 발견 형식: `| file:line | 설계 조항 | 현행 | 기대 | 파괴성 |`
- 상태: 검수 중 발견 추가 → 수정 슬라이스에서 `해소 <commit>` 부기. 면제(keeper·carve-out·분리 4)는 별도 표기.
- agent 발견 = 검증 전 미확정 — 수정 착수 시 근거 재확인.

## 00+02 어휘+Model — `[완료: 발견 13 · 면제 8]` (2026-07-06, 91파일 정독)

실행 17슬라이스 흔적은 정확히 반영 확인(expires_at·credential·memo·마커 122·⑭·⑤″). 발견 = 설계 대상 목록에서 빠진 동종 위반 + 스타일.

| file:line | 설계 조항 | 현행 | 기대 | 파괴성 |
|---|---|---|---|---|
| assessment/assessment/models.py:18 | ⑥ | bare `type` | `assessment_type`(소비처는 이미 이 어휘) — ⑥ 목록 미등재분 | 마이그+소비처 |
| event/event_reaction/models.py:17 | ⑧ | `error` | `error_message` — ⑧ 목록 미등재분 | 마이그 |
| subscription_history/models.py:18 | ⑤-b | `changed_by` String(20)에 "user"/"admin"/"system" 리터럴·무마커 | actor_id+actor_type 분해 or 리네임 — **판정 필요** | 마이그+코드 |
| event/models.py:18·event_atomic:20 | ⑤′/⑭ | 혼합 realm actor_id에 단일 마커 "members" — admin/machine 행에서 **거짓 계약** | reference_type_field:"actor_type" 전환 or 마커 제거 | 코드만 |
| platform_admin/admin_account/models.py:9-20 | 2-A | `class AdminRole:` 상수클래스 잔존(순14 완료 표기와 갭) | str,Enum 전환(값 유지) | 코드만 |
| messaging/models.py:45-47 | 02 §2-C | 테이블명 누락 인덱스 3(설계가 직접 지목한 사례) | ix_message_logs_* rename | 마이그 |
| form/extraction:44-45·voucher_extraction:29-30 | ⑧·⑩ | 실패=`failed`(Text)·결과=`completed`(JSONB) — 상태어휘를 데이터 컬럼명으로 | error_message·목적명(result) | 마이그 |
| 2-A 잔여 일괄(assessment.status·member.status·client.status/role·schedule_type·subscription.plan/status·notification.priority 등) | 2-A·순14 | 닫힌 집합인데 Enum 없는 str 필드 다수 — 완료 노트 잔여 목록보다 넓음 | 필드별 판단 기록 or 전환 — **순14 완료 범위 문서 정정 필수** | 코드만 or 문서 |
| platform_admin/faq·inquiry models | §1 스타일 | docstring+마커 누락(91중 유일 2) | 마커 추가·docstring 제거 | 코드만 |
| plan_config/models.py:10 | §1 | `PlanConfigRow` suffix | `PlanConfig` | 코드만 |
| person_profile:22·event:19·assessment_task TaskStatus | §1 | inline 주석·enum docstring | 제거/comment= 이전 | 코드만 |
| center_application/models.py:33 | ⑥ 그룹 일관 | `reviewed_reason` | `reject_reason`류 — 결정 로그 미등재 | 문서(저강도) |
| platform_admin/audit_log/models.py:15 | ⑤″ 동형 | `admin_email` write 박제 | ⑤″ 적용 여부 결정 — **판정 필요** | 문서(저강도) |

면제 8: 분리4 인계·bare unique M1 keeper 다수·entity_name(T2 이월)·2-A read-필터 잔여(기왕 기록)·center_id 무마커·목적성 JSON keeper·idx_/ix_ 접두 일반(유보)·extraction 3값 Enum(PENDING 불요 판단).

## 03 Repository — `[완료: 발견 62(A 33 + B 29) · 이월 X2/3-1/3-3/3-5/3-6 · 면제 다수]` (2026-07-06, 94파일 정독)

**최우선(보안 등급)**: `update_in_center`/`remove_in_center` **센터 스코프 미강제 12곳** — find 결과 버림(assessment_case:66,85·package:56,73·set:50,65·session:68) 또는 center_id 미사용(counseling_case:44-65·note:43-55·session:43-57·case_participant:42-54) → **타 센터 행 수정/삭제 가능**. 기대 = get_in_center(raise) 선행. 동작변경(404 신설)이나 시그니처 무변.

기타 발견(요약 — 상세는 검수 보고 원문):
| 그룹 | 건 | 내용 |
|---|---|---|
| 이름=계약 위반 | 1 | session_participant update_in_center에 center_id 파라미터 없음 → rename or 수취 |
| 도달불능 코드 | 3 | return 뒤 flush() (counseling 3파일) |
| @typecheck 누락 | 2 | send_link:149·send_result:164 |
| 폐기 접두 | 2 | set_active(직접 mutate 혼합)·set_template_in_center |
| 물리를 remove_로 | 1 | favorite:32 → hard_delete_* |
| active 명명 | 3+2 | center get_active/list_active/count_active·task find/get_by_id 동치 오버라이드·send_result *_public 동치 |
| lifecycle 위반 | 2 | auth account find_by_email 등이 deleted 포함(이름은 active 약속)·email_exists 접미형 |
| 락 bool 토글 | 1 | token find_by_token_hash(for_update:) → 분리 |
| 반환 계약 | 4 | hard_delete None·remove_* bool 2·login_notification update None |
| 비원자/명령조회혼합 | 4 | rollback_by_session_ids 루프 mutate·unassign·bulk_update_role 재SELECT·update_status_by_case RETURNING list(**carve-out 판정 필요**) |
| center_id=None 우회 | 2 | list_by_participant 2곳 → *_all_centers 분리 |
| 기타 | 3 | restore(id) 명명·update_pending unset 미사용·중복 메서드 1쌍 |
| 문서 스테일 | 1 | 설계 §3-1/3-4 "이탈 3건뿐·나머지 전부 준수" — 실태 반영 필요 |

**B(후반부 15모듈, 54파일) 발견 29 요약** (상세는 검수 보고 원문):
- **테넌시 스코프**: document find/get_in_center가 center_id 인자·필터 없음 · subscription update_in_center center_id 없음 · center_voucher/client_voucher update_in_center가 center_id 무시(dead param) · platform_admin/notice count_unread_members(center_id=None 우회, §6.3 명시 금지) · voucher update_in_place deleted_at 가드 없음(soft-deleted 행 갱신됨)
- **§6.3 경계**: platform_admin/notice repo가 타 모듈 모델에 command(add/update) — read 예외 밖, **판정 필요**
- **계약외 동사/비원자 mutate**: set_token·lock/unlock(+= 비원자)·revoke_all_by_account 루프 mutate·deactivate_token(flush 누락)·unset_default·bulk_upsert(명령+조회)·upsert_read·assign/copy_permissions·acquire_room_lock
- **get_ + dict 반환**: llm 3곳·center_voucher 1곳 → aggregate_* (rule 자체의 접두 vs 접미 모호도 정리 필요)
- **active 라벨/동치 래퍼**: cs_memo·pa notice·voucher_extraction get_active/list_active_many·plan_config·platform_setting list_active·subscription find_active 4(상태 필터 없음)
- **명명/반환**: *_all_states→including_deleted·schedule remove_by_id bool 협착·role_permission hard_delete None·form list_ids_in_center가 list[Form]·find_recent_entity_id str 반환·role list_all(_all_centers 미사용)
- **기타**: global_document 고아 @typecheck 이중 데코·공개 flush() 노출 3·form extraction add if-not-None 필터·restore_pair rows[0] 무가드(IndexError)
- **eventing repo `mark`**: eventing 정본 vs repo 폐기 접두 — **rule 간 충돌 정리 필요**

이월(B): X2 광범위(add·list·update_in_place/update_in_center 포함) · 3-1 rename 미실행(inquiry create·faq/inquiry _with_page) · 3-3 JoinableBase 미신설(platform_admin 3 repo base-less 그대로) · 3-5/3-6 미실행.

이월: X2 `*` 미배치 add ~34파일+list/count 다수(기왕 이월 확정)·3-5 base _get 미실행·3-6 _insert 미실행·한글 not-found 메시지(3-5와 수렴).
면제 7: find_active 복합키 keeper·restore-on-re-add/재create 승인 패턴·보안/휘발 hard_delete·replace-pattern 물리·소유-내부 JOIN 4·platform_admin 3건(B 범위)·add_if_not_exists(판단 위임).

## 04 Service — `[완료: 9/9 배치 · 발견 ~195그룹]` (2026-07-06, 520파일 정독)

### 04-1 assessment A (44파일) — 발견 17그룹
구조 축(1파일=1유스케이스·클래스/execute·repo 1·타모듈 0·tx 0·S1 0·event tuple) 전부 정합. 위반은 §4·§2·docstring·phase·X1 집중.
- **잠재 결함**: update_case_*_summary ×4 — find_in_center(Optional)를 None 체크 없이 직접 mutation(부재 시 AttributeError) + 반환 None → get_in_center+update_in_center로
- §4 직접 mutation/인라인 raise 8건(unassign 루프 mutate·find+Conflict 인라인·N+1 verify 등)
- §2 시그니처: dict blob 2(fields·participant_data)·Model 수취 1·tuple[list,int] 반환 1·중복 서비스 파일 1쌍(get_case_by_center≒get_assessment_case)
- docstring 39/44 파일(Args/Returns 재진술)·phase 마커 전무 22+규격위반 나레이션 다수·X1 인라인 ~20파일
- 이월: X2 * 전무 36파일+전-kwarg 7파일
- **문서 스테일(rule)**: service.md §2 본문·good 예시가 "전부 kwarg-only"로 남아 X2 확정("식별만 앞")과 불일치 — 4-A rule 개정이 예시 미반영

### 04-2 assessment B (55파일) — 발견 22그룹
깨끗한 축: S1 0·tx 0·타모듈 0·repo 1·event tuple 정합. 워크리스트(4-B/C·X1/X2) 미집행 전면 잔존(docstring ~48·phase ~30·* 부재 ~47).
- **실결함**: generate_report_pdf `_convert_to_pdf`가 매 호출 tempfile(delete=False) HTML 저장 — 디버그 잔재, 디스크 누적 → 삭제
- §4/§10: cancel_session_simple 직접 mutation·update_task dict passthrough+Model 입력·update_task_opinion 인라인 스코프 검증·add_session_participants find+Conflict 인라인 ×2
- §1: _service suffix 파일명 3(generate_report_pdf_service·scoring_service[repo 미사용 주입]·update_task_report_service)·validate_active bool 분기 2·중복 코드젠 헬퍼 2곳·self.repository 1
- 기타: assert 불변식 1·positional remove_by_id 2·TODO 잔존·raw status 리스트 비교(2-A 연계)·phase 라벨-동작 불일치 2
- 이월: X2 ~51·emit 없는 producer 다수(eventing 별건)·execute_or_none 결·StorageClient 생성자 주입(core-infra 결)
- 면제: build_center_assessments(pure-logic)·계산 Result DTO·restore 분기(§11)·render 헬퍼·형제 서브모듈 import·워크플로 SPI

### 04-8 llm·messaging·notice·notification·institution (42파일) — 발견 20
- **구조적 최대**: add_llm_call이 repo._session으로 repo 3개 자가 생성+service→service 2건(크레딧 차감 조율) — facade/게이트웨이 소유로; 크레딧 차감 실패 except Exception 전면 무시(why 주석 없음)
- **Model mutate+private 접근 7파일**: deduct_credit·change_rate·mark_as_read·upsert_setting·register/unregister_token·create_notification(begin_nested 소유)
- get_notice._get_siblings가 service에서 raw select 87줄 조립 → repo finder로
- find+인라인 raise 8파일(messaging template 3·notice 3·notification 2)
- institution update **fields catch-all·T1 보호 2건(send_message_service 파일명·mark_sent/failed mutate — 발송 경로라 신중)
- 이월: X2 ~32·4-D/4-E 분할형(get/list_message_template 다중 execute·mark_as_read 2클래스)·**rule 보강**: bulk command 반환(tuple[list[Atomic], int]) 행이 rule §2 계약표에 없음
- 면제: render_template·ensure_system_templates(commit keeper)·policy형 3(모범)·event tuple 정합

### 04-4 counseling (60파일) — 발견 21그룹
깨끗한 축: S1 0·tx 0·타 도메인 0·execute 고정·event tuple 8곳 정합.
- **동작 영향**: get_participant_by_id가 **center_id 받고 미사용**(무스코프 get_by_id — 테넌트 격리 구멍) · list_participants_by_session은 무스코프 조회 후 Python 필터
- 구조: collect_case_data(repo 2개 주입 orchestration — carve-out 근거 없음)·delete_participants_by_type(_session.flush+루프 mutate)·add_session_participants(restore 3필드 mutate+repo.save)·initialize_session_participants(facade 스키마 역참조)·Command 스키마 in 2·get_analysis 1파일 2클래스(4-D 목록 밖 — 문서 스테일)
- find+Conflict 인라인 3·valid_statuses 리터럴 복붙 2·enum/문자열 혼용 비교 2
- 기계적: docstring 56/60·phase 부재 ~41·X1 다수·assert updated 9(repo Optional 계약과 연동)
- 이월: X2 54/63·2-A 파라미터·uuid_str 0곳(워크리스트 부재 — 문서 스테일 후보)·emit 없는 producer 다수
- 면제: policy 변형 3(모범)·계산 Result·빈 입력 가드·정보성 주석 keeper

### 04-5 client+form (63파일) — 발견 27
S1·tx·크로스모듈 깨끗. **최대 부채 = form/template 계열 load→mutate→_session.flush 12파일**(설계 survey "repo 접근 잔재 미미"가 놓침 — 문서 스테일).
- **버그 의심**: update_template_draft가 JSONB 대입 후 flag_modified 누락(confirm_extraction과 비대칭 — dirty 감지 안 될 수 있음, 실동작 확인 필요)
- **주의(응답 변화)**: delete_guardian/sibling_relation의 인라인 center 비교 PermissionDenied → get_in_center 전환 시 403→404
- execute_with_dict(dict 통째 수신, 4-E 목록 밖 — 문서 스테일)·update_in_place 후 인라인 raise 3·find+truthy Conflict 인라인 4·클래스/파일명 불일치 2·duplicate_check 1파일 3클래스+입력 DTO
- 이월: X2 51/63·phase 전무 13+return 누락 다수·emit 없는 producer 다수·X1 8·uuid_str 61파일 미사용
- 면제: build_signals(pure-logic)·계산 Result 3·mark_failed(정책 no-op)·전이표 상수 keeper·정역방향 add 2회(단일 애그리게이트)

### 04-9 voucher·subscription (47파일) — 발견 21그룹
깨끗한 축: S1 0·tx 0·타모듈 0·4-D 분할(create_trial/free) 이행 확인.
- **구조 최대**: 다중 repo 19/47(subscription history_repo 패턴 11 포함) — 설계 survey "repo 잔재 미미·무변경"과 실태 불일치(**문서 스테일: keeper 판정인지 누락인지 명시 필요**)
- current_user: dict 2·fields: dict 2·인라인 scope raise 9·find+Conflict 2·중복 use-case 1쌍(get_client_voucher_entity)·헬퍼 함수 파일 1·파일/클래스 불일치 3·tuple[list,int] 반환 3·deleted_at 서비스 필터 1·# emit 라벨 오용 11(history 기록)·execute_or_none 잔존·assert 1
- 이월: X2 전반·phase 15·docstring 19+(모듈 docstring 4는 keeper 후보)·emit 없는 producer 다수
- 면제: 계산 Result·정책 fallback 4·pure-logic 헬퍼·toss_response dict(외부 payload)·changed dict

### 04-3 center (81파일) — 발견 20그룹
전 파일: S1 0·tx 0·타모듈 0·event tuple 정합.
- **상 파괴성 2**: update_member_status(Model-in+직접 mutation+_session)·sync_members(ORM mutate+_session.flush)
- 중: list_centers 파일/클래스 불일치+use-case 중복·ValueError 비도메인 예외 2·update_program None sentinel(unset 미사용)
- 하 다수: 인라인 raise(update_in_place 후 3·유니크 find+Conflict 4·restore 1)·죽은 파라미터 confirm 3·[DEPRECATED] 사장 서비스 1·중복 import 4·배너 주석·room 중복 필터 파라미터·positional 호출
- 이월: X2 대다수·phase 부재/부분 다수·4-E check_*_status 2파일(rename+4-D 결)·uuid_str 전면 드리프트·**tuple[list,int] 전 모듈 균일 — rule이 앞서는 문서 스테일 가능성(판정 필요)**
- 면제: pure-logic 헬퍼·policy 변형·상태 전이 인라인 검사(§4와 별개 정당)·다건 add 루프·동명 클래스 2(각자 소유)

### 04-7 platform_admin·role·schedule (68파일) — 발견 ~28그룹
- **S1 실위반 4**: platform_admin center 3·center_application 1 — service가 `*ListResponse.build()` 조립. **설계 survey "S1 0"은 grep이 `.build(`를 못 잡은 문서 스테일 — verify 패턴 보강 필요**
- repo 단일 위반 5(2-repo 3·execute 인자로 audit_log_repo 주입 2)·schema-in 3·current_admin: dict 4
- get/verify 인라인 raise 광범위(admin_account 4·refresh_token 1·center 5·schedule 5)·클래스명 역전 1(AdminLoginService)
- accept/invite가 jose.jwt+settings 직접(infra factory 미경유)·invitation_link URL 조립 — **판단 필요**
- **create/update_schedule tuple 3-원소 변형**(conflicts 동봉 — 메모리의 "schedule 파사드 arity" 회귀와 동근) — 계약 판정 필요
- get_role_with_version이 find 반환(이름과 불일치)·unset 변환 우회 3(None sentinel)·수제 utc_now 1
- 이월: X2 3모듈 몫 전반·4-B/4-C 대량·schedule atomic 미발행(eventing)
- 면제: _file_validation 헬퍼 2·generate_2fa(pure-logic)·계산 Result·version-guard Conflict·login 보안 병합

### 04-6 auth·document·person (57파일) — 발견 ~19그룹
클린 축: S1 0·tx 0·타모듈 0·event tuple 정합. person_profile 2파일은 신 컨벤션 완전 준수(파일럿 산물).
- **_session 직접+mutate**: auth/account 3·document 3·credential recompute(_session 유출) 5
- find+인라인 raise ~9(설계 "잔재 미미" — 문서 스테일)·schema/Model-in 6(document 4·share_token increment_download Model-in+비원자 +=1)
- **기능 결함 의심 2**: upload_document `if existing: pass` 죽은 분기(checksum 중복검사 미사용 — 정책 결정 필요)·find_person_by_id ≡ get_person_by_id 완전 중복
- update_document가 dict blob+hasattr/setattr 루프(**mass-assignment 위험**)·rotate_refresh_token 파일/클래스 역전+별칭(회전 로직 부재)·send_notification 가짜 이메일 스텁(실발송 없음 — 기능 결정 필요)
- 이월: X2 ~34·4-B/4-C·4-D/4-E 기수록분
- 면제: calculate_risk_score(pure-logic 모범)·보안 병합 raise 2(keeper)·dict 반환 enrichment 헬퍼·upload_global_document carve-out 후보

## 05 Facade — `[완료: 발견 34(문서 스테일 7·코드 27) · 면제 10]` (2026-07-06, 65파일 정독)

상세 전문은 검수 agent 보고 원문 기준 — 여기는 그룹 요약. **가장 큰 계층 갭**: §5-6(Service 없이 repo 직접)이 설계 카운트(voucher 15·llm 8·subscription 6·messaging 4) 미이행에 더해 **설계 밖 모듈 9곳**(assessment·task·auth·member·client profile·counseling·event·global_document·form_template)에 광범위 잔존.

**① 문서 스테일 7**: 5-4 Model mutate 8건 중 5건 이미 해소(task·session bulk·auth token_version·counseling total_sessions·document storage_path) — 설계/facade.md §4 잔존 표기 삭제·라인 갱신.
**② Model mutate 잔존 4**: form_template·voucher reset_extraction_for_retry(형태변형 잔존)·credit_facade(+=/flush 미해소)·role_facade version+=1(신규).
**③ §5-6 direct repo**: 워크리스트 4모듈 미이행 + 신규 9모듈(위). subscription은 6→12+로 증가.
**④ 비즈니스 로직 인라인(설계 미포착, behavioral)**: task_facade submit_task 오케스트레이션·scope-raise 7곳·voucher consume_sessions 상태머신·subscription grant_trial/cancel_payment·auth change_password+의심로그인 중복·client profile 역할 파생·form submit 검증·counseling 가드/출결 전이·document upload 오케스트레이션(UploadFile 수신).
**⑤ 경계 위반 2**: center_agent_facade가 application handler import(레이어 역전)·member_invitation_facade (atomic, Response, dict) 혼합 tuple+infra 토큰 인라인.
**⑥ 기계적**: 비-Facade 데이터클래스 잔존 2(미이행)+신규 4 → facade/schemas.py 이동.
**⑦ docstring 안티패턴**: Args/Returns 1 + 모듈·메서드 docstring 다수(counseling 집중).

면제 10: 분리4·EX-13 크로스모듈 read enrichment·P3 직렬화 브리지·messaging keeper·자기모듈 read 집계·legitimate flush·cascade list+remove·atomic discard(eventing 별건)·facade/schemas Field desc(계층1 소관).

## 06 Application — `[완료: 3/3 배치 · 발견 ~34]` (2026-07-06, 179파일 정독)

### 06-1 account·activity·assessment·auth·center_application·center_assessment (46파일) — 발견 14그룹
크로스모듈 조율은 owning facade 수렴 양호(외래 repo 0, keeper 2 제외). admin 이관분은 목표형 도달. TOOL dict 46파일 전건 준수.
- **파괴적(응답 계약)**: send 계열 5핸들러 — MessagingFacade.send(SMS/알림톡)를 요청 tx 안 per-recipient 동기 호출, 응답이 delivery_results 동기 반환 — BG/reaction 이동 시 API 계약 변경. **설계 6-3은 2건만 계상(문서 스테일)**
- DTO mutate 4건(설계 6-5는 1건 계상 — 문서 스테일)·6-6 class handler 잔존(ActivityLogAgentFacade)·도메인 검증 인라인 3(delete_case ~65줄 등)·emit atomic None 가드 1·uow._session 직접 2·ValueError 2·docstring 7파일·main() 부재 2·나레이션 다수·positional 시그니처 ~30
- **census 불일치**: 6-1 tx 163 vs 주행기록 언랩 199 vs 본 범위 잔존 ~19 — 재계수 필요(문서)
- advisory: 9-4 Client 전환 대기 ~14파일·notification.helpers 직접 ~9(반응 이행 시 소멸)·emit 없는 producer 다수·calculate_age 3벌 중복
- 면제: tx 래퍼 keeper ~19(계층10 결)·BG carve-out 7·admin read-model·labels.py·직렬화 위치 정당

### 06-3 notice·notification·person_profile·program·role·schedule·subscription·support·upload·voucher + schemas.py + period_roller (72파일) — 발견 11
골격 양호(owning facade 경유·직렬화 위치·emit·BG 패턴). 신규 파괴적 위반 0.
- **레이어 역전**: upload 2파일이 behavior private _resolve_access import + uow.session 직접 전달 → center 표면 경유로
- role 2파일 도메인 검증 인라인(기왕 "role §10/§11 미적용" 계열)·notify_notice audit repo 직접 write(EX-2 초과)+반환형 불일치·공유 헬퍼 _prefix 미준수 1
- application/schemas.py 구세대(배너 8·docstring·description 재진술·별칭 미사용·닫힌집합 str+주석)·role/schemas.py 동류
- on_conversation_created _handler 접미 없음·파일/함수명 불일치 2·docstring 3파일
- advisory: 9-4 Client(notice BG 경로만 이행)·~~반응 핸들러 인라인 발송(send-key 멱등 부재)~~ **member 반응 6건 해소(2026-07-07)**: `if target.notification_id:` 게이트(in-app event_ref가 send-key)로 외부 중복발송 방지, notify_counseling_case_created 선례를 5건에 일괄 적용. ~~**잔여=내담자 직접 SMS**~~ **해소(2026-07-07, 7006a959b)**: sms_counseling_session_reminder에 Redis SET NX send-key((schedule_id, client_id, "counseling_reminder") 키, TTL 3일) 게이트 — 회기추가 재emit·lease 재claim 중복발송 방지. cache 부재 시 fail-open(send-key=최적화). CacheClient.set_nx 신설·SmsTarget.client_id 부가·unit test 1(302 tests). ·analyze_usage LLM-in-tx·TOOL 일관성 4·facade에 pydantic 통짜 2·plan_config 상수 직접 import·emit 없는 producer 2·period_roller 클래스(6-6 미기재 — 문서 스테일 후보)
- 면제: tx 래퍼 keeper 다수·BG carve-out 명기분·D2 동일 도메인·notification.helpers(공식 표면)·09 기록분 재기재 생략

### 06-2 center·client·counseling·credential·form·home·llm·member (61파일) — 발견 9 + advisory
구조 양호(facade 경유 지배·직렬화 handler 소유·TOOL 전건 충족). **credential 2건은 9-4 Client(DTO)까지 이행 완료된 레퍼런스.**
- **6-4 미이행 잔재 2**: fetch_program_name·fetch_field_note_summaries가 AsyncSessionLocal 자체 생성(호출처 uow 안에서 두 세션 혼용 — BG 아니라 carve-out 불가) → 받은 uow 사용
- **§3 신규 2**: form create/resend_form_send — MessagingFacade.send 외부 I/O가 tx 안(assessment send 계열과 동류, 응답 계약 변경 수반 — 설계 판단 필요)
- 6-5 DTO mutate 1(설계 기재분)·notification.helpers/schedule.helpers 비-facade 표면 3·service 클래스 상수 접근 1·docstring 2·중복/사장 import 1
- **6-3 문서 스테일**: credential notify는 코드가 이미 해소(NotificationFacade.notify=DB write 전용) — 설계 갱신
- advisory: 9-4 잔여 다수(credential이 레퍼런스)·응답 DTO enrichment mutate 3(온건)·_prefix 부분 미이행·**main() 보일러플레이트 ~52파일 사장**(tool_registry는 TOOL 직접 읽음 — 생략형이 정본)·DTO 정의 위치 불일치·uow.flush 직접 1·모듈→application 역참조 1
- 면제: tx 래퍼 keeper ~32·bulk 멀티커밋 carve-out·D2 동일 도메인·X1 이월

## 07 Router — `[완료: 발견 23(A 12 + B 11) · 면제 15]` (2026-07-06, 88파일 정독)

7-1 골자(summary 0·description 비자명 계약)·7-2 behavior 순서는 정합. 비일치 2갈래: 7-6 인라인 집계 과소(3→8+), 7-8 이중 behavior 목록 누락.

| file:line | 설계 조항 | 현행 | 기대 | 파괴성 |
|---|---|---|---|---|
| counseling_case_analysis/router.py:19-31 | §7-8 | 라우터 dependencies+라우트 behavior.request 이중(요청당 2 uow) | field_note와 동일 병합 — sweep 누락 | 비파괴·기계적 |
| **center_non_operating_time/router.py:171-182** | §7-2 | **register_center_holidays(POST mutating)가 request_unscoped 무인증 노출**(TODO 주석만) | machine gate/인증 필수 — **보안 표면, 우선 처리** | 주의(보안) |
| auth/router.py:111-129 | §7-6 | verify_password 라우트 인라인(facade+uow 직접, tx 이중) | handler 추출 | 저파괴 |
| center_assessment/router.py:51-63 | §7-6 | is_active 파싱+422 인라인 | handler/Enum Query | 비파괴 |
| assessment_case:94·counseling_case:72 | §7-6 | owner_scope 해소·status.split 인라인 | handler 이동 | 비파괴 |
| counseling_session/router.py:23,65-67 | §7-6 | 빈 응답 분기+인프라 직접 import | handler 내부로 | 비파괴 |
| center/member/router.py:147 | §7-6 | attach_presigned_urls 후처리 인라인 | handler 이동 | 비파괴 |
| assessment_task:100·send_result:173 | behavior 안티패턴 | get_storage_client() 라우트 본문 호출 | handler에서 factory | 비파괴 |
| operating_time:88·working_time:87 | §7-6 | fromisoformat 인라인(실패 시 500) | date 타입 선언 | 비파괴 |
| center_application/router.py:32-37 | behavior 레이아웃 | _account()/_admin() 헬퍼 간접화 | 직선언 | 비파괴 |
| 다수 | 7-1 워크리스트 | param description 재진술 잔존(페이지 번호 등) | trim 미집행분 | 비파괴 |
| router.md rule | 문서 | behavior 순서 canonical·DELETE/tags 범위밖 미반영 | rule 갱신 2건 | 문서 |

**B(후반부 17모듈, 50파일) 발견 11**:
| 위치 | 내용 | 분류 |
|---|---|---|
| support/router.py:30-53,114 | _send_inquiry_email(SMTP·템플릿·예외처리) 라우터 파일 상주 + BG 직접 스케줄 | 코드+문서 스테일 |
| ~~**messaging/message_template/admin_router.py:68,99,115**~~ **해소(2026-07-07)** | mutating 3곳 uuid4 위조 → `start_event_group()`+`dispatch_events()` 선언·`ctx.event_group_id`·`actor_id=ctx.admin_account_id`(감사 actor 기록). 동 패턴 타 라우터 0(전수 확인) | 집행됨 |
| 같은 파일 42-161 | 핸들러명 재진술 docstring 8건이 OpenAPI로 노출(7-1 survey가 docstring 형태 미포착) | 코드+문서 |
| person/credential/router.py 7라우트 | attach_presigned_url 후처리 인라인 | 코드 |
| platform_admin/audit_log/router.py:28 | request_unscoped(authenticate_admin)+audit() 없음 — 7-3 집계 누락형 | 문서 스테일 |
| platform_admin 대부분+subscription admin | behavior 선언 순서 canonical과 상이(기능 무해) + rule에 순서 한 줄 미반영 | 문서+cosmetic |
| 다수 | param description 재진술 수십 건(rule bad 예시와 동일 문구 포함) | 워크리스트 미집행 |
| institution:21·upload/image:15 | _account() 헬퍼 간접화 | 경미 |
| subscription/router.py:242,312-319 | 핸들러 없는 응답 조립·기본값 해소 인라인 | 경미 |
| subscription·credential 모듈 docstring | 엔드포인트 목록 나열(드리프트 위험) | 경미 |
| share_token:67-100·support:66·subscription:124 | 인자 없는 request_unscoped() — 7-2 분류에 없는 제3형태 | 문서 스테일(분류 누락) |

면제(B) 6: aggregator get_current_admin(계층10 이월)·pre-auth carve-out·기지 인라인 가드 3·eventing 미선언(별건)·get_plans 무인증(TODO 결정 대기)·role §10/§11(기왕 기록).

면제 9: eventing 미선언 라우트(별건)·DELETE 200/204(범위밖)·tags(optional)·비자명 description keep·me 라우트 ctx echo keeper·invitation accept unscoped(구조 정당)·request_admin 정합 등.

## 08 Eventing — `[완료: 발견 6 · 면제 4 · 해소 결정4]` (2026-07-06, 46파일 정독)

> **해소(결정4, 커밋 8e78d00~073cd67):** atomic-in-handler 37건 실측 = A안 집행. 자기모듈 service 10곳→service가 atomic 생성 · 크로스모듈 조율 20곳(notice·subscription·center_application·form·voucher)→application/handlers 이동(감사 atomic=조율층 생성, eventing.md 예외 명문화) · inline CRUD 7곳(faq·inquiry·plan_config·settings)→repo/service 부재라 지속층 buildout까지 잠정 handler 유지. 설계 8-2 계수 2→37 정정.

마커 정합 견고(33/33 Atomic 네이밍·payload 계약·민감값 스트립·emit no-op·pg_notify 0). 핵심 비일치 3갈래: ① 설계 8-2 과소 계수 ② 8-3 일부 기수정(문서 스테일) ③ Event 컬럼 rule 미기재.

| file:line | 설계 조항 | 현행 | 기대 | 파괴성 |
|---|---|---|---|---|
| platform_admin/center_application approve:35·reject:39 | §8-2·rule §4 | handler가 AdminAuditAtomic 직접 생성 | service 생성→(atomic, model) 반환 (8-2 워크리스트 미착수) | 비파괴·기계적 |
| platform_admin 전역+subscription **35건** (admin_mgmt 5·form 5·voucher 6·cs_memo 4·qna 5·notice 2·settings 2·center 1·subscription 5) | §8-2 판정 논리 | 8-2가 위반이라 한 것과 동일 패턴이 35곳 더 — 설계 survey "2건·정합 110/112"는 과소 계수 | **판정 필요**: 37곳 일괄 수정 vs "admin 균일 감사 atomic은 handler 생성 허용" carve-out 명문화 | 코드면 비파괴·기계적 / 문서면 문서만 |
| 08-eventing.md:20 (8-3 center_assessment 건) | 문서 스테일 | `if atomics:` 가드 이미 제거됨(현행 무조건 emit) | 8-3 목록에서 제외 | 문서만 |
| counseling_case_analysis create_analysis_handler:74·events.py:12 | rule §4 | 트리거-사실 atomic(모델 무변경)이 handler 생성·단독 반환 | 소유 레이어 미정의 — §4 예외 명문화 or service 이동 — **판정 필요** | 비파괴 |
| event/event/models.py:19-20 | rule §3·schema.md | Event.actor_type·ip_address 실재(admin 감사 정본) | rule §3 컬럼 목록 갱신 | 문서만 |
| center/member/events.py:16,35 | rule §10 | updated(changed=None) — 유일하게 델타 없이 발행 가능 | changed 필수화 | 비파괴·저위험 |

~~참고(대상 외): agent delete_conversation:20 `if atomic else []` 가드 잔존~~ **해소(2026-07-07, 184d0dda6)**: emit이 None 원소 필터도 소유하게 확장 → delete_conversation을 `atomics=[atomic]`로 통일(유일 outlier 제거). eventing.md §4 반영.
면제 4: Track B enqueue(별건)·_process_analysis 인라인(명시 예외)·2FA/WS(미조우)·event_atomic repo X2(타 계층 조항).

### emit 없는 producer buildout (item 2, 사용자 결정 2026-07-07 = 설계정본 notify→reaction)
legacy 핸들러(async with uow + 인라인 notify + emit 없음) = mutation 사실이 event_atomics에 안 남고 알림도 인라인. **producer 단위 전환**: service가 `{Module}Atomic.{act}` 발행 → handler behavior 전환(emit) → 라우터 start_event_group+dispatch_events → 인라인 notify를 EVENT_REACTIONS 반응 handler로 이동(in-app event_ref 게이트=send-key). cancel_task+notify_counseling_case_created 선례.
- **refuse_task 해소(2026-07-07, 42cac996f)**: `assessment_task_refused`·`AssessmentTaskAtomic.refused`·반응 `notify_assessment_task_refused`.
- **noshow_session 해소(2026-07-07, f1fa7a2ca)**: `assessment_session_noshow`·`.noshow`·반응 `notify_assessment_session_noshow`.
- **revert_cancel_session 해소(2026-07-07, 230330005)**: `assessment_session_reverted`·`.reverted`·반응 `notify_assessment_session_reverted`. 되돌리기는 반복 가능 동작이라 event_ref를 회기 `updated_at`으로 키잉(재시도 안정 + 재-되돌리기 새 알림). facade `_with_response`→tuple 반환 전환.
- **support 문의 해소(2026-07-07, 2b4a31833)**: create_inquiry가 유일 잔여 emit-less mutating producer였음(전수 확인). `platform_admin/inquiry/events.py` InquiryAtomic 신설·service tuple·facade tuple+get_inquiry·handler emit(`inquiry_created`)·라우터 request_unscoped에 start_event_group+dispatch_events. 접수팀 SMTP를 반응 `email_support_inquiry`로 이동 = **07-B "라우터 상주 _send_inquiry_email" 동반 해소** + fire-and-forget→재시도 가능. TOOL agent_exposed=False(emit 핸들러).
- **notice 2종 = STALE(2026-07-07 실측)**: create/update/delete_notice 모두 이미 emit(AdminAuditAtomic). emit-less 아님 — 메모리 목록이 뒤처진 것.
- **bulk 초대 해소(2026-07-07, 1a8b565ff, 테스트 선행)**: characterization 테스트(부분 실패 계약 = 성공분만 영속·실패 error 계상) 먼저 고정 → per-item commit(carve-out 유지) 안에서 성공분마다 `member_invitation_created` emit(공유 event_group, 버려지던 atomic 회수). 라우터 start_event_group+dispatch_events. 인라인 `send_invitation_email`(background_tasks) 제거 → 단건과 동일하게 `email_member_invited` 반응이 발송(재시도 가능·canonical 통일). 고아 `member_invitation_email.py` 삭제. 테스트가 atomic 2건 발행+부분실패 계약 검증(303 tests).
- **item (2) = 소진(2026-07-07)**: assessment 트리오(refuse/noshow/revert)+support 문의+bulk 초대 전건 해소, notice는 stale(이미 emit). **emit 없는 producer buildout 완료.**

## 09 Cross-module — `[완료: 발견 5+advisory 2 · 허용/면제 346히트 전건 분류]` (2026-07-06, 스캔 346 + 정독 25파일)

modules/ 측 346히트 전건 허용/면제(§3 write 위반 0). **위반은 application 레이어에 실재** — 설계 9-1 "위반 0" 서베이가 application을 비껴감(문서 스테일).

| file:line | 설계 조항 | 현행 | 기대 | 파괴성 |
|---|---|---|---|---|
| application/handlers/subscription/change_plan.py:56-57 | §3 신호2 | llm 소유 CreditBalance 직접 mutation+flush | CreditFacade write 경유 | 비파괴(메서드 신설) |
| approve_plan_change.py:43-44 · force_apply_downgrade.py:38-39 | 동일 | 동일 패턴 ×2 | 동일 | 비파괴 |
| roll_center_period.py:25-59 | §1·신호4 | SubscriptionRepository 직접 write + 내부 Service 직접 구동 | SubscriptionFacade 노출·경유 | 비파괴 |
| apply_expired_downgrades.py:34,51 | §1·신호4 | sub_repo.update_in_center 직접 2곳 | 동일 | 비파괴 |
| (advisory) notice/notify_notice.py:42 | §1 완화 여지 | AdminAuditLogRepository.add 직접(쿨다운 마커) | audit 액션 경유 | 비파괴 |
| (advisory) .claude/hooks/check_cross_module_import.py:93 | 9-4 | **hook이 application/을 명시 면제 — 실제 위반 서식지가 사각** | application write 신호 검사 확장 | 비파괴 |

9-4 Client 현황: 구현 정합(PersonClient·MemberClient·CenterClient, batch 포함). 소비 이행 4/26곳(파일럿분) — 잔여 22곳 advisory. **Person/Member 슬라이스 해소(2026-07-07, 5622c6012)**: app handler의 유일 잔여 Person/Member foreign-repo read = `support/answer_inquiry._find_member_id_by_email`(Account→Person→Member 체인) → PersonClient.`find_by_account_id`·MemberClient.`find_by_person`(단건) 신설 + auth `AccountClient`(신설, find_by_email) 경유로 이관. credential 2 handler는 기존 파일럿 레퍼런스(이미 Client). **큰 모듈 Client buildout 판정 = phantom 재분류(2026-07-07, 코드 전수 재분류).** 직전 "read ~21곳(Subscription×6·Notice×4·…)" 카운트는 write·same-top-module·분리4·admin을 read 타깃으로 오집계했음. app/application/handlers/ 20개 `uow.repo()` 사이트를 9-4 규칙(§26·§45 cross-module READ, B≠A top-module, write·분리4·admin read-model 제외)으로 재분류:
> - **분리4 제외 3**: ai_lab/get_cost_summary·field_note ×2.
> - **cross-module WRITE 6**(§3 facade 소관, 9-4 아님): subscription roll/apply/change/force/approve의 `sub_repo.update_in_center`·support answer_inquiry `InquiryRepository.update_in_place`.
> - **same-top-module read 6**(A=A, cross-module 아님): notice get/list(modules/notice.notice)·voucher/_compose(voucher.voucher_document)·client/list_favorites(client.*)·assessment/create_send_result(assessment.assessment_session)·subscription/get_usage_overview(subscription.subscription). → application handler가 자기 top-module repo 직접 read = 구조 정리(모듈 handler化 or facade read reroute) 대상이지 **cross-module Client 신설 대상 아님**.
> - **admin 오케스트레이션 §407-decided 2**: notice/notify_notice(NoticeRepo+AdminAuditLog 쿨다운) — 이미 §407 승격 end-state, Member/PersonClient 사용 중.
> - **유일 cross-module read 잔여 1**: support answer_inquiry:95 `AdminAccountRepository.aggregate_name_map_by_ids`(answered_by_name enrichment) — thin AdminAccountClient 후보이나 admin 이름 aggregate라 §6.3 read-model 경계(판정 필요, 저가치).
>
> **∴ 큰 모듈 Client 신설 buildout = 실질 없음** — 진짜 cross-module enrichment read는 파일럿(Person/Member/Center/Account)+answer_inquiry 슬라이스로 소진. 잔여 `uow.repo` 사이트는 §3(write facade)·구조(same-module app-handler)·§6.3(admin) 소관이지 9-4 Client 신설 아님. 오집계 정정.

## 10 Behavior/Server — `[완료: 발견 7(실버그 1) · 면제 7]` (2026-07-06, 21파일 정독)

| file:line | 설계 조항 | 현행 | 기대 | 파괴성 |
|---|---|---|---|---|
| main.py:135-136 | **실버그** | `"^/redoc$"` 뒤 콤마 누락 → `"^/redoc$^/docs$"` 암묵 결합 — 두 경로가 metrics 제외 실질 누락 | `"^/redoc$", "^/docs$",` 분리 | 코드만 |
| main.py:129-141 | server.md 안티패턴(미들웨어 인라인 금지) | Instrumentator를 빌드 후 명령형 인라인 | 팩토리 이동 또는 rule 계측 예외 명시 | 코드만 |
| server/middleware.py:88-89 | behavior.md §1 | 주석이 존재하지 않는 RequirePermissionVersion을 stash 주체로 지칭 | 실제 주체 RequireCenter.act(center.py:69)로 정정 | 코드만(주석) |
| behavior/action/dispatcher.py·dsl.py:75-80·server.py 외 | behavior.md §1 구조표·§2·§4 목록 | Require*Dispatcher·with_dispatcher()·dispatcher 필드 실재(rule §4 스니펫엔 등장 — rule 내부 불일치) | §1/§2/§4 목록 갱신 | 문서 스테일 |
| behavior/worker.py:20-36 | behavior.md §1·§6 | use_cron_action 실재 미기술 | rule에 cron entry 반영 | 문서 스테일 |
| server/system.py | server.md 표 "스키마 라우터" | root/health만 존재 | rule 서술 정정 | 문서 스테일 |
| server/lifecycle.py:17-82 | server.md "init_db 전 모듈 import" | 부분집합(라우터 import가 transitively 커버해 기능 무해) | 서술 정정 또는 import 보강 — **판정 필요** | 문서 스테일 |

면제 7: audit()/RequireAudit(과도기)·request_unscoped admin 분기(carve-out)·stream 수동커밋 세션(10-3 keeper)·stream_unscoped stub(정합)·lifecycle BG 세션(keeper)·분리4 라우터·unscoped docstring(과도기). "request 커밋 소유(server.py:123)" 정합 확인.

## 11 AI 호출 — `[완료: 발견 9 · 면제 4]` (2026-07-06, 51파일 정독)

핵심 판정: **rule이 3축(AIFacade·precheck_quota·run_experiment)을 완료형으로 서술하나 코드에 없음** — 구현 미착수 상태에서 rule 선행 작성. 멀티모달 단일화(D2 옵션2)만 완료·정합(직접 생성 0·record 신규 0).

| file:line | 설계 조항 | 현행 | 기대 | 파괴성 |
|---|---|---|---|---|
| modules/llm/facade/ai_facade.py 부재 | 11-2 D1·rule | AIFacade 미신설 — 16파일이 create_ai_gateway() 직접 취득 | AIFacade 신설+소비처 이관 | 비파괴(라우팅) |
| gateway/ai_gateway.py 메서드 부재 | 11-1 D3·rule | precheck_quota 없음 | 신설 | behavioral(크레딧) |
| agent_stream_v5.py:57·step_diarize.py:42 | D3·rule | CreditOps 직접 호출 2건 | AIFacade.precheck_quota 경유 | behavioral |
| gateway 메서드 부재 + ai_lab 4파일·runtime/agent 2파일 raw 호출 | 11-3 D2·rule | run_experiment 없음 → raw client 직접 호출 잔존 | run_experiment 신설 후 이관 | behavioral(과금) |
| gateway/ai_gateway.py:351 | 11-5·rule 역참조 금지 | field_note normalize_diarize import | infra/게이트웨이 헬퍼로 이동 | 비파괴 |
| gateway/ai_gateway.py:52-53 | rule 역참조 금지 | ai_lab ProductionAIConfig 직접 select — 설계 미언급 공백 | 이관 or rule 예외 명시 — **판정 필요** | 비파괴 |
| field_note pipeline_facade.py:621 | 11-3 워크리스트 | _text_diarize raw openai_client(quota·기록 없음) | generate_text 이관 (field_note 이니셔티브와 조율) | behavioral |
| 11-ai-calling.md 문서 측 | 문서 스테일 | "chat_stream_v4"·"24 소비처" | v5·16파일로 갱신 | 문서 |
| llm/handlers/change_credit_rate.py:44 | rule TOOL 계약 | changed_by를 TOOL input 노출 | actor 주입 전환 검토 — 경계 사례 | 낮음 |

면제 4: record_external_call 잔존 4곳(agent 2=rebuild·field_note 2=D1/D2)·스트리밍 raw STT(D1)·specialized diarize(D2)·정규화 DTO import.

## 12 Runtime — `[완료: 발견 6 · 면제 5]` (2026-07-06, 29파일 정독)

핵심: R1이 **write 측만 이행**됨 — read 측 foreign repo/model 직접 접근 4파일 + ORM 직접 대입 1건 잔존(9e78bc가 executor mutation만 제거, service 내 mutation 누락). owning facade에 read 메서드가 없어 reroute 아닌 신설 필요.

| file:line | 설계 조항 | 현행 | 기대 | 파괴성 |
|---|---|---|---|---|
| runtime/form_template/service.py:85 | R1 write·runtime.md §1 | `extraction.image_document_id = ...` ORM 직접 대입(커밋 편승 영속) | FormExtractionFacade에 설정 메서드 신설·경유 | behavioral |
| runtime/form_template/executor.py:22-61 | R1 read | FormExtractionRepository·Status 직접 import·조회 | facade read 신설·경유(현재 read 0) | behavioral |
| runtime/voucher_document/executor.py:26-76 | R1 read | VoucherExtractionRepository 직접 조회 | VoucherFacade read 신설·경유 | behavioral |
| runtime/voucher_document/executor.py:21-63 | R1 read | GlobalDocumentRepository 직접 취득·주입 | GlobalDocumentFacade 경유(기존 facade로 reroute — 경미) | behavioral |
| runtime/voucher_document/extraction/service.py:26-308 | R1 read | GlobalDocument 모델·repo 직접 import·호출 | 동일 클러스터 — facade read 경유(including_deleted 변형 신설 여지) | behavioral |
| 12-runtime.md §12-6 워크리스트 | 문서 스테일 | "6파일·14 import·5 uow.repo+facade 부재" | 잔존 실측 = 4파일·8 import·3 uow.repo(read)+mutation 1로 갱신 | 문서 스테일 |

면제 5: Track B leaf executor AsyncSessionLocal(§3 keeper)·render.py 내부 import(rule 선례 승인)·게이트웨이 반환타입/순수파서 import·AIPurpose/validate_form_schema(금지 범주 밖)·agent/new_agent(별건). R2·R3/X3·AI 게이트웨이 경유 = 정합.

## 13 core — `[완료: 발견 5(전부 문서 스테일) · 면제 6 · 코드 위반 0]` (2026-07-06, 11파일 정독)

| file:line | 설계 조항 | 현행 | 기대 | 파괴성 |
|---|---|---|---|---|
| core/schemas.py:1-28 | 13-core.md 서두·core.md | 공통 응답 스키마 4종(MessageResponse 등)이 core에 실재하나 설계·rule 미기재 | core 구성물로 등재 또는 소유 rule 지정 | 문서 스테일 |
| core/config.py:40-61 | §13-4 LLM 6종 쌍 관례 | 쌍 5종 + MODEL 단독 2종(agent 계열) | 서술 갱신 | 문서 스테일 |
| core/logger.py:28 | §13-4 extra 화이트리스트 3키 | 실제 7키 | 열거 갱신 | 문서 스테일 |
| core/datetime_utils.py:121-133 | §13-4 함수 목록 | coerce_date 추가 실재 | 목록 반영 | 문서 스테일 |
| core/tool_loader.py:87-94·tool_registry.py:46-76 | §13-5 validate/registry 서술 | 코드가 서술보다 발전(permission 필수·중복검사·write만 수집 등) | 서술에 반영 | 문서 스테일 |

면제 6: Feature 미신설(저우선)·validate feature 대조(선행 미착수)·behavior.py(behavior rule 소유)·FIND 포맷터 2벌(keeper)·role 3축 부재(설계 정합)·agent 계열 설정(분리4). 역-import 0·예외 7종 정합·안전망 400 실재 확인.

## 14 worker — `[완료: 발견 3 · 면제 7]` (2026-07-06, 13파일 정독)

| file:line | 설계 조항 | 현행 | 기대 | 파괴성 |
|---|---|---|---|---|
| cron/scheduled.py:25 | §14-5 워커→모듈 직접 import 금지 | notification.helpers 직접 import 발송 | handler 경유. **단 설계 예시 A(97-99행)가 직접 사용을 보여줘 설계 내부 모순 — 정본 확정 필요** | 코드만 |
| 14-worker.md §14-1·워크리스트(A) | 문서 스테일 | 코드는 이미 목표 상태(use_cron_action+xact lock, 핸들러 tx-free) | 설계 "현행" 서술·(A) 상태를 완료로 갱신 | 문서 스테일 |
| application/handlers/subscription/apply_expired_downgrades.py:21 | §14-1 cron tx-free | begin_nested 세이브포인트 잔존 | SAVEPOINT는 커밋 아님 → xact lock 유지·실해 없음. 허용이면 rule 명문화 / 위반이면 재설계 — **판정 필요** | 코드만 또는 문서 |

면제 7: retry Track A(seam 선행 별건)·Lifecycle 추출(저우선)·shutdown(wait=False) keeper·__main__/batch.py 부트 keeper·sweeper의 EventRepository(아웃박스=워커 인프라)·scheduled.py 단일파일 keeper·분리4 해당무.

## 15 infrastructure — `[완료: 발견 19 · 면제 10]` (2026-07-06, 63파일 정독)

총평: 핵심 불변식 정합(DB세션 무소유 0건·factory 단일 진입·봉인 4계열 완료). 설계 워크리스트 상당수 기반영 → 문서 스테일 5. 잔여 실이탈은 소수+판정 2.

**문서 스테일 (15-infrastructure.md 갱신)**: §15-3 settings 직독은 cache/redis 1곳만 잔존(문서는 4곳) · §15-4 예외 "3/11"→봉인 4계열 완료 · §15-5/2/7 email base·storage logger·token docstring·ghost 3 전부 완료됨 · messaging lgu transport.py:4 docstring 거짓(factory co-locate 주장) · rule(infrastructure.md)에 DB세션 무소유·봉인 계열·schemas 필수·명명 규약 미기재.

**코드 발견**:
| file:line | 조항 | 현행 | 기대 | 파괴성 |
|---|---|---|---|---|
| cache/redis/manager.py:17-35 | 15-3 | settings 직독 잔존(유일) | factory 주입 | 비파괴 |
| email/templates 3파일 | 15-3 | FRONTEND_URL 직독 — 설계 열거 누락분 | 주입 or 콘텐츠 빌더 인정 — 판정 | 비파괴 |
| email/templates/admin_invitation.py:20 | rule §6 | getattr localhost fallback | 명시 실패 | 비파괴 |
| cache/factory.py:8-10 | rule §6 | Redis 실패→Noop 조용한 대체 | **판정 필요**: carve-out 명문화 vs fail-fast | behavioral |
| worker/factory.py:14-23·distributed/client.py:44-54 | rule §6 | realtime→embedded fallback(batch는 명문 무fallback — 대조) | **판정 필요** | behavioral |
| worker/factory.py:21,36 | §4/§5 | redis_client._redis private 관통 | 계약화 | 비파괴 |
| messaging·storage base | rule §4 | 출력 전부 dict(다운그레이드) | common/schemas.py typed struct — 광역 | behavioral(광역) |
| email smtp·messaging lgu 4곳 | rule §5 | 래핑 시 from e 누락 | from e | 비파괴 |
| storage/s3/client.py:99-103 | 15-4 | restore_version head_object 봉인 누락 | 봉인 | behavioral(저위험) |
| storage/local/client.py:82-83 | 15-4 | local만 core 예외 인라인(s3와 불일치) | 모듈 예외 통일 | 비파괴 |
| internal_auth.py·client_info.py | 폴더 표준 | 루트 bare .py — 설계 미등재(의존성함수 카테고리) | 설계 열거 보완 | 문서 공백 |
| storage/factory.py:27 | rule §6 | RuntimeError | ValueError | 경미 |
| factory 명명 전반 | 15-5 | get_* 접미 불균일 | 규약 이행+rule 명문화 | 비파괴(미착수) |
| anthropic/cache/worker 예외 base | rule §5 | bare Exception·message 속성 없음·messaging *Exception 접미 | {Module}Error(message) 통일 | 경미 |

면제 10: lgu 4파일 keeper·재export 고팬아웃·redis_manager 싱글톤(D15)·payment raw dict(carve-out — rule 명문화 권장)·webhook 의존성함수·token decode None·AI_WORKER_MODE dispatch·hash passlib(P0 대기)·anthropic 추상화(계층11)·DB세션 무소유 정합.

---

## 종합 우선순위 (일괄 수정 슬라이스 순서 제안)

**P0 — 보안·실버그 (즉시, 독립 슬라이스)**

> **해소(96d2312fa·문서 dc):** P0 결정-불필요분 완료 — 스코프 강제 9(assessment 4·counseling 4·document 쓰기경로)·실버그 5(main 콤마·tempfile·죽은분기·flag_modified·도달불능 flush)·get_participant 스코프. **잔여 P0(P1로 재분류):** subscription/voucher 스코프(rename·finder 결정)·register_center_holidays 무인증(호출주체 결정).
> **rule 정정 완료:** service.md X2 예시·시그니처 문구·bulk command 반환행·`.build()` verify · repo.md eventing `mark` 접두 예외.
1. repo 센터 스코프 미강제 12곳+B 동류(document·subscription·voucher update/remove — 크로스테넌트 쓰기 가능) — get_in_center 선행 [03]
2. 무인증 mutating 라우트 register_center_holidays [07-A]
3. main.py 콤마 누락(/redoc·/docs metrics 제외 누락) [10]
4. counseling get_participant_by_id center_id 미사용 [04-4]
5. 실결함류: tempfile 누적[04-2]·flag_modified 비대칭[04-5]·upload_document 죽은 분기[04-6]·update_document mass-assignment[04-6]

**P1 — 판정 필요 (사용자/설계 결정 후 집행)**

> **해소(사용자 결정 2026-07-06, 집행 07-06~07, 전 항목 boot 577·300 tests green):**
> - ~~register_center_holidays 무인증~~ 코드는 이미 machine gate(verify_internal_secret) — 잔여였던 "시크릿 미설정=통과"를 **명시 실패(503)로**(f3f6e143f)
> - ~~subscription/voucher 스코프~~ update_in_center 스코프 검증은 기해소 확인. 잔여 이름 거짓말 2종 rename(4849e5346): subscription find/get_active_*→find/get_in_center*(상태 필터 없음)·session_participant update_in_center→update_in_place(center_id 미수취)
> - ~~send 계열 외부발송~~ **carve-out 유지 결정**(동기 delivery_results가 제품 계약) — application.md §3에 7핸들러 한정 명문화, behavior 2-phase 도입 시 이행 대상(329e83d90)
> - ~~pa/notice repo 타모듈 command~~ add·update_in_place는 호출처 0(dead) — 삭제, pa repo는 read-model 전용 확정(38a8acd9b)
> - ~~다중 repo(04-9 스코프 19)~~ **facade 승격 집행**(e943c3d32): subscription 11=PlanTransition 반환+facade _record·roll_center_period도 facade 경유, payment 1=facade 락 로드 후 primitive, voucher 6=VerifyCenterVoucherScopeService 신설+단일 repo(+current_user dict 2 정리). confirm_extraction은 keeper(인터리브 upsert — 분해 시 비즈니스가 facade로 새는 역위반, 주석 명기). **04-9 밖 다중 repo**(billing billable 6·payment 2·counseling 1·field_note 2·pa 4)는 이 결정 스코프 밖 — 별도 판단
> - ~~schedule tuple 3-원소~~ 2-튜플 + facade list_conflicts 재조회(생성/수정 후 exclude_id, update는 배치 필드 변경 시만 — 기존 계약 유지)(0ba6e76f3)
> - ~~SAVEPOINT~~ 허용 명문화 — worker.md에 per-item begin_nested는 tx-free 위반 아님(xact lock 유지, stream 점진커밋·별도세션은 lock 붕괴라 불가)(329e83d90)
> - ~~worker fallback~~ **명시 실패로 통일**: realtime distributed에서 Redis 부재/XADD 실패 시 WorkerDispatchError raise, fallback 파라미터 제거(00ffa38ff)
> - ~~changed_by~~ actor_type으로 rename(a5ca63887): 마이그레이션 a9c2f4e8b1d3 + API 전 경로 + admin 프런트 4곳. 로컬 dev DB는 alembic_version 부재(init-schema 기반)라 직접 ALTER — ~~migrations 멀티 heads 3개 잔존~~ **오기 정정(2026-07-07, 직접 확인)**: `alembic heads`=단일 `2c822294da36`, 중복 revision-id 0. 언급된 3개(3becd412c584·b2c3d4e5f6a7·f2a3b4c5d6e7)는 head가 아니라 정상 조상(3becd는 branchpoint). 직전 세션 병합(line 하단)으로 이미 single-head — **잔여 아님**
> - ~~admin_email~~ 감사 시점 스냅샷 마커 주석(329e83d90)
> - ~~2-A 완료 범위~~ 실측 재정의: 진짜 갭은 AdminRole 상수클래스뿐 → str,Enum 전환(e936daffb, 그룹은 nonmember). 잔여 목록(assessment.status·schedule_type·notification.priority 등)은 **Enum이 이미 schemas.py에 존재** — 갭은 "models.py 공존 위치·모델 컬럼 파라미터 Enum 타이핑 미배선"으로 재분류(저우선)
> - ~~atomic-in-handler 37~~·~~eventing repo mark~~ 는 앞선 결정4·rule 정정으로 기해소(스테일이었음)
>
> **P1-2차 결정(사용자, 2026-07-07) 집행 — 완료 11 / 잔여 0 (boot 577·tests green; 3-3에서 no-bill 체크 1 추가로 301):**
> - ~~D get_plans 무인증~~ 공개 확정 주석(22e0c338a)
> - ~~H 분석 트리거 atomic~~ StartAnalysisService 신설, handler 인라인 생성 제거(6527a59c9)
> - ~~F update_status_by_case RETURNING~~ 소비처 확인(rollback_case cascade가 반환 행 실사용 — 사후 재조회로 방금 전이분 식별 불가) → repo rule §10 별개 연산으로 명문화(764d4aa28)
> - ~~C(a) 부모/자식 애그리게이트~~ service.md §4 예외 명문화: Billable+BillableItem 6·confirm_extraction·field_note+audio 2 = keeper(764d4aa28)
> - ~~G 초대 토큰 jose 직접~~ infra Token에 create/decode_admin_invitation_token 신설, invite/accept factory 경유(507c4976d)
> - ~~C(b) payment 2~~ 단일 repo + facade 조율, 완납 정책은 billable측 ApplyPaymentTotalsService 신설(3201e07ec)
> - ~~C(c) read 조합~~ admin_mgmt invite/accept를 단일 repo 서비스 4개로 분해·notice_read 2(검증 handler로)·collect_case_data(세션 서비스+pure-logic 분해)(651c00cd6)
> - ~~E 로그인 알림 이메일 스텁~~ **실구현**: event reaction 경로(login_new_device_detected → email_login_notification_handler, SMTP 실발송+notified 멱등 가드), 가짜 스텁·고아 repo 메서드 제거(b1cd0ebf9)
> - ~~I 워커 notification.helpers 예외 명문화~~ worker.md 구조·import 예외 2로 명문화(발송 표면 직접 사용 허용)·14-worker 설계 자기모순 keeper로 정리(743f24fb4)
> - ~~B Runtime R1 read 5건~~ FormExtractionFacade find/set_image_document·VoucherFacade find_extraction_including_deleted·GlobalDocumentFacade get_many_including_deleted 신설·executor/service reroute·is_completed 프로퍼티로 Status enum import 제거·ORM 직접대입 제거. 12-runtime 워크리스트 실측 4파일 갱신(ef8ef0b5b)
> - ~~A AI 3축~~ 3커밋: **3-1** AIFacade 신설·소비처 16파일 create_ai_gateway→create_ai_facade(8b367f7b9) · **3-2** 게이트웨이 precheck_quota·CreditOps 직접호출 2곳 이관(1989ad5c5) · **3-3** 게이트웨이 run_experiment(model override+no-bill)·ai_lab 4파일+field_note _text_diarize raw client 이관·no-bill 유닛체크 1 추가(bc6a74f12). **부속 판단**: resolve_config의 ProductionAIConfig 직독=config source-of-truth keeper(rule 예외 명시), agent 프로덕션 transport(startup·selector)는 실험 아님→agent-rebuild 소관으로 범위밖. ai-calling.md 계획→완료형 전면 갱신
>
> **04-9 밖 다중 repo 판정(사용자, 2026-07-07):** 실측 결과 대부분 P1-2차·중간 리팩토링에서 기해소 — billing billable 6·field_note 2 = C(a) keeper 확정, payment 2 = C(b) 해소, counseling 1(collect_case_data) = C(c) 분해. **유일 생존 = platform_admin notify_unread_members**(NoticeRepo + execute 인자 audit_log_repo). 판정 = **승격**(부모/자식 애그리게이트 아님 — audit_log는 독립, 쿨다운은 크로스서브모듈 read): audit_log `find_last_action` 조회를 application handler(notify_notice)로 올리고 service는 NoticeRepo 단일 + `last_remind_at` primitive 수취(쿨다운 정책은 service 잔류). 자매 handler notice_read/get_read_status가 이미 같은 패턴. **잔여 audit_log_repo 주입형은 behavior-audit-fix 소관**(별 이니셔티브).

atomic-in-handler 37건(수정 vs carve-out)[08] · SAVEPOINT 허용[14] · cache/worker fallback[15] · subscription_history.changed_by 분해[00] · admin_email 박제[00] · 2-A 완료 범위 재정의[00] · send 계열 외부발송 tx 밖 이동(응답 계약 변경)[06-1·06-2] · pa/notice repo 타모듈 command[03-B] · schedule tuple 3-원소[04-7] · eventing repo mark(rule 간 충돌)[03-B] · ~~04 다중 repo 19+(keeper 명시 vs facade 승격)[04-9]~~ **전건 판정 완료**(04-9 스코프=e943c3d32, 밖=P1-2차 C+notify_unread 승격)

**P2 — 비파괴 기계적 (codemod 가능)** — *주의: 라벨과 달리 아래 다수는 런타임 동작이 바뀌는 refactor다. 진짜 mechanical한 것만 해소, 나머지는 repo 빌드아웃/P1로 재분류.*
- ~~docstring/phase/나레이션 대량(4-B/4-C 소급)~~ **해소(19d3cbf08 + 파일럿 19d9c798c): 156+35파일, AST code-invariance(코드변경0)·boot·300 tests green**
- ~~main() 사장 보일러플레이트~~ **해소(bd4a0e47c): 실 7파일(대장 ~52 과대추정)·# main 마커 동반 제거·TOOL 보존**
- ~~파일/클래스명 불일치 (_service 접미)~~ **해소(8b2df3068): 4파일 rename·import 갱신**
- Model mutate+_session → repo update/remove: **해소(e6edf2338·f5056b142·af 후속 6커밋): ~27 서비스 전환 + repo 메서드 ~10 신설(base restore_by_id 포함).** 처리 모듈 = auth/account·center/member·form/template(update_in_place)·form/form(update_in_center+remove_in_center)·notification 3(update_in_place)·document delete/restore(base remove/restore)·ai_lab·program_member·client·share_token(increment_download_count)·counseling participant(remove_by_session_and_type)·form/send. **KEEP**: create_notification·create_field_note begin_nested(savepoint=tx 제어, mutate 아님). **다른 finding으로 이관**: add_llm_call(cross-repo 조율=facade/gateway 소유, 04-8)·person/credential recompute(공유 session 헬퍼)·get_notice raw select(read→repo finder, 04-8)·update_document(dict-blob→아래 dict→primitive 결합)
- find+인라인 raise → get_/verify_: **부분 해소(per-site, blanket 금지). 43 안티패턴 사이트 분류·전환 11**(auth/account 5·schedule 5·notification mark_as_read 1 — base get_by_id 메시지가 서비스와 **정확히 동일**한 것만). **KEEP 이유별**: 한글 메시지 13(user-facing 의도)·비-NotFound raise 9(Quota/Unauthorized/PermissionDenied/InvalidOp — 세만틱 다름, token/login은 보안상 존재 비노출)·영문이나 모델명 불일치 ~6("Sample"→base "LabSampleDataset" 등 서비스 메시지가 더 나음). **defer 3 → 해소(7e9de486f)**: voucher_document get_pair·AdminCenter(Client)Repository get_center 신설(read-model repo여도 get_ 신설은 무방, 서비스 메시지 그대로 이관) 후 서비스 3곳 전환. warn_center는 한글 메시지라 KEEP. 규칙: repo get_ 메서드 본문은 절대 미변경(self-recursion 방지).
- dict blob/current_user → primitive: **해소(2026-07-06, 전 항목 boot·300 tests green).** 전환 11 use-case: update_voucher(6025fe386)·create_voucher(494059b1f)·update_assessment(8dae1c0a8)·assessment_task/update_task(eb2de8c0f)·update_plan_config(6eb26976d)·update_document(8ac173380, mass-assignment setattr 루프·repo._session flush 제거)·ai_lab UpdateSample(e129fe672)·create_case_participant_simple(dc8468330)·create_link_request(06d142d26, execute_with_dict→execute)·billing current_user 3 서비스(6e4f3fbc4, complete_payment 스키마 수취도 primitive화)·platform_admin 계정관리 current_admin 5 서비스(a50fc18b4, actor_id: str). **이미 primitive(전환 불요)**: center/program update_program·person update_person(전 레이어 typed, 내부 omit-필터 dict만). **KEEP 추가 분류**: submit_with_workflow data(workflow.on_submit 불투명 payload)·update_platform_settings updates(key-value EAV, 고정 컬럼 아님)·changed(이벤트 payload) — §착수가이드 KEEP 목록(content·meta·toss_response 등 단일 JSON 컬럼)과 동일 결
- ~~중복 use-case 3쌍~~ **해소: person GetPersonByIdService(dead)·assessment GetCaseByCenterService(→GetAssessmentCase)·voucher GetClientVoucherEntityService(→GetClientVoucher) 삭제, canonical로 통일·참조 갱신. boot·300 tests green**
- ~~S1 .build() 4~~ **해소(2026-07-07, 301 tests green)**: 실측 재확인 결과 4건 실재(P0 노트의 "grep 0"은 rule verify 패턴 얘기였고 코드는 미해소였음) — platform_admin `list_centers`·`list_terminated_centers`·`list_center_clients`·`list_applications` service가 `*ListResponse.build()` 조립. 승격: service는 `tuple[items, total]`(+stats) 반환, handler가 `.build()`. 검증 `grep .build(|model_validate services/` = 0.

**P3 — 문서·rule 정정 (코드 무변경)**
설계 스테일 ~30건(각 섹션 "문서 스테일" 표기분) · rule 정정(service.md 예시 X2·router.md canonical·bulk command 반환·reference_tables는 반영됨) · census 재동기화(6-1/tx 199)

**해소분(2026-07-07, 병렬검증 후 코드대조로 진짜 스테일만 정정):**
- rule `behavior.md` §1 table(dispatcher.py·use_cron_action·with_dispatcher 추가)·§2 ServerMemory 키(dispatcher)·§6(cron 교차참조) · `server.md` system.py "스키마" 오기 제거 · `13-core.md` config LLM 5쌍+단독2·logger 7키·datetime coerce_date·schemas.py 응답DTO 등재 · `08-eventing.md` 8-3 center_assessment 해소 반영(delete_conversation만 잔여) · `14-worker.md` §14-1+워크리스트(A) cron `use_cron_action` 이행 완료 반영 · 코드 docstring lgu/transport.py factory co-locate 거짓 정정(AST 동치).
- **이미 정합 확인(무변경)**: 04/service.md §2 X2 예시·09-1 §9-1 스코프·11-ai-calling 라이브 rule·12-runtime §12-6(기갱신)·server lifecycle init_db 서술.
- **추가 해소(2026-07-07, 실측 확정)**: 15-infrastructure.md §15-3 settings 직독 리스트 실측 교정(token/jwt·scheduler 오기 제거, 실제 cache/redis·payment/webhook·llm client·email templates·internal_auth)·§15-4 exception 봉인 "3/11"→실측 8/13·봉인 4계열 완료 반영·워크리스트 2행 갱신 · infrastructure.md §5에 "봉인 need-driven" 규약 추가 · 11-ai-calling 설계문서 T2 카운트 24→16·D2/D3 워크리스트 5행 완료 마킹(집행 해시 부기).
- **factory 접미사 규약 해소(2026-07-07)**: 재조사 결과 §6이 이미 `get_X()` 기본 + provider dispatch `{provider}_client` 예외를 정하고 **코드는 사실상 전부 준수**(위반 0). 접미사 차이(`_client`/`_service`/역할명)는 드리프트가 아니라 추상화 레벨 표시(transport vs 조립 vs 단일 추상화). 코드 통일 불요 — §6에 접미사 뉘앙스 1블록만 명문화(신규 factory 가이드). "코드 통일 선행 필요"는 오판이었음.

**이월 재확인**: X2 소급·X1 1566·2-A 잔여·9-4 Client 잔여 22·emit 없는 producer·4-E 분할형 — 기왕 대장 유지.

**~~migrations revision-id 4중 충돌~~ 해소(2026-07-07):**
alembic `present more than once` 경고. 실측 결과 **revision id 4개가 각각 두 파일에 중복 선언**(a1b2c3d4e5f6는 single vs double quote 차이로 은폐됨):
- `a1b2c3d4e5f6` = add_read_permissions(2026-03-11, agent-era) vs llm_calls_rename_error(2026-07-06)
- `c3d4e5f6a7b8` = refactor_message_run_fields(agent) vs assessment_rename_expired_at(최근)
- `d4e5f6a7b8c9` = cleanup_conversation_fields(agent) vs member_invitations_rename(최근)
- `e5f6a7b8c9d0` = add_latency_ms_to_agent_runs(agent) vs schedules_rename_note_to_memo(최근)

원인: 2026-07-06 rename 체인(llm_calls→login_notif→assessment→member_invitations→schedules→session_participants)이 2026-03-31 agent 체인과 **동일 순차 id를 손으로 재배정**. **해소**: 최근 interloper 4파일 revision을 유니크 id(f1e2d3c4b5a6·f3e4d5c6b7a8·f4e5d6c7b8a9·f5e6d7c8b9a0)로 rename + 체인 child 4곳 down_revision 재배선 + 파일명 4개 git mv. old-chain 파일은 원본 id 보존→downstream(6b36466141ef·99d4d59db373·cleanup·add_latency) 무손상. 검증: alembic heads 경고 소멸·dup 0. 이어서 잔여 legit 2 head(a9c2f4e8b1d3·f2a3b4c5d6e7) `alembic merge`로 단일화(2c822294da36, empty up/down). **최종 head 1개**. dev DB=init-schema라 로컬 무영향, 프로덕션은 파일 DAG로 검증.

---

## 이어가기 — 다음 세션 착수 가이드 (2026-07-06 기준)

### 환경·제약
- 브랜치 `tmp-agent-v7`. **git push/fetch/pull·reset 영구 금지**(git-guard hook). 로컬 커밋만 — 원격 반영은 사용자가 직접. Step 5 main 머지도 사용자 몫.
- 테스트 baseline: `cd apps/api && uv run pytest -q -p no:cacheprovider` → **300 passed, 59 skipped**(불변). boot: `uv run python -c "from app.main import app; print(len(app.routes))"` → 577.
- 커밋 규약: 한글 prefix(refactor:/docs: 등), 끝에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

### P2 완료분 (이번 세션, 전부 boot·300 tests green)
docstring/phase 스윕 191파일 · main() dead 7 · `_service` rename 4 · **Model mutate→repo update/remove ~27서비스+repo 메서드 ~10신설**(base `restore_by_id` 포함) · **find+raise→get_ 11**(base 메시지 정확 동일분만) · **중복 use-case 3쌍 삭제**. 각 항목 위 P2 리스트에 커밋 해시 부기.

### P2 잔여 — 착수 우선순위

**(1) dict blob → primitive [완료 — 2026-07-06]** — 위 P2 리스트 "dict blob/current_user → primitive" 항목에 커밋 해시·KEEP 분류 부기. 아래 원래 분류는 기록으로 유지:
- **전환 대상(unpack형)**: `update_voucher`·`create_voucher`(fields)·`update_assessment`(fields)·`assessment_task/update_task`(updates)·`plan_config/update_plan_config`(updates)·`document/update_document`(data setattr 루프)·`ai_lab manage_samples UpdateSample`(data)·`create_case_participant_simple`(participant_data)·`billing/*`(다수 fields/updates)·`center/program/update_program`·`person/update_person`·`link_request/create_link_request`(data_dict).
- **KEEP(진짜 JSON 컬럼)**: `content`·`meta`·`set_summary`·`institution_summary`·`toss_response`·`scores`·`interpretation`·`participant_snapshot`·`assessment_info`·`completed`·`input_data`/`output_data` — 단일 JSON 컬럼 저장이라 unpack 아님.
- **current_user/current_admin: dict**(billing/_legacy·platform_admin invite/update_role) — 인증 컨텍스트 dict → 타입드 DTO/개별 인자로. caller(handler)가 ctx에서 뽑아 넘기게.
- 절차: 서비스가 dict에서 뽑는 키 → repo `update_in_place`(+`unset`) 타입 인자로 승격 → 서비스 시그니처를 primitive로 → **handler/facade caller가 dict 대신 primitive 전달**(여기가 파급점, grep으로 호출처 전수 수정) → boot+300 tests → 모듈 커밋.

**(2) find→get defer 3 [완료 — 2026-07-06, 7e9de486f]** — 위 P2 리스트 "find+인라인 raise" 항목에 해소 내용 부기.

**(3) P1 결정대기** — §종합 우선순위 P1 참조. atomic-in-handler 37·send 외부발송 tx밖 이동·subscription/voucher 스코프(rename·finder 결정)·pa/notice repo 타모듈 command 등. 사용자 결정 후 집행.

### 안전 프로토콜 (이번 세션에서 검증된 방식)
- **agent 보고 불신 — git+테스트가 진실**. 대량 병렬 agent는 rate-limit로 thrash했음. 인라인 per-module 처리가 안정적.
- 모듈 단위: 편집 → `grep -rn "repo\._session\." <module>/services`(잔여0 확인) → boot → 300 tests → 커밋.
- 순수 주석/docstring 변경은 AST code-invariance 검증(scratchpad `verify_cosmetic.py` 패턴: `git show HEAD:{f}` vs 현재, docstring 제거 후 `ast.dump` 대조).
- repo `update_in_place`가 `Model|None` 반환 → 서비스가 존재 검증했으면 `assert x is not None`(function arg 전달 시 타입에러 방지).