<script lang="ts">
  // 에셋 카드용 미니 차트 썸네일.
  // SVG 생성은 chart-svg.ts에 공유 — 본문 삽입용과 같은 그림이 나온다.
  import { buildChartSvg, type ChartVariant } from './chart-svg'

  let {
    variant = 'bar',
    color = '#0ea5e9',
    seed = 0,
    class: klass = ''
  } = $props<{
    variant?: ChartVariant
    color?: string
    seed?: number
    class?: string
  }>()

  let svg = $derived(buildChartSvg({ variant, color, seed }))
</script>

<!-- eslint-disable-next-line svelte/no-at-html-tags -- 내부 생성 SVG(사용자 입력 없음) -->
<!-- 흰 종이 위 차트 — 옆의 실제 결과지 이미지(bg-white)와 톤을 맞춘다.
     테마 배경 위에 흰 타일이 놓이므로 경계를 링으로 준다. -->
<div
  class="h-24 w-full overflow-hidden rounded bg-white ring-1 ring-chrome-line {klass}"
  role="img"
  aria-label="차트 미리보기"
>
  {@html svg}
</div>

<style>
  div :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
