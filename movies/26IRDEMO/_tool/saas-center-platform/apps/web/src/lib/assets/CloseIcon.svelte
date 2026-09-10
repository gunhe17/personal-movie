<script lang="ts">
  export let size = 24
  export let color = '#ffffff'
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  class={$$props['class']}
  xmlns="http://www.w3.org/2000/svg"
>
  <path d="M6 6L18 18" stroke={color} stroke-width="2" stroke-linecap="round" />
  <path d="M18 6L6 18" stroke={color} stroke-width="2" stroke-linecap="round" />
</svg>
