<script lang="ts">
  export let strokeColor: string = '#B1B8BE'
  export let size: number = 12
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 12 12"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
>
  <path d="M3 6H9" stroke={strokeColor} stroke-linecap="round" />
  <path d="M6 3L6 9" stroke={strokeColor} stroke-linecap="round" />
</svg>
