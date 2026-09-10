import type { RoomItemType } from "$root/src/lib/hooks/actions/room.action"

export function useOperationForm() {
  let selectedDate = $state<Date | null>(null)
  let selectedRoom = $state<RoomItemType | null>(null)
  let sendNotification = $state<boolean>(false)
  let startAt = $state<string | null>(null)
  let endAt = $state<string | null>(null)

  function buildFormState() {
    return {
      selectedDate,
      selectedRoom,
      sendNotification,
      startAt,
      endAt
    }
  }

  return {
    get selectedDate() {
      return selectedDate
    },
    get selectedRoom() {
      return selectedRoom
    },
    get startAt() {
      return startAt
    },
    get endAt() {
      return endAt
    },
    get sendNotification() {
      return sendNotification
    },
    set sendNotification(v: boolean) {
      sendNotification = v
    },
    set selectedDate(v: Date | null) {
      selectedDate = v
    },
    set selectedRoom(v: RoomItemType | null) {
      selectedRoom = v
    },
    set startAt(v: string | null) {
      startAt = v
    },
    set endAt(v: string | null) {
      endAt = v
    },
    buildFormState
  }
}

export type CounselFormModel = ReturnType<typeof useOperationForm>
