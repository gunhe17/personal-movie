<script lang="ts">
  /**
   * 오늘 일정 캐러셀 — 피그마 대시보드 시안(node 10643:182470).
   *
   * 구성: 타임라인 스크러버(09:00~20:00) + 반원 궤도형 카드 캐러셀.
   * 노브는 기본적으로 현재 시각에 놓이고, 사용자가 앞뒤로 움직였을 때만 회기 시각을 가리키며
   * 그때 트랙에 현재 시각 라인이 함께 뜬다.
   * 스크러버를 끌면 캐러셀이 실시간으로 따라오고, 손을 떼면 가장 가까운 회기로 스냅한다.
   * 좌우 카드를 누르거나 화살표를 눌러 포커스를 옮길 수 있다.
   */
  import { untrack } from 'svelte'

  import Typography from '@common/components/Typography.svelte'
  import PreviousCircleChevronIcon from '$lib/assets/PreviousCircleChevronIcon.svelte'
  import NextCircleChevronIcon from '$lib/assets/NextCircleChevronIcon.svelte'
  import RefreshBackIcon16 from '$lib/assets/RefreshBackIcon16.svelte'
  import DashboardScheduleCard, {
    type ScheduleCardStatus
  } from './DashboardScheduleCard.svelte'

  export interface CarouselItem {
    id: string
    /** 하루 중 위치 (예: 13.5 = 13:30) */
    hour: number
    time: string
    name: string
    birthDate: string | null
    gender: string | null
    roomName: string | null
    programName: string | null
    /** 일정 종류(counseling·assessment 등) — 카드 프로그램 아이콘을 가른다 */
    scheduleType: string | null
    status: ScheduleCardStatus
    /** 예약 시각이 지났는데 완료·취소 정리가 안 된 회기 */
    pendingConfirm: boolean
  }

  interface Props {
    items: CarouselItem[]
    /** 지금 시각 (하루 중 위치). 범위 밖이면 현재시각 마커를 숨긴다 */
    nowHour: number
    /** 초기 포커스 인덱스 */
    initialIndex?: number
    /** 이 카드에서 방금 완료 처리해 일지 작성이 남은 일정 id 집합 */
    noteRequiredIds?: Set<string>
    /** 완료·취소 처리 중인 일정 id */
    busyId?: string | null
    onDetail?: (item: CarouselItem) => void
    onComplete?: (item: CarouselItem) => void
    onCancel?: (item: CarouselItem) => void
    onWriteNote?: (item: CarouselItem) => void
  }

  let {
    items,
    nowHour,
    initialIndex = 0,
    noteRequiredIds = new Set<string>(),
    busyId = null,
    onDetail,
    onComplete,
    onCancel,
    onWriteNote
  }: Props = $props()

  // ── 타임라인 범위 — 시안 기준 09:00~20:00, 벗어나는 일정이 있으면 확장 ──
  const dayStart = $derived(
    Math.min(9, ...items.map((i) => Math.floor(i.hour)))
  )
  const dayEnd = $derived(Math.max(20, ...items.map((i) => Math.ceil(i.hour))))
  const span = $derived(Math.max(1, dayEnd - dayStart))
  const ratioOf = (h: number) =>
    Math.max(0, Math.min(1, (h - dayStart) / span)) * 100

  const pad2 = (n: number) => String(n).padStart(2, '0')
  const fmtHour = (h: number) =>
    `${pad2(Math.floor(h))}:${pad2(Math.round((h % 1) * 60))}`

  // ── 포커스 / 스크럽 상태 ──
  let activeIndex = $state(0) // 마운트 직후 아래 $effect가 initialIndex로 맞춘다
  let scrubHour = $state<number | null>(null)
  let dragging = $state(false)
  let trackEl = $state<HTMLDivElement | null>(null)
  /** 데이터가 늦게 도착하므로 사용자가 만지기 전까지는 initialIndex를 따라간다 */
  let userMoved = $state(false)

  $effect(() => {
    const next = initialIndex
    if (!userMoved) untrack(() => (activeIndex = next))
  })

  const activeItem = $derived(items[activeIndex] ?? items[0])
  /** 현재 시각 기준 회기에서 벗어난 상태 — 되돌아가기 버튼·현재 시각 라인의 조건 */
  const offNow = $derived(userMoved && activeIndex !== initialIndex)
  const nowInRange = $derived(nowHour >= dayStart && nowHour <= dayEnd)
  /** 손대기 전(현재 회기 포커스) 상태 — 노브는 회기 시각이 아니라 현재 시각에 둔다 */
  const followingNow = $derived(scrubHour === null && !offNow && nowInRange)
  const knobHour = $derived(
    followingNow ? nowHour : (scrubHour ?? activeItem?.hour ?? dayStart)
  )
  const knobRatio = $derived(ratioOf(knobHour))
  /** 현재 시각 마커는 노브가 현재 시각을 떠났을 때만 — 겹쳐 찍지 않는다 */
  const nowVisible = $derived(nowInRange && !followingNow)

  // items가 줄어들어 인덱스가 범위를 벗어나면 보정
  $effect(() => {
    if (activeIndex > items.length - 1)
      activeIndex = Math.max(0, items.length - 1)
  })

  function nearestIndex(h: number) {
    let best = 0
    let bestDist = Infinity
    items.forEach((it, i) => {
      const d = Math.abs(it.hour - h)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    })
    return best
  }

  function hourFromEvent(e: PointerEvent) {
    if (!trackEl) return dayStart
    const rect = trackEl.getBoundingClientRect()
    const r = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    return dayStart + r * span
  }

  function scrub(e: PointerEvent) {
    const h = hourFromEvent(e)
    userMoved = true
    scrubHour = h
    activeIndex = nearestIndex(h)
  }

  function focusCard(index: number) {
    userMoved = true
    activeIndex = Math.max(0, Math.min(items.length - 1, index))
  }

  function backToNow() {
    scrubHour = null
    activeIndex = initialIndex
    userMoved = false // 이후 데이터 갱신 시 다시 현재 시각을 따라간다
  }

  function onPointerDown(e: PointerEvent) {
    if (!items.length) return
    dragging = true
    scrub(e)
    e.preventDefault()
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return
    scrub(e)
  }

  function onPointerUp() {
    if (!dragging) return
    dragging = false
    scrubHour = null // 가장 가까운 회기 시각으로 스냅
  }

  // $effect는 브라우저에서만 실행 — SSR 가드 불필요
  $effect(() => {
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  })

  // ── 카드 배치 (피그마 실측 + 반원 궤도) ──
  // 중심 간 거리 ±353 / ±637, 스케일 1 / 0.73 / 0.58, 불투명도 1 / 0.8 / 0.6.
  // 궤도감을 위해 멀어질수록 아래로 내려간다(아치형).
  const OFFSET = [0, 353, 637]
  const SCALE = [1, 0.78, 0.64]
  const OPACITY = [1, 0.8, 0.6]
  const ARC_Y = [0, 12, 32]

  function layout(index: number) {
    const d = index - activeIndex
    const step = Math.min(Math.abs(d), 2)
    return {
      offset: Math.sign(d) * OFFSET[step],
      arcY: ARC_Y[step],
      scale: SCALE[step],
      opacity: Math.abs(d) > 2 ? 0 : OPACITY[step],
      hidden: Math.abs(d) > 2,
      /** 화면 맨 끝 카드는 바깥쪽 가장자리를 알파 마스크로 딤 처리 */
      edge: (step === 2 ? (d < 0 ? 'left' : 'right') : null) as
        | 'left'
        | 'right'
        | null,
      z: 10 - step
    }
  }

  // 카드가 absolute라 무대 높이는 직접 잡는다 — 가장 높은 카드 + 아치 낙차.
  // 푸터가 상태별로(상세 보기 / 확인 버튼 2개 / 일지 작성) 달라 높이가 갈리므로,
  // 상수로 박지 않고 실제 렌더 높이를 재서 맞춘다(타이포·간격을 바꿔도 따라온다).
  let cardHeights = $state<number[]>([])
  const stageHeight = $derived(
    Math.max(240, ...cardHeights.filter((h) => h > 0)) + ARC_Y[ARC_Y.length - 1]
  )

  const EDGE_MASK = {
    left: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.35) 22%, #000 62%)',
    right:
      'linear-gradient(to left, transparent 0%, rgba(0,0,0,0.35) 22%, #000 62%)'
  }
