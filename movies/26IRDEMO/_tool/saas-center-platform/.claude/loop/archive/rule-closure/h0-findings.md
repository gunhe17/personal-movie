# H0 전역 사전 조사 결과 (2026-07-09) — survey, 모듈 사이클에서 ground-truth

## H0-1. schemas.py `str,Enum` 판정 (30파일)

이동 = 대응 모델 컬럼 실재(§4: models.py 공존+타이핑). 판정 = 모듈 사이클에서 정독 후 결정.

| 모듈/서브 | enum | 대응 컬럼 | 분류 |
|---|---|---|:---:|
| assessment/assessment | AssessmentType·AssessmentStatus·WorkflowType | type·status·workflow_type | 이동 |
| assessment/case_participant | ParticipantType | participant_type | 이동 |
| assessment/session_participant | AttendanceStatus | attendance_status | 이동 |
| assessment/task | ExecutionMethod | execution_method | 이동 |
| assessment/send_link | SendChannel | channel | 이동 |
| billing/billable | BillableStatus·BillableItemType | status·(item 컬럼 확인) | 이동+판정 |
| billing/payment | PaymentMethod | payment_method | 이동 |
| billing/price_list | ServiceType | service_type | 이동 |
| billing/_legacy_payment | PaymentStatus | — | 묘비 제외 |
| center/member | MemberStatus·EmploymentType | status·employment_type | 이동 |
| center/member_invitation | InvitationStatus | status 컬럼 유무 확인 | 판정 |
| center/operating_time | Weekday | 컬럼 미확인 | 판정 |
| center/non_working_time | MemberNonWorkingTimeReason | 〃 | 판정 |
| center/program | ProgramType | program_type | 이동 |
| client/profile | ClientRole·ClientStatus·Gender | role·status·gender | 이동 |
| client/relation | RelationType·Guardian/SiblingDetail | 컬럼 미확인 | 판정 |
| client/resource | ResourceType | resource_type | 이동 |
| counseling/{session,case}_participant | (Case)ParticipantType·AttendanceStatus | participant_type·attendance_status | 이동(예약 기지) |
| document/document | AccessLevel | access_level | 이동 |
| document/document_access | AccessAction | 컬럼 미확인 | 판정 |
| form/send | SendChannel | channel | 이동 |
| form/template | FieldType | canonical JSON 어휘 가능성 | 판정(잔류 유력) |
| notice | NoticeCategory | category | 이동 |
| notification | NotificationCategory·Priority | category·priority | 이동 |
| platform_admin/cs_memo | MemoType | memo_type | 이동 |
| platform_admin/qna | FAQCategory | faq 모델 확인 | 판정 |
| platform_admin/voucher | VoucherFileType·ExtractionStatusEnum | voucher 모듈 소유 판정 | 판정 |
| role | RoleCode | code (13-core: role 모듈 소유 정본) | 이동+소유 재배선 |
| upload/image | ImageCategory | 모델 유무 확인 | 판정 |

## H0-2. repo 어휘·수제 페이지네이션

- 폐기 접두: `platform_admin/inquiry create` 1건뿐 (→ `add`).
- `select(func.count())` 직접 17 repo — admin read-model(tuple[list,int] 허용 §6.3)과 Model 목록(`_page` 전환 대상) 구분은 모듈 사이클에서: ai_lab/sample_dataset · center/non_working_time · document 3(document·document_access·share_token) · voucher 2 · counseling/session · platform_admin 5(center_application·inquiry·faq·center·notice·notice_read) · event/event_atomic · billing 2(billable·price_list).

## H0-3. `_by` 마커 — 소진

잔여 = `_legacy_payment` 2컬럼뿐(묘비 제외). 이월 노트 ~10은 ⑤′ 119곳 슬라이스에서 이미 소진된 것으로 판명.

## H0-4. start_event_group 없는 쓰기 라우트 141 (원시 — 오탐 다수)

오탐 부류: validate-*·preview 등 읽기형 POST / auth reject-패턴 / field_note pipeline(스트림·워커 dispatch 구조) / ai_lab(3군 자체 행). 모듈별 건수만 — 목록 재생성은 아래 스크립트.

| 모듈 | 건수 | 모듈 | 건수 |
|---|---:|---|---:|
| ai_lab | 25 | assessment | 19 |
| field_note | 13 | client | 12 |
| center | 13 | counseling | 10 |
| auth | 6 | form | 9 |
| platform_admin | 7 | person | 7 |
| role | 4 | schedule(validate 3=오탐) | 3 |
| document·voucher·upload·institution·messaging·notification | 각 1~3 | | |

재생성: `python3 -` 로 router.py들을 `@router.(post|patch|put|delete)` 블록 분할 후 `start_event_group` 부재 필터 (H0 세션 스크립트, git log rule-closure 참조).

