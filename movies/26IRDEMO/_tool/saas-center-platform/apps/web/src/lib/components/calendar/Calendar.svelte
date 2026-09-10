<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import { DAYS_IN_KOREA, getDaysInMonth } from '../../utils/date'
  import CalendarCell from './CalendarCell.svelte'
  import { twMerge } from 'tailwind-merge'
  import type { ScheduleMapType } from '../../hooks/actions/schedule.action'

  export let today: Date
  export let year: number
  export let monthlySchdule: ScheduleMapType
  export let month: number
  export let selectedDate: Date | null = null
  /** true면 뷰포트에 맞추지 않고 고정 셀 높이로 펼쳐 페이지(셸) 스크롤에 맡긴다 */
  export let pageScroll: boolean = false

  const PAGE_SCROLL_ROW_PX = 144

  let menuX: number = 0
  let menuY: number = 0
  let calendarHeight: number
  let screenHeight: number = 0
  let rightClickedDate: Date | null
  let calendarElt: HTMLDivElement | null = null

  // 월요일 시작 기준 offset (월=0, 화=1, ..., 일=6)
  const getStartDay = (year: number, month: number): number => {
    const day = new Date(year, month, 1).getDay()
    return day === 0 ? 6 : day - 1
  }

  // 월요일부터 시작하는 요일 배열
  const DAYS_FROM_MONDAY = ['월', '화', '수', '목', '금', '토', '일']

  const adjustMenuPosition = (event: MouseEvent) => {
    menuX = event.clientX
    menuY = event.clientY

    if (menuY + 150 > screenHeight) {
      menuY = screenHeight - 150
    }
  }

  const selectDate = (
    event: MouseEvent,
    day: number,
    prevYear?: number,
    prevMonth?: number
  ) => {
    event.preventDefault()
    const date = new Date(prevYear || year, prevMonth || month, day)
    if (event.button === 2) {
      adjustMenuPosition(event)
      rightClickedDate = date
    } else {
      selectedDate = date
      rightClickedDate = null
    }
  }

  const toDateKey = (year: number, month: number, day: number) => {
    const y = year
    const m = String(month + 1).padStart(2, '0')
    const d = String(day).padStart(2, '0')

    return `${y}-${m}-${d}`
  }

  $: if (calendarElt && month) {
    calendarHeight = calendarElt.clientHeight
  }

  $: totalDaysInGrid =
    Math.ceil((getStartDay(year, month) + getDaysInMonth(year, month)) / 7) * 7

  $: totalRows = totalDaysInGrid / 7
</script>

<div
  bind:this={calendarElt}
  class={pageScroll ? 'w-full' : 'h-full overflow-hidden'}
>
  <div
    class={pageScroll
      ? 'grid grid-cols-7 [&>button:nth-last-child(-n+7)]:border-b-0'
      : 'grid grid-cols-7 h-full overflow-hidden [&>button:nth-last-child(-n+7)]:border-b-0'}
    style={pageScroll
      ? `grid-template-rows: 40px repeat(${totalRows}, ${PAGE_SCROLL_ROW_PX}px)`
      : `grid-template-rows: 40px repeat(${totalRows}, minmax(0, 1fr))`}
  >
    {#each DAYS_FROM_MONDAY as day, idx}
      <div
        class={twMerge(
          'flex items-center p-1 bg-white border-b border-r border-gray-200',
          idx === 6 && 'border-r-0'
        )}
      >
        <!-- 날짜 숫자(CalendarCell)와 같은 좌측 기준·같은 24px 박스로 맞춘다 -->
        <Typography
          variant="body-02-medium"
          className="min-w-6 text-center"
          color={idx === 6 ? 'text-[#D23E46]' : 'text-gray-500'}
        >
          {day}
        </Typography>
      </div>
    {/each}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    {#each Array(getStartDay(year, month)) as _, idx}
      {@const previousMonth = month === 0 ? 11 : month - 1}
      {@const previousYear = month === 0 ? year - 1 : year}
      {@const daysInPreviousMonth = getDaysInMonth(previousYear, previousMonth)}
      {@const day = daysInPreviousMonth - getStartDay(year, month) + idx}
      {@const dayString = toDateKey(previousYear, previousMonth, day)}
      {@const schedules = monthlySchdule[dayString]}
      <CalendarCell
        {today}
        {day}
        {selectedDate}
        year={previousYear}
        month={previousMonth}
        schedulesForThisDay={schedules}
      />
    {/each}
    {#each Array(getDaysInMonth(year, month)) as _, day}
      {@const dayString = toDateKey(year, month, day + 1)}
      {@const schedules = monthlySchdule[dayString]}
      <CalendarCell
        {today}
        {day}
        {year}
        {month}
        {selectDate}
        {selectedDate}
        schedulesForThisDay={schedules}
      />
    {/each}
    {#each Array(totalDaysInGrid - getStartDay(year, month) - getDaysInMonth(year, month)) as _, idx (idx)}
      {@const followingMonth = month === 11 ? 0 : month + 1}
      {@const followingYear = month === 11 ? year + 1 : year}
      <CalendarCell
        {today}
        day={idx}
        {selectedDate}
        year={followingYear}
        month={followingMonth}
        schedulesForThisDay={[]}
      />
    {/each}
  </div>
</div>
