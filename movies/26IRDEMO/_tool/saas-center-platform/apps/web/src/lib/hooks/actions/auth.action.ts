/**
 * Auth Actions
 * 인증 관련 API action 함수들 (순수 HTTP 호출만 담당)
 *
 * HTTP-Only 쿠키 환경:
 * - 로그인/로그아웃은 SvelteKit 서버 라우트를 통해 처리
 * - 토큰은 HTTP-Only 쿠키에 저장되어 JavaScript에서 접근 불가
 * - 프록시 경유 API는 instances의 get/post 사용
 */

import axios from 'axios'
import { get, patch, post, deleteResource } from '$lib/services/api/instances'
import type { Action } from '$lib/types/apiResponse'
import type { Center } from './center.action'

// ============ Re-exports ============

export type { Center } from './center.action'

// ============ Login Types ============

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  user: {
    id: string
    email: string
    name: string
    phone?: string
    role: string
    centers?: Center[]
  }
}

// ============ Signup Types ============

export interface SignupRequest {
  email: string
  password: string
  person: {
    name: string
    phone: string
    birth?: string
    gender?: string
  }
}

export interface SignupResponse {
  success: boolean
  message?: string
  user?: {
    id: string
    email: string
    name: string
    phone?: string
    role: string
    isVerified: boolean
    centers: Center[]
  }
}

// ============ Me Types (GET /auth/me) ============

export interface MeAccountSummary {
  id: string
  email: string
  is_verified: boolean
  created_at: string
}

export interface MePersonSummary {
  id: string
  name: string
  phone: string
}

export interface MeCenterSummary {
  id: string
  name: string
  code?: string
  logo_url?: string | null
  role_code?: string | null
  role_name?: string | null
  joined_at?: string | null
  [key: string]: unknown
}

export interface MeResponse {
  account: MeAccountSummary
  person: MePersonSummary | null
  centers: MeCenterSummary[]
}

// ============ Change Password Types ============

export interface ChangePasswordRequest {
  current_password: string
  new_password: string
}

export interface ChangePasswordResponse {
  message: string
  sessions_revoked: number
}

// ============ Verify Password Types ============

export interface VerifyPasswordRequest {
  password: string
}

export interface VerifyPasswordResponse {
  verified: boolean
}

// ============ Withdraw Types ============

// ============ postVerifyPassword ============
// POST /api/proxy/auth/verify-password (프록시 경유)

export const postVerifyPassword = () => ({
  key: ['postVerifyPassword'],
  request: async (
    payload: VerifyPasswordRequest
  ): Promise<VerifyPasswordResponse> => {
    const res = await post<VerifyPasswordResponse>(
      '/auth/verify-password',
      payload
    )
    return (
      (res as { data?: VerifyPasswordResponse }).data ??
      (res as unknown as VerifyPasswordResponse)
    )
  }
})

// ============ postLogin ============
// POST /api/auth/login (SvelteKit 서버 라우트, 쿠키 설정)

export const postLogin = () => ({
  key: ['postLogin'],
  request: async (payload: LoginRequest): Promise<LoginResponse> => {
    const response = await axios.post<LoginResponse>('/api/auth/login', payload)
    return response.data
  }
})

// ============ postLogout ============
// POST /api/auth/logout (SvelteKit 서버 라우트, 쿠키 삭제)

export const postLogout = () => ({
  key: ['postLogout'],
  request: async (): Promise<void> => {
    await axios.post('/api/auth/logout')
  }
})

// ============ postSignup ============
// POST /api/auth/signup (SvelteKit 서버 라우트)

export const postSignup = () => ({
  key: ['postSignup'],
  request: async (payload: SignupRequest): Promise<SignupResponse> => {
    const response = await axios.post<SignupResponse>(
      '/api/auth/signup',
      payload
    )
    return response.data
  }
})

// ============ getMe ============
// GET /api/proxy/auth/me (프록시 경유, 쿠키로 인증)

export const getMe = (): Action<MeResponse, MeResponse> => ({
  key: ['getMe'],
  request: async (): Promise<MeResponse> => {
    return get<MeResponse>('/auth/me')
  }
})

// ============ getMeAssessment ============
// GET /api/assessment/proxy/auth/me (assessment-flow 전용 프록시)

export const getMeAssessment = (): Action<MeResponse, MeResponse> => ({
  key: ['getMeAssessment'],
  request: async (): Promise<MeResponse> => {
    const response = await axios.get<MeResponse>(
      '/api/assessment/proxy/auth/me',
      { withCredentials: true }
    )
    return response.data
  }
})

// ============ postChangePassword ============
// POST /api/proxy/auth/change-password (프록시 경유)

export const postChangePassword = () => ({
  key: ['postChangePassword'],
  request: async (
    payload: ChangePasswordRequest
  ): Promise<ChangePasswordResponse> => {
    const res = await post<ChangePasswordResponse>(
      '/auth/change-password',
      payload
    )
    return (
      (res as { data?: ChangePasswordResponse }).data ??
      (res as unknown as ChangePasswordResponse)
    )
  }
})

// ============ patchUpdatePerson ============
// PUT /api/proxy/persons/{personId} (프록시 경유)

export interface UpdatePersonRequest {
  name?: string
  phone?: string
}

export const patchUpdatePerson = () => ({
  key: ['patchUpdatePerson'],
  request: async (params: {
    personId: string
    payload: UpdatePersonRequest
  }): Promise<void> => {
    await patch(`/persons/${params.personId}`, params.payload)
  }
})

// ============ deleteWithdraw ============
// DELETE /api/proxy/auth/me (프록시 경유, 204 응답)

export const deleteWithdraw = () => ({
  key: ['deleteWithdraw'],
  request: async (): Promise<void> => {
    await deleteResource('/auth/me')
  }
})
