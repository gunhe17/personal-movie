<style>
  .overlay-scroll-container {
    scrollbar-gutter: stable;
    overflow-y: auto;
  }

  .overlay-scroll-container::-webkit-scrollbar {
    width: 6px;
  }

  .overlay-scroll-container::-webkit-scrollbar-track {
    background: transparent;
  }

  .overlay-scroll-container::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
  }
</style>

<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import { DAYS_IN_KOREA, isSameKstDateTime } from '../../utils/date'
  import TimeLine from './TimeLine.svelte'
  import WeeklyScheduleLine from './WeeklyScheduleLine.svelte'
  import { twMerge } from 'tailwind-merge'
  import { modalStore } from '../../stores/modal'
  import ScheduleRegisterModal from '../modal/ScheduleRegisterModal.svelte'
  import type { ScheduleType } from '../../hooks/actions/schedule.action'
  // 변경 요청 오버레이가 얹힌 일정 — 위치·겹침 계산은 ScheduleType과 동일하다
  import type { CalendarSchedule } from '$lib/features/schedule/calendar/change-requests'
  import type { OperatingTimeSummary } from '$lib/hooks/actions/center.action'
  import {
    getOperatingHoursForDate,
    isOperatingHourForDay,
    isBreakHourForDay
  } from '$lib/features/schedule/operating-hours'

  interface Props {
    weekStart: Date
    weekEnd: Date
    selectedDate?: Date | null
    currentSchedules?: CalendarSchedule[]
    operatingTimes?: OperatingTimeSummary[]
    /** true면 자체 스크롤 없이 전체 높이로 펼쳐 페이지(셸) 스크롤에 맡긴다 */
    pageScroll?: boolean
    /**
     * pageScroll 모드의 시간 셀 높이(px). 페이지가 일간 뷰와 동일한 식으로 계산해 넘긴다
     * (자기 높이가 곧 콘텐츠 높이라 컴포넌트 스스로는 뷰포트 기준을 알 수 없다).
     */
    rowHeight?: number
  }

  let {
    weekStart,
    weekEnd,
    selectedDate = $bindable(null),
    currentSchedules = [],
    operatingTimes = [],
    pageScroll = false,
    rowHeight = 0
  }: Props = $props()

  const hours = Array.from({ length: 17 }, (_, i) => i + 8)

  // 일간 뷰(ScheduleTimelineView)와 시간 셀 높이를 동일하게 맞춘다.
  // 일간은 상단 요약 카드가 없어 헤더 아래 전체 영역을 7~24시 18칸으로 균등 분할한다.
  // 주간 캘린더가 받는 높이(availableH) = (일간이 쓰는 전체 영역) − 요약 카드(120).
  // 따라서 한 칸 높이 = (availableH + 요약카드 120 − 헤더 40) / 18. 결과가 남는 높이를 초과하면 스크롤.
  const HEADER_H = 40
  const SUMMARY_H = 120
  const DAILY_SLOT_COUNT = 18
  let availableH = $state(0)

  const rowPx = $derived(
    pageScroll
      ? rowHeight
      : availableH > 0
        ? (availableH + SUMMARY_H - HEADER_H) / DAILY_SLOT_COUNT
        : 0
  )
  const rowsTemplate = $derived(
    rowPx > 0
      ? `repeat(${hours.length}, ${rowPx}px)`
      : `repeat(${hours.length}, 1fr)`
  )

  const dateRange = $derived.by(() => {
    const dates: Date[] = []
    const currentDate = new Date(
      weekStart.getFullYear(),
      weekStart.getMonth(),
      weekStart.getDate()
    )
    const endDate = new Date(
      weekEnd.getFullYear(),
      weekEnd.getMonth(),
      weekEnd.getDate()
    )
    while (currentDate <= endDate) {
      dates.push(new Date(currentDate))
      currentDate.setDate(currentDate.getDate() + 1)
    }
    return dates
  })

  const todayDate = new Date()

  const isOverlap = (a: CalendarSchedule, b: CalendarSchedule) => {
    const aStart = new Date(a.start).getTime()
    const aEnd = new Date(a.end).getTime()
    const bStart = new Date(b.start).getTime()
    const bEnd = new Date(b.end).getTime()
    return Math.max(aStart, bStart) < Math.min(aEnd, bEnd)
  }

  const groupOverlappingSchedules = (schedules: CalendarSchedule[] = []) => {
    const groups: CalendarSchedule[][] = []
    schedules.forEach((res) => {
      let placed = false
      for (const group of groups) {
        if (group.some((existing) => isOverlap(existing, res))) {
          group.push(res)
          placed = true
          break
        }
      }
      if (!placed) {
        groups.push([res])
      }
    })
    return groups
  }

  const handleRegisterSchedule = (date: Date, hour: number) => {
    modalStore.open({
      component: ScheduleRegisterModal,
      props: { selectedDate: date, selectedTime: `${hour}:00` },
      options: { customWidth: 540 }
    })
  }

  function isSameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    )
  }
