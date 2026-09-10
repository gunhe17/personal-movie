<script lang="ts">
  import DataRow from '../shared/DataRow.svelte'

  interface LocationData {
    Zf: number
    ZSum: number
    ZEst: number
    W: number
    D: number
    'W+D': number
    Dd: number
    S: number
  }

  interface Props { data: LocationData }
  let { data }: Props = $props()

  const SORT_ORDER = ['Zf', 'ZSum', 'ZEst', 'W', 'D', 'W+D', 'Dd', 'S'] as const
  const HIGHLIGHT_LIST = ['W', 'W+D', 'Dd', 'D', 'S']
</script>

{#each SORT_ORDER as key (key)}
  <DataRow
    column={key}
    value={data[key]}
    isHighlighted={HIGHLIGHT_LIST.includes(key)}
  />
{/each}
