import { dev } from '$app/environment'
import { env } from '$env/dynamic/public'

/**
 * 배포 환경 3단: development(로컬) / livinglab(평가 환경) / production(운영).
 * PUBLIC_APP_ENV가 명시되면 우선하고, 없으면 hostname으로 폴백한다
 * (app.mindscope.kr = production, 그 외 배포 호스트는 development 취급 — 기존 동작 유지).
 * livinglab은 반드시 PUBLIC_APP_ENV=livinglab으로 명시해야 한다.
 */
export type AppEnv = 'development' | 'livinglab' | 'production'

export function resolveAppEnv(hostname?: string): AppEnv {
  const explicit = env.PUBLIC_APP_ENV
  if (
    explicit === 'development' ||
    explicit === 'livinglab' ||
    explicit === 'production'
  ) {
    return explicit
  }
  if (dev) return 'development'
  if (hostname === 'app.mindscope.kr') return 'production'
  return 'development'
}

/** AI 기능(에이전트 메뉴·필드노트 웹 열람) 노출 — 리빙랩·개발만, 운영 미배포 (D1) */
export function showAiFeatures(hostname?: string): boolean {
  return resolveAppEnv(hostname) !== 'production'
}

/** 구독 기능 노출 — 개발 환경만. 리빙랩·운영 숨김 (D5) */
export function showSubscription(hostname?: string): boolean {
  return resolveAppEnv(hostname) === 'development'
}
