/**
 * Agent chat 컴포넌트 모션 SSOT (표·상태·작업 과정).
 *
 * Svelte `in:` 트랜지션은 first-paint / 스토어 일괄 마운트에서 스킵되는 경우가 있어
 * **CSS keyframes 클래스**를 주 경로로 쓴다 (playground · AgentChatArea 공용).
 *
 * 텍스트 말풍선/답은 애니 없음.
 */
import { quintOut } from 'svelte/easing'

export const APPEAR_X = -10
export const APPEAR_Y = -14
export const APPEAR_MS = 320
export const EXIT_MS = 180

/** 등장 클래스 — 요소가 DOM에 붙는 순간 CSS 애니 실행 (Svelte in: 보다 신뢰) */
export const MOTION_IN_CLASS = 'agent-chat-motion-in'
/** 퇴장 클래스 (수동 토글용 · 기본 unmount는 fadeOut 트랜지션) */
export const MOTION_OUT_CLASS = 'agent-chat-motion-out'

/**
 * 퇴장 전용 Svelte transition (중간 hop 본문 제거 시).
 * 등장은 CSS 클래스 사용.
 */
export function fadeOut(
  _node: Element,
  { duration = EXIT_MS }: { duration?: number } = {}
) {
  if (duration <= 0) return { duration: 0, css: () => '' }
  return {
    duration,
    easing: quintOut,
    css: (t: number) => `opacity: ${t};`,
  }
}

/**
 * playground remount 데모용 — CSS와 동일 궤적의 Svelte in 트랜지션.
 * 실채팅 본 경로는 MOTION_IN_CLASS 사용.
 */
export function appear(
  _node: Element,
  { duration = APPEAR_MS }: { duration?: number } = {}
) {
  if (duration <= 0) return { duration: 0, css: () => '' }
  return {
    duration,
    easing: quintOut,
    css: (t: number) => {
      const dx = (1 - t) * APPEAR_X
      const dy = (1 - t) * APPEAR_Y
      const s = 0.97 + t * 0.03
      return `
        opacity: ${t};
        transform: translate(${dx}px, ${dy}px) scale(${s});
        transform-origin: top left;
      `
    },
  }
}
