<script lang="ts">
  import { untrack } from 'svelte'
  import ZoomControl from '$lib/components/ui/ZoomControl.svelte'
  import Button from '$components/ui/Button.svelte'
  import type { BBox } from '../types'
  import BBoxOverlay from './BBoxOverlay.svelte'
  import Icon from '$components/ui/Icon.svelte'

  interface Props {
    imageUrl?: string
    originalImageUrl?: string
    bboxes: BBox[]
    activeBBoxId: string | null
    /** 생략하면 업로드 UI를 그리지 않는다 (확정된 검사의 조회 모드) */
    onImageUpload?: (file: File) => void
    onBBoxSelect: (bboxId: string) => void
    onBBoxDeselect?: () => void
    onDragStart: (bboxId: string, clientX: number, clientY: number) => void
    onResizeStart: (bboxId: string, handle: string, clientX: number, clientY: number) => void
    onPrevious?: () => void
    onNext?: () => void
    isFirstTab?: boolean
    isLastTab?: boolean
    containerRef?: (el: HTMLDivElement | null) => void
    /**
     * 영역 지정 모드 — 지정 중인 항목의 이름. null이면 평소 모드.
     *
     * 탐지되지 않은 항목에 임상가가 직접 박스를 그려 넣는 경로다. 모드가
     * 켜지면 기존 BBox 조작은 잠기고(잘못 건드리면 다른 항목이 망가진다)
     * 캔버스가 드래그를 사각형으로 받는다.
     */
    drawTargetLabel?: string | null
    onDrawComplete?: (rect: {
      xPercent: number
      yPercent: number
      widthPercent: number
      heightPercent: number
    }) => void
    onDrawCancel?: () => void
    /** 선택한 영역 하나만 제거 (없으면 버튼을 숨긴다) */
    onRemoveSelected?: () => void
  }

  let {
    imageUrl,
    originalImageUrl,
    bboxes,
    activeBBoxId,
    onImageUpload,
    onBBoxSelect,
    onBBoxDeselect,
    onDragStart,
    onResizeStart,
    onPrevious,
    onNext,
    isFirstTab = false,
    isLastTab = false,
    containerRef,
    drawTargetLabel = null,
    onDrawComplete,
    onDrawCancel,
    onRemoveSelected,
  }: Props = $props()

  // 선택한 영역은 Delete/Backspace로도 지운다 — 버튼과 같은 동작.
  // 지정 모드에서는 Esc가 우선이라 걸지 않는다.
  $effect(() => {
    if (!activeBBoxId || drawTargetLabel || !onRemoveSelected) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const el = document.activeElement
      // 입력 중일 때는 가로채지 않는다 (우패널의 셀렉트·텍스트 입력)
      if (el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
      e.preventDefault()
      onRemoveSelected!()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  // --- 영역 지정 (드래그로 새 박스 그리기) ---
  const MIN_DRAW_PERCENT = 1  // 클릭에 가까운 미세 드래그는 무시한다

  let drawStart = $state<{ x: number; y: number } | null>(null)
  let drawCurrent = $state<{ x: number; y: number } | null>(null)

  /** 화면 좌표 → 이미지 컨테이너 대비 percent (BBox와 같은 좌표계) */
  function toPercent(clientX: number, clientY: number) {
    const rect = internalContainerRef?.getBoundingClientRect()
    if (!rect || !rect.width || !rect.height) return { x: 0, y: 0 }
    return {
      x: Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100)),
    }
  }

  let drawPreview = $derived.by(() => {
    if (!drawStart || !drawCurrent) return null
    return {
      xPercent: Math.min(drawStart.x, drawCurrent.x),
      yPercent: Math.min(drawStart.y, drawCurrent.y),
      widthPercent: Math.abs(drawCurrent.x - drawStart.x),
      heightPercent: Math.abs(drawCurrent.y - drawStart.y),
    }
  })

  function handleDrawDown(e: MouseEvent) {
    if (!drawTargetLabel) return
    e.preventDefault()
    const p = toPercent(e.clientX, e.clientY)
    drawStart = { x: p.x, y: p.y }
    drawCurrent = { x: p.x, y: p.y }
  }

  // 드래그는 컨테이너를 벗어나도 이어져야 한다 — 그래서 document에 건다.
  // 모드가 꺼지거나 컴포넌트가 사라지면 정리된다.
  $effect(() => {
    if (!drawStart) return
    function move(e: MouseEvent) {
      const p = toPercent(e.clientX, e.clientY)
      drawCurrent = { x: p.x, y: p.y }
    }
    function up() {
      const rect = drawPreview
      drawStart = null
      drawCurrent = null
      if (
        rect &&
        rect.widthPercent >= MIN_DRAW_PERCENT &&
        rect.heightPercent >= MIN_DRAW_PERCENT
      ) {
        onDrawComplete?.(rect)
      }
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
    return () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
    }
  })

  // 지정 모드는 Esc로 빠져나간다 — 잘못 눌렀을 때 되돌릴 길이 필요하다.
  $effect(() => {
    if (!drawTargetLabel) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      drawStart = null
      drawCurrent = null
      onDrawCancel?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  let fileInputRef: HTMLInputElement | undefined = $state()
  let internalContainerRef: HTMLDivElement | undefined = $state()
  let canvasAreaRef: HTMLDivElement | undefined = $state()
  let isDragOver = $state(false)

  // --- Zoom ---
  const ZOOM_MIN = 0.5
  const ZOOM_MAX = 3.0
  const ZOOM_STEP = 0.25
  let zoomLevel = $state(1.0) // 1.0 = fit to area
  let baseSize = $state<{ width: number; height: number } | null>(null)
  let imageNatural = $state<{ width: number; height: number } | null>(null)

  const displaySize = $derived(
    baseSize
      ? { width: Math.round(baseSize.width * zoomLevel), height: Math.round(baseSize.height * zoomLevel) }
      : null
  )

  function zoomIn() { zoomLevel = Math.min(ZOOM_MAX, +(zoomLevel + ZOOM_STEP).toFixed(2)) }
  function zoomOut() { zoomLevel = Math.max(ZOOM_MIN, +(zoomLevel - ZOOM_STEP).toFixed(2)) }
  function zoomFit() { zoomLevel = 1.0 }

  // --- 원본/전처리 토글 ---
  let showOriginal = $state(false)
  const activeImageUrl = $derived(showOriginal && originalImageUrl ? originalImageUrl : imageUrl)
  const hasOriginal = $derived(!!originalImageUrl && originalImageUrl !== imageUrl)

  const PADDING = 16

  function recalcBaseSize() {
    if (!canvasAreaRef || !imageNatural) return
    const availW = canvasAreaRef.clientWidth - PADDING * 2
    const availH = canvasAreaRef.clientHeight - PADDING * 2
    if (availW <= 0 || availH <= 0) return

    const imgAspect = imageNatural.width / imageNatural.height
    const areaAspect = availW / availH

    if (imgAspect > areaAspect) {
      baseSize = { width: availW, height: availW / imgAspect }
    } else {
      baseSize = { width: availH * imgAspect, height: availH }
    }
  }

  function handleImageLoad(e: Event) {
    const img = e.target as HTMLImageElement
    imageNatural = { width: img.naturalWidth, height: img.naturalHeight }
    recalcBaseSize()
  }

  /**
   * 그림이 바뀌면 줌을 초기화한다.
   *
   * **크기(baseSize)는 여기서 지우지 않는다.** 예전에는 지웠는데, 그러면
   * 컨테이너의 width/height 인라인 스타일이 사라져 한 프레임 동안 크기가
   * 0으로 붕괴했다. 새 이미지의 onload가 와야 다시 계산되므로, 그 사이
   * 이미지가 찌그러졌다 제자리로 튀는 게 보였다 — 사람↔나무처럼 가로세로
   * 비율이 크게 다른 그림을 오갈 때 특히 심했다.
   *
   * 이전 크기를 잠깐 유지하는 편이 낫다. onload에서 새 값으로 덮어쓴다.
   *
   * imageUrl만 의존성이다 — 안에서 쓰는 상태를 읽으면 자기 쓰기에 다시 돈다.
   */
  $effect(() => {
    void imageUrl
    untrack(() => {
      zoomLevel = 1.0
      showOriginal = false
    })
  })

  $effect(() => {
    const handler = () => recalcBaseSize()
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  })

  $effect(() => {
    if (containerRef && internalContainerRef) {
      containerRef(internalContainerRef)
    }
  })

  // --- 마우스 휠 줌 ---
  function handleWheel(e: WheelEvent) {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    if (e.deltaY < 0) zoomIn()
    else zoomOut()
  }

  function handleFileSelect(file: File) {
    if (!onImageUpload) return
    if (file && file.type.startsWith('image/')) {
      onImageUpload(file)
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    isDragOver = true
  }

  function handleDragLeave() {
    isDragOver = false
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    isDragOver = false
    const file = e.dataTransfer?.files[0]
    if (file) handleFileSelect(file)
  }

  function handleClick() {
    fileInputRef?.click()
  }

  function handleFileInputChange(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (file) {
      handleFileSelect(file)
      input.value = ''
    }
  }
</script>

<div class="flex-1 bg-white m-3 rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={canvasAreaRef}
    class="flex-1 min-h-0 relative bg-gray-50 p-4 {zoomLevel > 1 ? 'overflow-auto' : 'overflow-hidden flex items-center justify-center'}"
    onwheel={handleWheel}
  >
    <!-- 선택한 영역 삭제 — 항목 전체를 비우는 '탐지 취소'와 다르다 -->
    {#if activeBBoxId && !drawTargetLabel && onRemoveSelected}
      <div
        class="absolute left-1/2 top-4 z-30 -translate-x-1/2 flex items-center gap-2 rounded-lg bg-white border border-gray-200 px-3 py-1.5 shadow-lg"
      >
        <span class="text-body-03-normal-regular text-gray-500">영역 선택됨</span>
        <button
          onclick={() => onRemoveSelected?.()}
          class="inline-flex items-center gap-1 rounded px-2 py-1 text-body-03-normal-medium text-red-500 hover:bg-red-50 transition-colors"
        >
          <Icon name="delete_outline" size="sm" />
          이 영역 삭제
        </button>
      </div>
    {/if}

    <!-- 영역 지정 안내 — 무엇을 그리는 중인지와 빠져나가는 법 -->
    {#if drawTargetLabel}
      <div
        class="absolute left-1/2 top-4 z-30 -translate-x-1/2 flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-white shadow-lg"
      >
        <Icon name="highlight_alt" size="md" />
        <span class="text-body-03-normal-medium">
          '{drawTargetLabel}' 영역을 드래그해 그리세요
        </span>
        <button
          onclick={() => onDrawCancel?.()}
          class="ml-1 rounded px-2 py-0.5 text-label-02-normal-medium bg-white/15 hover:bg-white/25 transition-colors"
        >
          취소 (Esc)
        </button>
      </div>
    {/if}

    <!-- Nav Left -->
    <button
      onclick={onPrevious}
      disabled={isFirstTab}
      class="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
    >
      <span class="material-icons-round">chevron_left</span>
    </button>

    <!-- Hidden file input -->
    <input
      bind:this={fileInputRef}
      type="file"
      accept="image/*"
      class="hidden"
      onchange={handleFileInputChange}
    />

    {#if !imageUrl && !onImageUpload}
      <!-- 조회 모드에 그림이 없는 칸 — 업로드를 권하지 않고 사실만 알린다 -->
      <div
        class="flex h-full w-full max-w-2xl max-h-125 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200"
      >
        <span class="material-icons-round text-6xl text-gray-300 mb-4">image</span>
        <p class="text-gray-500 font-medium">업로드된 그림이 없습니다</p>
      </div>
    {:else if !imageUrl}
      <!-- Upload area -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        class="w-full h-full max-w-2xl max-h-125 rounded-lg flex flex-col items-center justify-center cursor-pointer border-2 border-dashed transition-all {isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}"
        ondragover={handleDragOver}
        ondragleave={handleDragLeave}
        ondrop={handleDrop}
        onclick={handleClick}
      >
        <span class="material-icons-round text-6xl text-gray-300 mb-4">image</span>
        <p class="text-gray-600 font-medium mb-1">그림을 업로드하세요</p>
        <p class="text-body-03-normal-regular text-gray-400">드래그 앤 드롭 또는 클릭하여 선택</p>
      </div>
    {:else}
      <!-- Image with BBox overlay -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        bind:this={internalContainerRef}
        class="relative {zoomLevel > 1 ? 'm-auto' : ''}"
        style={displaySize ? `width: ${displaySize.width}px; height: ${displaySize.height}px;` : ''}
        onclick={(e) => { if (e.target === e.currentTarget && onBBoxDeselect) onBBoxDeselect() }}
      >
        <!--
          {#key}로 그림마다 새 <img>를 띄운다. 재사용하면 src만 갈리는 동안
          이전 그림이 새 카테고리의 크기 틀에 늘어나 보인다(가로 그림이
          세로 틀에 눌리는 그 순간).

          크기를 아직 모르면(첫 onload 전) w-full/h-full 대신 max-*로 둔다 —
          부모에 인라인 크기가 없을 때 w-full은 0으로 붕괴한다.
        -->
        {#key activeImageUrl}
          <img
            src={activeImageUrl}
            alt="Drawing"
            class="block select-none {displaySize
              ? 'w-full h-full'
              : 'max-w-full max-h-full'}"
            draggable="false"
            onload={handleImageLoad}
          />
        {/key}
        <!-- BBox overlay (원본 모드에서는 좌표가 안 맞으므로 숨김) -->
        {#if !showOriginal}
          <div class="absolute inset-0" style="pointer-events: none">
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div
              class="relative w-full h-full"
              style="pointer-events: auto"
              onclick={(e) => { if (e.target === e.currentTarget && onBBoxDeselect) onBBoxDeselect() }}
            >
              <BBoxOverlay
                {bboxes}
                {activeBBoxId}
                {onBBoxSelect}
                {onDragStart}
                {onResizeStart}
              />
            </div>
          </div>

          <!--
            영역 지정 레이어 — 기존 BBox 위를 덮는다.

            덮는 게 목적이다: 지정 중에 기존 박스를 집어 끌면 엉뚱한 항목의
            좌표가 바뀐다. 이 레이어가 포인터를 전부 받아 그 사고를 막는다.
          -->
          {#if drawTargetLabel}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="absolute inset-0 cursor-crosshair"
              style="pointer-events: auto"
              onmousedown={handleDrawDown}
            >
              {#if drawPreview}
                <div
                  class="absolute border-2 border-blue-500 bg-blue-500/15 pointer-events-none"
                  style="left:{drawPreview.xPercent}%; top:{drawPreview.yPercent}%; width:{drawPreview.widthPercent}%; height:{drawPreview.heightPercent}%"
                ></div>
              {/if}
            </div>
          {/if}
        {/if}
      </div>
    {/if}

    <!-- Nav Right -->
    <button
      onclick={onNext}
      disabled={isLastTab}
      class="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
    >
      <span class="material-icons-round">chevron_right</span>
    </button>
  </div>

  <!-- Bottom controls -->
  <div class="border-t border-gray-200 px-4 py-3 flex items-center justify-between bg-white shrink-0">
    <!-- Left: 원본/전처리 토글 -->
    <div class="flex items-center gap-2">
      <div class="flex items-center bg-gray-100 rounded-lg p-0.5">
        <button
          onclick={() => showOriginal = false}
          class="px-3 py-1.5 text-label-01-normal-medium rounded-md transition-all {!showOriginal ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}"
        >
          전처리
        </button>
        <button
          onclick={() => { if (hasOriginal) showOriginal = true }}
          disabled={!hasOriginal}
          class="px-3 py-1.5 text-label-01-normal-medium rounded-md transition-all {showOriginal ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'} disabled:opacity-30 disabled:cursor-not-allowed"
        >
          원본
        </button>
      </div>
    </div>

    <!-- Right: Zoom + 이미지 변경 -->
    <div class="flex items-center gap-3">
      <!--
        '화면 맞춤' 버튼은 따로 두지 않는다 — 퍼센트를 누르면 화면에 맞춰진다.
        (HTP의 기본 배율 100%가 곧 '영역에 꽉 맞춘 크기'라 두 동작이 같다.)
      -->
      <ZoomControl
        zoom={zoomLevel}
        min={ZOOM_MIN}
        max={ZOOM_MAX}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomReset={zoomFit}
        resetLabel="화면 맞춤"
      />

      <!-- 줌은 조회에도 필요하지만, 이미지 변경은 쓰기라 조회 모드에선 뺀다 -->
      {#if onImageUpload}
        <!--
          툴바의 보조 액션이라 outlineSecondary — 검은 채움(gray-800)은 이
          화면에서 유일하게 진한 면이라 주 CTA처럼 읽혔다. 옆 ZoomControl이
          모두 회색 고스트라 위계도 어긋났다.
        -->
        <Button variant="outlineSecondary" size="sm" icon="image" onclick={handleClick}>
          이미지 변경
        </Button>
      {/if}
    </div>
  </div>
</div>
