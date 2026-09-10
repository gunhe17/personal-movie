import { browser } from '$app/environment'

const SESSION_TIMEOUT = 30 * 60 // 30분 (초)

let expiresAt = $state(0) // 만료 절대 시각 (ms)
let remainingSeconds = $state(SESSION_TIMEOUT)
let interval: ReturnType<typeof setInterval> | null = null

function tick() {
  remainingSeconds = Math.max(0, Math.round((expiresAt - Date.now()) / 1000))
}

function onVisibilityChange() {
  if (browser && document.visibilityState === 'visible') tick()
}

function start() {
  stop()
  expiresAt = Date.now() + SESSION_TIMEOUT * 1000
  remainingSeconds = SESSION_TIMEOUT
  interval = setInterval(tick, 1000)
  if (browser) {
    document.addEventListener('visibilitychange', onVisibilityChange)
  }
}

function reset() {
  expiresAt = Date.now() + SESSION_TIMEOUT * 1000
  remainingSeconds = SESSION_TIMEOUT
}

function stop() {
  if (interval) {
    clearInterval(interval)
    interval = null
  }
  if (browser) {
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}

export const sessionTimer = {
  get remaining() { return remainingSeconds },
  get display() {
    const min = Math.floor(remainingSeconds / 60)
    const sec = remainingSeconds % 60
    return `${min}:${sec.toString().padStart(2, '0')}`
  },
  get isWarning() { return remainingSeconds <= 120 },
  start,
  reset,
  stop
}
