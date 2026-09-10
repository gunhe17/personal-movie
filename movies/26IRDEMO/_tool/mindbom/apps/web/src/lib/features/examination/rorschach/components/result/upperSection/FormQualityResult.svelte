<script lang="ts">
  interface FQRow {
    '+': number
    o: number
    u: number
    '-': number
    none: number
    [key: string]: number
  }

  interface Props {
    data: {
      FQx: FQRow
      MQual: FQRow
      'W+D': FQRow
    }
  }

  let { data }: Props = $props()

  const ROW_KEYS = ['+', 'o', 'u', '-', 'none'] as const
  const HEADERS = ['', 'FQx', 'MQual', 'W+D']

  let rows = $derived(
    ROW_KEYS.map(key => ({
      key,
      FQx: data.FQx[key] ?? 0,
      MQual: data.MQual[key] ?? 0,
      WD: data['W+D'][key] ?? 0,
      isHighlighted: ['o', 'u', '-'].includes(key),
    }))
  )
</script>

<!--
  래퍼에 `border-b`를 두지 않는다 — 아래 행들이 각자 그리므로
  마지막 행에서 선이 두 겹이 된다.
-->
<div>
  <!-- 헤더 -->
  <div class="grid grid-cols-[74px_1fr_1fr_1fr]">
    {#each HEADERS as h, i (i)}
      <div class="flex items-center bg-gray-100 px-2.5 h-7">
        <span class="text-xs text-gray-500">{h}</span>
      </div>
    {/each}
  </div>

  <!-- 데이터 행 -->
  {#each rows as row (row.key)}
    <!-- 마지막 행은 아래 선을 안 그린다 — 섹션 프레임과 겹친다 -->
    <div class="grid grid-cols-[74px_1fr_1fr_1fr] last:[&>*]:border-b-0">
      <div class="flex items-center px-2.5 border-r border-b border-gray-100 last:border-r-0 h-7 bg-gray-50">
        <span class="text-xs {row.isHighlighted ? 'text-gray-800' : 'text-gray-500'}">{row.key}</span>
      </div>
      <div class="flex items-center px-2.5 border-r border-b border-gray-100 last:border-r-0 h-7 {row.isHighlighted ? 'bg-blue-50' : 'bg-white'}">
        <span class="text-xs {row.isHighlighted ? 'text-blue-700' : 'text-gray-500'}">{row.FQx}</span>
      </div>
      <div class="flex items-center px-2.5 border-r border-b border-gray-100 last:border-r-0 h-7 {row.isHighlighted ? 'bg-blue-50' : 'bg-white'}">
        <span class="text-xs {row.isHighlighted ? 'text-blue-700' : 'text-gray-500'}">{row.MQual}</span>
      </div>
      <div class="flex items-center px-2.5 border-r border-b border-gray-100 last:border-r-0 h-7 {row.isHighlighted ? 'bg-blue-50' : 'bg-white'}">
        <span class="text-xs {row.isHighlighted ? 'text-blue-700' : 'text-gray-500'}">{row.WD}</span>
      </div>
    </div>
  {/each}
</div>
