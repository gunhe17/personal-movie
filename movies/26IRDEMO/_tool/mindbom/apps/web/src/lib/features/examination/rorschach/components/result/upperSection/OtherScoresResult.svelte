<script lang="ts">
  import DataRow from '../shared/DataRow.svelte'

  interface Props { data: Record<string, number | null> }
  let { data }: Props = $props()

  const OTHER_KEYS = ['AB', 'AG', 'COP', 'CP', 'GHR', 'PHR', 'MOR', 'PER', 'PSV']
</script>

{#each OTHER_KEYS as key (key)}
  {@const v = data[key]}
  <DataRow column={key} value={v === null ? 'None' : v ?? 0} type="small" />
{/each}
