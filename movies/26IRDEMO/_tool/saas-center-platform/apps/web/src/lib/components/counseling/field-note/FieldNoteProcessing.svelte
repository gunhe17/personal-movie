<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import type { PipelineStepVM } from '$lib/features/field-note/view-model'
  import { stepStatusLabel } from '$lib/features/field-note/view-model'

  interface Props {
    steps: PipelineStepVM[]
  }
  let { steps }: Props = $props()

  // 진행률 계산 — 완료된 단계 수 / 전체
  const progress = $derived.by(() => {
    const total = steps.length
    if (total === 0) return 0
    const done = steps.filter(
      (s) => s.status === 'completed' || s.status === 'skipped'
    ).length
    return Math.round((done / total) * 100)
  })

  // 현재 활성 단계 라벨
  const activeLabel = $derived(
    steps.find((s) => s.isActive || s.status === 'processing')?.label ??
      '처리 준비 중'
  )

  function rowClass(status: string, isActive: boolean): string {
    if (isActive || status === 'processing')
      return 'border-primary-300 bg-primary-50/40'
    if (status === 'completed') return 'border-gray-200 bg-white'
    if (status === 'failed') return 'border-red-200 bg-status-danger-bg/40'
    return 'border-gray-200 bg-white'
  }
</script>

<div class="flex flex-1 flex-col gap-6 px-4 py-8">
  <!-- 헤더: 큰 스피너 + 현재 단계 -->
  <div class="flex flex-col items-center gap-3 text-center">
    <div class="relative flex h-14 w-14 items-center justify-center">
      <span
        class="absolute inset-0 animate-ping rounded-full bg-primary-200 opacity-60"
      ></span>
      <span
        class="relative inline-block h-10 w-10 animate-spin rounded-full border-[3px] border-primary-100 border-t-primary-500"
      ></span>
    </div>
    <div class="space-y-1">
      <Typography variant="title-02-semibold" color="text-gray-800">
        필드노트를 분석하고 있어요
      </Typography>
      <Typography variant="body-02-normal-regular" color="text-gray-500">
        {activeLabel} 단계 진행 중 · 보통 1~3분 정도 걸려요
      </Typography>
    </div>
  </div>

  <!-- 진행률 바 -->
  <div class="mx-auto w-full max-w-md">
    <div class="mb-1 flex items-center justify-between">
      <Typography variant="body-03-normal-regular" color="text-gray-500">
        전체 진행률
      </Typography>
      <Typography variant="body-03-normal-medium" color="text-primary-600">
        {progress}%
      </Typography>
    </div>
    <div class="h-2 w-full overflow-hidden rounded-full bg-gray-100">
      <div
        class="h-full rounded-full bg-primary-500 transition-all duration-500 ease-out"
        style="width: {progress}%"
      ></div>
    </div>
  </div>

  <!-- 단계별 리스트 -->
  <ol class="mx-auto w-full max-w-md space-y-2">
    {#each steps as step (step.key)}
      {@const active = step.isActive || step.status === 'processing'}
      <li
        class="flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors {rowClass(
          step.status,
          step.isActive
        )}"
      >
        <span class="flex h-5 w-5 shrink-0 items-center justify-center">
          {#if step.status === 'completed'}
            <svg
              viewBox="0 0 20 20"
              class="h-5 w-5 text-green-500"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
                clip-rule="evenodd"
              />
            </svg>
          {:else if step.status === 'failed'}
            <svg
              viewBox="0 0 20 20"
              class="h-5 w-5 text-status-danger"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm1-5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-1-8a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0V6a1 1 0 0 1 1-1Z"
                clip-rule="evenodd"
              />
            </svg>
          {:else if active}
            <span
              class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary-200 border-t-primary-500"
            ></span>
          {:else if step.status === 'skipped'}
            <span class="h-2 w-2 rounded-full bg-gray-300"></span>
          {:else}
            <span class="h-2 w-2 rounded-full bg-gray-200"></span>
          {/if}
        </span>
        <Typography
          variant="body-02-normal-medium"
          color={active ? 'text-primary-700' : 'text-gray-700'}
          className="flex-1"
        >
          {step.label}
        </Typography>
        <Typography
          variant="body-03-regular"
          color={step.status === 'failed'
            ? 'text-status-danger'
            : active
              ? 'text-primary-600'
              : 'text-gray-500'}
        >
          {stepStatusLabel(step.status)}
        </Typography>
      </li>
    {/each}
  </ol>

  <Typography
    variant="body-03-normal-regular"
    color="text-gray-400"
    className="text-center"
  >
    이 화면을 벗어나도 분석은 계속 진행돼요.
  </Typography>
</div>
