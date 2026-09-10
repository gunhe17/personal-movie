import type { ExtendedClient, GroupMember } from '$lib/stores/receiveForm'
import type { Organization } from '$lib/types/organization'
import type { CreateCounselingRequestType } from '$root/src/lib/hooks/actions/counseling.action'
import type { MemberListItem } from '$root/src/lib/hooks/actions/member.action'
import type { ProgramListItem } from '$root/src/lib/hooks/actions/program.action'
import type { RoomItemType } from '$root/src/lib/hooks/actions/room.action'
import { requireCenterId } from '$root/src/lib/stores/center.store'
import { detectDatePattern, type DetectedPattern } from '$root/src/lib/utils/detectDatePattern'

const DAY_LABEL_TO_ENGLISH: Record<string, string> = {
  '일': 'sunday', '월': 'monday', '화': 'tuesday', '수': 'wednesday',
  '목': 'thursday', '금': 'friday', '토': 'saturday'
}

/**
 * DetectedPattern → session_rule 변환
 * 서버에 저장되어 나중에 "규칙대로 추가"에 사용됨
 */
function buildSessionRule(
  pattern: DetectedPattern,
  startTime: string,
  endTime: string,
  roomId: string
): CreateCounselingRequestType['sessions']['session_rule'] {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const durationMinutes = (eh * 60 + em) - (sh * 60 + sm)

  const daysOfWeek = pattern.daysOfWeek
    ?.map((d) => DAY_LABEL_TO_ENGLISH[d])
    .filter(Boolean)

  const alternatingDays = pattern.alternatingDaysOfWeek
    ?.map((d) => DAY_LABEL_TO_ENGLISH[d])
    .filter(Boolean)

  return {
    recurrence: {
      pattern: pattern.type,
      interval: pattern.interval,
      ...(daysOfWeek?.length ? { days_of_week: daysOfWeek } : {}),
      ...(alternatingDays?.length ? { alternating_days_of_week: alternatingDays } : {}),
    },
    duration_minutes: durationMinutes > 0 ? durationMinutes : 50,
    room_id: roomId,
    start_time: startTime,
  }
}

// 스케줄 생성 요청 빌더 (공통)
interface BuildScheduleRequestParams {
  centerId: string
  selectedDates: Date[]
  startTime: string | null
  endTime: string | null
  selectedMember: MemberListItem[]
  /** 대표 담당자 ID. 지정되면 counselor_ids 배열의 첫 번째로 재정렬되어 전송됨.
   *  백엔드는 counselor_ids[0] 을 case.counselor_id / schedule.member_id 에 저장. */
  primaryMemberId?: string | null
  selectedProgram: ProgramListItem | null
  selectedRoom: RoomItemType | null
  clientMemo: string
}

export interface IndividualScheduleParams extends BuildScheduleRequestParams {
  selectedClients: ExtendedClient[]
}

export interface GroupScheduleParams extends BuildScheduleRequestParams {
  groupMembers: GroupMember[]
  selectedOrganization: Organization | null
}

/**
 * 개인 상담 일정 요청 빌더 (멀티 날짜 지원)
 * selectedDates에서 패턴을 감지하여 session_rule도 함께 전송
 */
export const buildIndividualCounselRequest = (
  params: IndividualScheduleParams
): CreateCounselingRequestType => {
  const {
    selectedClients,
    selectedDates,
    startTime,
    endTime,
    selectedMember,
    primaryMemberId,
    selectedProgram,
    selectedRoom,
    clientMemo
  } = params

  // dates 배열 생성: 각 날짜에 startTime 합산하여 ISO string
  const dates = selectedDates.map((d) => {
    if (startTime) {
      const [hours, minutes] = startTime.split(':').map(Number)
      const dt = new Date(d)
      dt.setHours(hours, minutes, 0, 0)
      return dt.toISOString()
    }
    return d.toISOString()
  })

  // 2개 이상이면 패턴 감지 → session_rule 생성
  const pattern = selectedDates.length >= 2 ? detectDatePattern(selectedDates) : null
  const sessionRule = (pattern && startTime && endTime && selectedRoom)
    ? buildSessionRule(pattern, startTime, endTime, selectedRoom.id)
    : undefined

  // counselor_ids 를 primary 먼저 오도록 재정렬 (백엔드가 counselor_ids[0] 을 대표로 취급).
  // primaryMemberId 가 없거나 유효하지 않으면 기존 순서 유지.
  const counselorIds = selectedMember.map((m) => m.id)
  const orderedCounselorIds =
    primaryMemberId && counselorIds.includes(primaryMemberId)
      ? [primaryMemberId, ...counselorIds.filter((id) => id !== primaryMemberId)]
      : counselorIds

  return {
    center_id: requireCenterId(),
    case: {
      chief_complaint: clientMemo || '',
      program_id: selectedProgram?.id || '',
      client_ids: selectedClients.map((c) => c.uid),
      counselor_ids: orderedCounselorIds,
      memo: clientMemo
    },
    sessions: {
      dates,
      start_time: startTime || '',
      end_time: endTime || '',
      room_id: selectedRoom?.id || '',
      memo: clientMemo,
      session_rule: sessionRule
    }
  }
}

/**
 * 멤버 목록 쿼리 입력 빌더
 */
export function buildMembersQueryInput(centerId: string) {
  return {
    center_id: centerId
  }
}

/**
 * 상담실 목록 쿼리 입력 빌더
 */
export function buildRoomsQueryInput(centerId: string) {
  return {
    center_id: centerId,
    active_only: true
  }
}
