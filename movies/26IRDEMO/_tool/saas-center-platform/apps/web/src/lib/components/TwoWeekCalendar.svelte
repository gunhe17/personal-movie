<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import CalendarDateCell from './CalendarDateCell.svelte'
  import PreviousCircleChevronIcon from '$lib/assets/PreviousCircleChevronIcon.svelte'
  import NextCircleChevronIcon from '$lib/assets/NextCircleChevronIcon.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'

  interface Props {
    selectedDate?: Date
    onDateSelect: (date: Date) => void
  }

  let { selectedDate = $bindable(new Date()), onDateSelect }: Props = $props()

  const today = $state(new Date())

  // 캘린더 관련 상태
  let currentStartDate = $state(new Date())

  // 2주치 날짜 생성
  function getTwoWeeksDates(startDate: Date): Date[] {
    const dates: Date[] = []
    const start = new Date(startDate)

    // 일요일로 맞추기
    const dayOfWeek = start.getDay()
    start.setDate(start.getDate() - dayOfWeek)

    for (let i = 0; i < 14; i++) {
      const date = new Date(start)
      date.setDate(start.getDate() + i)
      dates.push(date)
    }
    return dates
  }

  // 오늘 날짜 체크
  function isToday(date: Date): boolean {
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  // 날짜 선택
  function selectDate(date: Date) {
    selectedDate = date
    onDateSelect(date)
  }

  // 이전 2주
  function goToPreviousTwoWeeks() {
    const newDate = new Date(currentStartDate)
    newDate.setDate(newDate.getDate() - 14)
    currentStartDate = newDate
  }

  // 다음 2주
  function goToNextTwoWeeks() {
    const newDate = new Date(currentStartDate)
    newDate.setDate(newDate.getDate() + 14)
    currentStartDate = newDate
  }

  // 년월 표시
  function getYearMonth(date: Date): string {
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월`
  }

  // 날짜가 같은지 비교
  function isSameDate(date1: Date | null, date2: Date): boolean {
    if (!date1) return false
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    )
  }

  let twoWeeksDates = $derived(getTwoWeeksDates(currentStartDate))
</script>

<!-- 캘린더 카드 -->
<div class="rounded-lg border border-gray-200 bg-white p-6">
  <!-- 캘린더 헤더 -->
  <div class="mb-6 flex items-center justify-between">
    <Typography variant="title-02-semibold" color="text-gray-800"
      >{getYearMonth(currentStartDate)}</Typography
    >
    <div class="flex gap-6">
      <Tooltip text="이전 2주">
        <button
          onclick={goToPreviousTwoWeeks}
          aria-label="이전 2주"
          class="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-gray-50"
        >
          <PreviousCircleChevronIcon />
        </button>
      </Tooltip>
      <Tooltip text="다음 2주">
        <button
          onclick={goToNextTwoWeeks}
          aria-label="다음 2주"
          class="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-gray-50"
        >
          <NextCircleChevronIcon />
        </button>
      </Tooltip>
    </div>
  </div>

  <!-- 요일 헤더 -->
  <div class="mb-3 grid grid-cols-7 gap-2">
    {#each ['일', '월', '화', '수', '목', '금', '토'] as day, index}
      <div class="flex items-center justify-center">
        <Typography
          variant="body-02-medium"
          color={index === 0
            ? 'text-status-danger'
            : index === 6
              ? 'text-blue-500'
              : 'text-gray-600'}>{day}</Typography
        >
      </div>
    {/each}
  </div>

  <!-- 날짜 그리드 (2주) -->
  <div class="grid grid-cols-7 gap-2">
    {#each twoWeeksDates as date}
      <CalendarDateCell {date} bind:selectedDate />
    {/each}
  </div>
</div>
