/**
 * 권한 상태 관리 Store (source of truth)
 *
 * localStorage 기반 캐싱 + 버전 기반 lazy 동기화
 */

import { writable, derived, get } from 'svelte/store'
import { browser } from '$app/environment'
import type { AccessLevel, Permission, PermissionContext, UserRole } from '$lib/types/permissions'
import { centerStore } from './center.store'

const STORAGE_KEY = 'permissionContext'
const VERSION_KEY = 'permissionVersion'

/** role_code → UserRole 매핑 */
const ROLE_MAP: Record<string, UserRole> = {
  ADMIN: 'super_admin',
  MANAGER: 'manager',
  STAFF: 'staff',
  COUNSELOR: 'counselor'
}

interface PermissionState {
  context: PermissionContext | null
  isLoading: boolean
  lastSyncAt: string | null
}

function createPermissionStore() {
  const { subscribe, set, update } = writable<PermissionState>({
    context: null,
    isLoading: false,
    lastSyncAt: null
  })

  // 동기화 진행 중 플래그 (중복 요청 방지)
  let isSyncing = false

  return {
    subscribe,

    /**
     * localStorage에서 권한 로드, 없으면 API 호출
     */
    async load(): Promise<void> {
      if (!browser) return

      update((s) => ({ ...s, isLoading: true }))

      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        try {
          const context = JSON.parse(stored) as PermissionContext
          set({ context, isLoading: false, lastSyncAt: context.updatedAt })
          return
        } catch {
          localStorage.removeItem(STORAGE_KEY)
          localStorage.removeItem(VERSION_KEY)
        }
      }

      // localStorage에 없으면 API 호출
      await this.fetchFromServer()
    },

    /**
     * 서버에서 권한 정보 가져오기
     * GET /api/proxy/centers/{center_id}/me/permissions
     */
    async fetchFromServer(): Promise<void> {
      if (!browser || isSyncing) return

      const centerId = centerStore.getCurrentCenterId()
      if (!centerId) {
        console.warn('[Permission] centerId 없음, 권한 조회 스킵')
        return
      }

      isSyncing = true
      update((s) => ({ ...s, isLoading: true }))

      try {
        const response = await fetch(
          `/api/proxy/centers/${centerId}/me/permissions`,
          { credentials: 'include' }
        )

        if (!response.ok) {
          throw new Error(
            `Failed to fetch permissions (${response.status})`
          )
        }

        const data = await response.json()
        const context: PermissionContext = {
          permissions: (data.permissions || []) as Permission[],
          role: ROLE_MAP[data.role_code] ?? null,
          memberId: data.member_id ?? null,
          accessLevel: (data.access_level ?? 'own') as AccessLevel,
          isAuthenticated: true,
          version: data.permissions_version ?? 1,
          updatedAt: new Date().toISOString()
        }
        this.save(context)
      } catch (error) {
        console.error('[Permission] Failed to fetch context:', error)
      } finally {
        isSyncing = false
        update((s) => ({ ...s, isLoading: false }))
      }
    },

    /**
     * localStorage에 저장 + store 업데이트
     */
    save(context: PermissionContext): void {
      if (!browser) return

      const now = new Date().toISOString()
      const contextWithTime = { ...context, updatedAt: now }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(contextWithTime))
      localStorage.setItem(VERSION_KEY, String(context.version))

      set({
        context: contextWithTime,
        isLoading: false,
        lastSyncAt: now
      })

      console.log('[Permission] Saved context, version:', context.version)
    },

    /**
     * 권한 정보 삭제 (로그아웃 시)
     */
    clear(): void {
      if (!browser) return

      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(VERSION_KEY)

      set({ context: null, isLoading: false, lastSyncAt: null })

      console.log('[Permission] Cleared')
    },

    /**
     * 현재 버전 반환 (localStorage에서 직접 읽기)
     */
    getVersion(): number | null {
      if (!browser) return null
      const version = localStorage.getItem(VERSION_KEY)
      return version ? parseInt(version, 10) : null
    },

    /**
     * 버전 비교 후 필요시 동기화 (비동기)
     */
    async syncIfNeeded(serverVersion: number): Promise<void> {
      const currentVersion = this.getVersion()

      if (currentVersion === null || currentVersion !== serverVersion) {
        console.log(
          '[Permission] Version mismatch, syncing...',
          `local=${currentVersion}, server=${serverVersion}`
        )
        await this.fetchFromServer()
      }
    },

    /**
     * 특정 권한 보유 여부 확인
     */
    hasPermission(permission: Permission): boolean {
      const state = get({ subscribe })
      return state.context?.permissions.includes(permission) ?? false
    },

    /**
     * 여러 권한 중 하나라도 보유 여부 확인
     */
    hasAnyPermission(permissions: Permission[]): boolean {
      const state = get({ subscribe })
      if (!state.context) return false
      return permissions.some((p) => state.context!.permissions.includes(p))
    },

    /**
     * 모든 권한 보유 여부 확인
     */
    hasAllPermissions(permissions: Permission[]): boolean {
      const state = get({ subscribe })
      if (!state.context) return false
      return permissions.every((p) => state.context!.permissions.includes(p))
    }
  }
}

export const permissionStore = createPermissionStore()

// Derived stores
export const currentPermissions = derived(
  permissionStore,
  ($store) => $store.context?.permissions ?? []
)

export const currentRole = derived(
  permissionStore,
  ($store) => $store.context?.role ?? null
)

export const permissionVersion = derived(
  permissionStore,
  ($store) => $store.context?.version ?? null
)

export const isPermissionLoading = derived(
  permissionStore,
  ($store) => $store.isLoading
)

/**
 * 특정 권한 확인용 derived store factory
 */
export function hasPermission(permission: Permission) {
  return derived(
    permissionStore,
    ($store) => $store.context?.permissions.includes(permission) ?? false
  )
}

/**
 * 여러 권한 중 하나 확인용 derived store factory
 */
export function hasAnyPermission(permissions: Permission[]) {
  return derived(permissionStore, ($store) => {
    if (!$store.context) return false
    return permissions.some((p) => $store.context!.permissions.includes(p))
  })
}

/**
 * 모든 권한 확인용 derived store factory
 */
export function hasAllPermissions(permissions: Permission[]) {
  return derived(permissionStore, ($store) => {
    if (!$store.context) return false
    return permissions.every((p) => $store.context!.permissions.includes(p))
  })
}
