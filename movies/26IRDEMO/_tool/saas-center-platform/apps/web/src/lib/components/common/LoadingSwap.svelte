<script lang="ts">
  /**
   * 로딩 스켈레톤 ↔ 실제 콘텐츠를 같은 자리에서 바꿔 끼운다.
   *
   * 스켈레톤 규격(Web_Design §loading-skeleton)의 첫 규칙은 "상자 치수 = 실제 콘텐츠 치수"다.
   * 그런데 최종 높이가 아직 안 온 데이터에 달린 자리는 그 규칙을 지킬 수 없다 —
   * 오늘 일정이 0건이면 캐러셀이 통째로 빠지고, 카드 푸터도 상태별로 높이가 갈린다.
   * 그런 자리에서만 쓴다: 어긋난 만큼을 높이 전환으로 흡수해 "튀는" 대신 "자라게" 한다.
   * 치수를 맞출 수 있는 자리라면 이걸 쓰지 말고 스켈레톤 치수를 맞추는 게 정본이다.
   *
   * 두 자식을 같은 그리드 칸에 겹쳐 두고 불투명도만 교차시킨다 — 하나가 빠지고 하나가
   * 들어오는 방식은 전환 중 두 높이가 더해져 오히려 더 크게 튄다.
   *
   * ⚠️ 두 자식 모두 self-start 필수. 그리드 아이템 기본값은 stretch라, 그냥 두면 짧은 쪽이
   * 긴 쪽 높이까지 늘어나 offsetHeight가 제 높이가 아닌 칸 높이를 돌려준다 —
   * 일정 0건이라 콘텐츠가 비어도 스켈레톤 높이만큼 빈 자리가 남는 증상이 이것이었다.
   */
  import type { Snippet } from 'svelte'

  interface Props {
    loading: boolean
    /** 전환 시간(ms) — 높이·불투명도 공통 */
    duration?: number
    skeleton: Snippet
    content: Snippet
  }

  let { loading, duration = 260, skeleton, content }: Props = $props()

  let skeletonEl = $state<HTMLElement | null>(null)
  let contentEl = $state<HTMLElement | null>(null)
  // 첫 측정 전에는 auto — 0에서 시작하면 스켈레톤이 한 번 접혔다 펴진다
  let height = $state<number | null>(null)

  // 지금 보이는 쪽의 실제 높이를 재서 래퍼에 싣는다.
  // 콘텐츠는 로딩 중에도 붙어 있으므로(겹쳐 두는 구조) 도착 즉시 높이가 잡힌다.
  $effect(() => {
    const active = loading ? skeletonEl : contentEl
    if (!active) return
    const measure = () => (height = active.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(active)
    return () => ro.disconnect()
  })
</script>

<div
  class="grid overflow-hidden transition-[height] ease-out motion-reduce:transition-none"
  style="height: {height === null
    ? 'auto'
    : `${height}px`}; transition-duration: {duration}ms"
>
  <div
    bind:this={skeletonEl}
    class="col-start-1 row-start-1 self-start transition-opacity ease-out motion-reduce:transition-none {loading
      ? 'opacity-100'
      : 'pointer-events-none opacity-0'}"
    style="transition-duration: {duration}ms"
    aria-hidden={!loading}
  >
    {@render skeleton()}
  </div>
  <div
    bind:this={contentEl}
    class="col-start-1 row-start-1 self-start transition-opacity ease-out motion-reduce:transition-none {loading
      ? 'pointer-events-none opacity-0'
      : 'opacity-100'}"
    style="transition-duration: {duration}ms"
    aria-hidden={loading}
  >
    {@render content()}
  </div>
</div>
