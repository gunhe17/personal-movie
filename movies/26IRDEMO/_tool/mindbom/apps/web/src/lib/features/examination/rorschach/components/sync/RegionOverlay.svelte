<script lang="ts">
  import type { ServerRegion } from '../../actions'
  import { OVERLAY_VIEWBOX } from '../../constants'

  /**
   * 서버 조각을 그대로 그린다 — 로컬 `Region`으로 변환하지 않는다.
   *
   * 위치는 반응당 하나이므로(§14-7) 조각을 고르는 것은 곧 **반응을 고르는
   * 것**이다. 그래서 키가 조각 id가 아니라 `response_id`다.
   */
  interface Props {
    regions: ServerRegion[]
    /** 선택된 **반응** id */
    selectedId: string | null
    onSelect: (responseId: string | null) => void
    /**
     * 조각 위에 띄울 라벨 — **소유 반응의 표시 번호에서 파생시킨다.**
     *
     * `colorOf`와 같은 이유로 필수다. 예전엔 선택 항목이라 안 넘기면
     * `region.label`(DB 저장값)로 떨어졌는데, 그 값은 옛 "카드 내 순번"이
     * 박제된 것이라 반응을 하나 지우면 그때부터 화면 번호와 갈렸다.
     * 그 컬럼은 2026-08-26에 없앴다 — 이제 돌아갈 곳 자체가 없다.
     */
    labelOf: (region: ServerRegion) => string
    /**
     * 조각 색 — **소유 반응에서 파생시킨다.**
     *
     * 조각에 `color` 컬럼이 있었는데 그릴 당시 규칙이 박제된 값이라,
     * 팔레트를 바꾸면 옛 조각만 옛 색으로 남아 칩과 어긋났다(2026-08-26 제거).
     * 부르는 쪽이 반응 번호로 색을 정하고, 여기는 받아 그리기만 한다.
     */
    colorOf: (region: ServerRegion) => string
  }

  let { regions, selectedId, onSelect, labelOf, colorOf }: Props = $props()

  /**
   * path 좌표는 0..1 normalized이지만 viewBox는 0..1000으로 확장해서 사용.
   * (viewBox 0..1 + stroke-width 2는 폴리곤의 200% 두께라 환경에 따라
   *  vector-effect가 무시되면 화면이 폴리곤으로 덮임. viewBox를 키워 안전하게.)
   */
  const VB = OVERLAY_VIEWBOX

  function pathToD(region: ServerRegion): string {
    if (region.path.length === 0) return ''
    let d = `M ${region.path[0].x * VB} ${region.path[0].y * VB}`
    for (let i = 1; i < region.path.length; i++) d += ` L ${region.path[i].x * VB} ${region.path[i].y * VB}`
    return d + ' Z'
  }

  function centroid(region: ServerRegion): { x: number; y: number } {
    let sx = 0, sy = 0
    for (const p of region.path) { sx += p.x; sy += p.y }
    const n = region.path.length || 1
    return { x: sx / n, y: sy / n }
  }
</script>

<!-- 폴리곤: viewBox 0..1000 + none (박스 16:9 강제 + stretch). path 좌표는 0..1*1000으로 그리기. -->
<svg
  viewBox="0 0 {VB} {VB}"
  preserveAspectRatio="none"
  class="absolute inset-0 w-full h-full pointer-events-none z-5"
>
  <!--
    focus outline을 끈다 — SVG path의 outline은 **bounding box를 따라
    사각형으로** 그려져서, 클릭하면 영역 모양과 무관한 네모가 뜬다.

    접근성 손실은 없다: 이 요소를 포커스하는 경로가 곧 선택하는 경로이고,
    선택되면 stroke가 굵어지고(2→3) 면이 진해진다(1A→33). 즉 포커스 표시가
    선택 표시로 대체된다.
  -->
  {#each regions as region (region.id)}
    {@const isSelected = region.response_id === selectedId}
    {@const color = colorOf(region)}
    <path
      d={pathToD(region)}
      stroke={color}
      fill={color + (isSelected ? '33' : '1A')}
      stroke-linecap="round"
      stroke-linejoin="round"
      vector-effect="non-scaling-stroke"
      stroke-width={isSelected ? 3 : 2}
      class="pointer-events-auto cursor-pointer focus:outline-none"
      onclick={(e) => { e.stopPropagation(); onSelect(region.response_id) }}
      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(region.response_id) } }}
      role="button"
      tabindex="0"
      aria-label="영역 {labelOf(region)}"
    />
  {/each}
</svg>

<!-- 라벨: HTML div 레이어 (박스/이미지가 같은 16:9면 letterbox 없음 → % 좌표가 그대로 정확) -->
<div class="absolute inset-0 pointer-events-none z-6">
  {#each regions as region (region.id)}
    {@const c = centroid(region)}
    <div
      class="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-label-02-normal-bold text-white shadow"
      style="left: {c.x * 100}%; top: {c.y * 100}%; background-color: {colorOf(region)};"
    >{labelOf(region)}</div>
  {/each}
</div>
