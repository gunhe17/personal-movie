<script lang="ts">
  // 케밥(더보기) 20 — Figma node 9248:351677 "Icon_20 / more_right".
  // 24와 같은 우측 정렬 규칙(점이 박스 우측 끝 x 17.5~20). 상세 패널 헤더처럼
  // 밀도가 높은 자리에 쓴다.
  interface Props {
    /** 단색 중성 아이콘 — 부모 text-* 를 따르려면 'currentColor' */
    color?: string
    class?: string
  }
  let { color = '#AAB2BE', class: className = '' }: Props = $props()
</script>

<svg
  width="20"
  height="20"
  viewBox="0 0 20 20"
  fill="none"
  class={className}
  xmlns="http://www.w3.org/2000/svg"
>
  <circle cx="18.75" cy="4.583" r="1.25" fill={color} />
  <circle cx="18.75" cy="10" r="1.25" fill={color} />
  <circle cx="18.75" cy="15.417" r="1.25" fill={color} />
</svg>
