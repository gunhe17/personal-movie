import { env } from '$env/dynamic/private'

export const API_URL = env.API_URL || 'http://localhost:3502/api/v1'

export const COOKIE_CONFIG = {
  accessToken: {
    name: 'admin_accessToken',
    maxAge: 60 * 60 * 24 // 24시간
  },
  refreshToken: {
    name: 'admin_refreshToken',
    maxAge: 60 * 60 * 24 * 7 // 7일
  }
} as const

export function resolveApiUrl(path: string): string {
  return `${API_URL}/${path}`
}
