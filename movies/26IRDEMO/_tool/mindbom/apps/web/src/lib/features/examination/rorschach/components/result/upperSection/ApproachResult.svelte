<script lang="ts">
  import DataRow from '../shared/DataRow.svelte'
  import { RORSCHACH_CARDS } from '../../../constants'

  /** I~X 카드별 location 시퀀스 (string[]) */
  interface Props { data: Record<string, string[]> }
  let { data }: Props = $props()
</script>

{#each RORSCHACH_CARDS as card (card)}
  <DataRow column={card} value={data[card] ?? []} />
{/each}
