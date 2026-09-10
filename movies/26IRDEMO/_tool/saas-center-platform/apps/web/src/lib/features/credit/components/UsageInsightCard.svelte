<script lang="ts">
  import type { UsagePageVM } from '../view-model'

  interface Props {
    vm: UsagePageVM
  }

  let { vm }: Props = $props()

  const trend = $derived(vm.insight.weeklyTrend)
  // 사용량 추세는 중립 지표 — 방향은 화살표·라벨로, 색은 중립(gray)으로 통일
  const trendConfig = $derived(
    trend === 'up'
      ? {
          label: '증가',
          color: 'text-gray-600',
          arrow: '↑',
          bg: 'bg-gray-50',
          icon: 'text-gray-500'
        }
      : trend === 'down'
        ? {
            label: '감소',
            color: 'text-gray-600',
            arrow: '↓',
            bg: 'bg-gray-50',
            icon: 'text-gray-500'
          }
        : {
            label: '유지',
            color: 'text-gray-600',
            arrow: '→',
            bg: 'bg-gray-50',
            icon: 'text-gray-500'
          }
  )
</script>

<div class="rounded-lg border border-gray-200 bg-white">
  <div class="px-6 pt-6 pb-2">
    <h2 class="text-title-01-normal-semibold text-gray-800">사용 인사이트</h2>
  </div>
  <div class="px-3 pb-3">
    <!-- 일평균 사용량 -->
    <div class="flex items-center justify-between rounded-lg px-3 py-4">
      <div class="flex items-center gap-3.5">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50"
        >
          <svg
            class="h-5 w-5 text-violet-500"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
            />
          </svg>
        </div>
        <div>
          <p class="text-body-02-normal-medium text-gray-800">일평균 사용량</p>
          <p class="text-body-03-normal-regular text-gray-400 mt-0.5">
            하루 평균 크레딧 · 사용 횟수
          </p>
        </div>
      </div>
      <div class="pl-4 shrink-0 text-right">
        <span class="text-body-01-normal-semibold tabular-nums text-gray-900"
          >{vm.insight.dailyAvgCredits}</span
        >
        <span class="text-body-03-normal-regular text-gray-400">크레딧</span>
        <span class="text-body-03-normal-regular text-gray-300 mx-1">·</span>
        <span class="text-body-01-normal-semibold tabular-nums text-gray-900"
          >{vm.insight.dailyAvgCalls}</span
        >
        <span class="text-body-03-normal-regular text-gray-400">회</span>
      </div>
    </div>
    <div class="mx-3 border-b border-gray-100"></div>

    <!-- 1회당 평균 크레딧 -->
    <div class="flex items-center justify-between rounded-lg px-3 py-4">
      <div class="flex items-center gap-3.5">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50"
        >
          <svg
            class="h-5 w-5 text-sky-500"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z"
            />
          </svg>
        </div>
        <div>
          <p class="text-body-02-normal-medium text-gray-800">1회당 비용</p>
          <p class="text-body-03-normal-regular text-gray-400 mt-0.5">
            AI 기능 1회 사용에 소비되는 평균 크레딧
          </p>
        </div>
      </div>
      <p class="pl-4 shrink-0">
        <span class="text-body-01-normal-semibold tabular-nums text-gray-900"
          >{vm.insight.creditsPerCall}</span
        >
        <span class="text-body-03-normal-regular text-gray-400">크레딧</span>
      </p>
    </div>
    <div class="mx-3 border-b border-gray-100"></div>

    <!-- 주간 추세 -->
    <div class="flex items-center justify-between rounded-lg px-3 py-4">
      <div class="flex items-center gap-3.5">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg {trendConfig.bg}"
        >
          <svg
            class="h-5 w-5 {trendConfig.icon}"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941"
            />
          </svg>
        </div>
        <div>
          <p class="text-body-02-normal-medium text-gray-800">주간 추세</p>
          <p class="text-body-03-normal-regular text-gray-400 mt-0.5">
            최근 7일 vs 이전 7일
          </p>
        </div>
      </div>
      <div class="pl-4 shrink-0 text-right">
        <span class="text-body-01-normal-semibold tabular-nums text-gray-900"
          >{vm.insight.weeklyRecentCredits.toLocaleString()}</span
        >
        <span class="text-body-03-normal-regular text-gray-400">크레딧</span>
        <p class="text-body-03-normal-regular text-gray-400 mt-0.5">
          지난주 {vm.insight.weeklyPrevCredits.toLocaleString()}크레딧
        </p>
      </div>
    </div>
    <div class="mx-3 border-b border-gray-100"></div>

    <!-- 예상 소진일 -->
    <div class="flex items-center justify-between rounded-lg px-3 py-4">
      <div class="flex items-center gap-3.5">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg {vm
            .insight.estimatedDepletionDays <= vm.daysUntilReset &&
          vm.insight.estimatedDepletionDays > 0
            ? 'bg-status-danger-bg'
            : 'bg-green-50'}"
        >
          <svg
            class="h-5 w-5 {vm.insight.estimatedDepletionDays <=
              vm.daysUntilReset && vm.insight.estimatedDepletionDays > 0
              ? 'text-status-danger'
              : 'text-green-500'}"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
        </div>
        <div>
          <p class="text-body-02-normal-medium text-gray-800">예상 소진</p>
          <p class="text-body-03-normal-regular text-gray-400 mt-0.5">
            현재 속도 기준 크레딧 소진 시점
          </p>
        </div>
      </div>
      <span
        class="text-body-01-normal-semibold tabular-nums pl-4 shrink-0 {vm
          .insight.estimatedDepletionDays <= vm.daysUntilReset &&
        vm.insight.estimatedDepletionDays > 0
          ? 'text-red-600'
          : 'text-green-600'}"
      >
        {#if vm.insight.estimatedDepletionDays === 0}
          소진 완료
        {:else if vm.insight.estimatedDepletionDays > vm.daysUntilReset}
          리셋까지 여유
        {:else}
          {vm.insight.estimatedDepletionDays}일 후
        {/if}
      </span>
    </div>
  </div>
</div>
