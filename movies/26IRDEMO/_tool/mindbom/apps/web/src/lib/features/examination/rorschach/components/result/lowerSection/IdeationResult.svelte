<script lang="ts">
  import DataRow from '../shared/DataRow.svelte'

  interface Props { data: Record<string, number | string> }
  let { data }: Props = $props()

  const SORT_ORDER = [
    'a:p', 'Ma:Mp', '2AB+Art+Ay', 'MOR',
    'Sum6', 'Lv2', 'WSum6', 'M-', 'Mnone',
  ]
  const BG_COLOR = '#1395A11A'
</script>

<div>
  {#each SORT_ORDER as key (key)}
    <DataRow column={key} value={data[key]} bgColor={BG_COLOR} cols="grid-cols-2" />
  {/each}
</div>
