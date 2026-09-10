<script lang="ts">
  import EditIcon from '$lib/assets/EditIcon.svelte'
  import PermissionGuard from '@common/components/PermissionGuard.svelte'
  import { MEMBER_PERMISSIONS } from '$lib/features/members/permissions'
  import {
    NO_EDIT_PERMISSION_MESSAGE,
    type BreakTime,
    type WeeklySchedule
  } from '$lib/features/members/constants'
  import type { ScheduleCountMap } from '$lib/features/members/work-schedule'
  import { fade } from 'svelte/transition'
  import Typography from '@common/components/Typography.svelte'
  import WorkScheduleCalendar from './WorkScheduleCalendar.svelte'

  interface Props {
    weeklySchedule?: WeeklySchedule
    breakTime: BreakTime | null
    onEditSchedule: () => void
    scheduleCounts?: ScheduleCountMap
    viewYear: number
    viewMonth: number
    onMonthChange?: (year: number, month: number) => void
  }

  let {
    weeklySchedule,
    breakTime,
    onEditSchedule,
    scheduleCounts = {},
    viewYear,
    viewMonth,
    onMonthChange
  }: Props = $props()

  // 근무일 개수
  const workDayCount = $derived(
    weeklySchedule
      ? Object.values(weeklySchedule).filter((v) => v !== null).length
      : 0
  )

  const hasSchedule = $derived(!!weeklySchedule && workDayCount > 0)
</script>

{#snippet noPermissionFallback()}
  <p class="text-gray-500 text-sm py-4">{NO_EDIT_PERMISSION_MESSAGE}</p>
{/snippet}
<PermissionGuard
  permission={MEMBER_PERMISSIONS.updateSchedule}
  fallback={noPermissionFallback}
>
  <div in:fade class="h-full">
    <div class="h-full flex flex-col">
      <!-- 섹션 타이틀 행 (Web_Design.md §패턴): 타이틀 + gap 4 + 카운트, 아래 콘텐츠와 gap 12.
           타이틀은 정본(headline-02/20)보다 한 단계 작은 title-01(18) — 탭 내부라 한 급 낮춘다.
           행 높이 24는 세 탭 공통(탭 전환 시 첫 줄 위치 고정) -->
      <div class="mb-3 flex h-6 shrink-0 items-center justify-between">
        <div class="flex items-center gap-1">
          <Typography variant="title-01-normal-semibold" color="text-gray-900">
            근무일정
          </Typography>
          {#if hasSchedule}
            <Typography variant="body-03-normal-regular" color="text-gray-500">
              (주 {workDayCount}일)
            </Typography>
          {/if}
        </div>

        <button
          onclick={onEditSchedule}
          aria-label="수정"
          class="inline-flex items-center gap-2 text-gray-600 transition-colors hover:text-gray-700"
        >
          <EditIcon />
          <span class="text-body-02-normal-medium">수정</span>
        </button>
      </div>

      <!-- 월간 캘린더 (근무일정 미설정이어도 표시) -->
      <div class="flex-1 min-h-0">
        <WorkScheduleCalendar
          weeklySchedule={weeklySchedule ?? {}}
          {breakTime}
          {scheduleCounts}
          {viewYear}
          {viewMonth}
          {onMonthChange}
          needsSetup={!hasSchedule}
          onAddSchedule={onEditSchedule}
        />
      </div>
    </div>
  </div>
</PermissionGuard>
