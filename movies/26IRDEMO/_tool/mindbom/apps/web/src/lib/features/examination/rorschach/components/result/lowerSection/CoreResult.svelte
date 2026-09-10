<script lang="ts">
  import DataRow from '../shared/DataRow.svelte'

  interface Props { data: Record<string, number | string> }
  let { data }: Props = $props()

  const SORT_ORDER = [
    'R', 'Lambda', 'EB', 'EA', 'EBPer',
    'eb', 'es', 'D', 'Adjes', 'AdjD',
    'FM', "SumC'", 'SumT', 'm', 'SumV', 'SumY',
  ]

  const BG_COLOR = '#FECB011A'
</script>

<div>
  {#each SORT_ORDER as key (key)}
    <DataRow column={key} value={data[key]} bgColor={BG_COLOR} cols="grid-cols-2" />
  {/each}
</div>
