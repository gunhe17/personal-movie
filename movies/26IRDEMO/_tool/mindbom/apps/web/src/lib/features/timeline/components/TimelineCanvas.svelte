<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import type { TimelineItem } from '../types'
  import { resolveDayRange, timeToX, isSameDay } from '../day-view'
  import { packDay } from '../tracks'
  import TimelineToolbar from './TimelineToolbar.svelte'
  import TimelineAxis from './TimelineAxis.svelte'
  import TimelineBar from './TimelineBar.svelte'
  import TimelineOverflow from './TimelineOverflow.svelte'

  interface Props {
    /** 이미 day에 해당하는 항목만 넘어온다고 가정하지 않는다 — 여기서 한 번 더 거른다 */
    items: TimelineItem[]
    /** 보고 있는 날짜 */
    day: Date
    onItemClick?: (id: string) => void
    /** 날짜 이동 요청 — 호출부가 해당 날짜 데이터를 받아 day를 갱신한다 */
    onDayChange?: (day: Date) => void
    /** 빈 상태의 '새 검사 등록' — 호출부가 등록 모달을 띄운다 */
    onCreateExam?: () => void
    /** 막대 영역 높이(px). 대시보드처럼 세로 예산이 정해진 화면에서 줄여 쓴다. */
    bodyHeight?: number
    /** 목록과 상호 강조 — 같은 항목을 가리키는 카드에 ring을 준다 */
    hoveredId?: string | null
    onHover?: (id: string | null) => void
    /** 툴바(날짜 이동)를 숨긴다 — 목록과 나란히 둘 때 바깥이 툴바를 가진다 */
    hideToolbar?: boolean
  }

  let {
    items,
    day,
    onItemClick,
    onDayChange,
    onCreateExam,
    bodyHeight = 200,
    hoveredId = null,
    onHover,
    hideToolbar = false
  }: Props = $props()

  const CARD_WIDTH = 170
  const CARD_HEIGHT = 56
  const TRACK_GAP = 8
  const PADDING_Y = 16
  const MIN_STAGGER = 56
  /** 카드가 쌓일 수 있는 최대 트랙 수 */
  const MAX_TRACKS = 2
  /** 접힘 칩 전용 행 — 카드 트랙 아래에 붙는다 */
  const CHIP_HEIGHT = 24

  let viewportWidth = $state(0)

  // '지금' 표시는 1분 단위로 충분하다.
  // 1초마다 갱신하면 매초 전체 레이아웃(패킹 포함)이 다시 계산된다.
  let now = $state(new Date())
  let nowTimer: ReturnType<typeof setInterval> | undefined
  onMount(() => {
    nowTimer = setInterval(() => (now = new Date()), 60_000)
  })
  onDestroy(() => {
    if (nowTimer) clearInterval(nowTimer)
  })

  let dayItems = $derived(items.filter((i) => isSameDay(i.when.anchorAt, day)))
  let range = $derived(resolveDayRange(dayItems, day))

  // 오늘을 보고 있을 때만 '지금' 선을 그린다
  let nowForDay = $derived(isSameDay(now, day) ? now : null)

  let packed = $derived(
    packDay(dayItems, (t) => timeToX(t, range, viewportWidth), {
      cardWidthPx: CARD_WIDTH,
      minGapPx: 4,
      maxTracks: MAX_TRACKS,
      viewportWidth,
      minStaggerPx: MIN_STAGGER
    })
  )

  // 위에서부터 채운다 — 시선이 위→아래로 흐르도록.
  function trackTop(track: number): number {
    return PADDING_Y + track * (CARD_HEIGHT + TRACK_GAP)
  }

  // 칩 행은 실제로 쓰인 카드 트랙 바로 아래 — 트랙이 1개뿐이면 위로 당긴다
  let chipTop = $derived(
    PADDING_Y + packed.trackCount * (CARD_HEIGHT + TRACK_GAP)
  )

  let nowX = $derived(nowForDay ? timeToX(nowForDay, range, viewportWidth) : 0)
  let nowVisible = $derived(
    nowForDay != null &&
      nowForDay.getTime() >= range.start.getTime() &&
      nowForDay.getTime() <= range.end.getTime()
  )

  // 날짜 라벨·'오늘로' 판정은 TimelineToolbar가 갖는다 — 여기서 다시 적지 않는다.
</script>

<div class="flex flex-col">
  <!--
    Toolbar — 마크업을 여기 두지 않고 TimelineToolbar를 쓴다.
    대시보드처럼 목록과 나란히 둘 때는 바깥이 툴바를 갖고(hideToolbar),
    타임라인만 단독으로 쓰는 화면은 여기서 그린다. 두 곳에 같은 버튼을
    복붙해 두면 한쪽만 고쳐져 모양이 갈린다.
  -->
  {#if !hideToolbar}
    <TimelineToolbar {day} {onDayChange} class="border-b border-gray-200 px-4 py-3" />
  {/if}

  <div
    bind:clientWidth={viewportWidth}
    class="relative"
    style="height: {bodyHeight}px"
    role="region"
    aria-label="검사 일정 타임라인"
  >
    {#if dayItems.length === 0}
      <div class="flex h-full flex-col items-center justify-center text-center">
        <p class="text-base font-medium text-gray-700">여유로운 하루입니다</p>
        <p class="mt-1 text-sm text-gray-400">예정된 검사가 없습니다</p>
        <button
          type="button"
          onclick={() => onCreateExam?.()}
          class="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
        >
          새 검사 등록
        </button>
      </div>
    {:else if viewportWidth > 0}
      <!-- 지금 선 -->
      {#if nowVisible}
        <div
          class="pointer-events-none absolute inset-y-0 z-10 w-px bg-red-500/50"
          style="left: {nowX}px"
        ></div>
      {/if}

      {#each packed.placed as p (p.item.id)}
        <TimelineBar
          item={p.item}
          left={p.left}
          top={trackTop(p.track)}
          width={CARD_WIDTH}
          height={CARD_HEIGHT}
          onClick={onItemClick}
          highlighted={hoveredId === p.item.id}
          {onHover}
        />
      {/each}

      {#each packed.overflow as group (group.left)}
        <TimelineOverflow
          items={group.items}
          left={group.left}
          top={chipTop}
          width={CARD_WIDTH}
          height={CHIP_HEIGHT}
          onClick={onItemClick}
        />
      {/each}
    {/if}
  </div>

  <!-- 일정이 없어도 축은 그린다 — 빈 화면만 뜨면 어느 날을 보고 있는지 감이 없다.
       (검사가 없는 날은 resolveDayRange가 09~18시 기본축을 준다) -->
  {#if viewportWidth > 0}
    <TimelineAxis {range} {viewportWidth} now={nowForDay} />
  {/if}
</div>
