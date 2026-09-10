import { writable } from 'svelte/store'

export type SnackbarType = 'success' | 'error' | 'info' | 'warning'

interface SnackbarItem {
  id: number
  message: string
  type: SnackbarType
}

function createSnackbarStore() {
  const { subscribe, update } = writable<SnackbarItem[]>([])
  let nextId = 0

  function show(message: string, type: SnackbarType, duration = 3000) {
    const id = nextId++
    update((items) => [...items, { id, message, type }])

    setTimeout(() => {
      update((items) => items.filter((item) => item.id !== id))
    }, duration)
  }

  return {
    subscribe,
    success: (message: string) => show(message, 'success'),
    error: (message: string) => show(message, 'error'),
    info: (message: string) => show(message, 'info'),
    warning: (message: string) => show(message, 'warning')
  }
}

export const snackbarStore = createSnackbarStore()
