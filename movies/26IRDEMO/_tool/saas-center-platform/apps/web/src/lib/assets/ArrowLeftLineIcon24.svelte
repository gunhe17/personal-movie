<script lang="ts">
  let {
    color = 'white',
    strokeWidth = 2
  }: { color?: string; strokeWidth?: number | string } = $props()
</script>

<svg
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
>
  <path
    d="M19 12H5M5 12L12 19M5 12L12 5"
    stroke={color}
    stroke-width={strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>
