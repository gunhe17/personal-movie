<script lang="ts">
  import DataRow from '../shared/DataRow.svelte'

  interface Props { data: Record<string, number | string> }
  let { data }: Props = $props()

  const SORT_ORDER = ['XA%', 'WDA%', 'X-%', 'S-', 'P', 'X+%', 'Xu%']
  const BG_COLOR = '#0123961A'

  /** % 키는 0..1을 백분율로 표시 */
  function fmt(key: string, v: number | string): string | number {
    if (typeof v !== 'number') return v
    if (key.endsWith('%')) return `${(v * 100).toFixed(0)}%`
    return v
  }
</script>

<div>
  {#each SORT_ORDER as key (key)}
    <DataRow column={key} value={fmt(key, data[key])} bgColor={BG_COLOR} cols="grid-cols-2" />
  {/each}
</div>
