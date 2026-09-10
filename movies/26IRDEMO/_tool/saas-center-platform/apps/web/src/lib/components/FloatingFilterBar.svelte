<!--
  FloatingFilterBar — 카드(grid) 뷰 전체 스크롤 목록의 검색+필터 바.

  스크롤로 화면 밖으로 나가는 순간 상단에 고정(sticky)되고, 고정된 동안에만
  배경·보더·그림자가 켜져 "떠 있는" 판으로 읽힌다. 스크롤 중에도 검색·필터를 조작할 수 있다.

  사용:
    <FloatingFilterBar reserveScroll={isGrid}>
      {#snippet children()}
        <SearchInput /> <Select /> ...
      {/snippet}
    </FloatingFilterBar>

  주의 — 이 컴포넌트는 페이지 셸의 **직계 자식**이어야 한다. sticky는 부모 박스 안에서만
  붙어 있으므로, 높이가 짧은 래퍼(옛 sticky 헤더 블록) 안에 넣으면 같이 스크롤돼 버린다.
  위 형제(탭 등)의 아래 여백은 이 컴포넌트의 py-4가 대신하므로 제거한다.
-->
<script lang="ts">
  import type { Snippet } from 'svelte'
  import { browser } from '$app/environment'
  import ArrowDownIcon20 from '$lib/assets/ArrowDownIcon20.svelte'

  interface Props {
    /** 검색·필터 컨트롤들 */
    children: Snippet
    /**
     * 스크롤 여유 예약 여부 — 전체 스크롤을 쓰는 카드(grid) 뷰에서만 true.
     * 리스트 뷰는 높이 고정 + 내부 스크롤이라 예약하면 레이아웃이 깨진다.
     */
    reserveScroll?: boolean
    /** 최상단 이동 버튼 노출 여부 */
    showScrollTop?: boolean
    class?: string
  }

  let {
    children,
    reserveScroll = true,
    showScrollTop = true,
    class: className = ''
  }: Props = $props()

  let sentinel = $state<HTMLElement | null>(null)
  let isPinned = $state(false)

  /** 페이지 셸 하단에 예약해 둔 여백(px) */
  let reserved = 0

  // ── 스크롤 주체 다루기 ────────────────────────────────────────────────
  // xl은 본문 컨테이너가, 그 미만은 window가 스크롤 주체라 하드코딩할 수 없다.

  function getScroller(): HTMLElement | null {
    let node = sentinel?.parentElement ?? null
    while (node) {
      const { overflowY } = getComputedStyle(node)
      if (overflowY === 'auto' || overflowY === 'scroll') return node
      node = node.parentElement
    }
    return null
  }

  /** sentinel이 스크롤 영역 최상단에 닿기까지 필요한 스크롤 거리 = 고정이 시작되는 지점 */
  function pinDistance(): number {
    if (!sentinel) return 0
    const el = getScroller()
    const containerTop = el ? el.getBoundingClientRect().top : 0
    const top = el ? el.scrollTop : window.scrollY
    return Math.max(
      0,
      top + (sentinel.getBoundingClientRect().top - containerTop)
    )
  }

  // ── 스크롤 여유 예약 (핵심) ───────────────────────────────────────────
  // 결과가 1~2건이면 스크롤할 거리가 없어 바가 고정될 수 없다. 그 상태에서 고정 중에
  // 필터를 걸면 브라우저가 scrollTop을 0으로 당겨(클램프) 플로팅이 툭 끊긴다.
  //
  // 그래서 "끊긴 뒤 되돌리는" 대신, 항상 고정에 필요한 만큼의 스크롤 여유를 셸 하단에
  // padding으로 미리 확보해 둔다. 여유가 이미 있으니 클램프 자체가 일어나지 않고,
  // 결과가 몇 건이든 고정이 유지된다. 위로 올리면 sentinel이 보이며 자연히 풀린다.
  //
  // margin이 아니라 padding인 이유: 마지막 자식의 bottom margin은 브라우저에 따라
  // 스크롤 영역(scrollHeight)에 포함되지 않아 여유가 실제로 생기지 않는다.

  function syncReserve() {
    const shell = sentinel?.parentElement
    if (!shell) return

    const apply = (px: number) => {
      if (px === reserved) return
      reserved = px
      shell.style.paddingBottom = px > 0 ? `${px}px` : ''
    }

    if (!reserveScroll) {
      apply(0)
      return
    }

    const el = getScroller()
    const clientH = el ? el.clientHeight : window.innerHeight
    const scrollH = el ? el.scrollHeight : document.documentElement.scrollHeight
    // 예약분을 뺀 "원래" 스크롤 여유
    const natural = scrollH - reserved - clientH
    apply(Math.max(0, Math.ceil(pinDistance() - natural)))
  }

  // ── 고정 감지 ─────────────────────────────────────────────────────────

  $effect(() => {
    if (!browser || !sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => (isPinned = !entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  })

  // 셸/뷰포트 높이가 바뀔 때마다(=목록 증감, 창 크기 변경) 예약량을 다시 계산한다.
  // 예약 자체가 셸 높이를 바꾸지만 apply()가 값 변화 없을 때 멈추므로 루프가 아니다.
  $effect(() => {
    if (!browser || !sentinel) return
    void reserveScroll // prop 변화 시 재실행

    const shell = sentinel.parentElement
    if (!shell) return

    const observer = new ResizeObserver(() => syncReserve())
    observer.observe(shell)
    const scroller = getScroller()
    if (scroller) observer.observe(scroller)

    syncReserve()

    return () => {
      observer.disconnect()
      shell.style.paddingBottom = ''
      reserved = 0
    }
  })

  function scrollToTop() {
    if (!browser) return
    const el = getScroller()
    if (el) el.scrollTo({ top: 0, behavior: 'smooth' })
    else window.scrollTo({ top: 0, behavior: 'smooth' })
  }
</script>

<!-- 플로팅 전환 감지점 — 바 박스 최상단과 위치가 일치해야 고정 시점과 어긋나지 않는다 -->
<div bind:this={sentinel} class="h-px w-full shrink-0" aria-hidden="true"></div>

<!-- 인풋 박스 기준 사방 16 — py-4가 상하, 배경 레이어의 -inset-x-4가 좌우를 담당.
     -top-2 = 전역 헤더와의 간격을 두 단계(8) 좁힌 값. -->
<div class="sticky -top-2 z-30 py-4 {className}">
  <!-- 배경 레이어: 레이아웃에 영향 없이 좌우로 번진다. 불투명도 80 + backdrop-blur로
       뒤로 지나가는 카드가 블러 처리돼 은은하게 비친다.
       라운드 12 — 안쪽 인풋/셀렉트(8)보다 한 단계 크게(중첩 radius 규칙) -->
  <div
    aria-hidden="true"
    class="pointer-events-none absolute -inset-x-4 inset-y-0 rounded-xl border border-gray-200 bg-gray-50/80 backdrop-blur-md transition-opacity duration-200 {isPinned
      ? 'opacity-100 shadow-[0_0_16px_-4px_rgb(0_0_0_/_0.16)]'
      : 'opacity-0'}"
  ></div>

  <div class="filter-bar relative flex flex-wrap items-center gap-2">
    {@render children()}

    {#if showScrollTop}
      <!-- 최상단 이동 — 고정 상태(=스크롤된 상태)에서만 활성.
           자리는 항상 차지시켜 나타날 때 필터가 밀리지 않게 한다. -->
      <button
        type="button"
        onclick={scrollToTop}
        aria-label="최상단으로 이동"
        class="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 {isPinned
          ? 'opacity-100'
          : 'pointer-events-none opacity-0'}"
      >
        <span class="block rotate-180"><ArrowDownIcon20 /></span>
      </button>
    {/if}
  </div>
</div>
