<script lang="ts">
  import type { CardAreaData, StandardArea } from '../../area-data'
  import { OVERLAY_VIEWBOX } from '../../constants'

  interface Props {
    areaData: CardAreaData | null
    /** 강조할 영역 코드들 */
    highlightedCodes?: string[]
    visible?: boolean
  }

  let { areaData, highlightedCodes = [], visible = true }: Props = $props()

  /**
   * path 좌표는 0..1 normalized이지만 viewBox는 0..1000으로 확장해서 사용.
   * (vector-effect 미작동 환경 대비)
   */
  const VB = OVERLAY_VIEWBOX

  function pathToD(area: StandardArea): string {
    if (area.path.length === 0) return ''
    let d = `M ${area.path[0].x * VB} ${area.path[0].y * VB}`
    for (let i = 1; i < area.path.length; i++) {
      d += ` L ${area.path[i].x * VB} ${area.path[i].y * VB}`
    }
    return d + ' Z'
  }

  function colorOf(t: StandardArea['type']): { stroke: string; fill: string } {
    switch (t) {
      case 'W': return { stroke: '#9CA3AF', fill: '#9CA3AF0F' }
      case 'D': return { stroke: '#3B82F6', fill: '#3B82F610' }
      case 'Dd': return { stroke: '#8B5CF6', fill: '#8B5CF610' }
      case 'DdS': return { stroke: '#10B981', fill: '#10B98112' }
    }
  }

  function centroid(area: StandardArea): { x: number; y: number } {
    let sx = 0, sy = 0
    for (const p of area.path) { sx += p.x; sy += p.y }
    const n = area.path.length || 1
    return { x: sx / n, y: sy / n }
  }
</script>

{#if visible && areaData}
  <!--
    viewBox 0..1 + preserveAspectRatio=none → 박스 전체에 stretch.
    박스 자체가 16:9로 강제되고 카드 PNG도 16:9라 stretch가 곧 정확한 정렬이 됨.
    (meet/slice는 박스 비율이 살짝 빗나갈 때 letterbox가 생겨 path가 박스 밖으로 보임)
  -->
  <svg
    viewBox="0 0 {VB} {VB}"
    preserveAspectRatio="none"
    class="absolute inset-0 w-full h-full pointer-events-none z-3"
  >
    {#each areaData.areas as area, i (i)}
      {@const c = colorOf(area.type)}
      {@const highlighted = highlightedCodes.includes(area.code)}
      <path
        d={pathToD(area)}
        stroke={highlighted ? '#EF4444' : c.stroke}
        stroke-dasharray={area.type === 'W' ? '6 3' : '0'}
        fill={highlighted ? '#EF444425' : c.fill}
        vector-effect="non-scaling-stroke"
        stroke-width={highlighted ? 2 : 1}
        opacity={highlighted ? 0.9 : 0.4}
      />
    {/each}
  </svg>

  <!-- 코드 라벨: HTML div 레이어 -->
  <div class="absolute inset-0 pointer-events-none z-4">
    {#each areaData.areas as area, i (i)}
      {@const c = colorOf(area.type)}
      {@const highlighted = highlightedCodes.includes(area.code)}
      {@const cen = centroid(area)}
      <span
        class="absolute -translate-x-1/2 -translate-y-1/2 text-caption-01-normal-medium select-none"
        class:font-bold={highlighted}
        style="left: {cen.x * 100}%; top: {cen.y * 100}%; color: {highlighted ? '#EF4444' : c.stroke}; opacity: {highlighted ? 1 : 0.55};"
      >{area.code}</span>
    {/each}
  </div>
{/if}
