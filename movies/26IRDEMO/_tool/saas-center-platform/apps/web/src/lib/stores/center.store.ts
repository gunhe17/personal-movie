import { writable, derived } from 'svelte/store'
import { browser } from '$app/environment'

const CURRENT_CENTER_KEY = 'currentCenterId'
const CENTERS_KEY = 'centers'

export interface CenterSummary {
  id: string
  name: string
  code?: string
  logo_url?: string | null
}

interface CenterState {
  currentCenterId: string | null
  centers: CenterSummary[]
}

function readCentersFromStorage(): CenterSummary[] {
  if (!browser) return []
  const raw = localStorage.getItem(CENTERS_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as CenterSummary[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function readCurrentCenterId(): string | null {
  if (!browser) return null
  return localStorage.getItem(CURRENT_CENTER_KEY)
}

function setCookie(name: string, value: string) {
  if (!browser) return
  const encoded = encodeURIComponent(value)
  document.cookie = `${name}=${encoded}; path=/; SameSite=Lax`
}

function clearCookie(name: string) {
  if (!browser) return
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`
}

function createCenterStore() {
  const { subscribe, set, update } = writable<CenterState>({
    currentCenterId: null,
    centers: []
  })

  return {
    subscribe,
    initialize: () => {
      if (!browser) return
      const currentCenterId = readCurrentCenterId()
      const centers = readCentersFromStorage()
      set({ currentCenterId, centers })
    },
    setCenters: (centers: CenterSummary[]) => {
      if (browser) {
        localStorage.setItem(CENTERS_KEY, JSON.stringify(centers))
      }
      update((state) => ({ ...state, centers }))
    },
    updateCurrentCenter: (center: CenterSummary) => {
      update((state) => {
        const exists = state.centers.some((c) => c.id === center.id)
        const updatedCenters = exists
          ? state.centers.map((c) => (c.id === center.id ? center : c))
          : [...state.centers, center]
        if (browser) {
          localStorage.setItem(CENTERS_KEY, JSON.stringify(updatedCenters))
          localStorage.setItem(CURRENT_CENTER_KEY, center.id)
          setCookie(CURRENT_CENTER_KEY, center.id)
        }
        return {
          ...state,
          centers: updatedCenters,
          currentCenterId: center.id
        }
      })
    },
    setCurrentCenterId: (centerId: string) => {
      if (browser) {
        localStorage.setItem(CURRENT_CENTER_KEY, centerId)
        setCookie(CURRENT_CENTER_KEY, centerId)
      }
      update((state) => ({ ...state, currentCenterId: centerId }))
    },
    getCurrentCenterId: () => readCurrentCenterId(),
    clear: () => {
      if (browser) {
        localStorage.removeItem(CENTERS_KEY)
        localStorage.removeItem(CURRENT_CENTER_KEY)
        clearCookie(CURRENT_CENTER_KEY)
      }
      set({ currentCenterId: null, centers: [] })
    }
  }
}

export const centerStore = createCenterStore()

/** 현재 센터 ID만 추출하는 derived store — 컴포넌트에서 $centerId로 바로 사용 */
export const centerId = derived(centerStore, ($s) => $s.currentCenterId)

/** 센터 ID가 반드시 필요한 곳에서 사용하는 헬퍼 (null이면 에러) */
export function requireCenterId(): string {
  const id = centerStore.getCurrentCenterId()
  if (!id) throw new Error('센터가 선택되지 않았습니다. 다시 로그인해주세요.')
  return id
}
