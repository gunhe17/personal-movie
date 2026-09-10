<script lang="ts">
  import DataRow from '../shared/DataRow.svelte'

  interface Props { data: Record<string, number> }
  let { data }: Props = $props()

  const SORT_ORDER = [
    'H', '(H)', 'Hd', '(Hd)', 'Hx',
    'A', '(A)', 'Ad', '(Ad)',
    'An', 'Art', 'Ay', 'Bl', 'Bt', 'Cg', 'Cl',
    'Ex', 'Fd', 'Fi', 'Ge', 'Hh', 'Ls', 'Na',
    'Sc', 'Sx', 'Xy', 'Id',
  ] as const
</script>

{#each SORT_ORDER as key (key)}
  <DataRow column={key} value={data[key] ?? 0} type="small" />
{/each}
