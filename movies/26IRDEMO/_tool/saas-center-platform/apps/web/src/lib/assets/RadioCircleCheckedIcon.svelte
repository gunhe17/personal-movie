<script lang="ts">
  interface Props {
    fillColor?: string
    checkColor?: string
    size?: number
  }

  let {
    fillColor = '#464C53',
    checkColor = '#FDFDFD',
    size = 24
  }: Props = $props()
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
>
  <circle cx="12" cy="12" r="10" fill={fillColor} />
  <path
    d="M7 12L10.6008 15.75L17.5 9.5"
    stroke={checkColor}
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>