</script>

<div
  bind:clientHeight={availableH}
  class={pageScroll
    ? 'w-full'
    : 'w-full flex-1 min-h-0 overlay-scroll-container'}
>
  <div class="grid grid-cols-[80px_1fr] w-full min-h-0 bg-white relative">
    <!-- 왼쪽: 시간 컬럼 (고정) -->
    <div class="grid grid-rows-[40px_auto] min-h-0 border-r border-gray-200">
      <!-- 헤더 빈 셀 -->
      <div class="sticky top-0 z-30 bg-white border-b border-gray-200"></div>
      <!-- 시간 슬롯: 일간과 동일한 셀 높이 -->
      <div class="grid" style="grid-template-rows: {rowsTemplate};">
        {#each hours as hour, idx}
          <div
            class={twMerge(
              'relative flex items-center justify-center',
              idx < hours.length - 1 && 'border-b border-gray-200'
            )}
          >
            <Typography color="text-gray-600" variant="body-02-normal-regular">
              {String(hour).padStart(2, '0')}:00
            </Typography>
          </div>
        {/each}
      </div>
    </div>
    <!-- 오른쪽: 요일 컬럼 -->
    <div class="grid grid-cols-7 min-h-0">
      {#each dateRange as date, dateIdx (date.toDateString())}
        {@const isSunday = date.getDay() === 0}
        {@const isDateToday = isSameDay(date, todayDate)}
        {@const dayLabel = DAYS_IN_KOREA[date.getDay()]}
        <div
          class="flex flex-col min-h-0 border-r border-gray-200 last:border-r-0"
        >
          <!-- 헤더 셀 -->
          <div
            class="h-10 shrink-0 sticky top-0 z-30 bg-white border-b border-gray-200 flex items-center gap-2 px-2"
          >
            {#if isDateToday}
              <span class="w-6 h-6 rounded-full bg-primary-50 flex-center">
                <Typography color="text-primary-500" variant="body-02-medium">
                  {date.getDate()}
                </Typography>
              </span>
              <Typography color="text-gray-600" variant="body-02-medium">
                {dayLabel}
              </Typography>
              <Typography
                color="text-primary-500"
                variant="label-02-normal-regular"
              >
                오늘
              </Typography>
            {:else}
              <Typography
                color={isSunday ? 'text-[#D23E46]' : 'text-gray-600'}
                variant="body-02-medium"
              >
                {date.getDate()}
              </Typography>
              <Typography
                color={isSunday ? 'text-[#D23E46]' : 'text-gray-600'}
                variant="body-02-medium"
              >
                {dayLabel}
              </Typography>
            {/if}
          </div>
          <!-- 시간 슬롯: 일간과 동일한 셀 높이 -->
          <div
            class="grid relative"
            style="grid-template-rows: {rowsTemplate};"
          >
            {#each hours as hour}
              {@const filteredSchedules = currentSchedules.filter((r) =>
                isSameKstDateTime(r.start.toString(), date, hour)
              )}
              {@const groupedSchedules =
                groupOverlappingSchedules(filteredSchedules)}
              {@const dayHoursForDate = getOperatingHoursForDate(
                operatingTimes,
                date
              )}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <div
                onclick={() => handleRegisterSchedule(date, hour)}
                class="relative px-1.5 border-b border-gray-200 transition cursor-pointer bg-white hover:bg-gray-50"
              >
                {#each groupedSchedules as group}
                  {#each group as schedule, index}
                    <WeeklyScheduleLine
                      {schedule}
                      {hour}
                      {index}
                      total={group.length}
                    />
                  {/each}
                {/each}
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
    <!-- 현재시간 표시: 헤더 아래 전체 영역 오버레이 -->
    <div class="absolute inset-x-0 top-10 bottom-0 pointer-events-none z-20">
      <TimeLine />
    </div>
  </div>
</div>
