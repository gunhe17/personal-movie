import { writable } from 'svelte/store'

export interface SnackbarData {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  duration?: number
  isVisible?: boolean
}

function createSnackbarStore() {
  const { subscribe, set, update } = writable<SnackbarData[]>([])

  let nextId = 1

  const store = {
    subscribe,
    show: (
      message: string,
      type: SnackbarData['type'] = 'success',
      duration = 2000
    ) => {
      const id = `snackbar-${nextId++}`
      const snackbar: SnackbarData = {
        id,
        message,
        type,
        duration,
        isVisible: true
      }

      update((snackbars) => [...snackbars, snackbar])

      setTimeout(() => {
        update((snackbars) =>
          snackbars.map((s) => (s.id === id ? { ...s, isVisible: false } : s))
        )
        setTimeout(() => {
          update((snackbars) => snackbars.filter((s) => s.id !== id))
        }, 500)
      }, duration)

      return id
    },
    success: (message: string, duration = 2000) =>
      store.show(message, 'success', duration),
    error: (message: string, duration = 3000) =>
      store.show(message, 'error', duration),
    warning: (message: string, duration = 2500) =>
      store.show(message, 'warning', duration),
    info: (message: string, duration = 2000) =>
      store.show(message, 'info', duration),
    hide: (id: string) => {
      update((snackbars) =>
        snackbars.map((s) => (s.id === id ? { ...s, isVisible: false } : s))
      )
      setTimeout(() => {
        update((snackbars) => snackbars.filter((s) => s.id !== id))
      }, 500)
    },
    clear: () => set([])
  }

  return store
}

export const snackbarStore = createSnackbarStore()
