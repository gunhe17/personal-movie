<script lang="ts">
  import { cardImageByNumber } from '$lib/features/examination/rorschach/card-images'
  import { RORSCHACH_CARDS } from '$lib/features/examination/rorschach/constants'
  /**
   * 로르샤하 영역 어드민 에디터.
   * 카드 이미지 위에 드래그로 사각형(rectangle) 영역을 정의하고
   * 코드/타입/이름을 붙여 JSON으로 export.
   *
   * URL: /admin/rorschach-areas/1  (카드 번호 1~10)
   */
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { snackbarStore } from '$lib/stores/snackbar'
  import Trash from '$lib/assets/icons/Trash.svelte'
  import ArrowLeft from '$lib/assets/icons/ArrowLeft.svelte'



  type AreaType = 'W' | 'D' | 'Dd' | 'DdS'

  /**
   * 카드별 표준 영역 코드 — 데이터가 정리된 카드만 셀렉트로 제공.
   * 없는 카드는 직접 입력 fallback.
   */
  const CARD_CODES: Record<number, string[]> = {
    1: ['W', 'D1', 'D2', 'D3', 'D4', 'D7', 'Dd21', 'Dd22', 'Dd23', 'Dd24', 'Dd25', 'Dd27', 'Dd28', 'Dd33', 'Dd35', 'DdS26', 'DdS29', 'DdS30', 'DdS31', 'DdS32'],
    2: ['W', 'D1', 'D2', 'D3', 'D4', 'D6', 'Dd21', 'Dd22', 'Dd23', 'Dd24', 'Dd25', 'Dd26', 'Dd27', 'Dd28', 'Dd31', 'DS5', 'DdS29', 'DdS30'],
    3: ['W', 'D1', 'D2', 'D3', 'D5', 'D7', 'D8', 'D9', 'D30', 'Dd21', 'Dd22', 'Dd25', 'Dd26', 'Dd27', 'Dd28', 'Dd29', 'Dd31', 'Dd32', 'Dd33', 'Dd34', 'Dd35', 'Dds23', 'Dds24'],
    4: ['W', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'Dd21', 'Dd22', 'Dd23', 'Dd25', 'Dd26', 'Dd27', 'Dd28', 'Dd30', 'Dd31', 'Dd32', 'Dd33', 'Dds24', 'Dds29'],
    5: ['W', 'D1', 'D4', 'D6', 'D7', 'D9', 'D10', 'Dd22', 'Dd23', 'Dd25', 'Dd26', 'Dd30', 'Dd31', 'Dd32', 'Dd33', 'Dd35', 'DdS29'],
    6: ['W', 'D1', 'D3', 'D4', 'D5', 'D6', 'D8', 'D12', 'Dd22', 'Dd23', 'Dd24', 'Dd25', 'Dd26', 'Dd28', 'Dd31', 'DdS30'],
    7: ['W', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D8', 'D9', 'Dd21', 'Dd22', 'Dd23', 'Dd24', 'Dd25', 'Dd26', 'Dd27', 'Dd28', 'DS7', 'DS10'],
    8: ['W', 'D1', 'D2', 'D4', 'D5', 'D6', 'D7', 'D8', 'Dd21', 'Dd22', 'Dd23', 'Dd24', 'Dd25', 'Dd26', 'Dd27', 'Dd28', 'Dd30', 'Dd31', 'DS3', 'DdS29', 'DdS32'],
    9: ['W', 'D1', 'D2', 'D4', 'D5', 'D8', 'D9', 'D11', 'D12', 'Dd21', 'Dd24', 'Dd25', 'Dd27', 'Dd28', 'Dd30', 'Dd31', 'Dd33', 'Dd34', 'Dd35', 'DS8', 'DdS23', 'DdS29', 'DdS35'],
    10: ['W', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D10', 'D11', 'D12', 'D13', 'D14', 'D15', 'Dd25', 'Dd26', 'Dd27', 'Dd28', 'Dd31', 'Dd32', 'Dd33', 'Dd34', 'Dd35', 'DdS22', 'Dds29', 'Dds30'],
  }

  /** 코드에서 타입 자동 추론 */
  function inferType(code: string): AreaType {
    if (code === 'W') return 'W'
    if (code.startsWith('DdS')) return 'DdS'
    if (code.startsWith('Dd')) return 'Dd'
    if (code.startsWith('D')) return 'D'
    return 'D'
  }

  type Point = { x: number; y: number }
  type DrawMode = 'rect' | 'polygon'

  interface Area {
    /** 클라이언트용 임시 id */
    uid: number
    code: string
    name: string
    type: AreaType
    /** Normalized 0..1 polygon path. 사각형은 4점, 폴리곤은 N점(>=3). */
    path: Point[]
  }

  // --- State ---
  let cardNo = $derived(Number(page.params.cardNo ?? '1'))
  let cardSrc = $derived(cardImageByNumber(Math.max(1, Math.min(10, cardNo))))

  let areas = $state<Area[]>([])
  let selectedUid = $state<number | null>(null)

  // 폼
  let formCode = $state('')
  let formType = $state<AreaType>('D')

  // 그리기 모드
  let drawMode = $state<DrawMode>('rect')

  // 사각형 드래그 상태 (정규화 좌표)
  let isDragging = $state(false)
  let dragStart = $state<Point | null>(null)
  let dragCurrent = $state<Point | null>(null)

  // 폴리곤 작성 상태
  let polygonPoints = $state<Point[]>([])
  let polygonHover = $state<Point | null>(null)
  /** 첫 점 근처 클릭 시 자동 닫기 임계값 (정규화 좌표) */
  const POLYGON_CLOSE_DIST = 0.02

  let canvasEl: HTMLDivElement | null = $state(null)

  /** 현재 작성 중 사각형 (preview) — normalized 0..1 */
  let pendingRect = $derived.by(() => {
    if (!dragStart || !dragCurrent) return null
    const x1 = Math.min(dragStart.x, dragCurrent.x)
    const x2 = Math.max(dragStart.x, dragCurrent.x)
    const y1 = Math.min(dragStart.y, dragCurrent.y)
    const y2 = Math.max(dragStart.y, dragCurrent.y)
    return { x1, x2, y1, y2 }
  })

  let selectedArea = $derived(
    selectedUid !== null ? areas.find(a => a.uid === selectedUid) ?? null : null,
  )

  function getNormPoint(e: PointerEvent): Point | null {
    if (!canvasEl) return null
    const rect = canvasEl.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    }
  }

  function handlePointerDown(e: PointerEvent) {
    const p = getNormPoint(e)
    if (!p) return
    e.preventDefault()

    if (drawMode === 'rect') {
      canvasEl?.setPointerCapture(e.pointerId)
      isDragging = true
      dragStart = p
      dragCurrent = p
      return
    }

    // polygon: 점 추가. 코드는 작성 중에도 비어있을 수 있게 허용하되 finishPolygon 시점에 검증.
    if (polygonPoints.length >= 3) {
      const first = polygonPoints[0]
      const dx = p.x - first.x
      const dy = p.y - first.y
      if (Math.sqrt(dx * dx + dy * dy) < POLYGON_CLOSE_DIST) {
        finishPolygon()
        return
      }
    }
    polygonPoints = [...polygonPoints, p]
  }

  function handlePointerMove(e: PointerEvent) {
    const p = getNormPoint(e)
    if (!p) return
    if (drawMode === 'rect') {
      if (!isDragging) return
      dragCurrent = p
      return
    }
    if (polygonPoints.length > 0) polygonHover = p
  }

  function handlePointerUp(e: PointerEvent) {
    if (drawMode !== 'rect') return
    if (!isDragging) return
    canvasEl?.releasePointerCapture(e.pointerId)
    isDragging = false
    if (!pendingRect) {
      dragStart = null
      dragCurrent = null
      return
    }
    const w = pendingRect.x2 - pendingRect.x1
    const h = pendingRect.y2 - pendingRect.y1
    if (w < 0.005 || h < 0.005) {
      dragStart = null
      dragCurrent = null
      return
    }

    if (!formCode.trim()) {
      snackbarStore.warning('영역 코드를 입력한 뒤 사각형을 그려주세요. (예: D1, Dd22)')
      dragStart = null
      dragCurrent = null
      return
    }

    const area: Area = {
      uid: Date.now() + Math.floor(Math.random() * 1000),
      code: formCode.trim(),
      name: formCode.trim(),
      type: formType,
      path: [
        { x: pendingRect.x1, y: pendingRect.y1 },
        { x: pendingRect.x2, y: pendingRect.y1 },
        { x: pendingRect.x2, y: pendingRect.y2 },
        { x: pendingRect.x1, y: pendingRect.y2 },
      ],
    }
    areas = [...areas, area]
    selectedUid = area.uid
    dragStart = null
    dragCurrent = null
    snackbarStore.success(`${area.code} 추가됨`)
  }

  function handleDblClick(e: MouseEvent) {
    if (drawMode !== 'polygon') return
    e.preventDefault()
    // dblclick은 두 번째 pointerdown 직후에 발화 — 같은 좌표의 점이 중복 추가된 경우 제거.
    if (polygonPoints.length >= 2) {
      const a = polygonPoints[polygonPoints.length - 1]
      const b = polygonPoints[polygonPoints.length - 2]
      if (Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6) {
        polygonPoints = polygonPoints.slice(0, -1)
      }
    }
    finishPolygon()
  }

  function finishPolygon() {
    if (polygonPoints.length < 3) {
      snackbarStore.warning('폴리곤은 최소 3점 필요합니다.')
      return
    }
    if (!formCode.trim()) {
      snackbarStore.warning('영역 코드를 입력한 뒤 완료해주세요.')
      return
    }
    const area: Area = {
      uid: Date.now() + Math.floor(Math.random() * 1000),
      code: formCode.trim(),
      name: formCode.trim(),
      type: formType,
      path: polygonPoints,
    }
    areas = [...areas, area]
    selectedUid = area.uid
    polygonPoints = []
    polygonHover = null
    snackbarStore.success(`${area.code} 추가됨 (${area.path.length}점)`)
  }

  function cancelPolygon() {
    polygonPoints = []
    polygonHover = null
  }

  function undoPolygonPoint() {
    if (polygonPoints.length > 0) polygonPoints = polygonPoints.slice(0, -1)
  }

  function setDrawMode(m: DrawMode) {
    if (drawMode === m) return
    cancelPolygon()
    drawMode = m
  }

  function deleteArea(uid: number) {
    areas = areas.filter(a => a.uid !== uid)
    if (selectedUid === uid) selectedUid = null
  }

  /** 선택된 영역을 dx, dy(normalized 단위) 만큼 이동. 0..1 범위 내로 clamp. */
  function moveSelected(dx: number, dy: number) {
    if (!selectedArea) return
    const minX = Math.min(...selectedArea.path.map(p => p.x))
    const maxX = Math.max(...selectedArea.path.map(p => p.x))
    const minY = Math.min(...selectedArea.path.map(p => p.y))
    const maxY = Math.max(...selectedArea.path.map(p => p.y))
    // 이동 후 박스가 0..1을 벗어나지 않도록 dx/dy clamp
    if (minX + dx < 0) dx = -minX
    if (maxX + dx > 1) dx = 1 - maxX
    if (minY + dy < 0) dy = -minY
    if (maxY + dy > 1) dy = 1 - maxY
    const moved = selectedArea.path.map(p => ({ x: p.x + dx, y: p.y + dy }))
    areas = areas.map(a => (a.uid === selectedArea!.uid ? { ...a, path: moved } : a))
  }

  /** 키보드: 방향키로 1px(=1/박스폭), Shift면 10px 이동. polygon 모드에서는 Enter/Esc/Backspace도 처리. */
  function handleKeydown(e: KeyboardEvent) {
    // 입력 필드 포커스 중이면 무시
    const tgt = e.target as HTMLElement
    if (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA') return

    if (drawMode === 'polygon' && polygonPoints.length > 0) {
      if (e.key === 'Enter') { e.preventDefault(); finishPolygon(); return }
      if (e.key === 'Escape') { e.preventDefault(); cancelPolygon(); return }
      if (e.key === 'Backspace') { e.preventDefault(); undoPolygonPoint(); return }
    }

    if (!selectedArea) return
    const step = e.shiftKey ? 0.01 : 0.001
    let dx = 0, dy = 0
    if (e.key === 'ArrowLeft') dx = -step
    else if (e.key === 'ArrowRight') dx = step
    else if (e.key === 'ArrowUp') dy = -step
    else if (e.key === 'ArrowDown') dy = step
    else return
    e.preventDefault()
    moveSelected(dx, dy)
  }

  $effect(() => {
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  })

  /** 선택된 영역의 좌우대칭(x축 0.5 기준 미러) 영역 생성. 점 순서를 뒤집어 winding 유지. */
  function mirrorSelected() {
    if (!selectedArea) return
    const mirroredPath = [...selectedArea.path].reverse().map(p => ({ x: 1 - p.x, y: p.y }))
    const mirrored: Area = {
      uid: Date.now() + Math.floor(Math.random() * 1000),
      code: selectedArea.code,
      name: selectedArea.name,
      type: selectedArea.type,
      path: mirroredPath,
    }
    areas = [...areas, mirrored]
    selectedUid = mirrored.uid
    snackbarStore.success(`${mirrored.code} 좌우대칭 추가됨`)
  }

  function selectArea(uid: number) {
    selectedUid = uid
    const a = areas.find(x => x.uid === uid)
    if (a) {
      formCode = a.code
      formType = a.type
    }
  }

  function exportJson(): string {
    return JSON.stringify(
      {
        cardNo,
        _note: `Exner CS 카드 ${toRoman(cardNo)} 표준 영역. 좌표는 PNG 전체 0..1 기준.`,
        areas: areas.map(a => ({
          code: a.code,
          name: a.name,
          type: a.type,
          path: a.path,
        })),
      },
      null,
      2,
    )
  }

  function toRoman(n: number): string {
    return RORSCHACH_CARDS[n - 1] ?? String(n)
  }

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(exportJson())
      snackbarStore.success('JSON이 클립보드에 복사되었습니다.')
    } catch {
      snackbarStore.error('클립보드 복사에 실패했습니다.')
    }
  }

  function downloadJson() {
    const blob = new Blob([exportJson()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `card-${cardNo}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  /** 기존 JSON에서 import (붙여넣기) */
  let importText = $state('')
  let showImport = $state(false)
  function applyImport() {
    try {
      const data = JSON.parse(importText)
      if (!data.areas || !Array.isArray(data.areas)) throw new Error('invalid')
      areas = data.areas.map((a: any, i: number) => ({
        uid: Date.now() + i,
        code: a.code ?? '',
        name: a.name ?? '',
        type: (a.type as AreaType) ?? 'D',
        path: a.path ?? [],
      }))
      showImport = false
      importText = ''
      snackbarStore.success(`${areas.length}개 영역 불러옴`)
    } catch {
      snackbarStore.error('JSON 형식이 올바르지 않습니다.')
    }
  }

  function clearAll() {
    if (!confirm('모든 영역을 삭제하시겠습니까?')) return
    areas = []
    selectedUid = null
  }

  // 카드 변경 시 폼/폴리곤 작성 상태 초기화
  $effect(() => {
    cardNo
    selectedUid = null
    cancelPolygon()
  })

  function colorOf(t: AreaType): string {
    return t === 'W' ? '#9CA3AF' : t === 'D' ? '#3B82F6' : t === 'Dd' ? '#8B5CF6' : '#10B981'
  }
</script>

<div class="flex h-screen overflow-hidden bg-gray-100">
  <!-- 좌측 사이드바 -->
  <aside class="w-80 bg-white border-r border-gray-200 flex flex-col shrink-0">
    <header class="p-4 border-b border-gray-200">
      <button
        onclick={() => goto('/examinations')}
        class="mb-2 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={14} />
        나가기
      </button>
      <h1 class="text-lg font-bold text-gray-900">로샤 영역 에디터</h1>
      <p class="text-xs text-gray-500 mt-0.5">카드 {toRoman(cardNo)} ({cardNo}/10)</p>
    </header>

    <!-- 카드 선택 -->
    <div class="p-3 border-b border-gray-200">
      <div class="flex flex-wrap gap-1">
        {#each Array.from({ length: 10 }, (_, i) => i + 1) as n (n)}
          <button
            onclick={() => goto(`/admin/rorschach-areas/${n}`)}
            class="w-8 h-8 text-xs rounded {n === cardNo ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
          >
            {n}
          </button>
        {/each}
      </div>
    </div>

    <!-- 그리기 모드 -->
    <div class="p-3 border-b border-gray-200">
      <h2 class="text-xs font-semibold text-gray-500 uppercase mb-1.5">그리기 모드</h2>
      <div class="flex gap-1">
        <button
          onclick={() => setDrawMode('rect')}
          class="flex-1 px-2 py-1.5 text-xs rounded border {drawMode === 'rect' ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}"
        >
          ▭ 사각형
        </button>
        <button
          onclick={() => setDrawMode('polygon')}
          class="flex-1 px-2 py-1.5 text-xs rounded border {drawMode === 'polygon' ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}"
        >
          ⬡ 폴리곤
        </button>
      </div>

      {#if drawMode === 'polygon' && polygonPoints.length > 0}
        <div class="mt-2 p-2 rounded border border-orange-200 bg-orange-50">
          <p class="text-label-02-normal-semibold text-orange-800">{polygonPoints.length}점 작성 중</p>
          <p class="text-caption-01-normal-regular text-orange-700 mt-0.5 leading-tight">첫 점 클릭/더블클릭/Enter로 완료, Esc 취소, Backspace로 점 되돌리기</p>
          <div class="flex gap-1 mt-1.5">
            <button
              onclick={finishPolygon}
              disabled={polygonPoints.length < 3}
              class="flex-1 px-2 py-1 text-label-02-normal-regular rounded bg-orange-600 text-white disabled:opacity-40 hover:bg-orange-700"
            >완료</button>
            <button
              onclick={cancelPolygon}
              class="flex-1 px-2 py-1 text-label-02-normal-regular rounded border border-orange-300 bg-white text-orange-700 hover:bg-orange-50"
            >취소</button>
          </div>
        </div>
      {/if}
    </div>

    <!-- 입력 폼 -->
    <div class="p-4 border-b border-gray-200 space-y-2">
      <h2 class="text-xs font-semibold text-gray-500 uppercase">영역 정보</h2>
      <div>
        <label for="code" class="block text-label-02-normal-regular text-gray-500 mb-0.5">코드</label>
        <input
          id="code"
          bind:value={formCode}
          oninput={() => { if (formCode) formType = inferType(formCode) }}
          list="card-{cardNo}-codes"
          type="text"
          placeholder="예: D1, Dd22 — 입력 또는 선택"
          autocomplete="off"
          class="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-400"
        />
        {#if CARD_CODES[cardNo]}
          <datalist id="card-{cardNo}-codes">
            {#each CARD_CODES[cardNo] as code (code)}
              <option value={code}></option>
            {/each}
          </datalist>
        {/if}
      </div>
      <div>
        <label for="type" class="block text-label-02-normal-regular text-gray-500 mb-0.5">타입</label>
        <div class="flex gap-1">
          {#each ['W','D','Dd','DdS'] as t}
            <button
              onclick={() => (formType = t as AreaType)}
              class="flex-1 px-2 py-1 text-xs rounded border {formType === t ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}"
            >
              {t}
            </button>
          {/each}
        </div>
      </div>
      <p class="text-caption-01-normal-regular text-gray-400 mt-1">
        {#if drawMode === 'rect'}
          코드 입력 후 카드 위에 드래그로 사각형을 그려주세요
        {:else}
          코드 입력 후 카드 위를 클릭해 점을 찍고, 닫아 폴리곤을 만드세요
        {/if}
      </p>

      {#if selectedArea}
        <button
          onclick={mirrorSelected}
          class="mt-2 w-full px-2 py-1.5 text-xs rounded bg-purple-100 text-purple-700 hover:bg-purple-200 font-medium"
          title="선택한 영역의 좌우대칭 영역을 추가합니다"
        >
          ↔ 좌우대칭 영역 추가
        </button>

        <!-- 위치 미세 조정 (방향키 + 버튼) -->
        <div class="mt-2 p-2 rounded border border-gray-200 bg-gray-50">
          <p class="text-caption-01-normal-regular text-gray-500 mb-1.5 text-center">선택 영역 미세 이동 <span class="text-gray-400">(키보드 ←↑↓→, Shift+키 큰 이동)</span></p>
          <div class="grid grid-cols-3 gap-1 max-w-32 mx-auto">
            <span></span>
            <button
              onclick={() => moveSelected(0, -0.005)}
              class="px-1 py-1 text-xs rounded bg-white border border-gray-200 hover:bg-gray-100"
              aria-label="위로"
            >↑</button>
            <span></span>
            <button
              onclick={() => moveSelected(-0.005, 0)}
              class="px-1 py-1 text-xs rounded bg-white border border-gray-200 hover:bg-gray-100"
              aria-label="왼쪽"
            >←</button>
            <span class="text-caption-01-normal-regular text-gray-400 self-center text-center">·</span>
            <button
              onclick={() => moveSelected(0.005, 0)}
              class="px-1 py-1 text-xs rounded bg-white border border-gray-200 hover:bg-gray-100"
              aria-label="오른쪽"
            >→</button>
            <span></span>
            <button
              onclick={() => moveSelected(0, 0.005)}
              class="px-1 py-1 text-xs rounded bg-white border border-gray-200 hover:bg-gray-100"
              aria-label="아래로"
            >↓</button>
            <span></span>
          </div>
        </div>
      {/if}
    </div>

    <!-- 영역 목록 -->
    <div class="flex-1 overflow-y-auto">
      <div class="p-3 flex items-center justify-between">
        <h2 class="text-xs font-semibold text-gray-500 uppercase">영역 목록 ({areas.length})</h2>
        {#if areas.length > 0}
          <button onclick={clearAll} class="text-caption-01-normal-regular text-red-500 hover:text-red-700">모두 삭제</button>
        {/if}
      </div>
      <ul class="space-y-1 px-2 pb-3">
        {#each areas as a (a.uid)}
          {@const selected = a.uid === selectedUid}
          <li class="flex items-center gap-1 px-2 py-1.5 rounded {selected ? 'bg-primary-50' : 'hover:bg-gray-50'}">
            <span class="w-2 h-2 rounded-full shrink-0" style="background: {colorOf(a.type)};"></span>
            <button
              onclick={() => selectArea(a.uid)}
              class="flex-1 min-w-0 text-left"
            >
              <div class="text-xs font-semibold text-gray-900">
                {a.code}
                <span class="text-caption-01-normal-regular text-gray-400">({a.path.length}점)</span>
              </div>
              <div class="text-caption-01-normal-regular text-gray-500 truncate">{a.name}</div>
            </button>
            <button
              onclick={() => deleteArea(a.uid)}
              class="p-1 text-gray-400 hover:text-red-500"
              aria-label="삭제"
            >
              <Trash size={12} />
            </button>
          </li>
        {/each}
        {#if areas.length === 0}
          <li class="text-label-02-normal-regular text-gray-400 text-center py-4">아직 영역이 없습니다</li>
        {/if}
      </ul>
    </div>

    <!-- 하단 액션 -->
    <div class="p-3 border-t border-gray-200 space-y-2">
      <div class="flex gap-1">
        <button
          onclick={() => (showImport = !showImport)}
          class="flex-1 px-2 py-1.5 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          JSON 가져오기
        </button>
      </div>
      {#if showImport}
        <textarea
          bind:value={importText}
          placeholder="card-N.json 내용 붙여넣기"
          class="w-full h-24 text-caption-01-normal-regular p-2 border border-gray-200 rounded resize-none"
        ></textarea>
        <button
          onclick={applyImport}
          class="w-full px-2 py-1.5 text-xs rounded bg-gray-700 text-white hover:bg-gray-800"
        >
          적용
        </button>
      {/if}
      <div class="flex gap-1">
        <button
          onclick={copyJson}
          disabled={areas.length === 0}
          class="flex-1 px-2 py-1.5 text-xs rounded bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40"
        >
          JSON 복사
        </button>
        <button
          onclick={downloadJson}
          disabled={areas.length === 0}
          class="flex-1 px-2 py-1.5 text-xs rounded border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          다운로드
        </button>
      </div>
    </div>
  </aside>

  <!-- 메인: 카드 캔버스 -->
  <!--
    `card-stage` — `.card-box`가 폭을 높이로도 제한할 수 있게 하는 크기 컨테이너.
    빠뜨리면 상자가 부모 높이를 넘어 납작해지고 영역 좌표가 함께 늘어난다(app.css).
  -->
  <main class="card-stage flex-1 flex items-center justify-center overflow-hidden p-6">
    <div class="card-box relative bg-white rounded-2xl border-2 border-gray-300 overflow-hidden shadow-lg">
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        bind:this={canvasEl}
        class="absolute inset-0 {drawMode === 'rect' ? 'cursor-crosshair' : 'cursor-pointer'} touch-none"
        onpointerdown={handlePointerDown}
        onpointermove={handlePointerMove}
        onpointerup={handlePointerUp}
        onpointercancel={handlePointerUp}
        ondblclick={handleDblClick}
      >
        <img
          src={cardSrc}
          alt="Card {cardNo}"
          class="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
          draggable="false"
        />

        <!-- 기존 영역 — viewBox(1×1)를 박스 전체에 stretch (preserveAspectRatio=none) -->
        <svg
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          class="absolute inset-0 w-full h-full pointer-events-none"
        >
          {#each areas as a (a.uid)}
            {@const c = colorOf(a.type)}
            {@const sel = a.uid === selectedUid}
            <polygon
              points={a.path.map(p => `${p.x},${p.y}`).join(' ')}
              stroke={c}
              fill={c + (sel ? '40' : '15')}
              vector-effect="non-scaling-stroke"
              stroke-width={sel ? 2 : 1}
              opacity={sel ? 1 : 0.7}
            />
          {/each}

          <!-- 작성 중 사각형 (rect 모드) -->
          {#if drawMode === 'rect' && pendingRect}
            <rect
              x={pendingRect.x1}
              y={pendingRect.y1}
              width={pendingRect.x2 - pendingRect.x1}
              height={pendingRect.y2 - pendingRect.y1}
              stroke="#EF4444"
              stroke-dasharray="0.005 0.003"
              fill="#EF444420"
              vector-effect="non-scaling-stroke"
              stroke-width="2"
            />
          {/if}

          <!-- 작성 중 폴리곤 (polygon 모드) -->
          {#if drawMode === 'polygon' && polygonPoints.length > 0}
            {@const previewPts = polygonHover ? [...polygonPoints, polygonHover] : polygonPoints}
            <polyline
              points={previewPts.map(p => `${p.x},${p.y}`).join(' ')}
              stroke="#EF4444"
              stroke-dasharray="0.005 0.003"
              fill={polygonPoints.length >= 3 ? '#EF444420' : 'none'}
              vector-effect="non-scaling-stroke"
              stroke-width="2"
              stroke-linejoin="round"
              stroke-linecap="round"
            />
            {#each polygonPoints as p, i (i)}
              <circle
                cx={p.x}
                cy={p.y}
                r="0.006"
                fill={i === 0 ? '#10B981' : '#EF4444'}
                stroke="white"
                stroke-width="0.002"
                vector-effect="non-scaling-stroke"
              />
            {/each}
          {/if}
        </svg>

        <!-- 영역 라벨 (HTML, 픽셀 폰트) -->
        <div class="absolute inset-0 pointer-events-none">
          {#each areas as a (a.uid)}
            {@const sel = a.uid === selectedUid}
            {@const n = a.path.length || 1}
            {@const cx = a.path.reduce((s, p) => s + p.x, 0) / n}
            {@const cy = a.path.reduce((s, p) => s + p.y, 0) / n}
            <span
              class="absolute -translate-x-1/2 -translate-y-1/2 text-caption-01-normal-semibold select-none"
              class:font-bold={sel}
              style="left: {cx * 100}%; top: {cy * 100}%; color: {sel ? '#1F2937' : colorOf(a.type)};"
            >{a.code}</span>
          {/each}
        </div>
      </div>
    </div>
  </main>
</div>

<style>
</style>
