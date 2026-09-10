<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import ArrowBackIcon from '$root/src/lib/assets/ArrowBackIcon.svelte'
  import type {
    FormSchema,
    FormField,
    FormElement,
    FormFieldOption
  } from '$lib/hooks/actions/form.action'
  import { FIELD_TYPE_LABELS, OPTION_FIELD_TYPES } from '../../constants'
  import { orderedFieldKeys } from '../../schema-utils'
  import type { EditableField, Geometry } from './types'
  import FieldPreview from './FieldPreview.svelte'
  import FieldInspector from './FieldInspector.svelte'
  import FieldAddModal from './FieldAddModal.svelte'
  import BuilderContextMenu from './BuilderContextMenu.svelte'

  let {
    initialSchema,
    name,
    version,
    onSave,
    onCancel
  }: {
    initialSchema: FormSchema
    name: string
    version: number
    onSave: (schema: FormSchema) => Promise<void>
    onCancel: () => void
  } = $props()

  const BOARD_W = 640
  const BOARD_H = Math.round(640 * 1.414)
  const MARGIN = 0.06
  const clamp = (v: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, v))
  const r4 = (v: number) => Math.round(v * 10000) / 10000

  function defaultHeight(ftype: string, nOptions: number): number {
    if (ftype === 'radio' || ftype === 'checkbox_group')
      return r4(0.04 + 0.022 * Math.max(nOptions, 2))
    if (ftype === 'textarea') return 0.1
    if (ftype === 'signature' || ftype === 'file' || ftype === 'image')
      return 0.08
    return 0.05
  }

  // ---- canonical 스키마 → 편집 모델 (값 요소 + 라벨 요소 분리) ----
  function parse(schema: FormSchema): {
    flds: EditableField[]
    g: Record<string, Geometry>
    lg: Record<string, Geometry>
  } {
    const valueEl: Record<string, FormElement> = {}
    const labelEl: Record<string, FormElement> = {}
    for (const el of schema.elements ?? []) {
      const k = el.field_refs?.[0]
      if (!k) continue
      if (el.widget === 'label') {
        if (!labelEl[k]) labelEl[k] = el
      } else if (!valueEl[k]) {
        valueEl[k] = el
      }
    }
    const keys = orderedFieldKeys(schema)
    const flds: EditableField[] = []
    const g: Record<string, Geometry> = {}
    const lg: Record<string, Geometry> = {}
    let y = 0.04
    let z = 0
    for (const key of keys) {
      const f = schema.fields[key]
      if (!f) continue
      const hasLabel = !!labelEl[key]
      flds.push({
        key,
        type: f.type,
        label: f.label,
        required: f.required,
        options: (f.options ?? []).map((o) => ({
          label: o.label,
          allowText: !!o.allow_text
        })),
        showLabel: hasLabel
      })
      const ve = valueEl[key]
      if (ve) {
        g[key] = {
          x: ve.rect[0],
          y: ve.rect[1],
          w: ve.rect[2],
          h: ve.rect[3],
          z: ve.z
        }
        z = Math.max(z, ve.z)
      } else {
        const h = defaultHeight(f.type, (f.options ?? []).length)
        g[key] = { x: 0.08, y, w: 0.84, h, z: ++z }
        y += h + 0.015
      }
      if (hasLabel) {
        const le = labelEl[key]
        lg[key] = {
          x: le.rect[0],
          y: le.rect[1],
          w: le.rect[2],
          h: le.rect[3],
          z: le.z
        }
      }
    }
    return { flds, g, lg }
  }

  function rect(gm: Geometry): [number, number, number, number] {
    const x = clamp(gm.x, 0, 1)
    const y = clamp(gm.y, 0, 1)
    return [
      r4(x),
      r4(y),
      r4(clamp(gm.w, 0.01, 1 - x)),
      r4(clamp(gm.h, 0.01, 1 - y))
    ]
  }

  function buildSchema(): FormSchema {
    const fieldsObj: Record<string, FormField> = {}
    const elements: FormElement[] = []
    for (const f of fields) {
      const fd: FormField = {
        type: f.type as FormField['type'],
        label: f.label,
        required: f.required
      }
      if (OPTION_FIELD_TYPES.has(f.type)) {
        const opts: FormFieldOption[] = f.options
          .filter((o) => o.label.trim() !== '')
          .map((o) => ({
            value: o.label,
            label: o.label,
            allow_text: o.allowText
          }))
        if (opts.length) fd.options = opts
      }
      fieldsObj[f.key] = fd
      const gm = geom[f.key]
      if (gm)
        elements.push({
          id: f.key,
          page: 1,
          rect: rect(gm),
          z: gm.z,
          widget: f.type,
          field_refs: [f.key]
        })
      const lm = labelGeom[f.key]
      if (f.showLabel && lm) {
        elements.push({
          id: `${f.key}__label`,
          page: 1,
          rect: rect(lm),
          z: lm.z,
          widget: 'label',
          field_refs: [f.key],
          text: f.label
        })
      }
    }
    return { pages: initialSchema.pages ?? [], fields: fieldsObj, elements }
  }

  function getMaxFieldNumber(schema: FormSchema): number {
    let max = 0
    for (const key of Object.keys(schema.fields ?? {})) {
      const m = key.match(/^q(\d+)/)
      if (m) max = Math.max(max, parseInt(m[1]))
    }
    return max
  }

  // ---- 상태 ----
  const _init = parse(initialSchema)
  let fields = $state<EditableField[]>(_init.flds)
  let geom = $state<Record<string, Geometry>>(_init.g)
  let labelGeom = $state<Record<string, Geometry>>(_init.lg)
  let selectedKeys = $state<string[]>([])
  let showAddModal = $state(false)
  let ctxMenu = $state<{ x: number; y: number } | null>(null)
  let saving = $state(false)
  let fieldCounter = getMaxFieldNumber(initialSchema) + 1

  let boardEl: HTMLDivElement | undefined
  let drag:
    | {
        mode: 'move'
        sx: number
        sy: number
        items: {
          ref: Geometry
          ox: number
          oy: number
          ow: number
          oh: number
        }[]
      }
    | {
        mode: 'resize'
        sx: number
        sy: number
        ref: Geometry
        ow: number
        oh: number
      }
    | null = null

  // ---- 파생 ----
  const singleKey = $derived(selectedKeys.length === 1 ? selectedKeys[0] : null)
  const singleIdx = $derived.by(() => {
    if (!singleKey) return -1
    const k = singleKey
    return fields.findIndex((f) => f.key === k)
  })
  const singleField = $derived(singleIdx >= 0 ? fields[singleIdx] : null)
  const singleGeometry = $derived(singleKey ? (geom[singleKey] ?? null) : null)
  const selectionKind = $derived(
    selectedKeys.length === 0
      ? 'none'
      : selectedKeys.length === 1
        ? 'field'
        : 'multi'
  )

  function isSelected(key: string): boolean {
    return selectedKeys.includes(key)
  }

  function maxZ(): number {
    let z = 0
    for (const k in geom) z = Math.max(z, geom[k].z)
    return z
  }
  function minZ(): number {
    let z = Infinity
    for (const k in geom) z = Math.min(z, geom[k].z)
    return z === Infinity ? 0 : z
  }

  // ---- 선택 ----
  function pickField(key: string, additive: boolean) {
    if (additive) {
      selectedKeys = selectedKeys.includes(key)
        ? selectedKeys.filter((k) => k !== key)
        : [...selectedKeys, key]
    } else if (!selectedKeys.includes(key)) {
      selectedKeys = [key]
    }
  }
  function clearSelection() {
    selectedKeys = []
  }

  // ---- 구조 변경 ----
  function addField(type: string) {
    const key = `q${fieldCounter++}`
    const h = defaultHeight(type, 2)
    let bottom = 0.04
    for (const k in geom)
      bottom = Math.max(bottom, geom[k].y + geom[k].h + 0.015)
    const y = clamp(bottom, 0, 1 - h)
    fields.push({
      key,
      type,
      label: '',
      required: false,
      options: OPTION_FIELD_TYPES.has(type)
        ? [
            { label: '', allowText: false },
            { label: '', allowText: false }
          ]
        : [],
      showLabel: false
    })
    geom[key] = { x: 0.08, y, w: 0.84, h, z: maxZ() + 1 }
    selectedKeys = [key]
  }

  function toggleLabel(key: string) {
    const f = fields.find((x) => x.key === key)
    if (!f) return
    f.showLabel = !f.showLabel
    if (f.showLabel) {
      const g = geom[key]
      labelGeom[key] = {
        x: g.x,
        y: clamp(g.y - 0.028, 0, 1),
        w: Math.min(g.w, 0.5),
        h: 0.02,
        z: g.z
      }
    } else {
      delete labelGeom[key]
    }
  }

  function deleteSelected() {
    for (const key of [...selectedKeys]) {
      const idx = fields.findIndex((f) => f.key === key)
      if (idx >= 0) fields.splice(idx, 1)
      delete geom[key]
      delete labelGeom[key]
    }
    selectedKeys = []
  }

  // ---- 일괄 레이아웃 (선택 전체) ----
  function alignSelected(where: 'left' | 'center' | 'right') {
    for (const key of selectedKeys) {
      const g = geom[key]
      if (!g) continue
      const nx =
        where === 'left'
          ? MARGIN
          : where === 'center'
            ? Math.max(0, (1 - g.w) / 2)
            : Math.max(0, 1 - g.w - MARGIN)
      const dx = nx - g.x
      g.x = nx
      const lg = labelGeom[key]
      if (lg) lg.x = clamp(lg.x + dx, 0, 1 - lg.w)
    }
  }
  function fillWidthSelected() {
    for (const key of selectedKeys) {
      const g = geom[key]
      if (g) {
        g.x = MARGIN
        g.w = 1 - 2 * MARGIN
      }
    }
  }
  function syncLabelZ(key: string) {
    const g = geom[key]
    const lg = labelGeom[key]
    if (g && lg) lg.z = g.z
  }
  function stepZSelected(d: number) {
    for (const key of selectedKeys) {
      if (geom[key]) {
        geom[key].z += d
        syncLabelZ(key)
      }
    }
  }
  function bringSelectedForward() {
    const base = maxZ()
    selectedKeys.forEach((key, i) => {
      if (geom[key]) {
        geom[key].z = base + 1 + i
        syncLabelZ(key)
      }
    })
  }
  function sendSelectedBackward() {
    const base = minZ()
    selectedKeys.forEach((key, i) => {
      if (geom[key]) {
        geom[key].z = base - 1 - i
        syncLabelZ(key)
      }
    })
  }

  // ---- 드래그 / 리사이즈 ----
  function norm(e: PointerEvent) {
    const r = boardEl!.getBoundingClientRect()
    return {
      nx: (e.clientX - r.left) / r.width,
      ny: (e.clientY - r.top) / r.height
    }
  }
  // 우클릭 컨텍스트 메뉴 — 미선택 요소면 선택 후 메뉴 오픈
  function onContextMenu(e: MouseEvent, key: string) {
    e.preventDefault()
    e.stopPropagation()
    if (!selectedKeys.includes(key)) selectedKeys = [key]
    ctxMenu = { x: e.clientX, y: e.clientY }
  }

  function startMove(e: PointerEvent, key: string) {
    if (!boardEl) return
    e.stopPropagation()
    if (e.button !== 0) return // 좌클릭만 드래그 (우클릭은 컨텍스트 메뉴)
    const additive = e.shiftKey || e.metaKey || e.ctrlKey
    pickField(key, additive)
    if (additive) return // 보조키 클릭 = 선택 토글만 (드래그 없음)
    const { nx, ny } = norm(e)
    const items: {
      ref: Geometry
      ox: number
      oy: number
      ow: number
      oh: number
    }[] = []
    for (const k of selectedKeys) {
      const g = geom[k]
      if (g) items.push({ ref: g, ox: g.x, oy: g.y, ow: g.w, oh: g.h })
      const lg = labelGeom[k]
      if (lg) items.push({ ref: lg, ox: lg.x, oy: lg.y, ow: lg.w, oh: lg.h })
    }
    drag = { mode: 'move', sx: nx, sy: ny, items }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  function startResize(
    e: PointerEvent,
    key: string,
    target: 'value' | 'label'
  ) {
    if (!boardEl) return
    e.stopPropagation()
    if (e.button !== 0) return
    selectedKeys = [key]
    const g = (target === 'label' ? labelGeom : geom)[key]
    if (!g) return
    const { nx, ny } = norm(e)
    drag = { mode: 'resize', sx: nx, sy: ny, ref: g, ow: g.w, oh: g.h }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: PointerEvent) {
    if (!drag || !boardEl) return
    const { nx, ny } = norm(e)
    if (drag.mode === 'move') {
      let dx = nx - drag.sx
      let dy = ny - drag.sy
      let minDx = -Infinity
      let maxDx = Infinity
      let minDy = -Infinity
      let maxDy = Infinity
      for (const it of drag.items) {
        minDx = Math.max(minDx, -it.ox)
        maxDx = Math.min(maxDx, 1 - it.ow - it.ox)
        minDy = Math.max(minDy, -it.oy)
        maxDy = Math.min(maxDy, 1 - it.oh - it.oy)
      }
      dx = clamp(dx, minDx, maxDx)
      dy = clamp(dy, minDy, maxDy)
      for (const it of drag.items) {
        it.ref.x = it.ox + dx
        it.ref.y = it.oy + dy
      }
    } else {
      drag.ref.w = clamp(drag.ow + (nx - drag.sx), 0.04, 1 - drag.ref.x)
      drag.ref.h = clamp(drag.oh + (ny - drag.sy), 0.02, 1 - drag.ref.y)
    }
  }
  function onPointerUp(e: PointerEvent) {
    if (drag) {
      try {
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {
        /* noop */
      }
      drag = null
    }
  }

  async function handleSave() {
    saving = true
    try {
      await onSave(buildSchema())
    } finally {
      saving = false
    }
  }
</script>

<div class="flex h-screen w-full flex-col bg-gray-100">
  <!-- 상단 툴바 -->
  <header
    class="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4"
  >
    <div class="flex items-center gap-3">
      <Tooltip text="닫기">
        <button
          onclick={onCancel}
          aria-label="닫기"
          class="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <ArrowBackIcon />
        </button>
      </Tooltip>
      <div class="flex items-baseline gap-2">
        <Typography variant="title-01-normal-semibold">양식 편집</Typography>
        <Typography
          variant="body-02-normal-regular"
          color="text-gray-500"
          tag="span">{name} · v{version}</Typography
        >
      </div>
    </div>
    <div class="flex items-center gap-2">
      <button
        onclick={onCancel}
        class="h-9 rounded-lg border border-gray-200 bg-white px-4 text-body-02-normal-medium text-gray-600 transition-colors hover:bg-gray-50"
        >취소</button
      >
      <button
        onclick={handleSave}
        disabled={saving}
        class="h-9 rounded-lg bg-primary-500 px-4 text-body-02-normal-medium text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
      >
        {saving ? '저장 중...' : '저장하기 (새 버전)'}
      </button>
    </div>
  </header>

  <div class="flex min-h-0 flex-1">
    <!-- 좌측 사이드바: 존재하는 요소 나열 (고정) -->
    <aside
      class="flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white"
    >
      <div
        class="flex h-12 shrink-0 items-center justify-between border-b border-gray-100 px-4"
      >
        <span class="text-body-02-normal-medium text-gray-700">요소</span>
        <Tooltip text="요소 추가">
          <button
            onclick={() => (showAddModal = true)}
            aria-label="요소 추가"
            class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-primary-50 hover:text-primary-600"
          >
            <svg
              class="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              /></svg
            >
          </button>
        </Tooltip>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto p-4">
        <ul class="flex flex-col gap-0.5">
          {#each fields as field (field.key)}
            <li>
              <button
                onclick={(e) =>
                  pickField(field.key, e.shiftKey || e.metaKey || e.ctrlKey)}
                class="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors {isSelected(
                  field.key
                )
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50'}"
              >
                <span class="flex min-w-0 items-center gap-1">
                  {#if field.showLabel}<span
                      class="size-1 shrink-0 rounded-full bg-primary-400"
                      aria-hidden="true"
                    ></span>{/if}
                  <span class="truncate-safe text-body-03-normal-regular"
                    >{field.label || '(레이블 없음)'}</span
                  >
                </span>
                <span
                  class="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-label-02-normal-medium text-gray-500"
                  >{FIELD_TYPE_LABELS[field.type] ?? field.type}</span
                >
              </button>
            </li>
          {/each}
          {#if fields.length === 0}
            <li
              class="px-2 py-3 text-center text-body-03-normal-regular text-gray-300"
            >
              상단 + 로 요소를 추가하세요
            </li>
          {/if}
        </ul>
      </div>
    </aside>

    <!-- 중앙 캔버스 (빈 공간 클릭 시 선택 해제 — 요소 박스는 stopPropagation) -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <main
      class="relative min-w-0 flex-1 overflow-auto"
      style="background-color:#eef0f3; background-image: radial-gradient(#d6d9df 1px, transparent 1px); background-size: 18px 18px;"
      onpointerdown={clearSelection}
      oncontextmenu={(e) => {
        e.preventDefault()
        ctxMenu = null
      }}
    >
      <div class="flex min-h-full w-full justify-center py-10">
        <div
          bind:this={boardEl}
          class="relative shrink-0 rounded-md border border-gray-200 bg-white shadow-sm"
          style="width:{BOARD_W}px; height:{BOARD_H}px;"
        >
          {#each fields as field (field.key)}
            {@const g = geom[field.key]}
            {@const lg = labelGeom[field.key]}
            {@const selected = isSelected(field.key)}
            {@const single = selectedKeys.length === 1}
            <!-- 레이블 요소 -->
            {#if field.showLabel && lg}
              <div
                role="button"
                tabindex="0"
                onpointerdown={(e) => startMove(e, field.key)}
                onpointermove={onPointerMove}
                onpointerup={onPointerUp}
                oncontextmenu={(e) => onContextMenu(e, field.key)}
                onkeydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    pickField(field.key, e.shiftKey)
                  }
                }}
                class="absolute flex touch-none select-none items-center overflow-hidden rounded {selected
                  ? 'ring-2 ring-primary-400'
                  : 'hover:ring-1 hover:ring-gray-300'}"
                style="left:{lg.x * BOARD_W}px; top:{lg.y *
                  BOARD_H}px; width:{lg.w * BOARD_W}px; height:{lg.h *
                  BOARD_H}px; z-index:{lg.z + 1};"
              >
                <span
                  class="pointer-events-none truncate-safe text-body-02-normal-medium text-gray-700"
                >
                  {field.label || '(레이블)'}{#if field.required}<span
                      class="text-status-danger"
                    >
                      *</span
                    >{/if}
                </span>
              </div>
            {/if}
            <!-- 값 요소 -->
            {#if g}
              <div
                role="button"
                tabindex="0"
                onpointerdown={(e) => startMove(e, field.key)}
                onpointermove={onPointerMove}
                onpointerup={onPointerUp}
                oncontextmenu={(e) => onContextMenu(e, field.key)}
                onkeydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    pickField(field.key, e.shiftKey)
                  }
                }}
                class="absolute touch-none select-none rounded-md transition-shadow {selected
                  ? 'ring-2 ring-primary-500 ring-offset-1'
                  : 'hover:ring-1 hover:ring-gray-300'}"
                style="left:{g.x * BOARD_W}px; top:{g.y *
                  BOARD_H}px; width:{g.w * BOARD_W}px; height:{g.h *
                  BOARD_H}px; z-index:{g.z};"
              >
                <div
                  class="pointer-events-none h-full overflow-hidden rounded-md"
                >
                  <FieldPreview {field} />
                </div>
                {#if selected && single}
                  <div
                    role="button"
                    tabindex="-1"
                    aria-label="크기 조절"
                    onpointerdown={(e) => startResize(e, field.key, 'value')}
                    onpointermove={onPointerMove}
                    onpointerup={onPointerUp}
                    class="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize rounded-sm border border-white bg-primary-500"
                  ></div>
                {/if}
              </div>
            {/if}
          {/each}

          {#if fields.length === 0}
            <p
              class="absolute inset-x-0 top-20 text-center text-body-02-normal-regular text-gray-400"
            >
              상단 + 로 요소를 추가하세요
            </p>
          {/if}
        </div>
      </div>
    </main>

    <!-- 우측 인스펙터 -->
    <FieldInspector
      {selectionKind}
      selectedCount={selectedKeys.length}
      field={singleField}
      geometry={singleGeometry}
      formName={name}
      formVersion={version}
      fieldCount={fields.length}
      elementCount={fields.length}
      onToggleLabel={() => singleKey && toggleLabel(singleKey)}
      onAlign={alignSelected}
      onFillWidth={fillWidthSelected}
      onStepZ={stepZSelected}
      onBringForward={bringSelectedForward}
      onSendBackward={sendSelectedBackward}
      onDelete={deleteSelected}
    />
  </div>

  {#if showAddModal}
    <FieldAddModal
      onSelect={(type) => {
        addField(type)
        showAddModal = false
      }}
      onClose={() => (showAddModal = false)}
    />
  {/if}

  {#if ctxMenu}
    <BuilderContextMenu
      x={ctxMenu.x}
      y={ctxMenu.y}
      count={selectedKeys.length}
      onAlign={alignSelected}
      onFillWidth={fillWidthSelected}
      onBringForward={bringSelectedForward}
      onSendBackward={sendSelectedBackward}
      onStepZ={stepZSelected}
      onDelete={deleteSelected}
      onClose={() => (ctxMenu = null)}
    />
  {/if}
</div>
