<script lang="ts">
  export let width: number = 2
  export let height: number = 18
  export let stroke: string = '#B1B8BE'
  export let strokeWidth: number = 1.5
</script>

<svg
  {width}
  {height}
  viewBox="0 0 {width} {height}"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
>
  <path
    d="M0.75 0.75L0.750001 16.75"
    {stroke}
    stroke-width={strokeWidth}
    stroke-linecap="round"
  />
</svg>
