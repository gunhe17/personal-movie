<script lang="ts">
  /**
   * Tabs — Web_Design.md §tab 정본.
   *
   * Underline
   *   텍스트 Body_01(16) Medium — 활성·비활성 공통(SemiBold 아님).
   *   상하 패딩 20, 트랙 하단 1px border-default.
   *   활성  : 텍스트 primary-500 + 하단 2px primary-500
   *   비활성: 텍스트 gray-400
   *   🔴 굵기는 Medium 고정. 활성/비활성 구분은 색으로만 한다(굵기 변화 없음).
   *
   * Segmented(round)
   *   pill 높이 36, 그룹 내 gap 4, 텍스트 15.
   *   활성  : gray-700 채움 + 흰 텍스트
   *   비활성: 흰 bg + 1px border-default
   */
  interface Tab {
    value: string
    label: string
    count?: number
  }

  let {
    tabs,
    selected,
    onChange,
    shape = 'underline',
    /** 정본은 셀 너비 140 고정. 탭이 많거나 라벨이 길면 false로 내용폭에 맞춘다. */
    fixedWidth = true,
    /**
     * 세로 여백. `md`가 정본(상하 20)이고, 목록 위 촘촘한 헤더처럼
     * 정본 높이가 과한 자리에만 `sm`을 쓴다.
     */
    size = 'md',
    class: className = ''
  }: {
    tabs: Tab[]
    selected: string
    onChange: (value: string) => void
    shape?: 'underline' | 'segmented'
    fixedWidth?: boolean
    size?: 'sm' | 'md'
    class?: string
  } = $props()

  // sm은 라벨도 함께 줄인다 — 여백만 줄이면 글자가 상대적으로 커 보인다
  const sizeCls = {
    sm: 'py-2.5 text-body-02-normal-medium',
    md: 'py-5 text-body-01-normal-medium'
  } as const

  /* ---------------- underline 인디케이터 ---------------- */

  /**
   * 밑줄을 각 버튼 안에 그리면 탭을 바꿀 때 지워졌다 새로 생겨 "툭" 튄다.
   * 트랙에 하나만 띄우고 활성 버튼의 위치·너비를 좇게 해서 미끄러지도록 한다.
   */
  let trackEl = $state<HTMLElement | null>(null)
  let btnEls = $state<Record<string, HTMLElement | null>>({})
  let indicator = $state({ left: 0, width: 0 })

  /**
   * 첫 배치까지는 전환을 끈다. 0에서 출발하면 진입하자마자 밑줄이
   * 왼쪽 끝에서 미끄러져 들어와 — 사용자는 탭을 누른 적이 없다.
   */
  let ready = $state(false)

  function measure() {
    const btn = btnEls[selected]
    if (!btn || !trackEl) return
    const t = trackEl.getBoundingClientRect()
    const b = btn.getBoundingClientRect()
    const next = { left: b.left - t.left, width: b.width }
    if (next.left === indicator.left && next.width === indicator.width) return
    indicator = next
  }

  $effect(() => {
    // selected·탭 목록·ref가 바뀌면 다시 잰다
    selected
    tabs
    btnEls[selected]
    measure()
  })

  $effect(() => {
    if (!trackEl) return
    // 버튼 ref는 마운트 후 채워진다 — 목록을 읽어 의존성에 걸어야 그때 다시 붙는다
    const btns = tabs.map((t) => btnEls[t.value]).filter(Boolean) as HTMLElement[]
    // 트랙/버튼 폭 변화(리사이즈, 웹폰트 적용 후 글자폭 변동)에도 따라붙는다
    const ro = new ResizeObserver(measure)
    ro.observe(trackEl)
    for (const el of btns) ro.observe(el)
    return () => ro.disconnect()
  })

  $effect(() => {
    // 첫 측정이 끝난 다음 프레임부터 전환을 켠다
    if (ready || indicator.width === 0) return
    const id = requestAnimationFrame(() => (ready = true))
    return () => cancelAnimationFrame(id)
  })
</script>

<!--
  segmented는 이동 인디케이터를 쓰지 않는다 — 비활성 pill만 1px 보더를 갖는
  구조라 채움이 미끄러지면 글자가 1px씩 밀린다. 색 전환(transition-colors)으로 둔다.
  이동 인디케이터는 트랙 위에 밑줄 하나만 있는 underline에서만 성립한다.
-->
{#if shape === 'segmented'}
  <div class="flex gap-1 {className}">
    {#each tabs as tab (tab.value)}
      <button
        type="button"
        onclick={() => onChange(tab.value)}
        aria-pressed={tab.value === selected}
        class="h-9 rounded-full px-3 text-body-02-normal-medium transition-colors
          {tab.value === selected
          ? 'bg-gray-700 text-white'
          : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}"
      >
        {tab.label}
        {#if tab.count !== undefined}
          <span class="ml-1 tabular-nums">{tab.count}</span>
        {/if}
      </button>
    {/each}
  </div>
{:else}
  <div
    bind:this={trackEl}
    class="relative flex border-b border-gray-200 {className}"
    role="tablist"
  >
    {#each tabs as tab (tab.value)}
      <button
        type="button"
        role="tab"
        bind:this={btnEls[tab.value]}
        aria-selected={tab.value === selected}
        onclick={() => onChange(tab.value)}
        class="relative flex items-center justify-center gap-1 transition-colors {sizeCls[
          size
        ]}
          {fixedWidth ? 'w-35' : 'px-4'}
          {tab.value === selected
          ? 'text-primary-500'
          : 'text-gray-400 hover:text-gray-600'}"
      >
        {tab.label}
        {#if tab.count !== undefined}
          <span class="tabular-nums">{tab.count}</span>
        {/if}
      </button>
    {/each}

    <!--
      활성 표시 — 버튼 안이 아니라 트랙에 하나만 띄워 활성 탭으로 미끄러진다.
      left/width를 전환하므로 폭이 다른 탭 사이에서도 자연스럽게 늘고 준다.
    -->
    <span
      class="pointer-events-none absolute bottom-0 h-0.5 bg-primary-500 {ready
        ? 'transition-[left,width] duration-300 ease-out motion-reduce:transition-none'
        : ''}"
      style="left: {indicator.left}px; width: {indicator.width}px;"
    ></span>
  </div>
{/if}
