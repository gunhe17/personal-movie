<script lang="ts">
  /**
   * TimelineToolbar — 날짜 이동 컨트롤.
   *
   * TimelineCanvas 안에 있던 것을 밖으로 뺐다. 목록(TimelineList)과
   * 타임라인을 나란히 두면 날짜 컨트롤이 둘 중 하나에만 붙어 있는 게
   * 어색하고, 캔버스 안에 두면 목록 쪽 헤더와 높이가 어긋난다.
   *
   * 캔버스는 hideToolbar로 자기 툴바를 끄고, 바깥이 이 컴포넌트를 쓴다.
   * (타임라인만 단독으로 쓰는 화면은 기존처럼 캔버스 내장 툴바를 쓴다.)
   */
  import { onMount, onDestroy } from 'svelte'
  import { addDays, isSameDay } from '../day-view'
  import Icon from '$components/ui/Icon.svelte'

  interface Props {
    day: Date
    onDayChange?: (day: Date) => void
    class?: string
  }

  let { day, onDayChange, class: className = '' }: Props = $props()

  /**
   * '오늘' 판정에 쓸 현재 시각.
   *
   * `new Date()`를 $derived 안에서 직접 부르면 day가 바뀔 때만 재계산된다 —
   * 대시보드를 자정 너머로 띄워 두면 어제가 된 날짜를 계속 '오늘'로 보고
   * "오늘로" 버튼이 나타나지 않는다. 1분이면 충분하다(초 단위로 갱신할
   * 이유가 없고, 매초 리렌더는 낭비다).
   */
  let now = $state(new Date())
  let timer: ReturnType<typeof setInterval> | undefined
  onMount(() => {
    timer = setInterval(() => (now = new Date()), 60_000)
  })
  onDestroy(() => {
    if (timer) clearInterval(timer)
  })

  const KOREAN_DOW = ['일', '월', '화', '수', '목', '금', '토']
  const pad2 = (n: number) => String(n).padStart(2, '0')

  let dayLabel = $derived(
    `${day.getFullYear()}.${pad2(day.getMonth() + 1)}.${pad2(day.getDate())} ` +
      `(${KOREAN_DOW[day.getDay()]})`
  )
  let isToday = $derived(isSameDay(day, now))
</script>

<div class="flex items-center gap-2 {className}">
  <button
    type="button"
    onclick={() => onDayChange?.(addDays(day, -1))}
    aria-label="이전 날"
    class="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50"
  >
    <Icon name="chevron_left" size="sm" />
  </button>

  <div
    class="min-w-32 text-center text-body-03-normal-semibold tabular-nums text-gray-900"
  >
    {dayLabel}
  </div>

  <button
    type="button"
    onclick={() => onDayChange?.(addDays(day, 1))}
    aria-label="다음 날"
    class="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50"
  >
    <Icon name="chevron_right" size="sm" />
  </button>

  <!--
    "오늘로 이동" — 다른 날을 보고 있을 때만 뜬다.
    🔴 파란 채움(bg-primary-500)을 쓰지 않는다. 날짜 라벨 바로 옆의 파란
       알약은 '이 날이 오늘'이라는 상태 배지로 읽힌다 — 실제로 어제를 보고
       있는데 "'오늘' 배지가 잘못 붙었다"는 오해가 있었다.
       테두리 버튼으로 두면 옆의 이동 버튼들과 같은 결이라 동작으로 읽힌다.
  -->
  {#if !isToday}
    <button
      type="button"
      onclick={() => onDayChange?.(new Date())}
      class="flex h-7 items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 text-label-01-normal-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
    >
      <Icon name="today" size="sm" />
      오늘로
    </button>
  {/if}
</div>
