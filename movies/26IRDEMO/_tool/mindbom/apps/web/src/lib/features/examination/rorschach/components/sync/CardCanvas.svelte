
<script lang="ts">
  import { cardImage } from '../../card-images'
  import type { Point, RorschachCard } from '../../types'
  import type { ServerRegion } from '../../actions'
  import { cardToIndex } from '../../constants'
  import {
    loadCardAreas,
    matchAreas,
    type CardAreaData,
    type AreaMatch
  } from '../../area-data'
  import ChevronToggle from '$lib/assets/icons/ChevronToggle.svelte'
  import FreehandDrawing from './FreehandDrawing.svelte'
  import RegionOverlay from './RegionOverlay.svelte'
  import AreaOverlay from './AreaOverlay.svelte'
  import Pen from '$lib/assets/icons/Pen.svelte'
  import Trash from '$lib/assets/icons/Trash.svelte'



  interface Props {
    cardNumber: RorschachCard
    regions: ServerRegion[]
    /** 선택된 **반응** id (§14-7: 위치는 반응당 하나) */
    selectedId: string | null
    isDrawingMode: boolean
    /**
     * 지금 그리는 선의 색 — **그릴 대상 반응의 색**을 넘긴다.
     *
     * 그리는 중과 그려진 뒤의 색이 달라지면, 손을 뗀 순간 색이 갈아치워지는
     * 것으로 보인다. 부르는 쪽이 `colorOf`와 같은 규칙으로 정해야 한다.
     */
    nextRegionColor: string
    /** 조각 색 — 소유 반응에서 파생 (RegionOverlay로 그대로 넘긴다) */
    colorOf: (region: ServerRegion) => string
    /**
     * 선택된 조각이 속한 **반응**의 위치 부호 (§14-7).
     * 부호는 조각이 아니라 반응이 갖는다 — 조각에 두면 1:1인데 값을 담는
     * 자리가 둘이 되어 어긋나도 아무도 모른다.
     */
    areaCode?: string | null
    onDrawEnd: (path: Point[]) => void
    onSelect: (responseId: string | null) => void
    onDeleteRegion: () => void
    /**
     * 조각 위 라벨 — 소유 반응의 표시 번호에서 파생시킨다. `colorOf`와 같이
     * **필수다**: 안 넘기면 조각의 옛 저장 라벨로 떨어져 화면 번호와 갈린다.
     */
    labelOf: (region: ServerRegion) => string
    /**
     * 영역을 고칠 수 있는가 (메모·부호·삭제).
     *
     * 기록은 **실시 단계에서만** 고친다 — 채점하며 원자료를 고치면 무엇을
     * 근거로 채점했는지가 흐려진다. false면 액션 버튼을 아예 그리지 않는다:
     * 눌러도 아무 일이 없는 버튼을 보여주는 것이 더 나쁘다.
     */
    editable?: boolean
    /** 카드 박스 ref — 팝오버가 viewport 좌표를 계산할 때 쓴다 */
    onBoxReady?: (el: HTMLDivElement | null) => void
    /**
     * 줌 배율 (1=100%). 1보다 크면 드래그로 팬할 수 있다.
     *
     * **채점 화면에만 있던 기능을 여기로 흡수했다** — 카드 무대가 두 개
     * (CardCanvas / CodingCanvas)로 갈려 있었는데, 이미지 로딩·`.card-box`·
     * 영역 오버레이가 전부 복제였다. 하나로 합치면서 줌은 옵션이 됐다.
     */
    zoom?: number
    /** 부호 변경 — 소유 반응에 저장된다. */
    onUpdateAreaCode: (areaCode: string | null) => void
  }

  let {
    cardNumber,
    regions,
    selectedId,
    isDrawingMode,
    nextRegionColor,
    colorOf,
    areaCode = null,
    onDrawEnd,
    onSelect,
    onDeleteRegion,
    onUpdateAreaCode,
    labelOf,
    editable = true,
    onBoxReady,
    zoom = 1
  }: Props = $props()

  let imageLoaded = $state(false)
  /**
   * 화면에 실제로 걸린 이미지 — `cardSrc`보다 한 박자 늦는다.
   *
   * 새 카드가 디코딩을 마칠 때까지 이전 값을 유지해서, 전환 중에 빈 프레임이
   * 지나가지 않게 한다(아래 effect 참조).
   */
  let displaySrc = $state('')

  /** 캔버스 박스 ref + 실제 픽셀 크기 (메모 카드 위치 계산용) */
  let boxEl: HTMLDivElement | null = $state(null)

  // --- 줌 · 팬 (zoom > 1일 때만) ---
  let panX = $state(0)
  let panY = $state(0)
  let isPanning = $state(false)
  let dragStart = { x: 0, y: 0, startX: 0, startY: 0 }
  let canPan = $derived(zoom > 1 && !isDrawingMode)

  // 줌이 1로 돌아오면, 그리기에 들어가면 팬을 리셋한다
  $effect(() => {
    if (zoom <= 1 || isDrawingMode) {
      panX = 0
      panY = 0
    }
  })

  function handlePointerDown(e: PointerEvent) {
    if (!canPan || e.button !== 0) return
    isPanning = true
    dragStart = { x: e.clientX, y: e.clientY, startX: panX, startY: panY }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isPanning) return
    panX = dragStart.startX + (e.clientX - dragStart.x)
    panY = dragStart.startY + (e.clientY - dragStart.y)
  }

  function handlePointerUp(e: PointerEvent) {
    if (!isPanning) return
    isPanning = false
    ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
  }

  // 박스 ref를 부모에게 — 팝오버가 조각 좌표를 viewport로 옮길 때 쓴다.
  $effect(() => {
    onBoxReady?.(boxEl)
    return () => onBoxReady?.(null)
  })
  let boxWidth = $state(0)
  let boxHeight = $state(0)

  $effect(() => {
    if (!boxEl) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (r) {
        boxWidth = r.width
        boxHeight = r.height
      }
    })
    ro.observe(boxEl)
    return () => ro.disconnect()
  })

  // 카드 바뀌면 편집 상태 리셋. cardNumber를 의존성으로 추적.
  $effect(() => {
    cardNumber
  })

  let cardSrc = $derived(cardImage(cardNumber))

  /**
   * 카드 전환 — **다 익은 뒤에 갈아끼운다.**
   *
   * 화면의 `<img>`는 `cardSrc`가 아니라 `displaySrc`를 본다. 새 카드가 디코딩을
   * 마칠 때까지 **이전 카드를 그대로 띄워 두고**, 끝나면 한 프레임에 바꾼다.
   *
   * ⚠️ 예전에는 `<img src={cardSrc}>`로 직접 물려 있었다. 캐시된 이미지는
   * 페이드를 건너뛰게 해놨는데도 전환마다 번쩍였는데, 원인이 페이드가 아니라
   * **src 교체 자체**였다. 하나의 <img>에서 src를 갈면 브라우저가 새 이미지를
   * 디코딩하는 동안 빈 프레임이 한 번 지나간다 — `decoding="async"`가 오히려
   * 그 틈을 허용한다. 캐시 판정을 아무리 정확히 해도 이건 안 없어진다.
   *
   * `decode()`는 그 틈을 없애려고 있는 API다. 실패해도(브라우저·포맷 문제)
   * 그냥 보여준다 — 안 보이는 것보다 낫다.
   */
  $effect(() => {
    panX = 0
    panY = 0
    const src = cardSrc
    if (!src) return

    let cancelled = false
    const probe = new Image()
    probe.src = src

    const show = () => {
      if (cancelled) return
      displaySrc = src
      imageLoaded = true
    }
    // decode 실패는 삼킨다 — 첫 화면에서만 플레이스홀더가 잠깐 더 보일 뿐이다.
    const decodeThenShow = () => void probe.decode().then(show, show)

    if (probe.complete && probe.naturalWidth > 0) decodeThenShow()
    else {
      // 아직 한 번도 안 받은 카드 — 이전 카드가 없으면 플레이스홀더가 뜬다.
      if (!displaySrc) imageLoaded = false
      probe.onload = decodeThenShow
      probe.onerror = () => {
        if (!cancelled) imageLoaded = false
      }
    }

    return () => {
      cancelled = true
    }
  })

  let selectedRegion = $derived(
    selectedId !== null
      ? (regions.find((r) => r.response_id === selectedId) ?? null)
      : null
  )

  // === 표준 영역 데이터 (카드별 JSON) ===
  let areaData = $state<CardAreaData | null>(null)
  $effect(() => {
    const idx = cardToIndex(cardNumber)
    let cancelled = false
    loadCardAreas(idx).then((d) => {
      if (!cancelled) areaData = d
    })
    return () => {
      cancelled = true
    }
  })

  /**
   * 선택된 영역의 표준 영역 매칭 후보.
   * card JSON에 동일 코드(D1 좌/우 등)가 여러 path로 들어있으므로
   * code 단위로 dedupe하고 최고 점수만 유지.
   */
  let matchCandidates = $derived.by<AreaMatch[]>(() => {
    if (!selectedRegion || !areaData) return []
    // path가 normalized(0..1)이므로 vbW=vbH=1로 호출
    const raw = matchAreas(selectedRegion.path, 1, 1, areaData.areas, 20)
    const best = new Map<string, AreaMatch>()
    for (const m of raw) {
      const prev = best.get(m.area.code)
      if (!prev || m.score > prev.score) best.set(m.area.code, m)
    }
    return [...best.values()].sort((a, b) => b.score - a.score).slice(0, 5)
  })
  let highlightedAreaCodes = $derived(
    areaCode ? [areaCode] : matchCandidates.map((m) => m.area.code)
  )

  /**
   * 부호가 비어 있고 매칭 후보가 있으면 최고점을 자동 제안한다.
   *
   * ⚠️ 자동 배정은 최고점을 넣는데 그 최고점이 0.02여도 넣는다(§3-4) —
   * 임상가가 확인하고 고칠 수 있어야 한다. 이미 값이 있으면 건드리지 않는다.
   */
  $effect(() => {
    if (!selectedRegion || areaCode) return
    if (matchCandidates.length === 0) return
    onUpdateAreaCode(matchCandidates[0].area.code)
  })

  /** 매칭 메뉴 (영역 선택 시 표시) */
  let isAreaMenuOpen = $state(false)
  let customAreaInput = $state('')

  function toggleAreaMenu(e: MouseEvent) {
    e.stopPropagation()
    isAreaMenuOpen = !isAreaMenuOpen
    customAreaInput = ''
  }

  function pickAreaCode(code: string | null) {
    if (!selectedRegion) return
    onUpdateAreaCode(code === '' ? null : code)
    isAreaMenuOpen = false
  }

  function submitCustomArea() {
    const v = customAreaInput.trim()
    if (!v || !selectedRegion) return
    onUpdateAreaCode(v)
    customAreaInput = ''
    isAreaMenuOpen = false
  }

  function handleCustomKey(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      submitCustomArea()
    } else if (e.key === 'Escape') {
      isAreaMenuOpen = false
    }
  }

  // 선택 영역 바뀌면 메뉴 닫기
  $effect(() => {
    selectedId
    isAreaMenuOpen = false
    customAreaInput = ''
  })

  /** 가상 좌표계 기준 영역 중심 */
  let regionCenterVb = $derived.by(() => {
    if (!selectedRegion || selectedRegion.path.length === 0) return null
    let sx = 0,
      sy = 0
    for (const p of selectedRegion.path) {
      sx += p.x
      sy += p.y
    }
    const n = selectedRegion.path.length
    return { x: sx / n, y: sy / n }
  })

  /** UI 요소(메모 카드, 액션 버튼) 위치 — 박스 픽셀 좌표.
   *  path가 0..1 normalized이고 박스/이미지가 같은 16:9라 letterbox 없음 → 단순 비례. */
  let regionCenterPx = $derived.by(() => {
    if (!regionCenterVb) return null
    return {
      x: regionCenterVb.x * boxWidth,
      y: regionCenterVb.y * boxHeight
    }
  })

  function handleCanvasClick() {
    if (isDrawingMode) return
    if (selectedId !== null) onSelect(null)
  }

  function deleteSelected(e: MouseEvent) {
    e.stopPropagation()
    if (selectedRegion) onDeleteRegion()
  }

