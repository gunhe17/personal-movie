import { writable } from 'svelte/store'
import { browser } from '$app/environment'
import type { Permission } from '$lib/types/permissions'
import { permissionStore } from './permission.store'
import { centerStore } from './center.store'
import { secretModeStore } from './secret-mode.store'

export interface User {
  id: string
  email: string
  name: string
  role: string
  phone?: string
  permissions?: Permission[]
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
          // 서버 API를 통한 로그아웃 (HTTP-Only 쿠키 삭제)
          await fetch('/api/auth/logout', { method: 'POST' })
        } catch {
          // 서버 요청 실패해도 클라이언트 상태는 초기화
        }

        // 클라이언트 쿠키 삭제 (개발용 mock 로그인 호환)
        // 여러 옵션 조합으로 삭제 시도
        const cookieNames = ['accessToken', 'refreshToken']
        cookieNames.forEach((name) => {
          // 기본 삭제
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`
          // SameSite=Strict 포함
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict`
          // SameSite=Lax 포함
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`
          // max-age=0 방식
          document.cookie = `${name}=; max-age=0; path=/`
        })

        // center 상태 정리
        centerStore.clear()

        // 시크릿 모드 상태 정리
        secretModeStore.clear()

        // 권한 정보 삭제
        permissionStore.clear()
      }
      set({ user: null, isAuthenticated: false, isLoading: false })
    },
    setLoading: (loading: boolean) =>
      update((state) => ({ ...state, isLoading: loading })),
    // 서버에서 user 정보를 전달받아 초기화 (HTTP-Only 쿠키 환경)
    initialize: (user: User | null) => {
      if (user) {
        set({ user, isAuthenticated: true, isLoading: false })
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false })
      }
    },
    // 클라이언트 쿠키 기반 인증 체크 (개발용 mock 로그인에서만 사용)
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
      role: payload.role as string,
      permissions: Array.isArray(payload.permissions)
        ? (payload.permissions as Permission[])
        : undefined
    }
  } catch {
    return null
  }
}

export const auth = createAuthStore()
