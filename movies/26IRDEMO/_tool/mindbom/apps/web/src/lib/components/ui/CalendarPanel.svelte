<script lang="ts">
  /**
   * CalendarPanel — 월 단위 날짜 선택 그리드.
   *
   * 시각 규격은 참조 프로젝트의 DatePicker와 맞춘다:
   *   셀 히트영역 40×40 안에 32×32 원, 선택 시 primary 원 + 흰 글씨,
   *   오늘은 숫자 아래 점, 이전/다음 달 날짜는 gray-400.
   *
   * ⚠️ 날짜는 전부 로컬 타임존 기준으로 다룬다. Date를 ISO로 바꿀 때
   *    toISOString()을 쓰면 UTC로 변환되며 KST에서 하루 밀린다.
   */
  import ChevronDown from '$lib/assets/icons/ChevronDown.svelte'

  interface Props {
    /** 선택된 날짜. null이면 선택 없음 */
    selected?: Date | null
    onSelect: (date: Date) => void
  }

  let { selected = null, onSelect }: Props = $props()

  const DAYS = ['일', '월', '화', '수', '목', '금', '토']
  const today = new Date()

  /** 표시 중인 연·월. 선택값이 있으면 그 달부터 연다. */
  // svelte-ignore state_referenced_locally
  let viewYear = $state((selected ?? today).getFullYear())
  // svelte-ignore state_referenced_locally
  let viewMonth = $state((selected ?? today).getMonth())

  function isSameDay(a: Date | null, b: Date | null): boolean {
    if (!a || !b) return false
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    )
  }

  /**
   * 6주(42칸) 고정 그리드. 앞뒤를 이웃 달 날짜로 채워 월을 옮겨도
   * 패널 높이가 흔들리지 않게 한다.
   */
  let cells = $derived.by(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay()
    const out: { date: Date; outside: boolean }[] = []
    for (let i = 0; i < 42; i++) {
      // Date 생성자는 월/일 넘침을 자동으로 이월해준다 (0일 = 전달 말일)
      const date = new Date(viewYear, viewMonth, i - firstDay + 1)
      out.push({ date, outside: date.getMonth() !== viewMonth })
    }
    return out
  })

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1)
    viewYear = d.getFullYear()
    viewMonth = d.getMonth()
  }
</script>

<div
  class="w-aside rounded-xl border border-gray-200 bg-white p-4 shadow-popup"
>
  <!-- 헤더: 연월 + 이전/다음 -->
  <div class="mb-3 flex items-center justify-between">
    <button
      type="button"
      aria-label="이전 달"
      onclick={() => shiftMonth(-1)}
      class="flex size-8 items-center justify-center rounded-lg text-icon-primary transition-colors hover:bg-gray-100"
    >
      <ChevronDown size={18} class="rotate-90" />
    </button>
    <span class="text-body-01-normal-semibold text-gray-900">
      {viewYear}년 {viewMonth + 1}월
    </span>
    <button
      type="button"
      aria-label="다음 달"
      onclick={() => shiftMonth(1)}
      class="flex size-8 items-center justify-center rounded-lg text-icon-primary transition-colors hover:bg-gray-100"
    >
      <ChevronDown size={18} class="-rotate-90" />
    </button>
  </div>

  <!-- 요일 -->
  <div class="grid grid-cols-7">
    {#each DAYS as d}
      <div
        class="flex h-8 items-center justify-center text-label-01-normal-medium text-gray-500"
      >
        {d}
      </div>
    {/each}
  </div>

  <!-- 날짜 -->
  <div class="grid grid-cols-7">
    {#each cells as { date, outside } (date.getTime())}
      {@const isSelected = isSameDay(date, selected)}
      {@const isToday = isSameDay(date, today)}
      <button
        type="button"
        onclick={() => onSelect(date)}
        class="flex size-10 items-center justify-center"
      >
        <span
          class="relative flex size-8 items-center justify-center rounded-full text-body-02-normal-medium transition-colors
            {isSelected
            ? 'bg-primary-500 text-white'
            : outside
              ? 'text-gray-400 hover:bg-gray-100'
              : 'text-gray-800 hover:bg-gray-100'}"
        >
          {date.getDate()}
          {#if isToday && !isSelected}
            <span
              class="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-primary-500"
            ></span>
          {/if}
        </span>
      </button>
    {/each}
  </div>
</div>
