/**
 * 알림 관련 상수
 */

/** 알림 카테고리 라벨 */
export const CATEGORY_LABELS: Record<string, string> = {
  assessment: '검사',
  counseling: '상담',
  system: '소식'
} as const

/**
 * 카테고리 배지 색 — `BadgeRectangle`의 tag 색 이름(§Colors > Tag).
 *
 * 하드코딩 클래스(`bg-blue-50 text-blue-600`) 금지 — 배지 규격은 컴포넌트가 소유한다.
 * Tag 10색은 fg가 CIELAB 지각 명도로 균일화돼 있어 초록·파랑이 같은 무게로 읽힌다.
 * (공지 `features/notice/constants.ts`와 동일 형태 — 2026-09-07 통일.)
 */
export type NotificationBadgeColor = 'blue' | 'green' | 'gray'

export const CATEGORY_COLORS: Record<string, NotificationBadgeColor> = {
  assessment: 'blue',
  counseling: 'green',
  system: 'gray'
} as const

export const DEFAULT_CATEGORY_COLOR: NotificationBadgeColor = 'gray'

/** 알림 이벤트 타입 라벨 */
export const EVENT_TYPE_LABELS: Record<string, string> = {
  case_created: '접수',
  case_cancelled: '취소',
  case_completed: '완료',
  case_updated: '수정',
  case_rescheduled: '일정 변경',
  schedule_changed: '일정 변경',
  schedule_cancelled: '일정 취소',
  schedule_change_requested: '일정 변경 요청',
  schedule_change_rejected: '변경 요청 반려',
  case_deleted: '삭제',
  case_restored: '복원',
  session_created: '회기 추가',
  session_completed: '회기 완료',
  session_cancelled: '회기 취소',
  session_reverted: '회기 복구',
  session_no_show: '회기 노쇼',
  session_deleted: '회기 삭제',
  schedule_reminder: '일정 리마인드',
  assessment_assigned: '검사 배정',
  assessment_unassigned: '검사 배정 해제',
  task_submitted: '검사 제출',
  task_refused: '검사 거부',
  notice_published: '새 공지사항',
  notice_remind: '공지 리마인드',
  center_warned: '센터 경고',
  inquiry_answered: '문의 답변',
  credential_verified: '자격 인증 완료',
  credential_rejected: '자격 인증 반려'
} as const

/**
 * 공지사항 알림 이벤트 — 목록 상단 고정 블록의 소속 판정 기준.
 * 카테고리 `system`에는 문의 답변·자격 인증도 섞여 있어 카테고리만으로는 가를 수 없다.
 */
export const NOTICE_EVENT_TYPES = ['notice_published', 'notice_remind'] as const

export function isNoticeEventType(eventType: string): boolean {
  return (NOTICE_EVENT_TYPES as readonly string[]).includes(eventType)
}

/** 이벤트 그룹 타입 (알림 설정 UI용) */
export interface EventGroup {
  /** 그룹 식별 키 (저장에는 사용 안 함, UI용) */
  key: string
  /** 사용자에게 보여줄 라벨 */
  label: string
  /** 라벨 아래 설명 */
  description: string
  /** 이 그룹에 속하는 실제 event_type 목록 */
  eventTypes: string[]
}

/**
 * 카테고리별 이벤트 그룹 (알림 설정 UI용)
 *
 * 축은 "무엇이 일어났나"다 — 일정 / 접수·수정 / 내담자 응답 / 취소·노쇼.
 * **역할로 가르지 않는다**: 관리자도 담당 상담사일 수 있어(작은 센터의 겸직) 같은
 * 항목을 실제로 받는다. 관리자가 안 받는 항목(자기가 한 일정 수정 등)은 서버가
 * 수신자 단계에서 이미 빼므로 여기서 숨기면 이중 차단이 된다.
 *
 * 일정 리마인드(schedule_reminder)는 목록에 쌓지 않는다 — 하루 지나면 무의미해지는
 * 고지라 대시보드가 "내일 N건"으로 보여주고, 알림은 푸시/알림톡으로만 나간다.
 */
export const EVENT_GROUPS: Record<string, EventGroup[]> = {
  assessment: [
    {
      key: 'assess_schedule',
      label: '일정 변경',
      description: '검사 일정 추가, 변경, 삭제',
      eventTypes: ['schedule_changed', 'schedule_cancelled', 'case_rescheduled']
    },
    {
      key: 'assess_case',
      label: '접수 · 정보 수정',
      description: '검사 접수, 정보 수정, 복원, 담당 배정',
      eventTypes: [
        'case_created',
        'case_updated',
        'case_restored',
        'session_reverted',
        'assessment_assigned',
        'assessment_unassigned'
      ]
    },
    {
      key: 'assess_response',
      label: '내담자 검사 응답',
      description: '내담자의 검사 제출, 거부, 검사 완료',
      eventTypes: ['task_submitted', 'task_refused', 'case_completed']
    },
    {
      key: 'assess_cancel',
      label: '취소 · 노쇼',
      description: '검사 취소, 삭제, 회기 취소, 노쇼',
      eventTypes: [
        'case_cancelled',
        'case_deleted',
        'session_cancelled',
        'session_no_show'
      ]
    }
  ],
  counseling: [
    {
      key: 'counsel_schedule',
      label: '일정 변경',
      description: '상담 일정 추가, 변경, 삭제',
      eventTypes: [
        'schedule_changed',
        'schedule_cancelled',
        'case_rescheduled',
        'session_created',
        'session_deleted'
      ]
    },
    {
      key: 'counsel_case',
      label: '접수 · 정보 수정',
      description: '상담 접수, 케이스 정보 수정, 회기 완료·복구',
      eventTypes: [
        'case_created',
        'case_updated',
        'session_completed',
        'session_reverted'
      ]
    },
    {
      key: 'counsel_change_request',
      label: '일정 변경 요청',
      description: '내담자가 보낸 일정 변경 요청과 그 결과',
      eventTypes: ['schedule_change_requested', 'schedule_change_rejected']
    },
    {
      key: 'counsel_cancel',
      label: '취소 · 노쇼',
      description: '상담 삭제, 회기 취소, 노쇼',
      eventTypes: ['case_deleted', 'session_cancelled', 'session_no_show']
    }
  ],
  system: []
}

/**
 * 알림 설정 카테고리 옵션.
 * 아이콘은 여기서 이름으로 들고 있지 않는다 — 설정 화면이 `value`로 앱 아이콘 에셋에 사상한다.
 * 설명 문구도 두지 않는다 — 세부 항목이 아코디언에 그대로 나와 중복이다(2026-09-08).
 */
export const SETTING_CATEGORY_OPTIONS = [
  { value: 'assessment', label: '검사' },
  { value: 'counseling', label: '상담' },
  { value: 'system', label: '소식' }
] as const

/** 드롭다운 페이지 크기 */
export const DROPDOWN_PAGE_SIZE = 10

/** 폴링 간격 (ms) — SSE 미연결 시 fallback 폴링 */
export const UNREAD_POLL_INTERVAL = 30_000

/** SSE 재연결 초기 딜레이 (ms) */
export const SSE_RECONNECT_INITIAL_DELAY = 1_000

/** SSE 재연결 최대 딜레이 (ms) — exponential backoff 상한 */
export const SSE_RECONNECT_MAX_DELAY = 30_000
