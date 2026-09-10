/**
 * 노쇼(No-Show) 정규화 유틸
 *
 * 백엔드는 `no_show`로 수렴됨(D14, 2026-07-09) — `noshow`는 수렴 이전
 * 응답·캐시를 위한 legacy 수용 키로만 남는다.
 */

export const NO_SHOW_UI_KEY = 'no_show' as const

/** UI 표시용 단일 노쇼 키 */
export type NoShowUiKey = typeof NO_SHOW_UI_KEY

/** 백엔드 노쇼 키 (`noshow`는 legacy 수용) */
const NO_SHOW_BACKEND_KEYS = ['no_show', 'noshow'] as const
export type NoShowBackendKey = (typeof NO_SHOW_BACKEND_KEYS)[number]

/** 주어진 status 값이 백엔드의 노쇼 키 중 하나인지 판정 */
export function isNoShowStatus(value: string | null | undefined): boolean {
  if (!value) return false
  return (NO_SHOW_BACKEND_KEYS as readonly string[]).includes(value)
}

/**
 * 백엔드 status를 UI 단일 키로 정규화.
 * 노쇼인 경우 `'no_show'`, 그 외에는 원본을 그대로 반환.
 *
 * @example
 *   normalizeSessionStatus('noshow')  // 'no_show'
 *   normalizeSessionStatus('no_show') // 'no_show'
 *   normalizeSessionStatus('scheduled') // 'scheduled'
 */
export function normalizeSessionStatus(value: string | null | undefined): string {
  if (isNoShowStatus(value)) return NO_SHOW_UI_KEY
  return value ?? ''
}

// ─────────────────────────────────────────────────────────
// 시각 토큰 (라벨/색상) — Calendar view-model의 기존 스타일과 동기
// ─────────────────────────────────────────────────────────

export const NO_SHOW_LABEL = '노쇼' as const

/** 노쇼 뱃지 Tailwind 클래스 (Calendar에서 사용 중인 오렌지 톤) */
export const NO_SHOW_BADGE_CLASS = 'text-orange-600 bg-orange-50' as const

/** 노쇼 참가자(개별) 표시용 라벨 — 청구 맥락에서는 '불참'으로도 통용되지만 UI는 '노쇼'로 통일 */
export const NO_SHOW_PARTICIPANT_LABEL = '노쇼' as const
