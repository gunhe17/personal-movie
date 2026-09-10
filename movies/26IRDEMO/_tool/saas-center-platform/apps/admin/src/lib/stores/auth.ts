import { writable } from 'svelte/store'
import type { AdminUser } from '../../app.d'

interface AuthState {
  isAuthenticated: boolean
  user: AdminUser | null
}

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>({
    isAuthenticated: false,
    user: null
  })

  return {
    subscribe,

    login(user: AdminUser) {
      set({ isAuthenticated: true, user })
    },

    initialize(user: AdminUser) {
      set({ isAuthenticated: true, user })
    },

    logout() {
      set({ isAuthenticated: false, user: null })
    }
  }
}

export const auth = createAuthStore()
