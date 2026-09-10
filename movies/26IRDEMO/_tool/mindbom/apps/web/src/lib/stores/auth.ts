import { writable } from 'svelte/store'
import { browser } from '$app/environment'
import { institutionStore } from './institution.store'

export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'clinician' | 'researcher'
}

function createAuthStore() {
  const { subscribe, set, update } = writable<{
    user: User | null
    isAuthenticated: boolean
    isLoading: boolean
  }>({
    user: null,
    isAuthenticated: false,
    isLoading: true
  })

  return {
    subscribe,
    login: (user: User) =>
      set({ user, isAuthenticated: true, isLoading: false }),
    logout: async () => {
      if (browser) {
        try {
          await fetch('/api/auth/logout', { method: 'POST' })
        } catch {
          // 서버 요청 실패해도 클라이언트 상태는 초기화
        }

        const cookieNames = ['accessToken', 'refreshToken']
        cookieNames.forEach((name) => {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`
          document.cookie = `${name}=; max-age=0; path=/`
        })

        institutionStore.clear()
      }
      set({ user: null, isAuthenticated: false, isLoading: false })
    },
    setLoading: (loading: boolean) =>
      update((state) => ({ ...state, isLoading: loading })),
    initialize: (user: User | null) => {
      if (user) {
        set({ user, isAuthenticated: true, isLoading: false })
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false })
      }
    },
    checkAuth: () => {
      if (!browser) return

      const accessToken = getCookie('accessToken')
      if (accessToken && !isTokenExpired(accessToken)) {
        const user = parseUserFromToken(accessToken)
        set({ user, isAuthenticated: true, isLoading: false })
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false })
      }
    }
  }
}

function getCookie(name: string): string | null {
  if (!browser) return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null
  return null
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = decodeJwtPayload(token)
    const now = Math.floor(Date.now() / 1000)
    return (payload.exp as number) < now
  } catch {
    return true
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const base64Url = token.split('.')[1]
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  )
  return JSON.parse(jsonPayload)
}

function parseUserFromToken(token: string): User | null {
  try {
    const payload = decodeJwtPayload(token)
    return {
      id: payload.sub as string,
      email: payload.email as string,
      name: payload.name as string,
      role: (payload.role as User['role']) || 'clinician'
    }
  } catch {
    return null
  }
}

export const auth = createAuthStore()
