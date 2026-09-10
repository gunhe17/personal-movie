/**
 * Assessment Receive Query Builders
 * 검사 접수 관련 쿼리 입력 빌더
 */

import type {
  CreateBatchAssessmentRequest,
  CreateIndividualAssessmentRequest
} from '$lib/hooks/actions/case.action'
import type { InstitutionCreatePayload } from '$lib/hooks/actions/institution.action'
import type { ExtendedClient, GroupMember } from '$lib/stores/receiveForm'
import type { Organization } from '$lib/types/organization'
import type { MemberListItem as MemberItem } from '$lib/hooks/actions/member.action'
import type { RoomItemType } from '$lib/hooks/actions/room.action'
import { DEFAULT_ASSESSMENT_DURATION_HOURS } from './constants'
import type { ClientRole, ClientStatus } from '$lib/hooks/actions/client.action'

// 검사 목록 조회 입력 (활성 검사만 조회)
export function buildAssessmentsQueryInput() {
  return { is_active: true }
}

// 패키지 목록 조회 입력
export function buildPackagesQueryInput(centerId: string) {
  return { centerId, page: 1, size: 100 }
}

// 담당자 목록 조회 입력
export function buildMembersQueryInput(centerId: string) {
  return { centerId }
}

// 상담실 목록 조회 입력
export function buildRoomsQueryInput(centerId: string) {
  return { center_id: centerId, active_only: true }
}

export interface CreateClientInput {
  role?: ClientRole
  name: string
  birthDate?: string
  gender?: 'male' | 'female' | ''
  phone?: string
  address?: string
  memo?: string
  status?: ClientStatus
  personId?: string
}

export function buildCreateClientRequest(centerId: string, input: CreateClientInput) {
  return {
    centerId,
    payload: {
      role: input.role ?? 'client',
      name: input.name,
      birth_date: input.birthDate || undefined,
      gender: input.gender || undefined,
      phone: input.phone || undefined,
      address: input.address || undefined,
      memo: input.memo || '',
      status: input.status,
      person_id: input.personId
    }
  }
}

export function buildCreateInstitutionPayload(input: {
  name: string
  phone?: string
  address?: string
}): InstitutionCreatePayload {
  return {
    name: input.name,
    phone: input.phone || undefined,
    address: input.address ? { address: input.address } : undefined
  }
}

// 스케줄 생성 요청 빌더 (공통). 일정 없으면 selectedDate/selectedTime null
interface BuildScheduleRequestParams {
  centerId: string
  selectedDate: Date | null
  selectedTime: string | null
  selectedEndTime?: string | null
  selectedMember: MemberItem[]
  selectedRoom: RoomItemType | null
  clientMemo: string
  assessmentIds: string[]
  comprehensiveReport: '미작성' | '작성'
  selectedPackageIds: string[]
}

// 개인 접수 스케줄 요청 빌더
interface BuildIndividualScheduleParams extends BuildScheduleRequestParams {
  selectedClient: ExtendedClient
}

export function buildIndividualScheduleRequest(
  params: BuildIndividualScheduleParams
): CreateIndividualAssessmentRequest {
  const {
    centerId,
    selectedClient,
    selectedDate,
    selectedTime,
    selectedEndTime,
    selectedMember,
    selectedRoom,
    clientMemo,
    assessmentIds,
    comprehensiveReport,
    selectedPackageIds
  } = params

  const primaryCounselor = selectedMember[0]
  const assistantIds = selectedMember.slice(1).map((m) => m.id)
  const hasSchedule =
    selectedDate != null && selectedTime != null
  const scheduleFields =
    hasSchedule && selectedDate && selectedTime
      ? (() => {
          const { startAt, endAt } = calculateScheduleTimes(
            selectedDate,
            selectedTime,
            selectedEndTime
          )
          return {
            has_schedule: true as const,
            scheduled_start: startAt.toISOString(),
            scheduled_end: endAt.toISOString()
          }
        })()
      : { has_schedule: false as const }

  return {
    centerId,
    payload: {
      client_id: selectedClient.uid,
      assessment_ids: assessmentIds,
      is_final_report_required: comprehensiveReport === '작성',
      ...scheduleFields,
      counselor_id: primaryCounselor?.id || '',
      assistant_ids: assistantIds.length > 0 ? assistantIds : undefined,
      room_id: selectedRoom?.id || undefined,
      memo: clientMemo || undefined,
      set_id: selectedPackageIds.length === 1 ? selectedPackageIds[0] : undefined
    }
  }
}

