<script lang="ts">
  /** 러닝타임(녹음 길이) 아이콘 16 — 단색 중성이라 currentColor를 따른다 */
  interface Props {
    size?: number
  }
  let { size = 16 }: Props = $props()
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 16 16"
  fill="none"
  aria-hidden="true"
>
  <circle
    cx="8"
    cy="8.75"
    r="5.25"
    stroke="currentColor"
    stroke-width="1.2"
  />
  <path
    d="M8 6.25V8.75L9.75 10"
    stroke="currentColor"
    stroke-width="1.2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <path
    d="M6.5 1.75H9.5"
    stroke="currentColor"
    stroke-width="1.2"
    stroke-linecap="round"
  />
</svg>
