<script lang="ts">
  import { twMerge } from 'tailwind-merge'
  import { fade, slide } from 'svelte/transition'

  import type { CalendarType } from '$types/schedule'

  import DatePickerCell from './DatePickerCell.svelte'
  import Typography from '@common/components/Typography.svelte'
  import ChevronIcon from '../../assets/ChevronIcon.svelte'
  import { DAYS_IN_KOREA } from '../../utils/date'

  const today = new Date()

  export let sunday: Date
  export let saturday: Date
  export let year: number = today.getFullYear()
  export let month: number = today.getMonth()
  export let isDesktop: boolean = true
  export let selectedDate: Date | null = null
  export let currentMenu: CalendarType = '월'

  let todayRow: number
  let dateRange: Date[] = []
  let calendarHeight: number
  let destYear: number = year
  let isDailySelect: boolean = true
  let calendarElt: HTMLDivElement | null = null

  const getDaysInMonth = (year: number, month: number): number => {
    return new Date(year, month + 1, 0).getDate()
  }

  const goToPrevious = () => {
    if (month === 0) {
      month = 11
      year -= 1
    } else {
      month -= 1
    }
  }

  const goToNext = () => {
    if (month === 11) {
      month = 0
      year += 1
    } else {
      month += 1
    }
  }

  const getStartDay = (year: number, month: number): number => {
    return new Date(year, month, 1).getDay()
  }

  const selectDate = (
    event: MouseEvent,
    day: number,
    prevYear?: number,
    prevMonth?: number
  ) => {
    event.preventDefault()
    const date = new Date(prevYear || year, prevMonth || month, day)
    selectedDate = date
  }

  const generateDates = (startDate: Date, endDate: Date) => {
    const dates: Date[] = []
    let currentDate = new Date(startDate)

    while (currentDate <= endDate) {
      dates.push(new Date(currentDate))
      currentDate.setDate(currentDate.getDate() + 1)
    }

    return dates
  }

  const setYearAndMonth = (m: number) => {
    year = destYear
    month = m
    isDailySelect = true
  }

  $: {
    const baseDate = selectedDate ?? today
    const first = new Date(year, month, 1)
    first.setDate(first.getDate() - getStartDay(year, month))

    const diffDays = Math.floor(
      (baseDate.getTime() - first.getTime()) / (1000 * 60 * 60 * 24)
    )

    todayRow = Math.floor(diffDays / 7) + 1
  }

  $: if (selectedDate) {
    dateRange = generateDates(sunday, saturday)
  }

  $: if (calendarElt && month) {
    calendarHeight = calendarElt.clientHeight
  }

  $: totalDaysInGrid =
    Math.ceil(
      (Array(getStartDay(year, month)).length +
        Array(getDaysInMonth(year, month)).length) /
        7
    ) * 7
</script>

<!-- 텍스트 말줄임이 아니라 컨테이너 클리핑이라 truncate 유지 (truncate-safe 대상 아님) -->
<div
  bind:this={calendarElt}
  class="flex flex-col truncate px-2 py-3 border rounded-lg border-gray-200 bg-white"
