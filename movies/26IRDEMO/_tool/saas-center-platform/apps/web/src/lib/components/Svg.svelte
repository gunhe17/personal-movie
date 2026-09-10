<script lang="ts">
  import { twMerge } from 'tailwind-merge'

  export let width: number
  export let height: number
</script>

<svg
  width={width && width}
  height={height && height}
  viewBox={`0 0 ${width} ${height}`}
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  {...$$restProps}
  class={twMerge(
    $$props['defaultClassName'],
    $$props['className'],
    $$props['class']
  )}
>
  <slot />
</svg>