</script>

<!-- 타임라인 바 ↔ 포커스 카드 갭 16.
     바 영역이 -top-2(8)로 떠 있어 실제로 보이는 간격은 16+8 = 24다. -->
<div class="flex flex-col gap-4">
  <!-- ═══ 타임라인 스크러버 ═══ -->
  <!-- pt-6(24): 노브 시각 라벨(h26)이 트랙 위 8 띄워 떠서 상단에 여백이 필요하다. 20 미만이면 라벨이 잘린다 -->
  <!-- -top-2: 레이아웃은 그대로 두고 바 영역만 8 위로 -->
  <div class="relative -top-2 mx-auto w-full max-w-[380px] pt-6">
    <!-- 시간 눈금 — 노브 라벨과 같은 밴드를 쓰므로 겹치는 쪽 눈금은 감춘다 -->
    <div class="flex items-center justify-between">
      <Typography
        variant="label-01-normal-regular"
        color="text-gray-500"
        tag="span"
        className="transition-opacity duration-200 {knobRatio < 14
          ? 'opacity-0'
          : ''}"
      >
        {pad2(dayStart)}:00
      </Typography>
      <Typography
        variant="label-01-normal-regular"
        color="text-gray-500"
        tag="span"
        className="transition-opacity duration-200 {knobRatio > 86
          ? 'opacity-0'
          : ''}"
      >
        {pad2(dayEnd)}:00
      </Typography>
    </div>

    <!-- 트랙 -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      bind:this={trackEl}
      onpointerdown={onPointerDown}
      class="relative mt-2 h-2.5 w-full cursor-pointer rounded-full bg-gray-300"
    >
      <!-- 진행 구간 — 하루의 흐름(낮 → 밤) 그라디언트.
           색띠는 채워진 폭이 아니라 **트랙 전체 폭**에 고정한다(안쪽 div가 트랙 폭).
           폭에 맞춰 늘어나면 오전 10시에도 코럴이 보여 "지금이 저녁"으로 읽힌다 —
           시각이 색을 정해야 하므로, 바는 하루 색띠를 왼쪽부터 걷어내는 식으로 자란다. -->
      <div
        class="absolute inset-y-0 left-0 overflow-hidden rounded-full"
        style="width:{knobRatio}%"
      >
        <!-- 부모 폭이 트랙의 knobRatio%이므로, 그 역수 배(10000/knobRatio %)를 주면
             내부 폭이 정확히 트랙 전체 폭이 된다 — 측정 없이 색띠를 고정한다 -->
        <div
          class="h-full"
          style="width:{knobRatio > 0
            ? 10000 / knobRatio
            : 100}%; background-image: linear-gradient(to right, var(--color-timeline-from) 0%, var(--color-timeline-day) 45%, var(--color-timeline-golden) 75%, var(--color-timeline-to) 100%)"
        ></div>
      </div>

      <!-- 회기 지점 — 노브가 스냅하는 자리. 트랙 '안'의 흰 점이라 트랙 '밖'으로 솟는
           현재 시각 라인과 형태가 갈린다(서로 잡아먹지 않는다). 노브가 물리면 그 위를 덮는다 -->
      {#each items as item (item.id)}
        <span
          class="pointer-events-none absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
          style="left:{ratioOf(item.hour)}%"
          aria-hidden="true"
        ></span>
      {/each}

      <!-- 현재 시각 라인 — 노브가 떠날 땐 즉시 뜨고, 돌아올 땐 노브가 도착할 즈음(350ms 뒤)
           페이드 아웃한다. 언마운트로 툭 사라지면 노브 이동(550ms)과 어긋나 어색하다 -->
      {#if nowInRange}
        <span
          class="pointer-events-none absolute -top-1 h-[18px] w-0.5 -translate-x-1/2 bg-gray-500 transition-opacity motion-reduce:transition-none {nowVisible
            ? 'opacity-100 duration-150'
            : 'opacity-0 delay-[350ms] duration-200'}"
          style="left:{ratioOf(nowHour)}%"
          aria-hidden="true"
        ></span>
      {/if}

      <!-- 노브 + 시각 라벨 -->
      <div
        class="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 {dragging
          ? ''
          : 'ease-spring transition-[left] duration-[550ms]'}"
        style="left:{knobRatio}%"
      >
        <span
          class="block size-5 rounded-full border-[3px] border-white bg-primary-400 shadow-md"
        ></span>
        <span
          class="absolute bottom-[calc(100%+8px)] left-1/2 flex -translate-x-1/2 items-center justify-center whitespace-nowrap rounded-full border border-primary-200 bg-white px-2 py-1.5"
        >
          <Typography
            variant="label-02-normal-medium"
            color="text-primary-500"
            tag="span"
          >
            {fmtHour(knobHour)}
          </Typography>
        </span>
      </div>
    </div>

    <!-- 현재 시각으로 되돌아가기 — 트랙(높이 10) 세로 중앙에 맞춰 오른쪽 바깥에 둔다.
         컨테이너 top → pt-6(24) + 눈금(13) + mt-2(8) = 트랙 상단 45, 중앙 50 -->
    {#if offNow}
      <button
        type="button"
        onclick={backToNow}
        class="absolute left-full top-[50px] ml-4 flex h-8 -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-full border border-gray-200 bg-white px-3 text-body-03-normal-medium text-gray-600 shadow-card transition-colors hover:bg-gray-50"
      >
        <RefreshBackIcon16 />
        현재 시각
      </button>
    {/if}

    <!-- 스크린리더 / 키보드 조작 -->
    <input
      type="range"
      class="sr-only"
      min="0"
      max={Math.max(0, items.length - 1)}
      step="1"
      value={activeIndex}
      aria-label="오늘 일정 이동"
      oninput={(e) => focusCard(Number(e.currentTarget.value))}
    />
  </div>

  <!-- ═══ 캐러셀 ═══ -->
  <div class="relative" style="height:{stageHeight}px">
    {#each items as item, i (item.id)}
      {@const l = layout(i)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        class="ease-spring absolute bottom-8 left-1/2 origin-bottom transition-[translate,scale,opacity] duration-[650ms] motion-reduce:transition-none {l.hidden
          ? 'pointer-events-none'
          : ''} {i === activeIndex ? '' : 'cursor-pointer'}"
        style="translate: calc(-50% + {l.offset}px) {l.arcY}px; scale: {l.scale}; opacity: {l.opacity}; z-index: {l.z};{l.edge
          ? ` mask-image: ${EDGE_MASK[l.edge]}; -webkit-mask-image: ${EDGE_MASK[l.edge]};`
          : ''}"
        aria-hidden={l.hidden}
        onclick={() => focusCard(i)}
        bind:clientHeight={cardHeights[i]}
      >
        <DashboardScheduleCard
          time={item.time}
          name={item.name}
          birthDate={item.birthDate}
          gender={item.gender}
          roomName={item.roomName}
          programName={item.programName}
          scheduleType={item.scheduleType}
          status={item.status}
          focused={i === activeIndex}
          pendingConfirm={item.pendingConfirm && !noteRequiredIds.has(item.id)}
          noteRequired={noteRequiredIds.has(item.id)}
          busy={busyId === item.id}
          onDetail={() => onDetail?.(item)}
          onComplete={() => onComplete?.(item)}
          onCancel={() => onCancel?.(item)}
          onWriteNote={() => onWriteNote?.(item)}
        />
      </div>
    {/each}

    <!-- 좌우 이동 화살표 -->
    {#if items.length > 1}
      <button
        type="button"
        aria-label="이전 일정"
        disabled={activeIndex === 0}
        onclick={() => focusCard(activeIndex - 1)}
        class="absolute left-0 top-1/2 z-20 -translate-y-1/2 rounded-full transition-opacity hover:opacity-80 disabled:pointer-events-none disabled:opacity-0"
      >
        <PreviousCircleChevronIcon />
      </button>
      <button
        type="button"
        aria-label="다음 일정"
        disabled={activeIndex === items.length - 1}
        onclick={() => focusCard(activeIndex + 1)}
        class="absolute right-0 top-1/2 z-20 -translate-y-1/2 rounded-full transition-opacity hover:opacity-80 disabled:pointer-events-none disabled:opacity-0"
      >
        <NextCircleChevronIcon />
      </button>
    {/if}
  </div>
</div>
