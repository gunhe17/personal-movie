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
  <polygon points="5 3 19 12 5 21 5 3" />
</svg>
