import { writable, derived } from 'svelte/store'

export interface InstitutionSummary {
  id: string
  name: string
  type?: string
  role?: 'admin' | 'clinician' | 'researcher'
}

interface InstitutionState {
  currentInstitutionId: string | null
  institutions: InstitutionSummary[]
}

/**
 * 기관 컨텍스트는 httpOnly cookie(`institution_id`)로 관리되며 클라이언트는 메모리만 보유.
 * localStorage 사용 안 함 (XSS 표면 차단).
 *
 * - 로그인 / 페이지 hydration 시 `hydrate({ currentInstitutionId, institutions })` 호출
 * - 기관 전환은 서버 엔드포인트(/api/auth/select-institution)를 통해 cookie 갱신 후 store 업데이트
 */
function createInstitutionStore() {
  const { subscribe, set, update } = writable<InstitutionState>({
    currentInstitutionId: null,
    institutions: []
  })

  let snapshot: InstitutionState = {
    currentInstitutionId: null,
    institutions: []
  }
  subscribe((s) => (snapshot = s))

  return {
    subscribe,
    /** 페이지 hydration 또는 로그인 직후 한 번에 주입 */
    hydrate: (state: InstitutionState) => set(state),
    setInstitutions: (institutions: InstitutionSummary[]) =>
      update((s) => ({ ...s, institutions })),
    /**
     * 기관 전환 — 서버에 cookie 갱신 요청 후 메모리 store 업데이트.
     * 멤버십 검증은 서버에서 수행. 실패 시 throw.
     */
    selectInstitution: async (id: string) => {
      const res = await fetch('/api/auth/select-institution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institution_id: id })
      })
      if (!res.ok) {
        throw new Error('기관 전환에 실패했습니다.')
      }
      update((s) => ({ ...s, currentInstitutionId: id }))
    },
    getCurrentInstitutionId: () => snapshot.currentInstitutionId,
    clear: () => set({ currentInstitutionId: null, institutions: [] })
  }
}

export const institutionStore = createInstitutionStore()

export const institutionId = derived(
  institutionStore,
  ($s) => $s.currentInstitutionId
)

export function requireInstitutionId(): string {
  const id = institutionStore.getCurrentInstitutionId()
  if (!id)
    throw new Error('기관이 선택되지 않았습니다. 다시 로그인해주세요.')
  return id
}
