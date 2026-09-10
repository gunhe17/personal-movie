<script lang="ts">
  interface Props {
    size?: number
    class?: string
    strokeWidth?: number
  }
  let {
    size = 16,
    class: className = '',
    strokeWidth = 2
  }: Props = $props()
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  class={className}
>
  <polyline points="6 9 12 15 18 9" />
</svg>