</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="flex-1 min-w-0 min-h-0 flex p-4 overflow-hidden"
>
  <!--
    카드 영역 wrapper — 위아래 꽉 채움. 보더/라운드는 여기에.
    안의 .card-box는 16:9로 가운데 fit, 보더 없음.
  -->
  <div
    class="card-stage flex-1 min-w-0 min-h-0 flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200 overflow-hidden"
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerUp}
    style:cursor={canPan ? (isPanning ? 'grabbing' : 'grab') : 'default'}
  >
    <div
      bind:this={boxEl}
      class="card-box relative overflow-hidden"
      onclick={handleCanvasClick}
      style="transform: translate({panX}px, {panY}px) scale({zoom}); transition: {isPanning
        ? 'none'
        : 'transform 0.15s ease-out'};"
    >
    {#if !imageLoaded}
      <div
        class="text-center text-gray-400 absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
      >
        <span class="text-sm">카드 {cardNumber}</span>
      </div>
    {/if}

    <!--
      로드 판정은 위 effect가 한다 — onload를 여기 또 두면 두 경로가 같은
      상태를 써서 캐시된 이미지에서 어긋난다.

      `src`가 `cardSrc`가 아니라 `displaySrc`인 것이 핵심이다: 새 카드가 다
      익은 뒤에 한 번에 갈리므로 전환 중 빈 프레임이 없다. 그래서 opacity를
      오르내릴 일도 없다.
    -->
    {#if displaySrc}
      <img
        src={displaySrc}
        alt="Rorschach Card {cardNumber}"
        class="absolute inset-0 w-full h-full object-contain pointer-events-none"
      />
    {/if}

    <!-- 표준 영역 오버레이 (좌표 검증용 — 평소엔 숨김, 매칭 로직은 계속 동작) -->
    <AreaOverlay
      {areaData}
      highlightedCodes={highlightedAreaCodes}
      visible={false}
    />

    <!-- 영역 그리기 (그리기 모드 시) -->
    {#if isDrawingMode}
      <FreehandDrawing strokeColor={nextRegionColor} {onDrawEnd} />
    {/if}

    <!-- 기존 영역 오버레이 -->
    <RegionOverlay {regions} {selectedId} {onSelect} {labelOf} {colorOf} />

    <!--
      그리기 시작 버튼이 여기 있었는데 없앴다 — **팝오버 안으로 옮겼다**(§14-5).
      한 반응의 위치 정보(부호·영역)가 한 자리에 모여야 하고, 카드 좌상단
      버튼은 그 반응과 떨어져 있어 둘을 잇는 게 눈의 몫이었다.
    -->

    <!-- 선택된 영역 액션 버튼 (메모 편집 / 삭제) — 박스 픽셀 좌표 기준 -->
    {#if editable && selectedRegion && regionCenterPx && !isDrawingMode}
      <div
        class="absolute z-20 flex flex-col items-center gap-1 -translate-x-1/2"
        style="left: {regionCenterPx.x}px; top: {regionCenterPx.y + 30}px;"
      >
        <div class="flex gap-1">
          <button
            onclick={toggleAreaMenu}
            class="h-8 px-2.5 bg-white hover:bg-gray-100 rounded-full shadow-lg flex items-center gap-1 border border-gray-200 text-gray-700 text-xs font-semibold"
            class:!border-primary-400={isAreaMenuOpen}
            class:!text-primary-600={isAreaMenuOpen}
            aria-label="영역 코드 선택"
          >
            {areaCode ?? '?'}
            <ChevronToggle open={isAreaMenuOpen} size={14} strokeWidth={2} />
          </button>
          <button
            onclick={deleteSelected}
            class="w-8 h-8 bg-white hover:bg-red-50 rounded-full shadow-lg flex items-center justify-center border border-gray-200 text-red-500"
            aria-label="영역 삭제"
          >
            <Trash size={14} />
          </button>
        </div>

        <!-- 매칭 메뉴 카드 (세로 배치) -->
        {#if isAreaMenuOpen}
          <div
            class="bg-white rounded-lg shadow-xl border border-gray-200 w-44 overflow-hidden"
            onclick={(e) => e.stopPropagation()}
          >
            <div
              class="px-3 py-2 border-b border-gray-100 flex items-center justify-between"
            >
              <span class="text-label-02-normal-medium text-gray-500"
                >유사 영역</span
              >
              {#if areaCode}
                <button
                  onclick={() => pickAreaCode('')}
                  class="text-caption-01-normal-regular text-gray-400 hover:text-red-500"
                  >지우기</button
                >
              {/if}
            </div>

            {#if matchCandidates.length > 0}
              <div class="max-h-60 overflow-y-auto py-1">
                {#each matchCandidates as m (m.area.code + m.score)}
                  {@const active = areaCode === m.area.code}
                  <button
                    onclick={() => pickAreaCode(m.area.code)}
                    class="w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-primary-50 transition-colors"
                    class:bg-primary-50={active}
                  >
                    <span
                      class="text-xs font-semibold"
                      class:text-primary-600={active}
                      class:text-gray-700={!active}
                    >
                      {m.area.code}
                    </span>
                    <span class="text-caption-01-normal-regular text-gray-400"
                      >{Math.round(m.score * 100)}%</span
                    >
                  </button>
                {/each}
              </div>
            {:else}
              <div class="px-3 py-3 text-label-02-normal-regular text-gray-400 text-center">
                매칭 후보 없음
              </div>
            {/if}

            <div class="border-t border-gray-100 p-2">
              <input
                type="text"
                bind:value={customAreaInput}
                onkeydown={handleCustomKey}
                placeholder="직접 입력 (예: D7)"
                class="w-full text-xs px-2 py-1.5 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-400 focus:border-primary-400"
              />
            </div>
          </div>
        {/if}
      </div>
    {/if}

    {#if isDrawingMode}
      <div
        class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-primary-600 text-white px-4 py-2 rounded-full text-sm shadow-lg flex items-center gap-2 animate-pulse z-30"
      >
        <Pen size={14} />
        영역을 그려주세요
      </div>
    {/if}
    </div>
  </div>
</div>
