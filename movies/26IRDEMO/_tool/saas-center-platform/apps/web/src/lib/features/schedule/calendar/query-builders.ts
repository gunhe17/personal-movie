import type {
  ExtendedClient,
  GroupMember
} from '$lib/stores/receiveForm'
import type { Organization } from '$lib/types/organization'

interface ClientDetail {
  name: string
  birthDate?: string
  gender?: 'male' | 'female'
  guardianPhone?: string
  organization?: string
}

interface CreateScheduleRequest {
  center_id: string
  date: Date
  start_at: Date
  end_at: Date
  client: string[]
  manager: string[]
  schedule_type: string
  room: string
  memo: string
  title: string
  selectedProgram: string
  clientDetails: ClientDetail[]
}

// 스케줄 생성 요청 빌더 (공통)
interface BuildScheduleRequestParams {
  centerId: string
  selectedDate: Date
  selectedTime: string
  selectedStaff: string[]
  selectedProgram: string | null
  selectedRoom: string | null
  clientMemo: string
}

// 개인 접수 스케줄 요청 빌더
interface BuildIndividualScheduleParams extends BuildScheduleRequestParams {
  selectedClient: ExtendedClient
}

function calculateScheduleTimes(
  selectedDate: Date,
  selectedTime: string
): { startAt: Date; endAt: Date } {
  const [hours, minutes] = selectedTime.split(':').map(Number)
  const startAt = new Date(selectedDate)
  startAt.setHours(hours, minutes, 0, 0)

  const endAt = new Date(startAt)
  endAt.setHours(endAt.getHours() + 2)

  return { startAt, endAt }
}

export function buildIndividualScheduleRequest(
  params: BuildIndividualScheduleParams
): CreateScheduleRequest {
  const {
    centerId,
    selectedClient,
    selectedDate,
    selectedTime,
    selectedStaff,
    selectedProgram,
    selectedRoom,
    clientMemo
  } = params
  const { startAt, endAt } = calculateScheduleTimes(selectedDate, selectedTime)

  return {
    center_id: centerId,
    date: selectedDate,
    start_at: startAt,
    end_at: endAt,
    client: [selectedClient.name],
    manager: selectedStaff,
    schedule_type: '상담',
    room: selectedRoom || '',
    memo: clientMemo,
    title: selectedProgram || '초기상담',
    selectedProgram: selectedProgram || '초기상담',
    clientDetails: [
      {
        name: selectedClient.name,
        birthDate: selectedClient.birth_date
          ? new Date(selectedClient.birth_date).toISOString().split('T')[0]
          : undefined,
        gender: (selectedClient.gender === '여자' ? 'female' : 'male') as
          | 'male'
          | 'female',
        guardianPhone: selectedClient.guardian_phone || undefined,
        organization: selectedClient.organization || undefined
      }
    ]
  }
}

// 단체 접수 스케줄 요청 빌더
interface BuildGroupScheduleParams extends BuildScheduleRequestParams {
  groupMembers: GroupMember[]
  selectedOrganization: Organization | null
}

export function buildGroupScheduleRequest(
  params: BuildGroupScheduleParams
): CreateScheduleRequest {
  const {
    centerId,
    groupMembers,
    selectedOrganization,
    selectedDate,
    selectedTime,
    selectedStaff,
    selectedRoom,
    selectedProgram,
    clientMemo
  } = params
  const { startAt, endAt } = calculateScheduleTimes(selectedDate, selectedTime)

  const clientDetails: ClientDetail[] = groupMembers.map((m) => ({
    name: m.name,
    birthDate: m.birthDate || undefined,
    gender: m.gender as 'male' | 'female' | undefined,
    guardianPhone: m.guardianPhone || undefined,
    organization: selectedOrganization?.name || undefined
  }))

  return {
    center_id: centerId,
    date: selectedDate,
    start_at: startAt,
    end_at: endAt,
    client: groupMembers.map((m) => m.name),
    manager: selectedStaff,
    schedule_type: '상담',
    selectedProgram: selectedProgram || '초기상담',
    room: selectedRoom || '',
    title: selectedProgram || '초기상담',
    memo: clientMemo,
    clientDetails
  }
}