// 단체 접수 스케줄 요청 빌더
interface BuildGroupScheduleParams extends BuildScheduleRequestParams {
  groupMembers: GroupMember[]
  selectedOrganization: Organization | null
}

export function buildGroupScheduleRequest(
  params: BuildGroupScheduleParams
): CreateBatchAssessmentRequest {
  const {
    centerId,
    groupMembers,
    selectedOrganization,
    selectedDate,
    selectedTime,
    selectedEndTime,
    selectedMember,
    selectedRoom,
    clientMemo,
    assessmentIds,
    comprehensiveReport,
    selectedPackageIds
  } = params

  const primaryCounselor = selectedMember[0]
  const assistantIds = selectedMember.slice(1).map((m) => m.id)
  const hasSchedule =
    selectedDate != null && selectedTime != null
  const scheduleFields =
    hasSchedule && selectedDate && selectedTime
      ? (() => {
          const { startAt, endAt } = calculateScheduleTimes(
            selectedDate,
            selectedTime,
            selectedEndTime
          )
          return {
            has_schedule: true as const,
            scheduled_start: startAt.toISOString(),
            scheduled_end: endAt.toISOString()
          }
        })()
      : { has_schedule: false as const }

  return {
    centerId,
    payload: {
      client_ids: groupMembers.map((m) => m.id),
      institution_id: selectedOrganization?.id || undefined,
      assessment_ids: assessmentIds,
      is_final_report_required: comprehensiveReport === '작성',
      ...scheduleFields,
      counselor_id: primaryCounselor?.id || '',
      assistant_ids: assistantIds.length > 0 ? assistantIds : undefined,
      room_id: selectedRoom?.id || undefined,
      memo: clientMemo || undefined,
      set_id: selectedPackageIds.length === 1 ? selectedPackageIds[0] : undefined
    }
  }
}

// 스케줄 시간 계산 헬퍼
function calculateScheduleTimes(
  selectedDate: Date,
  selectedTime: string,
  selectedEndTime?: string | null
): { startAt: Date; endAt: Date } {
  const [hours, minutes] = selectedTime.split(':').map(Number)
  const startAt = new Date(selectedDate)
  startAt.setHours(hours, minutes, 0, 0)

  let endAt: Date
  if (selectedEndTime) {
    const [endHours, endMinutes] = selectedEndTime.split(':').map(Number)
    endAt = new Date(selectedDate)
    endAt.setHours(endHours, endMinutes, 0, 0)
    if (endAt <= startAt) {
      endAt.setDate(endAt.getDate() + 1)
    }
  } else {
    endAt = new Date(startAt)
    endAt.setHours(endAt.getHours() + DEFAULT_ASSESSMENT_DURATION_HOURS)
  }

  return { startAt, endAt }
}

// 생년월일 포맷팅 (YYYY-MM-DD)
export function formatBirthDateValue(value: string): string {
  const numbers = value.replace(/[^0-9]/g, '')
  if (numbers.length <= 4) {
    return numbers
  } else if (numbers.length <= 6) {
    return `${numbers.slice(0, 4)}-${numbers.slice(4)}`
  } else {
    return `${numbers.slice(0, 4)}-${numbers.slice(4, 6)}-${numbers.slice(6, 8)}`
  }
}
