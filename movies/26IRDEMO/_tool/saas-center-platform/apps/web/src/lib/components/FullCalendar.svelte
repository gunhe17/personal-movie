<script lang="ts">
  import CalendarDateCell from './CalendarDateCell.svelte'
  import Typography from '@common/components/Typography.svelte'
  import NextCircleChevronIcon from '$lib/assets/NextCircleChevronIcon.svelte'
  import PreviousCircleChevronIcon from '$lib/assets/PreviousCircleChevronIcon.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'

  interface Props {
    selectedDate: Date
  }

  let { selectedDate = $bindable() }: Props = $props()

  let month = $derived(selectedDate && selectedDate.getMonth())
  let year = $derived(selectedDate && selectedDate.getFullYear())

  const prevDaysOfMonth = $derived.by(() => {
    const previousMonth = month === 0 ? 12 : month
    const previousYear = month === 0 ? year - 1 : year
    const previousDayPrefix =
      new Date(previousYear, previousMonth, 1).getDate() -
      new Date(year, month, 1).getDay()
    return Array.from({
      length: new Date(previousYear, previousMonth, 1).getDay()
    }).map((_, idx) => {
      return new Date(year, month, previousDayPrefix + idx)
    })
  })

  const currentDaysOfMonth = $derived.by(() => {
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate()
    return Array.from({ length: daysInCurrentMonth }).map((_, idx) => {
      return new Date(year, month, idx + 1)
    })
  })

  const nextDaysOfMonth = $derived.by(() => {
    const followingMonth = month === 11 ? 0 : month + 1
    const followingYear = month === 11 ? year + 1 : year
    const dateInGrid =
      Math.ceil(
        (new Date(year, month).getDay() +
          new Date(year, month + 1, 0).getDate()) /
          7
      ) * 7
    return Array.from({
      length: dateInGrid - prevDaysOfMonth.length - currentDaysOfMonth.length
    }).map((_, idx) => {
      return new Date(followingYear, followingMonth, idx + 1)
    })
  })

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
</script>

<!-- 캘린더 카드 -->
<div class="rounded-lg border border-gray-200 bg-white p-6">
  <!-- 캘린더 헤더 -->
  <div class="mb-6 flex items-center justify-between">
    <Typography variant="title-02-semibold" color="text-gray-800">
      {`${year}년 ${month + 1}월`}
    </Typography>
    <div class="flex gap-6">
      <Tooltip text="이전 달">
        <button
          onclick={goToPrevious}
          aria-label="이전 달"
          class="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-gray-50"
        >
          <PreviousCircleChevronIcon />
        </button>
      </Tooltip>
      <Tooltip text="다음 달">
        <button
          onclick={goToNext}
          aria-label="다음 달"
          class="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-gray-50"
        >
          <NextCircleChevronIcon />
        </button>
      </Tooltip>
    </div>
  </div>
  <div class="mb-3 grid grid-cols-7 gap-2">
    {#each ['일', '월', '화', '수', '목', '금', '토'] as day, index}
      <div class="flex items-center justify-center">
        <Typography
          variant="body-02-medium"
          color={index === 0
            ? 'text-status-danger'
            : index === 6
              ? 'text-blue-500'
              : 'text-gray-600'}
        >
          {day}
        </Typography>
      </div>
    {/each}
  </div>
  <div class="grid grid-cols-7 gap-2">
    {#each prevDaysOfMonth as date}
      <CalendarDateCell {date} bind:selectedDate disabled />
    {/each}
    {#each currentDaysOfMonth as date}
      <CalendarDateCell {date} bind:selectedDate />
    {/each}
    {#each nextDaysOfMonth as date}
      <CalendarDateCell {date} bind:selectedDate disabled />
    {/each}
  </div>
</div>
