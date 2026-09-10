<script lang="ts">
  /** Figma Icon/20/Arrow_Down — 드롭다운 트리거·접힘 헤더 공용 셰브론.
   * 기본 색은 아이콘 토큰(gray-500). 활성/포커스 상태에서만 color를 넘긴다. */
  export let color: string = 'var(--color-icon-primary)'
</script>

<svg
  width="20"
  height="20"
  viewBox="0 0 20 20"
  fill="none"
  class={$$props['class']}
  xmlns="http://www.w3.org/2000/svg"
>
  <path
    d="M15 7.5L10 12.5L5 7.5"
    stroke={color}
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>
