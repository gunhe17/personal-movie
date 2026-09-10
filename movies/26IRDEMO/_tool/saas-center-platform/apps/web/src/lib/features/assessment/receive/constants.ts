/**
 * Assessment Receive Constants
 * 검사 접수 페이지에서 사용하는 상수 및 타입 정의
 */

// 클라이언트 타입
export type ClientType = 'individual' | 'group'

// 시간 옵션
export const MORNING_TIMES = [
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30'
] as const

export const AFTERNOON_TIMES = [
  '13:00',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
  '17:30',
  '18:00',
  '18:30',
  '19:00',
  '19:30'
] as const

// 종합 보고서 상태
export type ReportStatus = '미작성' | '작성'

// 모달 사이즈
export const MODAL_SIZES = {
  excelUpload: { customWidth: 1000, customHeight: 530 },
  packageSetting: { customWidth: 640, customHeight: 650, desktopOnly: true },
  roomRegister: { customWidth: 540 },
  clientRegister: { customWidth: 640 }
} as const

// 기본 검사 시간 (시간 단위)
export const DEFAULT_ASSESSMENT_DURATION_HOURS = 2
