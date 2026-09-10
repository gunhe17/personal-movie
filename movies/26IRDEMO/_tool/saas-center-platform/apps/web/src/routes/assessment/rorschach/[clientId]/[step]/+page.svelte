<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import RorschachPage from '@assessment/rorschach/pages/RorschachPage.svelte'

  interface Props {
    params: { clientId: string; step: string }
  }

  let { params }: Props = $props()
  const clientId = $derived(params.clientId || '')
  const currentStep = $derived(params.step || 'card-presentation')
  const rorschachBasePath = $derived(
    page.url.pathname.startsWith('/assessment-flow/rorschach')
      ? '/assessment-flow/rorschach'
      : '/assessment/rorschach'
  )

  function handleNavigate(step: string) {
    goto(`${rorschachBasePath}/${clientId}/${step}`)
  }
</script>

<RorschachPage {clientId} step={currentStep} onNavigate={handleNavigate} />
