import { env } from '$env/dynamic/private'

export const API_URL = env.API_URL || 'http://localhost:4502/api/v1'

export const COOKIE_CONFIG = {
  accessToken: {
    name: 'accessToken',
    maxAge: 60 * 60 * 24
  },
  refreshToken: {
    name: 'refreshToken',
    maxAge: 60 * 60 * 24 * 7
  },
  institution: {
    name: 'institution_id',
    maxAge: 60 * 60 * 24 * 7
  }
} as const

export function resolveApiUrl(path: string): string {
  return `${API_URL}/${path}`
}
