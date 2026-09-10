<script lang="ts">
  /**
   * 원 채움 + X — 실패 피드백용. 색은 쓰는 쪽에서 `text-*`로 준다.
   */
  interface Props {
    size?: number
    class?: string
    /** X 획 색 — 원 위에 얹히므로 배경 대비가 나는 색이어야 한다 */
    markColor?: string
  }
  let { size = 20, class: className = '', markColor = '#fff' }: Props = $props()
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  class={className}
>
  <rect width="24" height="24" rx="12" fill="currentColor" />
  <path
    d="M8 8.007 16.485 16.492"
    stroke={markColor}
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    d="M16.484 8 7.999 16.485"
    stroke={markColor}
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>
