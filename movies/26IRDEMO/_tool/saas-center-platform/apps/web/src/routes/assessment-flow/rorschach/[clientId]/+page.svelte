<script lang="ts">
  import { page } from '$app/state'
  import RorschachIntro from '@assessment/rorschach/components/intro/RorschachIntro.svelte'
  import RorschachStartOptions from '@assessment/rorschach/components/intro/RorschachStartOptions.svelte'
  const clientId = $derived(page.params.clientId || '')
</script>

<div class="flex min-h-screen">
  <RorschachIntro />
  <RorschachStartOptions {clientId} />
</div>
