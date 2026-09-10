/** Atom 기반 컬럼 정의 — 각 (module, field)마다 render 스타일 한 개. */

import type { BadgeStyle } from './tool-columns'
import { BADGE_STYLES } from './tool-columns'

export type RenderEnum =
  | 'text'
  | 'text-grey'
  | 'date'
  | 'datetime'
  | 'phone'
  | 'enum_text'
  | 'enum_badge'
  | 'currency'

export interface AtomDef {
  key: string
  label: string
  render: RenderEnum
  enum?: Record<string, string | BadgeStyle>
}

const WEEKDAY_KO: Record<string, string> = {
  MON: '월', TUE: '화', WED: '수', THU: '목', FRI: '금', SAT: '토', SUN: '일',
}

const GENDER_KO: Record<string, string> = {
  male: '남', female: '여', MALE: '남', FEMALE: '여',
}

const BOOL_ACTIVE: Record<string, BadgeStyle> = {
  true: BADGE_STYLES['true'],
  false: BADGE_STYLES['false'],
}

export const ATOM_CATALOG: Record<string, AtomDef> = {
  // Client
  'client.name':       { key: 'client.name', label: '이름', render: 'text' },
  'client.code':       { key: 'client.code', label: '코드', render: 'text-grey' },
  'client.role':       { key: 'client.role', label: '역할', render: 'enum_badge', enum: { client: BADGE_STYLES.client, guardian: BADGE_STYLES.guardian, both: BADGE_STYLES.both } },
  'client.status':     { key: 'client.status', label: '상태', render: 'enum_badge' },
  'client.phone':      { key: 'client.phone', label: '연락처', render: 'phone' },
  'client.email':      { key: 'client.email', label: '이메일', render: 'text' },
  'client.address':    { key: 'client.address', label: '주소', render: 'text' },
  'client.gender':     { key: 'client.gender', label: '성별', render: 'enum_text', enum: GENDER_KO },
  'client.birth_date': { key: 'client.birth_date', label: '생년월일', render: 'date' },
  'client.memo':       { key: 'client.memo', label: '메모', render: 'text' },
  'client.created_at': { key: 'client.created_at', label: '등록일', render: 'date' },

  // Member
  'member.name':            { key: 'member.name', label: '이름', render: 'text' },
  'member.role_code':       { key: 'member.role_code', label: '역할', render: 'enum_badge' },
  'member.status':          { key: 'member.status', label: '상태', render: 'enum_badge' },
  'member.is_active':       { key: 'member.is_active', label: '활성', render: 'enum_badge', enum: BOOL_ACTIVE },
  'member.phone':           { key: 'member.phone', label: '연락처', render: 'phone' },
  'member.email':           { key: 'member.email', label: '이메일', render: 'text' },
  'member.employment_type': { key: 'member.employment_type', label: '고용형태', render: 'enum_badge' },
  'member.hire_date':       { key: 'member.hire_date', label: '입사일', render: 'date' },
  'member.memo':            { key: 'member.memo', label: '메모', render: 'text' },

  // CounselingCase
  'case.case_code':          { key: 'case.case_code', label: '케이스번호', render: 'text' },
  'case.status':             { key: 'case.status', label: '상태', render: 'enum_badge' },
  'case.counselor_name':     { key: 'case.counselor_name', label: '담당자', render: 'text' },
  'case.program_name':       { key: 'case.program_name', label: '프로그램', render: 'text' },
  'case.case_type':          { key: 'case.case_type', label: '유형', render: 'enum_badge' },
  'case.current_session':    { key: 'case.current_session', label: '현재회기', render: 'text' },
  'case.total_sessions':     { key: 'case.total_sessions', label: '총회기', render: 'text' },
  'case.next_session_start': { key: 'case.next_session_start', label: '다음상담', render: 'datetime' },
  'case.chief_complaint':    { key: 'case.chief_complaint', label: '주호소', render: 'text' },
  'case.memo':               { key: 'case.memo', label: '메모', render: 'text' },

  // AssessmentCase
  'assessment_case.case_code':  { key: 'assessment_case.case_code', label: '케이스번호', render: 'text' },
  'assessment_case.status':     { key: 'assessment_case.status', label: '상태', render: 'enum_badge' },
  'assessment_case.tags':       { key: 'assessment_case.tags', label: '태그', render: 'text' },
  'assessment_case.created_at': { key: 'assessment_case.created_at', label: '접수일', render: 'date' },

  // Schedule
  'schedule.title':         { key: 'schedule.title', label: '제목', render: 'text' },
  'schedule.schedule_type': { key: 'schedule.schedule_type', label: '유형', render: 'enum_badge' },
  'schedule.start':         { key: 'schedule.start', label: '시작', render: 'datetime' },
  'schedule.end':           { key: 'schedule.end', label: '종료', render: 'datetime' },
  'schedule.member_name':   { key: 'schedule.member_name', label: '담당자', render: 'text' },
  'schedule.room_name':     { key: 'schedule.room_name', label: '상담실', render: 'text' },
  'schedule.memo':          { key: 'schedule.memo', label: '메모', render: 'text' },

  // Room
  'room.name':        { key: 'room.name', label: '이름', render: 'text' },
  'room.is_active':   { key: 'room.is_active', label: '상태', render: 'enum_badge', enum: BOOL_ACTIVE },
  'room.description': { key: 'room.description', label: '설명', render: 'text' },
  'room.memo':        { key: 'room.memo', label: '메모', render: 'text' },

  // Program
  'program.name':             { key: 'program.name', label: '이름', render: 'text' },
  'program.program_type':     { key: 'program.program_type', label: '유형', render: 'enum_badge' },
  'program.price':            { key: 'program.price', label: '가격', render: 'currency' },
  'program.duration_minutes': { key: 'program.duration_minutes', label: '소요시간', render: 'text' },
  'program.is_active':        { key: 'program.is_active', label: '상태', render: 'enum_badge', enum: BOOL_ACTIVE },
  'program.description':      { key: 'program.description', label: '설명', render: 'text' },

  // Billable
  'billable.client_name':   { key: 'billable.client_name', label: '내담자', render: 'text' },
  'billable.billable_date': { key: 'billable.billable_date', label: '청구일', render: 'date' },
  'billable.total_amount':  { key: 'billable.total_amount', label: '총액', render: 'currency' },
  'billable.paid_amount':   { key: 'billable.paid_amount', label: '납부액', render: 'currency' },
  'billable.unpaid_amount': { key: 'billable.unpaid_amount', label: '미수금', render: 'currency' },
  'billable.status':        { key: 'billable.status', label: '상태', render: 'enum_badge' },
  'billable.issued_at':     { key: 'billable.issued_at', label: '발행일', render: 'date' },
  'billable.due_date':      { key: 'billable.due_date', label: '납부기한', render: 'date' },

  // PriceList
  'price_list.service_name': { key: 'price_list.service_name', label: '서비스명', render: 'text' },
  'price_list.service_type': { key: 'price_list.service_type', label: '유형', render: 'enum_badge' },
  'price_list.unit_price':   { key: 'price_list.unit_price', label: '단가', render: 'currency' },
  'price_list.is_active':    { key: 'price_list.is_active', label: '상태', render: 'enum_badge', enum: BOOL_ACTIVE },
  'price_list.memo':         { key: 'price_list.memo', label: '메모', render: 'text' },

  // Note
  'note.summary':     { key: 'note.summary', label: '요약', render: 'text' },
  'note.content':     { key: 'note.content', label: '내용', render: 'text' },
  'note.author_name': { key: 'note.author_name', label: '작성자', render: 'text' },
  'note.client_name': { key: 'note.client_name', label: '내담자', render: 'text' },
  'note.created_at':  { key: 'note.created_at', label: '작성일', render: 'datetime' },

  // Center
  'center.name':                        { key: 'center.name', label: '센터명', render: 'text' },
  'center.phone':                       { key: 'center.phone', label: '전화', render: 'phone' },
  'center.address':                     { key: 'center.address', label: '주소', render: 'text' },
  'center.representative_name':         { key: 'center.representative_name', label: '대표자', render: 'text' },
  'center.business_registration_number': { key: 'center.business_registration_number', label: '사업자번호', render: 'text' },
  'center.is_active':                   { key: 'center.is_active', label: '상태', render: 'enum_badge', enum: BOOL_ACTIVE },

  // OperatingTime / WorkingTime
  'operating_time.weekday':    { key: 'operating_time.weekday', label: '요일', render: 'enum_text', enum: WEEKDAY_KO },
  'operating_time.open_time':  { key: 'operating_time.open_time', label: '오픈', render: 'text' },
  'operating_time.close_time': { key: 'operating_time.close_time', label: '마감', render: 'text' },
  'working_time.weekday':      { key: 'working_time.weekday', label: '요일', render: 'enum_text', enum: WEEKDAY_KO },
  'working_time.start_time':   { key: 'working_time.start_time', label: '시작', render: 'text' },
  'working_time.end_time':     { key: 'working_time.end_time', label: '종료', render: 'text' },

  // NonOperatingTime / NonWorkingTime
  'non_operating_time.reason':         { key: 'non_operating_time.reason', label: '사유', render: 'text' },
  'non_operating_time.effective_from': { key: 'non_operating_time.effective_from', label: '시작일', render: 'date' },
  'non_operating_time.effective_to':   { key: 'non_operating_time.effective_to', label: '종료일', render: 'date' },
  'non_working_time.reason':           { key: 'non_working_time.reason', label: '사유', render: 'text' },
  'non_working_time.effective_from':   { key: 'non_working_time.effective_from', label: '시작일', render: 'date' },
  'non_working_time.effective_to':     { key: 'non_working_time.effective_to', label: '종료일', render: 'date' },

  // CenterApplication / Institution
  'center_application.name':   { key: 'center_application.name', label: '이름', render: 'text' },
  'center_application.status': { key: 'center_application.status', label: '상태', render: 'enum_badge' },
  'center_application.phone':  { key: 'center_application.phone', label: '연락처', render: 'phone' },
  'institution.name':    { key: 'institution.name', label: '이름', render: 'text' },
  'institution.phone':   { key: 'institution.phone', label: '연락처', render: 'phone' },
  'institution.address': { key: 'institution.address', label: '주소', render: 'text' },

  // FieldNote / Document
  'field_note.summary':           { key: 'field_note.summary', label: '요약', render: 'text' },
  'field_note.status':            { key: 'field_note.status', label: '상태', render: 'enum_badge' },
  'field_note.total_duration':    { key: 'field_note.total_duration', label: '길이', render: 'text' },
  'field_note.processing_status': { key: 'field_note.processing_status', label: '처리상태', render: 'enum_badge' },
  'document.name':         { key: 'document.name', label: '이름', render: 'text' },
  'document.file_type':    { key: 'document.file_type', label: '파일유형', render: 'text' },
  'document.access_level': { key: 'document.access_level', label: '접근레벨', render: 'text' },
  'document.description':  { key: 'document.description', label: '설명', render: 'text' },

  // Form
  'form_template.name':       { key: 'form_template.name', label: '양식명', render: 'text' },
  'form_template.version':    { key: 'form_template.version', label: '버전', render: 'text' },
  'form_template.is_active':  { key: 'form_template.is_active', label: '상태', render: 'enum_badge', enum: BOOL_ACTIVE },
  'form_instance.template_name': { key: 'form_instance.template_name', label: '양식', render: 'text' },
  'form_instance.status':        { key: 'form_instance.status', label: '상태', render: 'enum_badge' },
  'form_instance.submitted_at':  { key: 'form_instance.submitted_at', label: '제출일', render: 'datetime' },

  // Notification / Notice
  'notification.title':      { key: 'notification.title', label: '제목', render: 'text' },
  'notification.category':   { key: 'notification.category', label: '카테고리', render: 'enum_badge' },
  'notification.priority':   { key: 'notification.priority', label: '우선순위', render: 'enum_badge' },
  'notification.is_read':    { key: 'notification.is_read', label: '읽음', render: 'enum_badge', enum: { true: { label: '읽음', bg: 'bg-gray-100', text: 'text-gray-500' }, false: { label: '미읽음', bg: 'bg-blue-50', text: 'text-blue-600' } } },
  'notification.created_at': { key: 'notification.created_at', label: '날짜', render: 'datetime' },
  'notice.title':        { key: 'notice.title', label: '제목', render: 'text' },
  'notice.category':     { key: 'notice.category', label: '유형', render: 'enum_badge' },
  'notice.is_pinned':    { key: 'notice.is_pinned', label: '고정', render: 'enum_badge', enum: { true: { label: '고정', bg: 'bg-blue-50', text: 'text-blue-600' }, false: { label: '-', bg: 'bg-gray-100', text: 'text-gray-400' } } },
  'notice.published_at': { key: 'notice.published_at', label: '등록일', render: 'datetime' },

  // ActivityLog
  'activity_log.category':   { key: 'activity_log.category', label: '카테고리', render: 'enum_badge' },
  'activity_log.action':     { key: 'activity_log.action', label: '액션', render: 'text' },
  'activity_log.actor_name': { key: 'activity_log.actor_name', label: '수행자', render: 'text' },
  'activity_log.summary':    { key: 'activity_log.summary', label: '요약', render: 'text' },
  'activity_log.created_at': { key: 'activity_log.created_at', label: '날짜', render: 'datetime' },

  // Invitation
  'invitation.name':       { key: 'invitation.name', label: '이름', render: 'text' },
  'invitation.email':      { key: 'invitation.email', label: '이메일', render: 'text' },
  'invitation.status':     { key: 'invitation.status', label: '상태', render: 'enum_badge' },
  'invitation.expires_at': { key: 'invitation.expires_at', label: '만료일', render: 'datetime' },

  // CounselingSession
  'session.session_number': { key: 'session.session_number', label: '회기번호', render: 'text' },
  'session.status':         { key: 'session.status', label: '상태', render: 'enum_badge' },
  'session.cancel_reason':  { key: 'session.cancel_reason', label: '취소사유', render: 'text' },

  // AssessmentSession
  'assessment_session.session_number': { key: 'assessment_session.session_number', label: '회기번호', render: 'text' },
  'assessment_session.status':         { key: 'assessment_session.status', label: '상태', render: 'enum_badge' },

  // AssessmentSet
  'assessment_set.name':        { key: 'assessment_set.name', label: '이름', render: 'text' },
  'assessment_set.description': { key: 'assessment_set.description', label: '설명', render: 'text' },

  // Assessment (catalog)
  'assessment.name':            { key: 'assessment.name', label: '검사명', render: 'text' },
  'assessment.assessment_type': { key: 'assessment.assessment_type', label: '유형', render: 'text' },
  'assessment.workflow_type':   { key: 'assessment.workflow_type', label: '워크플로우', render: 'text' },
  'assessment.code':            { key: 'assessment.code', label: '코드', render: 'text-grey' },

  // Participant
  'participant.participant_name': { key: 'participant.participant_name', label: '이름', render: 'text' },
  'participant.participant_type': { key: 'participant.participant_type', label: '역할', render: 'enum_badge' },
  'participant.is_active':        { key: 'participant.is_active', label: '활성', render: 'enum_badge', enum: BOOL_ACTIVE },
  'assessment_participant.participant_name': { key: 'assessment_participant.participant_name', label: '이름', render: 'text' },
  'assessment_participant.participant_type': { key: 'assessment_participant.participant_type', label: '유형', render: 'text' },

  // ProgramMember
  'program_member.member_name': { key: 'program_member.member_name', label: '상담사', render: 'text' },
  'program_member.role_code':   { key: 'program_member.role_code', label: '역할', render: 'enum_badge' },
}

