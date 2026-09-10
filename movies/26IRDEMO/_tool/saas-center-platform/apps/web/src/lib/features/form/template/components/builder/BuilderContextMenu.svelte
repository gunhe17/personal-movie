<script lang="ts">
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import AlignIcon from './AlignIcon.svelte'

  let {
    x,
    y,
    count,
    onAlign,
    onFillWidth,
    onBringForward,
    onSendBackward,
    onStepZ,
    onDelete,
    onClose
  }: {
    x: number
    y: number
    count: number
    onAlign: (where: 'left' | 'center' | 'right') => void
    onFillWidth: () => void
    onBringForward: () => void
    onSendBackward: () => void
    onStepZ: (d: number) => void
    onDelete: () => void
    onClose: () => void
  } = $props()

  // 뷰포트 경계 클램프 (editor 는 ssr=false 라 window 사용 가능)
  const MW = 160
  const MH = 148
  const left = $derived(
    typeof window !== 'undefined'
      ? Math.max(8, Math.min(x, window.innerWidth - MW - 8))
      : x
  )
  const top = $derived(
    typeof window !== 'undefined'
      ? Math.max(8, Math.min(y, window.innerHeight - MH - 8))
      : y
  )

  const TIP_DELAY = 700 // 호버 지연(ms) — 일정 시간 이상 머무를 때만 설명 노출
  const run = (fn: () => void) => {
    fn()
    onClose()
  }
  const iconBtn =
    'flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-600 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600'

  const aligns = [
    { id: 'left', tip: '왼쪽 정렬', fn: () => onAlign('left') },
    { id: 'center', tip: '가운데 정렬', fn: () => onAlign('center') },
    { id: 'right', tip: '오른쪽 정렬', fn: () => onAlign('right') },
    { id: 'fill', tip: '가로 꽉 채우기', fn: onFillWidth }
  ]
  const zs = [
    { id: 'front', tip: '맨 앞으로', fn: onBringForward },
    { id: 'fwd', tip: '앞으로', fn: () => onStepZ(1) },
    { id: 'back', tip: '뒤로', fn: () => onStepZ(-1) },
    { id: 'rear', tip: '맨 뒤로', fn: onSendBackward }
  ]
</script>

<!-- 백드롭 (클릭/우클릭 시 닫힘) -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-40"
  oncontextmenu={(e) => {
    e.preventDefault()
    onClose()
  }}
  onpointerdown={onClose}
></div>

<div
  class="dropdown-panel fixed z-50 gap-1"
  style="left:{left}px; top:{top}px;"
>
  <div class="flex gap-1">
    {#each aligns as it (it.id)}
      <Tooltip text={it.tip} delay={TIP_DELAY}>
        <button class={iconBtn} aria-label={it.tip} onclick={() => run(it.fn)}
          ><AlignIcon id={it.id} /></button
        >
      </Tooltip>
    {/each}
  </div>
  <div class="mt-1 flex gap-1">
    {#each zs as it (it.id)}
      <Tooltip text={it.tip} delay={TIP_DELAY}>
        <button class={iconBtn} aria-label={it.tip} onclick={() => run(it.fn)}
          ><AlignIcon id={it.id} /></button
        >
      </Tooltip>
    {/each}
  </div>

  <div class="dropdown-divider"></div>

  <Tooltip text="선택 요소 삭제" delay={TIP_DELAY}>
    <button
      onclick={() => run(onDelete)}
      aria-label="삭제"
      class="dropdown-item is-danger justify-center"
    >
      <svg
        class="h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
      </svg>
      삭제{count > 1 ? ` (${count})` : ''}
    </button>
  </Tooltip>
</div>
