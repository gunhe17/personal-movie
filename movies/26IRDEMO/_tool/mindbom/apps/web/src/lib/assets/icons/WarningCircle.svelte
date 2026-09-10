<script lang="ts">
  /**
   * 원 채움 + 느낌표 — 경고 피드백용. 색은 쓰는 쪽에서 `text-*`로 준다.
   */
  interface Props {
    size?: number
    class?: string
    /** 느낌표 색 */
    markColor?: string
  }
  let { size = 20, class: className = '', markColor = '#fff' }: Props = $props()
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 20 20"
  fill="none"
  class={className}
>
  <circle cx="10" cy="10" r="9.45" fill="currentColor" />
  <path d="M10 11.5V5.5" stroke={markColor} stroke-width="2" stroke-linecap="round" />
  <circle cx="10" cy="14.5" r="1" fill={markColor} />
</svg>
