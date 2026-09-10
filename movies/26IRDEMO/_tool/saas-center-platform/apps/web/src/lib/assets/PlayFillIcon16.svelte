<!-- 재생(채움 삼각형) 16 — Figma "SaaS V.2 통합" node 7958:359197 (Icon_24, 네이티브 16).
     단색이라 currentColor를 따른다(칩 텍스트 색을 그대로 받는다). -->
<script lang="ts">
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
  <g transform="translate(4 3.5588)">
    <path
      d="M1.44951 0.195794C0.64903 -0.263373 5.14984e-05 0.112782 5.14984e-05 1.03529V7.84299C5.14984e-05 8.76641 0.64903 9.14208 1.44951 8.68335L7.39978 5.27091C8.20053 4.81158 8.20053 4.0674 7.39978 3.60818L1.44951 0.195794Z"
      fill="currentColor"
    />
  </g>
</svg>