## H1 재실측 (2026-07-09 — billing·member 배선 후. 방법 = H0-4 동일, 정규식 결함 수정: `@router.` 미매치 버그 잡음)

start_event_group 없는 쓰기 라우트 **139** (322 중). 분류:

| 부류 | 건수 | 처리 |
|---|---:|---|
| ai_lab 25 | 25 | 판정 대장 #5 대기 |
| field_note 13 | 13 | 스트림·파이프라인 dispatch 구조 — behavior.stream 결 개별 판정(H4 잔여와 동일) |
| validate/preview 오탐 | 10 | schedule 3·counseling 2·client validate-duplicates·document share validate·messaging preview·(외 읽기형) — 제외 |
| _legacy_payment | 2 | 묘비 |
| **center member 4** | — | **배선 완료(d13bef110)** — update·leave·invitation accept·role batch-assign |
| 잔여 실배선 후보 | ~85 | assessment 20(send 동기 carve-out 7 포함 — 구분 필요)·center 잔여 11(application 4·program 2·시간표 3·me·note_preference)·client 8·person 9·form 9·auth 6·subscription 7·platform_admin 9(request_admin 자체감사 여부 선확인)·notification 5·institution 3·role 2(PUT permissions·batch-assign→완료 제외 시 1)·document 1·voucher 2·messaging 1(set-default)·upload 2·llm 1 |

배선 규율 = member 선례: atomic 신설(U14 상시 승인) → service 생성 → handler emit → 라우터 그룹. 모듈별 소슬라이스로 소진.

### field_note 13 (스코프 밖 — stream/pipeline/dispatch 별도 트랙, 정밀 분해 2026-07-10)

field_note는 실시간 녹음+AI 파이프라인 모듈이라 eventing 모델이 request→emit이 아님(Track B dispatch·stream·worker 결과). 이미 배선: create·update_speaker_map·delete(FieldNoteAtomic created/updated/deleted). 무배선 13 분류:

| 부류 | 라우트 | 성격 | 처리 |
|---|---|---|---|
| AI 파이프라인 dispatch | ~~transcribe·refine·diarize·generate_summary·generate_counseling_note·run_pipeline·retry_pipeline (7)~~ + finish_recording | Track B AI 잡 큐잉(behavior.request→직접 dispatch = eventing §1 금지) | **완료(4d151b656)** — emit→reaction→enqueue 이관. FieldNotePipelineDispatchAtomic(act=`pipeline_requested`, job_type+params 운반) + 단일 generic 반응 enqueue_pipeline_dispatch_handler(JOB_HANDLERS[job_type] inline_executor). H4 form/voucher 선례 적용. 라이브 워커 검증(사용자 환경 worker up) |
| 스트림/디스패처 | upload_audio_chunk (1) | 실시간 오디오 청크 → transcribe_chunk dispatch(고빈도, 녹음 세션당 수십건) | **유지(stream carve-out)** — 청크당 outbox 이벤트는 이벤트 테이블 churn, 도메인 사실 아님(인프라). agent와 동류 |
| AI 생성 | generate_recommendation (1) | create_ai_facade LLM 생성 | **오탐 확정** — read+AI compute만(commit 없음, field_note 무변이). RecommendationResponse 즉시 반환, 미persist. 크레딧 소비는 llm 게이트웨이 소관 |
| 콘텐츠 append | add_entry (1) | 녹음 중 노트 엔트리 추가(자식 FieldNoteEntry, 고빈도) — form upsert_answers 오탐 선례 | **오탐 확정**(고빈도 content append) |
| 연결(clean write) | ~~link_schedule·link_task (2)~~ | field_note ↔ schedule/task 연결(schedule_id/task_id 설정) | **완료(d4578341e)** — 둘 다 field_note_updated emit |

결론(2026-07-10 재갱신): field_note **request→emit 표면 전건 완료** — dispatch-free 도메인 사실(create·update_speaker_map·delete·link_schedule·link_task) + AI 파이프라인 dispatch 8건 emit→reaction 이관(pipeline dispatch §1 위반 해소). 잔여 = upload_audio_chunk(stream carve-out, 청크당 이벤트 회피) + generate_recommendation·add_entry(오탐). **H1 producer 배선의 마지막 카브아웃(field_note pipeline)까지 소진.** agent(U1)만 영구 제외로 남음.

