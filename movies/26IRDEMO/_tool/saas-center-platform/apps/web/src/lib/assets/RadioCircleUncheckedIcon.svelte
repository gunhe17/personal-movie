<script lang="ts">
  interface Props {
    strokeColor?: string
    size?: number
  }

  let { strokeColor = '#E4E4E8', size = 24 }: Props = $props()
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
>
  <rect
    x="2.78125"
    y="2.78125"
    width="18.4375"
    height="18.4375"
    rx="9.21875"
    stroke={strokeColor}
    stroke-width="1.5625"
  />
  <path
    d="M8 12L10.8806 15L17 9"
    stroke={strokeColor}
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>
