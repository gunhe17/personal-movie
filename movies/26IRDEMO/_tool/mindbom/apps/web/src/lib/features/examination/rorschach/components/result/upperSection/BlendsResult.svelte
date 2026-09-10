<script lang="ts">
  import DataRow from '../shared/DataRow.svelte'

  /** 블렌드 — [["Ma","FC"], ...] 형태. 한 행당 한 블렌드 표시. */
  interface Props { data: string[][] }
  let { data }: Props = $props()
</script>

{#each data as blend, i (i)}
  <DataRow column={blend[0] ?? ''} value={blend[1] ?? ''} />
{/each}
{#if data.length === 0}
  <DataRow column="없음" value="" />
{/if}
