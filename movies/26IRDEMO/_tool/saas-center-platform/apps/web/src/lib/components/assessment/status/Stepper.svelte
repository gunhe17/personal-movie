<script lang="ts">
  import Typography from '@common/components/Typography.svelte'

  let {
    steps,
    activeStep = 1,
    completedSteps = [],
    onStepChange
  } = $props<{
    steps: ReadonlyArray<{ key: string; label: string }>
    activeStep?: number
    completedSteps?: number[]
    onStepChange?: (stepNumber: number) => void
  }>()

  const isClickable = $derived(typeof onStepChange === 'function')
</script>

<div class="px-8 pb-5">
  <!-- 아이콘 + 라벨 행 -->
  <div class="w-full flex" role="tablist" aria-label="진행 단계">
    {#each steps as step, i}
      {@const stepNum = i + 1}
      {@const isActive = stepNum === activeStep}
      {@const isCompleted = completedSteps.includes(stepNum)}
      {@const isLastStep = stepNum === steps.length}
      <button
        type="button"
        class="flex flex-1 items-center gap-2 border-0 bg-transparent px-0 pt-6 pb-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 rounded-lg {isClickable
          ? 'cursor-pointer'
          : 'cursor-default'}"
        role="tab"
        aria-selected={isActive}
        aria-label={step.label}
        tabindex={isActive ? 0 : -1}
        disabled={!isClickable}
        onclick={() => isClickable && onStepChange?.(stepNum)}
      >
        {#if isCompleted}
          <div
            class="flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 shrink-0"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path
                d="M2 6L5 9L10 3"
                stroke="white"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
        {:else if isActive}
          <div
            class="flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 shrink-0"
          >
            <div class="h-1.25 w-1.25 rounded-full bg-white"></div>
          </div>
        {:else}
          <div
            class="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 shrink-0"
          >
            <span class="text-caption-01-normal-medium text-gray-400"
              >{stepNum}</span
            >
          </div>
        {/if}
        <Typography
          variant="body-01-normal-medium"
          color={isActive
            ? 'text-gray-900'
            : isCompleted
              ? 'text-gray-500'
              : 'text-gray-400'}
          className="whitespace-nowrap"
        >
          {step.label}{#if isLastStep && isCompleted}
            (완료){/if}
        </Typography>
      </button>
    {/each}
  </div>

  <!-- 하단 바 (스텝 버튼 패딩 포함 약 20px 위 여백, 연속된 하나의 라인) -->
  <div class="relative h-1">
    <!-- 회색 베이스 라인 -->
    <div
      class="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 rounded-full bg-gray-200"
    ></div>
    <!-- 활성 스텝 파란 바 (슬라이드 애니메이션) -->
    <div
      class="absolute top-0 h-1 rounded-full bg-primary-500 transition-all duration-300 ease-in-out"
      style="left: {((activeStep - 1) / steps.length) * 100}%; width: {100 /
        steps.length}%;"
    ></div>
  </div>
</div>
