/** 검사 워크플로우 타입 (task.assessment.workflow_type) */
export type WorkflowType = 'self_report' | 'external_service' | string

export interface AssessmentItem {
  id: string
  assessmentId: string
  name: string
  nameEn?: string
  status: 'pending' | 'in_progress' | 'submitted' | 'completed' | 'refused' | 'cancelled'
  isOnline: boolean
  needsUpload: boolean
  date: string
  refusedReason?: string
  cancelledReason?: string
  reportPayload?: Record<string, unknown> | null
  /** 보고서 PDF 문서 ID (다운로드 URL 요청 시 사용) */
  reportDocumentId?: string | null
  /** 채점 확인 테이블용: task.process.responses */
  processResponses?: { question_number: number; answer_value: number }[] | null
  /** 채점 확인 테이블용: task.assessment.definition.questions (문항 텍스트) */
  questionDefinitions?: { number: number; text: string }[] | null
  /** 검사 코드 (예: SMARTPHONE_ADDICTION). self_report + 스마트폰중독검사 분기용 */
  assessmentCode?: string
  /** self_report: 자가응답형(3단계 UI) / external_service: 외부서비스형 등 */
  workflowType?: WorkflowType
  /** Task ID (검사별 소견 수정 등에 사용) */
  taskId?: string
  /** 검사자 소견 (마지막 스텝에서 작성) */
  opinion?: string | null
  /** 선택된 검사 세트에 속한 검사인지 여부 (false/undefined = 추가 검사) */
  belongsToSet?: boolean
}

/** 카드 그리드 렌더용 검사 비주얼 (assessmentId 기준 조회) */
export interface AssessmentVisual {
  /** 영문명 (center-assessments 카탈로그) */
  engName: string
  /** 한글명 */
  korName: string
  /** 검사 분류 (projective | intelligence | objective | developmental | …) */
  category: string
  /** 카테고리 색상 (카드 헤더 배경) */
  color: string
}

export interface SendHistoryItem {
  id: string
  sentAtLabel: string
  relationLabel: string
  recipientName: string
  phone: string
}

/** 담당자(상담사) 상세 정보 (모달 표시용) */
export interface SpecialistDetailVM {
  id: string
  name: string
  birthDate: string
  email: string
  phone: string
  employmentTypeLabel: string
  hireDate: string
  memo: string
}

/** 내담자 상세 정보 (모달 표시용) */
export interface ClientDetailVM {
  name: string
  birthDate: string
  genderLabel: string
  ageLabel: string
  email: string
  phone: string
  address: string
  memo: string
}

/** 검사 일정 정보 (schedule이 있을 때만 존재) */
export interface ScheduleVM {
  /** 예: "2025-02-12 (수) 13:00 - 14:00" */
  dateTimeLabel: string
  /** 장소 이름 (room_id → name 매핑, 없으면 null) */
  roomName: string | null
  /** 일정 취소 여부 (캘린더에서 삭제된 경우) */
  isCancelled: boolean
  /** 취소 사유 (취소된 경우에만 의미 있음) */
  cancelReason: string | null
  /** 검사 세션 ID (취소 되돌리기 호출에 사용) */
  sessionId: string | null
  /** 캘린더 schedule.id (필드노트 by-schedule 조회에 사용) */
  scheduleId: string | null
}

export interface CaseDetailVM {
  /** 내담자 ID (상세 페이지 이동용) */
  clientId: string
  /** 내담자 프로필 이미지 URL (없으면 null → 기본 아이콘 폴백). 시크릿 모드에선 null */
  profileImageUrl: string | null
  maskedName: string
  maskedBirthDate: string
  maskedContact: string
  genderLabel: string
  genderColor: string
  genderSymbol: string
  ageLabel: string
  clientDetail: ClientDetailVM
  specialistName: string
  /** 담당자(멤버) ID (상세 페이지 이동용) */
  specialistId: string
  specialistDetail: SpecialistDetailVM
  caseTypeLabel: string
  caseCode?: string
  clientCode?: string
  createdAtLabel: string
  completedAtLabel: string
  /** 검사 세트명 (없으면 빈 문자열) */
  assessmentSetName: string
  assessmentNames: string
  assessmentItemNames: string
  statusLabel: string
  caseStatus: string
  hasOnlineAssessment: boolean
  requireFinalReport: boolean
  sendHistories: SendHistoryItem[]
  /** 검사 일정 (없으면 null) */
  schedule: ScheduleVM | null
  /** 기관명 (없으면 빈 문자열) */
  institutionName: string
}

