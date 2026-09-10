/**
 * 문자 양식 상수
 */

/** 현재 활성화된 양식 타입 (UI에 노출되는 것만) */
export const ACTIVE_TEMPLATE_TYPES = [
  'assessment_result_send',
  'assessment_send_link',
  'invoice_issued',
  'form_fill_request'
] as const

export const TEMPLATE_TYPE_OPTIONS = [
  { value: 'assessment_result_send', label: '검사 결과 전송' },
  { value: 'assessment_send_link', label: '바로링크 전송' },
  { value: 'assessment_report_ready', label: '검사 결과 준비 완료' },
  { value: 'counseling_session_booked', label: '상담 예약 확정' },
  { value: 'session_reminder', label: '상담 리마인더' },
  { value: 'appointment_confirmation_sms', label: '예약 확인 SMS' },
  { value: 'invoice_issued', label: '청구서 발행 알림' },
  { value: 'form_fill_request', label: '문서 작성 요청' }
] as const

/** UI에 노출되는 옵션만 필터링 */
export const ACTIVE_TEMPLATE_TYPE_OPTIONS = TEMPLATE_TYPE_OPTIONS.filter((o) =>
  (ACTIVE_TEMPLATE_TYPES as readonly string[]).includes(o.value)
)

export const TEMPLATE_TYPE_LABELS: Record<string, string> = {
  assessment_result_send: '검사 결과 전송',
  assessment_send_link: '바로링크 전송',
  assessment_report_ready: '검사 결과 준비 완료',
  counseling_session_booked: '상담 예약 확정',
  session_reminder: '상담 리마인더',
  appointment_confirmation_sms: '예약 확인 SMS',
  invoice_issued: '청구서 발행 알림',
  form_fill_request: '문서 작성 요청'
}

export const TEMPLATE_VARIABLES: Record<
  string,
  { key: string; label: string }[]
> = {
  assessment_result_send: [
    { key: 'center_name', label: '센터명' },
    { key: 'recipient_name', label: '수신자명' },
    { key: 'reservation_date', label: '예약 날짜' },
    { key: 'result_url', label: '결과 확인 링크' },
    { key: 'verification_code', label: '인증번호' }
  ],
  assessment_send_link: [
    { key: 'center_name', label: '센터명' },
    { key: 'recipient_name', label: '수신자명' },
    { key: 'assessment_url', label: '바로링크' },
    { key: 'verification_code', label: '인증번호' }
  ],
  assessment_report_ready: [
    { key: 'center_name', label: '센터명' },
    { key: 'recipient_name', label: '수신자명' },
    { key: 'assessment_name', label: '검사명' }
  ],
  counseling_session_booked: [
    { key: 'center_name', label: '센터명' },
    { key: 'recipient_name', label: '수신자명' },
    { key: 'counselor_name', label: '상담사명' },
    { key: 'session_date', label: '상담 일시' }
  ],
  session_reminder: [
    { key: 'center_name', label: '센터명' },
    { key: 'recipient_name', label: '수신자명' },
    { key: 'session_date', label: '상담 일시' }
  ],
  appointment_confirmation_sms: [
    { key: 'center_name', label: '센터명' },
    { key: 'recipient_name', label: '수신자명' },
    { key: 'appointment_type', label: '예약 유형' },
    { key: 'appointment_date', label: '예약 일시' }
  ],
  invoice_issued: [
    { key: 'center_name', label: '센터명' },
    { key: 'recipient_name', label: '수신자명' },
    { key: 'item_summary', label: '청구 항목 요약' },
    { key: 'total_amount', label: '청구 금액' },
    { key: 'due_date', label: '납부 기한' }
  ],
  form_fill_request: [
    { key: 'center_name', label: '센터명' },
    { key: 'recipient_name', label: '수신자명' },
    { key: 'form_name', label: '양식명' },
    { key: 'form_url', label: '작성 링크' }
  ]
}

/** key→한글라벨 맵 (타입별) */
export function getVariableLabelMap(
  templateType: string
): Record<string, string> {
  const vars = TEMPLATE_VARIABLES[templateType] ?? []
  return Object.fromEntries(vars.map((v) => [v.key, v.label]))
}

export const MODAL_SIZES = {
  create: { size: 'wide' as const },
  edit: { size: 'wide' as const }
}
