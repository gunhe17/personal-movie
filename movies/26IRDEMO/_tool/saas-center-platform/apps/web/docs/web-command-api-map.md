# web 등록·수정 화면 ↔ API 연동 맵

web(SvelteKit)에서 **등록(create)·수정(edit)** 동작을 하는 모든 화면/모달을, 호출 액션과 백엔드 엔드포인트에 대응시킨 참조 맵. 백엔드 실재 여부까지 교차검증(`apps/api/app/modules/**/router*.py`).

- 작성 2026-07-21 · 전수 스윕(액션 파일 × 화면 호출부 × 백엔드 라우터).
- 범위: 새 엔티티 생성(등록) + 기존 엔티티 필드 수정(수정)만. 상태전이(cancel·complete·submit·refuse 등)·검증(validate·preview)·조회·삭제·인증 흐름은 제외(맨 아래 기준).
- 상태: **모든 등록/수정 화면이 유효한 백엔드 API에 연결됨 (MISSING 0).**

## 등록·수정 → 화면 → 백엔드

| 도메인 | 화면/모달 | 동작 | 액션 함수 | 엔드포인트 (method path) | 백엔드 |
|--------|-----------|------|-----------|--------------------------|--------|
| 인증/계정 | 회원가입 (signup-service) | 등록 | `postSignup` | POST `/auth/signup` (SvelteKit `/api/auth/signup` 프록시) | OK |
| 인증/계정 | 설정 > 계정정보 | 수정 | `patchUpdatePerson` | PATCH `/persons/{personId}` | OK |
| 인증/계정 | 자격증 관리 | 등록 | `createMyCredential` | POST `/persons/me/credentials` | OK |
| 인증/계정 | 자격증 관리 | 수정 | `updateMyCredential` | PATCH `/persons/me/credentials/{credentialId}` | OK |
| 센터 | 센터 등록 신청 | 등록 | `postCenterApplication` | POST `/centers/applications/` | OK |
| 센터 | 센터 정보 | 수정 | `patchCenterDetail` | PATCH `/centers/{centerId}` | OK |
| 센터 | 센터 정보 - 운영시간 | 수정 | `putOperatingTimes` | PUT `/centers/{centerId}/operating-times/` | OK |
| 센터 | 센터 정보 - 휴무일 | 등록 | `postNonOperatingTime` | POST `/centers/{centerId}/non-operating-times/` | OK |
| 구성원/권한 | 구성원 관리 / 내 정보 | 수정 | `updateMember` | PATCH `/centers/{centerId}/members/{memberId}` | OK |
| 구성원/권한 | 내 정보 | 수정 | `updateMyMember` | PATCH `/centers/{centerId}/me/member` | OK |
| 구성원/권한 | 구성원 근무시간 | 수정 | `bulkUpdateMemberWorkingTimes` | PUT `/centers/{centerId}/members/{memberId}/working-times` | OK |
| 구성원/권한 | 구성원 초대 | 등록 | `createMemberInvitation` | POST `/centers/{centerId}/members/invitations` | OK |
| 구성원/권한 | 권한 관리 | 등록 | `postCreateRole` | POST `/centers/{centerId}/roles` | OK |
| 구성원/권한 | 권한 관리 | 수정 | `patchUpdateRole` | PATCH `/centers/{centerId}/roles/{roleCode}` | OK |
| 구성원/권한 | 권한 관리 - 역할 권한 | 수정 | `putRolePermissions` | PUT `/centers/{centerId}/roles/{roleCode}/permissions` | OK |
| 구성원/권한 | 권한 관리 - 역할 구성원 배정 | 수정 | `postBatchAssignRoleMembers` | POST `/centers/{centerId}/roles/{roleCode}/members/batch-assign` | OK |
| 상담실/프로그램 | 상담실 등록 모달 | 등록 | `postCreateRoom` | POST `/centers/{centerId}/rooms` | OK |
| 상담실/프로그램 | 상담실 수정 모달 | 수정 | `patchModifyRoom` | PATCH `/centers/{centerId}/rooms/{roomId}` | OK |
| 상담실/프로그램 | 프로그램 등록 모달 | 등록 | `createProgram` | POST `/centers/{centerId}/programs` | OK |
| 상담실/프로그램 | 프로그램 수정 모달 | 수정 | `updateProgram` | PATCH `/centers/{centerId}/programs/{programId}` | OK |
| 내담자 | 내담자 등록 (register / 등록 모달) | 등록 | `postCreateClient` | POST `/centers/{centerId}/clients` | OK |
| 내담자 | 내담자 일괄 등록 | 등록 | `postBatchCreateClients` | POST `/centers/{centerId}/clients/batch` | OK |
| 내담자 | 엑셀 일괄 등록 | 등록 | `postBulkCreateFromExcel` | POST `/centers/{centerId}/clients/import-from-excel` | OK |
| 내담자 | 내담자 상세 | 수정 | `putUpdateClient` | PUT `/centers/{centerId}/clients/{clientId}` | OK |
| 내담자 | 등록 모달 - 보호자 관계 | 등록 | `createGuardianRelation` | POST `/centers/{centerId}/clients/{clientId}/relations` | OK |
| 내담자 | 등록/수정 (관계 포함) | 수정 | `putBatchUpdateClient` | PUT `/centers/{centerId}/clients/{clientId}/with-relations` | OK |
| 상담 | 케이스 수정 | 수정 | `patchCounselingCase` | PATCH `/centers/{centerId}/counseling/cases/{counselingId}` | OK |
| 상담 | 상세 - 회기 수정 | 수정 | `updateCounselingSession` | PATCH `/centers/{centerId}/counseling/sessions/{sessionId}` | OK |
| 상담 | 상세 - 참여자 수정 | 수정 | `updateSessionParticipant` | PATCH `/centers/{centerId}/counseling/session-participants/{sessionParticipantId}` | OK |
| 상담 | 회기 일괄 수정 | 수정 | `patchBulkUpdateSessions` | PATCH `/centers/{centerId}/counseling/sessions/batch-update` | OK |
| 상담 | 회기 추가 모달 | 등록 | `postAddSessionsToCase` | POST `/centers/{centerId}/counseling/cases/{caseId}/add-sessions` | OK |
| 상담 | 케이스 편집 모달 | 수정 | `postApplyCaseEdits` | POST `/centers/{centerId}/counseling/cases/{caseId}/apply-edits` | OK |
| 상담 | 상담 일지 작성 | 등록 | `postCreateSessionNote` | POST `/centers/{centerId}/counseling/sessions/{sessionId}/notes` | OK |
| 상담 | 상담 일지 수정 | 수정 | `patchModifySessionNote` | PATCH `/centers/{centerId}/counseling/notes/{noteId}` | OK |
| 검사 | 검사셋 관리/접수 | 등록 | `createAssessmentSet` | POST `/centers/{centerId}/assessment-sets` | OK |
| 검사 | 검사셋 관리 | 수정 | `updateAssessmentSet` | PATCH `/centers/{centerId}/assessment-sets/{setId}` | OK |
| 검사 | 접수 (개별) | 등록 | `createIndividualAssessmentCase` | POST `/centers/{centerId}/assessment-cases/individual` | OK |
| 검사 | 접수 (일괄) | 등록 | `createBatchAssessmentCase` | POST `/centers/{centerId}/assessment-cases/batch` | OK |
| 검사 | 케이스 / 검사 일정 수정 | 수정 | `updateCase` | PATCH `/centers/{centerId}/assessment-cases/{caseId}` | OK |
| 검사 | 상세 - 소견 | 수정 | `updateTaskOpinion` | PATCH `/centers/{centerId}/tasks/{taskId}/opinion` | OK |
| 일정/운영 | 일정 수정 모달 | 수정 | `patchChangeSchedule` | PATCH `/centers/{centerId}/schedules/{scheduleId}` | OK |
| 일정/운영 | 운영 일정 등록 | 등록 | `postCreateOperationSchedule` | POST `/centers/{centerId}/schedules` | OK |
| 청구/결제 | 청구 관리 | 등록 | `postBillable` | POST `/centers/{centerId}/billables` | OK |
| 청구/결제 | 청구 관리 | 수정 | `patchBillable` | PATCH `/centers/{centerId}/billables/{billableId}` | OK |
| 청구/결제 | 청구 관리 - 결제 등록 | 등록 | `postPayment` | POST `/centers/{centerId}/billables/{billableId}/payments` | OK |
| 청구/결제 | 가격표 관리 | 등록 | `postPriceList` | POST `/centers/{centerId}/price-lists` | OK |
| 청구/결제 | 가격표 관리 | 수정 | `patchPriceList` | PATCH `/centers/{centerId}/price-lists/{priceListId}` | OK |
| 바우처 | 센터 바우처 | 등록 | `postCenterVoucher` | POST `/centers/{centerId}/center-vouchers` | OK |
| 바우처 | 센터 바우처 | 수정 | `patchCenterVoucher` | PATCH `/centers/{centerId}/center-vouchers/{centerVoucherId}` | OK |
| 바우처 | 내담자 바우처 | 등록 | `postClientVoucher` | POST `/centers/{centerId}/client-vouchers` | OK |
| 서식 | 서식 템플릿 | 등록 | `postCreateFormTemplate` | POST `/centers/{centerId}/forms/templates` | OK |
| 서식 | 서식 템플릿 | 수정 | `putUpdateFormTemplate` | PUT `/centers/{centerId}/forms/templates/{templateId}` | OK |
| 서식 | 서식 템플릿 복제 | 등록 | `postCloneFormTemplate` | POST `/centers/{centerId}/forms/templates/{templateId}/clone` | OK |
| 서식 | 서식 응답 저장 | 수정 | `putSaveFormAnswers` | PUT `/centers/{centerId}/forms/instances/{instanceId}/answers` | OK |
| 서식 | 내담자 상세 - 서식 연결 | 등록 | `postLinkFormInstance` | POST `/centers/{centerId}/clients/{clientId}/form-instances` | OK |
| 서식 | 바우처 서식 | 등록 | `postLinkVoucherFormInstance` | POST `/centers/{centerId}/client-vouchers/{clientVoucherId}/form-instances` | OK |
| 필드노트 | 일정 연결 | 수정 | `patchLinkSchedule` | POST `/centers/{centerId}/field-notes/{fieldNoteId}/link-schedule` | OK |
| 필드노트 | 화자 매핑 | 수정 | `patchSpeakerMap` | PATCH `/centers/{centerId}/field-notes/{fieldNoteId}/speaker-map` | OK |
| 메시지 템플릿 | 메시지 템플릿 | 등록 | `postMessageTemplate` | POST `/centers/{centerId}/message-templates` | OK |
| 메시지 템플릿 | 메시지 템플릿 | 수정 | `patchMessageTemplate` | PATCH `/centers/{centerId}/message-templates/{templateId}` | OK |
| 알림 | 설정 > 알림 | 수정 | `putNotificationSetting` | PUT `/centers/{centerId}/notification-settings` | OK |
| 기관 | 기관 등록 | 등록 | `postCreateInstitution` | POST `/institutions/` | OK |
| AI 에이전트 | 새 대화 | 등록 | `createAgentConversation` | POST `/centers/{centerId}/agent/conversations` | OK |
| AI 에이전트 | 세션 사이드바 | 수정 | `patchAgentSession` | PATCH `/centers/{centerId}/agent/conversations/{sessionId}` | OK |
| 고객지원 | 문의 등록 | 등록 | `postSupportInquiry` | POST `/support/inquiry` | OK |

