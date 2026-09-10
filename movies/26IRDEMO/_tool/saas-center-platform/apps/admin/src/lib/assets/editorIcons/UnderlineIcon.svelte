<script>
  import Svg from '../../components/Svg.svelte'
</script>

<Svg
  width={24}
  height={24}
  fill="none"
  {...$$props}
  viewBox="0 0 24 24"
  class={$$props['class']}
  xmlns="http://www.w3.org/2000/svg"
>
  <path
    d="M3 21H21"
    stroke="#616161"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    d="M7 4V10.5C7 11.8913 8 16 12 16C16 16 17 11.8913 17 10.5V4"
    stroke="#616161"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</Svg>
