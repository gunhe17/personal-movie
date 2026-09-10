<script lang="ts">
  import DataRow from '../shared/DataRow.svelte'

  interface Props { data: Record<string, number | string> }
  let { data }: Props = $props()

  const SORT_ORDER = [
    '3r+(2)/R', 'Fr+rF', 'SumV', 'FD', 'An+Xy', 'MOR', 'H:(H)+Hd+(Hd)',
  ]
  const BG_COLOR = '#0177501A'
</script>

<div>
  {#each SORT_ORDER as key (key)}
    <DataRow column={key} value={data[key]} bgColor={BG_COLOR} cols="grid-cols-2" />
  {/each}
</div>
