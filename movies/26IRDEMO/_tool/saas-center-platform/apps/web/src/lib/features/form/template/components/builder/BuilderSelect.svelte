<script lang="ts">
  // 양식 빌더 인스펙터 전용 컴팩트 셀렉트.
  // 공용 Select는 패널 패딩(p-2)·옵션 행(py-3)이 커서 빌더 톤과 맞지 않아 별도 구현.
  // 패널은 overflow 클리핑을 피해 body로 띄우고, 스크롤·리사이즈 시 위치를 다시 계산해 트리거를 따라간다.
  import { tick } from 'svelte'

  type Option = { title: string; value: string }

  let {
    value,
    options,
    onChange,
    placeholder = '선택',
    class: className = ''
  }: {
    value: string
    options: Option[]
    onChange: (value: string) => void
    placeholder?: string
    class?: string
  } = $props()

  let open = $state(false)
  let buttonRef = $state<HTMLButtonElement | null>(null)
  let panelRef = $state<HTMLDivElement | null>(null)
  let pos = $state({ top: 0, left: 0, width: 0 })

  const selectedLabel = $derived(
    options.find((o) => o.value === value)?.title ?? placeholder
  )

  const GAP = 4

  // 버튼 위치 기준으로 패널 좌표 계산 (아래 공간 부족 시 위로 뒤집기)
  function reposition() {
    if (!buttonRef) return
    const r = buttonRef.getBoundingClientRect()
    const panelH = panelRef?.offsetHeight ?? 0
    const fitsBelow = r.bottom + GAP + panelH <= window.innerHeight
    const top = fitsBelow ? r.bottom + GAP : Math.max(GAP, r.top - panelH - GAP)
    pos = { top, left: r.left, width: r.width }
  }

  async function openMenu() {
    // 깜빡임 방지용 1차 배치(아래 방향 가정) 후, 실제 높이로 보정
    if (buttonRef) {
      const r = buttonRef.getBoundingClientRect()
      pos = { top: r.bottom + GAP, left: r.left, width: r.width }
    }
    open = true
    await tick()
    reposition()
  }
  function closeMenu() {
    open = false
  }
  function toggle() {
    open ? closeMenu() : openMenu()
  }
  function choose(v: string) {
    closeMenu()
    if (v !== value) onChange(v)
  }

  // body 텔레포트 — fixed 패널이 transform 가진 조상에 갇히지 않도록
  function toBody(node: HTMLElement) {
    document.body.appendChild(node)
    return {
      destroy() {
        node.remove()
      }
    }
  }

  // 열려 있는 동안: 스크롤(중첩 컨테이너 포함)·리사이즈에 위치 반영 + 외부 클릭/ESC 닫기
  $effect(() => {
    if (!open) return
    const onScroll = () => reposition()
    const onResize = () => reposition()
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (buttonRef?.contains(t) || panelRef?.contains(t)) return
      closeMenu()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu()
    }
    window.addEventListener('scroll', onScroll, true) // capture: 인스펙터 등 내부 스크롤까지 포착
    window.addEventListener('resize', onResize)
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKey)
    }
  })
</script>

<button
  bind:this={buttonRef}
  type="button"
  onclick={toggle}
  aria-haspopup="listbox"
  aria-expanded={open}
  class="flex h-8 w-full items-center justify-between gap-1 rounded-md px-2 text-body-03-normal-regular outline-none transition-colors hover:bg-gray-100 {open
    ? 'bg-gray-50'
    : ''} {className}"
>
  <span class="truncate-safe {value ? 'text-gray-800' : 'text-gray-400'}"
    >{selectedLabel}</span
  >
  <svg
    class="h-3 w-3 shrink-0 text-gray-400 transition-transform {open
      ? 'rotate-180'
      : ''}"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2.5"
      d="M19 9l-7 7-7-7"
    />
  </svg>
</button>

{#if open}
  <div
    bind:this={panelRef}
    use:toBody
    role="listbox"
    class="dropdown-panel fixed z-[10001] max-h-64 overflow-y-auto"
    style="top:{pos.top}px; left:{pos.left}px; min-width:{Math.ceil(
      pos.width / 4
    ) * 4}px;"
  >
    {#each options as opt (opt.value)}
      <button
        type="button"
        role="option"
        aria-selected={opt.value === value}
        onclick={() => choose(opt.value)}
        class="dropdown-item {opt.value === value ? 'is-selected' : ''}"
      >
        <span class="truncate-safe">{opt.title}</span>
        {#if opt.value === value}
          <svg
            class="h-3.5 w-3.5 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2.5"
              d="M5 13l4 4L19 7"
            />
          </svg>
        {/if}
      </button>
    {/each}
  </div>
{/if}
