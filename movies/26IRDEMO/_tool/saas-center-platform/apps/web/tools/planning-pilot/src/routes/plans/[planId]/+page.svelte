<script lang="ts">
  import PlanningEditor from '$lib/components/PlanningEditor.svelte'
  import type { PageData } from './$types'
  let { data }: { data: PageData } = $props()
</script>

{#key data.plan.id}<PlanningEditor {data} />{/key}
