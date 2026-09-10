<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import { isSecretMode, secretModeStore } from '$lib/stores/secret-mode.store'
  import { auth } from '$lib/stores/auth'
  import { centerId } from '$lib/stores/center.store'
  import { modalStore } from '$lib/stores/modal'
  import SecretModeActivateModal from '$lib/components/modal/SecretModeActivateModal.svelte'

  const handleToggle = async () => {
    const accountId = $auth.user?.email || $auth.user?.id
    const cid = $centerId
    if (!accountId || !cid) return

    if ($isSecretMode) {
      await secretModeStore.disable(accountId, cid)
    } else {
      const mode = await modalStore.openWithPromise<
        Record<string, never>,
        string | null
      >(SecretModeActivateModal, {}, { customWidth: 420 })
      if (mode === 'masking' || mode === 'lockscreen') {
        secretModeStore.enable(accountId, cid, mode)
      }
    }
  }
</script>

<div class="flex items-center gap-2">
  <Typography variant="body-02-normal-medium" color="text-gray-500" tag="span">
    시크릿 모드
  </Typography>
  <button
    type="button"
    role="switch"
    aria-checked={$isSecretMode}
    aria-label="시크릿 모드"
    onclick={handleToggle}
    class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors {$isSecretMode
      ? 'bg-primary-500'
      : 'bg-gray-300'}"
  >
    <span
      class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {$isSecretMode
        ? 'translate-x-6'
        : 'translate-x-1'}"
    ></span>
  </button>
</div>
