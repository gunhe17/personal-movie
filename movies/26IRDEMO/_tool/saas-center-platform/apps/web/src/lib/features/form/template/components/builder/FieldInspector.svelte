<script lang="ts">
  import Switch from '$lib/components/Switch.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import TrashIcon from '$lib/assets/TrashIcon.svelte'
  import {
    FIELD_TYPE_SELECT_OPTIONS,
    OPTION_FIELD_TYPES
  } from '../../constants'
  import type { EditableField, Geometry } from './types'
  import AlignIcon from './AlignIcon.svelte'
  import BuilderSelect from './BuilderSelect.svelte'

  let {
    selectionKind,
    selectedCount,
    field = null,
    geometry = null,
    formName,
    formVersion,
    fieldCount,
    elementCount,
    onToggleLabel,
    onAlign,
    onFillWidth,
    onStepZ,
    onBringForward,
    onSendBackward,
    onDelete
  }: {
    selectionKind: 'field' | 'multi' | 'none'
    selectedCount: number
    field: EditableField | null
    geometry: Geometry | null
    formName: string
    formVersion: number
    fieldCount: number
    elementCount: number
    onToggleLabel: () => void
    onAlign: (where: 'left' | 'center' | 'right') => void
    onFillWidth: () => void
    onStepZ: (d: number) => void
    onBringForward: () => void
    onSendBackward: () => void
    onDelete: () => void
  } = $props()

  // 피그마식 — 기본 테두리 없음, 호버/포커스에만 배경·링
  const inputClass =
    'h-8 w-full rounded-md bg-transparent px-2 text-body-03-normal-regular text-gray-800 outline-none transition-colors placeholder:text-placeholder hover:bg-gray-100 focus:bg-gray-50'
  const numClass =
    'h-8 w-full rounded-md bg-transparent px-1.5 text-body-03-normal-regular text-gray-800 outline-none transition-colors hover:bg-gray-100 focus:bg-gray-50'
  const iconBtn =
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary-600'
  const TIP_DELAY = 700

  // 정보 계층 — 영역 > (구분 · 키) > 들여쓰기된 키.
  // 들여쓰기는 단계마다 pl-3(12px), 세로 간격은 영역·구분 사이 gap-3(12px) / 행 사이 gap-2(8px)로 통일한다.
  const sectionCls = 'flex flex-col gap-3 p-4' // 영역 블록 (구분선은 사용처에서 border-t 추가)
  const sectionTitleCls = 'text-body-03-normal-semibold text-gray-800' // 영역 이름
  const groupTitleCls = 'text-body-03-normal-medium text-gray-500' // 구분 이름
  const indentCls = 'flex flex-col gap-2 pl-3' // 한 단계 들여쓴 행 묶음 (키 / 들여쓰기된 키 공용)
  const rowCls = 'flex h-8 items-center gap-2' // 키 행
  const keyCls = 'shrink-0 text-body-03-normal-regular text-gray-400' // 키 이름 (폭은 사용처에서 w-* 지정)

  const aligns = [
    { id: 'left', tip: '왼쪽 정렬', fn: () => onAlign('left') },
    { id: 'center', tip: '가운데 정렬', fn: () => onAlign('center') },
    { id: 'right', tip: '오른쪽 정렬', fn: () => onAlign('right') },
    { id: 'fill', tip: '가로 꽉 채우기', fn: () => onFillWidth() }
  ]
  const zs = [
    { id: 'front', tip: '맨 앞으로', fn: () => onBringForward() },
    { id: 'fwd', tip: '앞으로', fn: () => onStepZ(1) },
    { id: 'back', tip: '뒤로', fn: () => onStepZ(-1) },
    { id: 'rear', tip: '맨 뒤로', fn: () => onSendBackward() }
  ]

  const showOptions = $derived(!!field && OPTION_FIELD_TYPES.has(field.type))

  const pct = (v: number) => Math.round(v * 1000) / 10
  function setGeo(prop: 'x' | 'y' | 'w' | 'h', percent: number) {
    if (geometry) geometry[prop] = Math.max(0, percent) / 100
  }

  // 휠 스크롤로 한 칸 이동
  function moveOption(i: number, dir: -1 | 1) {
    if (!field) return
    const t = i + dir
    if (t < 0 || t >= field.options.length) return
    ;[field.options[i], field.options[t]] = [field.options[t], field.options[i]]
  }

  // 드래그로 자유 재배치 — 드래그 중인 행은 포인터를 따라 움직이고, 삽입 위치에 가로선 표시
  const OPT_GAP = 8 // 선택지 행 간격(gap-2)
  let optionsListEl = $state<HTMLDivElement | null>(null)
  let dragOptIdx = $state<number | null>(null) // 드래그 중인 선택지
  let dropOptIdx = $state<number | null>(null) // 삽입될 위치(0..length)
  let dragDeltaY = $state(0) // 포인터를 따라 이동한 양(px)
  let slotH = $state(0) // 한 행이 차지하는 높이(행 높이 + 간격)
  let suppressTransition = $state(false) // 드롭 직후 트랜지션 억제(원위치→재배치 깜빡임 방지)
  let dragStartY = 0

  function optRows(): HTMLElement[] {
    if (!optionsListEl) return []
    return Array.from(
      optionsListEl.querySelectorAll<HTMLElement>('[data-opt-row]')
    )
  }

  // 포인터 위치 → 삽입 인덱스. offsetTop(레이아웃 기준)이라 transform 영향 없음
  function updateDrop(clientY: number) {
    const rows = optRows()
    if (!optionsListEl || rows.length === 0) return
    const y = clientY - optionsListEl.getBoundingClientRect().top
    let idx = rows.length
    for (let i = 0; i < rows.length; i++) {
      if (y < rows[i].offsetTop + rows[i].offsetHeight / 2) {
        idx = i
        break
      }
    }
    dropOptIdx = idx
  }

  // 노션식: 드래그 중 다른 행을 밀어 출발 자리는 닫고 삽입 자리에 빈 공간을 연다
  function optShift(i: number): number {
    if (dragOptIdx === null || dropOptIdx === null || i === dragOptIdx) return 0
    const from = dragOptIdx
    const to = dropOptIdx > from ? dropOptIdx - 1 : dropOptIdx
    if (to > from && i > from && i <= to) return -slotH
    if (to < from && i >= to && i < from) return slotH
    return 0
  }

  function startOptDrag(e: PointerEvent, idx: number) {
    if (e.button !== 0) return
    e.preventDefault()
    const rows = optRows()
    slotH = (rows[idx]?.offsetHeight ?? 32) + OPT_GAP
    dragOptIdx = idx
    dragStartY = e.clientY
    dragDeltaY = 0
    updateDrop(e.clientY)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onOptDragMove(e: PointerEvent) {
    if (dragOptIdx === null) return
    dragDeltaY = e.clientY - dragStartY
    updateDrop(e.clientY)
  }
  function endOptDrag(e: PointerEvent) {
    if (dragOptIdx === null) return
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* noop */
    }
    const from = dragOptIdx
    const target = dropOptIdx
    // 드롭 직후엔 트랜지션을 꺼서 '원위치로 되돌아갔다가 재배치'되는 깜빡임 없이 놓은 자리에 즉시 확정
    suppressTransition = true
    dragOptIdx = null
    dropOptIdx = null
    dragDeltaY = 0
    if (field && target !== null) {
      const to = from < target ? target - 1 : target // 제거 후 인덱스 보정
      if (to !== from) {
        const [moved] = field.options.splice(from, 1)
        field.options.splice(to, 0, moved)
      }
    }
    requestAnimationFrame(() => (suppressTransition = false))
  }