>
  <div class="flex-center mb-4">
    <div class="flex items-center gap-3">
      <button on:click={goToPrevious} class="w-6 h-6 flex-center">
        <ChevronIcon
          class="w-1.5 h-2.5 stroke-[#AAAAAA] hover:scale-125 transition"
        />
      </button>
      <Typography variant="title-02-semibold" className="flex items-center">
        {year}년 {month + 1}월
        <!-- svelte-ignore a11y_consider_explicit_label -->
        <button
          on:click={() => (isDailySelect = !isDailySelect)}
          class={twMerge(
            'w-4 h-4 flex-center transition',
            !isDailySelect && 'rotate-180'
          )}
        >
          <svg
            width="8"
            height="6"
            viewBox="0 0 8 6"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M4 6L-4.29138e-07 -2.22545e-07L8 4.76837e-07L4 6Z"
              fill="#737373"
            />
          </svg>
        </button>
      </Typography>
      <button on:click={goToNext} class="w-6 h-6 flex-center">
        <ChevronIcon
          class="w-1.5 h-2.5 rotate-180 stroke-[#AAAAAA] hover:scale-125 transition"
        />
      </button>
    </div>
  </div>
  {#if isDailySelect}
    <div transition:slide class="relative grid grid-cols-7 overflow-hidden">
      <!-- 주별로 선택 필요할때 주석해제 -->
      <!-- {#if isMobile}
        {#each DAYS_IN_KOREA as day, idx}
          {@const selected = isSameDate(selectedDate, dateRange[idx])}
          <button
            class="flex-center flex-col {isDesktop
              ? 'min-w-10'
              : 'min-w-8'} h-14 rounded justify-between p-[10px] {selected
              ? 'text-white bg-primary'
              : 'text-gray-400'} transition-colors"
            on:click={(event) =>
              selectDate(
                event,
                dateRange[idx].getDate(),
                dateRange[idx].getFullYear(),
                dateRange[idx].getMonth()
              )}
          >
            <Typography
              variant={isMobile ? 'body-02-regular' : 'label-02-medium'}
              color={selected ? 'text-white' : 'text-gray-400'}
            >
              {day}
            </Typography>
            {dateRange[idx]?.getDate()}
          </button>
        {/each}
      {:else} -->
      {#each DAYS_IN_KOREA as day}
        <div
          class="flex-center {isDesktop
            ? 'min-w-10 min-h-10'
            : 'min-w-8 min-h-8'}"
        >
          <Typography variant="body-02-medium" color="text-gray-600">
            {day}
          </Typography>
        </div>
      {/each}
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      {#each Array(getStartDay(year, month)) as _, idx}
        {@const previousMonth = month === 0 ? 11 : month - 1}
        {@const previousYear = month === 0 ? year - 1 : year}
        {@const daysInPreviousMonth = getDaysInMonth(
          previousYear,
          previousMonth
        )}
        {@const day = daysInPreviousMonth - getStartDay(year, month) + idx + 1}
        <DatePickerCell
          {today}
          day={day - 1}
          isOtherMonth={true}
          year={previousYear}
          month={previousMonth}
          {selectedDate}
        />
      {/each}
      {#each Array(getDaysInMonth(year, month)) as _, day}
        <DatePickerCell
          {today}
          {day}
          {year}
          {month}
          {selectDate}
          {selectedDate}
        />
      {/each}
      {#each Array(totalDaysInGrid - getStartDay(year, month) - getDaysInMonth(year, month)) as _, idx (idx)}
        {@const followingMonth = month === 11 ? 0 : month + 1}
        {@const followingYear = month === 11 ? year + 1 : year}
        <DatePickerCell
          {today}
          day={idx}
          {selectedDate}
          isOtherMonth={true}
          year={followingYear}
          month={followingMonth}
        />
      {/each}
      {#if currentMenu === '주'}
        {@const roundHeight = isDesktop ? 40 : 32}
        <!-- svelte-ignore element_invalid_self_closing_tag -->
        <div
          transition:fade={{ duration: 300 }}
          class="absolute left-0 right-0 {isDesktop
            ? 'h-10'
            : 'h-8'} ring-1 ring-inset ring-primary rounded-full pointer-events-none"
          style="top: {todayRow * roundHeight}px"
        />
      {/if}
      <!-- {/if} -->
    </div>
  {:else}
    <div
      transition:slide
      class="w-full h-full section-border px-3 py-5 flex-center flex-col"
    >
      <div class="flex items-center gap-3 mb-5">
        <button
          on:click={() => (destYear = destYear - 1)}
          class="w-6 h-6 flex-center"
        >
          <ChevronIcon
            class="w-1.5 h-2.5 stroke-[#AAAAAA] hover:scale-125 transition"
          />
        </button>
        <Typography variant={'body-02-semibold'}>
          {destYear}년
        </Typography>
        <button
          on:click={() => (destYear = destYear + 1)}
          class="w-6 h-6 flex-center"
        >
          <ChevronIcon
            class="w-1.5 h-2.5 rotate-180 stroke-[#AAAAAA] hover:scale-125 transition"
          />
        </button>
      </div>
      <div
        class="grid grid-cols-[repeat(4,40px)] justify-between grid-rows-[repeat(3,40px)] gap-y-3 w-full"
      >
        {#each Array.from({ length: 12 }, (_, i) => i) as m}
          <button
            on:click={() => setYearAndMonth(m)}
            class="flex-center text-label-01-normal-medium text-gray-700 rounded-full hover:bg-primary hover:text-white transition duration-300"
          >
            {m + 1}월
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>
