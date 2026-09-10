import { writable, derived } from 'svelte/store'
import { browser } from '$app/environment'

export type SecretModeType = 'masking' | 'lockscreen' | null

function getStorageKey(accountId: string, centerId: string): string {
  return `secret-mode-${accountId}-${centerId}`
}

interface SecretModeState {
  enabled: boolean
  mode: SecretModeType
}

function createSecretModeStore() {
  const { subscribe, set, update } = writable<SecretModeState>({
    enabled: false,
    mode: null
  })

  return {
    subscribe,
    initialize: (
      accountId: string | null | undefined,
      centerId: string | null
    ) => {
      if (!browser || !accountId || !centerId) {
        set({ enabled: false, mode: null })
        return
      }
      const stored = localStorage.getItem(getStorageKey(accountId, centerId))
      if (stored === 'masking' || stored === 'lockscreen') {
        set({ enabled: true, mode: stored })
      } else if (stored === 'true') {
        // 기존 데이터 호환: 'true'는 마스킹으로 처리
        set({ enabled: true, mode: 'masking' })
      } else {
        set({ enabled: false, mode: null })
      }
    },
    enable: (
      accountId: string,
      centerId: string,
      mode: SecretModeType = 'masking'
    ) => {
      if (browser && mode) {
        localStorage.setItem(getStorageKey(accountId, centerId), mode)
      }
      set({ enabled: true, mode })
    },
    /** 시크릿 모드 해제 — 모달에서 비밀번호 검증 후 해제 */
    disable: async (accountId: string, centerId: string): Promise<boolean> => {
      const { modalStore } = await import('./modal')
      const { default: SecretModeDeactivateModal } = await import(
        '$lib/components/modal/SecretModeDeactivateModal.svelte'
      )

      const verified = await modalStore.openWithPromise(
        SecretModeDeactivateModal,
        {},
        { customWidth: 420 }
      )

      if (!verified) return false

      if (browser) {
        localStorage.setItem(getStorageKey(accountId, centerId), 'false')
      }
      set({ enabled: false, mode: null })

      const { snackbarStore } = await import('./snackbar')
      snackbarStore.success('시크릿 모드가 해제되었습니다')
      return true
    },
    clear: () => {
      set({ enabled: false, mode: null })
    }
  }
}

export const secretModeStore = createSecretModeStore()

/** 시크릿 모드 활성 여부 — 컴포넌트에서 $isSecretMode로 바로 사용 */
export const isSecretMode = derived(secretModeStore, ($s) => $s.enabled)

/** 현재 시크릿 모드 타입 */
export const secretModeType = derived(secretModeStore, ($s) => $s.mode)
