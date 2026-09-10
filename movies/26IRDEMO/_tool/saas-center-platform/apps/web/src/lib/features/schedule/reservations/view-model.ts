import type { ScheduleChangeRequestItem } from '$lib/hooks/actions/schedule.action'

import { RESERVATION_TAB_LABELS, type ReservationTab } from './constants'
import { normalizeSearchQuery, type ReservationFilters } from './filters'

export interface Reservation {
  reservationId: string
  manager: string
  client: string
  /** 내담자 표시 최소 단위(아바타 + 이름 + 생년월일|성별) — 화면 공통 규격 */
  clientBirthDate: string | null
  clientGender: string | null
  clientProfileImageUrl: string | null
  reservationType: string
  subject: string
  session: number
  originDate: Date
  changedDate: Date | null
  status: ReservationTab
}

export interface ReservationVM extends Reservation {
  statusLabel: string
  reason: string | null
  decisionNote: string | null
}

const STATUS_BY_REQUEST: Record<string, ReservationTab> = {
  pending: 'pending',
  approved: 'confirmed',
  rejected: 'cancelled'
}

// 서버 시각은 UTC naive(오프셋 없음) — Date 파싱이 로컬로 새지 않게 Z를 붙인다
function parseUtc(value: string): Date {
  return new Date(/[Z+]/.test(value) ? value : `${value}Z`)
}

export function mapChangeRequestsToVM(
  items: ScheduleChangeRequestItem[]
): ReservationVM[] {
  return items.map((item) => {
    const status = STATUS_BY_REQUEST[item.status] ?? 'pending'
    return {
      reservationId: item.id,
      manager: item.counselor_name ?? '-',
      client: item.client_name ?? '-',
      clientBirthDate: item.client_birth_date ?? null,
      clientGender: item.client_gender ?? null,
      clientProfileImageUrl: item.client_profile_image_url ?? null,
      reservationType: '예약 변경',
      subject: item.title ?? '상담',
      session: 0,
      originDate: parseUtc(item.current_start),
      changedDate: parseUtc(item.requested_start),
      status,
      statusLabel: RESERVATION_TAB_LABELS[status],
      reason: item.reason,
      decisionNote: item.decision_note
    }
  })
}

export function filterReservations(
  reservations: ReservationVM[],
  filters: ReservationFilters
) {
  const query = normalizeSearchQuery(filters.search)

  return reservations.filter((reservation) => {
    const matchesTab = reservation.status === filters.activeTab

    if (!query) return matchesTab

    const haystack = [
      reservation.manager,
      reservation.client,
      reservation.reservationType,
      reservation.subject
    ]
      .map((item) => item.toLowerCase())
      .join(' ')

    const matchesSearch = haystack.includes(query)

    return matchesTab && matchesSearch
  })
}
