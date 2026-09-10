/**
 * Login Service
 * 로그인 · 센터 선택 비즈니스 로직
 */

import { goto } from '$app/navigation'
import { browser } from '$app/environment'
import { auth } from '$lib/stores/auth'
import { centerStore } from '$lib/stores/center.store'
import { permissionStore } from '$lib/stores/permission.store'
import type { Permission, UserRole } from '$lib/types/permissions'
import {
  getCenters,
  type Center,
  type CenterApplication
} from '$lib/hooks/actions/center.action'
import { postLogin } from '$lib/hooks/actions/auth.action'
import { MOCK_ACCOUNTS, type LoginUser } from './constants'

// ============================================================
// 헬퍼
// ============================================================

/** URL에서 redirectTo 파라미터 가져오기 (없으면 대시보드로) */
export function getRedirectUrl(): string {
  if (!browser) return '/dashboard'
  const params = new URLSearchParams(window.location.search)
  return params.get('redirectTo') || '/dashboard'
}

// ============================================================
// Mock 로그인 (개발 전용)
// ============================================================

function encodeMockPayload(payload: object): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  return btoa(String.fromCharCode(...bytes))
}

function setMockCookies(user: LoginUser) {
  const now = Math.floor(Date.now() / 1000)

  const accessPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    permissions: user.permissions,
    exp: now + 60 * 60 * 24
  }

  const refreshPayload = {
    sub: user.id,
    type: 'refresh',
    exp: now + 60 * 60 * 24 * 7
  }

  const accessToken = `fake-header.${encodeMockPayload(accessPayload)}.fake-signature`
  const refreshToken = `fake-header.${encodeMockPayload(refreshPayload)}.fake-signature`

  document.cookie = `accessToken=${accessToken}; path=/; SameSite=strict`
  document.cookie = `refreshToken=${refreshToken}; path=/; SameSite=strict`
}

function savePermissions(_user: LoginUser) {
  // TODO: 권한 컨텍스트 API 연동 후 복원
  // permissionStore.save({
  //   permissions: (user.permissions || []) as Permission[],
  //   role: user.role as UserRole,
  //   isAuthenticated: true,
  //   version: 1,
  //   updatedAt: new Date().toISOString()
  // })
}

/**
 * Mock 로그인 시도
 * @returns 성공 시 LoginUser, 매칭 실패 시 null
 */
export function tryMockLogin(email: string, password: string): LoginUser | null {
  const matched = MOCK_ACCOUNTS.find(
    (a) => a.email === email && a.password === password
  )
  if (!matched) return null

  const user = matched.user
  setMockCookies(user)
  savePermissions(user)
  auth.login(user)
  return user
}

// ============================================================
// 실제 API 로그인
// ============================================================

export interface RealLoginResult {
  success: boolean
  user?: LoginUser
  error?: string
}

export async function realLogin(
  email: string,
  password: string
): Promise<RealLoginResult> {
  try {
    const data = await postLogin().request({ email, password })

    // 센터 정보 저장
    if (data.user.centers) {
      centerStore.setCenters(data.user.centers)
    }

    const user: LoginUser = {
      id: data.user.id,
      email: data.user.email,
      name: data.user.name,
      role: data.user.role
    }

    auth.login(user)
    return { success: true, user }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : '로그인에 실패했습니다.'
    return { success: false, error: message }
  }
}

// ============================================================
// 센터 목록 조회
// ============================================================

export interface FetchCentersResult {
  centers: Center[]
  applications: CenterApplication[]
  autoSelected: boolean
}

/**
 * 센터 목록 조회 후 자동 선택까지 처리
 * - 센터가 1개면 자동 선택 후 리다이렉트
 * - 여러 개면 선택 화면 표시를 위해 결과 반환
 */
export async function fetchAndProcessCenters(): Promise<FetchCentersResult> {
  const response = await getCenters().request({ limit: 100 })
  const centers = response.centers || []
  const applications = response.applications || []

  if (centers.length > 0) {
    centerStore.setCenters(centers)
  }

  return { centers, applications, autoSelected: false }
}

// ============================================================
// 센터 선택
// ============================================================

export async function selectCenter(centerId: string) {
  centerStore.setCurrentCenterId(centerId)
  await goto(getRedirectUrl())
}

// ============================================================
// 로그아웃 (로그인 페이지에서 "다른 계정으로 로그인")
// ============================================================

export function logoutFromLoginPage() {
  auth.logout()
}
