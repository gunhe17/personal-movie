/**
 * 알림 ViewModel
 * API → UI 표현 변환기
 */

import type { NotificationType } from '$lib/hooks/actions/notification.action'
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  DEFAULT_CATEGORY_COLOR,
  type NotificationBadgeColor,
  EVENT_TYPE_LABELS,
  isNoticeEventType
} from './constants'

export interface NotificationVM {
  id: string
  category: string
  categoryLabel: string
  categoryColor: NotificationBadgeColor
  eventType: string
  eventTypeLabel: string
  title: string
  body: string
  isRead: boolean
  timeAgo: string
  createdAt: Date
  data: Record<string, any> | null
  /** 알림 클릭 시 이동할 경로 (없으면 null) */
  navigateTo: string | null
  /** 공지사항 알림 여부 — 목록 상단 고정 블록의 소속 판정 */
  isNotice: boolean
}

/**
 * 서버에서 오는 naive UTC datetime 문자열을 Date로 파싱
 * 백엔드가 timezone-naive UTC를 저장하므로 'Z' suffix가 없을 수 있음
 */
function parseUTCDate(dateStr: string): Date {
  // 이미 Z나 +로 끝나면 그대로, 아니면 Z를 붙여서 UTC로 명시
  if (
    dateStr.endsWith('Z') ||
    dateStr.includes('+') ||
    dateStr.includes('-', 10)
  ) {
    return new Date(dateStr)
  }
  return new Date(dateStr + 'Z')
}

/**
 * 상대 시간 문자열 생성 (예: "3분 전", "2시간 전", "어제")
 */
function formatTimeAgo(dateStr: string): string {
  const date = parseUTCDate(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHour = Math.floor(diffMs / 3_600_000)
  const diffDay = Math.floor(diffMs / 86_400_000)

  if (diffMin < 1) return '방금'
  if (diffMin < 60) return `${diffMin}분 전`
  if (diffHour < 24) return `${diffHour}시간 전`
  if (diffDay < 7) return `${diffDay}일 전`

  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${month}월 ${day}일`
}

/**
 * 알림 데이터에서 이동 경로 생성
 */
export function resolveNavigateTo(
  category: string,
  eventType: string,
  data: Record<string, any> | null
): string | null {
  if (!data) return null

  const caseId = data.case_id

  // 변경 요청은 케이스가 아니라 처리 화면(예약 현황)으로 보낸다
  if (
    eventType === 'schedule_change_requested' ||
    eventType === 'schedule_change_rejected'
  ) {
    return '/schedule/reservations'
  }

  // 관리자가 내 일정을 옮기거나 지운 알림 — 케이스가 아니라 일정 자체가 대상이라
  // case_id가 없다. 캘린더로 보내 바뀐 자리를 그대로 보게 한다.
  if (
    (eventType === 'schedule_changed' || eventType === 'schedule_cancelled') &&
    data.schedule_id
  ) {
    return '/schedule'
  }

  if (category === 'assessment' && caseId) {
    // 삭제/취소된 케이스는 목록으로 이동
    if (eventType === 'case_cancelled') {
      return '/assessment/status'
    }
    return `/assessment/status/${caseId}`
  }

  if (category === 'counseling' && caseId) {
    if (eventType === 'case_deleted') {
      return '/counseling/status'
    }
    // 세션 관련 이벤트: 세션 쿼리 파라미터 추가
    if (
      data.session_id &&
      (eventType === 'session_created' || eventType === 'session_completed')
    ) {
      return `/counseling/status/${caseId}?session=${data.session_id}`
    }
    return `/counseling/status/${caseId}`
  }

  if (
    category === 'system' &&
    (eventType === 'notice_published' || eventType === 'notice_remind')
  ) {
    const noticeId = data.notice_id
    return noticeId ? `/notice/${noticeId}` : '/notice'
  }

  if (category === 'system' && eventType === 'inquiry_answered') {
    return '/support'
  }

  // 자격 인증 알림 (승인/반려) → 내 정보 페이지로
  if (
    category === 'system' &&
    (eventType === 'credential_verified' || eventType === 'credential_rejected')
  ) {
    return '/myInfo'
  }

  return null
}

/**
 * API 알림 → ViewModel 변환
 */
export function mapToNotificationVM(item: NotificationType): NotificationVM {
  return {
    id: item.id,
    category: item.category,
    categoryLabel: CATEGORY_LABELS[item.category] ?? item.category,
    categoryColor: CATEGORY_COLORS[item.category] ?? DEFAULT_CATEGORY_COLOR,
    eventType: item.event_type,
    eventTypeLabel: EVENT_TYPE_LABELS[item.event_type] ?? item.event_type,
    title: item.title,
    body: item.body,
    isRead: item.is_read,
    timeAgo: formatTimeAgo(item.created_at),
    createdAt: parseUTCDate(item.created_at),
    data: item.data,
    navigateTo: resolveNavigateTo(item.category, item.event_type, item.data),
    isNotice: isNoticeEventType(item.event_type)
  }
}
