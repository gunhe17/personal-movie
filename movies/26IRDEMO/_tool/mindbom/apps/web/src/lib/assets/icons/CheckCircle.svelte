<script lang="ts">
  /**
   * 원 채움 + 체크 — 성공 피드백용.
   *
   * 원은 currentColor로 채우고 체크는 배경색으로 뚫는다. 색은 쓰는 쪽에서
   * `text-*`로 준다(프로젝트 아이콘 공통 규약).
   */
  interface Props {
    size?: number
    class?: string
    /** 체크 획 색 — 아이콘이 얹히는 배경과 같아야 뚫린 것처럼 보인다 */
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
  <path
    d="M6.36 10.55 8.70 12.73 14.55 7.27"
    stroke={markColor}
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>
