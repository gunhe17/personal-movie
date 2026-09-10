<script lang="ts">
  import DataRow from '../shared/DataRow.svelte'

  interface Props { data: Record<string, number> }
  let { data }: Props = $props()

  const SORT_ORDER = [
    'M', 'FM', 'm', 'FC', 'CF', 'C', 'Cn',
    "FC'", "C'F", "C'", 'FT', 'TF', 'T',
    'FV', 'VF', 'V', 'FY', 'YF', 'Y',
    'Fr', 'rF', 'FD', 'F',
  ] as const
</script>

{#each SORT_ORDER as key (key)}
  <DataRow column={key} value={data[key] ?? 0} type="small" />
{/each}
