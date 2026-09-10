<script lang="ts">
  /**
   * 원 채움 + i — 안내 피드백용. 색은 쓰는 쪽에서 `text-*`로 준다.
   *
   * 참조 프로젝트는 말풍선(InfoChatIcon)을 썼으나, 같은 줄에 서는
   * 성공·실패·경고가 모두 원형이라 형태를 원으로 맞춘다.
   */
  interface Props {
    size?: number
    class?: string
    /** i 색 */
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
  <circle cx="10" cy="5.8" r="1" fill={markColor} />
  <path d="M10 8.5V14.5" stroke={markColor} stroke-width="2" stroke-linecap="round" />
</svg>
