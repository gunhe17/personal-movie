import { writable } from 'svelte/store'
import { browser } from '$app/environment'

export interface AssessmentUser {
  id: string
  email: string
  name: string
  role: string
  phone?: string
  centers?: Array<{ id: string; name: string; code?: string; logo_url?: string | null }>
}

interface AssessmentAuthState {
  user: AssessmentUser | null
  isAuthenticated: boolean
  isLoading: boolean
}

function createAssessmentAuthStore() {
  const { subscribe, set, update } = writable<AssessmentAuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true
  })

  return {
    subscribe,
    login: (user: AssessmentUser) =>
      set({ user, isAuthenticated: true, isLoading: false }),
    logout: async () => {
      if (browser) {
        try {
          await fetch('/api/assessment/auth/logout', { method: 'POST' })
        } catch {
          // 서버 실패 시에도 로컬 상태는 초기화
        }

        const cookieNames = ['assessmentAccessToken', 'assessmentRefreshToken']
        cookieNames.forEach((name) => {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict`
          document.cookie = `${name}=; max-age=0; path=/`
        })
      }

      set({ user: null, isAuthenticated: false, isLoading: false })
    },
    setLoading: (loading: boolean) =>
      update((state) => ({ ...state, isLoading: loading })),
    initialize: (user: AssessmentUser | null) => {
      if (user) {
        set({ user, isAuthenticated: true, isLoading: false })
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false })
      }
    },
    checkAuth: () => {
      if (!browser) return

      const accessToken = getCookie('assessmentAccessToken')
      if (accessToken && !isTokenExpired(accessToken)) {
        const user = parseUserFromToken(accessToken)
        set({
          user,
          isAuthenticated: !!user,
          isLoading: false
        })
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

function decodeJwtPayload(token: string): Record<string, unknown> {
  const base64Url = token.split('.')[1]
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => `%${('00' + c.charCodeAt(0).toString(16)).slice(-2)}`)
      .join('')
  )
  return JSON.parse(jsonPayload)
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

function parseUserFromToken(token: string): AssessmentUser | null {
  try {
    const payload = decodeJwtPayload(token)
    return {
      id: (payload.sub as string) || (payload.user_id as string) || '',
      email: (payload.email as string) || '',
      name: (payload.name as string) || '',
      role: (payload.role as string) || 'counselor',
      phone: (payload.phone as string) || undefined
    }
  } catch {
    return null
  }
}

export const assessmentAuthStore = createAssessmentAuthStore()
