/**
 * 운영 일정 접수 페이지(/operation/receive) FormSpec 디스크립터.
 * 필드 계약 변경 시 백엔드 prefill 스키마 동기화 — ./README.md 참고.
 */

import { registerFormTools } from './form-tools'
import type { RoomItemType } from '$lib/hooks/actions/room.action'

interface OperationFormShape {
  selectedDate: Date | null
  selectedRoom: RoomItemType | null
  startAt: string | null
  endAt: string | null
}

export interface OperationForm extends OperationFormShape {
  getTitle: () => string
  setTitle: (v: string) => void
  getMemo: () => string
  setMemo: (v: string) => void
}

export function registerOperationReceiveTools(
  form: OperationForm,
  roomList: () => RoomItemType[]
): void {
  registerFormTools({
    formName: '운영 일정',
    submitLabel: '저장',
    fields: {
      title: {
        label: '제목',
        required: true,
        get: form.getTitle,
        set: form.setTitle
      },
      room: {
        label: '장소',
        kind: 'ref',
        list: roomList,
        get: () =>
          form.selectedRoom
            ? { id: form.selectedRoom.id, name: form.selectedRoom.name }
            : null,
        set: (r) => {
          form.selectedRoom = r
        }
      },
      date: {
        label: '날짜',
        kind: 'date',
        required: true,
        get: () =>
          form.selectedDate
            ? form.selectedDate.toISOString().slice(0, 10)
            : null,
        set: (v) => {
          form.selectedDate = new Date(v)
        }
      },
      start_time: {
        label: '시작 시간',
        kind: 'time',
        required: true,
        get: () => form.startAt,
        set: (v) => {
          form.startAt = v
        }
      },
      end_time: {
        label: '종료 시간',
        kind: 'time',
        required: true,
        get: () => form.endAt,
        set: (v) => {
          form.endAt = v
        }
      },
      memo: { label: '메모', get: form.getMemo, set: form.setMemo }
    }
  })
}
