<script lang="ts">
  let {
    panels,
    layout = 'stack'
  }: { panels: string[]; layout?: 'stack' | 'split' } = $props()
</script>

<div class="wireframe {layout} compact">
  {#each panels as panel}<div class="wire-panel">{panel}</div>{/each}
</div>
