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
  fill="currentColor"
  class={className}
>
  <rect x="6" y="6" width="12" height="12" rx="1" />
</svg>
