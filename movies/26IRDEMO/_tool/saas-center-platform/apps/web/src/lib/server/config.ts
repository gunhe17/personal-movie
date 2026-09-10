/**
 * 서버 사이드 환경 설정
 *
 * 모든 API URL은 환경 변수에서 읽어옵니다.
 * 개발: .env 파일
 * 프로덕션: 환경 변수 또는 .env.production
 */

import { env } from '$env/dynamic/private'

// 통합 API 서버 URL (모든 요청이 동일 서버로 향함)
export const API_URL = env.API_URL || 'http://localhost:3502/api/v1'

// 쿠키 설정
export const COOKIE_CONFIG = {
  accessToken: {
    name: 'accessToken',
    maxAge: 60 * 60 * 24 // 24시간
  },
  refreshToken: {
    name: 'refreshToken',
    maxAge: 60 * 60 * 24 * 7 // 7일
  }
} as const

// 인증이 필요 없는 경로
export const PUBLIC_PATHS = [
  '/login',
  '/assessment/login',
  '/assessment-flow/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/assessment/auth/login',
  '/api/assessment/auth/logout',
  '/api/assessment/auth/refresh'
] as const

/**
 * 프록시 경로를 실제 API URL로 변환
 */
export function resolveApiUrl(path: string): string {
  return `${API_URL}/${path}`
}
