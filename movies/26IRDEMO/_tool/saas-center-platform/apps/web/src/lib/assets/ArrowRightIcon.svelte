<script lang="ts">
  export let width: number = 32
  export let height: number = 32
  export let strokeColor: string = '#6D7882'
</script>

<svg
  {width}
  {height}
  viewBox="0 0 32 32"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
>
  <path
    d="M12 9.33337L20 16L12 22.6667"
    stroke={strokeColor}
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>
