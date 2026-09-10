<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import NoticeBubble from '$lib/components/common/NoticeBubble.svelte'
  import { twMerge } from 'tailwind-merge'
  import type { WeeklySummary } from '$lib/features/schedule/calendar/view-model'

  interface Props {
    summary: WeeklySummary
  }

  let { summary }: Props = $props()

  // 예약 많은 날 툴팁 — 날짜별 닫힘 상태 (date.getTime() 키)
  let dismissed = $state(new Set<number>())
  function dismiss(date: Date) {
    dismissed = new Set(dismissed).add(date.getTime())
  }
</script>

<div
  class="bg-white px-4 h-[120px] shrink-0 flex items-center border-b border-gray-200"
>
  <div class="w-full grid grid-cols-[repeat(8,1fr)] gap-2">
    {#each summary.days as day}
      <div class="relative flex flex-col items-center min-w-0">
        <div class="flex items-center gap-1 mb-4">
          <Typography variant="body-01-normal-medium" color={'text-gray-600'}>
            {day.dayOfMonth}
          </Typography>
          <Typography variant="body-01-normal-regular" color={'text-gray-600'}>
            {day.dayLabel}
          </Typography>
        </div>
        <div class="flex items-baseline gap-2">
          <Typography
            variant="headline-00-normal-semibold"
            color="text-gray-900"
          >
            {day.count}
          </Typography>
          <Typography variant="body-03-normal-regular" color="text-gray-500">
            건
          </Typography>
        </div>
        {#if day.isAnomaly && !dismissed.has(day.date.getTime())}
          <!-- 상시 고지 = 공용 NoticeBubble (§Components>tooltip 단일 규격).
               면 gray-800 · radius 8 · 좌우 12/상하 6 · Body_03(14) 흰색 ·
               꼬리 5px · 닫기 16. 손으로 그리면 화면마다 말풍선이 갈린다.
               문구는 한 줄 — 말풍선은 whitespace-nowrap이 기본이라 <br>로 접지 않는다. -->
          <div
            class="absolute bottom-full left-1/2 z-10001 mb-1 -translate-x-1/2"
          >
            <NoticeBubble
              text="평소보다 예약이 많아요"
              onClose={() => dismiss(day.date)}
            />
          </div>
        {/if}
      </div>
    {/each}
    <!-- 총 예약 건수 -->
    <div
      class="flex flex-col items-center justify-start border-l border-gray-200"
    >
      <Typography
        variant="body-03-normal-regular"
        color="text-gray-500"
        className="mb-4"
      >
        총 예약 건수
      </Typography>
      <div class="flex items-baseline gap-2">
        <Typography variant="headline-00-normal-semibold" color="text-imomtae">
          {summary.totalCount}
        </Typography>
        <Typography variant="body-03-normal-regular" color="text-gray-500">
          건
        </Typography>
      </div>
      {#if summary.weekOverWeekChange !== null}
        <span
          class={twMerge(
            'text-xs font-medium mt-1',
            summary.weekOverWeekChange > 0
              ? 'text-primary-500'
              : summary.weekOverWeekChange < 0
                ? 'text-status-danger'
                : 'text-gray-500'
          )}
        >
          전 주 대비 {Math.abs(summary.weekOverWeekChange)}건
          {summary.weekOverWeekChange > 0
            ? '▲'
            : summary.weekOverWeekChange < 0
              ? '▼'
              : ''}
        </span>
      {/if}
    </div>
  </div>
</div>
