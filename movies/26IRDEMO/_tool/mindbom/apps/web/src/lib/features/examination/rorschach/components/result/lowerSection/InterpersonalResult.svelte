<script lang="ts">
  import DataRow from '../shared/DataRow.svelte'

  interface Props { data: Record<string, number | string> }
  let { data }: Props = $props()

  const SORT_ORDER = [
    'COP', 'AG', 'GHR:PHR', 'a:p', 'Food',
    'SumT', 'Human Cont', 'PureH', 'PER', 'ISO Index',
  ]
  const BG_COLOR = '#84B5221A'
</script>

<div>
  {#each SORT_ORDER as key (key)}
    <DataRow column={key} value={data[key]} bgColor={BG_COLOR} cols="grid-cols-2" />
  {/each}
</div>
