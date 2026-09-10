<script lang="ts">
  export let isCircled: boolean = true
  export let strokeColor: string = '#4C87F6'
  export let size: number = 24
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  class={$$props['class']}
  xmlns="http://www.w3.org/2000/svg"
>
  <rect
    width="24"
    height="24"
    rx="12"
    fill={isCircled ? '#D7E5FD' : 'transparent'}
  />
  <path
    d="M6 11.9941L18 11.9941"
    stroke={strokeColor}
    stroke-width="2"
    stroke-linecap="round"
  />
  <path
    d="M12.0049 6L12.0049 18"
    stroke={strokeColor}
    stroke-width="2"
    stroke-linecap="round"
  />
</svg>