## 삭제 완료 (죽은 코드, 2026-07-21)

화면 호출자 0 + 전용 고아 타입까지 제거:

| 액션 / 파일 | 사유 |
|-------------|------|
| `postCreateParent` + `FamilyRegisterModal.svelte` | 모달 mount 0. `related_client_id` 없이 이름으로 부모 생성 = `/relations` 매핑 불가 |
| `patchBillableStatus` (+ `UpdateBillableStatusPayload`) | 호출부 0 |
| `createCase` (+ `CreateCasePayload`·`CreateCaseRequest`·`CreateCaseResponse`) | 구 command 방식(`/assessment-cases/cmd/create`) — `createIndividualAssessmentCase`(`/individual`)가 대체 |

## 미삭제 죽은 코드 후보 (13건, 확인 대기)

등록/수정 액션이나 화면 호출자 0 — 대부분 신 버전이 대체한 구 버전. 삭제 전 참조 0 재검증 필요:

`createClientProfile`·`updateClientProfile`·`createClientBatch`(Client 버전이 대체) · `patchClientVoucher` · `updateCounseling`(→`patchCounselingCase`) · `postAddSessionParticipants` · `postCreateSession`(→`postAddSessionsToCase`) · `postAddCaseParticipant` · `patchCenterNotePreference` · `postCreateFormInstance` · `registerPaymentMethod` · `createPackage`·`updatePackage`(고아 스토어 `package_local.ts` 전용)

## 제외 기준

- **상태전이** — cancel·complete·submit·approve·refuse·activate/deactivate·read·send·resend, task 상태전이, 세션 cancel/revert, subscription upgrade/downgrade, `postClientTransition`, is_active 토글류, `postCaseAnalysis`·field-note AI 파이프라인(generate/transcribe/refine/run) 등.
- **검증/미리보기** — `postValidateDuplicateClients`·`postDuplicateCheck`·`postValidate*Schedule`·`postPreviewTemplate` 등.
- **인증 흐름(엔티티 CRUD 아님)** — login·logout·verify/changePassword. (`postSignup`은 계정 생성이라 등록으로 포함.)
- **경계 판정** — `createGuardianRelation`·`postLinkFormInstance`·`postLinkVoucherFormInstance` = 관계/링크 생성이라 등록. `postBatchAssignRoleMembers` = 역할 구성원 집합 재조정이라 수정. `patchLinkSchedule` = POST지만 필드노트 필드 갱신이라 수정.
