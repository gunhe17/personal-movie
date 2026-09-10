/**
 * 검사 접수 페이지(/assessment/receive) FormSpec 디스크립터.
 * 필드 계약 변경 시 백엔드 prefill 스키마 동기화 — ./README.md 참고.
 *
 * 검사 항목·패키지는 읽기 전용(화면에서 직접 선택). room/일정 쓰기는 방문검사로 전환한다.
 */

import { registerFormTools, type RefValue } from './form-tools'
import type { ExtendedClient } from '$root/src/lib/stores/receiveForm'
import type { MemberListItem } from '$lib/hooks/actions/member.action'

interface AssessmentForm {
  clientType: string
  selectedOrganization: { id: string; name: string } | null
  groupMembers: {
    id: string
    name: string
    birthDate: string
    gender: 'male' | 'female' | ''
    guardianPhone: string
  }[]
  selectedClients: ExtendedClient[]
  selectedMember: MemberListItem[]
  selectedRoom: any
  selectedDates: Date[]
  selectedDate: Date | null
  scheduleStartTime: string | null
  scheduleEndTime: string | null
  selectedPackageIds: string[]
  selectedAssessmentItems: string[]
  clientMemo: string
  visitCenter: boolean
  canSubmitFinal: boolean
}

/** 검색 미경유 선택 — 이름만 알아도 화면에 얹히도록 최소 스텁 (uid는 id 없으면 name fallback) */
function toClientStub(v: RefValue): ExtendedClient {
  return {
    uid: v.id || v.name,
    role: 'client',
    name: v.name,
    gender: '',
    birth_date: null,
    guardian_relationship: '',
    guardian_name: '',
    guardian_phone: '',
    memo: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  } as unknown as ExtendedClient
}

export function registerAssessmentReceiveTools(
  form: AssessmentForm,
  _memberList: () => any[],
  roomList: () => any[],
  onSubmit?: () => void
): void {
  registerFormTools({
    formName: '검사 접수',
    submitLabel: '접수',
    fields: {
      client_type: {
        label: '접수 방식',
        kind: 'enum',
        values: ['individual', 'group'],
        get: () => form.clientType,
        set: (v) => {
          form.clientType = v
        }
      },
      organization: {
        label: '기관/단체',
        kind: 'ref',
        // 목록 매칭을 걸지 않는다 — 신규 기관은 아직 DB에 없다. 이름만으로 화면에 얹는다
        required: () => form.clientType === 'group',
        get: () =>
          form.selectedOrganization
            ? {
                id: form.selectedOrganization.id,
                name: form.selectedOrganization.name
              }
            : null,
        set: (r) => {
          form.clientType = 'group'
          form.selectedOrganization = {
            id: r.id || `new-${r.name}`,
            name: r.name ?? ''
          }
        }
      },
      group_members: {
        // 기존 내담자가 아니어도 된다 — 이름·생년월일·성별·보호자 연락처를 그대로 얹는다
        label: '단체 명단',
        kind: 'raw',
        required: () => form.clientType === 'group',
        get: () => form.groupMembers,
        set: (v) => {
          const rows = Array.isArray(v) ? v : []
          form.clientType = 'group'
          form.groupMembers = rows.map((m: any, i: number) => ({
            id: m.id ?? `new-${i}-${m.name ?? ''}`,
            name: m.name ?? '',
            birthDate: m.birthDate ?? m.birth ?? '',
            gender: m.gender ?? '',
            guardianPhone: m.guardianPhone ?? m.phone ?? ''
          }))
        }
      },
      client: {
        label: '내담자',
        kind: 'ref',
        many: true,
        required: true,
        get: () =>
          form.selectedClients.map((c) => ({ id: c.uid, name: c.name })),
        set: (items: RefValue[]) => {
          // 개인 명단을 채우면 개인 모드로 되돌린다 — 단체 턴 뒤 개인 턴이 와도 화면이 어긋나지 않는다
          form.clientType = 'individual'
          form.selectedClients = items.map(toClientStub)
        }
      },
      assessment_items: {
        label: '검사 항목',
        required: () => form.selectedPackageIds.length === 0,
        get: () => form.selectedAssessmentItems
      },
      package_ids: {
        label: '검사 패키지',
        get: () => form.selectedPackageIds
      },
      counselor: {
        label: '담당 검사자',
        kind: 'ref',
        many: true,
        required: true,
        get: () =>
          form.selectedMember.map((m) => ({
            id: m.id,
            name: m.person?.name ?? m.id
          })),
        set: (items: RefValue[]) => {
          form.selectedMember = items.map((v) => ({
            id: v.id,
            name: v.name
          })) as unknown as MemberListItem[]
        }
      },
      room: {
        label: '장소',
        kind: 'ref',
        required: () => form.visitCenter,
        list: roomList,
        get: () =>
          form.selectedRoom
            ? { id: form.selectedRoom.id, name: form.selectedRoom.name }
            : null,
        set: (r) => {
          form.visitCenter = true
          form.selectedRoom = r
        }
      },
      date: {
        label: '일정',
        kind: 'date',
        required: () => form.visitCenter,
        get: () => form.selectedDates.map((d) => d.toISOString().slice(0, 10)),
        set: (v) => {
          form.visitCenter = true
          form.selectedDates = [new Date(v)]
          form.selectedDate = new Date(v)
        }
      },
      start_time: {
        label: '시작 시간',
        kind: 'time',
        required: () => form.visitCenter,
        get: () => form.scheduleStartTime,
        set: (v) => {
          form.visitCenter = true
          form.scheduleStartTime = v
        }
      },
      end_time: {
        label: '종료 시간',
        kind: 'time',
        get: () => form.scheduleEndTime,
        set: (v) => {
          form.visitCenter = true
          form.scheduleEndTime = v
        }
      },
      memo: {
        label: '메모',
        get: () => form.clientMemo,
        set: (v) => {
          form.clientMemo = v
        }
      }
    },
    extraState: () => ({
      client_type: form.clientType,
      visit_center: form.visitCenter
    }),
    canSubmit: () => form.canSubmitFinal,
    submit: onSubmit
  })
}
