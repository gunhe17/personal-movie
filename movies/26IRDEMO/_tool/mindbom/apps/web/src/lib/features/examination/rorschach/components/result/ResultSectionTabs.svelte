<script lang="ts">
  export type ResultTab = 'upper' | 'lower' | 'special'

  interface Props {
    activeTab: ResultTab
    onTabChange: (tab: ResultTab) => void
  }
  let { activeTab, onTabChange }: Props = $props()

  const TABS: { key: ResultTab; label: string }[] = [
    { key: 'upper', label: '상단 요약' },
    { key: 'lower', label: '하단 클러스터' },
    { key: 'special', label: '특수 지표' }
  ]

  /** 각 탭 버튼 ref — 인디케이터가 활성 버튼 위치/너비를 따라가도록 */
  let btnEls = $state<Record<ResultTab, HTMLButtonElement | null>>({
    upper: null,
    lower: null,
    special: null
  })
  let containerEl: HTMLDivElement | null = $state(null)
  let indicator = $state({ left: 0, width: 0 })

  function recompute() {
    const btn = btnEls[activeTab]
    if (!btn || !containerEl) return
    const cRect = containerEl.getBoundingClientRect()
    const bRect = btn.getBoundingClientRect()
    indicator = { left: bRect.left - cRect.left, width: bRect.width }
  }

  // activeTab/ref/리사이즈에 따라 인디케이터 위치 재계산
  $effect(() => {
    activeTab
    btnEls.upper
    btnEls.lower
    btnEls.special
    recompute()
  })

  $effect(() => {
    if (!containerEl) return
    const ro = new ResizeObserver(recompute)
    ro.observe(containerEl)
    return () => ro.disconnect()
  })
</script>

<div
  bind:this={containerEl}
  class="relative h-12.75 shrink-0 flex items-center bg-white border-b border-gray-200 px-6"
>
  {#each TABS as tab (tab.key)}
    {@const active = activeTab === tab.key}
    <button
      bind:this={btnEls[tab.key]}
      onclick={() => onTabChange(tab.key)}
      class="px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors
        {active ? 'text-primary-700' : 'text-gray-400 hover:text-gray-600'}"
    >
      {tab.label}
    </button>
  {/each}

  <!-- 활성 인디케이터 — absolute로 떠 transform으로 스르륵 이동 -->
  <span
    class="pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-primary-600 transition-all duration-300 ease-out"
    style="left: {indicator.left}px; width: {indicator.width}px;"
  ></span>
</div>
