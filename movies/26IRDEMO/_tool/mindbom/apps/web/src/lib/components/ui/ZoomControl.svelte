<script lang="ts">
  /**
   * 이미지 줌 컨트롤 — 돋보기 ∓ 사이에 퍼센트, 퍼센트를 누르면 기본 배율로.
   *
   * 로르샤하 채점 화면(CodingViewToolbar)에서 쓰던 모양을 공용으로 뽑았다.
   * HTP는 회색 알약 안에 +/- 를 넣고 '화면 맞춤' 버튼을 따로 둬서 같은 일을
   * 하는 컨트롤이 두 벌로 보였다 — 퍼센트 자체가 리셋 버튼이면 하나로 족하다.
   */
  interface Props {
    /** 현재 배율 (1 = 100%) */
    zoom: number
    /** 이보다 작아지지 않는다 — 축소 버튼이 잠긴다 */
    min?: number
    /** 이보다 커지지 않는다 — 확대 버튼이 잠긴다 */
    max?: number
    onZoomIn: () => void
    onZoomOut: () => void
    /** 퍼센트를 눌렀을 때 — 기본 배율로 되돌린다 */
    onZoomReset: () => void
    /** 퍼센트 버튼의 툴팁. 화면에 맞추는 동작이면 그렇게 알려준다. */
    resetLabel?: string
  }

  let {
    zoom,
    min,
    max,
    onZoomIn,
    onZoomOut,
    onZoomReset,
    resetLabel = '기본 배율'
  }: Props = $props()

  let zoomPct = $derived(Math.round(zoom * 100))
  let atMin = $derived(min !== undefined && zoom <= min)
  let atMax = $derived(max !== undefined && zoom >= max)
</script>

<div class="shrink-0 flex items-center gap-1">
  <button
    onclick={onZoomOut}
    disabled={atMin}
    class="w-7 h-7 flex items-center justify-center rounded text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent"
    aria-label="축소"
    title="축소"
  >
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  </button>
  <button
    onclick={onZoomReset}
    class="px-2 h-7 flex items-center justify-center rounded text-label-02-normal-regular text-gray-600 hover:bg-gray-100 min-w-12"
    aria-label={resetLabel}
    title={resetLabel}>{zoomPct}%</button
  >
  <button
    onclick={onZoomIn}
    disabled={atMax}
    class="w-7 h-7 flex items-center justify-center rounded text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent"
    aria-label="확대"
    title="확대"
  >
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  </button>
</div>
