<script lang="ts">
  // 케밥(더보기) 24 — Figma node 655:60256 "Icon_24 / More_Right".
  // 점 3개가 박스 우측 끝(x 21~24)에 붙어 있다 — 케밥은 보통 행 우측 끝에 놓이므로
  // 우측으로 쏠린 이 자산이라야 콘텐츠 우측선과 정렬이 맞는다.
  interface Props {
    /** 단색 중성 아이콘 — 부모 text-* 를 따르려면 'currentColor' */
    color?: string
    class?: string
  }
  let { color = '#7D848F', class: className = '' }: Props = $props()
</script>

<svg
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  class={className}
  xmlns="http://www.w3.org/2000/svg"
>
  <circle cx="22.5" cy="5.5" r="1.5" fill={color} />
  <circle cx="22.5" cy="12" r="1.5" fill={color} />
  <circle cx="22.5" cy="18.5" r="1.5" fill={color} />
</svg>
