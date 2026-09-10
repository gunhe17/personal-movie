<script lang="ts">
  /**
   * ScrollStrip — 가로로 넘치는 줄(탭·칩 나열)을 화살표로 넘긴다.
   *
   * `overflow-x-auto`만 두면 콘텐츠 아래 가로 스크롤바가 생겨 지저분하고,
   * 트랙패드가 없는 환경에서는 넘기기도 불편하다. 이 컴포넌트는 스크롤바를
   * 감추고 양 끝에 화살표를 띄운다 — 더 넘길 곳이 없으면 그 쪽 화살표는
   * 사라지므로, 화살표 자체가 "더 있다"는 신호가 된다.
   *
   * 쓰는 곳: 로르샤하 카드 탭 · HTP 그림 탭 등 항목이 늘면 넘치는 줄.
   * (표의 가로 스크롤은 대상이 아니다 — 거기선 스크롤바가 정상적인 신호다)
   */
  import type { Snippet } from 'svelte'
  import Icon from '$components/ui/Icon.svelte'

  interface Props {
    children: Snippet
    /**
     * 이 값이 바뀌면 그 항목이 보이도록 스크롤한다.
     * 항목에 `data-strip-key="<값>"`을 달아 두면 찾아간다.
     *
     * 선택이 이 줄 밖에서도 바뀌기 때문에 필요하다 — 예를 들어 로르샤하는
     * 녹취록에서 영역을 클릭해도 카드가 바뀌는데, 그때 선택된 칩이 스크롤
     * 밖에 있으면 어느 카드를 보고 있는지 알 수 없다.
     */
    activeKey?: string | number | null
    /** 줄 자체에 붙일 클래스 (패딩·배경·테두리 등) */
    class?: string
    /** 항목 사이 간격 클래스 */
    gapClass?: string
  }

  let {
    children,
    activeKey = null,
    class: className = '',
    gapClass = 'gap-2'
  }: Props = $props()

  let strip = $state<HTMLElement | null>(null)
  let canLeft = $state(false)
  let canRight = $state(false)

  /** 1px 여유 — 소수점 폭에서는 끝에 닿아도 정확히 0이 되지 않는다. */
  function measure() {
    if (!strip) return
    canLeft = strip.scrollLeft > 1
    canRight = strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1
  }

  function nudge(dir: -1 | 1) {
    if (!strip) return
    // 보이는 폭의 3/4씩 — 한 화면을 통째로 넘기면 방금 본 항목이 사라져
    // 어디까지 봤는지 감을 잃는다.
    strip.scrollBy({ left: dir * strip.clientWidth * 0.75, behavior: 'smooth' })
  }

  // 선택된 항목이 보이는 곳으로
  $effect(() => {
    const key = activeKey // 의존성 등록
    if (!strip || key == null) return
    const el = strip.querySelector<HTMLElement>(`[data-strip-key="${key}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  })

  // 폭은 창 크기·분할 패널 드래그로도 바뀐다 — ResizeObserver로 따라간다.
  $effect(() => {
    if (!strip) return
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(strip)
    return () => ro.disconnect()
  })
</script>

<div class="relative flex min-w-0 items-center {className}">
  <!--
    화살표는 줄 위에 떠 있다(absolute). 흐름에 넣으면 나타났다 사라질 때마다
    항목들이 좌우로 밀려 눈이 따라가기 어렵다.
    끝에서 그라디언트로 페이드를 줘 잘린 항목이 화면 밖으로 이어짐을 알린다.
  -->
  {#if canLeft}
    <div
      class="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-linear-to-r from-white to-transparent"
    ></div>
    <button
      type="button"
      onclick={() => nudge(-1)}
      aria-label="이전 항목 보기"
      class="absolute left-1 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900"
    >
      <Icon name="chevron_left" size="sm" />
    </button>
  {/if}

  <div
    bind:this={strip}
    onscroll={measure}
    class="strip flex min-w-0 flex-1 items-center overflow-x-auto p-1.5 -m-1.5 {gapClass}"
  >
    {@render children()}
  </div>

  {#if canRight}
    <div
      class="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-linear-to-l from-white to-transparent"
    ></div>
    <button
      type="button"
      onclick={() => nudge(1)}
      aria-label="다음 항목 보기"
      class="absolute right-1 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900"
    >
      <Icon name="chevron_right" size="sm" />
    </button>
  {/if}
</div>

<style>
  /*
    마크업의 `p-1.5 -m-1.5`에 대하여:

    overflow-x를 지정하면 CSS가 overflow-y도 auto로 끌어올린다. 그래서 항목
    바깥으로 나가는 것 — 포커스 링(ring-offset), 모서리 배지 — 이 위아래로도,
    스크롤 시작/끝에서 좌우로도 잘린다.

    패딩으로 그 자리를 만들고 같은 크기의 음수 마진으로 상쇄한다. 콘텐츠가
    시작하는 위치는 그대로면서 링이 들어갈 6px만 확보된다.
    (좌우는 음수 마진만으로는 안 된다 — 스크롤 컨테이너라 끝 항목의 여백이
     스크롤 범위에 포함돼야 하므로 패딩이 함께 있어야 한다.)
  */

  /* 스크롤은 살리되 막대만 감춘다 — 화살표가 그 역할을 대신한다. */
  .strip {
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* 구 Edge */
  }
  .strip::-webkit-scrollbar {
    display: none;
  }
</style>
