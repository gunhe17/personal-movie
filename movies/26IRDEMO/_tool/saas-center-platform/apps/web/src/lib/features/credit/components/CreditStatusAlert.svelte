<script lang="ts">
  /**
   * 크레딧 경고/위험 배너.
   * status가 'normal'이면 렌더링하지 않음.
   */
  import type { UsageStatus } from '../view-model'

  interface Props {
    status: UsageStatus
    creditRemaining: number
    usagePercent: number
    estimatedDepletionDays: number
    daysUntilReset: number
  }

  let {
    status,
    creditRemaining,
    usagePercent,
    estimatedDepletionDays,
    daysUntilReset
  }: Props = $props()

  const remaining = $derived(100 - usagePercent)
  const showDepletion = $derived(
    estimatedDepletionDays > 0 &&
      (status === 'danger' || estimatedDepletionDays <= daysUntilReset)
  )
</script>

{#if status === 'danger'}
  <div
    class="rounded-lg bg-status-danger-bg border border-red-100 px-4 py-3 flex items-center gap-2.5"
  >
    <svg
      class="h-4 w-4 text-status-danger shrink-0"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      viewBox="0 0 24 24"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
      />
    </svg>
    <div>
      <p class="text-body-02-normal-medium text-red-600">
        크레딧이 거의 소진되었어요.
        <span class="tabular-nums"
          >남은 {creditRemaining.toLocaleString()} 크레딧 ({remaining}%)</span
        >
        {#if showDepletion}
          <span class="text-body-03-normal-regular text-status-danger ml-1"
            >· 약 {estimatedDepletionDays}일 후 소진 예상</span
          >
        {/if}
      </p>
      <a
        href="/subscription"
        class="text-body-03-normal-regular text-status-danger hover:text-red-600 underline"
      >
        플랜 업그레이드로 크레딧 늘리기
      </a>
    </div>
  </div>
{:else if status === 'warning'}
  <div
    class="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3 flex items-center gap-2.5"
  >
    <svg
      class="h-4 w-4 text-amber-500 shrink-0"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      viewBox="0 0 24 24"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
      />
    </svg>
    <p class="text-body-02-normal-medium text-amber-700">
      크레딧이 얼마 남지 않았어요.
      <span class="tabular-nums"
        >남은 {creditRemaining.toLocaleString()} 크레딧 ({remaining}%)</span
      >
      {#if showDepletion}
        <span class="text-body-03-normal-regular text-amber-600 ml-1"
          >· 약 {estimatedDepletionDays}일 후 소진 예상</span
        >
      {/if}
    </p>
  </div>
{/if}
