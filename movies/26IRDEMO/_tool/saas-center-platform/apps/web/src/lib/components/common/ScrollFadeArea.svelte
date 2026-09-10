<script lang="ts">
  import { browser } from '$app/environment'
  import { tick, type Snippet } from 'svelte'

  interface Props {
    /** 스크롤 영역 안에 렌더할 콘텐츠 */
    children: Snippet
    /** 스크롤 컨테이너에 추가할 클래스 (패딩/간격 등) */
    class?: string
    /** fade 그라데이션 높이(px) */
    fadeHeight?: number
    /** fade·화살표가 페이드되는 배경색 (스크롤 영역 배경과 맞춰야 자연스러움) */
    fadeColor?: string
    /** 화살표에 bounce 애니메이션 적용 (위·아래 둘 다, 시선 유도가 필요할 때) */
    bounceArrow?: boolean
    /**
     * 내용 높이가 바뀔 수 있는 의존성. 값이 바뀌면 스크롤 가능 여부를 재계산한다.
     * (목록 데이터, 펼침 상태 등을 넘기면 됨)
     */
    deps?: unknown
    /**
     * 내부 스크롤 엘리먼트를 외부로 노출하는 콜백.
     * 무한스크롤 IntersectionObserver의 root로 쓸 때 등 필요.
     */
    bindScrollEl?: (el: HTMLDivElement | null) => void
  }

  let {
    children,
    class: className = '',
    fadeHeight = 40,
    fadeColor = 'white',
    bounceArrow = false,
    deps,
    bindScrollEl
  }: Props = $props()

  let scrollEl = $state<HTMLDivElement | null>(null)

  // 내부 scrollEl이 정해지면(또는 해제되면) 외부로 노출
  $effect(() => {
    bindScrollEl?.(scrollEl)
  })
  let canScrollUp = $state(false)
  let canScrollDown = $state(false)

  function updateScrollState() {
    if (!scrollEl) return
    const THRESHOLD = 4 // 분수 픽셀 오차 여유
    canScrollUp = scrollEl.scrollTop > THRESHOLD
    const remaining =
      scrollEl.scrollHeight - (scrollEl.scrollTop + scrollEl.clientHeight)
    canScrollDown = remaining > THRESHOLD
  }

  // deps 변동(내용 높이 변화) 시 재계산
  $effect(() => {
    deps
    tick().then(updateScrollState)
  })

  // 컨테이너 크기 변화에도 재계산
  $effect(() => {
    if (!browser || !scrollEl) return
    const ro = new ResizeObserver(updateScrollState)
    ro.observe(scrollEl)
    tick().then(updateScrollState)
    return () => ro.disconnect()
  })

  const scrollByPage = (dir: 1 | -1) =>
    scrollEl?.scrollBy({
      top: scrollEl.clientHeight * 0.8 * dir,
      behavior: 'smooth'
    })
</script>

<div class="relative min-h-0 min-w-0 flex-1 overflow-hidden">
  <div
    bind:this={scrollEl}
    onscroll={updateScrollState}
    class="scrollbar-none h-full overflow-y-auto overscroll-contain {className}"
  >
    {@render children()}
  </div>

  <!-- 위: 더 볼 수 있을 때 fade + 화살표 -->
  <div
    class="pointer-events-none absolute inset-x-0 top-0 z-10 transition-opacity duration-300"
    style="height: {fadeHeight}px; background: linear-gradient(to bottom, {fadeColor} 30%, transparent); opacity: {canScrollUp
      ? 1
      : 0};"
  ></div>
  <button
    type="button"
    aria-label="위로 스크롤"
    onclick={() => scrollByPage(-1)}
    class="absolute top-2 left-1/2 z-20 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full bg-white text-gray-400 shadow-[0_2px_8px_rgba(0,0,0,0.12)] ring-1 ring-gray-100 transition-all duration-300 hover:text-gray-600 {canScrollUp
      ? 'translate-y-0 opacity-100'
      : 'pointer-events-none -translate-y-1 opacity-0'} {bounceArrow &&
    canScrollUp
      ? 'animate-bounce-soft-up'
      : ''}"
  >
    <svg
      class="h-4 w-4 rotate-180"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      ><path
        d="M17 9.5L12 14.5L7 9.5"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      /></svg
    >
  </button>

  <!-- 아래: 더 볼 수 있을 때 fade + 화살표 -->
  <div
    class="pointer-events-none absolute inset-x-0 bottom-0 z-10 transition-opacity duration-300"
    style="height: {fadeHeight}px; background: linear-gradient(to top, {fadeColor} 30%, transparent); opacity: {canScrollDown
      ? 1
      : 0};"
  ></div>
  <button
    type="button"
    aria-label="아래로 스크롤"
    onclick={() => scrollByPage(1)}
    class="absolute bottom-2 left-1/2 z-20 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full bg-white text-gray-400 shadow-[0_2px_8px_rgba(0,0,0,0.12)] ring-1 ring-gray-100 transition-all duration-300 hover:text-gray-600 {canScrollDown
      ? 'translate-y-0 opacity-100'
      : 'pointer-events-none translate-y-1 opacity-0'} {bounceArrow &&
    canScrollDown
      ? 'animate-bounce-soft'
      : ''}"
  >
    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      ><path
        d="M17 9.5L12 14.5L7 9.5"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      /></svg
    >
  </button>
</div>
