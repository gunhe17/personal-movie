/**
 * 시크릿 모드 store — Svelte 5 runes 기반 ($state).
 *
 * legacy svelte/store 의 derived + $auto-subscribe 패턴이 컴포넌트 인스턴스별
 * dependency tracking 을 놓치는 케이스가 있어 (특히 {#each} 내부 expression),
 * runes 의 fine-grained reactivity 로 전환.
 *
 * 사용:
 *   import { secretModeStore } from '$lib/stores/secret-mode.store.svelte'
 *   {secretModeStore.enabled ? maskName(client.name) : client.name}
 */
import { browser } from '$app/environment'

export type SecretModeType = 'masking' | 'lockscreen' | null

function getStorageKey(accountId: string, institutionId: string): string {
  return `secret-mode-${accountId}-${institutionId}`
}

class SecretModeStore {
  enabled = $state(false)
  mode = $state<SecretModeType>(null)

  /**
   * 로그인 / 페이지 hydration 직후 호출 — localStorage 기반 상태 복구.
   */
  initialize(
    accountId: string | null | undefined,
    institutionId: string | null | undefined
  ) {
    if (!browser || !accountId || !institutionId) {
      this.enabled = false
      this.mode = null
      return
    }
    const stored = localStorage.getItem(getStorageKey(accountId, institutionId))
    if (stored === 'masking' || stored === 'lockscreen') {
      this.enabled = true
      this.mode = stored
    } else {
      this.enabled = false
      this.mode = null
    }
  }

  /** 시크릿 모드 활성화 — 모드 선택 (masking | lockscreen). */
  enable(
    accountId: string,
    institutionId: string,
    mode: Exclude<SecretModeType, null> = 'masking'
  ) {
    if (browser) {
      localStorage.setItem(getStorageKey(accountId, institutionId), mode)
    }
    this.enabled = true
    this.mode = mode
  }

  /**
   * 시크릿 모드 해제 — 비밀번호 검증 모달을 띄워 확인 후에만 해제.
   * 사용자가 모달에서 취소하거나 비밀번호 불일치 시 false 반환.
   */
  async disable(
    accountId: string,
    institutionId: string
  ): Promise<boolean> {
    const { modalStore } = await import('./modal')
    const { default: SecretModeDeactivateModal } = await import(
      '$lib/components/modal/SecretModeDeactivateModal.svelte'
    )

    const verified = await modalStore.openWithPromise<unknown, boolean>(
      SecretModeDeactivateModal,
      {},
      { customWidth: 420 }
    )

    if (!verified) return false

    if (browser) {
      localStorage.removeItem(getStorageKey(accountId, institutionId))
    }
    this.enabled = false
    this.mode = null

    const { snackbarStore } = await import('./snackbar')
    snackbarStore.success('시크릿 모드가 해제되었습니다')
    return true
  }

  /** 로그아웃 시 메모리만 클리어 (localStorage 는 유지 — 다음 로그인 시 복원). */
  clear() {
    this.enabled = false
    this.mode = null
  }
}

export const secretModeStore = new SecretModeStore()
