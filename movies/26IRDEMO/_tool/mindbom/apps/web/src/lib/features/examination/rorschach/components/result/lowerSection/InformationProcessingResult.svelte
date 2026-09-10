<script lang="ts">
  import DataRow from '../shared/DataRow.svelte'

  interface Props { data: Record<string, number | string> }
  let { data }: Props = $props()

  const SORT_ORDER = ['Zf', 'W:D:Dd', 'W:M', 'Zd', 'PSV', 'DQ+', 'DQv']
  const BG_COLOR = '#0176D01A'
</script>

<div>
  {#each SORT_ORDER as key (key)}
    <DataRow column={key} value={data[key]} bgColor={BG_COLOR} cols="grid-cols-2" />
  {/each}
</div>
