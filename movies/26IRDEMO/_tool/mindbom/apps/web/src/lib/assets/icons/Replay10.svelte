<script lang="ts">
  interface Props {
    size?: number
    class?: string
  }
  let { size = 16, class: className = '' }: Props = $props()
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  class={className}
>
  <path d="M3 12a9 9 0 1 0 9-9" />
  <polyline points="3 4 3 9 8 9" />
  <text x="12" y="16" text-anchor="middle" font-size="8" font-weight="700" fill="currentColor" stroke="none">10</text>
</svg>
