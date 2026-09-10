<script lang="ts">
  import { twMerge } from 'tailwind-merge'
  import { fade } from 'svelte/transition'
  import { onMount } from 'svelte'
  import { browser } from '$app/environment'

  import ScheduleLine from './ScheduleLine.svelte'
  import Typography from '@common/components/Typography.svelte'
  import { portal } from '../../utils/positionPortal'
  import { modalStore } from '../../stores/modal'
  import ScheduleRegisterModal from '../modal/ScheduleRegisterModal.svelte'

  export let today: Date
  export let day: number
  export let year: number
  export let month: number
  export let selectedDate: Date | null
  export let schedulesForThisDay: any[] = []
  export let selectDate:
    | ((event: MouseEvent, day: number) => void)
    | undefined = undefined

  let showPopover = false
  let dayColor: string = ''
  let anchorRect: DOMRect | null = null
  let triggerRef: HTMLElement | null = null

  $: dateToCheck = new Date(year, month, day + 1)
  $: dayOfWeek = dateToCheck.getDay()
  $: isToday = dateToCheck.toDateString() === today.toDateString()

  // 반응형 칩 개수 자동 계산용
  let cellHeight = 0
  let isTabletOrUp = false

  onMount(() => {
    if (!browser) return
    const mq = window.matchMedia('(min-width: 768px)')
    isTabletOrUp = mq.matches
    const handler = (e: MediaQueryListEvent) => (isTabletOrUp = e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  })

  // 칩/gap/링크/헤더 크기 추정 (뷰포트별)
  // 칩은 한 줄 구성(내담자 | 장소)이라 높이 26 — ScheduleLine의 h-6.5와 같은 값
  $: CHIP_HEIGHT = 26
  $: CHIP_GAP = 4
  const LINK_HEIGHT = 16
  $: DAY_HEIGHT = 28 // 날짜 숫자 줄 (min-h-6 + 여유)
  $: CELL_VPAD = 16 // p-1(4) + mt-2(8) + pb-1(4)

  $: totalSchedules = schedulesForThisDay?.length ?? 0

  $: maxVisible = (() => {
    if (totalSchedules === 0) return 0
    if (!cellHeight) return Math.min(totalSchedules, 3)
    const available = cellHeight - DAY_HEIGHT - CELL_VPAD
    const slot = CHIP_HEIGHT + CHIP_GAP
    const fitsAll = Math.floor((available + CHIP_GAP) / slot)
    if (totalSchedules <= fitsAll) return totalSchedules
    // 링크 공간 확보 후 재계산. 오버플로우 시에는 최소 1개 칩은 보이도록 보장
    // (셀이 너무 작아도 "+ 전체보기"만 덩그러니 남는 것 방지)
    const fitsWithLink = Math.floor((available - LINK_HEIGHT + CHIP_GAP) / slot)
    return Math.max(1, fitsWithLink)
  })()

  $: hasOverflow = totalSchedules > maxVisible

  const togglePopover = () => {
    if (!triggerRef) return
    anchorRect = triggerRef.getBoundingClientRect() || null
    showPopover = !showPopover
  }

  const getDayColor = () => {
    if (!selectDate) return 'text-gray-300'
    if (isToday) return 'rounded-full bg-primary-100 text-primary-500'
    if (dayOfWeek === 0) return 'text-[#D23E46]'
    return 'text-gray-700'
  }

  const handleRegisterSchedule = (event: MouseEvent) => {
    selectDate && selectDate(event, day + 1)
    modalStore.open({
      component: ScheduleRegisterModal,
      props: { selectedDate },
      options: {
        customWidth: 540
      }
    })
  }

  $: if (month || year) {
    dayColor = getDayColor()
  }
</script>

<button
  on:click={(event) => handleRegisterSchedule(event)}
  on:contextmenu|preventDefault={(event) =>
    selectDate && selectDate(event, day + 1)}
  bind:clientHeight={cellHeight}
  class={twMerge(
    'h-full p-1 flex flex-col bg-white border-b border-gray-200 duration-200',
    dayOfWeek === 0 ? '' : 'border-r',
    selectDate ? 'cursor-pointer' : 'cursor-not-allowed!'
  )}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="h-full w-full flex flex-col box-border! pb-1">
    <div class="flex gap-1 items-center">
      <Typography
        variant="body-02-regular"
        className="min-w-6 min-h-6 text-center flex-center leading-6 {dayColor}"
        color={dayOfWeek === 0
          ? 'text-[#D23E46]'
          : selectDate
            ? 'text-gray-700'
            : 'text-gray-300'}
      >
        {day + 1}
      </Typography>
      {#if isToday}
        <Typography variant="label-02-normal-regular" color="text-primary-500">
          오늘
        </Typography>
      {/if}
    </div>
    <!-- 칩 영역: 셀 경계 기준 상하좌우 8 균등 (셀 p-1 4 + px-1 4 = 8, 하단은 아래 pb-1과 합쳐 8) -->
    <div
      class="mt-2 px-1 grow min-h-0 overflow-hidden flex flex-col gap-1 min-w-0"
    >
      {#if schedulesForThisDay && schedulesForThisDay.length}
        {#each schedulesForThisDay as schedule, idx (schedule.id)}
          {#if idx < maxVisible}
            <ScheduleLine {schedule} />
          {/if}
        {/each}
      {/if}
    </div>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    {#if hasOverflow}
      <div
        bind:this={triggerRef}
        class="flex justify-start px-0.5 md:px-2 group"
        on:click|preventDefault|stopPropagation={togglePopover}
      >
        <!-- svelte-ignore node_invalid_placement_ssr -->
        <button>
          <span
            class="text-gray-500 text-body-03-normal-regular group-hover:scale-105 duration-200"
          >
            전체보기
          </span>
          {#if showPopover}
            <div
              use:portal={{
                anchor: triggerRef,
                anchorRect,
                offset: 8,
                isFitWidth: false,
                callback: () => {
                  showPopover = false
                }
              }}
              transition:fade
              class={twMerge(
                'w-46 rounded-lg bg-white p-4 space-y-1 ring-1 ring-gray-200 ring-inset shadow-sm z-10'
              )}
            >
              <Typography variant="body-03-medium" color="text-gray-500">
                총
                <span class="text-primary-400">
                  {schedulesForThisDay.length}
                </span>
              </Typography>
              {#each schedulesForThisDay as schedule (schedule.id)}
                <ScheduleLine {schedule} />
              {/each}
            </div>
          {/if}
        </button>
      </div>
    {/if}
  </div>
</button>
