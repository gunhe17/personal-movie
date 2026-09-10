/**
 * Push 알림 토스트 스토어
 *
 * 포그라운드에서 FCM Push 수신 시 우측 상단에 표시되는 토스트 관리
 */
import { writable } from 'svelte/store'

export interface PushToastData {
  id: string
  title: string
  body: string
  category?: string
  eventType?: string
  navigateTo?: string
  isVisible: boolean
}

const MAX_TOASTS = 3
const AUTO_DISMISS_MS = 5000
const ANIMATION_MS = 400

function createPushToastStore() {
  const { subscribe, update } = writable<PushToastData[]>([])
  let nextId = 1

  const store = {
    subscribe,

    show(params: Omit<PushToastData, 'id' | 'isVisible'>) {
      const id = `push-toast-${nextId++}`

      update((toasts) => {
        const next = [...toasts, { ...params, id, isVisible: true }]
        // 최대 개수 초과 시 가장 오래된 것 제거
        if (next.length > MAX_TOASTS) {
          return next.slice(next.length - MAX_TOASTS)
        }
        return next
      })

      // 자동 dismiss
      setTimeout(() => store.dismiss(id), AUTO_DISMISS_MS)

      return id
    },

    dismiss(id: string) {
      update((toasts) => toasts.map((t) => (t.id === id ? { ...t, isVisible: false } : t)))

      // 애니메이션 완료 후 배열에서 제거
      setTimeout(() => {
        update((toasts) => toasts.filter((t) => t.id !== id))
      }, ANIMATION_MS)
    },

    clear() {
      update(() => [])
    }
  }

  return store
}

export const pushToastStore = createPushToastStore()