pipeline 7 + finish_recording + upload_audio_chunk의 §2 위반(behavior.request→직접 `dispatcher.dispatch`, commit-then-dispatch 유실 갭)은 emit→reaction→enqueue(H4 패턴)로 이관 가능하나, **의도적으로 blind-autonomous 배선하지 않음**: 현행 직접 dispatch는 정상 동작하며(이론적 유실 갭만), 재배선 오류 시 STT/노트 파이프라인이 **조용히** 깨진다(라이브 STT/LLM 워커 없이는 실행 정합 검증 불가). 동작하는 핵심 AI 기능을 검증 없이 재배선하는 리스크 > §2 갭 해소 이득. H4가 form/voucher만 이관하고 field_note를 유보한 판단이 정당. 이 refactor는 **라이브 워커 검증을 동반해 별도로** 집행(설계=generic emit "pipeline_dispatch_requested" {job_type,params} → 단일 reaction enqueue). agent(U1)와 동류의 명시적 carve-out.


### H1 배선 진행 (2026-07-09 세션 2)

**완료**: 슬라이스 A platform_admin 5(1c60cb0bf — qna inquiry status·faq reorder 서비스 신설+emit, admin 초대수락 accepted, 2FA 완결=logged_in, 비번 변경 changed) · 슬라이스 B auth 4(0099e5b26 — signup=account_created(CreateAccountService가 atomic), change-password=account_password_changed(facade 튜플화), devices/revoke=refresh_token_revoked(RefreshTokenAtomic 신설), 탈퇴=account_deleted(DeactivateAccountService)) · **슬라이스 C 소형 11(961638e8d)** — institution CRUD 3(InstitutionAtomic 신설)·role PUT permissions(role_updated, assign_permissions_with_response 제거)·document 업로드(DocumentAtomic.created)·voucher link/unlink 2(**ClientVoucherResourceAtomic 신설** — 원장 힌트 ClientVoucherAtomic.updated는 survey 오기, 실변이=매핑 엔티티라 participant 선례로 정정. link의 form atomic 버림도 해소=form_created 동시 emit)·messaging set-default(facade ④ 전환)·llm initialize_credit(CreditBalanceAtomic.created — facade 소비처 9곳은 반환 무소비라 무영향, F 슬라이스에서 수집 판정)·notification_setting 2(upserted/deleted, act는 created/updated 분기).

**오탐 추가 판정(기록 안 함, 근거)**:
- upload 2·notice 첨부 1 — DB 쓰기 없음(순수 스토리지, 엔티티 확정은 후속 저장이 기록)
- admin login 1차·admin refresh·auth refresh — 세션 유지 메커니즘(개시는 logged_in이 기록, 토큰 회전 기록은 이벤트 테이블 폭증)
- auth verify-password — 무쓰기 검증
- push_token 등록/해제 3 — 앱 기동마다 upsert되는 디바이스 인프라 등록(소음)
- messaging preview — 무쓰기

