<script lang="ts">
  /** Special Scores 데이터 — 동적 키 (DV1, DV2, INCOM1, ..., SUM6, WSUM6) */
  interface Props { data: Record<string, number | null> }
  let { data }: Props = $props()

  interface RowData {
    key: string
    level1: number
    level2?: number | null
    isHighlighted?: boolean
  }

  const MULTIPLIERS: Record<string, number[]> = {
    DV: [1, 2],
    INCOM: [2, 4],
    DR: [3, 6],
    FABCOM: [4, 7],
    ALOG: [5],
    CONTAM: [7],
  }

  let rows = $derived<RowData[]>([
    { key: 'DV', level1: data.DV1 ?? 0, level2: data.DV2 ?? 0 },
    { key: 'INCOM', level1: data.INCOM1 ?? 0, level2: data.INCOM2 ?? 0, isHighlighted: true },
    { key: 'DR', level1: data.DR1 ?? 0, level2: data.DR2 ?? 0, isHighlighted: true },
    { key: 'FABCOM', level1: data.FABCOM1 ?? 0, level2: data.FABCOM2 ?? 0, isHighlighted: true },
    { key: 'ALOG', level1: data.ALOG ?? 0 },
    { key: 'CONTAM', level1: data.CONTAM ?? 0 },
    { key: 'Sum6', level1: data.SUM6 ?? 0, isHighlighted: true },
    { key: 'WSum6', level1: data.WSUM6 ?? 0, isHighlighted: true },
  ])

  const COLS = 'grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_22px_minmax(0,1fr)_22px]'
</script>

<!--
  래퍼에 `border-b`를 두지 않는다 — 아래 행들이 각자 그리므로
  마지막 행에서 선이 두 겹이 된다.
-->
<div>
  <!-- 헤더 -->
  <div class="grid {COLS} border-b border-gray-100">
    <div class="flex items-center justify-center bg-gray-100 px-1 h-6"></div>
    <div class="col-span-2 flex items-center justify-center bg-gray-100 px-1 h-6">
      <span class="text-label-02-normal-regular text-gray-500">Level 1</span>
    </div>
    <div class="col-span-2 flex items-center justify-center bg-gray-100 px-1 h-6">
      <span class="text-label-02-normal-regular text-gray-500">Level 2</span>
    </div>
  </div>

  {#each rows as row (row.key)}
    {@const mult = MULTIPLIERS[row.key]}
    {@const hasLevel2 = row.level2 !== undefined}
    <!-- 마지막 행은 아래 선을 안 그린다 — 섹션 프레임과 겹친다 -->
    <div class="grid {COLS} last:[&>*]:border-b-0">
      <div class="flex items-center px-1.5 border-r border-b border-gray-100 last:border-r-0 h-6 bg-gray-50 min-w-0">
        <span class="text-label-02-normal-regular truncate {row.isHighlighted ? 'text-gray-800' : 'text-gray-500'}">{row.key}</span>
      </div>
      <div class="flex items-center px-1 border-r border-b border-gray-100 last:border-r-0 h-6 min-w-0 {row.isHighlighted ? 'bg-blue-50' : 'bg-white'}">
        <span class="text-label-02-normal-regular {row.isHighlighted ? 'text-blue-700' : 'text-gray-500'}">{row.level1}</span>
      </div>
      <div class="flex items-center justify-center border-r border-b border-gray-100 last:border-r-0 h-6 bg-white min-w-0">
        <span class="text-caption-01-normal-regular text-gray-400">{mult?.[0] ? `×${mult[0]}` : '-'}</span>
      </div>
      <div class="flex items-center px-1 border-r border-b border-gray-100 last:border-r-0 h-6 bg-white min-w-0">
        <span class="text-label-02-normal-regular text-gray-500">{hasLevel2 ? row.level2 ?? 0 : '-'}</span>
      </div>
      <div class="flex items-center justify-center border-r border-b border-gray-100 last:border-r-0 h-6 bg-white min-w-0">
        <span class="text-caption-01-normal-regular text-gray-400">{mult?.[1] ? `×${mult[1]}` : '-'}</span>
      </div>
    </div>
  {/each}
</div>
