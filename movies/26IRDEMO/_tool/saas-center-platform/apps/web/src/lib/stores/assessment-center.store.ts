import { writable, derived } from 'svelte/store'
import { browser } from '$app/environment'

const CURRENT_CENTER_KEY = 'assessmentCurrentCenterId'
const CENTERS_KEY = 'assessmentCenters'

export interface AssessmentCenterSummary {
  id: string
  name: string
  code?: string
  logo_url?: string | null
}

interface AssessmentCenterState {
  currentCenterId: string | null
  centers: AssessmentCenterSummary[]
}

function readCentersFromStorage(): AssessmentCenterSummary[] {
  if (!browser) return []
  const raw = localStorage.getItem(CENTERS_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as AssessmentCenterSummary[]
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

function createAssessmentCenterStore() {
  const { subscribe, set, update } = writable<AssessmentCenterState>({
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
    setCenters: (centers: AssessmentCenterSummary[]) => {
      if (browser) {
        localStorage.setItem(CENTERS_KEY, JSON.stringify(centers))
      }
      update((state) => ({ ...state, centers }))
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

export const assessmentCenterStore = createAssessmentCenterStore()
export const assessmentCenterId = derived(
  assessmentCenterStore,
  ($state) => $state.currentCenterId
)

export function requireAssessmentCenterId(): string {
  const id = assessmentCenterStore.getCurrentCenterId()
  if (!id) {
    throw new Error('검사 센터가 선택되지 않았습니다. 다시 로그인해주세요.')
  }
  return id
}
