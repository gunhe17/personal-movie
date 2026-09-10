/**
 * 상담 접수 페이지(/counseling/receive) FormSpec 디스크립터.
 * 필드 계약 변경 시 백엔드 prefill 스키마 동기화 — ./README.md 참고.
 */

import { registerFormTools, type RefValue } from './form-tools'
import type { ExtendedClient } from '$root/src/lib/stores/receiveForm'
import type { MemberListItem } from '$lib/hooks/actions/member.action'

interface CounselForm {
  clientType: string
  selectedClients: ExtendedClient[]
  selectedMember: MemberListItem[]
  selectedProgram: any
  selectedRoom: any
  selectedDates: Date[]
  startTime: string | null
  endTime: string | null
  clientMemo: string
  canSubmit: boolean
  handleProgramSelect: (p: any) => void
  selectRoom: (r: any) => void
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

export function registerCounselReceiveTools(
  form: CounselForm,
  programList: () => any[],
  roomList: () => any[],
  onSubmit?: () => void
): void {
  registerFormTools({
    formName: '상담 접수',
    submitLabel: '접수',
    fields: {
      program: {
        label: '프로그램',
        kind: 'ref',
        required: true,
        list: programList,
        get: () =>
          form.selectedProgram
            ? { id: form.selectedProgram.id, name: form.selectedProgram.name }
            : null,
        set: (p) => form.handleProgramSelect(p)
      },
      client: {
        label: '내담자',
        kind: 'ref',
        many: true,
        required: true,
        get: () =>
          form.selectedClients.map((c) => ({ id: c.uid, name: c.name })),
        set: (items: RefValue[]) => {
          form.selectedClients = items.map(toClientStub)
        }
      },
      counselor: {
        label: '담당자',
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
        required: true,
        list: roomList,
        get: () =>
          form.selectedRoom
            ? { id: form.selectedRoom.id, name: form.selectedRoom.name }
            : null,
        set: (r) => form.selectRoom(r)
      },
      date: {
        label: '일정',
        kind: 'date',
        required: true,
        get: () => form.selectedDates.map((d) => d.toISOString().slice(0, 10)),
        set: (v) => {
          form.selectedDates = [new Date(v)]
        }
      },
      start_time: {
        label: '시작 시간',
        kind: 'time',
        required: true,
        get: () => form.startTime,
        set: (v) => {
          form.startTime = v
        }
      },
      end_time: {
        label: '종료 시간',
        kind: 'time',
        required: true,
        get: () => form.endTime,
        set: (v) => {
          form.endTime = v
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
    extraState: () => ({ client_type: form.clientType }),
    canSubmit: () => form.canSubmit,
    submit: onSubmit
  })
}