**잔여 배선 목록(정밀)**:
- ~~C(소형 11)~~ **완료(961638e8d)** — 위 완료 문단 참조
- ~~D-client~~ **완료(765853937)** — 실측 11라우트(원장 8은 과소집계): favorite 2(ClientFavoriteAtomic, 멱등=atomic None)·link approve/reject 2(+approve의 Client.person_id 설정 client_updated 수집)·profile 3(**uuid4 자가발급 결함 정정** — import-excel·batch·with-relations는 emit은 있었으나 event_group_id 자가발급+미배선)·resource 4(ClientResourceAtomic linked/unlinked, voucher/client link 핸들러의 form atomic 버림도 해소)
- ~~D-person~~ **완료(H1 슬라이스 D-person)** — person CRUD 3(PersonAtomic created/updated/deleted 신설: create·delete=admin actor / update=self, 서비스가 tuple 반환·PersonFacade는 unpack 후 Model 반환해 크로스모듈 소비처 4 무변경)·credential 6(CredentialAtomic created/updated/deleted/verification_requested/attachment_uploaded/attachment_removed 신설, 전부 self actor). 핸들러 레거시 `async with uow` 래퍼 제거(behavior가 tx 소유). 테스트 동반 1(delete_credential_orphan unit — tuple 언팩+handler kwargs)
- E-form **완료** — 실배선 8: instance submit(FormAtomic.submitted)·revert(reverted) / template deactivate·set-status(deactivated/reactivated 분기)·clone(cloned) / send create(FormSendAtomic 신설 + **드롭되던 instance atomic 수집** 결함 정정, form_send_created) / **resend(사용자 지시로 구조 승격 — 아래)**. **오탐 2**: upsert_answers(초안 답변 autosave 처닝 + 부모 Form 아닌 자식 FormValue 쓰기라 clean atomic home 없음)·generate_draft(무DB write, AI 스키마 반환만). 에이전트 브리지 유지: deactivate_template_with_response·revert_instance_with_response(unpack). 고아 제거: reactivate/clone_template_with_response
- **form 발송 실엔티티화(사용자 지시 2026-07-09)** — E-form에서 resend를 "form 무write 오탐"으로 판정했으나, 사용자가 "assessment처럼 진짜 엔티티 남기게" 지시. 근본 = MessageLog에 `send_link_id`/`send_result_id`(assessment)는 있는데 `form_send_id` 부재라 form 발송이 미연결 고아였고 resend `failed_only`가 무동작. 해소: MessageLog에 `form_send_id` 컬럼 신설(마이그 **b4d9f1a7c3e2**, 배포 목록 7번째)·messaging send/repo/facade 관통·create+resend가 form_send_id로 발송·resend `failed_only` 실구현(`list_failed_by_form_send_id`)·resend가 FormSendAtomic.resent emit(form_send_resent). resend 오탐→실배선 승격. 테스트 2(messaging 스레딩·form_send 연결/실패필터). 게이트 boot 576·unit 296·integration 43·e2e 50
- E-center config/membership **완료** — 실배선 6: update_my_member(버려지던 MemberAtomic 수집→member_updated)·note_preference upsert(CenterNotePreferenceAtomic 신설)·operating_time bulk(OperatingTimeAtomic 신설 — 전건교체=center_id 대상 1 atomic)·working_time bulk(MemberWorkingTimeAtomic 신설 — member_id 대상)·program_member assign(ProgramMemberAtomic 신설, bulk N atomics)·unassign(1 atomic). generate_draft형 오탐 없음.
- E-center-application **완료** — 4 라우트: create(account actor)·cancel(account)·approve(admin, **죽은 승인이메일 반응 center_application_approved 배선으로 되살림**)·reject(admin). CenterApplicationAtomic 신설(created/cancelled/approved/rejected). approve는 공용 app handler가 단일 emit 소유 → platform_admin approve_admin 래퍼의 중복 emit(AdminAudit) 제거(이중 이메일 방지). reject는 center-router(CenterApplicationAtomic)·platform_admin(AdminAudit) 2경로 각자 emit(무반응이라 무해). 테스트 동반 1(center_application_flow integration handler kwargs). **E-center 전체 완료(config/membership 6 + application 4).**
- F **완료**(사용자 결정 A 전건 이벤트화·machine actor·가 characterization 선행) — 7 라우트: self-service 5(initiate=payment_created·confirm=subscription_upgraded·reserve/cancel/request downgrade, member) + machine 2(process_expirations=downgrade_applied·webhook=payment_confirmed/cancelled/failed, **actor_type="machine"**). SubscriptionAtomic·SubscriptionPaymentAtomic 신설(도메인 사실 PlanTransition은 service, atomic은 facade에서 조립 — admin AdminAudit 관례와 동일). subscription_history(기존 도메인 감사)와 병행 = 통합 activity_log 노출. reserve/cancel은 admin 라우트와 공유 facade라 admin은 unpack+discard. **실버그 정정**: process_expirations가 apply_plan_change 후 지워진 sub.reserved_plan을 재참조(get_plan_config/initialize_credit None)해 크론이 깨져 있던 것 — target_plan 선캡처로 정정(characterization이 노출). 게이트 boot 576·unit 304·integration 43·e2e 50. roll_center_period 크론(H1 범위 밖)은 apply_plan_change tuple unpack+discard만.
- G-send **완료**(사용자 결정 3: 발송 실엔티티 create는 실write→emit, carve-out은 발송 메커니즘만) — 5 라우트: send_link create·bulk-create(N atomics)·resend / send_result create·resend. SendLinkAtomic·SendResultAtomic 신설(created/resent, 전화·인증코드 미탑재 lean payload). 동기 발송(carve-out) 메커니즘·send_link_id 배달연결은 불변. **verify_send_result 완료(사용자 결정 A — guest actor 도입·event outbox)**: 공개 수신자의 민감 보고서 인증 접근을 감사. 성공=assessment_send_result_verified(완료/대기 건수)·실패=assessment_send_result_verification_failed(reject 전 emit해 failed_attempts와 함께 커밋), 둘 다 **actor_type="guest"**(events 주석 member|admin|machine|guest 확장, 무write라 마이그 불요). SendResultAccessAtomic 신설(엔티티 미반환 verify라 send_result_id 기반). 테스트 2(reject 실패 emit·성공 guest 이벤트 영속).
- G **완료(20/20)**: send 5·verify 1(guest)·participant 2·attend 1·task 5·case 6. **assessment_case 6**: **AssessmentCaseAtomic 신설**(created/updated/completed/cancelled/cancel_reverted/deleted). create_batch=get_cases_by_ids로 N atomics·update=update_case_metadata tuple화(applied_changes는 응답만)·complete=핸들러 조립·cancel/delete/revert_cancel=app handler(레거시 async with uow+수동 commit 유지, emit는 commit 전). **delete_case는 task-delete cascade와 공유 facade → cascade측 unpack+discard**(task_deleted가 사실 기록). 전부 member. **H1 producer 배선 전 모듈 완료.**
