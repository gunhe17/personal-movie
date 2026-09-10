/**
 * 대시보드 시그널 큐 — "처리해 주세요" 항목을 순회 처리하는 가이드 흐름 상태.
 * 대시보드에서 시그널 클릭 시 전체 목록+시작 위치를 담고, 착지 페이지의
 * SignalQueueBar가 읽어 이전/다음/대시보드 복귀를 제공한다.
 * sessionStorage에 지속 — 새로고침해도 같은 탭에서는 순회가 이어지고, 탭을 닫으면
 * 소멸한다. 큐가 없는 진입(공유 URL·새 탭)은 SignalQueueBar의 축소(fallback) 모드가 받는다.
 */
import { browser } from '$app/environment'

export interface DashboardSignal {
  id: string
  tone: 'amber' | 'red' | 'green'
  /** 건수와 명사구를 분리해 둔다 — 카드는 숫자를 배지로 앞세우고, 바는 둘을 합쳐 쓴다 */
  count: number
  unit: string
  noun: string
  href: string
  /** 이전 세션에 저장된 큐(구 스키마) 복원용 */
  label?: string
  title?: string
}

interface SignalQueueState {
  signals: DashboardSignal[]
  index: number
}

const STORAGE_KEY = 'dashboard-signal-queue'

function restore(): SignalQueueState | null {
  if (!browser) return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SignalQueueState
    if (!Array.isArray(parsed?.signals) || typeof parsed?.index !== 'number')
      return null
    if (parsed.index < 0 || parsed.index >= parsed.signals.length) return null
    return parsed
  } catch {
    return null
  }
}

let queue = $state<SignalQueueState | null>(restore())

function persist() {
  if (!browser) return
  try {
    if (queue) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // storage 접근 실패(프라이빗 모드 등)는 메모리 동작만으로 진행
  }
}

export const signalQueue = {
  get value(): SignalQueueState | null {
    return queue
  },
  get current(): DashboardSignal | null {
    return queue ? queue.signals[queue.index] : null
  },
  start(signals: DashboardSignal[], index: number) {
    queue = { signals, index }
    persist()
  },
  setIndex(index: number) {
    if (!queue || index < 0 || index >= queue.signals.length) return
    queue = { ...queue, index }
    persist()
  },
  clear() {
    queue = null
    persist()
  },
  /**
   * 현재 URL이 큐의 현재 시그널 착지점인지 — 바 표시 여부의 단일 판정.
   * pathname + signal 파라미터만 비교해, 착지 후 탭·페이지 등 부가 필터 조작은
   * 흐름을 끊지 않되 다른 화면으로 이탈하면 바를 숨긴다.
   */
  activeFor(url: URL): boolean {
    const current = this.current
    if (!current) return false
    const target = new URL(current.href, url.origin)
    if (target.pathname !== url.pathname) return false
    return (
      (target.searchParams.get('signal') ?? '') ===
      (url.searchParams.get('signal') ?? '')
    )
  }
}
