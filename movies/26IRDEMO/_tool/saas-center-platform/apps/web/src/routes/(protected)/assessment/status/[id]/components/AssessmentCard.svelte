<style>
  @keyframes dropdown {
    from {
      opacity: 0;
      transform: translateY(6px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .card {
    box-shadow: 0 12px 28px -14px rgba(15, 23, 42, 0.22);
    position: relative;
    border: 1px solid #dfe3ec;
    border-radius: 24px;
    overflow: visible;
    background: white;
  }

  .card-surface {
    background: white;
    border-radius: 24px;
    overflow: visible;
  }

  .dropdown-menu {
    animation: dropdown 0.16s ease-out;
    transform-origin: top right;
  }
</style>

<script lang="ts">
  import ObjectiveFolder from '$root/src/lib/assets/assessmentCardFolderBgImg/ObjectiveFolder.svelte'
  import type { AssessmentItem } from '$lib/features/assessment/status-detail/types'
  import Typography from '@common/components/Typography.svelte'
  import ObjectiveIcon from '$root/src/lib/assets/assessmentCardFolderBgImg/ObjectiveIcon.svelte'

  export let assessment: AssessmentItem
  export let statusLabel: string
  export let actionOpen: boolean
  export let onToggleAction: (assessment: AssessmentItem) => void
  export let onSelectAction: (
    assessment: AssessmentItem,
    action: string
  ) => void
  export let onCloseAction: () => void

  const actions = ['검사완료', '검사보류', '검사거부', '검사취소']

  let cardEl: HTMLDivElement | null = null

  const handleWindowClick = (event: MouseEvent) => {
    if (!actionOpen) return
    const target = event.target as Node | null
    if (cardEl && target && !cardEl.contains(target)) {
      onCloseAction()
    }
  }
</script>

<svelte:window on:click={handleWindowClick} />

<div
  bind:this={cardEl}
  class="card relative overflow-visible rounded-3xl bg-white"
  style="width: 270px; height: 176px;"
>
  <div class="card-surface relative h-full w-full overflow-visible">
    <div
      class="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      <div class="w-auto">
        <ObjectiveFolder />
      </div>
    </div>

    <div
      class="relative z-10 flex h-full flex-col items-start justify-end px-12 pb-15 text-white"
    >
      <div class="mb-4 flex flex-col items-start gap-4">
        <ObjectiveIcon />
        <Typography variant="body-03-normal-semibold" color="text-white">
          {assessment.name}
        </Typography>
      </div>
    </div>

    <div
      class="absolute bottom-0 left-0 right-0 z-20 flex h-13 items-stretch border-t border-gray-200 bg-white rounded-b-[22px]"
    >
      <div
        class="flex w-1/2 items-center justify-center gap-2 text-sm font-semibold text-[#b9c3d1]"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3 9.75L15 3.75L10.5 9.75L15 14.25L3 9.75Z"
            stroke="#C7D2E0"
            stroke-width="1.4"
            stroke-linejoin="round"
            stroke-linecap="round"
          />
        </svg>
        결과 전송
      </div>

      <div class="flex w-1/2 items-center justify-center text-sm text-gray-700">
        <div class="relative flex items-center gap-2">
          <button
            class="flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-gray-700 hover:bg-gray-50"
            onclick={() => onToggleAction(assessment)}
            aria-expanded={actionOpen}
            aria-haspopup="menu"
          >
            {statusLabel}
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              class="text-gray-500"
            >
              <path
                d="M4 6L8 10L12 6"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
          {#if actionOpen}
            <div
              class="dropdown-menu dropdown-panel absolute top-full left-0 z-20 mt-1 origin-top"
              role="menu"
            >
              {#each actions as action}
                <button
                  class="dropdown-item {action === '검사취소'
                    ? 'is-danger'
                    : ''}"
                  onclick={() => onSelectAction(assessment, action)}
                  role="menuitem"
                >
                  {action}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>
