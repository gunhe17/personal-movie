<script lang="ts">
  let {
    color = '#58616A',
    strokeWidth = 1
  }: { color?: string; strokeWidth?: number | string } = $props()
</script>

<svg
  width="16"
  height="16"
  viewBox="0 0 16 16"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
>
  <path
    d="M6 12L10 8L6 4"
    stroke={color}
    stroke-width={strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>
