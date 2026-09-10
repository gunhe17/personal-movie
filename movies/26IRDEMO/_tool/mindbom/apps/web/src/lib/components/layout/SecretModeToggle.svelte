<script lang="ts">
  /**
   * 시크릿 모드 토글 버튼.
   *
   * - OFF 상태에서 클릭: ActivateModal → 모드 선택 → store.enable
   * - ON 상태에서 클릭: store.disable → DeactivateModal (비밀번호 검증)
   * - 헤더/사이드바 어디에서든 재사용 가능.
   */
  import { auth } from '$lib/stores/auth'
  import { institutionStore } from '$lib/stores/institution.store'
  import { secretModeStore } from '$lib/stores/secret-mode.store.svelte'
  import { modalStore } from '$lib/stores/modal'
  import SecretModeActivateModal from '$lib/components/modal/SecretModeActivateModal.svelte'

  interface Props {
    /** 'icon' (기본): 아이콘만, 'inline': 아이콘 + 라벨 */
    variant?: 'icon' | 'inline'
    /** 'light': 흰 크롬(헤더/사이드바), 'dark': 다크 크롬(전체화면 검사 툴바) */
    tone?: 'light' | 'dark'
    /** 추가 클래스 */
    class?: string
  }

  let { variant = 'icon', tone = 'dark', class: extraClass = '' }: Props = $props()

  // ON은 두 톤 모두 주의(amber)를 쓰되, 흰 배경에서는 텍스트 대비를 위해 진한 톤으로.
  let toneClass = $derived(
    tone === 'light'
      ? secretModeStore.enabled
        ? 'bg-orange-50 text-orange-700 hover:bg-orange-100'
        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
      : secretModeStore.enabled
        ? 'bg-orange-500/20 text-orange-200 hover:bg-orange-500/30'
        : 'text-gray-300 hover:bg-sidebar-hover'
  )

  let busy = $state(false)

  async function handleClick() {
    if (busy) return
    busy = true
    try {
      const accountId = $auth.user?.id
      const institutionId = institutionStore.getCurrentInstitutionId()
      if (!accountId || !institutionId) return

      if (secretModeStore.enabled) {
        await secretModeStore.disable(accountId, institutionId)
      } else {
        const mode = await modalStore.openWithPromise<unknown, 'masking' | 'lockscreen' | null>(
          SecretModeActivateModal,
          {},
          { customWidth: 480 }
        )
        if (mode) {
          secretModeStore.enable(accountId, institutionId, mode)
        }
      }
    } finally {
      busy = false
    }
  }

  let label = $derived(
    secretModeStore.enabled
      ? secretModeStore.mode === 'lockscreen'
        ? '잠금 모드'
        : '마스킹 ON'
      : '시크릿 모드'
  )
  let iconName = $derived(secretModeStore.enabled ? 'lock' : 'visibility_off')
</script>

{#if variant === 'inline'}
  <button
    type="button"
    onclick={handleClick}
    disabled={busy}
    class="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-label-01-normal-medium transition-colors {toneClass} {extraClass}"
    aria-label="시크릿 모드 토글"
  >
    <span class="material-icons-round text-sm">{iconName}</span>
    {label}
  </button>
{:else}
  <button
    type="button"
    onclick={handleClick}
    disabled={busy}
    class="inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors {toneClass} {extraClass}"
    title={label}
    aria-label="시크릿 모드 토글"
  >
    <span class="material-icons-round text-base">{iconName}</span>
  </button>
{/if}
