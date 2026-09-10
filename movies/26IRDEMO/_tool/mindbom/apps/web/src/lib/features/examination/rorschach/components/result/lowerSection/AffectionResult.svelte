<script lang="ts">
  import DataRow from '../shared/DataRow.svelte'

  interface Props { data: Record<string, number | string> }
  let { data }: Props = $props()

  const SORT_ORDER = ['FC:CF+C', 'Pure C', 'SumC:WSumC', 'Afr', 'S', 'Blends:R', 'CP']
  const BG_COLOR = '#C70A891A'
</script>

<div>
  {#each SORT_ORDER as key (key)}
    <DataRow column={key} value={data[key]} bgColor={BG_COLOR} cols="grid-cols-2" />
  {/each}
</div>
