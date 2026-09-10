/**
 * 알림 목록 쿼리 입력 빌더
 */

import {
  toApiQueryInput,
  type NotificationListFilters,
  type NotificationListQueryInput
} from './filters'

/** queryBuilder용 입력 생성 */
export function buildNotificationListInput(
  filters: NotificationListFilters,
  centerId: string
): NotificationListQueryInput {
  return toApiQueryInput(filters, centerId)
}
