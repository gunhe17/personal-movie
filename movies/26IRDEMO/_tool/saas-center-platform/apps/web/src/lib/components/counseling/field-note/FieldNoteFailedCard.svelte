<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import { STEP_LABELS } from '$lib/features/field-note/constants'

  interface Props {
    failedStep: string | null
    onRetry?: () => void | Promise<void>
  }
  let { failedStep, onRetry }: Props = $props()

  const stepLabel = $derived(
    failedStep ? (STEP_LABELS[failedStep] ?? failedStep) : '처리'
  )

  let isRetrying = $state(false)

  async function handleRetryClick() {
    if (isRetrying) return
    isRetrying = true
    try {
      await onRetry?.()
    } finally {
      isRetrying = false
    }
  }
</script>

<div class="flex flex-1 flex-col items-center justify-center gap-4 py-10">
  <div
    class="flex h-12 w-12 items-center justify-center rounded-full bg-status-danger-bg text-status-danger"
  >
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 8v5m0 3h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </div>
  <div class="text-center space-y-1">
    <Typography variant="title-02-semibold" color="text-gray-800">
      "{stepLabel}" 단계에서 실패했어요
    </Typography>
    <Typography variant="body-02-normal-regular" color="text-gray-500">
      재시도하거나 잠시 후 다시 확인해 주세요.
    </Typography>
  </div>
  <button
    type="button"
    onclick={handleRetryClick}
    disabled={isRetrying}
    class="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary-500 px-5 text-body-02-normal-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-300"
  >
    {#if isRetrying}
      <span
        class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
      ></span>
      다시 시도 중...
    {:else}
      다시 시도
    {/if}
  </button>
</div>