</script>

<!-- 레이아웃 하위 그룹 (위치·정렬·높이) — 단일/다중 공유. geometry 없으면 위치는 빈 값 -->
{#snippet posTools()}
  <!-- 구분(위치·정렬·높이): 영역 아래로 한 단계 들여쓰고, 구분끼리는 12px 간격 -->
  <div class="flex flex-col gap-3 pl-3">
    <!-- 위치 -->
    <div class="flex flex-col gap-2">
      <p class={groupTitleCls}>위치</p>
      <div class={indentCls}>
        <div class={rowCls}>
          <span class="w-8 {keyCls}">X</span>
          <input
            class={numClass}
            type="number"
            disabled={!geometry}
            value={geometry ? pct(geometry.x) : ''}
            oninput={(e) => setGeo('x', +e.currentTarget.value)}
          />
        </div>
        <div class={rowCls}>
          <span class="w-8 {keyCls}">Y</span>
          <input
            class={numClass}
            type="number"
            disabled={!geometry}
            value={geometry ? pct(geometry.y) : ''}
            oninput={(e) => setGeo('y', +e.currentTarget.value)}
          />
        </div>
        <div class={rowCls}>
          <span class="w-8 {keyCls}">W</span>
          <input
            class={numClass}
            type="number"
            disabled={!geometry}
            value={geometry ? pct(geometry.w) : ''}
            oninput={(e) => setGeo('w', +e.currentTarget.value)}
          />
        </div>
        <div class={rowCls}>
          <span class="w-8 {keyCls}">H</span>
          <input
            class={numClass}
            type="number"
            disabled={!geometry}
            value={geometry ? pct(geometry.h) : ''}
            oninput={(e) => setGeo('h', +e.currentTarget.value)}
          />
        </div>
        <div class={rowCls}>
          <span class="w-8 {keyCls}">Z</span>
          <input
            class={numClass}
            type="number"
            disabled={!geometry}
            value={geometry ? geometry.z : ''}
            oninput={(e) =>
              geometry && (geometry.z = Math.round(+e.currentTarget.value))}
          />
        </div>
      </div>
    </div>

    <!-- 정렬 -->
    <div class="flex flex-col gap-2">
      <p class={groupTitleCls}>정렬</p>
      <div class="flex gap-1.5 pl-3">
        {#each aligns as it (it.id)}
          <Tooltip text={it.tip} delay={TIP_DELAY}>
            <button class={iconBtn} aria-label={it.tip} onclick={it.fn}
              ><AlignIcon id={it.id} class="h-4 w-4" /></button
            >
          </Tooltip>
        {/each}
      </div>
    </div>

    <!-- 높이 -->
    <div class="flex flex-col gap-2">
      <p class={groupTitleCls}>높이</p>
      <div class="flex gap-1.5 pl-3">
        {#each zs as it (it.id)}
          <Tooltip text={it.tip} delay={TIP_DELAY}>
            <button class={iconBtn} aria-label={it.tip} onclick={it.fn}
              ><AlignIcon id={it.id} class="h-4 w-4" /></button
            >
          </Tooltip>
        {/each}
      </div>
    </div>
  </div>
{/snippet}

<aside class="flex w-80 shrink-0 flex-col border-l border-gray-200 bg-white">
  <header class="flex h-12 shrink-0 items-center border-b border-gray-100 px-4">
    <span class="text-body-02-normal-semibold text-gray-700">
      {selectionKind === 'field'
        ? '필드 속성'
        : selectionKind === 'multi'
          ? `${selectedCount}개 선택됨`
          : '양식 정보'}
    </span>
  </header>

  <div class="min-h-0 flex-1 overflow-y-auto">
    {#if selectionKind === 'field' && field}
      <!-- 일반 -->
      <section class={sectionCls}>
        <div class="flex items-center justify-between">
          <p class={sectionTitleCls}>일반</p>
          <button
            onclick={onDelete}
            aria-label="필드 삭제"
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-status-danger-bg hover:text-status-danger"
          >
            <TrashIcon size={20} />
          </button>
        </div>
        <div class={indentCls}>
          <div class={rowCls}>
            <span class="w-20 {keyCls}">타입</span>
            <BuilderSelect
              class="flex-1"
              value={field.type}
              options={FIELD_TYPE_SELECT_OPTIONS}
              onChange={(v) => field && (field.type = v)}
            />
          </div>
          <div class={rowCls}>
            <span class="w-20 {keyCls}">레이블</span>
            <input
              class="{inputClass} flex-1"
              bind:value={field.label}
              placeholder="레이블 입력"
            />
          </div>
          <div class={rowCls}>
            <span class="w-20 {keyCls}">레이블 표시</span>
            <div class="pl-2">
              <Switch
                className="h-5 w-10"
                checked={field.showLabel}
                onclick={onToggleLabel}
                ariaLabel="레이블 표시"
              />
            </div>
          </div>
          <div class={rowCls}>
            <span class="w-20 {keyCls}">필수</span>
            <div class="pl-2">
              <Switch
                className="h-5 w-10"
                bind:checked={field.required}
                ariaLabel="필수 여부"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- 레이아웃 -->
      {#if geometry}
        <section class="{sectionCls} border-t border-gray-100">
          <p class={sectionTitleCls}>레이아웃</p>
          {@render posTools()}
        </section>
      {/if}

      <!-- 선택지 -->
      {#if showOptions}
        <section class="{sectionCls} border-t border-gray-100">
          <p class={sectionTitleCls}>
            선택지 <span class="text-gray-400">({field.options.length})</span>
          </p>
          <div
            bind:this={optionsListEl}
            class="relative flex flex-col gap-2 pl-3"
          >
            {#each field.options as _, optIdx (optIdx)}
              <div
                data-opt-row
                class="flex items-center gap-1.5 rounded-md {dragOptIdx ===
                optIdx
                  ? 'relative z-20 bg-white/70 opacity-70 shadow-md'
                  : suppressTransition
                    ? ''
                    : 'transition-transform duration-150'}"
                style="transform: translateY({dragOptIdx === optIdx
                  ? dragDeltaY
                  : optShift(optIdx)}px)"
              >
                <button
                  type="button"
                  onpointerdown={(e) => startOptDrag(e, optIdx)}
                  onpointermove={onOptDragMove}
                  onpointerup={endOptDrag}
                  onwheel={(e) => {
                    e.preventDefault()
                    moveOption(optIdx, e.deltaY > 0 ? 1 : -1)
                  }}
                  aria-label="선택지 순서 이동 (드래그 또는 스크롤)"
                  title="드래그하거나 스크롤하여 순서를 바꿉니다"
                  class="flex h-8 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-500 active:cursor-grabbing"
                >
                  <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="9" cy="6" r="1.5" /><circle
                      cx="15"
                      cy="6"
                      r="1.5"
                    />
                    <circle cx="9" cy="12" r="1.5" /><circle
                      cx="15"
                      cy="12"
                      r="1.5"
                    />
                    <circle cx="9" cy="18" r="1.5" /><circle
                      cx="15"
                      cy="18"
                      r="1.5"
                    />
                  </svg>
                </button>
                <input
                  class="{inputClass} flex-1"
                  bind:value={field.options[optIdx].label}
                  placeholder="선택지"
                />
                <button
                  onclick={() => field && field.options.splice(optIdx, 1)}
                  aria-label="선택지 삭제"
                  class="flex h-8 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-status-danger-bg hover:text-status-danger"
                >
                  <svg
                    class="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    ><path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    /></svg
                  >
                </button>
              </div>
            {/each}
            <button
              onclick={() =>
                field && field.options.push({ label: '', allowText: false })}
              class="mt-3 self-start text-body-03-normal-medium text-primary-500 transition-colors hover:text-primary-600"
            >
              + 선택지 추가
            </button>
          </div>
        </section>
      {/if}
    {:else if selectionKind === 'multi'}
      <!-- 다중 선택 -->
      <section class={sectionCls}>
        <p class="text-body-03-normal-regular text-gray-500">
          <span class="font-semibold text-gray-800">{selectedCount}개</span> 요소를
          함께 편집합니다.
        </p>
        {@render posTools()}
        <button
          onclick={onDelete}
          class="flex h-8 items-center justify-center gap-2 rounded-md text-body-03-normal-medium text-status-danger transition-colors hover:bg-status-danger-bg"
        >
          <TrashIcon size={18} />
          선택 {selectedCount}개 삭제
        </button>
        <p class="text-body-03-normal-regular text-gray-400">
          Shift / ⌘ 클릭으로 선택을 추가·해제할 수 있어요.
        </p>
      </section>
    {:else}
      <div class="flex flex-col gap-2 p-4">
        <p class="text-body-02-normal-semibold text-gray-800">{formName}</p>
        <div class="flex h-8 items-center gap-2">
          <span class="w-16 shrink-0 text-body-03-normal-regular text-gray-400"
            >버전</span
          >
          <span class="text-body-03-normal-medium text-gray-800"
            >v{formVersion}</span
          >
        </div>
        <div class="flex h-8 items-center gap-2">
          <span class="w-16 shrink-0 text-body-03-normal-regular text-gray-400"
            >필드</span
          >
          <span class="text-body-03-normal-medium text-gray-800"
            >{fieldCount}개</span
          >
        </div>
        <div class="flex h-8 items-center gap-2">
          <span class="w-16 shrink-0 text-body-03-normal-regular text-gray-400"
            >요소</span
          >
          <span class="text-body-03-normal-medium text-gray-800"
            >{elementCount}개</span
          >
        </div>
        <p class="text-body-03-normal-regular text-gray-400">
          요소를 클릭해 선택하고, Shift / ⌘ 클릭으로 복수 선택하세요. 드래그로
          위치를, 모서리 핸들로 크기를 조절합니다.
        </p>
      </div>
    {/if}
  </div>
</aside>
