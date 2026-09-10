<script lang="ts">
  import DataRow from '../shared/DataRow.svelte'

  interface DQData {
    '+': number
    o: number
    'v/+': number
    v: number
  }

  interface Props { data: DQData }
  let { data }: Props = $props()

  const SORT_ORDER = ['+', 'o', 'v/+', 'v'] as const
</script>

{#each SORT_ORDER as key (key)}
  <DataRow column={key} value={data[key]} />
{/each}
