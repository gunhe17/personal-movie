<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import RorschachPage from '@assessment/rorschach/pages/RorschachPage.svelte'

  const clientId = $derived(page.params.clientId || '')
  const currentStep = $derived(page.params.step || 'card-presentation')

  function handleNavigate(step: string) {
    goto(`/assessment-flow/rorschach/${clientId}/${step}`)
  }
</script>

<RorschachPage {clientId} step={currentStep} onNavigate={handleNavigate} />