// ── Tool → Atom 배열 매핑 ──

// 키 = assistant 도구명(서버 catalog specs_for 정본, 32-스코프 query 24종) — 구 스택명 이관 완료(2026-07-26)
export const TOOL_ATOM_COLUMNS: Record<string, string[]> = {
  'query_client_handler': ['client.name', 'client.code', 'client.birth_date', 'client.gender', 'client.phone', 'client.memo', 'client.status', 'client.created_at'],
  'query_member_handler': ['member.name', 'member.role_code', 'member.phone', 'member.email', 'member.memo', 'member.is_active'],
  'query_room_handler': ['room.name', 'room.is_active', 'room.description', 'room.memo'],
  'query_program_handler': ['program.name', 'program.program_type', 'program.price', 'program.duration_minutes', 'program.is_active', 'program.description'],

  'query_case_handler': ['case.case_code', 'case.counselor_name', 'case.program_name', 'case.status', 'case.total_sessions'],
  'query_counseling_session_handler': ['session.session_number', 'session.status', 'session.cancel_reason'],
  'query_counseling_note_handler': ['note.summary', 'note.author_name', 'note.client_name', 'note.created_at'],
  'query_counseling_participant_handler': ['participant.participant_name', 'participant.participant_type', 'participant.is_active'],

  'query_assessment_handler': ['assessment.name', 'assessment.assessment_type', 'assessment.workflow_type', 'assessment.code'],
  'query_assessment_case_handler': ['assessment_case.case_code', 'assessment_case.status', 'assessment_case.tags', 'assessment_case.created_at'],
  'query_assessment_session_handler': ['assessment_session.session_number', 'assessment_session.status'],
  'query_assessment_participant_handler': ['assessment_participant.participant_name', 'assessment_participant.participant_type'],

  'query_schedule_handler': ['schedule.title', 'schedule.schedule_type', 'schedule.start', 'schedule.end', 'schedule.member_name', 'schedule.room_name', 'schedule.memo'],
  'query_member_invitation_handler': ['invitation.name', 'invitation.email', 'invitation.status'],

  'query_form_template_handler': ['form_template.name', 'form_template.version', 'form_template.is_active'],
  'query_form_instance_handler': ['form_instance.template_name', 'form_instance.status', 'form_instance.submitted_at'],
  'query_field_note_handler': ['field_note.summary', 'field_note.status', 'field_note.processing_status'],
  'query_document_handler': ['document.name', 'document.file_type', 'document.access_level', 'document.description'],

  'query_notification_handler': ['notification.title', 'notification.category', 'notification.priority', 'notification.is_read', 'notification.created_at'],
  'query_notice_handler': ['notice.title', 'notice.category', 'notice.is_pinned', 'notice.published_at'],
  'query_activity_handler': ['activity_log.summary', 'activity_log.category', 'activity_log.action', 'activity_log.actor_name', 'activity_log.created_at'],
  'query_institution_handler': ['institution.name', 'institution.phone', 'institution.address'],

  'query_billable_handler': ['billable.client_name', 'billable.total_amount', 'billable.paid_amount', 'billable.unpaid_amount', 'billable.status', 'billable.billable_date'],
  'query_price_list_handler': ['price_list.service_name', 'price_list.service_type', 'price_list.unit_price', 'price_list.is_active'],
}
